# Goal: P23-3 Core user message 内容块归一化

## 目标

让 Core 不再把 turn input 固定理解成纯字符串，而是能保存 App Server 已校验过的 `text / image / file / audio` 内容块。

这一阶段先解决 Core 领域模型问题：内容块进入 CoreTurn，并能被事件、smoke 和后续 adapter 读取。真实 provider 请求仍使用文本 fallback，避免把还没映射好的图片或文件块直接发给模型。

## 为什么先做这个

MM-02 已经让 App Server 接收并校验多模态输入，但进入 Core 时仍被压成纯文本。这样后续 Desktop、历史恢复和 provider adapter 会缺少统一的内部结构，只能从文本摘要或 metadata 反推附件。

MM-03 要把“发送前校验”和“真实模型映射”之间的 Core 接口补出来，后面才好继续做 Desktop 草稿队列、图片读取和 provider adapter。

## 第一版范围

1. 新增 Core 级 `CoreTurnInput` 和 `CoreUserContentBlock` 类型。
2. `CoreTurn.input` 支持：
   - 旧文本：`{ type: "text", text }`
   - 新内容：`{ type: "content", text, content }`
3. `text` 字段继续作为标题、语言提示和 provider fallback 的稳定文本。
4. App Server `turnInput` 归一化后把已校验内容块传给 Core，而不是只传纯文本。
5. Core user message 事件可以暴露内容块，方便后续 Desktop 展示。
6. Provider 请求仍使用 `input.text`，图片/文件/音频真实请求映射留给后续阶段。
7. smoke 覆盖 Core 能保存内容块、App Server turn 返回内容块、文本 fallback 不回归。

## 明确不做

- 不做 Desktop 附件草稿 UI。
- 不做 main/preload 文件读取。
- 不读取图片、文件或音频内容。
- 不把图片 base64 写入 transcript 或普通日志。
- 不做 provider adapter 图片映射。
- 不做真实图片请求。
- 不做历史附件卡片恢复。

## 不变式

- 旧文本 turn 的 `turn.input.text` 仍可用。
- 新内容 turn 也必须有 `turn.input.text`，作为标题、语言提示和临时 provider fallback。
- 未通过 MM-02 能力校验的内容块不能进入 Core。
- Core 可以保存内容块，但当前阶段不能默认把非文本块发送给 provider。
- 附件 block 只保存 metadata 和受控引用，不保存文件正文或 base64。

## 验收标准

- `CoreTurn.input` 能表达 `content` 输入。
- App Server `turn/start` 返回的 turn 能保留内容块结构。
- Core direct smoke 能证明 fake runner 收到 `input.type = "content"`。
- 纯文本 turn 不回归。
- `smoke:turn-input` 覆盖 MM-02 + MM-03 边界。
- `docs/stages/multimodal-input-output-todo.md` 当前指针更新到 MM-04。

## 完成记录

已完成：

- 新增 Core 级 `CoreTurnInput`、`CoreUserContentBlock`、`CoreContentSource` 等类型。
- `CoreTurn.input` 支持旧 `text` 和新 `content` 两种结构，新结构保留 `text` fallback。
- App Server 归一化层现在把已校验内容块传给 Core，不再只传纯文本 fallback。
- `runCoreQueryTurn` 和 `runTextOnlyCoreTurn` 的用户消息事件可以暴露 Core 内容块；真实 provider 请求仍暂时使用 `input.text`。
- `smoke:turn-input` 已补 Core direct fake runner，证明 Core 能保存并传递 content blocks。

验证通过：

- `npm.cmd run build`
- `npm.cmd run typecheck`
- `npm.cmd run smoke:turn-input`
- `npm.cmd run smoke:app-server`
- `npm.cmd run smoke:model-capabilities`
- `npm.cmd run desktop:build`
- `git diff --check`

已知情况：

- `npm.cmd run typecheck:desktop` 仍失败在既有 `MACRO`、Bun、可选原生依赖类型缺失等全仓历史问题，不是本阶段新增改动引入。

下一步：

- 进入 MM-04：Desktop 附件草稿队列与能力提示。

## 建议验证命令

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd run smoke:turn-input
npm.cmd run smoke:app-server
npm.cmd run desktop:build
git diff --check
```
