import type { SubmitCommandRequest, SubmitCommandResponse } from "@erp/contracts/command-api";

export async function submitCommand(request: SubmitCommandRequest): Promise<SubmitCommandResponse> {
  const response = await fetch("/api/commands", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(`Command submission failed: ${response.status}`);
  return response.json() as Promise<SubmitCommandResponse>;
}
