export type CellCoordinate = { rowId: string; fieldId: string };
export type EditableCellCommandDraft = {
  coordinate: CellCoordinate;
  value: unknown;
  commandType: "UpdateCell";
};

export type { CellValueEditorProps } from "./CellValueEditor.tsx";
export { CellValueEditor } from "./CellValueEditor.tsx";
export type { StatusBadgeProps, StatusBadgeVariant } from "./StatusBadge.tsx";
export { StatusBadge } from "./StatusBadge.tsx";
export type { CommandNoticeProps } from "./CommandNotice.tsx";
export { CommandNotice } from "./CommandNotice.tsx";
export {
  columnEditorInputType,
  columnUsesEnumSelect,
  formatDisplayValue,
  isColumnEditable,
  protectedCellTitle,
} from "./columnMetaUtils.ts";