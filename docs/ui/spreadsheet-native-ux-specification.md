---
version: "0.16.1"
last-reviewed: "2026-06-27"
status: "active implementation specification"
---

# Spreadsheet-Native ERP: UI/UX Specification

This document details the core design philosophy, interactive goals, concrete implementation details, and verification plans for the Spreadsheet-Native ERP interface.

---

## 1. Design & UX Goals

The primary goal is to provide a spreadsheet-native interface that users interact with exactly like they would with standard desktop spreadsheet tools (e.g., Excel, Google Sheets), rather than a rigid web form or data-table.

### The Empty Row Paradigm (Unbounded Grid)
- **Concept:** Every spreadsheet is unbounded. Users do not click a button to append rows. Instead, there is always a trailing empty row visible at the bottom of the grid.
- **Behavior:** Clicking or typing in this row automatically creates a new row on the server via `cell.update` and spawns a new empty row underneath it.

### Keyboard-First Navigation & Editing
- **Arrow Keys:** Navigate focus cleanly across cells, including onto the empty row.
- **Tab & Shift+Tab:** Move focus horizontally. Tab on the last cell of a row wraps to the first cell of the next row. Tab on the last cell of the last data row enters the trailing empty row.
- **Enter & F2:** Activate inline edit mode on the active cell. Pressing Enter during edit mode commits the value and moves the focus to the cell directly below.
- **Type-to-Enter:** Pressing any alphanumeric or symbol key while a cell is focused immediately enters edit mode, initializing the input with the typed character.
- **Delete / Backspace:** Pressing Delete or Backspace on a focused cell clears its contents immediately.

### Dynamic Columns
- **Dynamic Headers:** Columns are discovered from the server and loaded dynamically rather than being hardcoded in client source files.
- **Header Additions:** A trailing "+" column header is rendered to the right of the last column. Clicking it allows typing a name to add a column dynamically on the fly.

### Sheet / Module Navigation
- **Concept:** Clear and simple switcher representing different apps or sheets in the ERP (e.g., Sales Orders, Inventory Stock, Purchase Ledger).
- **Behavior:** Switching sheets changes the active `workbookId`, instantly queries the new workbook content, and rebuilds the columns, rows, sum footers, and SSE subscriptions cleanly without cross-workbook event pollution.

### Real-Time Optimistic Status Overlays
- **Pending:** Pulsing indicator + subtle yellow border when a cell is locally modified and in-flight.
- **Committed:** Green border highlight when the change is committed to the database and streamed back via SSE.
- **Rejected/Failed:** Red border + tooltip showing validation/execution errors.
- **Ambiguous:** Orange border indicating network interruption, locking retries until refreshed.

---

## 2. Concrete Implementation Steps

The spreadsheet-native UX was implemented through the following steps across client and server:

### A. Client-Side (React App)
1. **SpreadsheetGrid Component Rewrite (`SpreadsheetGrid.tsx`):**
   - Added a leftmost **Row Number Gutter** column.
   - Rendered a **sticky frozen table header** (`position: sticky`).
   - Implemented **single-click focus** and **double-click / Enter / F2 edit mode**.
   - Added **Keyboard Navigation State Machine** handling arrows, tab wrapping, enter key down movement, and delete key clearing.
   - Integrated **type-to-enter** text capturing.
   - Appended a **Summary Footer Row** displaying computed `SUM` of all numeric columns.
   - Added a **dynamic column creation input** under the `+` column header.
2. **Page Logic Update (`page.tsx`):**
   - Removed hardcoded column constants. Stored columns in state, initialized from server responses.
   - Replaced "Add Row" button with natural handlers (`onCreateRow`, `onDeleteRow`, `onAddColumn`) wired to the grid component.
   - Implemented dynamic row ID tracking to generate unique IDs sequentially.
   - Added `workbookId` state and rendered a floating **Module/App Navigation tab bar** supporting real-time switching.
   - Configured the SSE subscription hook to clear previous events and watermarks immediately upon switching workbooks to prevent cross-workbook state contamination.

### B. Server-Side (API Engine)
1. **DELETE Query support in InMemoryQueryable (`postgres.ts`):**
   - Added regex/string matching for `DELETE FROM current_cell_values WHERE row_id = $3`.
   - Mutated the in-memory array by filtering out matching rows.
   - Seeded three distinct workbooks representing different ERP modules (Sales, Inventory, and Purchase) with unique cell data schemas.
2. **Delete Command Handler (`server.ts`):**
   - Added `DemoRowDeleteHandler` extending `CommandHandlerBase` for `row.delete` commands.
   - Executed deletion of all cells in the row within a single database transaction.
   - Registered the handler with the central command processor.
3. **Column Metadata Extraction & Verification (`server.ts`):**
   - Modified the GET `/api/workbooks` route to extract all distinct column names present in the cells.
   - Returned column definitions with human-friendly labels dynamically.
   - Added an allowlist of supported workbook IDs to prevent arbitrary remapping of requests.

---

## 3. Keyboard Shortcut Reference

| Key / Gesture | Target Context | Effect |
|---|---|---|
| **Arrow Up/Down/Left/Right** | Focused Cell | Moves focus to the adjacent cell in that direction. |
| **Tab** | Focused Cell | Moves focus to the next cell to the right, wrapping across rows. |
| **Shift+Tab** | Focused Cell | Moves focus to the previous cell to the left, wrapping across rows. |
| **Double-Click / Enter / F2** | Focused Cell | Activates edit mode on the cell. |
| **Type Alphanumeric Key** | Focused Cell | Activates edit mode, replacing or initializing value. |
| **Enter (while editing)** | Active Input | Commits changes and moves focus to the cell below. |
| **Escape (while editing)** | Active Input | Exits edit mode and restores the original value. |
| **Delete / Backspace** | Focused Cell | Clears cell value. |
| **Gutter Click** | Row Gutter | Selects the entire row (highlights row). |
| **Delete / Backspace** | Selected Row | Deletes the entire row from the sheet. |

---

## 4. Browser UI Verification Plan

Manual validation of common business operations can be executed on `http://localhost:3000` via these test cases:

1. **Purchase Order Creation:**
   - Go to the empty row at the bottom.
   - Type "Desk Organizer" → Tab → "10" → Tab → "15.00" → Enter.
   - Verify that the item is saved, a new empty row appears below, and the Summary Footer aggregates the totals.
2. **Quantity Adjustment:**
   - Double-click the quantity cell of the "Premium Desk" row.
   - Type "3" and press Enter.
   - Verify that the total updates from 500.00 to 750.00.
3. **Item Cancellation:**
   - Click the row number gutter for the "USB-C Hub" row to select it.
   - Press Delete.
   - Verify that the row is removed from the grid and subsequent rows re-number automatically.
