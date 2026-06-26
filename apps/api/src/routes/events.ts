export async function sseEventsRouteStub(): Promise<ReadableStream<Uint8Array>> {
  // Stub: AGENT-021/022 will wire polling-first SSE with subscription handshake and recovery.
  return new ReadableStream<Uint8Array>();
}
