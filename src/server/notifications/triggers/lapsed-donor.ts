import { formatINR, formatIndianDate } from "@/lib/format";
import { sendNotification } from "../service";
import { appUrl, type DonorForNotification } from "./shared";

export interface LapsedDonorSummary {
  lastDonationDate: string;
  lifetimeTotal: number;
  /** Which calendar month this check counted as "lapsed" for — keeps the
   * idempotency key stable within a run but lets the check fire again in a
   * future month if they're still lapsed then. */
  periodKey: string;
}

/**
 * entityKey includes periodKey so a still-lapsed donor gets re-contacted in
 * a later period instead of being permanently deduped after the first send.
 */
export function triggerLapsedDonorReengagement(
  donor: DonorForNotification,
  summary: LapsedDonorSummary,
) {
  return sendNotification({
    type: "LAPSED_DONOR_REENGAGEMENT",
    donorId: donor.id,
    entityKey: `${donor.id}:${summary.periodKey}`,
    data: {
      donorName: donor.fullName,
      lastDonationDateFormatted: formatIndianDate(summary.lastDonationDate),
      lifetimeTotalFormatted: formatINR(summary.lifetimeTotal),
      donateUrl: `${appUrl()}/donate`,
    },
    metadata: { lastDonationDate: summary.lastDonationDate, periodKey: summary.periodKey },
  });
}
