import { emailLayout, plainTextFooter } from "@/server/notifications/templates/layout";
import {
  escapeHtml,
  renderTemplateString,
  type TemplateVariables,
} from "@/server/notifications/templates/render";

export interface LeadWelcomeData {
  contactName: string;
  organization: string;
  partnerUrl: string;
}

export interface LeadFollowupData {
  contactName: string;
  organization: string;
  partnerUrl: string;
}

const WELCOME_TEMPLATE_KEY = "lead_welcome";
const WELCOME_SUBJECT = "Thanks for reaching out to Tare Zameen Foundation";

const WELCOME_EMAIL_BODY = `
  <p style="margin:0 0 14px;">Dear {{contactName}},</p>
  <p style="margin:0 0 14px;">
    Thank you for {{organization}}'s interest in partnering with Tare Zameen Foundation. Our
    partnerships team has received your inquiry and will reach out within 24 hours to discuss
    next steps.
  </p>
  <p style="margin:0;">In the meantime, feel free to explore the drives currently open for adoption.</p>
`;

const WELCOME_TEXT_BODY = `Dear {{contactName}},

Thank you for {{organization}}'s interest in partnering with Tare Zameen Foundation. Our partnerships team has received your inquiry and will reach out within 24 hours to discuss next steps.

In the meantime, feel free to explore the drives currently open for adoption: {{partnerUrl}}`;

const WELCOME_WHATSAPP_TEXT = `Hi {{contactName}}! Thanks for {{organization}}'s interest in partnering with Tare Zameen Foundation. Our team will reach out within 24 hours. Details: {{partnerUrl}}`;

export function renderLeadWelcomeEmail(data: LeadWelcomeData) {
  const htmlVars: TemplateVariables = {
    contactName: escapeHtml(data.contactName),
    organization: escapeHtml(data.organization),
  };
  const bodyHtml = renderTemplateString(WELCOME_TEMPLATE_KEY, WELCOME_EMAIL_BODY, htmlVars);
  const html = emailLayout({
    previewText: `Thanks for reaching out, ${data.organization}.`,
    heading: "Thanks for reaching out",
    bodyHtml,
    ctaLabel: "See open drives",
    ctaUrl: data.partnerUrl,
  });
  const textVars: TemplateVariables = {
    contactName: data.contactName,
    organization: data.organization,
    partnerUrl: data.partnerUrl,
  };
  const text = renderTemplateString(WELCOME_TEMPLATE_KEY, WELCOME_TEXT_BODY, textVars) + plainTextFooter();
  return { subject: WELCOME_SUBJECT, html, text };
}

export function renderLeadWelcomeWhatsApp(data: LeadWelcomeData) {
  const vars: TemplateVariables = {
    contactName: data.contactName,
    organization: data.organization,
    partnerUrl: data.partnerUrl,
  };
  return { text: renderTemplateString(WELCOME_TEMPLATE_KEY, WELCOME_WHATSAPP_TEXT, vars) };
}

const FOLLOWUP_TEMPLATE_KEY = "lead_followup";
const FOLLOWUP_SUBJECT = "Still interested in partnering with Tare Zameen Foundation?";

const FOLLOWUP_EMAIL_BODY = `
  <p style="margin:0 0 14px;">Dear {{contactName}},</p>
  <p style="margin:0 0 14px;">
    A few days ago {{organization}} reached out about partnering with Tare Zameen Foundation — we
    wanted to check in and see if you had any questions, or if now's a good time to pick the
    conversation back up.
  </p>
  <p style="margin:0;">We'd love to explore how {{organization}} can get involved.</p>
`;

const FOLLOWUP_TEXT_BODY = `Dear {{contactName}},

A few days ago {{organization}} reached out about partnering with Tare Zameen Foundation — we wanted to check in and see if you had any questions, or if now's a good time to pick the conversation back up.

We'd love to explore how {{organization}} can get involved: {{partnerUrl}}`;

const FOLLOWUP_WHATSAPP_TEXT = `Hi {{contactName}}, following up on {{organization}}'s interest in partnering with Tare Zameen Foundation — happy to answer any questions whenever suits you. {{partnerUrl}}`;

export function renderLeadFollowupEmail(data: LeadFollowupData) {
  const htmlVars: TemplateVariables = {
    contactName: escapeHtml(data.contactName),
    organization: escapeHtml(data.organization),
  };
  const bodyHtml = renderTemplateString(FOLLOWUP_TEMPLATE_KEY, FOLLOWUP_EMAIL_BODY, htmlVars);
  const html = emailLayout({
    previewText: `Following up with ${data.organization}.`,
    heading: "Still interested?",
    bodyHtml,
    ctaLabel: "Continue the conversation",
    ctaUrl: data.partnerUrl,
  });
  const textVars: TemplateVariables = {
    contactName: data.contactName,
    organization: data.organization,
    partnerUrl: data.partnerUrl,
  };
  const text = renderTemplateString(FOLLOWUP_TEMPLATE_KEY, FOLLOWUP_TEXT_BODY, textVars) + plainTextFooter();
  return { subject: FOLLOWUP_SUBJECT, html, text };
}

export function renderLeadFollowupWhatsApp(data: LeadFollowupData) {
  const vars: TemplateVariables = {
    contactName: data.contactName,
    organization: data.organization,
    partnerUrl: data.partnerUrl,
  };
  return { text: renderTemplateString(FOLLOWUP_TEMPLATE_KEY, FOLLOWUP_WHATSAPP_TEXT, vars) };
}
