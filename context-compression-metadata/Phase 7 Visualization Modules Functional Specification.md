# Phase 7: Visualization Modules Functional Specification

## 1. Architectural Philosophy
* The Codebase Explorer and Schema Visualizer will act as the primary diagnostic interfaces for the Chronoql Gossip ecosystem. 
* Both modules must adhere to a strict offline-first, local data sovereignty model, reading directly from the physical file system and the primary database (`~/Library/Application Support/chronoql-whisper/whisper.db`).
* All modules will enforce a 100% decoupled architecture, strictly isolating JavaScript logic, CSS presentation, and HTML structure.
* UI components must remain scalable across standard displays and high-density viewports, prioritizing web accessibility (A11y) and high-contrast color palettes.

## 2. Master Shell & Shared Interface Architecture
* **Global Navigation:** The master shell (`index.html`) sidebar will be updated to include two new primary navigation nodes: "Codebase Explorer" and "Schema Visualizer".
* **Split-Pane Layout:** Both visualization modules will utilize a standardized 50/50 flexbox layout to bridge navigation and inspection without context switching.
  * **Left Stage (Navigation):** Dedicated to the D3.js structural visualization.
  * **Right Stage (Inspection):** Dedicated to the localized text-based metadata and localized flow graphs.
* **DOM Caching Integration:** Both modules must support the OS-level DOM caching router. Scroll positions, expanded tree nodes, and active selections must be perfectly preserved when the user navigates away and returns.
* **Syntax Legend Drawer:** Both the Codebase Explorer and Schema Visualizer (and *only* these modules) will feature a standard, slide-out `<aside>` legend detailing the semantic geometric shapes and connection edge syntax.

## 3. Codebase Explorer Rules
* **Primary Visualization (Left Stage):** Rendered as a static, vertical indented collapsible tree (D3 Dendrogram) parsing the `codebase.xml` manifest.
* **Interaction:** Clicking folder nodes toggles expansion/collapse. Clicking file nodes routes data to the Inspection Stage.
* **Metadata Inspector (Right Stage - Top):** Displays the `<description>`, `<visualizer-description>`, `<inputs>`, and `<outputs>` for the active file.
* **Execution Flow Viewer (Right Stage - Bottom):** * Renders a localized Directed Acyclic Graph (DAG) for the active file.
  * Employs semantic geometry: Rectangles (Logic), Circles/Cylinders (Database), Hexagons (DOM/View), Diamonds (Libraries/Config), and Pills (Styles).
  * Employs edge syntax: Solid lines (Synchronous/Hard dependencies) and Dashed lines (Asynchronous/IPC Events).
  * Enforces a legibility floor on scaling, transitioning to a drag-to-pan camera model before text becomes unreadable.

## 4. Schema Visualizer Rules
* **Primary Visualization (Left Stage):** Rendered as a static, top-down vertical Tidy Tree. 
* **Hierarchy Logic:** Driven entirely by Foreign Key constraints. Tables with zero outgoing foreign keys act as root anchors; tables with outgoing foreign keys render as cascading children.
* **Interaction:** Node clicks trigger UI updates without executing any force-directed physics or graph restructuring.
* **Metadata Inspector (Right Stage):**
  * Displays the exact Data Dictionary (columns, constraints, data types).
  * Renders the raw SQL `CREATE TABLE` DDL statement extracted from the schema initialization file.
  * Highlights the selected table's specific architectural lineage (blast radius) while dimming isolated or parallel branches.