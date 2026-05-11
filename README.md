> **Disclaimer:** This repository contains source code recovered from the source map (`cli.js.map`) bundled in the [`@anthropic-ai/claude-code@2.1.88`](https://www.npmjs.com/package/@anthropic-ai/claude-code/v/2.1.88) npm package. It is not an official source release by Anthropic. All rights belong to their respective owners.

[English](README.md) | [简体中文](README.zh-CN.md)

# CCR

![](https://img.shields.io/badge/Node.js-24%2B-brightgreen?style=flat-square)
![](https://img.shields.io/badge/Desktop-Windows-blue?style=flat-square)
![](https://img.shields.io/badge/current-0.4.2-orange?style=flat-square)

CCR is a recovery and evolution build of a terminal coding agent. It keeps the original terminal-first workflow, adds a CCR-owned configuration/runtime boundary, and is growing a Desktop client around a stable App Server protocol.

The current main line focuses on:

- `ccr` CLI / TUI runtime with Codex OAuth support.
- CCR Desktop for Windows, including local App Server orchestration, session history, permission settings, auto-update, and release packaging.
- Built-in LLM runtime abstractions for multiple providers and protocols.
- Codex OAuth as the default provider, with DeepSeek and OpenAI-compatible protocol work in progress.
- Project-local `.ccr` settings isolation, avoiding conflicts with Claude Code, Codex, or OpenClaw on the same machine.

![CCR Desktop](docs/architecture/assets/ccr-desktop-main-workbench-clean.png)

## Current Status

- Package: `cc-reforged`
- Version: `0.4.2`
- CLI command: `ccr`
- Desktop app: `CCR Desktop`
- Runtime requirement: Node.js `>=24.0.0`
- Default config directory: `~/.ccr`
- Default LLM config file: `~/.ccr/data/llm.config.local.json`
- Default Codex OAuth credential file: `~/.ccr/data/codex-oauth.json`
- Release feed: GitHub Releases under [`mhdfy1988/cc-reforged`](https://github.com/mhdfy1988/cc-reforged/releases)

The repository may contain unreleased work after the latest tagged version. See [CHANGELOG.md](CHANGELOG.md) for user-facing changes.

## Install

Install the CLI package from npm:

```powershell
npm.cmd install -g cc-reforged
ccr --version
ccr
```

For Desktop builds, download the latest Windows installer from GitHub Releases:

```text
CCR-Desktop-<version>-win-x64.exe
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

The model/provider configuration is stored under `~/.ccr` by default. The current multi-provider work includes DeepSeek official API support and a shared OpenAI Chat Completions protocol adapter; the full Desktop model management page is still in progress.

## Desktop Features

- Local App Server lifecycle management.
- Workspace switching and project-local settings isolation.
- Session history grouped by workspace.
- Current model quick switching in the top bar.
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
npm.cmd run smoke:codex-oauth-session
npm.cmd run smoke:codex-oauth-provider
npm.cmd run smoke:app-server
npm.cmd run smoke:app-server-client
```

Do not run runtime smoke scripts with plain `node scripts/...` unless you know the script does not need the project loader. The npm scripts already use the correct loader where needed.

## Release

- Version history: [CHANGELOG.md](CHANGELOG.md)
- Desktop release runbook: [docs/architecture/desktop-release-acceptance-runbook.md](docs/architecture/desktop-release-acceptance-runbook.md)
- GitHub Release workflow: [docs/architecture/desktop-github-release-workflow.md](docs/architecture/desktop-github-release-workflow.md)
- npm publish workflow: [docs/release/npm-publish-workflow.md](docs/release/npm-publish-workflow.md)

## Important Boundaries

- CCR is not an official Anthropic source release.
- `CLAUDE.md` remains a compatibility filename in parts of the recovered codebase.
- Some Anthropic, Claude, Claude Desktop, Chrome extension, GitHub App, and remote-session text may still exist where it names an external service or protocol.
- New user-facing product identity should use `CCR`, `ccr`, or `CCR Desktop`.

## Reporting Bugs

Use the `/bug` command inside CCR, or file a [GitHub issue](https://github.com/mhdfy1988/cc-reforged/issues).

## Upstream References

- Source provenance: [`@anthropic-ai/claude-code@2.1.88`](https://www.npmjs.com/package/@anthropic-ai/claude-code/v/2.1.88)
- Upstream product overview: [Claude Code](https://claude.com/product/claude-code)
- Upstream documentation reference: [code.claude.com/docs](https://code.claude.com/docs/en/overview)
