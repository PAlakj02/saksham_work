import { createFileRoute } from "@tanstack/react-router";
import { assertCronAuthorized } from "@/server/notifications/jobs/cron-auth";
import { runLeadFollowupJob } from "@/server/leads/followup-job";

/**
 * POST /api/cron/lead-followups
 * Invoke daily from an external scheduler. See
 * docs/MODULE2_LEAD_ENGINE.md "Scheduled Jobs".
 */
export const Route = createFileRoute("/api/cron/lead-followups")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = assertCronAuthorized(request);
        if (unauthorized) return unauthorized;

        const summary = await runLeadFollowupJob();
        return Response.json(summary);
      },
    },
  },
});
