import type { CommandLifecycleState } from "./useCommand.ts";
import type { CommandState } from "../components/SpreadsheetGrid.tsx";

export type ActiveEditLifecycle = CommandState["state"];

export function isCommandFailure(state: CommandLifecycleState): boolean {
  return state === "rejected" || state === "failed";
}

export function lifecycleToVisualState(
  state: CommandLifecycleState
): CommandState["state"] | null {
  if (state === "committed") return "committed";
  if (isCommandFailure(state)) return "rejected";
  if (state === "ambiguous_requires_refresh") return "ambiguous_requires_refresh";
  if (state === "locally_pending" || state === "command_pending") return "pending";
  return null;
}

/** Terminal visual states persist per-edit and are not overwritten by a new command hook. */
export function isTerminalVisualState(state: CommandState["state"]): boolean {
  return (
    state === "committed" ||
    state === "rejected" ||
    state === "ambiguous_requires_refresh"
  );
}

/**
 * Merge per-edit lifecycle with the active command hook state.
 * Terminal per-edit states are preserved unless the hook also reports a terminal state.
 */
export function resolveEditVisualState(
  editLifecycleState: ActiveEditLifecycle,
  editCommandId: string | null,
  hookCommandId: string | null,
  hookLifecycleState: CommandLifecycleState | null
): ActiveEditLifecycle {
  let visualState = editLifecycleState;
  if (editCommandId && hookCommandId === editCommandId && hookLifecycleState) {
    const mapped = lifecycleToVisualState(hookLifecycleState);
    if (mapped) {
      if (!isTerminalVisualState(editLifecycleState) || isTerminalVisualState(mapped)) {
        visualState = mapped;
      }
    }
  }
  return visualState;
}