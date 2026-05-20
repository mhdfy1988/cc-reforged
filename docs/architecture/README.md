# CCR 技术文档索引

`architecture/` 存放长期技术文档。这里的文档应服务后续设计、实现、接入和排查，不记录单轮任务进度。

## 架构总览

- [CCR 版本路线图](./version-roadmap.md)
- [CCR 多入口与 App Server 总体方案](./entrypoints-runtime-app-server-desktop-vscode.md)
- [CCR Core 统一对外接口边界](./ccr-core-interface-boundary.md)
- [CCR 升级管理策略](./upgrade-management-strategy.md)
- [CCR 项目级 Settings 隔离设计](./ccr-project-settings-isolation-design.md)
- [CCR 用户目录与安装布局](./ccr-home-layout.md)

## 工程兼容与迁移

- [CCR 防冲突迁移清单](./ccr-conflict-isolation-migration.md)
- [Claude Code Reforged 依赖与 Shim 边界](./dependency-shim-boundary.md)

## App Server 与协议

- [CCR App Server 协议详细设计](./app-server-protocol-design.md)
- [CCR App Server 会话 API 设计](./app-server-session-api-design.md)
- [CCR App Server Client SDK 设计](./app-server-client-sdk-design.md)
- [CCR App Server 原生上下文链路恢复设计](./app-server-native-context-recovery.md)
- [CCR App Server 权限复用设计](./app-server-permission-reuse-design.md)
- [CCR App Server 版本、协议兼容与回滚规则](./app-server-version-compatibility.md)

## LLM Runtime、Provider 与多模态

- [内置通用 LLM Runtime 设计方案](./builtin-llm-runtime-design.md)
- [CCR 标准 LLM 协议](./ccr-standard-llm-protocol.md)
- [CCR LLM Provider 与多模态协议长期路线图](./llm-provider-protocol-long-term-roadmap.md)
- [CCR 协议统一化接入状态总账](./protocol-implementation-status.md)
- [CCR 多供应商模型与协议接入设计](./multi-provider-model-management-design.md)
- [CCR Provider 协议盘点与官方文档对照](./provider-protocol-inventory-and-official-docs.md)
- [CCR Provider 工具协议统一化标准](./provider-tool-protocol-normalization.md)
- [Provider 能力工具化后续方向](./provider-capability-tools-future.md)
- [CCR Provider 真实 Probe 设计与入口](./provider-real-probe-design.md)
- [前台 Provider / Model 切换设计方案](./llm-frontend-provider-model-picker-design.md)
- [ChatGPT Codex Plan Provider 接入设计](./chatgpt-codex-provider-design.md)
- [CCR 多模态输入输出设计](./multimodal-input-output-design.md)
- [CCR 模型输出归一化与展示标准](./model-output-normalization-and-display-standard.md)
- [供应商接入文档](./provider-integrations/README.md)

## Desktop 与交互契约

- [CCR 客户端产品与交互设计](./desktop-client-product-design.md)
- [CCR Desktop 客户端框架选型](./desktop-framework-selection.md)
- [CCR Desktop 输出展示与前端模块化方案](./desktop-output-display-and-modularization.md)
- [CCR Desktop 与 App Server 事件字段契约](./desktop-app-server-event-contract.md)
- [CCR Desktop 运行元数据字段来源表](./desktop-runtime-metadata-field-map.md)
- [CCR Desktop 工具事件卡片契约](./desktop-tool-event-card-contract.md)
- [CCR Desktop 文件、附件与引用字段来源盘点](./desktop-file-attachment-reference-field-map.md)
- [CCR Desktop 历史会话设计](./desktop-session-history-design.md)
- [CCR Desktop 轻量会话侧栏设计](./desktop-session-sidebar-design.md)
- [CCR Desktop 体验增强路线](./desktop-experience-roadmap.md)
- [CCR Desktop 日志与错误可观测方案](./desktop-logging-observability.md)

## 打包、发布与升级

- [CCR Desktop 打包与升级准备方案](./desktop-packaging-and-upgrade-plan.md)
- [CCR Desktop 自动更新状态机](./desktop-auto-update-state-machine.md)
- [CCR Desktop 品牌与安装器体验方案](./desktop-branding-installer-plan.md)
- [CCR Desktop 安装器与发布准备方案](./desktop-installer-release-readiness.md)
- [CCR Desktop 安装包瘦身专项方案](./desktop-packaging-slimming-plan.md)
- [CCR Desktop 代码签名准备方案](./desktop-code-signing-plan.md)
- [CCR Desktop GitHub Release 发布流程](./desktop-github-release-workflow.md)
- [CCR Desktop GitHub Actions 发布流水线](./desktop-github-actions-release-workflow.md)
- [CCR Desktop 发布验收 Runbook](./desktop-release-acceptance-runbook.md)

## UI 方案与素材

- [日志页重设计方案](./logs-page-redesign-plan.md)
- [日志页重设计图](./logs-page-redesign-final.svg)
- [架构素材目录](./assets/)

## 不放在这里的内容

- 阶段目标和验收记录放 `../goals/`。
- 当前 todo、handoff、archive 放 `../stages/`。
- 外部源码证据索引放 `../references/`。
- 可复制示例放 `../examples/`。
