import { assertPhase0RuntimeFlags } from "@erp/config/env";

assertPhase0RuntimeFlags();

export async function startApi(): Promise<void> {
  // Stub: choose Fastify/Hono/equivalent only through the tech-stack decision process.
  console.log("Spreadsheet ERP API stub ready. Implement AGENT-010 before editable cells.");
}
