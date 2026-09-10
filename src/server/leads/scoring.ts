/**
 * Deterministic, explainable lead score — not a fabricated/ML score. Every
 * point is traceable to a real field the lead actually submitted, so staff
 * can always see why a lead scored the way it did.
 */
export interface LeadScoringInput {
  partnerType: "society" | "rwa" | "corporate";
  phone?: string;
  message?: string;
}

const PARTNER_TYPE_POINTS: Record<LeadScoringInput["partnerType"], number> = {
  // Corporate/CSR partnerships typically carry larger, recurring giving
  // capacity than an individual society or RWA drive.
  corporate: 15,
  rwa: 10,
  society: 5,
};

export function computeLeadScore(input: LeadScoringInput): number {
  let score = PARTNER_TYPE_POINTS[input.partnerType];
  if (input.phone && input.phone.trim().length > 0) score += 5; // reachable on a second channel
  if (input.message && input.message.trim().length > 0) score += 5; // expressed specific intent
  return score;
}
