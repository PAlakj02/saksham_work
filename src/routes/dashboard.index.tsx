import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";
import {
  Heart,
  ShieldCheck,
  LineChart,
  LogOut,
  Bell,
  Repeat,
  ShieldAlert,
  Receipt,
  PlusCircle,
  Zap,
} from "lucide-react";
import { formatINR, formatIndianDate } from "@/lib/format";
import { signOut } from "@/functions/auth";
import { getMyDonations } from "@/functions/donations";
import { generateReceiptForDonation, getMyReceipts } from "@/functions/receipts";
import {
  createRecurringDonation,
  getMyRecurringDonations,
  simulateRecurringCharge,
} from "@/functions/recurring";

export const Route = createFileRoute("/dashboard/")({
  loader: async ({ context }) => {
    const [donations, recurring, receipts] = await Promise.all([
      getMyDonations(),
      getMyRecurringDonations(),
      getMyReceipts(),
    ]);
    return { donor: context.donor, donations, recurring, receipts };
  },
  head: () => ({
    meta: [
      { title: "Your Impact — Donor Dashboard | Tare Zameen Foundation" },
      {
        name: "description",
        content: "Track your donations, drives supported, and impact updates in one place.",
      },
      { property: "og:title", content: "Donor Dashboard" },
      { property: "og:description", content: "Your impact, updated in real time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardHome,
});

function DashboardHome() {
  const { donor, donations, recurring, receipts } = Route.useLoaderData();
  const router = useRouter();
  const signOutFn = useServerFn(signOut);
  const generateReceiptFn = useServerFn(generateReceiptForDonation);
  const createRecurringFn = useServerFn(createRecurringDonation);
  const simulateChargeFn = useServerFn(simulateRecurringCharge);
  const [busyId, setBusyId] = useState<string | null>(null);

  const receiptByDonationId = new Map(receipts.map((r) => [r.donation.id, r.receipt]));

  const totalDonated = donations
    .filter((d) => d.status === "succeeded")
    .reduce((sum, d) => sum + Number(d.amountInr), 0);
  const stats = [
    { icon: Heart, label: "Total Donated", value: formatINR(totalDonated) },
    {
      icon: Repeat,
      label: "Active Recurring Gifts",
      value: String(recurring.filter((r) => r.status === "active").length),
    },
    {
      icon: LineChart,
      label: "Donations Made",
      value: String(donations.filter((d) => d.status === "succeeded").length),
    },
  ];

  const handleSignOut = async () => {
    await signOutFn();
    router.navigate({ to: "/" });
  };

  const handleGenerateReceipt = async (donationId: string) => {
    setBusyId(donationId);
    try {
      await generateReceiptFn({ data: { donationId } });
      toast.success("Receipt generated — a confirmation has been sent to you.");
      await router.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't generate the receipt.");
    } finally {
      setBusyId(null);
    }
  };

  const handleStartRecurring = async () => {
    setBusyId("start-recurring");
    try {
      await createRecurringFn({ data: { amountInr: 1000 } });
      toast.success("Monthly giving started at ₹1,000/mo.");
      await router.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't start monthly giving.");
    } finally {
      setBusyId(null);
    }
  };

  const handleSimulateCharge = async (recurringDonationId: string) => {
    setBusyId(recurringDonationId);
    try {
      await simulateChargeFn({ data: { recurringDonationId } });
      toast.success("Recurring charge simulated — a confirmation has been sent to you.");
      await router.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't simulate the charge.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="mx-auto min-h-dvh max-w-[1200px] px-6 pb-20 pt-32 lg:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brand">
            Welcome back
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-navy">
            {donor.fullName.split(" ")[0]}, your impact.{" "}
            <span className="italic text-brand">In real time.</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/dashboard/notifications"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-2 text-xs font-medium text-navy hover:bg-accent"
          >
            <Bell className="size-3.5" /> Notification preferences
          </Link>
          {donor.isStaff && (
            <>
              <Link
                to="/dashboard/admin/notifications"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-2 text-xs font-medium text-navy hover:bg-accent"
              >
                <ShieldAlert className="size-3.5" /> Staff log
              </Link>
              <Link
                to="/dashboard/admin/templates"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-2 text-xs font-medium text-navy hover:bg-accent"
              >
                Templates
              </Link>
              <Link
                to="/dashboard/admin/leads"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-2 text-xs font-medium text-navy hover:bg-accent"
              >
                Leads
              </Link>
            </>
          )}
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-2 text-xs font-medium text-navy hover:bg-accent"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.6 }}
            className="rounded-2xl border border-border bg-white p-6 shadow-soft"
          >
            <div className="grid size-10 place-items-center rounded-lg bg-brand/10 text-brand">
              <s.icon className="size-5" />
            </div>
            <div className="mt-4 text-xs font-medium text-muted-foreground">{s.label}</div>
            <div className="mt-1 font-display text-3xl font-bold text-navy">{s.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-white p-6 shadow-soft lg:col-span-2">
          <div className="text-sm font-semibold text-navy">Recent Contributions</div>
          {donations.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No donations yet.{" "}
              <Link to="/donate" className="font-medium text-brand hover:underline">
                Make your first donation
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {donations.map((d) => {
                const receipt = receiptByDonationId.get(d.id);
                return (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <div className="font-medium text-navy">
                        {d.campaignName || "General Fund"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatIndianDate(d.createdAt)} · {d.referenceId}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {d.status === "succeeded" &&
                        (receipt ? (
                          <Link
                            to="/dashboard/receipts/$id"
                            params={{ id: receipt.id }}
                            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-navy hover:bg-accent"
                          >
                            <Receipt className="size-3" /> View receipt
                          </Link>
                        ) : (
                          <button
                            onClick={() => handleGenerateReceipt(d.id)}
                            disabled={busyId === d.id}
                            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-navy hover:bg-accent disabled:opacity-50"
                          >
                            <Receipt className="size-3" />{" "}
                            {busyId === d.id ? "Generating…" : "Get receipt"}
                          </button>
                        ))}
                      <div className="text-right">
                        <div className="font-semibold text-brand">{formatINR(d.amountInr)}</div>
                        {d.status === "failed" && (
                          <div className="text-[11px] font-medium text-destructive">Failed</div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-navy">Recurring Donations</div>
            {recurring.length > 0 && (
              <button
                onClick={handleStartRecurring}
                disabled={busyId === "start-recurring"}
                className="text-[11px] font-medium text-brand hover:underline disabled:opacity-50"
              >
                + Add another
              </button>
            )}
          </div>
          {recurring.length === 0 ? (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">No recurring donations set up yet.</p>
              <button
                onClick={handleStartRecurring}
                disabled={busyId === "start-recurring"}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full grad-brand px-3 py-2 text-xs font-semibold text-white shadow-glow disabled:opacity-60"
              >
                <PlusCircle className="size-3.5" />{" "}
                {busyId === "start-recurring" ? "Starting…" : "Start monthly giving (₹1,000)"}
              </button>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {recurring.map((r) => (
                <li key={r.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-navy">{formatINR(r.amountInr)}/mo</span>
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                      {r.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Next charge: {formatIndianDate(r.nextChargeDate)}
                  </div>
                  {r.status === "active" && (
                    <button
                      onClick={() => handleSimulateCharge(r.id)}
                      disabled={busyId === r.id}
                      className="mt-2 inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-navy hover:bg-accent disabled:opacity-50"
                      title="Demo affordance — simulates this cycle's charge succeeding (no live payment gateway is connected)."
                    >
                      <Zap className="size-3" />{" "}
                      {busyId === r.id ? "Charging…" : "Simulate this month's charge (test)"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-brand" /> 80G tax exemption on every donation
          </div>
        </div>
      </div>
    </main>
  );
}
