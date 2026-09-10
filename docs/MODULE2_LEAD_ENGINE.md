# Module 2 — Lead Nurture & Lapsed Donor Re-engagement

Extends Module 1 with the other half of the Technology Support Proposal's
"Recurring Donor & Lead Conversation Engine" section. Two independent
additions, both reusing Module 1's honest-provider / idempotency philosophy:

1. **`LAPSED_DONOR_REENGAGEMENT`** — a 6th notification type, added directly
   to the existing donor notification engine (`src/lib/notification-types.ts`,
   `src/server/notifications/`). No new tables needed — it reuses
   `donors`/`notification_preferences`/`notification_logs` exactly like the
   other 5 types.
2. **Lead nurture engine** (`src/server/leads/`) — a new, parallel, staff-only
   system for people who've expressed interest but haven't signed up or
   donated yet. Deliberately separate from the donor engine because leads
   have no `donor_id` and no notification preferences.

Both are **rule-based** (templated), not LLM-generated — see
`docs/PROPOSAL_ALIGNMENT.md` for why, and no new external API keys are
required for either.

## Lapsed donor re-engagement

- A donor is "lapsed" if their most recent `succeeded` donation is more than
  `LAPSED_DONOR_DAYS` (default 60) days old **and** they have no currently
  `active` recurring donation (an active subscriber is never "lapsed" just
  because it's between charge cycles).
- `src/server/notifications/jobs/lapsed-donor-job.ts` scans for these donors
  and fires `LAPSED_DONOR_REENGAGEMENT` via the same `sendNotification()`
  used by every other type — same idempotency, same donor preference
  respect (`defaultEnabled: { email: true, whatsapp: false }`, donor can
  toggle either).
- Idempotency key includes the current year-month, so a still-lapsed donor
  can be re-contacted in a later period rather than being permanently
  deduped after the first send.
- `POST /api/cron/lapsed-donors` (same bearer-secret auth as the other cron
  routes) — run weekly.

## Lead nurture

- **Source (today):** the existing `/partner` inquiry form
  (`src/functions/partner.ts`). Every submission becomes a `leads` row *in
  addition to* the existing staff-inbox email — nothing about that email
  changed.
- **Scoring** (`src/server/leads/scoring.ts`): a deterministic, explainable
  point score — not a fabricated ML score. `corporate` +15 / `rwa` +10 /
  `society` +5 (giving-capacity proxy), +5 for a phone number provided
  (reachable on a second channel), +5 for a non-empty message (expressed
  specific intent). Every point traces to a real submitted field.
- **`LEAD_WELCOME`** fires immediately on submission (`triggerLeadWelcome`,
  called from `submitPartnershipInquiry`, best-effort/`.catch()`-guarded so
  a nurture hiccup never turns a successful inquiry into an error for the
  submitter — same philosophy as donor notification triggers).
- **`LEAD_FOLLOWUP`** fires once, via `src/server/leads/followup-job.ts`, for
  any lead still `status = 'new'` after `LEAD_FOLLOWUP_DAYS` (default 3)
  days with no follow-up sent yet. `POST /api/cron/lead-followups` — run
  daily.
- **Messaging engine** (`src/server/leads/service.ts`): a lead-scoped
  counterpart to `sendNotification()` — same real-provider / dev-mode
  test-recipient-allowlist / idempotency rules, logged to `lead_messages`
  (mirrors `notification_logs`'s shape).
- **Staff view:** `/dashboard/admin/leads` — every lead, its score, status,
  and full message history (linked from the main dashboard for
  `donors.is_staff` accounts, next to the existing Staff log/Templates
  links).

## Database

`supabase/migrations/20260910120000_lead_engine_and_lapsed_donor.sql`:
- Widens `notification_preferences.notification_type`'s check constraint to
  allow `LAPSED_DONOR_REENGAGEMENT`.
- Adds `leads` and `lead_messages` — RLS enabled, **no policies** (staff-only
  data, accessed exclusively through the service-role Drizzle connection
  after `requireStaffMiddleware`, same access pattern already used for
  `notification_logs` writes).

## Environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `LAPSED_DONOR_DAYS` | Days with no successful donation before "lapsed" | `60` |
| `LEAD_FOLLOWUP_DAYS` | Days after a partner inquiry with no reply before a nudge | `3` |

## What this does *not* include (out of scope, per the proposal's larger ask)

- Real LLM-generated conversational text — templated wording only, by
  explicit choice (see `docs/PROPOSAL_ALIGNMENT.md`).
- Integration with an external CRM (HubSpot/Salesforce/Zoho/etc.) — the
  Foundation doesn't currently use one; `/dashboard/admin/leads` is the
  internal equivalent for now.
- Lead sources beyond the `/partner` form (e.g. a general newsletter/"become
  a donor" signup) — would slot into the same `leads` table via a new
  `source` value and a new trigger call, no engine changes needed.
- Automatic `leads.status` transitions (e.g. `new` → `contacted`) — currently
  a manual staff action (direct SQL update), matching how `donors.is_staff`
  is granted today.
