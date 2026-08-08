# Chronoql gossip - Technical Specification & Constraints

**Version:** 1.0.0 | **Architecture:** Offline-First Command Center

## 1. System Architecture & Directories

The codebase adheres to a strict separation of concerns. Modules must not bleed across boundaries.

- `/data/`: Local storage for architectural maps (e.g., `codebase.xml`) and bash utilities.
- `/lib/`: Third-party vendor files (e.g., `d3.min.js`). No external CDNs are permitted.
- `/src/database/`: SQLite initialization and Database Managers (CRUD).
- `/src/main/`: Electron main process, Window lifecycle, and Preload Context Bridge.
- `/src/main/ipc-controllers/`: Isolated backend routers intercepting IPC requests.
- `/src/python/`: Staging area for sidecar analytical scripts.
- `/src/renderer/`: Pure HTML presentation layer.
- `/src/renderer/css/`: Pure CSS styling using custom CSS variables (No Tailwind, No Bootstrap).
- `/src/renderer/js/`: Vanilla JavaScript DOM manipulators and UI orchestrators (No React, No Angular).

## 2. Core Operational Constraints

- **Database:** SQLite via `better-sqlite3`. Path: `~/Library/Application Support/chronoql-gossip/gossip.db`.
- **File Generation:** Always refer to `codebase.xml` before generating a new module to verify its existence. When generating code, output complete, runnable files—never disjointed snippets.
- **Styling:** Inline styles are strictly forbidden except for D3.js SVG manipulation. All presentation logic must reside in `/src/renderer/css/`.
- **IPC Bridge:** The renderer process has absolutely no access to Node.js. All OS-level operations (fs, path, crypto) must be routed through `preload.js` to an isolated IPC controller.

## 3. Data Sovereignty & CAS Orchestration

- **Content-Addressable Storage (CAS):** Attachments must be hashed via SHA-256. Physical files reside in `userData/attachments/` named strictly as their hash.
- **Reference Counting:** To prevent dead links or storage bloat, physical attachments must only be deleted via `fs.unlinkSync()` if a `SELECT COUNT(*)` on the database confirms exactly 0 cards reference that hash.
- **Data Portability:** System exports must utilize `adm-zip` to bundle a `database.json` relational tree and the physical binary `attachments/` folder. Do not embed Base64 binaries inside the JSON.
- **Local Time Travel:** Instantaneous workspace rollbacks are handled by copying the absolute `.db` file and restarting the Electron process.
- **System Board Protection:** Operational boards (e.g., "My Quick Tasks") are strictly immune to deletion and must be excluded from JSON Payload exports to prevent database corruption and duplication.

## 4. Payload Integration & Context Compression

- **Outbound Rules:** The Context Compressor must force LLMs to output strict JSON, use exact absolute file paths, and provide complete file replacements (no truncation markers).
- **Inbound Rules:** The Payload Integrator must execute an atomic workspace backup (Pre-Flight Rollback) of targeted files before committing any LLM-generated code to the local file system.

## 5. UI/UX Paradigm

- Use native `<select>` inputs for exact relational routing to prevent accidental dataset filtering.
- Global utilities (Quick Tasks, Scratchpad) must operate as floating or sliding overlays to prevent breaking the user's primary flow state.
- Timestamps must utilize the local OS clock to ensure geographical accuracy without hardcoding `Intl` locales.