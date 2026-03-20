# OpenCode - Codebase Summary

## 1. Project Overview

**OpenCode** is an **AI-powered development tool** (similar to Claude Code) that serves as an open-source AI coding agent. It is built by the team behind [terminal.shop](https://terminal.shop) and is designed to be:

- **100% open source** - Not coupled to any specific AI provider
- **Provider-agnostic** - Works with Claude, OpenAI, Google, local models, or their recommended service [OpenCode Zen](https://opencode.ai/zen)
- **Client/server architecture** - Allows running the AI on one machine while controlling it remotely from another device
- **TUI-focused** - Built by neovim users with a focus on terminal-based interaction
- **Out-of-the-box LSP support** - Includes Language Server Protocol support

The project is hosted at [https://github.com/anomalyco/opencode](https://github.com/anomalyco/opencode) and supports multiple installation methods (npm, brew, scoop, pacman, nix, mise).

---

## 2. Architecture Overview

The codebase is a **monorepo** using **Bun workspaces** and **Turborepo** for build orchestration. It consists of 21 packages organized by function:

### Package Structure

```
packages/
├── opencode/          # Core CLI & business logic (main package)
├── console/           # Terminal UI (TUI)
│   ├── app/           # Console web app (SolidJS)
│   ├── core/          # Console backend services
│   ├── function/      # Serverless functions
│   ├── mail/          # Email service
│   └── resource/      # Resource management
├── app/               # Shared web UI components (SolidJS)
├── desktop/           # Native desktop app (Tauri)
├── desktop-electron/   # Electron desktop variant
├── web/               # Marketing website (Astro/Starlight)
├── docs/              # Documentation (Mintlify)
├── sdk/               # JavaScript SDK
├── ui/                # Shared UI component library
├── plugin/            # VSCode/IDE plugin
├── slack/             # Slack integration
├── identity/          # Authentication services
├── enterprise/        # Enterprise features (SolidStart)
├── function/          # Cloud functions
├── util/              # Utility functions
├── containers/        # Container configurations
├── extensions/        # Zed editor extension
└── script/            # Build scripts
```

---

## 3. Key Features & Functionality

### AI Agents

- **build** - Default full-access agent for development work
- **plan** - Read-only agent for code exploration and planning (denies file edits, asks permission for bash)
- **general** - Subagent for complex searches and multistep tasks (invoked via `@general`)

### CLI Commands

```bash
opencode <directory>     # Start TUI in a directory
opencode run              # Run a task
opencode generate         # Generate code
opencode serve            # Start headless API server
opencode web              # Start server + web interface
opencode providers        # Manage AI providers
opencode models           # Manage models
opencode upgrade          # Upgrade OpenCode
opencode attach           # Attach to running server
opencode mcp              # MCP server management
opencode github           # GitHub integration
opencode pr               # Pull request management
```

### Provider System

Located in `/packages/opencode/src/provider/`:

- Supports multiple AI providers through a unified interface
- Includes OpenAI-compatible API support
- Uses the `ai` SDK (Vercel AI SDK) for model interactions
- Has built-in support for various model APIs

### Tools System

Located in `/packages/opencode/src/tool/` (49 subdirectories):

- File operations (read, write, edit, glob, grep)
- Shell/Bash execution
- Git operations
- LSP (Language Server Protocol) integration
- Terminal/PTY management
- Project configuration
- And many more specialized tools

---

## 4. Main Technologies & Frameworks

### Core Languages & Runtimes

- **TypeScript** - Primary language throughout
- **Bun** - JavaScript runtime and package manager (v1.3.10)
- **Rust** - Used in desktop apps (Tauri)

### Frontend Frameworks

- **SolidJS** - Primary UI framework for TUI and web apps
- **SolidStart** - Full-stack SolidJS framework
- **Tailwind CSS** - Styling (v4.1.11)
- **Astro** - Marketing website

### Backend & Infrastructure

- **Effect** - Functional programming framework (v4.0.0-beta.35)
- **Hono** - Web framework for API routes
- **Drizzle ORM** - Database ORM (beta.19)
- **SQLite** - Local database
- **Nitro** - Deployment platform
- **SST** - Serverless stack

### AI & Machine Learning

- **Vercel AI SDK** (ai 5.0.124) - AI model interactions
- **Shiki** - Syntax highlighting
- **Marked** - Markdown parsing

### Desktop

- **Tauri** - Desktop app framework (v2)
- **Electron** - Alternative desktop framework

### Development Tools

- **Turborepo** - Build orchestration
- **Prettier** - Code formatting
- **Playwright** - E2E testing
- **Husky** - Git hooks
- **Yargs** - CLI argument parsing

---

## 5. Code Organization

### Core Package Structure (`packages/opencode/src/`)

| Directory | Purpose |
|-----------|---------|
| `cli/` | CLI commands and UI |
| `server/` | API server (Hono-based) |
| `agent/` | Agent logic and prompts |
| `provider/` | AI provider integrations |
| `tool/` | Tool implementations (49 directories) |
| `session/` | Session management |
| `project/` | Project detection and management |
| `storage/` | Database and storage |
| `config/` | Configuration handling |
| `lsp/` | Language Server Protocol |
| `mcp/` | Model Context Protocol |
| `plugin/` | Plugin system |
| `util/` | Utility functions |
| `installation/` | Installation management |

### Console Package (`packages/console/app/src/`)

Terminal UI components:

- `component/` - Reusable UI components
- `routes/` - Page routes
- `lib/` - Helper libraries
- `i18n/` - Internationalization
- `context/` - SolidJS context providers

### Database

- Uses SQLite with Drizzle ORM
- Located in storage layer
- Migrations in `/packages/console/core/migrations/`

---

## 6. Development Workflow

### Running Development

```bash
# Install dependencies
bun install

# Run OpenCode CLI
bun dev

# Run against different directory
bun dev <directory>

# Run web app
bun run --cwd packages/app dev

# Run desktop app
bun run --cwd packages/desktop tauri dev

# Run API server only
bun dev serve
```

### Building

```bash
# Build standalone executable
./packages/opencode/script/build.ts --single

# Build desktop app
bun run --cwd packages/desktop tauri build
```

---

## 7. Key Files

- **Root**: `package.json` - Workspace configuration
- **Main CLI**: `packages/opencode/src/index.ts` - Entry point
- **Server**: `packages/opencode/src/server/server.ts` - API server
- **TUI**: `packages/opencode/src/cli/cmd/tui/` - Terminal UI
- **Contributing**: `CONTRIBUTING.md` - Development guide
- **Style Guide**: `AGENTS.md` - Code style rules

---

## 8. Summary

OpenCode is a sophisticated, production-grade AI coding assistant with a well-organized architecture supporting multiple deployment modes (CLI, TUI, web, desktop) and multiple AI providers. It provides comprehensive code editing capabilities through a rich tool system, LSP integration, and a modular provider architecture that isn't tied to any specific AI vendor.
