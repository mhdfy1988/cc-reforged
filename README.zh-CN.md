> **免责声明：** 本仓库包含从 [`@anthropic-ai/claude-code@2.1.88`](https://www.npmjs.com/package/@anthropic-ai/claude-code/v/2.1.88) npm 包内置的 source map（`cli.js.map`）恢复出的源码。这不是 Anthropic 官方发布的源码。相关权利归各自权利方所有。

[English](README.md) | [简体中文](README.zh-CN.md)

# CCR v0.1

![](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square)

CCR 是一个终端编码 Agent 的恢复构建版本。当前 v0.1 里程碑保留了终端优先的交互方式，并新增了仓库内置的可插拔 LLM 运行时，已支持 Codex OAuth。

仓库或文档里仍然出现的上游产品名、协议名和兼容性引用，只在描述源码来源或外部兼容边界时保留。

<img src="https://github.com/anthropics/claude-code/blob/main/demo.gif?raw=1" />

## 当前状态

- 产品命令：`ccr`
- 产品版本：`CCR v0.1`
- 默认配置目录：`~/.ccr`
- 默认 LLM 配置文件：`~/.ccr/data/llm.config.local.json`
- 默认 Codex OAuth 凭据文件：`~/.ccr/data/codex-oauth.json`
- 当前运行时方向：优先使用内置 provider runtime；仍保留必要的 Anthropic 兼容边界

## 从源码运行

当前仓库主要面向源码运行或本地链接使用。

```powershell
npm.cmd install
npm.cmd run build
node --no-warnings --experimental-loader ./bun-bundle-loader.mjs ./cli.js --version
node --no-warnings --experimental-loader ./bun-bundle-loader.mjs ./cli.js
```

预期版本输出：

```text
CCR v0.1
```

可选的本地全局链接：

```powershell
npm.cmd link
ccr --version
ccr
```

## Codex OAuth

CCR v0.1 可以使用 Codex OAuth 作为当前 LLM provider。

推荐首次使用流程：

1. 使用 `ccr` 或上面的源码命令启动 CCR。
2. 在 TUI 里运行 `/login`。
3. 选择 `Codex OAuth`。
4. 在浏览器中完成登录。
5. 输入一个简单问题，确认模型可以正常响应。

可以用下面的命令查看运行时状态：

```powershell
node --no-warnings --experimental-loader ./bun-bundle-loader.mjs ./cli.js auth status --json
```

当前 Codex OAuth 默认模型是 `gpt-5.4`。模型和 provider 配置会刻意存放在 `~/.ccr` 下，避免和本机 Claude Code、Codex、OpenClaw 等工具的配置目录冲突。

## 开发验证

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run build -- --pretty false
npm.cmd run smoke:llm-config
npm.cmd run smoke:llm-runtime-status
npm.cmd run smoke:codex-oauth-session
npm.cmd run smoke:codex-oauth-provider
```

不要直接用 `node scripts/...` 运行 smoke 脚本，除非确认该脚本不需要项目 loader。大多数 runtime smoke 脚本必须通过 `bun-bundle-loader.mjs` 启动，npm scripts 已经处理好了这一点。

## 重要边界

- CCR 不是 Anthropic 官方源码发布版本。
- `CLAUDE.md` 在恢复代码的部分流程中仍是兼容文件名。
- 一些 Anthropic、Claude、Claude Desktop、Chrome extension、GitHub App 和 remote-session 文案可能仍会保留，因为它们指向真实外部服务或协议。
- 新增或面向用户展示的 CCR 产品身份，应优先使用 `CCR` / `ccr`。

## 问题反馈

可以在 CCR 内使用 `/bug` 命令，也可以提交 [GitHub issue](https://github.com/mhdfy1988/cc-reforged/issues)。

## 上游参考

- 上游源码来源：[`@anthropic-ai/claude-code@2.1.88`](https://www.npmjs.com/package/@anthropic-ai/claude-code/v/2.1.88)
- 上游产品介绍：[Claude Code](https://claude.com/product/claude-code)
- 上游文档参考：[code.claude.com/docs](https://code.claude.com/docs/en/overview)
