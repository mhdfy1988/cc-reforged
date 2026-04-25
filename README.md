> **Disclaimer:** This repository contains source code recovered from the source map (`cli.js.map`) bundled in the [`@anthropic-ai/claude-code@2.1.88`](https://www.npmjs.com/package/@anthropic-ai/claude-code/v/2.1.88) npm package. It is not an official source release by Anthropic. All rights belong to their respective owners.

[English](README.md) | [简体中文](README.zh-CN.md)

# CCR v0.1

![](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square)

CCR is a terminal coding agent recovery build. The current v0.1 milestone keeps the terminal-first workflow and adds an in-repo pluggable LLM runtime with Codex OAuth support.

Upstream product and protocol references that still appear in the codebase or docs are kept only where they describe source provenance or external compatibility boundaries.

<img src="https://github.com/anthropics/claude-code/blob/main/demo.gif?raw=1" />

## Current Status

- Product command: `ccr`
- Product version: `CCR v0.1`
- Default config directory: `~/.ccr`
- Default LLM config file: `~/.ccr/data/llm.config.local.json`
- Default Codex OAuth credential file: `~/.ccr/data/codex-oauth.json`
- Current runtime direction: built-in provider runtime first, Anthropic compatibility retained where still needed

## Run From Source

This repository is currently intended to be run from source or linked locally.

```powershell
npm.cmd install
npm.cmd run build
node --no-warnings --experimental-loader ./bun-bundle-loader.mjs ./cli.js --version
node --no-warnings --experimental-loader ./bun-bundle-loader.mjs ./cli.js
```

Expected version output:

```text
CCR v0.1
```

Optional local global link:

```powershell
npm.cmd link
ccr --version
ccr
```

## Codex OAuth

CCR v0.1 can use Codex OAuth as the active LLM provider.

Recommended first-run flow:

1. Start CCR with `ccr` or the source command above.
2. Run `/login` in the TUI.
3. Select `Codex OAuth`.
4. Complete the browser login.
5. Run a simple prompt to confirm the model is responding.

Runtime status can be checked with:

```powershell
node --no-warnings --experimental-loader ./bun-bundle-loader.mjs ./cli.js auth status --json
```

The default Codex OAuth model is currently `gpt-5.4`. Model/provider configuration is intentionally stored under `~/.ccr` to avoid conflicts with local Claude Code, Codex, or OpenClaw installations.

## Development Checks

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run build -- --pretty false
npm.cmd run smoke:llm-config
npm.cmd run smoke:llm-runtime-status
npm.cmd run smoke:codex-oauth-session
npm.cmd run smoke:codex-oauth-provider
```

Do not run the smoke scripts with plain `node scripts/...` unless you know the script does not need the project loader. Most runtime smoke scripts must be launched through `bun-bundle-loader.mjs`, and the npm scripts already do that.

## Important Boundaries

- CCR is not an official Anthropic source release.
- `CLAUDE.md` remains a compatibility filename in parts of the recovered codebase.
- Some Anthropic, Claude, Claude Desktop, Chrome extension, GitHub App, and remote-session text may still exist where it names an external service or protocol.
- User-facing CCR product identity is being migrated gradually and should use `CCR` / `ccr` for new work.

## Reporting Bugs

Use the `/bug` command inside CCR, or file a [GitHub issue](https://github.com/mhdfy1988/cc-reforged/issues).

## Upstream References

- Upstream source provenance: [`@anthropic-ai/claude-code@2.1.88`](https://www.npmjs.com/package/@anthropic-ai/claude-code/v/2.1.88)
- Upstream product overview: [Claude Code](https://claude.com/product/claude-code)
- Upstream documentation reference: [code.claude.com/docs](https://code.claude.com/docs/en/overview)
