import type { TemplateDataMap } from "./index";

/**
 * PREVIEW / DEMO DATA ONLY. Used exclusively by the staff template-preview
 * tool (src/routes/dashboard/admin.templates.tsx) so wording can be
 * reviewed without a real donor or real donation. Never used for an actual
 * notification send — real sends always use live donor/donation data (see
 * triggers/*.ts). Deliberately does NOT include any impact/statistics
 * fabrication — MONTHLY_IMPACT_SUMMARY sample numbers here are clearly
 * fictional preview values, not a claim about real impact.
 */
export const SAMPLE_DATA: TemplateDataMap = {
  DONATION_CONFIRMED: {
    donorName: "Priya Sharma",
    amountFormatted: "₹2,500",
    dateFormatted: "13 August 2026",
    referenceId: "TZF-2026-000123",
    campaignName: "Mid-Day Meal Support",
    dashboardUrl: "https://example.org/dashboard",
  },
  RECEIPT_READY: {
    donorName: "Priya Sharma",
    amountFormatted: "₹2,500",
    dateFormatted: "13 August 2026",
    receiptNumber: "RCPT-2026-00045678",
    receiptUrl: "https://example.org/dashboard/receipts/sample",
  },
  RECURRING_DONATION_REMINDER: {
    donorName: "Priya Sharma",
    amountFormatted: "₹1,000",
    scheduledDateFormatted: "16 August 2026",
    campaignName: "Monthly Giving Circle",
    manageUrl: "https://example.org/dashboard",
  },
  RECURRING_DONATION_CHARGED: {
    donorName: "Priya Sharma",
    amountFormatted: "₹1,000",
    dateFormatted: "13 August 2026",
    referenceId: "TZF-2026-000124",
    campaignName: "Monthly Giving Circle",
    dashboardUrl: "https://example.org/dashboard",
  },
  MONTHLY_IMPACT_SUMMARY: {
    donorName: "Priya Sharma",
    monthLabel: "August 2026",
    hasMonthlyActivity: true,
    monthlyTotalFormatted: "₹3,500",
    monthlyDonationCount: 2,
    lifetimeTotalFormatted: "₹42,500",
    lifetimeDonationCount: 8,
    impactUrl: "https://example.org/dashboard",
  },
  LAPSED_DONOR_REENGAGEMENT: {
    donorName: "Priya Sharma",
    lastDonationDateFormatted: "13 June 2026",
    lifetimeTotalFormatted: "₹42,500",
    donateUrl: "https://example.org/donate",
  },
};
