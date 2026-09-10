import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type {
  NotificationChannel,
  NotificationStatus,
  NotificationTypeId,
} from "@/lib/notification-types";

/**
 * Schema is hand-authored to match `supabase/migrations/*.sql` (source of
 * truth for DDL, including the `auth.users` foreign keys, RLS policies, and
 * the `handle_new_user` trigger — none of which drizzle-kit push handles
 * cleanly across the `auth` schema). Run migrations via the Supabase SQL
 * editor or `supabase db push`; use this file only for typed queries.
 * See docs/MODULE1_NOTIFICATIONS.md for details.
 */

// One row per Supabase Auth user (donors.id === auth.users.id).
export const donors = pgTable("donors", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  /** E.164 format, e.g. +919876543210. Required only to enable WhatsApp. */
  phone: text("phone"),
  isStaff: boolean("is_staff").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const recurringDonations = pgTable(
  "recurring_donations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    donorId: uuid("donor_id")
      .notNull()
      .references(() => donors.id, { onDelete: "cascade" }),
    amountInr: numeric("amount_inr", { precision: 12, scale: 2 }).notNull(),
    frequency: text("frequency").notNull().$type<"monthly">().default("monthly"),
    campaignName: text("campaign_name"),
    status: text("status").notNull().$type<"active" | "paused" | "cancelled">().default("active"),
    nextChargeDate: date("next_charge_date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("recurring_donations_donor_id_idx").on(t.donorId),
    index("recurring_donations_next_charge_date_idx").on(t.nextChargeDate),
  ],
);

export const donations = pgTable(
  "donations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    donorId: uuid("donor_id")
      .notNull()
      .references(() => donors.id, { onDelete: "cascade" }),
    recurringDonationId: uuid("recurring_donation_id").references(() => recurringDonations.id, {
      onDelete: "set null",
    }),
    amountInr: numeric("amount_inr", { precision: 12, scale: 2 }).notNull(),
    campaignName: text("campaign_name"),
    status: text("status").notNull().$type<"succeeded" | "failed">(),
    referenceId: text("reference_id").notNull(),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("donations_reference_id_key").on(t.referenceId),
    index("donations_donor_id_idx").on(t.donorId),
  ],
);

export const receipts = pgTable(
  "receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    donationId: uuid("donation_id")
      .notNull()
      .references(() => donations.id, { onDelete: "cascade" }),
    receiptNumber: text("receipt_number").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("receipts_donation_id_key").on(t.donationId),
    uniqueIndex("receipts_receipt_number_key").on(t.receiptNumber),
  ],
);

// Generic (donor, notificationType) preference row — see brief section 7.
// Absence of a row means "use NOTIFICATION_TYPES[...].defaultEnabled".
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    donorId: uuid("donor_id")
      .notNull()
      .references(() => donors.id, { onDelete: "cascade" }),
    notificationType: text("notification_type").notNull().$type<NotificationTypeId>(),
    emailEnabled: boolean("email_enabled").notNull().default(true),
    whatsappEnabled: boolean("whatsapp_enabled").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.donorId, t.notificationType] })],
);

export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    donorId: uuid("donor_id")
      .notNull()
      .references(() => donors.id, { onDelete: "cascade" }),
    notificationType: text("notification_type").notNull().$type<NotificationTypeId>(),
    channel: text("channel").notNull().$type<NotificationChannel>(),
    templateKey: text("template_key").notNull(),
    recipient: text("recipient").notNull(),
    subject: text("subject"),
    provider: text("provider").notNull(),
    providerMessageId: text("provider_message_id"),
    status: text("status").notNull().$type<NotificationStatus>(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    /** Format: `${type}:${channel}:${entityKey}` — unique, enforces idempotency. */
    idempotencyKey: text("idempotency_key"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("notification_logs_idempotency_key_key").on(t.idempotencyKey),
    index("notification_logs_donor_id_idx").on(t.donorId),
    index("notification_logs_created_at_idx").on(t.createdAt),
    index("notification_logs_type_idx").on(t.notificationType),
  ],
);

// People who've expressed interest but haven't signed up/donated yet.
// Currently sourced only from the /partner inquiry form. Staff-only —
// see supabase/migrations/20260910120000_lead_engine_and_lapsed_donor.sql.
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fullName: text("full_name").notNull(),
    organization: text("organization").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    source: text("source").notNull().default("partner_form"),
    message: text("message"),
    /** Simple, explainable heuristic score — see src/server/leads/scoring.ts. */
    score: integer("score").notNull().default(0),
    status: text("status")
      .notNull()
      .$type<"new" | "contacted" | "converted" | "closed">()
      .default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("leads_created_at_idx").on(t.createdAt), index("leads_status_idx").on(t.status)],
);

export const LEAD_MESSAGE_TYPES = ["LEAD_WELCOME", "LEAD_FOLLOWUP"] as const;
export type LeadMessageType = (typeof LEAD_MESSAGE_TYPES)[number];

export const leadMessages = pgTable(
  "lead_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    messageType: text("message_type").notNull().$type<LeadMessageType>(),
    channel: text("channel").notNull().$type<NotificationChannel>(),
    recipient: text("recipient").notNull(),
    subject: text("subject"),
    provider: text("provider").notNull(),
    providerMessageId: text("provider_message_id"),
    status: text("status").notNull().$type<"QUEUED" | "SENT" | "FAILED" | "SKIPPED">(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("lead_messages_idempotency_key_key").on(t.idempotencyKey),
    index("lead_messages_lead_id_idx").on(t.leadId),
    index("lead_messages_created_at_idx").on(t.createdAt),
  ],
);

export const leadsRelations = relations(leads, ({ many }) => ({
  messages: many(leadMessages),
}));

export const leadMessagesRelations = relations(leadMessages, ({ one }) => ({
  lead: one(leads, { fields: [leadMessages.leadId], references: [leads.id] }),
}));

export const donorsRelations = relations(donors, ({ many }) => ({
  donations: many(donations),
  receipts: many(receipts),
  recurringDonations: many(recurringDonations),
  notificationLogs: many(notificationLogs),
  notificationPreferences: many(notificationPreferences),
}));

export const donationsRelations = relations(donations, ({ one }) => ({
  donor: one(donors, { fields: [donations.donorId], references: [donors.id] }),
  recurringDonation: one(recurringDonations, {
    fields: [donations.recurringDonationId],
    references: [recurringDonations.id],
  }),
}));

export const receiptsRelations = relations(receipts, ({ one }) => ({
  donation: one(donations, { fields: [receipts.donationId], references: [donations.id] }),
}));

export const recurringDonationsRelations = relations(recurringDonations, ({ one, many }) => ({
  donor: one(donors, { fields: [recurringDonations.donorId], references: [donors.id] }),
  donations: many(donations),
}));
