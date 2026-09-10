import { createFileRoute } from "@tanstack/react-router";
import { assertCronAuthorized } from "@/server/notifications/jobs/cron-auth";
import { runLapsedDonorJob } from "@/server/notifications/jobs/lapsed-donor-job";

/**
 * POST /api/cron/lapsed-donors
 * Invoke periodically (e.g. weekly) from an external scheduler. See
 * docs/MODULE2_LEAD_ENGINE.md "Scheduled Jobs".
 */
export const Route = createFileRoute("/api/cron/lapsed-donors")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = assertCronAuthorized(request);
        if (unauthorized) return unauthorized;

        const summary = await runLapsedDonorJob();
        return Response.json(summary);
      },
    },
  },
});
