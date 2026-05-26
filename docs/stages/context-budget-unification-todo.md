# CCR 上下文预算统一治理 Todo

## 总目标约束

本 TODO 必须遵守总 goal：[STD-RUNTIME-01 上下文预算统一治理](../goals/2026-05-26-std-runtime-01-context-budget-unification.md)。

关键约束：

- 不允许只修 Desktop 顶部显示来掩盖运行态错误。
- 不允许只对 DeepSeek 做硬编码特判。
- 不允许继续把旧 `getContextWindowForModel(model)` 当作 CCR 多 provider 主路径权威来源。
- 不允许各调用点自行计算 `contextWindow - reserved - buffer`。
- 所有迁移调用点必须说明它消费的是 `totalContextWindow`、`effectiveInputWindow` 还是 `autoCompactThreshold`。

## 目标

把 CCR 里“上下文最大长度 / 可输入窗口 / 自动压缩阈值 / 附件预算 / 工具搜索预算”等所有上下文预算计算统一到同一个权威入口，避免再次出现：

- 模型下拉显示 `1000K`，顶部显示 `180K`。
- 顶部显示 `1000K`，但会话在 `168K` 左右自动压缩。
- 新 provider 的模型目录已经配置正确，但旧压缩、分析、附件预算仍按 `200K` 默认值运行。

本文只规划修改方案和 TODO，不代表已开始实现。

## 当前问题结论

当前代码里至少存在三套上下文窗口来源：

1. 新 LLM 模型目录：`modelCatalogEntry.contextWindow`
   - DeepSeek V4 Flash / Pro 在这里是 `1_000_000`。
   - Desktop 模型下拉的 `1000K` 来自这里。

2. 旧上下文解析器：`getContextWindowForModel(model)`
   - 只拿 `model` 字符串，不知道 provider / profile。
   - 不看新 LLM 模型目录。
   - DeepSeek 不命中时回落 `MODEL_CONTEXT_WINDOW_DEFAULT = 200_000`。

3. 压缩有效窗口：`getEffectiveContextWindowSize(model)`
   - 基于旧 `getContextWindowForModel(model)`。
   - 再扣 `20_000` 摘要输出预留。
   - 自动压缩阈值再扣 `13_000` 缓冲，所以 DeepSeek 会误触发在约 `167K`。

核心根因不是 model 被切成了默认 model，而是“当前 model 正确，但上下文窗口 resolver 用错了来源”。

## 统一后的概念模型

后续统一使用以下层级，不允许各处自行发明口径：

- `totalContextWindow`：模型总上下文窗口。
  - 权威来源：当前 `provider/profile/model` 对应的 `modelCatalogEntry.contextWindow`。

- `maxOutputTokens`：模型最大输出 token。
  - 权威来源：当前 `provider/profile/model` 对应的 `modelCatalogEntry.maxOutputTokens`，或兼容旧 Claude 模型输出上限。

- `reservedOutputTokens`：运行时为输出或压缩摘要预留的 token。
  - 第一口径：按具体用途计算，例如压缩摘要最多预留 `20_000`。

- `effectiveInputWindow`：实际可输入上下文窗口。
  - 计算：`totalContextWindow - reservedOutputTokens`。

- `autoCompactThreshold`：自动压缩触发阈值。
  - 计算：`effectiveInputWindow - AUTOCOMPACT_BUFFER_TOKENS`。

- `blockingLimit`：阻塞或强提醒阈值。
  - 计算：基于 `effectiveInputWindow` 和手动压缩缓冲。

- `usedContextTokens`：当前会话已使用 token。
  - 来源：会话估算或 provider usage，不和窗口大小来源混在一起。

## 唯一权威入口方案

新增或收敛到一个上下文预算解析入口，例如：

```ts
resolveRuntimeContextBudget(input)
```

建议返回结构：

```ts
{
  providerId,
  profileId,
  model,
  totalContextWindow,
  maxOutputTokens,
  reservedOutputTokens,
  effectiveInputWindow,
  autoCompactThreshold,
  warningThreshold,
  errorThreshold,
  blockingLimit,
  source,
}
```

入口要求：

- 必须优先基于当前 LLM config 解析 `provider/profile/model`。
- 必须优先读取 `modelCatalogEntry.contextWindow`。
- `resolveRuntimeContextBudget()` 不允许调用旧 `getContextWindowForModel(model)` 推导窗口；缺预算应暴露为目录/配置缺口。
- 所有预算消费者只吃 `ContextBudget` 结果，不再直接拼 `contextWindow - 20_000 - 13_000`。
- 当前运行态必须使用 `resolveRuntimeContextBudget()`；能拿到当前 config/provider/profile 的调用点必须显式传入。
- 只传 `model` 不能作为新运行态、新历史记录、新统计记录的主边界；能拿到当前 config/provider/profile 的地方必须显式传入。

## 当前调用点清单

### 必须迁移

- `src/services/compact/autoCompact.ts`
  - `getEffectiveContextWindowSize(model)`
  - `getAutoCompactThreshold(model)`
  - `calculateTokenWarningState(tokenUsage, model)`
  - 自动压缩真实触发点。
  - 当前 DeepSeek `168K` 自动压缩的直接根因在这里。

- `src/core/sessionCore.ts`
  - `getCompactStatus()`
  - `getContextStatus()`
  - `createInitialTurnMetadata()`
  - 会话运行快照必须输出同一套预算字段。

- `apps/desktop/src/renderer/src/components/layout/Topbar.tsx`
  - 顶部主显示应明确使用 `totalContextWindow`。
  - `effectiveInputWindow`、`autoCompactThreshold` 只进入 tooltip 或详情。
  - 不应把 `compactStatus.effectiveContextWindow` 当成“上下文最大长度”主值。

- `apps/desktop/src/main/index.ts`
  - `refreshRuntimeSnapshots()`
  - `setModel()`
  - 切换模型后必须刷新同一套预算快照。

- `src/core/configCore.ts`
  - `config/get` 快照应直接给出 `llm.contextBudget` 或至少 `llm.contextWindow`。
  - Renderer 不应读一个实际不存在或不稳定的 fallback 字段。

### 需要同步迁移

- `src/utils/analyzeContext.ts`
  - 上下文分析页、占用比例、剩余空间和压缩阈值必须使用统一预算。

- `src/utils/attachments.ts`
  - 技能注入预算。
  - token usage 附件。
  - 1M 模型判断。

- `src/utils/toolSearch.ts`
  - 自动工具搜索阈值。

- `src/utils/swarm/inProcessRunner.ts`
  - 子 agent / swarm 历史压缩阈值。

- `src/components/StatusLine.tsx`
  - TUI 状态栏上下文百分比。

- `src/components/TokenWarning.tsx`
  - TUI token warning。

- `src/components/PromptInput/Notifications.tsx`
  - 输入区 token warning。

- `src/components/permissions/ExitPlanModePermissionRequest/ExitPlanModePermissionRequest.tsx`
  - 计划模式退出时的上下文占用计算。

### 可以保留但必须标注 legacy

- `src/utils/context.ts#getContextWindowForModel(model)`
  - 保留给原 Claude / legacy 运行链路。
  - 需要注释说明：新 CCR LLM provider 链路不得直接依赖它作为权威来源。
  - 新代码如果只能拿到 model 字符串，需要先补 config/provider/profile，而不是继续调用它。

## 当前任务列表

- [x] CB-00 完整调用点盘点
  - 列出所有直接或间接使用 `contextWindow`、`getContextWindowForModel`、`getEffectiveContextWindowSize`、`getAutoCompactThreshold`、`calculateTokenWarningState`、`modelCatalogEntry.contextWindow` 的地方。
  - 按展示、压缩、分析、附件预算、工具预算、TUI、metadata、legacy 分类。
  - 产出“迁移 / 保留 legacy / 删除 fallback”三类清单。

- [x] CB-01 定义 `ContextBudget` 类型和唯一 resolver
  - 定义总窗口、有效输入窗口、自动压缩阈值、warning/error/blocking 阈值。
  - resolver 输入必须能接收当前 LLM config。
  - resolver 内部统一走 `getLlmModelCatalogEntry`。
  - resolver 不再调用旧 model-string 解析器推导窗口；缺预算直接暴露为目录/配置缺口。

- [x] CB-02 改造自动压缩链路
  - `autoCompact.ts` 不再只凭 model 字符串取上下文窗口。
  - 自动压缩阈值使用统一 `ContextBudget.autoCompactThreshold`。
  - DeepSeek 阈值应接近 `1_000_000 - reservedOutputTokens - AUTOCOMPACT_BUFFER_TOKENS`，不再是 `167K`。

- [x] CB-03 改造 Core 会话运行快照
  - `getContextStatus()` 输出 `contextBudget` 或等价字段。
  - `getCompactStatus()` 输出同源预算，不再自行计算另一套窗口。
  - `turnMetadata` 记录实际使用的 provider/profile/model 和预算来源。

- [x] CB-04 改造 Desktop 顶部显示
  - 主显示：`usedContextTokens / totalContextWindow`。
  - tooltip 或详情显示：有效输入窗口、自动压缩阈值、剩余到自动压缩 token。
  - 避免把 `effectiveInputWindow` 显示成“模型最大上下文”。

- [x] CB-05 改造 config/status 快照
  - `config/get` 明确返回当前模型 `contextBudget`。
  - renderer 移除或替换不存在的 `config.llm.contextWindow` fallback。
  - 切换模型后状态快照应立即反映新预算。

- [x] CB-06 迁移上下文分析和附件预算
  - `analyzeContext.ts` 使用统一预算。
  - `attachments.ts` 的技能预算、1M 判断、token usage 附件使用统一预算。
  - 避免 DeepSeek 被误判成非 1M。

- [x] CB-07 迁移工具搜索、TUI 和权限提示
  - `toolSearch.ts` 使用统一预算。
  - `StatusLine.tsx`、`TokenWarning.tsx`、`PromptInput/Notifications.tsx` 使用统一预算或明确 legacy。
  - `ExitPlanModePermissionRequest` 使用统一预算。

- [x] CB-08 清理旧调用和防回归
  - 新 CCR 多 provider 运行链路不得直接调用旧 `getContextWindowForModel(model)`。
  - 对保留的 legacy 调用加注释。
  - 加静态检查或测试覆盖关键调用，避免新代码继续接旧口径。

- [x] CB-09 回归验证
  - DeepSeek V4 Flash / Pro：
    - 模型下拉显示 `1000K`。
    - 顶部主窗口显示 `1000K`。
    - 自动压缩阈值不在 `167K` 附近触发。
    - context analyze 按 1M 计算。
    - 附件预算和 1M 判断按 1M 计算。
  - Kimi / GLM / Codex OAuth：
    - 按各自模型目录显示和计算。
    - 切换模型后顶部和压缩状态同步更新。
  - Claude legacy：
    - 旧 TUI / CLI 入口不破。

## 当前指针

- 当前进行中：CB-09 回归验证
- 当前正在做：等待下一轮真实使用反馈；如发现 provider 特例，再按总 goal 回到统一预算入口处理。
- 完成后下一项：多 provider 成熟度矩阵补充“上下文预算一致性”验收项。

## 验收标准

- 同一个 provider/profile/model，在所有界面和运行链路中得到同一个 `totalContextWindow`。
- 自动压缩阈值能从同一个 `ContextBudget` 推导，不存在单独按 `200K` 默认值计算的残留。
- 顶部显示、context analyze、附件预算、工具搜索阈值、TUI warning 的窗口来源一致。
- 切换模型后，配置快照、运行快照、Desktop 顶部和压缩状态同步更新。
- 旧 `getContextWindowForModel(model)` 不再作为 CCR 多 provider 主路径的权威来源。

## 本轮执行结果

状态：当前任务列表已完成。

已完成：

- 新增统一预算入口 `src/services/llm/contextBudget.ts`，集中解析 `totalContextWindow`、`effectiveInputWindow`、`autoCompactThreshold`、warning/error/blocking 阈值和来源。
- 自动压缩链路改为通过统一预算入口推导，DeepSeek 不再按旧默认 `200K -> 180K -> 167K` 触发。
- Core `context/status`、`compact/status`、turn metadata 和 `config/get` 都输出同源 `contextBudget`。
- Desktop 顶部上下文主值改为优先展示 `totalContextWindow`，有效输入窗口和自动压缩阈值进入 tooltip。
- context analyze、附件预算、1M 判断、tool search、TUI 状态栏、TokenWarning、权限提示、成本统计和启动技能预算迁移到统一预算口径。
- 旧 `getContextWindowForModel(model)` 保留为 legacy Claude/model-string resolver，并加注释说明新 CCR 多 provider 主链路不得直接依赖它。
- 新增 `smoke:context-budget`，固定验证 DeepSeek `1000K / 980K / 967K` 和 Codex OAuth `200K / 180K / 167K`。
- Goal 检查后收紧 `getAutoCompactThreshold()`：不再自行计算 `effectiveInputWindow - buffer`，改为直接消费统一预算对象的 `autoCompactThreshold`。

已完成验证：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:context-budget`
- `npm.cmd run smoke:app-server-context`
- `npm.cmd run smoke:llm-runtime-status`
- `npm.cmd run typecheck:desktop`

关键验证结论：

- DeepSeek V4 Flash 预算解析结果：`totalContextWindow=1_000_000`，`effectiveInputWindow=980_000`，`autoCompactThreshold=967_000`。
- Codex OAuth `gpt-5.4` 仍为 `totalContextWindow=200_000`，`effectiveInputWindow=180_000`，`autoCompactThreshold=167_000`。

保留边界：

- 当前运行态不再使用旧的 model-string 预算逻辑；统一通过 `resolveRuntimeContextBudget()` 获取预算，必要时显式传入当前 LLM config。
- 历史、统计、成本、恢复展示不能用当前 config 重新解释历史 `model`；必须优先读取事件发生时固化的 `provider/profile/model/contextBudget` 或至少固化后的 `contextWindow/maxOutputTokens`。
- 对于早期没有固化预算字段的旧记录，不用当前 config 或旧 model-string 逻辑补猜；宁可显示未知/0 并暴露数据缺口，也不要写入错误统计口径。

## 后续记录（追加）

- 2026-05-26：按 [STD-RUNTIME-01](../goals/2026-05-26-std-runtime-01-context-budget-unification.md) 完成上下文预算统一治理。核心经验：上下文预算不是 UI 字段，必须由 provider/profile/model 的模型目录统一推导，再供 UI、压缩、分析、附件和工具预算消费；旧 model-string resolver 不进入当前运行态预算链路。

## 风险点

- 部分 TUI / legacy Claude 代码仍依赖旧 `getContextWindowForModel(model)`，不能直接删除。
- 自动压缩链路在 Core、Desktop status、历史恢复里都有消费者，必须一起迁移。
- 只改 Desktop 顶部会掩盖真实问题，不能作为验收。
- 只改 DeepSeek 特判会留下同类 provider 再次复发的入口。

## 推荐推进顺序

1. 先做 CB-00，拿到完整调用点清单。
2. 再做 CB-01，定唯一 `ContextBudget` 类型和 resolver。
3. 然后 CB-02 到 CB-05 一次性打通运行主链路。
4. 最后 CB-06 到 CB-08 清理外围消费者和 legacy 边界。
5. CB-09 做真实回归，不以单个截图显示正确作为完成标准。
