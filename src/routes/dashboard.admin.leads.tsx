import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatIndianDateTime } from "@/lib/format";
import { getStaffLeads } from "@/functions/leads";

export const Route = createFileRoute("/dashboard/admin/leads")({
  beforeLoad: ({ context }) => {
    if (!context.donor.isStaff) throw redirect({ to: "/dashboard" });
  },
  loader: () => getStaffLeads(),
  head: () => ({ meta: [{ title: "Leads — Staff | Tare Zameen Foundation" }] }),
  component: AdminLeadsPage,
});

const STATUS_TONE: Record<string, string> = {
  new: "bg-amber-100 text-amber-700",
  contacted: "bg-brand/10 text-brand",
  converted: "bg-emerald-100 text-emerald-700",
  closed: "bg-muted text-muted-foreground",
};

const MESSAGE_STATUS_TONE: Record<string, string> = {
  SENT: "bg-brand/10 text-brand",
  QUEUED: "bg-amber-100 text-amber-700",
  SKIPPED: "bg-muted text-muted-foreground",
  FAILED: "bg-destructive/10 text-destructive",
};

function AdminLeadsPage() {
  const leads = Route.useLoaderData();

  return (
    <main className="mx-auto min-h-dvh max-w-[1200px] px-6 pb-20 pt-32 lg:px-10">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-navy"
      >
        <ArrowLeft className="size-4" /> Back to dashboard
      </Link>

      <div className="mt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brand">Staff</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-navy sm:text-4xl">Leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Partnership inquiries, scored, with their nurture-message history — see
          docs/MODULE2_LEAD_ENGINE.md.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-white shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Messages</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No leads yet.
                </TableCell>
              </TableRow>
            )}
            {leads.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell className="whitespace-nowrap text-xs">
                  {formatIndianDateTime(lead.createdAt)}
                </TableCell>
                <TableCell className="text-xs font-medium text-navy">{lead.organization}</TableCell>
                <TableCell className="text-xs">
                  {lead.fullName}
                  <div className="text-muted-foreground">{lead.email}</div>
                </TableCell>
                <TableCell className="text-xs">{lead.source}</TableCell>
                <TableCell className="text-xs font-semibold">{lead.score}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={STATUS_TONE[lead.status] ?? ""}>
                    {lead.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {lead.messages.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {lead.messages.map((m) => (
                        <Badge
                          key={m.id}
                          variant="outline"
                          className={MESSAGE_STATUS_TONE[m.status] ?? ""}
                          title={m.errorMessage ?? undefined}
                        >
                          {m.messageType} · {m.channel} · {m.status}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
