import { createServerFn } from "@tanstack/react-start";
import { requireStaffMiddleware } from "@/auth/require-donor";
import { getAllLeadsWithMessages } from "@/server/leads/logs";

export const getStaffLeads = createServerFn({ method: "GET" })
  .middleware([requireStaffMiddleware])
  .handler(async () => getAllLeadsWithMessages());
