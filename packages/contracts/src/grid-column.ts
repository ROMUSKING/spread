export type ColumnValueType = 'text' | 'enum' | 'number';

export type ColumnDisplayFormat = 'currency' | 'plain';

export type GridColumnMeta = {
  type?: ColumnValueType;
  format?: ColumnDisplayFormat;
  enumOptions?: string[];
  readOnly?: boolean;
  protected?: boolean;
};

export type GridColumn = {
  columnId: string;
  label: string;
} & GridColumnMeta;

export type CellRow = {
  row_id: string;
  column_id: string;
  value_text: string;
};

const META_COLUMN_RE = /^__(.+)_meta$/;

function humanizeColumnId(columnId: string): string {
  return columnId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseMetaValue(raw: string): Partial<GridColumnMeta> {
  const value = raw.trim();
  if (!value) return {};

  if (value === 'readonly') {
    return { readOnly: true };
  }
  if (value === 'protected') {
    return { protected: true, readOnly: true };
  }

  if (value.startsWith('enum:')) {
    const options = value
      .slice('enum:'.length)
      .split('|')
      .map((o) => o.trim())
      .filter(Boolean);
    return { type: 'enum', enumOptions: options };
  }

  if (value.startsWith('format:currency')) {
    return { type: 'number', format: 'currency' };
  }
  if (value.startsWith('format:number')) {
    return { type: 'number', format: 'plain' };
  }

  return {};
}

/** Parse `_meta` row cells keyed as `__{columnId}_meta`. */
export function parseMetaRowValues(
  metaValues: Record<string, string>,
): Record<string, Partial<GridColumnMeta>> {
  const out: Record<string, Partial<GridColumnMeta>> = {};

  for (const [metaKey, raw] of Object.entries(metaValues)) {
    const match = META_COLUMN_RE.exec(metaKey);
    if (!match) continue;
    const columnId = match[1];
    if (!columnId) continue;
    out[columnId] = { ...(out[columnId] ?? {}), ...parseMetaValue(String(raw ?? '')) };
  }

  return out;
}

export function isMetaRowId(rowId: string): boolean {
  return String(rowId).startsWith('_');
}

export function augmentColumnsWithMeta(
  columnIds: string[],
  metaByColumnId: Record<string, Partial<GridColumnMeta>>,
): GridColumn[] {
  return columnIds.map((columnId) => ({
    columnId,
    label: humanizeColumnId(columnId),
    ...(metaByColumnId[columnId] ?? {}),
  }));
}

export function buildWorkbookColumnsFromCells(cellRows: CellRow[]): GridColumn[] {
  const metaRows = cellRows.filter((r) => isMetaRowId(r.row_id));
  const normalRows = cellRows.filter((r) => !isMetaRowId(r.row_id));

  const metaByColumnId: Record<string, Partial<GridColumnMeta>> = {};
  for (const row of metaRows) {
    const parsed = parseMetaRowValues({ [row.column_id]: String(row.value_text ?? '') });
    for (const [columnId, meta] of Object.entries(parsed)) {
      metaByColumnId[columnId] = { ...(metaByColumnId[columnId] ?? {}), ...meta };
    }
  }

  const columnIds = [...new Set(normalRows.map((r) => r.column_id))] as string[];
  return augmentColumnsWithMeta(columnIds, metaByColumnId);
}