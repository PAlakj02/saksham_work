import type { leads } from "@/db/schema";
import { sendLeadMessage, type LeadChannelOutcome } from "./service";
import {
  renderLeadFollowupEmail,
  renderLeadFollowupWhatsApp,
  renderLeadWelcomeEmail,
  renderLeadWelcomeWhatsApp,
} from "./templates";

type LeadRow = typeof leads.$inferSelect;

function partnerUrl(): string {
  return `${process.env.APP_URL || ""}/partner`;
}

function channelsFor(lead: LeadRow) {
  return lead.phone ? (["email", "whatsapp"] as const) : (["email"] as const);
}

export function triggerLeadWelcome(lead: LeadRow): Promise<LeadChannelOutcome[]> {
  const data = { contactName: lead.fullName, organization: lead.organization, partnerUrl: partnerUrl() };
  return sendLeadMessage({
    lead,
    messageType: "LEAD_WELCOME",
    channels: [...channelsFor(lead)],
    render: (channel) =>
      channel === "email" ? renderLeadWelcomeEmail(data) : renderLeadWelcomeWhatsApp(data),
  });
}

export function triggerLeadFollowup(lead: LeadRow): Promise<LeadChannelOutcome[]> {
  const data = { contactName: lead.fullName, organization: lead.organization, partnerUrl: partnerUrl() };
  return sendLeadMessage({
    lead,
    messageType: "LEAD_FOLLOWUP",
    channels: [...channelsFor(lead)],
    render: (channel) =>
      channel === "email" ? renderLeadFollowupEmail(data) : renderLeadFollowupWhatsApp(data),
  });
}
