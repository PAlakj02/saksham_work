import type { NotificationChannel, NotificationTypeId } from "@/lib/notification-types";
import * as donationConfirmed from "./donation-confirmed";
import * as receiptReady from "./receipt-ready";
import * as recurringReminder from "./recurring-reminder";
import * as recurringCharged from "./recurring-charged";
import * as monthlyImpactSummary from "./monthly-impact-summary";
import * as lapsedDonor from "./lapsed-donor";
import { injectTestBadge } from "./layout";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}
export interface RenderedWhatsApp {
  text: string;
}

export interface TemplateDataMap {
  DONATION_CONFIRMED: donationConfirmed.DonationConfirmedData;
  RECEIPT_READY: receiptReady.ReceiptReadyData;
  RECURRING_DONATION_REMINDER: recurringReminder.RecurringReminderData;
  RECURRING_DONATION_CHARGED: recurringCharged.RecurringChargedData;
  MONTHLY_IMPACT_SUMMARY: monthlyImpactSummary.MonthlyImpactSummaryData;
  LAPSED_DONOR_REENGAGEMENT: lapsedDonor.LapsedDonorData;
}

/** The `templateKey` persisted on every notification_logs row. */
export const TEMPLATE_KEYS: Record<NotificationTypeId, string> = {
  DONATION_CONFIRMED: donationConfirmed.TEMPLATE_KEY,
  RECEIPT_READY: receiptReady.TEMPLATE_KEY,
  RECURRING_DONATION_REMINDER: recurringReminder.TEMPLATE_KEY,
  RECURRING_DONATION_CHARGED: recurringCharged.TEMPLATE_KEY,
  MONTHLY_IMPACT_SUMMARY: monthlyImpactSummary.TEMPLATE_KEY,
  LAPSED_DONOR_REENGAGEMENT: lapsedDonor.TEMPLATE_KEY,
};

const EMAIL_RENDERERS = {
  DONATION_CONFIRMED: donationConfirmed.renderDonationConfirmedEmail,
  RECEIPT_READY: receiptReady.renderReceiptReadyEmail,
  RECURRING_DONATION_REMINDER: recurringReminder.renderRecurringReminderEmail,
  RECURRING_DONATION_CHARGED: recurringCharged.renderRecurringChargedEmail,
  MONTHLY_IMPACT_SUMMARY: monthlyImpactSummary.renderMonthlyImpactSummaryEmail,
  LAPSED_DONOR_REENGAGEMENT: lapsedDonor.renderLapsedDonorEmail,
} satisfies { [K in NotificationTypeId]: (data: TemplateDataMap[K]) => RenderedEmail };

const WHATSAPP_RENDERERS = {
  DONATION_CONFIRMED: donationConfirmed.renderDonationConfirmedWhatsApp,
  RECEIPT_READY: receiptReady.renderReceiptReadyWhatsApp,
  RECURRING_DONATION_REMINDER: recurringReminder.renderRecurringReminderWhatsApp,
  RECURRING_DONATION_CHARGED: recurringCharged.renderRecurringChargedWhatsApp,
  MONTHLY_IMPACT_SUMMARY: monthlyImpactSummary.renderMonthlyImpactSummaryWhatsApp,
  LAPSED_DONOR_REENGAGEMENT: lapsedDonor.renderLapsedDonorWhatsApp,
} satisfies { [K in NotificationTypeId]: (data: TemplateDataMap[K]) => RenderedWhatsApp };

/**
 * Single entry point the notification engine uses to turn (type, channel,
 * data) into a message — this is the only place service.ts touches
 * templates, and it never contains message wording itself.
 */
export interface RenderTemplateOptions {
  /** Development-mode sends are visibly marked so they're never mistaken for a real notification. */
  testMode?: boolean;
}

export function renderTemplate<K extends NotificationTypeId>(
  type: K,
  channel: "email",
  data: TemplateDataMap[K],
  opts?: RenderTemplateOptions,
): RenderedEmail;
export function renderTemplate<K extends NotificationTypeId>(
  type: K,
  channel: "whatsapp",
  data: TemplateDataMap[K],
  opts?: RenderTemplateOptions,
): RenderedWhatsApp;
export function renderTemplate<K extends NotificationTypeId>(
  type: K,
  channel: NotificationChannel,
  data: TemplateDataMap[K],
  opts?: RenderTemplateOptions,
): RenderedEmail | RenderedWhatsApp {
  if (channel === "email") {
    const result = EMAIL_RENDERERS[type](data as never);
    if (!opts?.testMode) return result;
    return {
      subject: `[TEST] ${result.subject}`,
      html: injectTestBadge(result.html),
      text: `[TEST]\n${result.text}`,
    };
  }
  const result = WHATSAPP_RENDERERS[type](data as never);
  if (!opts?.testMode) return result;
  return { text: `[TEST] ${result.text}` };
}

export type { DonationConfirmedData } from "./donation-confirmed";
export type { ReceiptReadyData } from "./receipt-ready";
export type { RecurringReminderData } from "./recurring-reminder";
export type { RecurringChargedData } from "./recurring-charged";
export type { MonthlyImpactSummaryData } from "./monthly-impact-summary";
export type { LapsedDonorData } from "./lapsed-donor";
