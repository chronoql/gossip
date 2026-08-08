Here is the finalized Context Compression and Handoff Document, locking in our architectural state as we prepare to transition into Phase 7.

------

# Chronoql Gossip: Context Compression & Technical Handoff

### 1. Current State

The Chronoql Gossip command center is operating as a localized, offline-first Electron application with a Node.js backend and a decoupled native HTML5/CSS3/Vanilla JS frontend. The following specific features are fully functional:

- **Master OS Shell (`index.html`, `renderer.js`):** Fully operational dual-sidebar layout with a robust DOM caching router. Modules mount persistently in the background, preserving scroll positions, active text inputs, and UI states when navigating between views. Features global utilities including a keyboard-driven Command Palette, Global Scratchpad, and Quick Tasks.
- **Architecture Workspace (`architecture.html`):** Fully integrated 3-state workspace (Edit/Split/View) with local memory (`chronoql-os-last-arch-doc`, `chronoql-os-arch-view-state`) that guarantees the module perfectly remembers the last open document and viewer state across routing events. Features a functional append-only history ledger.
- **Payload Integrator & Context Compressor:** Staging environments are complete, with the Integrator visually mapped to accurately reflect a 1-to-Many "fan-out" architecture (Cube $\rightarrow$ Files) for deploying JSON payloads.
- **Backend & Persistence:** Synchronous `better-sqlite3` driver is active, enforcing strict `PRAGMA foreign_keys = ON` and `WAL` mode. IPC controllers for system state, kanban orchestration, and architecture ledgers are actively bound through the secure `preload.js` bridge.

### 2. Active Focus

Prior to this handoff, we were finalizing the UX interactions, D3.js layouts, and structural rules for Phase 7. We locked down the 50/50 split-pane layouts, established the strict Geometric Syntax for system visualizations, and finalized the `spec.md` and `plan.md` blueprints to build the Codebase Explorer and Schema Visualizer.

### 3. Architectural Updates & New Constraints

The following rules and design decisions have been permanently instituted:

- **DOM Caching Paradigm:** The OS router no longer destroys and rebuilds `innerHTML`. All modules must utilize the `mount-cache-[moduleName]` methodology and listen for the `gossip:module-resumed` event to handle background state preservation.
- **Geometric Architecture Syntax:** All D3.js visualizers will enforce a standardized semantic language:
  - *Shapes:* Rectangles (Logic), Circles/Cylinders (Database), Hexagons (DOM/View), Diamonds (Libraries/Config), and Pills (Styles).
  - *Edges:* Solid Lines with solid arrows (Synchronous/Hard dependencies) and Dashed Lines with open arrows (Asynchronous/Soft/IPC events).
- **Visualization Layout Rules:** The Codebase Explorer must utilize a vertical indented collapsible tree. The Schema Visualizer must utilize a top-down vertical Tidy Tree anchored by root tables (tables with zero outgoing foreign keys).
- **Inspection Stage Execution Flow:** The bottom-right pane of the Codebase Explorer will render a localized Directed Acyclic Graph (DAG) mapping the specific inputs and outputs of the selected file, utilizing a legibility floor and drag-to-pan camera to prevent scaling issues.
- **Strict Decoupling Constraint:** All presentation layer styling must reside in CSS files, strictly avoiding inline styles, with the sole exception of D3.js canvas calculations where inline manipulation is unavoidable.

------

### 4. `spec.md` (Phase 7: Visualization Modules)

Markdown

```
# Phase 7: Visualization Modules Functional Specification

## 1. Architectural Philosophy
* The Codebase Explorer and Schema Visualizer will act as the primary diagnostic interfaces for the Chronoql Gossip ecosystem. 
* Both modules must adhere to a strict offline-first, local data sovereignty model, reading directly from the physical file system and the primary database (`~/Library/Application Support/chronoql-gossip/gossip.db`).
* All modules will enforce a 100% decoupled architecture, strictly isolating JavaScript logic, CSS presentation, and HTML structure (except D3 inline styles).
* UI components must remain scalable across macOS (M4) and Windows 11 development environments, prioritizing accessibility (A11y) and high-contrast styling.

## 2. Master Shell & Shared Interface Architecture
* **Global Navigation:** The master shell (`index.html`) sidebar includes primary navigation nodes for "Codebase Explorer" and "Schema Visualizer".
* **Split-Pane Layout:** Both modules utilize a standardized 50/50 flexbox layout.
  * **Left Stage (Navigation):** D3.js structural visualization.
  * **Right Stage (Inspection):** Localized text metadata and localized flow graphs.
* **DOM Caching Integration:** Both modules support the OS-level DOM caching router to preserve view states and active document selections.
* **Syntax Legend Drawer:** Both visualizers feature a slide-out `<aside>` legend detailing the semantic geometric shapes and connection edge syntax.

## 3. Anti-Patterns & Hard Rules (Do Not Repeat):

- **No Code Truncation:** Do not truncate modals, repetitive HTML structures, or long functions for "brevity." Complete files only.
- **No Unauthorized D3 Modifications:** Do not alter existing D3.js math, scaling, or path algorithms (e.g., the Ghost Tree) simply to force it to fit a new container unless explicitly instructed.
- **Respect DOM Wrappers:** Do not strip out structural HTML containers (like `.cluster-card` view boxes) during layout updates, as they are often tied to active JavaScript tracking logic.
- **No Hardcoded Dynamic Values:** Do not hardcode `<option>` tags for elements like Years. Leave them blank for the JavaScript renderer to handle via its dynamic algorithms.
- **Strict Pixel Math:** When given a specific pixel width for a layout (e.g., 800px), the child elements and gaps must mathematically equal that exact width. Do not let elements touch their bounding boxes.

## 4. Codebase Explorer Rules
* **Primary Visualization (Left Stage):** Static, vertical indented collapsible tree parsing the `codebase.xml` manifest.
* **Metadata Inspector (Right Stage - Top):** Displays `<description>`, `<visualizer-description>`, `<inputs>`, and `<outputs>`.
* **Execution Flow Viewer (Right Stage - Bottom):** Localized Directed Acyclic Graph (DAG) for the active file using established Geometric Architecture Syntax (Shapes and Edges). Features a legibility floor and drag-to-pan camera.

## 5. Schema Visualizer Rules
* **Primary Visualization (Left Stage):** Static, top-down vertical Tidy Tree. 
* **Hierarchy Logic:** Driven by Foreign Key constraints. Tables with zero outgoing foreign keys act as root anchors.
* **Metadata Inspector (Right Stage):** Displays the Data Dictionary, renders the raw SQL `CREATE TABLE` DDL statement, and highlights the selected table's specific architectural lineage while dimming parallel branches.
```

------

### 5. `plan.md` (Phase 7 Roadmap)

Markdown

```
# Phase 7: Development Roadmap

## Objective
Orchestrate the integration of the D3.js Codebase Explorer and Schema Visualizer into the Chronoql Gossip command center, ensuring seamless DOM caching, master shell navigation, and strict adherence to geometric syntax rules.

## Milestone 1: Backend Data Orchestration
* **Task 1.1:** Architect IPC controller to parse `codebase.xml` into a hierarchical JSON object compatible with D3.js.
* **Task 1.2:** Architect IPC controller to parse `master-schema-init.sql`, extracting table names, foreign keys, and raw DDL into a relational JSON payload.
* **Task 1.3:** Bind extraction tools to the highly restricted `preload.js` context bridge.

## Milestone 2: Viewport & Layout Construction
* **Task 2.1:** Update master shell (`index.html`) sidebar for new visualizer routing.
* **Task 2.2:** Draft `codebase-explorer.html` and `schema-visualizer.html` enforcing the 50/50 split-pane logic and legend drawer.
* **Task 2.3:** Update CSS files to define semantic geometry classes, high-contrast states, and animations.
* **Task 2.4:** Wire HTML templates into the `renderer.js` DOM caching router.

## Milestone 3: D3.js Engine Integration
* **Task 3.1:** Write rendering logic for the Codebase Explorer's vertical indented tree.
* **Task 3.2:** Write rendering logic for the Schema Visualizer's top-down vertical Tidy Tree.
* **Task 3.3:** Architect the localized DAG for the Codebase Explorer's bottom-right pane (zoom limits, semantic shapes, edge syntax).

## Milestone 4: Inspection Stage Wiring
* **Task 4.1:** Bind click events from D3.js nodes to the right-hand HTML metadata panels.
* **Task 4.2:** Ensure Codebase metadata populates smoothly without layout shifting.
* **Task 4.3:** Implement visual lineage highlighting logic for the Schema Visualizer.
```

### Handoff Directives Acknowledged

- **Database Path:** `~/Library/Application Support/chronoql-gossip/gossip.db` is confirmed as the target.
- **File Verification:** `codebase.xml` will be queried before any new files are proposed.
- **Creation Protocol:** Confirmation will be requested to check for existing files before generating new code blocks.
- **Directory Constraints:** The strict directory structure (`data/`, `lib/`, `src/database/`, `src/main/`, `src/main/ipc-controllers`, `src/python/`, `src/renderer/`, `src/renderer/css/`, `src/renderer/js/`) will be rigidly maintained.
- **Next Action:** Proceed directly to Phase 7: Milestone 1 upon session restart.

> ###  Addendum to Phase 7 Development Roadmap
>
> - Both the Codebase Explorer and the Schema Visualizer will have a hamburger button that completely collapses to the left edge of the command center window for a wider view of the metadata and visualizers.
>
> - For UI/UX consistency, the hamburger button will be added to all of the modules (e.g.,  Kanban, Architecture & Constraints, and LLM Commander) as a toggle button for when the user needs a wider view.
>
> - ### Hamburger Button Placement
>
>   - ##### For consistency, the hamburger button will be placed at the same x,y coordinates in the global macro header of all modules.
>
>   - For the Kanban Board module, the hamburger button can be placed to the left of the "K" in the "Kanban Board" label. Leave space between the hamburger button and the "K" so they are not too tightly spaced.
>
>   - For the Architecture Workspace module, the hamburger button can be placed to the left of the "A" in the "Architecture Workspace" label. Leave space between the hamburger button and the "A" so they are not too tightly spaced.
>
>   - For the Context Compressor module, the hamburger button can be placed to the left of the "C" in the "Context Compressor" label. Leave space between the hamburger button and the "C" so they are not too tightly spaced.
>
>   - To avoid file truncation, do not attempt to generate all of these changes at once. The changes should be made methodically, one module at a time, and generating one file at a time. After you generate a file, I will let you know when I am ready for the next file.
