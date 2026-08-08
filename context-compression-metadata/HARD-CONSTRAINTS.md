### Chronoql Handoff Document Hard Constraints

- 

**Anti-Patterns & Hard Rules (Do Not Repeat):**

- **No Code Truncation:** Do not truncate modals, repetitive HTML structures, or long functions for "brevity." Complete files only.
- **No Unauthorized D3 Modifications:** Do not alter existing D3.js math, scaling, or path algorithms (e.g., the Ghost Tree) simply to force it to fit a new container unless explicitly instructed.
- **Respect DOM Wrappers:** Do not strip out structural HTML containers (like `.cluster-card` view boxes) during layout updates, as they are often tied to active JavaScript tracking logic.
- **No Hardcoded Dynamic Values:** Do not hardcode `<option>` tags for elements like Years. Leave them blank for the JavaScript renderer to handle via its dynamic algorithms.
- **Strict Pixel Math:** When given a specific pixel width for a layout (e.g., 800px), the child elements and gaps must mathematically equal that exact width. Do not let elements touch their bounding boxes.

------

- [ ] 



Documenting this architectural hard constraint in your `spec.md` is the exact right move. It guarantees that any future module development inherently respects the OS-agnostic pathing rule from day one, preventing this specific regression from ever happening again.

Here is the exact, cleanly formatted text to append permanently to your `spec.md` file (I have avoided all code blocks as requested):

### System Path Architecture & Local Data Storage

**Dynamic Path Resolution (Hard Constraint)**

The application must never use hardcoded absolute paths or rely on relative file paths for local data storage or media retrieval. The system must orchestrate a dynamic path fetch using Electron's native `app.getPath('userData')` API. This ensures the system automatically resolves the correct, OS-agnostic directory on the fly (e.g., Application Support on macOS, AppData on Windows).

**Storage Directory Structure**

- **Base Data Path:** `database_path` is defined dynamically via `app.getPath('userData')`.
- **Database Location:** The SQLite database is permanently located at: `database_path/chronoql-horizon/horizon.db`
- **Media Storage (Avatars):** Teacher photos and profile images are permanently stored in a dedicated directory located at: `database_path/chronoql-horizon/avatars/`

**Implementation Rule**

All backend controllers and frontend renderers that interface with local files must retrieve the dynamic `userData` path via the secure IPC bridge and prepend it to the raw filenames stored in the database.

------

Does this capture the rule exactly as you need it orchestrated for the spec?
