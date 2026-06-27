# Spreadsheet-Native ERP: UI/UX Research & Tiling Specifications

This document outlines the UI/UX research on how office workers interact with spreadsheets, workbooks, and filesystems, and defines a revised workspace layout that aligns with their mental models.

---

## 1. User Mental Models in Office Environments

Office workers spend a significant portion of their workdays in file managers and spreadsheets. Their visual and structural expectations are governed by:

1. **Directories (Filesystem View):** A hierarchical or tagged list of folders containing files. Files represent distinct work units (e.g., a "Sales Orders" sheet).
2. **Workbooks (Files):** The high-level file container that holds multiple sheets.
3. **Worksheets (Sheets):** Tabs at the bottom of a workbook representing different tables or subsets of data (e.g., "Sheet 1", "Sheet 2").
4. **Tiling (Window Arrangement):** When comparing data, users expect either a tabbed browser-like experience or a clean side-by-side split (similar to Excel's "View Side by Side" vertical comparison).

---

## 2. Comparative Analysis of Tiling Window Managers

| Layout Paradigm | Office Worker Familiarity | Pros | Cons |
|---|---|---|---|
| **Binary Space Partitioning (BSP / Dynamic Splits)** | **Low** (Common in developer environments like i3wm) | Auto-allocates space; scales infinitely. | Can feel chaotic and disorienting to non-technical users. |
| **Floating Overlays (MDI / Multi-Window)** | **Medium** (Classic Windows/Mac desktop) | Allows arbitrary drag and resize. | Windows overlap, get lost, or hidden. Hard to manage on smaller viewports. |
| **Workbook-Centric Tabbed Split Workspace** | **High** (Google Sheets, modern web browsers, Excel Side-by-Side) | Extremely clean; no overlapping panels. Retains familiar browser tabs + sheet tabs. | Limited to side-by-side splits. |

### Selected Design Choice: Workbook-Centric Tabbed Split Workspace
To maximize productivity and familiarity, the ERP layout revolves around:
- **Left Sidebar:** Filesystem view showing category folders and workbook files.
- **Main Workspace Tabs:** Open workbooks appear as tabs at the top of the main pane.
- **Vertical Split (Comparison Mode):** A simple toggle that splits the main workspace vertically, allowing two workbooks to be opened side-by-side.
- **Sheet Tabs:** Individual sheets (data grid, transposed detail, formulas) render as tabs at the bottom.

---

## 3. Revised Interface Specification

### Navigation Hierarchy
```text
[Filesystem Navigator (Left Sidebar)]
 ├── 📁 Sales Operations (Category Folder)
 │    └── 📄 Sales Orders (Workbook File)
 ├── 📁 Warehouse & Inventory
 │    └── 📄 Inventory Stock
 └── 📁 Accounting & Finance
      ├── 📄 Sales Orders
      └── 📄 Purchase Ledger
```

### Main Workspace
* **Top Tab Bar:** `[ 📊 Sales Orders ]` `[ 📦 Inventory Stock ]` `[ 🧾 Purchase Ledger ]`
* **Sub-View Sheet Tabs (Bottom Bar of Active Workbook):**
  * `[ Grid View ]` - Standard spreadsheet editor.
  * `[ Detail Card ]` - Transposed vertical record detail editor.
  * `[ Sheet Relations ]` - Visual SVG graph of this workbook's connections.
