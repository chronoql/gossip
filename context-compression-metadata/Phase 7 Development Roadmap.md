* # Phase 7: Development Roadmap

  ## Objective
  Orchestrate the integration of the D3.js Codebase Explorer and Schema Visualizer into the Chronoql Gossip command center, ensuring seamless DOM caching, master shell navigation, and strict adherence to geometric syntax rules.

  ## Milestone 1: Backend Data Orchestration
  * **Task 1.1:** Architect an IPC controller function to parse the `codebase.xml` file into a hierarchical JSON object compatible with D3.js tree layouts.
  * **Task 1.2:** Architect an IPC controller function to parse the `master-schema-init.sql` file, extracting table names, foreign key relationships, and raw DDL blocks into a relational JSON payload.
  * **Task 1.3:** Bind these new extraction tools to the highly restricted `preload.js` context bridge.

  ## Milestone 2: Viewport & Layout Construction
  * **Task 2.1:** Update the master shell (`index.html`) sidebar to include navigation links for the Codebase Explorer and Schema Visualizer.
  * **Task 2.2:** Draft `codebase-explorer.html` and `schema-visualizer.html` enforcing the 50/50 split-pane structural logic. Include the slide-out syntax legend drawer exclusively in these two files.
  * **Task 2.3:** Update `variables.css` and module-specific CSS files to define the semantic geometry classes, high-contrast states, and the legend drawer animations.
  * **Task 2.4:** Wire both HTML templates into the `renderer.js` DOM caching router, ensuring they mount and unmount gracefully without destroying state.

  ## Milestone 3: D3.js Engine Integration
  * **Task 3.1:** Write the rendering logic for the Codebase Explorer's vertical indented tree, including click-to-collapse folder mechanics.
  * **Task 3.2:** Write the rendering logic for the Schema Visualizer's top-down vertical Tidy Tree, calculating root vs. child nodes via the foreign key payload.
  * **Task 3.3:** Architect the localized Directed Acyclic Graph (DAG) for the Codebase Explorer's bottom-right pane. Implement the zoom limits (legibility floor), drag-to-pan camera, and geometric rendering paths.

  ## Milestone 4: Inspection Stage Wiring
  * **Task 4.1:** Bind the click events from the D3.js nodes to the right-hand HTML panels.
  * **Task 4.2:** Ensure the Codebase metadata populates smoothly without layout shifting.
  * **Task 4.3:** Implement the visual lineage highlighting logic for the Schema Visualizer (dimming unconnected paths when a table is selected).

  ## Milestone 5: Build & Distribution Preparation
  * **Task 5.1:** Conduct rigorous manual testing of the DOM cache across all OS modules.
  * **Task 5.2:** Verify that the D3.js engine functions flawlessly in a completely offline state, relying solely on the local `lib/d3.min.js` file.
  * **Task 5.3:** Prepare final multi-platform executable builds for both macOS (M4 compatibility) and Windows 11 environments.
  * **Task 5.4:** Push the compiled application builds to the designated GitHub distribution repositories (excluding internal source code/XML paths).