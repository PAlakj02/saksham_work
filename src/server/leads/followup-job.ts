import { and, eq, lt } from "drizzle-orm";
import { getDb } from "@/db/client";
import { leadMessages, leads } from "@/db/schema";
import { triggerLeadFollowup } from "./triggers";
import type { LeadChannelOutcome } from "./service";

export interface LeadFollowupJobSummary {
  followupDays: number;
  scanned: number;
  results: Array<{ leadId: string; outcomes: LeadChannelOutcome[] }>;
}

/**
 * Nurtures leads (currently sourced only from the /partner form — see
 * src/functions/partner.ts) that are still "new" after LEAD_FOLLOWUP_DAYS
 * (default 3) and haven't already received a follow-up message, by firing
 * LEAD_FOLLOWUP. Run periodically (e.g. daily) via an external scheduler —
 * see src/routes/api/cron/lead-followups.ts.
 */
export async function runLeadFollowupJob(now: Date = new Date()): Promise<LeadFollowupJobSummary> {
  const followupDays = Number(process.env.LEAD_FOLLOWUP_DAYS ?? 3);
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - followupDays);

  const db = getDb();

  const alreadyFollowedUp = await db
    .selectDistinct({ leadId: leadMessages.leadId })
    .from(leadMessages)
    .where(eq(leadMessages.messageType, "LEAD_FOLLOWUP"));
  const followedUpIds = new Set(alreadyFollowedUp.map((r) => r.leadId));

  const due = await db
    .select()
    .from(leads)
    .where(and(eq(leads.status, "new"), lt(leads.createdAt, cutoff)));

  const eligible = due.filter((lead) => !followedUpIds.has(lead.id));

  const results: LeadFollowupJobSummary["results"] = [];
  for (const lead of eligible) {
    const outcomes = await triggerLeadFollowup(lead);
    results.push({ leadId: lead.id, outcomes });
  }

  return { followupDays, scanned: eligible.length, results };
}
