# CCR 文档索引

这里是 CCR 当前阶段的项目文档入口。根目录只保留导航和跨主题索引，具体专题文档按目录沉淀，避免后续修复、MCP、发布、规则混在一起。

## MCP 专区

- [CCR 用户目录与安装布局](./ccr-home-layout.md)
- [MCP 文档入口](./mcp/README.md)
- [通用 MCP 接入规范](./mcp/integration-standard.md)
- [MCP 验证与排查手册](./mcp/verification-runbook.md)
- [Playwright MCP 接入设计](./mcp/playwright-integration-design.md)
- [MCP 示例配置](./examples/mcp/README.md)

## 架构与入口

- [CCR 多入口与 App Server 总体方案](./architecture/entrypoints-runtime-app-server-desktop-vscode.md)
- [CCR Core 统一对外接口边界](./architecture/ccr-core-interface-boundary.md)
- [CCR App Server 协议详细设计](./architecture/app-server-protocol-design.md)
- [CCR App Server 会话 API 设计](./architecture/app-server-session-api-design.md)
- [CCR App Server 权限复用设计](./architecture/app-server-permission-reuse-design.md)
- [CCR App Server Client SDK 设计](./architecture/app-server-client-sdk-design.md)
- [CCR App Server 版本、协议兼容与回滚规则](./architecture/app-server-version-compatibility.md)
- [CCR 客户端产品与交互设计](./architecture/desktop-client-product-design.md)
- [CCR Desktop 客户端框架选型](./architecture/desktop-framework-selection.md)
- [CCR Desktop 品牌与安装器体验方案](./architecture/desktop-branding-installer-plan.md)
- [CCR Desktop 打包与升级准备方案](./architecture/desktop-packaging-and-upgrade-plan.md)
- [CCR Desktop 自动更新状态机](./architecture/desktop-auto-update-state-machine.md)
- [CCR Desktop 代码签名准备方案](./architecture/desktop-code-signing-plan.md)
- [CCR Desktop GitHub Release 发布流程](./architecture/desktop-github-release-workflow.md)
- [CCR Desktop GitHub Actions 发布流水线](./architecture/desktop-github-actions-release-workflow.md)
- [CCR Desktop 日志与错误可观测方案](./architecture/desktop-logging-observability.md)
- [CCR Desktop 安装器与发布准备方案](./architecture/desktop-installer-release-readiness.md)
- [CCR Desktop 发布验收 Runbook](./architecture/desktop-release-acceptance-runbook.md)
- [CCR Desktop 输出展示与前端模块化方案](./architecture/desktop-output-display-and-modularization.md)
- [CCR Desktop 与 App Server 事件字段契约](./architecture/desktop-app-server-event-contract.md)
- [CCR Desktop 运行元数据字段来源表](./architecture/desktop-runtime-metadata-field-map.md)
- [CCR Desktop 工具事件卡片契约](./architecture/desktop-tool-event-card-contract.md)
- [CCR Desktop 体验增强路线](./architecture/desktop-experience-roadmap.md)
- [CCR 升级管理策略](./architecture/upgrade-management-strategy.md)
- [CCR App Server 实施 Todo](./stages/app-server-todo.md)
- [CCR Desktop 自动更新状态机 Todo](./stages/desktop-auto-update-todo.md)
- [CCR Desktop 发布验收 Todo](./stages/desktop-release-readiness-todo.md)
- [CCR Desktop 品牌与安装器体验 Todo](./stages/desktop-branding-installer-todo.md)
- [CCR Desktop 代码签名准备 Todo](./stages/desktop-code-signing-todo.md)
- [CCR Desktop GitHub Release 发布流程 Todo](./stages/desktop-github-release-todo.md)
- [CCR Desktop GitHub Actions 发布流水线 Todo](./stages/desktop-github-actions-release-todo.md)
- [CCR 工具能力治理修复清单](./stages/tool-capability-repair-list.md)

## 修复与恢复

- [运行时缺失目标清单](./runtime-missing-targets.md)
- [ESM require 审计](./esm-require-audit.md)
- [依赖恢复清单](./dependency-recovery-checklist.md)
- [工程骨架恢复清单](./engineering-skeleton-recovery-checklist.md)
- [宏与构建适配清单](./macro-and-build-adaptation-checklist.md)
- [恢复修复方案](./recovery-repair-plan.md)

## 协作规则

- [Agent 规则索引](./agent-detailed-rules.md)
- [详细规则目录](./agent-rules/)
- [阶段任务目录](./stages/)
- [历史 backlog](./backlog-history/)
