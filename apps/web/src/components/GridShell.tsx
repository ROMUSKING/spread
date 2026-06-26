export type GridShellProps = {
  workbookId: string;
  rows: Array<{ rowId: string; values: Record<string, unknown> }>;
};

export type GridShellViewModel = {
  kind: "grid_shell_stub";
  workbookId: string;
  rowCount: number;
  ariaLabel: string;
};

export function GridShell({ workbookId, rows }: GridShellProps): GridShellViewModel {
  // Stub: AGENT-060 must route all edits through command_api and preserve command status visibility.
  return {
    kind: "grid_shell_stub",
    workbookId,
    rowCount: rows.length,
    ariaLabel: "Spreadsheet grid stub",
  };
}
