# Claude Code Reforged 依赖与 Shim 边界

## 当前结论

本项目当前以“能干净安装、构建、typecheck、运行基础 CLI”为第一优先级。恢复期补出的类型 shim 只承担编译期最小契约，不替代真实运行依赖；凡是已经确认不参与运行路径、且会破坏安装闭环的依赖，应从生产依赖中移除。

## 真实依赖

- `@anthropic-ai/sdk`：真实 API client 依赖，保留在 `dependencies`。
- `@modelcontextprotocol/sdk`：MCP 协议相关真实依赖，保留在 `dependencies`。
- `zod@^3.25.76`：当前主项目运行依赖，维持 v3 系列，避免为了未使用 SDK 类型导入升级到 v4。
- OpenTelemetry、React、commander、yaml、ws 等基础运行依赖：当前保留，由 build/typecheck/runtime smoke 共同覆盖。

## 已移除依赖

- `@anthropic-ai/claude-agent-sdk`：已从 `package.json` / `package-lock.json` 移除。当前源码只剩恢复期类型边界，不存在必须由该包提供的运行时 import；保留该包会引入 `zod@^4.0.0` peer 冲突，破坏干净 `npm install`。

## Shim 边界

- `src/types/third-party-sdk-shims.d.ts`：仅用于恢复期缺失类型、第三方声明缺口和 sourcemap 还原后的编译边界。
- Shim 不允许新增运行时 import，不允许把真实业务行为藏进声明文件。
- Shim 可以保留最小字段，但不能无限放宽成 `any` 大网；后续如果接入真实 SDK，应优先用适配层替换对应声明。

## Optional / Feature-Gated 项

- `optionalDependencies` 中的 sharp 平台包按当前包结构保留，由安装器按平台选择。
- Chrome / MCP stub 相关文件保留在 `vendor/`，继续作为缺桥接实现时的显式占位。
- 需要真实外部服务、真实认证、真实浏览器或真实 MCP server 的能力，不在依赖 smoke 中伪造通过，应通过单独 E2E todo 验证。

## 自动化检查

- `npm.cmd run smoke:deps`：检查生产依赖、发布保护脚本、shim 文件、`npm pack --dry-run` 白名单。
- `npm.cmd run ci:smoke`：串联 build、typecheck、CLI smoke、runtime smoke、permission smoke 和 dependency smoke。
