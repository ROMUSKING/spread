export type CellCoordinate = { rowId: string; fieldId: string };
export type EditableCellCommandDraft = { coordinate: CellCoordinate; value: unknown; commandType: "UpdateCell" };
