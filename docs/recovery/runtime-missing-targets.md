# CCR 剩余运行时缺失目标清单

扫描日期：2026-04-27

## 1. 当前结论

`require is not defined` 这一类 ESM 裸 `require(...)` 问题已经清零。当前剩余问题不是桥接缺失，而是部分 `require('...')` 指向的模块或运行时依赖本身还没有恢复。

最新扫描结果：

- 本地缺失目标：25 个。
- 专有 / 运行时边界依赖：3 个。
- 已新增 `npm.cmd run audit:runtime-targets` 作为机器审计入口；默认只输出 JSON，不因已知缺口失败。
- `yolo-classifier-prompts/*.txt` 已补为 CCR 自研兼容 prompt，不再计入缺失目标。
- `src/utils/ide.ts` 的 `IdeOnboardingDialog` 相对路径已修复，不再计入缺失目标。
- 旧 `WebBrowserTool` 与 `claude-in-chrome` 运行入口已按“显式退休”处理，不再计入缺失目标；浏览器能力后续走通用 MCP / Playwright MCP。

这些缺失目标大多位于关闭或专有 feature gate 后面，默认 smoke 目前不会触发。但一旦打开对应功能，运行时会因为目标文件不存在而失败。因此后续修复重点应从“补 require 桥”切换为“恢复/替换/禁用缺失功能入口”。

## 2. 修复原则

后续处理这些缺失目标时，不要简单补空文件。

必须逐项判断：

- 这是 CCR 第一版要保留的真实能力，还是 Anthropic 内部 / 专有能力。
- 是否能从当前仓库、合法公开实现、或我们自己的通用 LLM 架构中重构出来。
- 如果暂不实现，是否应该保持 feature gate 默认关闭，并给出明确降级。
- 如果补 stub，必须保证不会悄悄注册一个“看起来能用、实际无效”的工具或命令。
- 安全敏感工具、外部发布、远程触发、浏览器、终端捕获、workflow 等能力，不能只靠空实现糊过去。

一句话：能恢复就恢复；不能恢复就显式禁用或做 CCR 自己的替代实现；不要伪装成已恢复。

## 3. 功能认知边界

当前我们能比较确定的是：这些缺失入口在系统里的注册位置、触发 feature gate、大致产品意图和风险边界。不能假装已经知道每个缺失模块的原始内部实现。

后续每处理一个缺失目标，都要先标注“认知确定度”：

- `确定`：现有源码中有足够调用链、类型、常量、工具协议或相邻实现，可以直接自研恢复。
- `半确定`：能判断功能方向，但关键行为、输出协议或副作用边界仍缺，需要先做设计再实现。
- `不应猜测`：看起来是 Anthropic 内部、Kairos 专有、远程控制、外部账号、UI 提示或高风险副作用能力；没有合法依据前不恢复原样。

当前分类口径：

| 处理口径 | 适用目标 | 说明 |
| --- | --- | --- |
| 保留并自研恢复 | `SleepTool`、`VerifyPlanExecutionTool`、`SnipTool` / `force-snip` | 与 CCR/harness 主线有关，有机会做成我们自己的能力 |
| 替换成 CCR 设计 | 模型切换 UI、workflow、browser MCP | 不恢复原 Anthropic/Kairos 口径，改成 CCR provider/model/workflow/browser MCP 边界 |
| 保持关闭 | ant-only、Kairos-only、远程控制、PR 订阅、推送通知 | 默认 feature gate 关闭，避免假恢复 |
| 显式 unavailable | 短期可能被 feature 打开的入口 | 如果必须补入口，只能返回明确不可用/未实现，不能静默假成功 |

对照 `cc-haha-main` 和 `cc-ok` 的结论也要保留：

- `cc-haha-main` 是批量 stub 堵洞，能让缺失目标数量归零，但不能证明功能真实恢复。
- `cc-ok` 是工作台式扫描/提示，部分 tiny no-op 入口能避免崩溃，但没有解决工具注册表的大部分真实能力。
- CCR 不采用“批量 stub 假恢复”作为主策略；更适合采用“审计门禁 + 分级恢复 + 显式降级”。

## 4. 本地缺失目标：工具注册表

来源文件：[src/tools.ts](D:/agent_project/claude-code-reforged/src/tools.ts)

这是优先级最高的一组，因为工具注册表直接影响模型可调用能力。当前缺失 12 个目标。

| 缺失目标 | 触发条件 | 影响 | 建议处理 |
| --- | --- | --- | --- |
| `./tools/REPLTool/REPLTool.js` | `USER_TYPE === 'ant'` 或 REPL mode | 内部 REPL 工具不可用 | 第一版不要按原内部实现恢复；后续如需要，设计 CCR 自己的 sandbox REPL |
| `./tools/SuggestBackgroundPRTool/SuggestBackgroundPRTool.js` | `USER_TYPE === 'ant'` | 后台 PR 建议工具不可用 | 暂不恢复；保持 ant-only 关闭 |
| `./tools/SleepTool/SleepTool.js` | `PROACTIVE` 或 `KAIROS` | agent loop 睡眠/延迟工具不可用 | 可优先补 CCR 自研轻量实现，风险较低 |
| `./tools/SendUserFileTool/SendUserFileTool.js` | `KAIROS` | 向用户发送文件工具不可用 | 需要结合 CCR 输出通道设计，暂不空补 |
| `./tools/PushNotificationTool/PushNotificationTool.js` | `KAIROS` 或 `KAIROS_PUSH_NOTIFICATION` | 推送通知不可用 | 依赖桌面/系统通知方案，暂不恢复 |
| `./tools/SubscribePRTool/SubscribePRTool.js` | `KAIROS_GITHUB_WEBHOOKS` | GitHub PR 订阅不可用 | 依赖 webhook/账号集成，暂不恢复 |
| `./tools/VerifyPlanExecutionTool/VerifyPlanExecutionTool.js` | `CLAUDE_CODE_VERIFY_PLAN=true` | 计划执行验证工具不可用 | 值得后续自研，属于 harness 质量闭环能力 |
| `./tools/CtxInspectTool/CtxInspectTool.js` | `CONTEXT_COLLAPSE` | 上下文检查工具不可用 | 等 context collapse 主线恢复后再补 |
| `./tools/TerminalCaptureTool/TerminalCaptureTool.js` | `TERMINAL_PANEL` | 终端捕获工具不可用 | 需要 Windows/TUI 专项设计，暂不空补 |
| `./tools/SnipTool/SnipTool.js` | `HISTORY_SNIP` | 历史裁剪工具不可用 | 可和 context/compaction 主线一起恢复 |
| `./tools/ListPeersTool/ListPeersTool.js` | `UDS_INBOX` | peer/session 列表工具不可用 | 等 bridge/swarm 主线恢复后再补 |
| `./tools/WorkflowTool/bundled/index.js` | `WORKFLOW_SCRIPTS` | 内置 workflow 初始化缺失 | 需要先定义 CCR workflow 边界，再恢复 |

建议顺序：

1. 先处理 `SleepTool`，它最容易做成安全的 CCR 自研实现。
2. 再处理 `VerifyPlanExecutionTool`，它对 harness 闭环有长期价值。
3. 再处理 `SnipTool` / `CtxInspectTool`，与上下文治理主线相关。
4. 终端捕获、workflow、PR/通知类工具放到专项；浏览器专项改为 Playwright MCP 接入，不再恢复旧 `WebBrowserTool`。

## 5. 本地缺失目标：命令注册表

来源文件：[src/commands.ts](D:/agent_project/claude-code-reforged/src/commands.ts)

当前缺失 7 个命令入口。

| 缺失目标 | 触发条件 | 影响 | 建议处理 |
| --- | --- | --- | --- |
| `./commands/agents-platform/index.js` | `USER_TYPE === 'ant'` | 内部 agents platform 命令不可用 | 不按原内部能力恢复；如需要，另做 CCR agents 命令 |
| `./commands/proactive.js` | `PROACTIVE` 或 `KAIROS` | proactive 命令不可用 | 等 proactive 主线明确后再补 |
| `./commands/assistant/index.js` | `KAIROS` | assistant 命令不可用 | 当前 CCR 不优先恢复 |
| `./commands/remoteControlServer/index.js` | `DAEMON` 且 `BRIDGE_MODE` | 远程控制服务命令不可用 | 安全敏感，必须专项设计 |
| `./commands/force-snip.js` | `HISTORY_SNIP` | 强制 snip 命令不可用 | 与 SnipTool/context 主线一起补 |
| `./commands/subscribe-pr.js` | `KAIROS_GITHUB_WEBHOOKS` | PR 订阅命令不可用 | 等 GitHub webhook 方案再处理 |
| `./commands/torch.js` | `TORCH` | 内部/实验命令不可用 | 暂不恢复，保持 feature gate 关闭 |

建议顺序：

1. `force-snip` 跟随 `SnipTool` 一起恢复。
2. `proactive` 等长期运行/自动任务主线明确后再恢复。
3. `remoteControlServer` 必须最后处理，并且要有认证、权限和本地监听边界设计。

## 6. 本地缺失目标：TUI / REPL 辅助入口

来源文件：[src/screens/REPL.tsx](D:/agent_project/claude-code-reforged/src/screens/REPL.tsx)

当前缺失 3 个目标。

| 缺失目标 | 触发条件 | 影响 | 建议处理 |
| --- | --- | --- | --- |
| `../proactive/useProactive.js` | `PROACTIVE` 或 `KAIROS` | TUI proactive hook 不可用 | 跟随 proactive 主线恢复 |
| `../components/AntModelSwitchCallout.js` | `COMPILE_TIME_USER_TYPE === 'ant'` | Anthropic 内部模型切换提示不可用 | CCR 不应恢复 ant-only UI；应替换成 CCR provider/model 切换设计 |
| `../components/UndercoverAutoCallout.js` | `COMPILE_TIME_USER_TYPE === 'ant'` | Anthropic 内部 undercover 提示不可用 | 不恢复；如需类似能力，应转成 CCR 自己的敏感信息防泄漏提示 |

这里要特别注意：`AntModelSwitchCallout` 不应该原样恢复。CCR 已经转向通用 LLM / Codex OAuth，后续模型切换应该走 CCR 的 provider/model 配置 UI。

## 7. 本地缺失目标：内置 Skill

来源文件：[src/skills/bundled/index.ts](D:/agent_project/claude-code-reforged/src/skills/bundled/index.ts)

当前缺失 3 个目标。

| 缺失目标 | 触发条件 | 影响 | 建议处理 |
| --- | --- | --- | --- |
| `./dream.js` | `KAIROS` 或 `KAIROS_DREAM` | dream skill 不可用 | 暂不恢复；需要先定义 CCR 长期记忆/反思策略 |
| `./hunter.js` | `REVIEW_ARTIFACT` | bug hunter / review artifact skill 不可用 | 可后续自研，和审查线程流程结合 |
| `./runSkillGenerator.js` | `RUN_SKILL_GENERATOR` | skill 生成器不可用 | 暂不恢复；等 CCR skill 规范稳定后再做 |

建议顺序：

1. 先考虑 `hunter`，因为和我们当前“修复 + 审查”流程最贴近。
2. `dream` 必须等长期记忆架构确定。
3. `runSkillGenerator` 必须等 skill 格式、权限、输出目录都稳定。

## 8. 专有 / 运行时边界依赖

这 3 个不属于本地文件缺失，而是外部依赖或运行时不兼容问题。

处理原则：

- 不把 `@ant/*` 当成普通 npm 依赖安装。
- 不为了压错误补一个伪装成功的实现。
- 默认 CCR Node 24 主线必须不加载这些依赖。
- 如果 feature 被误开启，应返回清晰的 unavailable / unsupported，而不是在深层 `require(...)` 处崩溃。
- 后续如果要恢复同类能力，优先换成 CCR 自己的 provider 边界或公开生态方案。

| 文件 | 缺失依赖 | 类型 | 建议处理 |
| --- | --- | --- | --- |
| [src/utils/computerUse/inputLoader.ts](D:/agent_project/claude-code-reforged/src/utils/computerUse/inputLoader.ts) | `@ant/computer-use-input` | Anthropic 专有/平台包 | 不安装；保持 `CHICAGO_MCP=false` 默认关闭；后续如做 computer-use，接公开方案 |
| [src/utils/computerUse/swiftLoader.ts](D:/agent_project/claude-code-reforged/src/utils/computerUse/swiftLoader.ts) | `@ant/computer-use-swift` | Anthropic 专有/macOS 包 | 不安装；Windows 当前不恢复；macOS computer-use 需另开专项 |
| [src/upstreamproxy/upstreamproxy.ts](D:/agent_project/claude-code-reforged/src/upstreamproxy/upstreamproxy.ts) | `bun:ffi` | Bun-only 运行时模块 | 不改成 Node 依赖；保留 `process.platform === 'linux' && typeof Bun !== 'undefined'` 保护；如恢复需独立 Bun/容器专项 |

这些不要作为下一轮主线。默认 CCR Node 24 主线应保证它们不被触发。

后续验证要求：

- 审计脚本应把这 3 个列为 `specialExternal`，不要和本地缺失文件混在一起。
- 当前审计脚本入口：`npm.cmd run audit:runtime-targets`；需要可读文本时使用 `npm.cmd run audit:runtime-targets -- --text`。
- smoke 应验证默认 Node 24 下 `CHICAGO_MCP=false`、upstream proxy 未启用时不会加载 `@ant/*` 或 `bun:ffi`。
- 旧 Chrome MCP 不再开启；浏览器能力统一通过通用 MCP 配置接入，优先 Playwright MCP。
- 如果未来开启 computer-use，必须先完成 provider 边界、平台边界和权限模型设计。

## 9. 下一轮建议

优先做“工具注册表缺失目标”的可执行拆解。

建议下一轮只处理一组：

1. `SleepTool`：补 CCR 自研轻量工具，验证注册、schema、权限、安全行为。
2. `VerifyPlanExecutionTool`：如果用户希望先补 harness 闭环能力，可以优先做这个，但设计成本更高。
3. `SnipTool` + `force-snip`：如果下一阶段转向上下文治理，则一起做。

不建议下一轮直接碰：

- 旧 `WebBrowserTool`：已退休；下一步应补 Playwright MCP 预设 / 示例 / smoke。
- `TerminalCaptureTool`：涉及终端状态采集和 Windows/TUI 边界。
- `remoteControlServer`：远程控制安全边界太重。
- `AntModelSwitchCallout`：应该替换成 CCR provider/model UI，而不是恢复 Anthropic 内部提示。

## 10. 验收标准

每修一组都要至少通过：

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run build -- --pretty false
npm.cmd run ci:smoke
git diff --check
```

如果新增工具或命令，还要补专项 smoke，至少验证：

- 默认 feature gate 关闭时不会注册。
- feature gate 开启时不会因为缺模块崩溃。
- 工具/命令被调用时有明确返回，不静默假成功。
- 如果能力未实现，必须返回清晰的 unavailable / not implemented，而不是让模型误以为已经完成。
