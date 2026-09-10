-- Module 2: Lead Nurture Engine + Lapsed Donor Re-engagement
-- Adds the "other half" of the proposal's Recurring Donor & Lead
-- Conversation Engine section:
--   - LAPSED_DONOR_REENGAGEMENT extends the existing donor notification
--     engine (same tables, same preferences/idempotency machinery).
--   - leads / lead_messages are a new, parallel, staff-only system for
--     people who haven't donated yet (currently sourced from the /partner
--     inquiry form) — see docs/MODULE2_LEAD_ENGINE.md.
--
-- Run this once via the Supabase SQL editor, or `supabase db push` if the
-- project is linked with the Supabase CLI.

-- ── extend notification_preferences to allow the new type ──────────────
alter table public.notification_preferences
  drop constraint notification_preferences_notification_type_check;

alter table public.notification_preferences
  add constraint notification_preferences_notification_type_check
  check (
    notification_type in (
      'DONATION_CONFIRMED', 'RECEIPT_READY', 'RECURRING_DONATION_CHARGED',
      'RECURRING_DONATION_REMINDER', 'MONTHLY_IMPACT_SUMMARY',
      'LAPSED_DONOR_REENGAGEMENT'
    )
  );

-- ── leads ────────────────────────────────────────────────────────────────
-- People who've expressed interest but haven't signed up/donated yet.
-- Currently sourced only from the /partner inquiry form
-- (src/functions/partner.ts). Staff-only data — no donor/anon RLS policies;
-- accessed exclusively via the service-role Drizzle connection after
-- requireStaffMiddleware (same pattern as notification_logs writes).
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  organization text not null,
  email text not null,
  phone text,
  source text not null default 'partner_form',
  message text,
  -- Simple, explainable heuristic score (see src/server/leads/scoring.ts) —
  -- not a fabricated ML score. Higher = higher perceived giving capacity.
  score integer not null default 0,
  status text not null default 'new' check (status in ('new', 'contacted', 'converted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_created_at_idx on public.leads (created_at desc);
create index leads_status_idx on public.leads (status);

alter table public.leads enable row level security;
-- Intentionally no policies: only the service-role Drizzle connection
-- (src/functions/leads.ts, gated by requireStaffMiddleware) ever reads or
-- writes this table.

-- ── lead_messages ────────────────────────────────────────────────────────
-- Mirrors notification_logs' shape/idempotency pattern, scoped to leads
-- instead of donors.
create table public.lead_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  message_type text not null check (message_type in ('LEAD_WELCOME', 'LEAD_FOLLOWUP')),
  channel text not null check (channel in ('email', 'whatsapp')),
  recipient text not null,
  subject text,
  provider text not null,
  provider_message_id text,
  status text not null check (status in ('QUEUED', 'SENT', 'FAILED', 'SKIPPED')),
  error_code text,
  error_message text,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz
);

create index lead_messages_lead_id_idx on public.lead_messages (lead_id);
create index lead_messages_created_at_idx on public.lead_messages (created_at desc);

alter table public.lead_messages enable row level security;
-- Same as leads: service-role-only access, no policies for anon/authenticated.
