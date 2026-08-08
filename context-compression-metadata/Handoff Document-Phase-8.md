### **Handoff Document**

#### 1. Current State

- **Backend (Electron/Node.js):** The offline-first architecture is fully operational, successfully managing local data through the `better-sqlite3` driver. IPC bridges between the main process and renderer are secured and strictly routed through the domain orchestrator.
- **Frontend (D3.js & Vanilla Web):** Complex data visualizations, including force-directed graphs and indented trees, are actively rendering in the DOM. The UI enforces high-contrast, accessible typography, with strict separation between JavaScript logic and CSS presentation.
- **Module Infrastructure:** Core interactive modules—including the Context Compressor and Global Scratchpad—are structurally staged.

#### 2. Active Focus

Prior to this synchronization, our active execution cycles were focused on:

- Refining the D3.js visualization renderers to support intricate hierarchical data schemas.
- Finalizing the layout geometry and accessibility refinements for the Global Scratchpad, specifically ensuring the copy action icon is anchored in the menu bar/header, rather than the footer.
- Executing the global namespace refactoring from "Career Management" to "Employment Record Management" across the core data modules.

#### 3. Architectural Updates

The following immutable decisions have been permanently integrated into the project specifications:

- **Project Rebranding:** The application has been officially rebranded from "Whisper" to **Chronoql Gossip**.
- **Database Pathing:** The primary SQLite ecosystem resolves strictly to: `~/Library/Application Support/chronoql-gossip/gossip.db`.
- **Styling Exception:** While strict separation of concerns remains the mandate (HTML/CSS decoupled from JS), inline styles are explicitly authorized exclusively for dynamic D3.js SVG calculations where computationally necessary.
- **File Generation Protocol:** New files will not be created without first consulting `codebase.xml` and verifying the existence of current local files.
  - 


#### 4. Anti-Patterns & Hard Rules

- **No Code Truncation:** Do not truncate modals, repetitive HTML structures, or long functions for "brevity." Complete files only.
- **No Unauthorized D3 Modifications:** Do not alter existing D3.js math, scaling, or path algorithms (e.g., the Ghost Tree) simply to force it to fit a new container unless explicitly instructed.
- **Respect DOM Wrappers:** Do not strip out structural HTML containers (like `.cluster-card` view boxes) during layout updates, as they are often tied to active JavaScript tracking logic.
- **No Hardcoded Dynamic Values:** Do not hardcode `<option>` tags for elements like Years. Leave them blank for the JavaScript renderer to handle via its dynamic algorithms.
- **Strict Pixel Math:** When given a specific pixel width for a layout (e.g., 800px), the child elements and gaps must mathematically equal that exact width. Do not let elements touch their bounding boxes.

> # Chronoql Gossip: Technical Specification
>
> ## Core Architecture
> * **Framework:** Electron
> * **Backend:** Node.js
> * **Database:** SQLite3 (via `better-sqlite3`)
> * **Frontend:** Native HTML5, CSS3, Vanilla JavaScript
> * **Visualization:** D3.js
>
> ## Immutable Constraints
> 1.  **Offline-First Mandate:** The application must function completely without an internet connection. All state and user data are managed locally via SQLite.
> 2.  **Data Sovereignty:** The primary database path is strictly defined as `~/Library/Application Support/chronoql-gossip/gossip.db`.
> 3.  **Separation of Concerns:** Presentation layers (CSS/HTML) must remain strictly decoupled from application logic (JavaScript). 
>     * *Exception:* Inline styles are permitted exclusively within D3.js render functions where dynamic geometry requires it.
> 4.  **Accessibility (a11y):** UI/UX design must prioritize readable typography, high-contrast elements, and intuitive navigation suited for a mass audience.
> 5.  **Environment Agnostic:** Builds must remain stable across macOS (M4) and Windows 11 environments, supporting development in both VS Code and Sublime Text.
>
> ## Directory Structure
> The codebase must adhere to the following strict compartmentalization:
> * `/data/` - Static assets, generated trees, and utility scripts.
> * `/lib/` - Local third-party dependencies (e.g., `d3.min.js`).
> * `/src/database/` - SQLite initializations, schemas, and CRUD managers.
> * `/src/main/` - Electron main process and application lifecycles.
> * `/src/main/ipc-controllers/` - Isolated routing layer for backend IPC handlers.
> * `/src/python/` - Sideloaded scripts for advanced offline data processing.
> * `/src/renderer/` - HTML templates and primary viewports.
> * `/src/renderer/css/` - Independent stylesheets.
> * `/src/renderer/js/` - Vanilla JavaScript DOM manipulators and D3 engines.

---

> # Chronoql Gossip: Execution Plan
>
> ## Phase 8: Chronoql Gossip Orchestration
> * Finalize the design, use case, and implementation of the codebase.xml (Template) window.
> * Work on content of Github Readme.md.
> * Work on design and implementation of online documentation.
>* Review codebase for separation of concerns violations.
> 