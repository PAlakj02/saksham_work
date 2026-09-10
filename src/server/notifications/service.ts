import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { donors, notificationLogs, notificationPreferences } from "@/db/schema";
import {
  getEmailProvider,
  EmailProviderConfigError,
  type SendEmailResult,
} from "./providers/email";
import {
  getWhatsAppProvider,
  WhatsAppProviderConfigError,
  type SendWhatsAppResult,
} from "./providers/whatsapp";
import {
  renderTemplate,
  TEMPLATE_KEYS,
  type RenderedEmail,
  type RenderedWhatsApp,
  type TemplateDataMap,
} from "./templates";
import { TemplateRenderError } from "./templates/render";
import {
  isTransactional,
  NOTIFICATION_TYPES,
  type NotificationChannel,
  type NotificationStatus,
  type NotificationTypeId,
} from "@/lib/notification-types";
import { buildIdempotencyKey } from "./idempotency";

type Db = ReturnType<typeof getDb>;

export interface SendNotificationInput<K extends NotificationTypeId> {
  type: K;
  donorId: string;
  data: TemplateDataMap[K];
  /** Identifies the underlying event (donation id, receipt id, etc.) — see idempotency.ts. */
  entityKey: string;
  metadata?: Record<string, unknown>;
}

export interface ChannelOutcome {
  channel: NotificationChannel;
  status: NotificationStatus;
  logId: string | null;
  reason?: string;
}

/**
 * The single place business code calls to send a notification. Fans out to
 * every channel the notification type supports (email/whatsapp), checking
 * donor preferences, idempotency, and provider availability for each. A
 * failure on one channel never throws — callers get a per-channel result
 * back and a donation/receipt/etc. that already succeeded is never rolled
 * back because a notification failed (see triggers/*.ts).
 */
export async function sendNotification<K extends NotificationTypeId>(
  input: SendNotificationInput<K>,
): Promise<ChannelOutcome[]> {
  const db = getDb();
  const [donor] = await db.select().from(donors).where(eq(donors.id, input.donorId)).limit(1);
  if (!donor) {
    throw new Error(`sendNotification: no donor found for id ${input.donorId}`);
  }

  const meta = NOTIFICATION_TYPES[input.type];
  const outcomes: ChannelOutcome[] = [];
  for (const channel of meta.channels) {
    outcomes.push(
      await sendOneChannel(db, {
        donor,
        type: input.type,
        channel,
        data: input.data,
        entityKey: input.entityKey,
        metadata: input.metadata,
      }),
    );
  }
  return outcomes;
}

interface SendOneChannelArgs<K extends NotificationTypeId> {
  donor: typeof donors.$inferSelect;
  type: K;
  channel: NotificationChannel;
  data: TemplateDataMap[K];
  entityKey: string;
  metadata?: Record<string, unknown>;
}

async function sendOneChannel<K extends NotificationTypeId>(
  db: Db,
  args: SendOneChannelArgs<K>,
): Promise<ChannelOutcome> {
  const { donor, type, channel, data, entityKey, metadata } = args;
  const idempotencyKey = buildIdempotencyKey(type, channel, entityKey);
  const templateKey = TEMPLATE_KEYS[type];
  const recipient = channel === "email" ? donor.email : donor.phone;

  const logId = await insertQueuedLogIfNew(db, {
    donorId: donor.id,
    notificationType: type,
    channel,
    templateKey,
    recipient: recipient ?? "(no contact on file)",
    provider: "pending",
    idempotencyKey,
    metadata,
  });

  if (!logId) {
    // A log for this exact (type, channel, entity) already exists — this
    // send was already attempted (e.g. a retried API request). Do nothing.
    return {
      channel,
      status: "SKIPPED",
      logId: null,
      reason: "Duplicate notification suppressed (idempotency).",
    };
  }

  try {
    if (!recipient) {
      return await finalize(db, logId, channel, "SKIPPED", {
        errorMessage: `No ${channel} contact information on file.`,
      });
    }

    if (!isTransactional(type)) {
      const enabled = await isChannelEnabled(db, donor.id, type, channel);
      if (!enabled) {
        return await finalize(db, logId, channel, "SKIPPED", {
          errorMessage: "Disabled by donor preference.",
        });
      }
    }

    const mode = (process.env.NOTIFICATION_MODE || "development").toLowerCase();
    const testMode = mode !== "production";

    let rendered: RenderedEmail | RenderedWhatsApp;
    try {
      rendered =
        channel === "email"
          ? renderTemplate(type, "email", data, { testMode })
          : renderTemplate(type, "whatsapp", data, { testMode });
    } catch (error) {
      const message =
        error instanceof TemplateRenderError ? error.message : "Template rendering failed.";
      return await finalize(db, logId, channel, "FAILED", {
        errorCode: "TEMPLATE_ERROR",
        errorMessage: message,
      });
    }

    if (channel === "email") {
      let provider;
      try {
        provider = getEmailProvider();
      } catch (error) {
        return await finalize(db, logId, channel, "FAILED", {
          errorCode: "CONFIG_ERROR",
          errorMessage:
            error instanceof EmailProviderConfigError
              ? error.message
              : "Email provider misconfigured.",
        });
      }

      const email = rendered as RenderedEmail;
      if (testMode && isRealEmailProvider(provider.name) && !isRecipientAllowlisted(recipient)) {
        return await finalize(db, logId, channel, "SKIPPED", {
          provider: provider.name,
          subject: email.subject,
          errorMessage: "Development mode: recipient is not in NOTIFICATION_TEST_RECIPIENTS.",
        });
      }

      const result: SendEmailResult = await provider.sendEmail({
        to: recipient,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });

      if (!result.success) {
        return await finalize(db, logId, channel, "FAILED", {
          provider: provider.name,
          subject: email.subject,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
        });
      }
      return await finalize(db, logId, channel, "SENT", {
        provider: provider.name,
        subject: email.subject,
        providerMessageId: result.providerMessageId,
      });
    }

    // WhatsApp
    let provider;
    try {
      provider = getWhatsAppProvider();
    } catch (error) {
      return await finalize(db, logId, channel, "FAILED", {
        errorCode: "CONFIG_ERROR",
        errorMessage:
          error instanceof WhatsAppProviderConfigError
            ? error.message
            : "WhatsApp provider misconfigured.",
      });
    }

    const whatsapp = rendered as RenderedWhatsApp;
    if (testMode && isRealWhatsAppProvider(provider.name) && !isRecipientAllowlisted(recipient)) {
      return await finalize(db, logId, channel, "SKIPPED", {
        provider: provider.name,
        errorMessage: "Development mode: recipient is not in NOTIFICATION_TEST_RECIPIENTS.",
      });
    }

    const result: SendWhatsAppResult = await provider.sendWhatsApp({
      to: recipient,
      text: whatsapp.text,
    });

    if (result.skipped) {
      return await finalize(db, logId, channel, "SKIPPED", {
        provider: provider.name,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      });
    }
    if (!result.success) {
      return await finalize(db, logId, channel, "FAILED", {
        provider: provider.name,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      });
    }
    return await finalize(db, logId, channel, "SENT", {
      provider: provider.name,
      providerMessageId: result.providerMessageId,
    });
  } catch (error) {
    // Last-resort guard: a bug here must never throw past the caller (a
    // successful donation/receipt must never become "failed" because of
    // this), and internal error detail must never reach the donor.
    return await finalize(db, logId, channel, "FAILED", {
      errorCode: "UNEXPECTED_ERROR",
      errorMessage: error instanceof Error ? error.message : "Unknown error.",
    });
  }
}

async function insertQueuedLogIfNew(
  db: Db,
  values: {
    donorId: string;
    notificationType: NotificationTypeId;
    channel: NotificationChannel;
    templateKey: string;
    recipient: string;
    provider: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  },
): Promise<string | null> {
  const rows = await db
    .insert(notificationLogs)
    .values({ ...values, status: "QUEUED" })
    .onConflictDoNothing({ target: notificationLogs.idempotencyKey })
    .returning({ id: notificationLogs.id });
  return rows[0]?.id ?? null;
}

async function finalize(
  db: Db,
  logId: string,
  channel: NotificationChannel,
  status: NotificationStatus,
  fields: {
    provider?: string;
    subject?: string;
    providerMessageId?: string;
    errorCode?: string;
    errorMessage?: string;
  },
): Promise<ChannelOutcome> {
  const now = new Date();
  await db
    .update(notificationLogs)
    .set({
      status,
      provider: fields.provider,
      subject: fields.subject,
      providerMessageId: fields.providerMessageId,
      errorCode: fields.errorCode,
      errorMessage: fields.errorMessage,
      sentAt: status === "SENT" ? now : undefined,
      failedAt: status === "FAILED" || status === "SKIPPED" ? now : undefined,
    })
    .where(eq(notificationLogs.id, logId));

  return { channel, status, logId, reason: fields.errorMessage };
}

async function isChannelEnabled(
  db: Db,
  donorId: string,
  type: NotificationTypeId,
  channel: NotificationChannel,
): Promise<boolean> {
  const [pref] = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.donorId, donorId),
        eq(notificationPreferences.notificationType, type),
      ),
    )
    .limit(1);
  if (!pref) return NOTIFICATION_TYPES[type].defaultEnabled[channel];
  return channel === "email" ? pref.emailEnabled : pref.whatsappEnabled;
}

export function isRealEmailProvider(name: string): boolean {
  return name !== "console";
}
export function isRealWhatsAppProvider(name: string): boolean {
  return name !== "disabled";
}

export function isRecipientAllowlisted(recipient: string): boolean {
  const allowlist = (process.env.NOTIFICATION_TEST_RECIPIENTS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(recipient.trim().toLowerCase());
}
