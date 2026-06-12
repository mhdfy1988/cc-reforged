> **Disclaimer:** This repository contains source code recovered from the source map (`cli.js.map`) bundled in the [`@anthropic-ai/claude-code@2.1.88`](https://www.npmjs.com/package/@anthropic-ai/claude-code/v/2.1.88) npm package. It is not an official source release by Anthropic. All rights belong to their respective owners.

[English](README.en.md) | [简体中文](README.md)

# CCR

![](https://img.shields.io/badge/Node.js-24%2B-brightgreen?style=flat-square)
![](https://img.shields.io/badge/Desktop-Windows-blue?style=flat-square)
![](https://img.shields.io/badge/current-0.6.3-orange?style=flat-square)

CCR is a recovery and evolution build of a terminal coding agent. It keeps the original terminal-first workflow, adds a CCR-owned configuration/runtime boundary, and is growing a Desktop client around a stable App Server protocol.

The current main line focuses on:

- `ccr` CLI / TUI runtime with Codex OAuth support.
- CCR for Windows, including local App Server orchestration, session history, permission settings, auto-update, and release packaging.
- Built-in LLM runtime abstractions for multiple providers, profiles, protocols, multimodal content blocks, generated artifacts, and per-turn model metadata.
- Codex OAuth, OpenAI, DeepSeek official API, MiniMax International / China, Kimi, GLM API / Coding Plan, and shared OpenAI Chat Completions plus Anthropic Messages protocol adapters.
- Provider-neutral image generation through `GenerateImage`, with generated images persisted before Desktop thumbnail / preview rendering.
- External capability management, including user-level MCP config, Desktop MCP / Skill / Plugin pages, a standalone capability catalog, install/import flows, enable/disable, diagnostics, and managed records.
- Project-local `.ccr` settings isolation, avoiding conflicts with Claude Code, Codex, or OpenClaw on the same machine.

![CCR](docs/architecture/assets/ccr-desktop-main-workbench-clean.png)

## Current Status

- Package: `cc-reforged`
- Version: `0.6.3`
- CLI command: `ccr`
- Desktop app: `CCR`
- Runtime requirement: Node.js `>=24.0.0`
- Default config directory: `~/.ccr`
- Default LLM config file: `~/.ccr/data/llm.config.local.json`
- Default LLM credential file: `~/.ccr/data/llm.credentials.local.json`
- Release feed: GitHub Releases under [`mhdfy1988/cc-reforged`](https://github.com/mhdfy1988/cc-reforged/releases)

The repository may contain unreleased work after the latest tagged version. See [CHANGELOG.md](CHANGELOG.md) for user-facing changes.

The `0.6.3` line focuses on external capability governance, building on the MCP / Skill management baseline with a unified capability catalog, local Plugin package management, request-scoped runtime snapshots, installation reliability, runtime activation, audit, and management flows.

`0.6.3` completes the G1-G4 external capability root refactor and Plugin productization P0-P12. Capability queries use request-scoped snapshots and source-aware identities; the existing Plugin manifest, installation registry, version cache, and runtime loader now sit behind a request-scoped domain session, side-effect-free inspection, immutable plan/apply actions, recoverable transactions, explicit runtime activation, configuration and App relations, Desktop local package management, and thin CLI / Ink adapters. The Plugin release matrix currently contains 76 cases, 42 failure scenarios, 14 final invariants, and 18 executable evidence scripts.

## Install

Install the CLI package from npm:

```powershell
npm.cmd install -g cc-reforged
ccr --version
ccr
```

For Desktop builds, download the latest Windows installer from GitHub Releases:

```text
CCR-<version>-win-x64.exe
```

The Windows build is currently unsigned. Verify the installer against the SHA256 values listed in the release note if Windows shows an unknown publisher warning.

## Run From Source

```powershell
npm.cmd install
npm.cmd run build
node --no-warnings --experimental-loader ./bun-bundle-loader.mjs ./cli.js --version
node --no-warnings --experimental-loader ./bun-bundle-loader.mjs ./cli.js
```

Optional local global link:

```powershell
npm.cmd link
ccr --version
ccr
```

Desktop development:

```powershell
npm.cmd run desktop:dev
```

Desktop installer build:

```powershell
npm.cmd run desktop:dist
```

## LLM Providers

Codex OAuth is the default provider. Recommended first-run flow:

1. Start CCR with `ccr` or the source command above.
2. Run `/login` in the TUI.
3. Select `Codex OAuth`.
4. Complete the browser login.
5. Run a simple prompt to confirm the model is responding.

Runtime status can be checked with:

```powershell
node --no-warnings --experimental-loader ./bun-bundle-loader.mjs ./cli.js auth status --json
```

The model/provider configuration is stored under `~/.ccr` by default. Current builds use a profile-first configuration model: `llm.config.local.json` stores `schemaVersion + current + profiles + providerOverrides`, while `llm.credentials.local.json` stores secrets by `profileCredentials[profileId]`. A profile combines provider type, protocol, endpoint, credential slot, available models, and default model.

Model configuration can be inspected and changed from the CLI:

```powershell
ccr model status
ccr model list
ccr model set gpt-5.5
ccr model profile codex-oauth-1 gpt-5.4
```

CCR also includes a first-level **Models** page for provider/profile management, API key entry, connection testing, and top-bar model/profile switching. The top bar is intentionally split into two controls: one for the current model and one for the current profile/provider connection. Switching affects the next user message and does not rewrite restored session history.

Built-in providers:

| Provider | Protocol | Auth | Notes |
| --- | --- | --- | --- |
| Codex OAuth | OpenAI Responses | OAuth | Text, image input, hosted image generation |
| OpenAI | OpenAI Chat / Images / Responses | API Key | Text, image input, image generation |
| DeepSeek | OpenAI Chat Completions | API Key | Text and tools |
| MiniMax International | Anthropic Messages + native image API | API Key | Text, tools, image generation |
| MiniMax China | Anthropic Messages + native image API | API Key | Text, tools, image generation |
| Kimi API / Kimi Code | OpenAI Chat / Anthropic Messages compatible | API Key | Text and tools |
| GLM API | OpenAI Chat compatible + Images | API Key | Text, vision models, `glm-image` generation |
| GLM Coding Plan | OpenAI Chat compatible | API Key | Coding Plan endpoint |

## Skill, MCP, Plugin, And Capability Catalog

Skill is a local instruction/workflow package whose primary entry is `SKILL.md`. The Desktop **Skill** page manages installed and imported skills, enable/disable state, repair, uninstall, runtime visibility, and high-risk install confirmation.

MCP remains the protocol and server layer for external tools, resources, prompts, and experimental skill resources. The Desktop **MCP** page manages user-global MCP servers by default, while project `.mcp.json` stays a runtime declaration source rather than the normal Desktop write target.

Plugin is a bundle, not a synonym for Skill, MCP server, or Tool. A Plugin can package Skills, MCP servers, Commands, Hooks, LSP servers, configuration, runtime contributions, and App relations. The Desktop **Plugin** page currently manages local Plugin packages only: built-in/managed plugins, imported folders, imported zip archives, and runtime-visible plugins. It does not present a remote marketplace browser as the main product surface.

Local Plugin packages may expose either of these manifest entries:

```text
plugin.json
.claude-plugin/plugin.json
```

The root `plugin.json` form is the recommended user-facing package entry. Import normalizes it to the internal `.claude-plugin/plugin.json` cache layout while reusing the same manifest schema, registry, version cache, and runtime loader. Desktop imports default to user-global scope; the enable switch lives in the left Plugin list card, and the detail pane keeps icon-only management actions.

The standalone **Capability** page is the read-side directory for Skill, MCP, Tool, Plugin, and App facts. It shows source, parent/child relations, runtime visibility, diagnostics, and pending items; it is not an installation registry and does not execute Plugin lifecycle actions.

## Desktop Features

- Local App Server lifecycle management.
- Workspace switching and project-local settings isolation.
- Session history grouped by workspace.
- First-level Models page for provider profiles, credentials, models, and connection testing.
- First-level MCP and Skill pages for install/import, enable/disable, diagnostics, repair, and uninstall flows.
- First-level Plugin page for local folder/zip imports, enable/disable, repair, uninstall, runtime state, component details, configuration, dependency/update facts, security/source details, and diagnostics.
- First-level Capability page for source-aware Skill, MCP, Tool, Plugin, and App facts.
- Current model and profile quick switching in the top bar.
- Multimodal input cards, generated image cards, local thumbnail / preview flow, and persisted generated outputs.
- Permission settings UI for local / project / user settings.
- Automatic update checks through GitHub Releases.
- Packaged Windows installer with release artifact validation.

## Development Checks

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run typecheck:desktop
npm.cmd run build -- --pretty false
npm.cmd run smoke:llm-config
npm.cmd run smoke:llm-runtime
npm.cmd run smoke:llm-runtime-status
npm.cmd run smoke:openai-chat-protocol
npm.cmd run smoke:codex-oauth-session
npm.cmd run smoke:codex-oauth-provider
npm.cmd run smoke:deepseek-provider
npm.cmd run smoke:minimax-provider
npm.cmd run smoke:generated-output-provider
npm.cmd run smoke:generate-image-tool
npm.cmd run smoke:session-generated-image-flow
npm.cmd run smoke:app-server
npm.cmd run smoke:app-server-client
npm.cmd run smoke:plugin-release
npm.cmd run smoke:external-extension-matrix
npm.cmd run smoke:cli-model
npm.cmd run desktop:build
```

Do not run runtime smoke scripts with plain `node scripts/...` unless you know the script does not need the project loader. The npm scripts already use the correct loader where needed.

## Release

- Version history: [CHANGELOG.md](CHANGELOG.md)
- Version roadmap: [docs/architecture/version-roadmap.md](docs/architecture/version-roadmap.md)
- Desktop release runbook: [docs/architecture/desktop-release-acceptance-runbook.md](docs/architecture/desktop-release-acceptance-runbook.md)
- GitHub Release workflow: [docs/architecture/desktop-github-release-workflow.md](docs/architecture/desktop-github-release-workflow.md)
- npm publish workflow: [docs/release/npm-publish-workflow.md](docs/release/npm-publish-workflow.md)

## Important Boundaries

- CCR is not an official Anthropic source release.
- `CLAUDE.md` remains a compatibility filename in parts of the recovered codebase.
- Some Anthropic, Claude, Claude Desktop, Chrome extension, GitHub App, and remote-session text may still exist where it names an external service or protocol.
- New user-facing product identity should use `CCR` or `ccr`.

## Reporting Bugs

Use the `/bug` command inside CCR, or file a [GitHub issue](https://github.com/mhdfy1988/cc-reforged/issues).

## Upstream References

- Source provenance: [`@anthropic-ai/claude-code@2.1.88`](https://www.npmjs.com/package/@anthropic-ai/claude-code/v/2.1.88)
- Upstream product overview: [Claude Code](https://claude.com/product/claude-code)
- Upstream documentation reference: [code.claude.com/docs](https://code.claude.com/docs/en/overview)
