import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { leadMessages, leads, type LeadMessageType } from "@/db/schema";
import {
  getEmailProvider,
  EmailProviderConfigError,
  type SendEmailResult,
} from "@/server/notifications/providers/email";
import {
  getWhatsAppProvider,
  WhatsAppProviderConfigError,
  type SendWhatsAppResult,
} from "@/server/notifications/providers/whatsapp";
import {
  isRealEmailProvider,
  isRealWhatsAppProvider,
  isRecipientAllowlisted,
} from "@/server/notifications/service";
import type { NotificationChannel, NotificationStatus } from "@/lib/notification-types";

type Db = ReturnType<typeof getDb>;
type LeadRow = typeof leads.$inferSelect;

export interface LeadChannelOutcome {
  channel: NotificationChannel;
  status: NotificationStatus;
  logId: string | null;
  reason?: string;
}

export interface SendLeadMessageInput {
  lead: LeadRow;
  messageType: LeadMessageType;
  channels: NotificationChannel[];
  render: (channel: NotificationChannel) => { subject?: string; html?: string; text: string };
}

/**
 * Lead-scoped counterpart to sendNotification() in
 * server/notifications/service.ts — same idempotency, honest-provider, and
 * test-mode-allowlist rules, but keyed to a lead instead of a donor (leads
 * have no donor_id and no notification_preferences row). Reuses the same
 * email/whatsapp provider factories so a real send is only ever reported as
 * SENT when the provider actually accepted it.
 */
export async function sendLeadMessage(input: SendLeadMessageInput): Promise<LeadChannelOutcome[]> {
  const db = getDb();
  const outcomes: LeadChannelOutcome[] = [];
  for (const channel of input.channels) {
    outcomes.push(await sendOneLeadChannel(db, input, channel));
  }
  return outcomes;
}

async function sendOneLeadChannel(
  db: Db,
  input: SendLeadMessageInput,
  channel: NotificationChannel,
): Promise<LeadChannelOutcome> {
  const { lead, messageType } = input;
  const idempotencyKey = `${messageType}:${channel}:${lead.id}`;
  const recipient = channel === "email" ? lead.email : lead.phone;

  const [row] = await db
    .insert(leadMessages)
    .values({
      leadId: lead.id,
      messageType,
      channel,
      recipient: recipient ?? "(no contact on file)",
      provider: "pending",
      status: "QUEUED",
      idempotencyKey,
    })
    .onConflictDoNothing({ target: leadMessages.idempotencyKey })
    .returning({ id: leadMessages.id });

  const logId = row?.id ?? null;
  if (!logId) {
    return {
      channel,
      status: "SKIPPED",
      logId: null,
      reason: "Duplicate lead message suppressed (idempotency).",
    };
  }

  if (!recipient) {
    return finalize(db, logId, channel, "SKIPPED", { errorMessage: `No ${channel} contact on file.` });
  }

  const mode = (process.env.NOTIFICATION_MODE || "development").toLowerCase();
  const testMode = mode !== "production";

  const rendered = input.render(channel);

  if (channel === "email") {
    let provider;
    try {
      provider = getEmailProvider();
    } catch (error) {
      return finalize(db, logId, channel, "FAILED", {
        errorCode: "CONFIG_ERROR",
        errorMessage:
          error instanceof EmailProviderConfigError ? error.message : "Email provider misconfigured.",
      });
    }
    if (testMode && isRealEmailProvider(provider.name) && !isRecipientAllowlisted(recipient)) {
      return finalize(db, logId, channel, "SKIPPED", {
        provider: provider.name,
        subject: rendered.subject,
        errorMessage: "Development mode: recipient is not in NOTIFICATION_TEST_RECIPIENTS.",
      });
    }
    const result: SendEmailResult = await provider.sendEmail({
      to: recipient,
      subject: rendered.subject ?? "",
      html: rendered.html ?? "",
      text: rendered.text,
    });
    if (!result.success) {
      return finalize(db, logId, channel, "FAILED", {
        provider: provider.name,
        subject: rendered.subject,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      });
    }
    return finalize(db, logId, channel, "SENT", {
      provider: provider.name,
      subject: rendered.subject,
      providerMessageId: result.providerMessageId,
    });
  }

  // WhatsApp
  let provider;
  try {
    provider = getWhatsAppProvider();
  } catch (error) {
    return finalize(db, logId, channel, "FAILED", {
      errorCode: "CONFIG_ERROR",
      errorMessage:
        error instanceof WhatsAppProviderConfigError ? error.message : "WhatsApp provider misconfigured.",
    });
  }
  if (testMode && isRealWhatsAppProvider(provider.name) && !isRecipientAllowlisted(recipient)) {
    return finalize(db, logId, channel, "SKIPPED", {
      provider: provider.name,
      errorMessage: "Development mode: recipient is not in NOTIFICATION_TEST_RECIPIENTS.",
    });
  }
  const result: SendWhatsAppResult = await provider.sendWhatsApp({ to: recipient, text: rendered.text });
  if (result.skipped) {
    return finalize(db, logId, channel, "SKIPPED", {
      provider: provider.name,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    });
  }
  if (!result.success) {
    return finalize(db, logId, channel, "FAILED", {
      provider: provider.name,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    });
  }
  return finalize(db, logId, channel, "SENT", { provider: provider.name, providerMessageId: result.providerMessageId });
}

async function finalize(
  db: Db,
  logId: string,
  channel: NotificationChannel,
  status: "SENT" | "FAILED" | "SKIPPED",
  fields: {
    provider?: string;
    subject?: string;
    providerMessageId?: string;
    errorCode?: string;
    errorMessage?: string;
  },
): Promise<LeadChannelOutcome> {
  const now = new Date();
  await db
    .update(leadMessages)
    .set({
      status,
      provider: fields.provider,
      subject: fields.subject,
      providerMessageId: fields.providerMessageId,
      errorCode: fields.errorCode,
      errorMessage: fields.errorMessage,
      sentAt: status === "SENT" ? now : undefined,
      failedAt: status === "FAILED" ? now : undefined,
    })
    .where(eq(leadMessages.id, logId));

  return { channel, status, logId, reason: fields.errorMessage };
}
