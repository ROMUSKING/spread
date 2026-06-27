---
version: "0.17.0"
last-reviewed: "2026-06-27"
status: "active implementation specification"
---

# Workbook-Centric Tabbed Split Workspace Specification

This document details the interface schemas, user flows, and component specs for the spreadsheet-first layout paradigm.

---

## 1. Interface Layout & Design Philosophy

The interface is structured to mirror the standard desktop filesystem and spreadsheet environments familiar to office workers:

```text
+-------------------------------------------------------------+
|  LOGO | Spreadsheet-Native ERP                             |
+----------------------+--------------------------------------+
| 🗂️ NAVIGATOR         | tabs: [📊 Sales Orders] [📦 Inventory] |
| 📁 Sales Operations  +--------------------------------------+
|  └─ 📄 Sales Orders  |                                      |
| 📁 Warehouse         |         ACTIVE WORKBOOK GRID         |
|  └─ 📄 Inventory     |                                      |
|                      |                                      |
|                      +--------------------------------------+
|                      | sheets: [Grid] [Detail] [Graph]      |
+----------------------+--------------------------------------+
```

### Components
1. **Filesystem Navigator (Left Sidebar):** A file tree structure where folders represent Categories, and files represent Workbooks.
2. **Top Workbook Tabs:** Enables switching between open workbook files. Includes a "Split" toggle to display two workbooks side-by-side.
3. **Sub-View Sheet Tabs (Bottom Bar):** Within each active workbook, sheets at the bottom switch between different representation layers:
   - **Grid:** Editable spreadsheet.
   - **Detail:** Transposed record detail card.
   - **Graph:** SVG relation graph of this workbook's connections.

---

## 2. Component Specifications

### Filesystem Navigator (`ExplorerPanel.tsx`)
- Renders collapsible category folders.
- Workbook nodes can be opened in the main workspace by clicking them.
- In accordance with the graph schema, workbooks can reside in multiple category folders simultaneously (e.g. `Sales Orders` in both `Sales Operations` and `Accounting & Finance`).

### Workbook tabs Workspace (`TiledWorkspace.tsx`)
- Manages the active workspace layout state.
- **Top Tabs:** Lists open workbooks. Allows closing tabs or opening new workbooks from the sidebar.
- **Split Screen:** Allows split comparison mode (vertical separation), dividing the main viewport into two distinct workbook workspaces.

### Sub-View Sheet Tabs (Bottom Bar)
- Positioned below the active spreadsheet grid:
  - **Grid View:** Renders `SpreadsheetGrid.tsx`.
  - **Detail View:** Renders `TransposedDetail.tsx` for the selected row.
  - **Graph View:** Renders `WorkbookGraph.tsx` displaying relations specific to this workbook.

---

## 3. Compliance & Architectural Invariants

- **Command API Mutations:** Under no circumstances may any sub-view or navigator bypass the `command_api` to mutate state.
- **SSE Stream Multiplexing:** Switching tabs or opening workbooks side-by-side opens separate SSE channels dynamically to avoid event collisions.
