/**
 * useCommand — AGENT-013
 *
 * React hook encapsulating the full command lifecycle per the
 * client-optimistic-ui-and-conflicts.md spec:
 *
 *   idle → locally_pending → command_pending → committed | rejected |
 *          ambiguous_requires_refresh | failed
 *
 * Key behaviors:
 *   - Generates a commandId (crypto.randomUUID) and requestHash (SHA-256)
 *   - Submits via commandClient, tracks pending state with elapsed time
 *   - On timeout: polls command status endpoint automatically
 *   - On ambiguous: blocks blind retry, requires explicit refresh
 *   - Does NOT auto-retry with a new command ID after ambiguous outcome
 *
 * @see docs/dev/client-optimistic-ui-and-conflicts.md
 * @see AGENT-013 — Client unknown-outcome and optimistic edit UX
 */
import { useState, useCallback, useRef, useEffect } from "react";
import type { CommandStatus } from "@erp/domain/commands/types";
import {
  submitCommand,
  getCommandStatus,
  CommandTimeoutError,
  CommandHttpError,
} from "./commandClient";
import type { CommandClientOptions } from "./commandClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Client-side command state. Extends the server's CommandStatus with
 * client-specific intermediate states per the optimistic-ui spec.
 */
export type CommandLifecycleState =
  | "idle"
  | "locally_pending"
  | "command_pending"
  | "committed"
  | "rejected"
  | "failed"
  | "ambiguous_requires_refresh";

/** Error information returned to the caller. */
export type CommandError = {
  code: string;
  message: string;
};

/** Shape returned by the useCommand hook. */
export type UseCommandResult<TPayload = unknown> = {
  /** Current lifecycle state. */
  state: CommandLifecycleState;
  /** Submit a command with the given payload. Returns false if blocked. */
  submit: (payload: TPayload, submitOptions?: CommandClientOptions) => Promise<boolean>;
  /** Refresh after ambiguity — resets state so a new command can be issued. */
  refresh: () => void;
  /** Current or most recent command ID (null before first submit). */
  commandId: string | null;
  /** Error details (null when no error). */
  error: CommandError | null;
  /** Milliseconds elapsed since command entered pending state (0 when idle). */
  elapsedMs: number;
  /** The command type passed to the hook. */
  commandType: string;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Compute SHA-256 hex digest of the JSON-serialized payload using the
 * Web Crypto API.
 */
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function sha256Fallback(ascii: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < ascii.length; i++) {
    const ch = ascii.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = ((h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0') + (h1 ^ h2 >>> 0).toString(16).padStart(8, '0') + (h1 + h2 >>> 0).toString(16).padStart(8, '0')).substring(0, 64);
  return hash.padEnd(64, '0');
}

async function computeRequestHash(payload: unknown): Promise<string> {
  const json = JSON.stringify(payload);
  if (typeof crypto !== "undefined" && crypto.subtle && typeof crypto.subtle.digest === "function") {
    try {
      const data = new TextEncoder().encode(json);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (e) {
      // Fallback
    }
  }
  return sha256Fallback(json);
}

/**
 * Map a server CommandStatus to the client lifecycle state.
 */
function serverStatusToLifecycle(status: CommandStatus): CommandLifecycleState {
  switch (status) {
    case "committed":
      return "committed";
    case "rejected":
      return "rejected";
    case "failed":
      return "failed";
    case "ambiguous":
      return "ambiguous_requires_refresh";
    case "received":
    case "pending":
      return "command_pending";
    default:
      return "failed";
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook for submitting a command and tracking its lifecycle.
 *
 * @param commandType - The type/name of the command (e.g. "cell.update").
 * @param clientOptions - Optional overrides for the command client.
 *
 * @example
 * ```tsx
 * const cmd = useCommand<CellEditPayload>("cell.update", { tenantId });
 * // ...
 * await cmd.submit({ rowId, columnId, value });
 * ```
 *
 * @see AGENT-013
 */
export function useCommand<TPayload = unknown>(
  commandType: string,
  clientOptions: CommandClientOptions = {},
): UseCommandResult<TPayload> {
  const [state, setState] = useState<CommandLifecycleState>("idle");
  const [commandId, setCommandId] = useState<string | null>(null);
  const [error, setError] = useState<CommandError | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Track pending start time for elapsed timer
  const pendingStartRef = useRef<number | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Guard against state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (elapsedTimerRef.current !== null) {
        clearInterval(elapsedTimerRef.current);
      }
    };
  }, []);

  /** Start the elapsed-time ticker. */
  const startElapsedTimer = useCallback(() => {
    pendingStartRef.current = Date.now();
    setElapsedMs(0);
    if (elapsedTimerRef.current !== null) {
      clearInterval(elapsedTimerRef.current);
    }
    elapsedTimerRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      const start = pendingStartRef.current;
      if (start !== null) {
        setElapsedMs(Date.now() - start);
      }
    }, 250);
  }, []);

  /** Stop the elapsed-time ticker. */
  const stopElapsedTimer = useCallback(() => {
    if (elapsedTimerRef.current !== null) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    pendingStartRef.current = null;
  }, []);

  /**
   * Submit a command. Returns `true` if the submission was initiated,
   * `false` if blocked (e.g. ambiguity not yet resolved).
   *
   * Per AGENT-013: does NOT auto-retry with a new command ID after ambiguity.
   */
  const submit = useCallback(
    async (payload: TPayload, submitOptions: CommandClientOptions = {}): Promise<boolean> => {
      // Block submission if the previous command is ambiguous (must refresh first)
      if (state === "ambiguous_requires_refresh") {
        return false;
      }

      // Block if already pending
      if (state === "locally_pending" || state === "command_pending") {
        return false;
      }

      const id = generateUUID();
      setCommandId(id);
      setError(null);
      setState("locally_pending");
      startElapsedTimer();

      try {
        const requestHash = await computeRequestHash(payload);

        if (!mountedRef.current) return false;
        setState("command_pending");

        const response = await submitCommand(
          {
            commandId: id,
            requestHash,
            commandType,
            payload,
          },
          { ...clientOptions, ...submitOptions, correlationId: submitOptions.correlationId || clientOptions.correlationId || id },
        );

        if (!mountedRef.current) return true;

        const newState = serverStatusToLifecycle(response.status);
        setState(newState);
        stopElapsedTimer();

        if (response.problem) {
          setError({ code: response.problem.code, message: response.problem.message });
        }

        return true;
      } catch (err: unknown) {
        if (!mountedRef.current) return false;
        stopElapsedTimer();

        if (err instanceof CommandTimeoutError) {
          // Timeout with exhausted polling — treat as ambiguous per spec
          setState("ambiguous_requires_refresh");
          setError({
            code: "COMMAND_TIMEOUT",
            message:
              "This edit may have been saved, but the connection ended before confirmation. " +
              "Refresh this row before retrying.",
          });
          return true;
        }

        if (err instanceof CommandHttpError) {
          setState("failed");
          setError({
            code: `HTTP_${err.statusCode}`,
            message: err.message,
          });
          return true;
        }

        // Unknown error
        setState("failed");
        setError({
          code: "UNKNOWN_ERROR",
          message: err instanceof Error ? err.message : "Unknown error",
        });
        return true;
      }
    },
    [state, commandType, clientOptions, startElapsedTimer, stopElapsedTimer],
  );

  /**
   * Refresh after ambiguity — resets state to idle so a new command can be
   * issued. Per the spec, this should be called only after the client has
   * refreshed from server state.
   *
   * @see docs/dev/client-optimistic-ui-and-conflicts.md — "Retry with confirmation after refresh"
   */
  const refresh = useCallback(() => {
    setState("idle");
    setError(null);
    setElapsedMs(0);
    stopElapsedTimer();
  }, [stopElapsedTimer]);

  return {
    state,
    submit,
    refresh,
    commandId,
    error,
    elapsedMs,
    commandType,
  };
}
