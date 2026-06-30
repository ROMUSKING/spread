import type { KeyboardEvent, RefObject } from "react";
import type { GridColumn } from "@erp/contracts/grid-column";
import { columnEditorInputType, columnUsesEnumSelect } from "./columnMetaUtils.ts";

export type CellValueEditorProps = {
  column: GridColumn;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  textAlign?: "left" | "right";
  className?: string;
  stopPropagationOnKey?: boolean;
};

export function CellValueEditor({
  column,
  value,
  editing,
  onChange,
  onCommit,
  onCancel,
  inputRef,
  textAlign = "left",
  className = "input input--sm",
  stopPropagationOnKey = false,
}: CellValueEditorProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (stopPropagationOnKey && e.key !== "Enter" && e.key !== "Escape" && e.key !== "Tab") {
      e.stopPropagation();
    }
    if (e.key === "Enter") {
      e.preventDefault();
      onCommit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  if (!editing) {
    return null;
  }

  if (columnUsesEnumSelect(column)) {
    return (
      <select
        className={`select select--sm ${className}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={handleKeyDown}
        autoFocus
        style={{ width: "100%", textAlign }}
      >
        <option value="">—</option>
        {column.enumOptions!.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      ref={inputRef}
      type={columnEditorInputType(column)}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={handleKeyDown}
      autoFocus
      style={{ width: "100%", textAlign }}
    />
  );
}