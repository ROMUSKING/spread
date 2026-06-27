/**
 * Command Client — AGENT-013
 *
 * Submits commands to the command API and polls for status on timeout.
 * Implements the client-side unknown-outcome protocol:
 *   - POST /api/commands with correlation headers
 *   - Timeout detection (default 10s) with automatic status polling fallback
 *   - Type-safe responses using @erp/contracts/command-api types
 *   - Does NOT auto-retry after ambiguous outcome (caller must refresh first)
 *
 * @see docs/dev/client-optimistic-ui-and-conflicts.md
 * @see docs/dev/command-lifecycle.md
 */
import type {
  SubmitCommandRequest,
  SubmitCommandResponse,
  CommandStatusResponse,
} from '@erp/contracts/command-api';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Default timeout in milliseconds before switching to status polling. */
const DEFAULT_TIMEOUT_MS = 10_000;

/** Maximum number of status poll attempts after a timeout. */
const MAX_POLL_ATTEMPTS = 10;

/** Interval between status polls in milliseconds. */
const POLL_INTERVAL_MS = 2_000;

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/** Thrown when a submit request times out and status polling also fails. */
export class CommandTimeoutError extends Error {
  readonly commandId: string;
  constructor(commandId: string) {
    super(`Command ${commandId} timed out and status could not be determined`);
    this.name = 'CommandTimeoutError';
    this.commandId = commandId;
  }
}

/** Thrown when an individual command HTTP request exceeds its timeout. */
export class CommandRequestTimeoutError extends Error {
  readonly commandId: string | undefined;

  constructor(message: string, commandId?: string) {
    super(message);
    this.name = 'CommandRequestTimeoutError';
    this.commandId = commandId;
  }
}

/** Thrown when the server returns a non-OK HTTP status. */
export class CommandHttpError extends Error {
  readonly statusCode: number;
  readonly commandId: string | undefined;
  constructor(statusCode: number, message: string, commandId?: string) {
    super(message);
    this.name = 'CommandHttpError';
    this.statusCode = statusCode;
    this.commandId = commandId;
  }
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export type CommandClientOptions = {
  /** Base URL for the command API (default: empty string for same-origin). */
  baseUrl?: string;
  /** Request timeout in ms (default: 10 000). */
  timeoutMs?: number;
  /** Correlation ID propagated via X-Correlation-ID header. */
  correlationId?: string;
  /** Trace ID propagated via X-Trace-ID header. */
  traceId?: string;
  /** Tenant ID for multi-tenant routing. */
  tenantId?: string;
  /** Workbook ID for multi-workbook routing. */
  workbookId?: string;
  /** Optional external AbortSignal for caller-controlled cancellation. */
  signal?: AbortSignal;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Race a fetch against a timeout. Returns the Response on success or
 * `null` if the request timed out.
 */
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  signal: AbortSignal | undefined,
  timeoutMessage: string,
  commandId?: string,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  let abortListener: (() => void) | undefined;

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      const listener = () => controller.abort(signal.reason);
      signal.addEventListener('abort', listener, { once: true });
      abortListener = () => signal.removeEventListener('abort', listener);
    }
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    return response;
  } catch (err: unknown) {
    if (timedOut) {
      throw new CommandRequestTimeoutError(timeoutMessage, commandId);
    }

    throw err;
  } finally {
    clearTimeout(timer);
    abortListener?.();
  }
}

/**
 * Build common headers for command API requests.
 */
function buildHeaders(opts: CommandClientOptions): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
  };
  if (opts.correlationId) {
    headers['x-correlation-id'] = opts.correlationId;
  }
  if (opts.traceId) {
    headers['x-trace-id'] = opts.traceId;
  }
  if (opts.tenantId) {
    headers['x-tenant-id'] = opts.tenantId;
  }
  if (opts.workbookId) {
    headers['x-workbook-id'] = opts.workbookId;
  }
  return headers;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Submit a command to POST /api/commands.
 *
 * If the HTTP request completes within `timeoutMs`, the parsed response is
 * returned directly.  If the request times out, the function automatically
 * falls back to polling `GET /api/commands/{commandId}` until a terminal
 * status is reached or `MAX_POLL_ATTEMPTS` is exhausted.
 *
 * @throws {CommandTimeoutError} when both submit and polling fail to resolve.
 * @throws {CommandHttpError} when the server returns a non-OK status.
 *
 * @see AGENT-013 — Client unknown-outcome and optimistic edit UX
 */
export async function submitCommand(
  request: SubmitCommandRequest,
  opts: CommandClientOptions = {},
): Promise<SubmitCommandResponse> {
  const baseUrl = opts.baseUrl ?? '';
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const headers = buildHeaders(opts);

  const response = await fetchWithTimeout(
    `${baseUrl}/api/commands`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    },
    timeoutMs,
    opts.signal,
    `Command submission timed out after ${timeoutMs}ms`,
    request.commandId,
  ).catch((error: unknown) => {
    if (error instanceof CommandRequestTimeoutError) {
      return null;
    }

    throw error;
  });

  // --- Timeout path: fall back to status polling ---
  if (response === null) {
    return pollUntilTerminal(request.commandId, opts);
  }

  // --- HTTP error path ---
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new CommandHttpError(
      response.status,
      `Command submission failed (${response.status}): ${text}`,
      request.commandId,
    );
  }

  return response.json() as Promise<SubmitCommandResponse>;
}

/**
 * Query the status of a previously submitted command.
 *
 * @see AGENT-013 — Client unknown-outcome and optimistic edit UX
 */
export async function getCommandStatus(
  commandId: string,
  opts: CommandClientOptions = {},
): Promise<CommandStatusResponse> {
  const baseUrl = opts.baseUrl ?? '';
  const headers = buildHeaders(opts);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  // Remove content-type for GET
  delete headers['content-type'];

  const response = await fetchWithTimeout(
    `${baseUrl}/api/commands/${encodeURIComponent(commandId)}`,
    { method: 'GET', headers },
    timeoutMs,
    opts.signal,
    `Command status query timed out after ${timeoutMs}ms`,
    commandId,
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new CommandHttpError(
      response.status,
      `Command status query failed (${response.status}): ${text}`,
      commandId,
    );
  }

  return response.json() as Promise<CommandStatusResponse>;
}

/**
 * Poll GET /api/commands/{commandId} until a terminal status is reached.
 * Returns a `SubmitCommandResponse`-shaped result on terminal status.
 *
 * @throws {CommandTimeoutError} if polling exhausts all attempts without
 *   reaching a terminal status.
 *
 * @internal
 */
async function pollUntilTerminal(
  commandId: string,
  opts: CommandClientOptions,
): Promise<SubmitCommandResponse> {
  const terminalStatuses = new Set([
    'committed',
    'rejected',
    'failed',
    'ambiguous',
  ]);

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    try {
      const status = await getCommandStatus(commandId, opts);
      if (terminalStatuses.has(status.status)) {
        return {
          commandId: status.commandId,
          status: status.status,
          body: status.body,
          problem: status.problem,
        };
      }
      // Non-terminal ("received" | "pending") — keep polling
    } catch {
      // Network errors during polling are swallowed; we keep trying.
    }
  }

  throw new CommandTimeoutError(commandId);
}

/** Promise-based sleep. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
