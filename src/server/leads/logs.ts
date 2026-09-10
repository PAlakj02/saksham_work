import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { leadMessages, leads } from "@/db/schema";

/** Staff/admin view: every lead, newest first, with its message history. */
export async function getAllLeadsWithMessages() {
  const db = getDb();
  const allLeads = await db.select().from(leads).orderBy(desc(leads.createdAt)).limit(200);
  const allMessages = await db
    .select()
    .from(leadMessages)
    .orderBy(desc(leadMessages.createdAt));

  const messagesByLead = new Map<string, typeof allMessages>();
  for (const m of allMessages) {
    const list = messagesByLead.get(m.leadId) ?? [];
    list.push(m);
    messagesByLead.set(m.leadId, list);
  }

  return allLeads.map((lead) => ({
    ...lead,
    messages: messagesByLead.get(lead.id) ?? [],
  }));
}

export async function getLeadWithMessages(leadId: string) {
  const db = getDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) return null;
  const messages = await db
    .select()
    .from(leadMessages)
    .where(eq(leadMessages.leadId, leadId))
    .orderBy(desc(leadMessages.createdAt));
  return { ...lead, messages };
}
