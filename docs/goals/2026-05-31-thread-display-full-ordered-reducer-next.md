# Goal: ThreadDisplay 全事件 Ordered Display Reducer 深化

状态：已完成。

关联文档：

- [CCR 全事件统一 Ordered Display Reducer 设计方向](../architecture/thread-display-ordered-reducer-future-design.md)
- [CCR ThreadDisplay Reducer 契约](../architecture/thread-display-reducer-contract.md)
- [ThreadDisplay 残留入口与文档收口](./2026-05-31-thread-display-closeout.md)

## 目标

在当前 ThreadDisplay 主链路已经统一的基础上，继续向“所有展示来源都由同一个 ordered display reducer 状态机处理”的最终形态推进。

这里的“全事件”不是把所有 raw event 塞进 Desktop，也不是把 projector 写得更大，而是让所有展示语义都先转成稳定输入事件和展示事实，再进入唯一 reducer state。

目标形态：

```text
所有展示来源
-> 输入 adapter
-> ThreadDisplayReducerInputEvent
-> DisplayFact
-> OrderedDisplayReducerState
-> ThreadDisplaySnapshot / ThreadDisplayPatch
-> Desktop 纯消费
```

## 为什么单独做成后续 goal

这不是 FODR-04 收尾，而是下一轮架构深化。

FODR-04 已经证明 Desktop 可以只消费 snapshot / patch，历史和实时可以在最终 `DisplayEvent` 上收敛。但当前实现里，部分特殊项仍然由 reducer 内部的小分支、projector 或局部 helper 分别处理。

后续 goal 要解决的是：

- 系统提示、内部控制事件、错误、附件、工具进度是否都进入统一状态机。
- display item 的生成是否都能从 `DisplayFact` 和 state transition 推导。
- snapshot 和 patch 是否彻底只是同一 state 的两种输出视图。

## 范围

1. 完整输入来源清单。

   建立所有展示来源到 `ThreadDisplayReducerInputEvent` 的映射表：

   - history message
   - realtime core event
   - user / assistant / system message
   - tool use / progress / result / failed
   - permission request / permission cancelled
   - compact / snip / preserved segment notice
   - TodoWrite / todo reminder
   - generated image / user upload / file attachment
   - provider error / tool error / protocol error
   - unsupported / unknown input

2. 完整 `DisplayFact` 分层。

   确认每类输入都先形成展示事实，不让 projector 或 Desktop 再解释 raw content。

   事实层至少包括：

   - message
   - tool lifecycle
   - file
   - attachment
   - error
   - system
   - control
   - permission
   - compact
   - unsupported

3. 单一 ordered state。

   reducer 内部只维护一份状态：

   - `orderedItemIds` 决定顺序。
   - `itemsById` 保存展示项。
   - `displayIdBySourceIdentity` 绑定来源身份。
   - `toolLifecycleByToolUseId` 只服务工具生命周期归并，不当作全局展示身份。
   - 后续如需要，增加 attachment / permission / control 的专用绑定表。

4. 输出视图统一。

   - history replay 输出 snapshot。
   - realtime event 输出 patch。
   - 两者都来自同一个 reducer state transition。
   - Desktop 不参与状态修正，只渲染 `ThreadDisplayItem`。

5. 前台影响边界。

   Desktop 可以改视觉组件、交互按钮、详情折叠和错误提示，但不能：

   - replay raw `messages`
   - 按 raw `toolUseId` 合并
   - 从 raw text 猜图片或附件
   - 用旧 snapshot merge 修正历史
   - 对缺 projection 做 raw fallback

6. 黄金回归扩展。

   后续新增类型都必须进入同一黄金回归或专门矩阵：

   - permission
   - MCP 特殊错误
   - 工具 progress 细节
   - 恢复中断态
   - 多 attachment / 多 generated output
   - unknown item / unsupported item

## 非目标

- 不恢复 Desktop 侧第二套 reducer。
- 不把 `toolUseId` 提升为全局 display identity。
- 不让 projector 扫 raw transcript 做 fallback。
- 不一次性重写所有 UI 卡片。
- 不靠 silent legacy fallback 兜底。

## 关键不变式

1. 展示顺序只由 `orderKey` 决定。
2. 生命周期归属只由 `sourceIdentity` 和 reducer 内部绑定表决定。
3. `payload` 是输入事实来源，不直接等于 UI 卡片类型。
4. `DisplayFact` 是 projector 能消费的事实边界。
5. Desktop 只消费展示协议，不解释原始模型或原始工具协议。
6. 未知和非法输入必须显式诊断，不静默吞掉。

## 验收标准

- 所有展示来源都有输入 adapter 或明确 unsupported diagnostic。
- 所有展示语义都有对应 `DisplayFact` 或明确暂不支持说明。
- reducer 的 snapshot / patch 输出来自同一 state。
- Desktop 不新增语义补丁或 raw fallback。
- 黄金回归覆盖新增类型，历史 snapshot 和实时 patch 最终展示等价。
- 验证命令根据当轮改动选择，但至少包含：

```text
npm.cmd run smoke:desktop-session-state
npm.cmd run smoke:thread-display-input-event
npm.cmd run typecheck
git diff --check
```

## 子 Goal 拆分

本 goal 不直接作为单次实现任务执行，而是作为第二阶段总纲。实际推进拆成以下小 goal：

1. [ThreadDisplay 全事件输入来源矩阵](./2026-05-31-thread-display-full-ordered-reducer-01-input-source-matrix.md)（已完成）
   已盘点所有展示来源到 `ThreadDisplayReducerInputEvent` / `DisplayFact` / smoke 的覆盖状态，只定边界，不做大实现。
2. [ThreadDisplay permission / compact / control fact 化](./2026-05-31-thread-display-full-ordered-reducer-02-permission-compact-control-facts.md)（已完成）
   已让权限、compact 和系统控制类展示语义先形成明确 fact，再由 reducer state transition 输出 snapshot / patch。
3. [ThreadDisplay attachment / generated output 多来源归一](./2026-05-31-thread-display-full-ordered-reducer-03-attachment-generated-output.md)（已完成）
   已处理多附件、多生成图、用户上传和模型生成图片场景，避免 projector 或 Desktop 从 raw text 猜附件。
4. [ThreadDisplay tool progress 生命周期并入 reducer state](./2026-05-31-thread-display-full-ordered-reducer-04-tool-progress-lifecycle.md)（已完成）
   已单独处理工具 progress、failed、interrupted、orphan result 和乱序 result，避免 raw `toolUseId` 合并逻辑回到 Renderer。
5. [ThreadDisplay 全事件黄金回归矩阵扩展与最终收口](./2026-05-31-thread-display-full-ordered-reducer-05-golden-closeout.md)（已完成）
   已补齐 permission、MCP 特殊错误、progress、多附件、多 generated output、unknown / unsupported 等覆盖矩阵，并关闭第二阶段。

执行顺序必须从 2-1 开始。除非 2-1 矩阵已经证明某个阶段没有实现缺口，否则不要跳过前置小 goal。

## 完成记录

第二阶段已按 2-1 到 2-5 完成：

- 2-1 固定所有展示来源到 `ThreadDisplayReducerInputEvent` / `DisplayFact` / smoke 的覆盖矩阵。
- 2-2 将 permission、compact、control 事实化，避免 projector 或 Desktop 解释 raw 特殊事件。
- 2-3 将附件和模型生成物归一到输入 / 投影前事实，Desktop 不再从文本路径猜附件。
- 2-4 将 tool progress、failed、interrupted、orphan result 纳入 reducer lifecycle state。
- 2-5 扩展全量 golden fixture，并修复 Desktop 实时 patch 合并漏掉 progress / error metadata 的缺口。

最终验证已通过：

```text
npm.cmd run build
npm.cmd run smoke:desktop-session-state
npm.cmd run smoke:thread-display-input-event
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:app-server
npm.cmd run typecheck
git diff --check
```
