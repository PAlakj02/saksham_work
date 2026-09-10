/**
 * Central notification type registry.
 *
 * This is the single source of truth for "what notifications exist". Adding
 * a new notification type means adding one entry here (plus a template and
 * a trigger) — nothing in the notification engine (service.ts) needs to
 * change.
 */

export const NOTIFICATION_CHANNELS = ["email", "whatsapp"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = ["QUEUED", "SENT", "DELIVERED", "FAILED", "SKIPPED"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const NOTIFICATION_TYPE_IDS = [
  "DONATION_CONFIRMED",
  "RECEIPT_READY",
  "RECURRING_DONATION_CHARGED",
  "RECURRING_DONATION_REMINDER",
  "MONTHLY_IMPACT_SUMMARY",
  "LAPSED_DONOR_REENGAGEMENT",
] as const;
export type NotificationTypeId = (typeof NOTIFICATION_TYPE_IDS)[number];

export interface NotificationTypeMeta {
  id: NotificationTypeId;
  name: string;
  description: string;
  /** Essential notifications cannot be disabled by the donor. */
  category: "transactional" | "optional";
  channels: readonly NotificationChannel[];
  defaultEnabled: Record<NotificationChannel, boolean>;
}

export const NOTIFICATION_TYPES: Record<NotificationTypeId, NotificationTypeMeta> = {
  DONATION_CONFIRMED: {
    id: "DONATION_CONFIRMED",
    name: "Donation confirmation",
    description: "Sent immediately after a donation is successfully recorded.",
    category: "transactional",
    channels: ["email", "whatsapp"],
    defaultEnabled: { email: true, whatsapp: true },
  },
  RECEIPT_READY: {
    id: "RECEIPT_READY",
    name: "Receipt ready",
    description: "Sent when a tax-exemption receipt becomes available for a donation.",
    category: "transactional",
    channels: ["email", "whatsapp"],
    defaultEnabled: { email: true, whatsapp: true },
  },
  RECURRING_DONATION_CHARGED: {
    id: "RECURRING_DONATION_CHARGED",
    name: "Recurring donation charged",
    description: "Sent after a recurring donation is successfully charged.",
    category: "transactional",
    channels: ["email", "whatsapp"],
    defaultEnabled: { email: true, whatsapp: true },
  },
  RECURRING_DONATION_REMINDER: {
    id: "RECURRING_DONATION_REMINDER",
    name: "Recurring donation reminder",
    description: "Sent a few days before a recurring donation is scheduled to charge.",
    category: "optional",
    channels: ["email", "whatsapp"],
    defaultEnabled: { email: true, whatsapp: false },
  },
  MONTHLY_IMPACT_SUMMARY: {
    id: "MONTHLY_IMPACT_SUMMARY",
    name: "Monthly impact summary",
    description: "A monthly digest of the donor's contributions and impact.",
    category: "optional",
    channels: ["email", "whatsapp"],
    defaultEnabled: { email: true, whatsapp: false },
  },
  LAPSED_DONOR_REENGAGEMENT: {
    id: "LAPSED_DONOR_REENGAGEMENT",
    name: "Re-engagement check-in",
    description:
      "Sent to a past donor with no successful donation in a while, inviting them back.",
    category: "optional",
    channels: ["email", "whatsapp"],
    defaultEnabled: { email: true, whatsapp: false },
  },
};

export function isTransactional(type: NotificationTypeId): boolean {
  return NOTIFICATION_TYPES[type].category === "transactional";
}

export function getNotificationTypeMeta(type: NotificationTypeId): NotificationTypeMeta {
  const meta = NOTIFICATION_TYPES[type];
  if (!meta) throw new Error(`Unknown notification type: ${type}`);
  return meta;
}
