# Goal: ThreadDisplay attachment / generated output 多来源归一

状态：已完成。

关联文档：

- [ThreadDisplay 全事件 Ordered Display Reducer 深化](./2026-05-31-thread-display-full-ordered-reducer-next.md)
- [CCR ThreadDisplay Reducer 契约](../architecture/thread-display-reducer-contract.md)
- [CCR 全事件统一 Ordered Display Reducer 设计方向](../architecture/thread-display-ordered-reducer-future-design.md)

## 目标

把用户附件、模型生成图片和文件附件统一到确认事实再投影的路径，避免 projector 或 Desktop 从 raw text / raw block 猜附件。

目标链路：

```text
user upload / generated output / file attachment
-> adapter
-> DisplayFact
-> reducer state item
-> attachment / file projector
-> snapshot / patch
```

## 为什么单独做

附件和生成物最容易出现“正文里有路径就猜成图片”“缺 projection 就退回 raw 文本”的旧问题。它们需要单独补多来源、多附件和历史 / 实时等价回归。

## 范围

本阶段处理：

- 用户上传图片。
- 用户上传文件附件。
- 模型生成图片。
- 多 attachment。
- 多 generated output。
- 用户上传图片和模型生成图片混合。
- assistant 文本中 `.ccr/generated_outputs` 路径的物化边界。

## 非目标

- 不改变生成图片 provider 协议。
- 不新增文件读取权限策略。
- 不让 Desktop 从普通本地路径文本反推附件卡。
- 不让 attachment projector 扫描混合 raw content 猜测目标块。
- 不重写附件视觉组件。

## 迭代拆分

### 迭代 1：多来源审计

只查用户上传、文件附件、模型生成图片和 generated output 物化入口，确认 source identity、fact 和 projector 输入来源。

输出：附件来源矩阵和当前 smoke 对应关系。

### 迭代 2：多附件 / 多生成物归一

补多 attachment、多 generated output、混合图片场景的事实归一和 state 绑定；禁止从普通文本路径反推附件。

输出：每个附件 / 生成物都有稳定 identity 和 projection。

### 迭代 3：历史实时等价回归

补历史 snapshot、实时 patch 和 Desktop route 后最终 `DisplayEvent` 等价验证。

输出：黄金 fixture、普通路径不升级附件卡的负例覆盖、文档矩阵更新。

## 现状审计结论

| 来源 | 当前结论 | 处理方式 |
| --- | --- | --- |
| 用户上传图片 | 已 fact 化 | history / realtime adapter 识别 image block，生成 attachment source identity，`resolveThreadDisplayFacts` 输出 attachment fact。 |
| 用户上传文件附件 | 已 fact 化 | file attachment block 与 image/audio/video 走同一 attachment fact；projector 从 fact-scoped blocks 生成 `UserUpload` attachment snapshot。 |
| 模型生成图片显式 block | 已覆盖 | assistant / tool result content 中 `origin="model_output"` 的 image/file/audio/video block 投影为 `ModelOutput` attachment snapshot。 |
| assistant 文本中的 `.ccr/generated_outputs` 图片路径 | 已前移 fact 化 | adapter 阶段先 materialize 成 image block，再进入 attachment source identity 和 attachment fact；projector 不从 raw text 猜附件。 |
| 多 attachment | 已覆盖 | 单个 input event 仍只有一个 primary attachment source identity，但 fact metadata 保留所有 attachment blocks，projection 输出多个 attachment snapshots。 |
| 多 generated output | 已覆盖 | materializer 对同一消息中的多个 generated output 图片路径去重并生成多个 model_output image blocks。 |
| 普通本地图片路径文本 | 不升级附件 | 只有 `.ccr/generated_outputs` 白名单路径会物化；普通 `C:\...png` 文本保留为普通文本。 |

## 本轮实现

- `threadDisplayInputEvent.ts` 在 history message 和 realtime item blocks 阶段调用 `materializeGeneratedOutputImageBlocks`，只对 assistant message / item 启用。
- generated output 路径现在会先变成 adapter blocks，再参与 `sourceIdentity.kind="attachment"` 判定和 attachment fact 生成。
- user message 不启用 generated output 路径物化，避免把用户普通路径或上传说明误判成模型输出附件。
- `smoke-thread-display-input-event.mjs` 新增多 generated output、普通路径负例、历史 snapshot / 实时 patch 等价、多用户附件覆盖。

## 边界和不变式

- projector 只消费 reducer 确认的 attachment blocks；没有 fact metadata 时仍只看 item content，不扫描普通文本路径。
- Desktop Renderer 不新增附件推断逻辑，也不从 raw text 把普通本地路径升级成附件卡。
- 生成物路径物化只对白名单 `.ccr/generated_outputs` 图片路径生效；普通路径、URL 文本和用户消息不走这条自动物化。
- 多附件的 primary source identity 仍用于事件级排序和归类；具体每个附件的稳定 id 由 attachment snapshot 的 `attachmentId` / `outputId` / path 派生。

## 验证记录

已通过：

```text
npm.cmd run build
npm.cmd run smoke:thread-display-input-event
npm.cmd run smoke:desktop-session-state
npm.cmd run smoke:desktop-display-events
npm.cmd run typecheck
git diff --check
```

## 剩余缺口

- 多附件 / 多 generated output 已覆盖主路径；更大的黄金 fixture 组合留到 2-5 做最终矩阵复核。
- tool result 内部的生成物 enrich 现有路径已覆盖，复杂失败 / interrupted 状态归 2-4。

## 验收标准

- 多附件和多 generated output 都有明确 source identity。
- projector 只消费 reducer 确认的 attachment / generated output fact。
- 普通文本路径不会被 Desktop 自行升级成附件卡。
- 历史 snapshot 和实时 patch 最终展示等价。
- 验证命令通过：

```text
npm.cmd run smoke:thread-display-input-event
npm.cmd run smoke:desktop-session-state
npm.cmd run smoke:desktop-display-events
npm.cmd run typecheck
git diff --check
```

## 下一步

完成后进入 [tool progress 生命周期并入 reducer state](./2026-05-31-thread-display-full-ordered-reducer-04-tool-progress-lifecycle.md)。
