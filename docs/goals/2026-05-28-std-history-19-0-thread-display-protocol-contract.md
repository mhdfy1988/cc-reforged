# Goal: STD-HISTORY-19-0 ThreadDisplay Protocol Contract

## 目标

收口 ThreadDisplay 展示协议边界，明确 Desktop 主聊天展示的权威来源，避免后续把 current-context 兼容载荷、诊断计数或 Desktop 防退化 merge 层误当成 UI 历史主链路。

本轮不重写完整 thread / turn / item 协议模型，也不删除兼容接口；目标是把现有正确边界固化为类型注释、文档、smoke 和 changelog。

## 范围

### 1. 展示权威

- 历史展示权威：`ThreadDisplaySnapshot.items`。
- 实时展示权威：`ThreadDisplayPatch.operations`。
- Renderer 只按 projection 协议展示；缺失或非法 projection 必须进入协议错误卡。

### 2. 兼容载荷

- `thread/messages/list` 保留。
- `ThreadResumeResult.messages` 保留。
- `ThreadMessagesListResult.messages` 保留。
- `messages` 字段只表示兼容载荷或 current-context 载荷，不是 Desktop 可见历史权威。
- 调用方必须结合 `messagesSemantics` 判断语义，不允许把 `messages` 直接 replay 成 UI 历史。

### 3. Desktop merge 边界

- `mergeThreadDisplaySnapshot(...)` 只负责防止刷新时短 snapshot 让 UI 倒退或消失。
- merge 层不是新的物化器，也不是历史事实来源。
- 发生防退化保留时必须记录诊断。
- `rawTranscriptEvents`、`coreContextMessages` 等事实计数跟随最新 snapshot，不再用旧 snapshot 做 `Math.max(...)`。

### 4. 诊断计数边界

- `ThreadDisplayCounts` 是诊断 / telemetry 字段。
- UI 历史权威来自 snapshot items 或 patch operations。
- counts 不能作为“应该展示多少条历史”的判定权威。

## 非目标

- 不删除 `thread/messages/list`。
- 不删除 `messages` 兼容字段。
- 不删除 `buildConversationChain(...)` 原生读侧 helper。
- 不重写完整 Codex-like thread / turn / item 原生协议模型。
- 不引入 silent legacy fallback。
- 不改 UI 视觉和展示样式。

## 不变式

1. Desktop 主聊天历史不得 replay `thread/messages/list.result.messages`。
2. Desktop 主聊天历史必须使用 `displaySnapshot.items`。
3. 实时主聊天更新必须使用 `ThreadDisplayPatch.operations`。
4. `messagesSemantics: 'current_context_compat'` 的载荷不得被解释成完整 UI 历史。
5. projection 缺失或非法时必须显式显示协议错误卡，不得 raw fallback。
6. snapshot merge 只允许作为防退化保护层，并保留诊断。
7. 诊断 counts 不得反向驱动 UI 历史裁剪或补齐。

## 验收标准

- [x] 协议类型注释明确 `displaySnapshot` / `ThreadDisplayPatch` 是展示权威。
- [x] 协议类型注释明确 `messages` 是兼容 / current-context 载荷。
- [x] Desktop merge 注释明确其只是防退化诊断层。
- [x] smoke 固定 Desktop 不消费 `result.messages` 作为 UI 历史。
- [x] smoke 固定 projection 缺失 / 非法进入协议错误卡。
- [x] CHANGELOG 记录协议边界收口。
- [x] `typecheck`、`typecheck:desktop`、`build`、`smoke:desktop-session-state`、`smoke:desktop-display-events`、`smoke:app-server`、`git diff --check` 通过。

## 当前状态

状态：完成。

本轮完成的是协议边界固化，不改变展示运行逻辑。后续如果要继续追求更干净的协议形态，可单独新建 goal 设计 `thread/display/snapshot` 一类更直观的只读展示接口。

## 验证命令

```powershell
npm.cmd run typecheck
npm.cmd run typecheck:desktop
npm.cmd run build
npm.cmd run smoke:desktop-session-state
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:app-server
git diff --check
```
