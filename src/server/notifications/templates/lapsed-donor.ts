import { emailLayout, plainTextFooter } from "./layout";
import { escapeHtml, renderTemplateString, type TemplateVariables } from "./render";

export const TEMPLATE_KEY = "lapsed_donor_reengagement";

export interface LapsedDonorData {
  donorName: string;
  lastDonationDateFormatted: string;
  lifetimeTotalFormatted: string;
  donateUrl: string;
}

const SUBJECT = "We miss you — come see the impact you've made so far";

const EMAIL_BODY = `
  <p style="margin:0 0 14px;">Dear {{donorName}},</p>
  <p style="margin:0 0 14px;">
    It's been a while since your last contribution on {{lastDonationDateFormatted}}. Together with
    donors like you, we've been able to keep supporting children and families who need it most —
    and your past gifts, totalling <strong>{{lifetimeTotalFormatted}}</strong> so far, are part of that story.
  </p>
  <p style="margin:0;">
    If you're able to, we'd be grateful to have you back — every contribution, big or small, continues to matter.
  </p>
`;

const TEXT_BODY = `Dear {{donorName}},

It's been a while since your last contribution on {{lastDonationDateFormatted}}. Together with donors like you, we've been able to keep supporting children and families who need it most — and your past gifts, totalling {{lifetimeTotalFormatted}} so far, are part of that story.

If you're able to, we'd be grateful to have you back — every contribution, big or small, continues to matter.

Donate again: {{donateUrl}}`;

const WHATSAPP_TEXT = `Hi {{donorName}}, it's been a while since your last gift to Tare Zameen Foundation on {{lastDonationDateFormatted}}. Your support so far ({{lifetimeTotalFormatted}}) has made a real difference — we'd love to have you back. {{donateUrl}}`;

export function renderLapsedDonorEmail(data: LapsedDonorData) {
  const htmlVars: TemplateVariables = {
    donorName: escapeHtml(data.donorName),
    lastDonationDateFormatted: data.lastDonationDateFormatted,
    lifetimeTotalFormatted: data.lifetimeTotalFormatted,
  };
  const bodyHtml = renderTemplateString(TEMPLATE_KEY, EMAIL_BODY, htmlVars);
  const html = emailLayout({
    previewText: `Your past gifts (${data.lifetimeTotalFormatted}) have made a real difference.`,
    heading: "We miss you",
    bodyHtml,
    ctaLabel: "Donate again",
    ctaUrl: data.donateUrl,
  });

  const textVars: TemplateVariables = {
    donorName: data.donorName,
    lastDonationDateFormatted: data.lastDonationDateFormatted,
    lifetimeTotalFormatted: data.lifetimeTotalFormatted,
    donateUrl: data.donateUrl,
  };
  const text = renderTemplateString(TEMPLATE_KEY, TEXT_BODY, textVars) + plainTextFooter();

  return { subject: SUBJECT, html, text };
}

export function renderLapsedDonorWhatsApp(data: LapsedDonorData) {
  const vars: TemplateVariables = {
    donorName: data.donorName,
    lastDonationDateFormatted: data.lastDonationDateFormatted,
    lifetimeTotalFormatted: data.lifetimeTotalFormatted,
    donateUrl: data.donateUrl,
  };
  return { text: renderTemplateString(TEMPLATE_KEY, WHATSAPP_TEXT, vars) };
}
