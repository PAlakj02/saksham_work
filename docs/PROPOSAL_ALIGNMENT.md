# How Modules 1 & 2 connect to the Technology Support Proposal

## In one paragraph

What's been built so far — Module 1 (WhatsApp/Email Notifications) and Module 2 (Lead Nurture &
Lapsed Donor Re-engagement) — is the **donor- and lead-communication backbone** that Sections B and C
of the Technology Support Proposal describe, not the full AI-enabled platform the proposal envisions
end-to-end. Concretely: every donor gets an automatic, logged message (email is fully live via Resend;
WhatsApp is built and tested end-to-end, and just needs a paid/verified business number to go live for
real sends) at the moments the proposal calls out — a donation confirmation, a receipt, a recurring-gift
charge, a renewal reminder before the next charge, a monthly impact summary, and now a re-engagement
check-in if they've gone quiet — with donors able to opt in or out of the non-essential ones. Separately,
every partnership inquiry now becomes a scored lead that gets an automatic welcome message and, if
there's no reply in a few days, a follow-up nudge — covering Section C's "nurture new leads into
first-time donors," "lead scoring and segmentation," and "conversation logs... tracked in one place,"
all rule-based rather than a real LLM (see "Why templates, not a real LLM" below) and with an internal
staff dashboard rather than a 3rd-party CRM. What it is *not* yet is Section A's AI matching engine,
Section B's per-event photo/story report generator, real CRM integration, or Section D's society
collaboration portal — those are separate future builds that would sit on top of this same messaging
backbone (any of them that needs to notify a donor, lead, or society would call into this same engine
rather than build their own).

## Mapping table (for a slide or quick reference)

| Proposal ask | Status | What exists today |
| --- | --- | --- |
| C — "Automated recurring-donor check-ins: renewal reminders, impact snapshots" | ✅ Built | `RECURRING_DONATION_REMINDER` and `MONTHLY_IMPACT_SUMMARY` notification types, real data (not fabricated numbers), donor can opt out of either |
| C — "...re-engagement messages for lapsed donors" | ✅ Built | `LAPSED_DONOR_REENGAGEMENT` — fires for donors with no successful donation in 60+ days and no active subscription. See `docs/MODULE2_LEAD_ENGINE.md` |
| C — "AI-assisted conversational workflows... to nurture new leads into first-time donors" | ✅ Built (rule-based, not LLM) | `LEAD_WELCOME` + `LEAD_FOLLOWUP`, fired off the existing `/partner` inquiry form. Deliberately templated, not LLM-generated — see "Why templates, not a real LLM" below |
| C — "Lead scoring and segmentation" | ✅ Built (deterministic, not ML) | Every lead gets an explainable point score (partner type, phone provided, message provided) — see `src/server/leads/scoring.ts` |
| C — "Conversation logs and CRM integration... tracked in one place" | ✅ Built (internal, not a 3rd-party CRM) | `notification_logs` (donors) + `lead_messages` (leads), both filterable in staff dashboards — `/dashboard/admin/notifications` and `/dashboard/admin/leads` |
| A — "Automated in-kind/contribution tracking with real-time donor notifications" | ✅ Built (donation side) | `DONATION_CONFIRMED`, `RECEIPT_READY`, `RECURRING_DONATION_CHARGED` fire automatically on the underlying record being created |
| A/C — multi-channel delivery (WhatsApp/email) | 🟡 Partially live | Email: live via Resend. WhatsApp: fully coded against both Twilio and Meta Cloud API, verified working end-to-end except for the final real send, which needs a paid Twilio number (trial accounts block API sends) or a free Meta Cloud API test setup |
| A — AI-based donor-to-beneficiary matching engine | ⬜ Not started | Out of scope — needs the beneficiary data model neither module touches |
| B — Auto-generated per-event photo/story reports | ⬜ Not started | Out of scope — these modules report on donations/recurring gifts and leads, not events |
| C — Lead sources beyond the /partner form; real 3rd-party CRM integration | ⬜ Not started | Would extend the same `leads` table / engine, not a rebuild — see `docs/MODULE2_LEAD_ENGINE.md` "What this does not include" |
| D — Society collaboration portal | ⬜ Not started | Separate module — would plug into this same notification engine for its own alerts |

### Why templates, not a real LLM, for the lead/lapsed-donor messages

Deliberate choice, not a shortcut: an LLM-generated message risks inventing or
overstating a donor/lead-specific claim (an impact number, a giving history
detail) the way this codebase explicitly refuses to do everywhere else (see
Module 1's "honest, non-fabricated" numbers). Rule-based templates cost
nothing extra to run and keep every word traceable to a real field. If real
LLM-personalized wording is wanted later, it's an additive change at the
`render()` call in `src/server/leads/triggers.ts` — the engine, logging, and
idempotency underneath don't need to change.

## How to explain it to them, in short

"We've built and tested the piece that every other part of this proposal will eventually need — the
system that actually reaches a donor or a lead by email or WhatsApp, remembers what was sent and why,
and respects what each person has opted into. Email is live today. WhatsApp is fully built and just
needs a small account step (a verified business number) to go fully live. On top of that, every
partnership inquiry now gets scored and automatically nurtured with a welcome message and a follow-up
if there's no reply, and a donor who's gone quiet gets an automatic check-in — both visible in an
internal staff dashboard. The AI matching, event reporting, real CRM integration, and society portal
pieces are the next phases — they'd all send their notifications through this same engine rather than
needing their own."
