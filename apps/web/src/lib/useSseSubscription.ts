/**
 * useSseSubscription — AGENT-013
 *
 * React hook for managing SSE live-update subscriptions.
 * Establishes a connection to /api/events, parses the SSE stream,
 * supports Last-Event-ID for resume, tracks connection state,
 * and automatically reconnects with exponential backoff.
 *
 * @see docs/dev/outbox-polling-reader.md
 */
import { useState, useEffect, useRef, useCallback } from "react";
import type { OutboxEnvelope } from "@erp/contracts/events";

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";

export type UseSseSubscriptionResult = {
  connectionState: ConnectionState;
  lastEventId: string | null;
  events: OutboxEnvelope[];
};

/**
 * React hook for SSE subscription with auto-reconnection and event parsing.
 *
 * @param tenantId Active tenant ID
 * @param workbookId Active workbook ID
 * @param onSyncRequired Callback when retention gap or error forces a full refresh
 */
export function useSseSubscription(
  tenantId: string,
  workbookId: string,
  onSyncRequired: () => void
): UseSseSubscriptionResult {
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [events, setEvents] = useState<OutboxEnvelope[]>([]);
  const [lastEventId, setLastEventId] = useState<string | null>(null);

  const lastEventIdRef = useRef<string | null>(null);
  const baseWatermarkRef = useRef<string | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSyncRequiredRef = useRef(onSyncRequired);

  // Keep callback ref updated to avoid re-triggering effect
  useEffect(() => {
    onSyncRequiredRef.current = onSyncRequired;
  }, [onSyncRequired]);

  const connect = useCallback(() => {
    // Clean up any existing connection
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const headers: Record<string, string> = {
      Accept: "text/event-stream",
    };
    const resumeWatermark = lastEventIdRef.current ?? baseWatermarkRef.current;
    if (resumeWatermark) {
      headers["Last-Event-ID"] = resumeWatermark;
    }

    const apiBase = typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:3001` : "";
    const url = `${apiBase}/api/events?tenantId=${encodeURIComponent(tenantId)}&workbookId=${encodeURIComponent(workbookId)}`;

    setConnectionState(reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting");

    const scheduleReconnect = () => {
      setConnectionState("disconnected");

      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000);
      reconnectAttemptRef.current += 1;

      reconnectTimeoutRef.current = setTimeout(() => {
        // Skip only if a newer connect() superseded this attempt (e.g. tenant/workbook change).
        if (abortControllerRef.current !== abortController) {
          return;
        }

        connect();
      }, delay);
    };

    fetch(url, {
      headers,
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`SSE HTTP error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Response body is not readable");
        }

        // Successfully connected
        setConnectionState("connected");
        reconnectAttemptRef.current = 0; // reset reconnect attempts

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            scheduleReconnect();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          // The last part might be incomplete, keep it in the buffer
          buffer = parts.pop() || "";

          for (const part of parts) {
            if (!part.trim()) continue;

            const lines = part.split("\n");
            let eventType = "message";
            let data = "";
            let id = "";

            for (const line of lines) {
              if (line.startsWith("id: ")) {
                id = line.slice(4).trim();
              } else if (line.startsWith("event: ")) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith("data: ")) {
                data = line.slice(6).trim();
              }
            }

            if (id) {
              lastEventIdRef.current = id;
              setLastEventId(id);
            }

            if (eventType === "SYNC_REQUIRED") {
              onSyncRequiredRef.current();
              // Resume from current base watermark, not stale last event beyond retention.
              lastEventIdRef.current = baseWatermarkRef.current;
              // Gap detected — close stream and reconnect so handshake can re-fire after sync.
              abortController.abort();
              scheduleReconnect();
              return;
            }

            if (eventType === "connected") {
              try {
                const metadata = JSON.parse(data) as { baseWatermark?: unknown };
                const baseWatermark = metadata.baseWatermark;
                if (typeof baseWatermark === "string" && baseWatermark) {
                  baseWatermarkRef.current = baseWatermark;
                  setLastEventId((current) => current ?? baseWatermark);
                }
              } catch (e) {
                console.error("Failed to parse SSE connection metadata:", e);
              }
              continue;
            }

            if (data) {
              try {
                const parsedEvent = JSON.parse(data) as OutboxEnvelope;
                setEvents((prev) => {
                  // Deduplicate based on eventId
                  if (prev.some((e) => e.eventId === parsedEvent.eventId)) {
                    return prev;
                  }
                  return [...prev, parsedEvent];
                });
              } catch (e) {
                console.error("Failed to parse SSE event data:", e);
              }
            }
          }
        }
      })
      .catch((err) => {
        if (err.name === "AbortError") {
          return; // Intentionally aborted
        }

        console.error("SSE connection error:", err);
        scheduleReconnect();
      });
  }, [tenantId, workbookId]);

  useEffect(() => {
    setEvents([]);
    setLastEventId(null);
    lastEventIdRef.current = null;
    baseWatermarkRef.current = null;
  }, [workbookId, tenantId]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [connect]);

  return {
    connectionState,
    lastEventId,
    events,
  };
}
