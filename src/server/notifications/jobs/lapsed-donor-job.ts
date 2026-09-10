import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { donations, donors, recurringDonations } from "@/db/schema";
import { triggerLapsedDonorReengagement } from "../triggers/lapsed-donor";
import type { ChannelOutcome } from "../service";

export interface LapsedDonorJobSummary {
  lapsedDays: number;
  periodKey: string;
  scanned: number;
  results: Array<{ donorId: string; outcomes: ChannelOutcome[] }>;
}

interface LifetimeAgg {
  donorId: string;
  lastDonationDate: string;
  total: string | null;
}

/**
 * Identifies donors whose most recent successful donation is older than
 * LAPSED_DONOR_DAYS (default 60) and who have no currently active recurring
 * donation (an active subscriber isn't "lapsed" even between charge cycles),
 * then fires LAPSED_DONOR_REENGAGEMENT for each. Only ever considers real
 * past donations — a donor with zero successful donations is simply new,
 * not lapsed, and is never contacted by this job.
 *
 * Intended to run periodically (e.g. weekly) via an external scheduler —
 * see src/routes/api/cron/lapsed-donors.ts.
 */
export async function runLapsedDonorJob(
  now: Date = new Date(),
): Promise<LapsedDonorJobSummary> {
  const lapsedDays = Number(process.env.LAPSED_DONOR_DAYS ?? 60);
  const periodKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const db = getDb();
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - lapsedDays);

  const activeRecurring = await db
    .select({ donorId: recurringDonations.donorId })
    .from(recurringDonations)
    .where(eq(recurringDonations.status, "active"));
  const activeDonorIds = activeRecurring.map((r) => r.donorId);

  const lifetimeAgg = (await db
    .select({
      donorId: donations.donorId,
      lastDonationDate: sql<string>`max(${donations.createdAt})`,
      total: sql<string>`coalesce(sum(${donations.amountInr}), 0)`,
    })
    .from(donations)
    .where(eq(donations.status, "succeeded"))
    .groupBy(donations.donorId)
    .having(sql`max(${donations.createdAt}) < ${cutoff.toISOString()}`)) as LifetimeAgg[];

  const activeDonorIdSet = new Set(activeDonorIds);
  const lapsedAgg = lifetimeAgg.filter((r) => !activeDonorIdSet.has(r.donorId));

  if (lapsedAgg.length === 0) {
    return { lapsedDays, periodKey, scanned: 0, results: [] };
  }

  const lapsedDonors = await db
    .select({ id: donors.id, fullName: donors.fullName })
    .from(donors)
    .where(
      inArray(
        donors.id,
        lapsedAgg.map((r) => r.donorId),
      ),
    );
  const donorById = new Map(lapsedDonors.map((d) => [d.id, d]));

  const results: LapsedDonorJobSummary["results"] = [];
  for (const row of lapsedAgg) {
    const donor = donorById.get(row.donorId);
    if (!donor) continue;

    const outcomes = await triggerLapsedDonorReengagement(donor, {
      lastDonationDate: row.lastDonationDate,
      lifetimeTotal: Number(row.total ?? 0),
      periodKey,
    });
    results.push({ donorId: donor.id, outcomes });
  }

  return { lapsedDays, periodKey, scanned: lapsedAgg.length, results };
}
