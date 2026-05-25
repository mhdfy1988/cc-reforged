# CCR 阶段任务目录

`stages/` 存放任务推进状态，不作为长期技术设计入口。

## 当前主线

当前公开版本是 `0.5.1`。阶段任务进入发布后的 `0.5.x` 稳定化：继续处理多模态、多模型、工具调用、错误诊断、历史会话和发布质量，并提前收住 MCP 动态工具治理；`0.6.0` 再进入 Skill、Plugin 扩展包主线。

- [当前修复看板](./current-repair-backlog.md)
- [CCR 工具能力治理修复清单](./tool-capability-repair-list.md)
- [CCR 工具注册治理分期推进计划](./tool-registry-governance-todo.md)
- [CCR 文件搜索链路修复记录](./file-search-chain-todo.md)
- [CCR 多模态输入输出 Todo](./multimodal-input-output-todo.md)
- [CCR 多供应商模型与协议接入 Todo](./multi-provider-model-management-todo.md)
- [CCR App Server 实施 Todo](./app-server-todo.md)
- [CCR 历史恢复与实时展示统一协议实施计划](./realtime-history-display-contract-todo.md)

## 专项 Todo

- [CCR 项目级 Settings 隔离 Todo](./ccr-project-settings-isolation-todo.md)
- [CCR Desktop 历史会话 Todo](./desktop-session-history-todo.md)
- [CCR 历史恢复与实时展示统一协议实施计划](./realtime-history-display-contract-todo.md)
- [CCR Desktop 交互卡片补齐专项](./desktop-interaction-cards-todo.md)
- [CCR Desktop 自动更新状态机 Todo](./desktop-auto-update-todo.md)
- [CCR Desktop 安装包瘦身专项 Todo](./desktop-packaging-slimming-todo.md)
- [CCR Desktop 发布验收 Todo](./desktop-release-readiness-todo.md)
- [CCR Desktop 品牌与安装器体验 Todo](./desktop-branding-installer-todo.md)
- [CCR Desktop 代码签名准备 Todo](./desktop-code-signing-todo.md)
- [CCR Desktop GitHub Release Todo](./desktop-github-release-todo.md)
- [CCR Desktop GitHub Actions 发布 Todo](./desktop-github-actions-release-todo.md)
- [LLM Runtime Todo](./llm-runtime-todo.md)
- [真实 Runtime E2E Todo](./real-runtime-e2e-todo.md)
- [Runtime Smoke Todo](./runtime-smoke-todo.md)
- [工具能力治理修复清单](./tool-capability-repair-list.md)
- [工具注册治理分期推进计划](./tool-registry-governance-todo.md)
- [文件搜索链路修复记录](./file-search-chain-todo.md)

## 交接、审计与归档

- [当前交接文档 2026-05-08](./current-handoff-20260508.md)
- [历史会话恢复索引 2026-05-18](./history-session-recovery-index-2026-05-18.md)
- [App Server 已完成阶段归档](./app-server-completed-archive.md)
- [App Server 插队修复归档](./app-server-fix-archive.md)
- [Codex OAuth 接入审计](./codex-oauth-integration-audit.md)

## 已迁移技术文档

下面这些原本放在 `stages/` 的技术设计或边界说明，已迁到 `../architecture/`。后续只在这里保留 todo 与交接索引，不再新增长期技术设计。

- [内置通用 LLM Runtime 设计方案](../architecture/builtin-llm-runtime-design.md)
- [ChatGPT Codex Plan Provider 接入设计](../architecture/chatgpt-codex-provider-design.md)
- [前台 Provider / Model 切换设计方案](../architecture/llm-frontend-provider-model-picker-design.md)
- [Claude Code Reforged 依赖与 Shim 边界](../architecture/dependency-shim-boundary.md)
- [CCR 防冲突迁移清单](../architecture/ccr-conflict-isolation-migration.md)

## 使用规则

- 记录“现在做到哪、下一步是什么”时写在这里。
- 记录“长期应该怎么设计、怎么接入、怎么运行”时写到 `../architecture/`。
- 记录“修复恢复的长期清单、审计和排查依据”时写到 `../recovery/`。
- 一个长期主线优先保留一份权威 todo，避免多个 todo 同时声明当前指针。
