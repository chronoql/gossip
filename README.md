# Chronoql Gossip

**The offline-first tactical command center for AI-assisted software development.**

Whether you are a seasoned data engineer orchestrating complex systems or an entry-level IT professional building your first application with an LLM, the hardest part of AI-assisted development isn't writing the code—it's managing the context.

**Chronoql Gossip** is a desktop operating environment designed to solve the "context window" problem. It provides a suite of visual, offline-first tools to help you define strict architectural boundaries, compress your codebase into optimized LLM prompts, and safely integrate AI-generated payloads back into your local file system.

Everything happens locally. No cloud syncs, no telemetry, no internet required. Your codebase and your architecture remain entirely sovereign.

------

## Core Modules

Chronoql Gossip is divided into distinct operational domains to help you manage every phase of the development lifecycle.

### Ideation & Planning

- **Kanban Orchestration:** A lightweight, highly visual project management board. Track your application's roadmap, organize features, and drag-and-drop tasks to keep your development momentum organized.

### Architecture & Constraints

- **Architecture Workspace:** LLMs hallucinate when they lack boundaries. This workspace allows you to define strict, version-controlled markdown documents (like Functional Specifications, API Contracts, and UI Constraints). Use the built-in Template Engine to jumpstart new rulesets, ensuring your AI assistant always adheres to your established patterns.

### System Visualizers

- **Codebase Explorer:** An interactive, visual map of your physical file system and dependency graph. Understand how your files relate to one another at a glance.
- **Schema Visualizer:** Instantly render your database definitions into an interactive, relational map. Never lose track of your foreign keys and data models again.

### LLM Command Center

- **Context Compressor:** Stop copy-pasting entire files into ChatGPT or Claude. The Context Compressor allows you to visually stage specific files, apply regex-based minification rules to strip out unnecessary tokens (like comments or whitespace), and instantly calculate the weight of your payload before you send it to the LLM.
- **Payload Integrator:** Once the LLM gives you the code, paste the JSON payload here. The Integrator securely parses the generated code and physically writes the updates directly to your local file system, complete with atomic pre-flight reviews to prevent destructive overwrites.

### System Administration

- **Workspace Hub:** Manage multiple, isolated project environments (Multi-Tenancy). Track your token consumption over time with visual telemetry charts to understand the true ROI of your AI-assisted workflows.
- **Data Management:** Total data sovereignty. Instantly generate, export, and restore compressed `.zip` backups of your entire data ecosystem with a single click.

------

## The Philosophy: Offline-First & Vanilla

Chronoql Gossip is built as a standalone desktop application, but it actively rejects the bloat of modern frontend frameworks.

- **Zero Internet Required:** The application is driven entirely by a robust, locally managed database.
- **Strict Separation of Concerns:** The UI is built with native HTML5, CSS3, and Vanilla JavaScript.
- **High-Contrast Accessibility:** The interface is engineered for long coding sessions, prioritizing readable typography, distinct visual hierarchies, and low-fatigue interaction design.

##### Get the app:  [gossip](https://github.com/chronoql/gossip/releases)
