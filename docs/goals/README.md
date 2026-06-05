# CCR 阶段目标目录

这里存放每个阶段开始前整理出来的 Goal 文档。Goal 是阶段目标和验收记录，不是长期技术接入文档。

Goal 文档只回答：

- 这个阶段要达成什么。
- 为什么要先做它。
- 本阶段范围和非目标。
- 验收标准和验证命令。
- 完成后下一步是什么。

实时任务状态仍然以 `docs/stages/*-todo.md` 为准，Goal 不替代 Todo。

长期技术方案、provider 接入方案和接口契约应同步沉淀到 `docs/architecture/`；Goal 中只保留本阶段为什么做、做了什么和如何验收。

命名格式：

```text
YYYY-MM-DD-p<阶段号>-<简短主题>.md
```

当前 Goal：

- [2026-06-02 Skill S-1 标准模型与现有运行时归一](./2026-06-02-skill-s1-standard-model-plan.md)
  - [S-1.1 模型与 Schema 边界](./2026-06-02-skill-s1-1-model-schema.md)
  - [S-1.2 Frontmatter 归一与兼容元数据](./2026-06-02-skill-s1-2-normalizer.md)
  - [S-1.3 Command Adapter 等价适配](./2026-06-02-skill-s1-3-command-adapter.md)
  - [S-1.4 SkillCatalog 查询、分组和去重](./2026-06-02-skill-s1-4-catalog.md)
  - [S-1.5 Loader 最小接入与回归验证](./2026-06-02-skill-s1-5-loader-integration.md)
- [2026-06-02 Skill S-2 本地导入与兼容转换](./2026-06-02-skill-s2-import-conversion-plan.md)
- [2026-06-02 Skill S-3 安装计划与记录](./2026-06-02-skill-s3-install-record-plan.md)
- [2026-06-02 Skill S-1 到 S-3 基础阶段收口核验](./2026-06-02-skill-s1-s3-closeout.md)
- [2026-06-02 Skill S-4 安全扫描与风险提示](./2026-06-02-skill-s4-security-scan-plan.md)
- [2026-06-03 Skill S-4 安全扫描与风险提示收口](./2026-06-03-skill-s4-closeout.md)
- [2026-06-03 Skill S-5 Desktop Skill 管理面](./2026-06-03-skill-s5-desktop-management-plan.md)
- [2026-06-03 Skill S-5 Desktop Skill 管理面收口](./2026-06-03-skill-s5-closeout.md)
- [2026-06-03 Skill S-6 运行时启用治理与 installed package 接入](./2026-06-03-skill-s6-runtime-activation-plan.md)
- [2026-06-03 Skill S-6 运行时启用治理与 installed package 接入收口](./2026-06-03-skill-s6-closeout.md)
- [2026-06-03 Skill hooks / shell 运行时等价与安全收口](./2026-06-03-skill-hooks-shell-runtime-security-plan.md)
- [2026-06-03 Skill S-7 来源扩展](./2026-06-03-skill-s7-source-expansion-plan.md)
- [2026-06-03 Skill S-8 运行时 Catalog 统一](./2026-06-03-skill-s8-runtime-catalog-unification-plan.md)
- [2026-06-03 Skill S-9 CLI 管理](./2026-06-03-skill-s9-cli-management-plan.md)
- [2026-06-03 Skill / MCP S-10 发布前收口](./2026-06-03-skill-mcp-s10-closeout-plan.md)
- [2026-06-03 Skill S-11 内置 Skill preset 内容层](./2026-06-03-skill-s11-builtin-presets-plan.md)
- [2026-06-03 Skill / MCP 发布前测试用例体系](./2026-06-03-skill-mcp-test-goals-plan.md)
- [2026-06-05 Skill P1 安装与修复可靠性](./2026-06-05-skill-p1-install-repair-reliability-plan.md)
- [2026-06-05 Skill P2 能力目录、诊断与完整性](./2026-06-05-skill-p2-capability-catalog-diagnostics-integrity-plan.md)
- [2026-06-05 Skill P3 检查模型收敛](./2026-06-05-skill-p3-inspection-value-object-refactor-plan.md)
- [2026-06-05 扩展能力目录统一重构](./2026-06-05-extension-capability-catalog-unification-plan.md)
- [2026-06-05 扩展能力体系重构序列](./2026-06-05-extension-capability-refactor-series.md)
  - [A1 统一能力模型](./2026-06-05-extension-capability-a1-model.md)
  - [A2 Capability Catalog 聚合层](./2026-06-05-extension-capability-a2-catalog-core.md)
  - [A3 Skill 接入统一能力目录](./2026-06-05-extension-capability-a3-skill-provider.md)
  - [A4 MCP / Tool 接入统一能力目录](./2026-06-05-extension-capability-a4-mcp-tool-provider.md)
  - [A5 Plugin 关系预留](./2026-06-05-extension-capability-a5-plugin-relations.md)
  - [A6 统一查询入口收口](./2026-06-05-extension-capability-a6-api-closeout.md)
- [2026-06-05 Skill 内部结构重构序列](./2026-06-05-skill-internal-refactor-series.md)
  - [B1 Skill ManagementService 瘦身](./2026-06-05-skill-internal-b1-management-service-thinning.md)
  - [B2 InstallTransaction 安装事务抽出](./2026-06-05-skill-internal-b2-install-transaction.md)
  - [B3 ManagementDto 展示适配抽出](./2026-06-05-skill-internal-b3-management-dto.md)
  - [B4 SkillCapabilityProvider 抽出](./2026-06-05-skill-internal-b4-capability-provider.md)
  - [B5 SkillRuntimeAdapter 抽出](./2026-06-05-skill-internal-b5-runtime-adapter.md)
  - [B6 Skill 模块边界和 smoke 收口](./2026-06-05-skill-internal-b6-boundary-closeout.md)
- [2026-05-31 ThreadDisplay 残留入口与文档收口](./2026-05-31-thread-display-closeout.md)
- [2026-05-31 ThreadDisplay 全事件 Ordered Display Reducer 深化](./2026-05-31-thread-display-full-ordered-reducer-next.md)
  - [2-1 输入来源矩阵与 unsupported 边界](./2026-05-31-thread-display-full-ordered-reducer-01-input-source-matrix.md)（已完成）
  - [2-2 permission / compact / control fact 化](./2026-05-31-thread-display-full-ordered-reducer-02-permission-compact-control-facts.md)（已完成）
  - [2-3 attachment / generated output 多来源归一](./2026-05-31-thread-display-full-ordered-reducer-03-attachment-generated-output.md)（已完成）
  - [2-4 tool progress 生命周期并入 reducer state](./2026-05-31-thread-display-full-ordered-reducer-04-tool-progress-lifecycle.md)（已完成）
  - [2-5 黄金回归矩阵扩展与最终收口](./2026-05-31-thread-display-full-ordered-reducer-05-golden-closeout.md)（已完成）
- [2026-05-30 Full Ordered Display Reducer 最终状态机设计](./2026-05-30-full-ordered-display-reducer-final-state-machine.md)
- [2026-05-29 ThreadDisplay Ordered Display Reducer Goal Plan](./2026-05-29-thread-display-ordered-reducer-goal-plan.md)
- [2026-05-24 STD-HISTORY-09-1 会话物化源码入口核对](./2026-05-24-std-history-09-1-source-entry-audit.md)
- [2026-05-24 STD-HISTORY-09-2 MaterializedConversation 物化协议定型](./2026-05-24-std-history-09-2-materialized-conversation-contract.md)
- [2026-05-24 STD-HISTORY-09-3 compact / snip / preservedSegment 语义统一](./2026-05-24-std-history-09-3-compact-snip-preserved-segment.md)
- [2026-05-24 STD-HISTORY-09-4 Core resume 只消费物化结果](./2026-05-24-std-history-09-4-core-resume-materialized-context.md)
- [2026-05-24 STD-HISTORY-09-5 App Server 恢复展示消费同一物化结果](./2026-05-24-std-history-09-5-app-server-display-materialized-context.md)
- [2026-05-24 STD-HISTORY-09-6 异常只诊断不伪装成功](./2026-05-24-std-history-09-6-diagnostics-not-fallback.md)
- [2026-05-24 STD-HISTORY-09-7 缓存和持久化顺序闭环](./2026-05-24-std-history-09-7-cache-and-persistence-order.md)
- [2026-05-24 STD-HISTORY-09-8 自动验证覆盖关键路径](./2026-05-24-std-history-09-8-smoke-coverage.md)
- [2026-05-24 STD-HISTORY-09-9 文档和后续回归收口](./2026-05-24-std-history-09-9-doc-closeout.md)
- [2026-05-19 STD-PROVIDER-01 Kimi / GLM Provider 接入](./2026-05-19-std-provider-01-kimi-glm-openai-chat-compatible.md)
- [2026-05-18 STD-OUTPUT-09 会话流生成图片输出闭环](./2026-05-18-std-output-09-session-generated-image-flow.md)
- [2026-05-18 STD-OUTPUT-08 通用图片生成归一化与 MiniMax 接入](./2026-05-18-std-output-08-provider-neutral-minimax-image-generation.md)
- [2026-05-18 STD-OUTPUT-07 OpenAI Responses image_generation 真实 API 接入](./2026-05-18-std-output-07-openai-responses-image-generation-api.md)
- [2026-05-18 STD-OUTPUT-06 OpenAI 生成路径数据一致性](./2026-05-18-std-output-06-openai-generation-consistency.md)
- [2026-05-18 STD-OUTPUT-05 真实 provider 生成 API 接入](./2026-05-18-std-output-05-real-provider-generation-api.md)
- [2026-05-18 STD-OUTPUT-04 Codex 对齐的生成物落盘与恢复](./2026-05-18-std-output-04-generated-artifact-persistence.md)
- [2026-05-18 STD-OUTPUT-03 生成型多模态输出设计](./2026-05-18-std-output-03-generated-multimodal-output.md)
- [2026-05-18 STD-DISPLAY-02 Provider 输出 fixture 与历史恢复 smoke](./2026-05-18-std-display-02-provider-output-fixtures.md)
- [2026-05-18 STD-DISPLAY-01 CcrContentBlock 共享类型](./2026-05-18-std-display-01-ccr-content-block.md)
- [2026-05-18 STD-PROTOCOL-02 Provider 协议盘点与官方文档对照](./2026-05-18-std-protocol-02-provider-protocol-inventory.md)
- [2026-05-18 STD-PROTOCOL-01 CCR 标准 LLM 协议文档](./2026-05-18-std-protocol-01-ccr-standard-llm-protocol.md)
- [2026-05-18 STD-TOOL-02 Provider 工具协议第一版收口](./2026-05-18-std-tool-02-provider-tool-profile.md)
- [2026-05-17 P23-FIX OpenAI-compatible 工具恢复与 TodoWrite schema 常驻](./2026-05-17-p23-fix-openai-tool-recovery-and-todowrite-schema.md)
- [2026-05-16 P23-FIX 自绘窗口标题栏与窗口控制按钮](./2026-05-16-p23-fix-custom-window-controls.md)
- [2026-05-16 P23-9 Smoke、真机验收和文档收口](./2026-05-16-p23-9-smoke-real-machine-doc-closeout.md)
- [2026-05-16 P23-8 用户消息附件展示、输出媒体归一化与历史恢复](./2026-05-16-p23-8-attachment-display-history.md)
- [2026-05-16 P23-7 Provider adapter 多模态映射](./2026-05-16-p23-7-provider-adapter-mapping.md)
- [2026-05-16 P23-6 文本文件输入策略与大文件保护](./2026-05-16-p23-6-text-file-input-guardrails.md)
- [2026-05-16 P23-5 图片输入最小闭环与 main/preload 安全读取](./2026-05-16-p23-5-image-input-loop.md)
- [2026-05-16 P23-4 Desktop 附件草稿队列与能力提示](./2026-05-16-p23-4-desktop-attachment-drafts.md)
- [2026-05-16 P23-3 Core user message 内容块归一化](./2026-05-16-p23-3-core-content-blocks.md)
- [2026-05-15 P23-2 App Server 多模态输入协议与发送前校验](./2026-05-15-p23-2-turn-input-validation.md)
- [2026-05-15 P23-1 模型能力声明、能力来源与能力解析器](./2026-05-15-p23-1-model-capabilities.md)
