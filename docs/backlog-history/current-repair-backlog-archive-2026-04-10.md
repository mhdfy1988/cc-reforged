# Claude Code Reforged 当前修复顺序与 TODO 列表

## 1. 文档目标

本文档用于回答三个问题：

1. 当前仓库还剩多少待修问题。
2. 当前修复主线推进到哪一步了。
3. 接下来按什么顺序继续修，避免在多个热点文件之间来回切换。

这份文档是执行清单，不替代总体恢复方案。总体背景和阶段边界仍以
[recovery-repair-plan.md](../recovery/recovery-repair-plan.md)
为准。

## 2. 当前快照

统计时间：`2026-04-10`（本轮最新全仓快照）

当前全仓 `typecheck` 余额：

- 剩余报错：`677`
- 涉及文件：`293`

说明：

- 这是全仓余额，不是当前主线文件的余额。
- 当前修复策略不是“按总报错数从高到低机械扫”，而是“先收主链大文件，再按领域成组推进”。

## 3. 已完成主链

下面这些文件已经完成“修复线程改代码 -> 审查线程完整复审 -> 主线程本地定向核验”闭环：

- [src/screens/REPL.tsx](D:/agent_project/claude-code-reforged/src/screens/REPL.tsx)
- [src/cli/print.ts](D:/agent_project/claude-code-reforged/src/cli/print.ts)
- [src/components/PromptInput/PromptInput.tsx](D:/agent_project/claude-code-reforged/src/components/PromptInput/PromptInput.tsx)
- [src/components/messages/CollapsedReadSearchContent.tsx](D:/agent_project/claude-code-reforged/src/components/messages/CollapsedReadSearchContent.tsx)
- [src/utils/collapseReadSearch.ts](D:/agent_project/claude-code-reforged/src/utils/collapseReadSearch.ts)
- [src/components/Settings/Config.tsx](D:/agent_project/claude-code-reforged/src/components/Settings/Config.tsx)
- [src/tools/AgentTool/UI.tsx](D:/agent_project/claude-code-reforged/src/tools/AgentTool/UI.tsx)
- [src/main.tsx](D:/agent_project/claude-code-reforged/src/main.tsx)
- [src/keybindings/defaultBindings.ts](D:/agent_project/claude-code-reforged/src/keybindings/defaultBindings.ts)
- [src/services/api/claude.ts](D:/agent_project/claude-code-reforged/src/services/api/claude.ts)
- [src/QueryEngine.ts](D:/agent_project/claude-code-reforged/src/QueryEngine.ts)
- [src/commands/plugin/ManagePlugins.tsx](D:/agent_project/claude-code-reforged/src/commands/plugin/ManagePlugins.tsx)
- [src/tools/AgentTool/AgentTool.tsx](D:/agent_project/claude-code-reforged/src/tools/AgentTool/AgentTool.tsx)
- [src/components/agents/new-agent-creation/wizard-steps/ConfirmStep.tsx](D:/agent_project/claude-code-reforged/src/components/agents/new-agent-creation/wizard-steps/ConfirmStep.tsx)
- [src/components/tasks/BackgroundTasksDialog.tsx](D:/agent_project/claude-code-reforged/src/components/tasks/BackgroundTasksDialog.tsx)
- [src/components/Stats.tsx](D:/agent_project/claude-code-reforged/src/components/Stats.tsx)
- [src/utils/queryHelpers.ts](D:/agent_project/claude-code-reforged/src/utils/queryHelpers.ts)
- [src/services/compact/microCompact.ts](D:/agent_project/claude-code-reforged/src/services/compact/microCompact.ts)
- [src/services/compact/compact.ts](D:/agent_project/claude-code-reforged/src/services/compact/compact.ts)
- [src/screens/Doctor.tsx](D:/agent_project/claude-code-reforged/src/screens/Doctor.tsx)
- [src/components/permissions/PermissionExplanation.tsx](D:/agent_project/claude-code-reforged/src/components/permissions/PermissionExplanation.tsx)
- [src/components/mcp/MCPSettings.tsx](D:/agent_project/claude-code-reforged/src/components/mcp/MCPSettings.tsx)
- [src/components/Messages.tsx](D:/agent_project/claude-code-reforged/src/components/Messages.tsx)
- [src/commands/plugin/PluginSettings.tsx](D:/agent_project/claude-code-reforged/src/commands/plugin/PluginSettings.tsx)
- [src/services/api/client.ts](D:/agent_project/claude-code-reforged/src/services/api/client.ts)
- [src/components/Spinner.tsx](D:/agent_project/claude-code-reforged/src/components/Spinner.tsx)
- [src/components/PromptInput/PromptInputFooterLeftSide.tsx](D:/agent_project/claude-code-reforged/src/components/PromptInput/PromptInputFooterLeftSide.tsx)
- [src/components/messageActions.tsx](D:/agent_project/claude-code-reforged/src/components/messageActions.tsx)
- [src/components/MessageRow.tsx](D:/agent_project/claude-code-reforged/src/components/MessageRow.tsx)
- [src/utils/model/bedrock.ts](D:/agent_project/claude-code-reforged/src/utils/model/bedrock.ts)
- [src/types/third-party-sdk-shims.d.ts](D:/agent_project/claude-code-reforged/src/types/third-party-sdk-shims.d.ts)
- [src/components/TeammateViewHeader.tsx](D:/agent_project/claude-code-reforged/src/components/TeammateViewHeader.tsx)
- [src/tools/FileWriteTool/UI.tsx](D:/agent_project/claude-code-reforged/src/tools/FileWriteTool/UI.tsx)
- [src/services/oauth/client.ts](D:/agent_project/claude-code-reforged/src/services/oauth/client.ts)
- [src/components/messages/AttachmentMessage.tsx](D:/agent_project/claude-code-reforged/src/components/messages/AttachmentMessage.tsx)
- [src/services/tips/tipRegistry.ts](D:/agent_project/claude-code-reforged/src/services/tips/tipRegistry.ts)
- [src/services/tools/toolExecution.ts](D:/agent_project/claude-code-reforged/src/services/tools/toolExecution.ts)
- [src/utils/plugins/pluginInstallationHelpers.ts](D:/agent_project/claude-code-reforged/src/utils/plugins/pluginInstallationHelpers.ts)
- [src/components/LogoV2/LogoV2.tsx](D:/agent_project/claude-code-reforged/src/components/LogoV2/LogoV2.tsx)
- [src/components/LogoV2/CondensedLogo.tsx](D:/agent_project/claude-code-reforged/src/components/LogoV2/CondensedLogo.tsx)
- [src/components/permissions/rules/PermissionRuleList.tsx](D:/agent_project/claude-code-reforged/src/components/permissions/rules/PermissionRuleList.tsx)
- [src/components/permissions/NotebookEditPermissionRequest/NotebookEditToolDiff.tsx](D:/agent_project/claude-code-reforged/src/components/permissions/NotebookEditPermissionRequest/NotebookEditToolDiff.tsx)
- [src/services/plugins/pluginOperations.ts](D:/agent_project/claude-code-reforged/src/services/plugins/pluginOperations.ts)
- [src/services/mcp/client.ts](D:/agent_project/claude-code-reforged/src/services/mcp/client.ts)
- [src/services/mcp/auth.ts](D:/agent_project/claude-code-reforged/src/services/mcp/auth.ts)
- [src/entrypoints/cli.tsx](D:/agent_project/claude-code-reforged/src/entrypoints/cli.tsx)
- [src/cli/bg.ts](D:/agent_project/claude-code-reforged/src/cli/bg.ts)
- [src/cli/handlers/templateJobs.ts](D:/agent_project/claude-code-reforged/src/cli/handlers/templateJobs.ts)
- [src/environment-runner/main.ts](D:/agent_project/claude-code-reforged/src/environment-runner/main.ts)
- [src/self-hosted-runner/main.ts](D:/agent_project/claude-code-reforged/src/self-hosted-runner/main.ts)

当前它们的定向 `typecheck` 都已经清零。

## 4. 当前主线停点

当前主线文件：

- [src/hooks/useTypeahead.tsx](D:/agent_project/claude-code-reforged/src/hooks/useTypeahead.tsx)

当前状态：

1. [src/services/api/claude.ts](D:/agent_project/claude-code-reforged/src/services/api/claude.ts) 已经闭环完成
2. [src/QueryEngine.ts](D:/agent_project/claude-code-reforged/src/QueryEngine.ts) 已经整文件闭环完成，当前定向 `typecheck` 为 `0`
3. [src/commands/plugin/ManagePlugins.tsx](D:/agent_project/claude-code-reforged/src/commands/plugin/ManagePlugins.tsx) 已经整文件闭环完成，当前定向 `typecheck` 为 `0`
4. [src/tools/AgentTool/AgentTool.tsx](D:/agent_project/claude-code-reforged/src/tools/AgentTool/AgentTool.tsx) 已经整文件闭环完成，当前定向 `typecheck` 为 `0`
5. [src/components/agents/new-agent-creation/wizard-steps/ConfirmStep.tsx](D:/agent_project/claude-code-reforged/src/components/agents/new-agent-creation/wizard-steps/ConfirmStep.tsx) 已经整文件闭环完成，当前定向 `typecheck` 为 `0`
6. [src/components/tasks/BackgroundTasksDialog.tsx](D:/agent_project/claude-code-reforged/src/components/tasks/BackgroundTasksDialog.tsx) 已经整文件闭环完成，当前定向 `typecheck` 为 `0`
7. [src/components/Stats.tsx](D:/agent_project/claude-code-reforged/src/components/Stats.tsx) 已经整文件闭环完成，当前定向 `typecheck` 为 `0`
8. [src/utils/queryHelpers.ts](D:/agent_project/claude-code-reforged/src/utils/queryHelpers.ts) 已经整文件闭环完成，当前定向 `typecheck` 为 `0`
9. [src/services/compact/microCompact.ts](D:/agent_project/claude-code-reforged/src/services/compact/microCompact.ts) 已经整文件闭环完成，当前定向 `typecheck` 为 `0`
10. [src/services/compact/compact.ts](D:/agent_project/claude-code-reforged/src/services/compact/compact.ts) 已经整文件闭环完成，当前定向 `typecheck` 为 `0`
11. [src/screens/Doctor.tsx](D:/agent_project/claude-code-reforged/src/screens/Doctor.tsx) 已经整文件闭环完成，当前定向 `typecheck` 为 `0`
12. [src/components/permissions/PermissionExplanation.tsx](D:/agent_project/claude-code-reforged/src/components/permissions/PermissionExplanation.tsx) 已经整文件闭环完成，当前定向 `typecheck` 为 `0`
13. [src/components/mcp/MCPSettings.tsx](D:/agent_project/claude-code-reforged/src/components/mcp/MCPSettings.tsx) 已完成“schema 收口 + 未建模 transport 显式提示 + loading/empty 分离”闭环，当前定向 `typecheck` 为 `0`
14. [src/components/Messages.tsx](D:/agent_project/claude-code-reforged/src/components/Messages.tsx) 已完成“本地 pipeline 联合 + uuid 视图收口 + grouped/collapsed 分支保留”闭环，当前定向 `typecheck` 为 `0`
15. [src/commands/plugin/PluginSettings.tsx](D:/agent_project/claude-code-reforged/src/commands/plugin/PluginSettings.tsx) 已完成“配置态三态显式化 + Errors 页异常态可见 + tab 标题异常态保留”闭环，当前定向 `typecheck` 为 `0`
16. [src/services/api/client.ts](D:/agent_project/claude-code-reforged/src/services/api/client.ts) 已完成“SDK 构造参数签名绑定 + Bedrock 认证优先级收口 + Foundry skip-auth 占位 token 修复”闭环，当前定向 `typecheck` 为 `0`
17. [src/components/Spinner.tsx](D:/agent_project/claude-code-reforged/src/components/Spinner.tsx) 已完成“本地 typed app-state 适配器收口 + 死分支清理”闭环，当前定向 `typecheck` 为 `0`
18. [src/components/PromptInput/PromptInputFooterLeftSide.tsx](D:/agent_project/claude-code-reforged/src/components/PromptInput/PromptInputFooterLeftSide.tsx) 已完成“本地 typed app-state 适配器收口 + 缺失符号补齐 + 编译期用户类型判别收口”闭环，当前定向 `typecheck` 为 `0`
19. [src/components/messageActions.tsx](D:/agent_project/claude-code-reforged/src/components/messageActions.tsx) 已完成“本地 pipeline 联合收口 + grouped/collapsed 分支窄化修复 + 文本复制返回类型收口”闭环，当前定向 `typecheck` 为 `0`
20. [src/components/MessageRow.tsx](D:/agent_project/claude-code-reforged/src/components/MessageRow.tsx) 已完成“本地 pipeline 联合收口 + grouped/collapsed 分支窄化修复”闭环，当前定向 `typecheck` 为 `0`
21. [src/utils/model/bedrock.ts](D:/agent_project/claude-code-reforged/src/utils/model/bedrock.ts) 已完成“Bedrock 模型链依赖声明收口 + skipAuth/no-auth signer 路径类型收口 + 凭据配置态收口”闭环，当前定向 `typecheck` 为 `0`
22. [src/types/third-party-sdk-shims.d.ts](D:/agent_project/claude-code-reforged/src/types/third-party-sdk-shims.d.ts) 已完成“最小 AWS/Smithy shim 收口 + CountTokens 契约补齐 + 过宽索引签名清理”闭环，当前定向 `typecheck` 为 `0`
23. [src/components/TeammateViewHeader.tsx](D:/agent_project/claude-code-reforged/src/components/TeammateViewHeader.tsx) 已完成“本地可信视图类型 + identity/prompt runtime guard + 不改渲染语义”闭环，当前定向 `typecheck` 为 `0`
24. [src/tools/FileWriteTool/UI.tsx](D:/agent_project/claude-code-reforged/src/tools/FileWriteTool/UI.tsx) 已完成“diff Hunk 类型收口 + rejection 数据严格 guard + HighlightedCode props 适配”闭环，当前定向 `typecheck` 为 `0`
25. [src/services/oauth/client.ts](D:/agent_project/claude-code-reforged/src/services/oauth/client.ts) 已完成“OAuth 响应 decode 收口 + 必填字段 fail-closed + roles null 语义保留”闭环，当前定向 `typecheck` 为 `0`
26. [src/components/messages/AttachmentMessage.tsx](D:/agent_project/claude-code-reforged/src/components/messages/AttachmentMessage.tsx) 已完成“附件分支判别收口 + teammate 任务 guard 收口 + default 联合编译期补齐”闭环，当前定向 `typecheck` 为 `0`
27. [src/services/tips/tipRegistry.ts](D:/agent_project/claude-code-reforged/src/services/tips/tipRegistry.ts) 已完成“Tip content 签名收口 + FileStateCache guard 收紧”闭环，当前定向 `typecheck` 为 `0`
28. [src/services/tools/toolExecution.ts](D:/agent_project/claude-code-reforged/src/services/tools/toolExecution.ts) 已完成“sourceToolAssistantUUID 统一收口 + validateUuid fail-closed”闭环，当前定向 `typecheck` 为 `0`
29. [src/utils/plugins/pluginInstallationHelpers.ts](D:/agent_project/claude-code-reforged/src/utils/plugins/pluginInstallationHelpers.ts) 已完成“安装失败联合守卫收口 + resolution-failed 失败链对齐”闭环，当前定向 `typecheck` 为 `0`
30. [src/components/LogoV2/LogoV2.tsx](D:/agent_project/claude-code-reforged/src/components/LogoV2/LogoV2.tsx) 已完成“EffortValue/agent 输入收口 + fail-closed 解析 + 无断言掩盖”闭环，当前定向 `typecheck` 为 `0`
31. [src/components/LogoV2/CondensedLogo.tsx](D:/agent_project/claude-code-reforged/src/components/LogoV2/CondensedLogo.tsx) 已完成“EffortValue/agent 输入收口 + fail-closed 解析 + 无断言掩盖”闭环，当前定向 `typecheck` 为 `0`
32. [src/components/permissions/rules/PermissionRuleList.tsx](D:/agent_project/claude-code-reforged/src/components/permissions/rules/PermissionRuleList.tsx) 已完成“权限上下文 guard 收紧 + 写路径 trust gate 对齐 + untrusted UI 隐藏态修复”闭环，当前定向 `typecheck` 为 `0`
33. [src/components/permissions/NotebookEditPermissionRequest/NotebookEditToolDiff.tsx](D:/agent_project/claude-code-reforged/src/components/permissions/NotebookEditPermissionRequest/NotebookEditToolDiff.tsx) 已完成“notebook 输入 guard 收紧 + cell/source fail-closed 收口 + typed bridge 对齐”闭环，当前定向 `typecheck` 为 `0`
34. [src/services/plugins/pluginOperations.ts](D:/agent_project/claude-code-reforged/src/services/plugins/pluginOperations.ts) 已完成“InstallCoreResult 失败联合守卫收口 + 失败分支字段安全访问”闭环，当前定向 `typecheck` 为 `0`
35. [src/services/mcp/client.ts](D:/agent_project/claude-code-reforged/src/services/mcp/client.ts) 已完成“serverType 收口 + MCPProgress 约束对齐 + Computer Use overrides fail-closed”闭环，当前定向 `typecheck` 为 `0`
36. [src/services/mcp/auth.ts](D:/agent_project/claude-code-reforged/src/services/mcp/auth.ts) 已完成“xss shim 恢复 + OAuth token/config parser 收口 + 热路径 fail-closed 接入”闭环，当前定向 `typecheck` 为 `0`
37. [src/entrypoints/cli.tsx](D:/agent_project/claude-code-reforged/src/entrypoints/cli.tsx) 已完成“入口快路径导出直连 + 可选壳层移除 + 桥接入口 fail-closed 补齐”闭环，当前定向 `typecheck` 为 `0`
38. [src/cli/bg.ts](D:/agent_project/claude-code-reforged/src/cli/bg.ts) 已完成“bg 子命令桥接导出补齐 + 占位实现显式抛错”闭环，当前定向 `typecheck` 为 `0`
39. [src/cli/handlers/templateJobs.ts](D:/agent_project/claude-code-reforged/src/cli/handlers/templateJobs.ts) 已完成“templatesMain 桥接导出补齐 + 占位实现显式抛错”闭环，当前定向 `typecheck` 为 `0`
40. [src/environment-runner/main.ts](D:/agent_project/claude-code-reforged/src/environment-runner/main.ts) 与 [src/self-hosted-runner/main.ts](D:/agent_project/claude-code-reforged/src/self-hosted-runner/main.ts) 已完成“runner 入口桥接导出补齐 + 占位实现显式抛错”闭环，当前定向 `typecheck` 为 `0`
41. [src/commands/insights.ts](D:/agent_project/claude-code-reforged/src/commands/insights.ts) 已完成“目录枚举 string 语义收口 + Dirent 泛型统一 + 本地 helper 复用”闭环，当前定向 `typecheck` 为 `0`
42. [src/components/StructuredDiff.tsx](D:/agent_project/claude-code-reforged/src/components/StructuredDiff.tsx) 已完成“diff 类型缺口本地最小收口 + Props 显式收口”闭环，当前定向 `typecheck` 为 `0`
43. [src/ink/ink.tsx](D:/agent_project/claude-code-reforged/src/ink/ink.tsx) 已完成“auto-bind 本地替代 + getter 无触发绑定 + reconciler facade 收口”闭环，当前定向 `typecheck` 为 `0`
44. [src/utils/teleport.tsx](D:/agent_project/claude-code-reforged/src/utils/teleport.tsx) 已完成“BundleUploadResult 判别式收口 + failReason 穷尽处理 + 上传失败文案统一”闭环，当前定向 `typecheck` 为 `0`
45. 当前主线已切到 [src/hooks/useTypeahead.tsx](D:/agent_project/claude-code-reforged/src/hooks/useTypeahead.tsx)

当前精确卡点：

- [src/hooks/useTypeahead.tsx](D:/agent_project/claude-code-reforged/src/hooks/useTypeahead.tsx)
- 当前它位于第一梯队热点（`7` 个报错）
- 当前主线先收 typeahead 交互链，再切 notebook/bridge 相邻链

当前问题：

- [src/QueryEngine.ts](D:/agent_project/claude-code-reforged/src/QueryEngine.ts) 已从热点列表里移出。
- 当前全仓新的第一梯队已转为权限与状态展示链（LogoV2 / PermissionRule / NotebookEditDiff）。
- [src/commands/plugin/ManagePlugins.tsx](D:/agent_project/claude-code-reforged/src/commands/plugin/ManagePlugins.tsx) 已从热点列表里移出。
- [src/tools/AgentTool/AgentTool.tsx](D:/agent_project/claude-code-reforged/src/tools/AgentTool/AgentTool.tsx) 已从热点列表里移出。
- [src/components/agents/new-agent-creation/wizard-steps/ConfirmStep.tsx](D:/agent_project/claude-code-reforged/src/components/agents/new-agent-creation/wizard-steps/ConfirmStep.tsx) 已从热点列表里移出。
- [src/components/tasks/BackgroundTasksDialog.tsx](D:/agent_project/claude-code-reforged/src/components/tasks/BackgroundTasksDialog.tsx) 已从热点列表里移出。
- [src/components/Stats.tsx](D:/agent_project/claude-code-reforged/src/components/Stats.tsx) 已从热点列表里移出。
- [src/utils/queryHelpers.ts](D:/agent_project/claude-code-reforged/src/utils/queryHelpers.ts) 已从热点列表里移出。
- [src/services/compact/microCompact.ts](D:/agent_project/claude-code-reforged/src/services/compact/microCompact.ts) 已从热点列表里移出。
- [src/services/compact/compact.ts](D:/agent_project/claude-code-reforged/src/services/compact/compact.ts) 已从热点列表里移出。
- [src/screens/Doctor.tsx](D:/agent_project/claude-code-reforged/src/screens/Doctor.tsx) 已从热点列表里移出。
- [src/components/permissions/PermissionExplanation.tsx](D:/agent_project/claude-code-reforged/src/components/permissions/PermissionExplanation.tsx) 已从热点列表里移出。
- [src/components/mcp/MCPSettings.tsx](D:/agent_project/claude-code-reforged/src/components/mcp/MCPSettings.tsx) 已从热点列表里移出。
- 它这轮补齐了一个新模式：当 schema 允许的合法态比当前 UI 已建模态更宽时，未建模合法态必须显式提示 `unsupported`，不能默认坍缩进现有分支，也不能把“准备完成但无可展示项”误判成 loading。
- [src/components/Messages.tsx](D:/agent_project/claude-code-reforged/src/components/Messages.tsx) 已从热点列表里移出。
- 它这轮补齐了另一个新模式：当全局消息联合落后于当前渲染流水线引入的本地消息变体（如 `grouped_tool_use` / `collapsed_read_search`）时，优先在消费文件内建立本地 pipeline 联合、uuid 视图和最小边界桥接，而不是删掉真实渲染分支或直接放宽全局类型。
- [src/commands/plugin/PluginSettings.tsx](D:/agent_project/claude-code-reforged/src/commands/plugin/PluginSettings.tsx) 已从热点列表里移出。
- 它这轮补齐了一个新模式：当插件错误、安装状态或错误计数属于 malformed / unavailable 时，必须显式显示 `invalid / unavailable`，不能伪装成“没有错误”。
- [src/services/api/client.ts](D:/agent_project/claude-code-reforged/src/services/api/client.ts) 已从热点列表里移出。
- 它这轮补齐了一个新模式：当同一认证链路存在“跳过认证（skipAuth）”和“Bearer token”两条可能冲突的开关时，必须显式定义优先级，禁止落成 `skipAuth=true + Authorization` 的互斥组合。
- [src/components/Spinner.tsx](D:/agent_project/claude-code-reforged/src/components/Spinner.tsx) 已从热点列表里移出。
- 它这轮补齐了一个新模式：当 store hook 在恢复态里丢失 selector 泛型导致返回 `unknown` 时，优先在消费文件内加“本地 typed selector wrapper”收口，避免全局放宽或到处断言。
- [src/components/PromptInput/PromptInputFooterLeftSide.tsx](D:/agent_project/claude-code-reforged/src/components/PromptInput/PromptInputFooterLeftSide.tsx) 已从热点列表里移出。
- 它这轮补齐了一个新模式：当编译期常量分支在恢复态里触发恒真假比较报错时，可通过“编译期常量保持运行值不变 + 类型标注为 wider type”避免类型系统把分支提前折叠成死分支。
- [src/components/messageActions.tsx](D:/agent_project/claude-code-reforged/src/components/messageActions.tsx) 已从热点列表里移出。
- 它这轮补齐了一个新模式：消费侧本地 pipeline 类型里的子消息形状必须对齐真实生产端（例如 grouped 的 `messages` 应是 assistant 消息），不能为压类型错误而写“可编译但不真实”的占位形状。
- [src/components/MessageRow.tsx](D:/agent_project/claude-code-reforged/src/components/MessageRow.tsx) 已从热点列表里移出。
- 它这轮补齐了一个新模式：当 grouped/collapsed 分支已被上游真实引入但全局联合未及时跟上时，先在渲染消费文件内维持本地 pipeline 联合闭环，避免跨文件不一致导致的 `never` 链。
- [src/utils/model/bedrock.ts](D:/agent_project/claude-code-reforged/src/utils/model/bedrock.ts) 已从热点列表里移出。
- 它这轮补齐了一个新模式：SDK shim 不能只覆盖单一主文件，必须回溯所有真实消费点（含 `tokenEstimation.ts`）补齐最小契约，同时清理 `[key: string]: unknown` 这类过宽签名。
- [src/components/TeammateViewHeader.tsx](D:/agent_project/claude-code-reforged/src/components/TeammateViewHeader.tsx) 已从热点列表里移出。
- 它这轮补齐了一个新模式：当 selector 返回 `unknown` 且渲染仅依赖有限字段时，优先在消费文件内用“最小视图类型 + runtime guard + 本地 typed wrapper”收口，不放宽全局状态类型。
- [src/tools/FileWriteTool/UI.tsx](D:/agent_project/claude-code-reforged/src/tools/FileWriteTool/UI.tsx) 已从热点列表里移出。
- 它这轮补齐了一个新模式：对异步结果的判别 guard 不能只检查“字段存在”，必须覆盖判别式枚举值与分支消费字段（如 update 的 patch/oldContent），避免 malformed 数据被伪装成正常渲染分支。
- [src/services/oauth/client.ts](D:/agent_project/claude-code-reforged/src/services/oauth/client.ts) 已从热点列表里移出。
- 它这轮补齐了一个新模式：外部响应写入配置前，必填身份字段必须 fail-closed；可选字段必须区分 `null`（合法覆盖）与 `undefined`（malformed 跳过），避免把脏数据写成“成功更新”。
- [src/components/messages/AttachmentMessage.tsx](D:/agent_project/claude-code-reforged/src/components/messages/AttachmentMessage.tsx) 已从热点列表里移出。
- 它这轮补齐了一个新模式：本地 guard 必须与真实类型契约一致（如可选字段不能误收紧为必填），否则会把合法态误判成降级分支，造成渲染语义回归。
- [src/services/tips/tipRegistry.ts](D:/agent_project/claude-code-reforged/src/services/tips/tipRegistry.ts) 已从热点列表里移出。
- 它这轮补齐了一个新模式：当运行时已有可判定的类类型（如 `FileStateCache`）时，优先用 `instanceof` 收口，避免“仅凭同名方法存在”导致的过宽伪装。
- [src/services/tools/toolExecution.ts](D:/agent_project/claude-code-reforged/src/services/tools/toolExecution.ts) 已从热点列表里移出。
- 它这轮补齐了一个新模式：UUID 透传链必须在入口统一 `validateUuid`，非法值应 fail-closed 为 `undefined`，禁止用模板字面量断言伪装合法 UUID。
- [src/utils/plugins/pluginInstallationHelpers.ts](D:/agent_project/claude-code-reforged/src/utils/plugins/pluginInstallationHelpers.ts) 已从热点列表里移出。
- 它这轮补齐了一个新模式：插件安装失败链路优先通过“判别式失败联合守卫”收口，再统一映射用户可读错误，避免失败分支字段访问散落断言。
- 下一步先完成 [src/hooks/useTypeahead.tsx](D:/agent_project/claude-code-reforged/src/hooks/useTypeahead.tsx)，随后继续 [src/utils/notebook.ts](D:/agent_project/claude-code-reforged/src/utils/notebook.ts)。

## 5. 修复原则

后续所有 TODO 都默认遵循下面这些规则：

1. 原样恢复优先  
   能按原逻辑恢复的，优先恢复原逻辑，不为了省事改语义。

2. 等价重构兜底  
   原样恢复不了的，在充分理解原逻辑后做等价实现，不改变输入输出和状态转移语义。

3. 显式不可用，不假成功  
   缺入口、缺对话框、缺服务能力时，优先显式不可用或可见降级，不做 no-op、空对象、空数组式假成功。

4. 公共类型保守  
   不轻易放宽公共类型；优先在消费文件里做本地最小可信 adapter / guard。

5. 大文件切片推进  
   按“明确文件 + 明确行段 + 明确错误类型”拆成小刀，不整文件硬扑。

6. 固定协作流  
   修复线程改代码  
   审查线程完整逐文件审查  
   主线程做调度、纠偏、裁决和汇总

## 6. 当前修复顺序

### 6.1 正在执行

1. [src/hooks/useTypeahead.tsx](D:/agent_project/claude-code-reforged/src/hooks/useTypeahead.tsx)
   目标：收敛通用渲染链第一梯队热点，按“最小可信视图 + runtime guard + fail-closed”完成第一刀。
   当前动作：[src/utils/teleport.tsx](D:/agent_project/claude-code-reforged/src/utils/teleport.tsx) 已闭环通过审查，主线切到 useTypeahead。

### 6.2 下一组：通用渲染链

2. [src/utils/notebook.ts](D:/agent_project/claude-code-reforged/src/utils/notebook.ts)

原因：

- `useTypeahead.tsx` 收敛后，`notebook.ts` 与交互/数据链共享同类类型收口模式。
- 这一组适合复用“最小可信视图 + runtime guard + fail-closed”的收口模式。

### 6.3 已闭环归档（本轮）

5. [src/entrypoints/cli.tsx](D:/agent_project/claude-code-reforged/src/entrypoints/cli.tsx)

6. [src/cli/bg.ts](D:/agent_project/claude-code-reforged/src/cli/bg.ts)

7. [src/cli/handlers/templateJobs.ts](D:/agent_project/claude-code-reforged/src/cli/handlers/templateJobs.ts)

8. [src/environment-runner/main.ts](D:/agent_project/claude-code-reforged/src/environment-runner/main.ts)

9. [src/self-hosted-runner/main.ts](D:/agent_project/claude-code-reforged/src/self-hosted-runner/main.ts)

原因：

- 这一组已完成“缺导出不静默成功、占位入口显式抛错、入口链去可选壳层”的闭环收口。
- 后续进入真实功能恢复时，直接在桥接入口中替换占位实现即可。

### 6.4 第四组：通用渲染链

7. [src/components/StructuredDiff.tsx](D:/agent_project/claude-code-reforged/src/components/StructuredDiff.tsx)

8. [src/ink/ink.tsx](D:/agent_project/claude-code-reforged/src/ink/ink.tsx)

9. [src/utils/teleport.tsx](D:/agent_project/claude-code-reforged/src/utils/teleport.tsx)

原因：

- 这三处都在 8-error 梯队，且属于通用渲染基础链，适合成组推进。

### 6.5 第五组：Bridge / Auth / 协议接入链

10. [src/bridge/remoteBridgeCore.ts](D:/agent_project/claude-code-reforged/src/bridge/remoteBridgeCore.ts)

11. [src/bridge/replBridge.ts](D:/agent_project/claude-code-reforged/src/bridge/replBridge.ts)

12. [src/cli/handlers/auth.ts](D:/agent_project/claude-code-reforged/src/cli/handlers/auth.ts)

13. [src/cli/handlers/mcp.tsx](D:/agent_project/claude-code-reforged/src/cli/handlers/mcp.tsx)

14. [src/cli/structuredIO.ts](D:/agent_project/claude-code-reforged/src/cli/structuredIO.ts)

原因：

- 这批仍然涉及协议边界、Bridge 接入、Auth、MCP 细节。
- 适合在默认交互主链和运行时主链继续收稳后再整体推进。

## 7. 当前 TODO 列表

### 7.1 已完成

- [x] 工程骨架恢复
- [x] 宏与构建适配基础层
- [x] 第一批桥接入口补齐
- [x] [src/screens/REPL.tsx](D:/agent_project/claude-code-reforged/src/screens/REPL.tsx)
- [x] [src/cli/print.ts](D:/agent_project/claude-code-reforged/src/cli/print.ts)
- [x] [src/components/PromptInput/PromptInput.tsx](D:/agent_project/claude-code-reforged/src/components/PromptInput/PromptInput.tsx)
- [x] [src/components/messages/CollapsedReadSearchContent.tsx](D:/agent_project/claude-code-reforged/src/components/messages/CollapsedReadSearchContent.tsx)
- [x] [src/utils/collapseReadSearch.ts](D:/agent_project/claude-code-reforged/src/utils/collapseReadSearch.ts)
- [x] [src/components/Settings/Config.tsx](D:/agent_project/claude-code-reforged/src/components/Settings/Config.tsx)
- [x] [src/tools/AgentTool/UI.tsx](D:/agent_project/claude-code-reforged/src/tools/AgentTool/UI.tsx)
- [x] [src/main.tsx](D:/agent_project/claude-code-reforged/src/main.tsx)
- [x] [src/keybindings/defaultBindings.ts](D:/agent_project/claude-code-reforged/src/keybindings/defaultBindings.ts)
- [x] [src/services/api/claude.ts](D:/agent_project/claude-code-reforged/src/services/api/claude.ts)
- [x] [src/QueryEngine.ts](D:/agent_project/claude-code-reforged/src/QueryEngine.ts)
- [x] [src/commands/plugin/ManagePlugins.tsx](D:/agent_project/claude-code-reforged/src/commands/plugin/ManagePlugins.tsx) 第一刀
- [x] [src/commands/plugin/ManagePlugins.tsx](D:/agent_project/claude-code-reforged/src/commands/plugin/ManagePlugins.tsx) 第二刀
- [x] [src/commands/plugin/ManagePlugins.tsx](D:/agent_project/claude-code-reforged/src/commands/plugin/ManagePlugins.tsx) 第三刀
- [x] [src/tools/AgentTool/AgentTool.tsx](D:/agent_project/claude-code-reforged/src/tools/AgentTool/AgentTool.tsx) 第一刀
- [x] [src/tools/AgentTool/AgentTool.tsx](D:/agent_project/claude-code-reforged/src/tools/AgentTool/AgentTool.tsx) 第二刀
- [x] [src/tools/AgentTool/AgentTool.tsx](D:/agent_project/claude-code-reforged/src/tools/AgentTool/AgentTool.tsx) 第三刀
- [x] [src/components/agents/new-agent-creation/wizard-steps/ConfirmStep.tsx](D:/agent_project/claude-code-reforged/src/components/agents/new-agent-creation/wizard-steps/ConfirmStep.tsx) 第一刀
- [x] [src/components/tasks/BackgroundTasksDialog.tsx](D:/agent_project/claude-code-reforged/src/components/tasks/BackgroundTasksDialog.tsx) 第一刀（整文件闭环）
- [x] [src/components/Stats.tsx](D:/agent_project/claude-code-reforged/src/components/Stats.tsx) 第一刀（整文件闭环）
- [x] [src/utils/queryHelpers.ts](D:/agent_project/claude-code-reforged/src/utils/queryHelpers.ts) 第一刀（整文件闭环）
- [x] [src/services/compact/microCompact.ts](D:/agent_project/claude-code-reforged/src/services/compact/microCompact.ts) 第一刀（整文件闭环）
- [x] [src/services/compact/compact.ts](D:/agent_project/claude-code-reforged/src/services/compact/compact.ts) 第一刀（整文件闭环）
- [x] [src/screens/Doctor.tsx](D:/agent_project/claude-code-reforged/src/screens/Doctor.tsx) 第一刀（整文件闭环）
- [x] [src/components/permissions/PermissionExplanation.tsx](D:/agent_project/claude-code-reforged/src/components/permissions/PermissionExplanation.tsx) 第一刀（整文件闭环）
- [x] [src/components/mcp/MCPSettings.tsx](D:/agent_project/claude-code-reforged/src/components/mcp/MCPSettings.tsx) 第一刀（整文件闭环）
- [x] [src/components/Messages.tsx](D:/agent_project/claude-code-reforged/src/components/Messages.tsx) 第一刀（整文件闭环）
- [x] [src/commands/plugin/PluginSettings.tsx](D:/agent_project/claude-code-reforged/src/commands/plugin/PluginSettings.tsx) 第一刀（整文件闭环）
- [x] [src/services/api/client.ts](D:/agent_project/claude-code-reforged/src/services/api/client.ts) 第一刀（整文件闭环）
- [x] [src/components/Spinner.tsx](D:/agent_project/claude-code-reforged/src/components/Spinner.tsx) 第一刀（整文件闭环）
- [x] [src/components/PromptInput/PromptInputFooterLeftSide.tsx](D:/agent_project/claude-code-reforged/src/components/PromptInput/PromptInputFooterLeftSide.tsx) 第一刀（整文件闭环）
- [x] [src/components/messageActions.tsx](D:/agent_project/claude-code-reforged/src/components/messageActions.tsx) 第一刀（整文件闭环）
- [x] [src/components/MessageRow.tsx](D:/agent_project/claude-code-reforged/src/components/MessageRow.tsx) 第一刀（整文件闭环）
- [x] [src/utils/model/bedrock.ts](D:/agent_project/claude-code-reforged/src/utils/model/bedrock.ts) 第一刀（整文件闭环）
- [x] [src/types/third-party-sdk-shims.d.ts](D:/agent_project/claude-code-reforged/src/types/third-party-sdk-shims.d.ts) 第一刀（整文件闭环）
- [x] [src/components/TeammateViewHeader.tsx](D:/agent_project/claude-code-reforged/src/components/TeammateViewHeader.tsx) 第一刀（整文件闭环）
- [x] [src/tools/FileWriteTool/UI.tsx](D:/agent_project/claude-code-reforged/src/tools/FileWriteTool/UI.tsx) 第一刀（整文件闭环）
- [x] [src/services/oauth/client.ts](D:/agent_project/claude-code-reforged/src/services/oauth/client.ts) 第一刀（整文件闭环）
- [x] [src/components/messages/AttachmentMessage.tsx](D:/agent_project/claude-code-reforged/src/components/messages/AttachmentMessage.tsx) 第一刀（整文件闭环）
- [x] [src/services/tips/tipRegistry.ts](D:/agent_project/claude-code-reforged/src/services/tips/tipRegistry.ts) 第一刀（整文件闭环）
- [x] [src/services/tools/toolExecution.ts](D:/agent_project/claude-code-reforged/src/services/tools/toolExecution.ts) 第一刀（整文件闭环）
- [x] [src/utils/plugins/pluginInstallationHelpers.ts](D:/agent_project/claude-code-reforged/src/utils/plugins/pluginInstallationHelpers.ts) 第一刀（整文件闭环）
- [x] [src/components/LogoV2/LogoV2.tsx](D:/agent_project/claude-code-reforged/src/components/LogoV2/LogoV2.tsx) 第一刀（整文件闭环）
- [x] [src/components/LogoV2/CondensedLogo.tsx](D:/agent_project/claude-code-reforged/src/components/LogoV2/CondensedLogo.tsx) 第一刀（整文件闭环）
- [x] [src/components/permissions/rules/PermissionRuleList.tsx](D:/agent_project/claude-code-reforged/src/components/permissions/rules/PermissionRuleList.tsx) 第一刀（整文件闭环）
- [x] [src/components/permissions/NotebookEditPermissionRequest/NotebookEditToolDiff.tsx](D:/agent_project/claude-code-reforged/src/components/permissions/NotebookEditPermissionRequest/NotebookEditToolDiff.tsx) 第一刀（整文件闭环）
- [x] [src/services/plugins/pluginOperations.ts](D:/agent_project/claude-code-reforged/src/services/plugins/pluginOperations.ts) 第一刀（整文件闭环）
- [x] [src/services/mcp/client.ts](D:/agent_project/claude-code-reforged/src/services/mcp/client.ts) 第一刀（整文件闭环）
- [x] [src/services/mcp/auth.ts](D:/agent_project/claude-code-reforged/src/services/mcp/auth.ts) 第一刀（整文件闭环）
- [x] [src/entrypoints/cli.tsx](D:/agent_project/claude-code-reforged/src/entrypoints/cli.tsx) 第一刀（整文件闭环）
- [x] [src/cli/bg.ts](D:/agent_project/claude-code-reforged/src/cli/bg.ts) 第一刀（桥接入口补齐）
- [x] [src/cli/handlers/templateJobs.ts](D:/agent_project/claude-code-reforged/src/cli/handlers/templateJobs.ts) 第一刀（桥接入口补齐）
- [x] [src/environment-runner/main.ts](D:/agent_project/claude-code-reforged/src/environment-runner/main.ts) 第一刀（桥接入口补齐）
- [x] [src/self-hosted-runner/main.ts](D:/agent_project/claude-code-reforged/src/self-hosted-runner/main.ts) 第一刀（桥接入口补齐）
- [x] [src/commands/insights.ts](D:/agent_project/claude-code-reforged/src/commands/insights.ts) 第一刀（整文件闭环）
- [x] [src/components/StructuredDiff.tsx](D:/agent_project/claude-code-reforged/src/components/StructuredDiff.tsx) 第一刀（整文件闭环）
- [x] [src/ink/ink.tsx](D:/agent_project/claude-code-reforged/src/ink/ink.tsx) 第一刀（整文件闭环）
- [x] [src/utils/teleport.tsx](D:/agent_project/claude-code-reforged/src/utils/teleport.tsx) 第一刀（整文件闭环）

### 7.2 当前进行中

- [ ] [src/hooks/useTypeahead.tsx](D:/agent_project/claude-code-reforged/src/hooks/useTypeahead.tsx) 第一刀
  当前目标：扫清通用渲染链第一梯队停点，按最小可信视图 + runtime guard + fail-closed 模式完成第一刀

### 7.3 下一步待做

- [ ] [src/utils/notebook.ts](D:/agent_project/claude-code-reforged/src/utils/notebook.ts)

## 8. 备注

1. 当前排序不是纯按报错数高低排，而是综合：
   - 是否属于当前主链
   - 是否和已修文件强相关
   - 是否容易造成回归
   - 是否适合继续沿用当前可信视图 / 本地 adapter 模式

2. 如果后续某个文件在修复过程中引出强关联文件，可在不打乱当前阶段目标的前提下，把同领域文件前移。

3. 原则上，当前主线文件未闭环通过前，不切到下一个新热点文件。
4. 每轮审查线程结束后，必须同步更新本文件中的：
   - 已完成主链
   - 当前主线停点
   - 当前修复顺序
   - 当前 TODO 列表
