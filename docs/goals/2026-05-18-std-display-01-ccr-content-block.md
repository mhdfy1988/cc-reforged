# Goal: STD-DISPLAY-01 CcrContentBlock 共享类型

## 目标

把 CCR 里分散在 Core、App Server、provider adapter、Desktop display event 和历史恢复链路中的内容块统一成一套共享类型。

这一步是后续 `History Validator`、`ErrorSnapshot`、Provider fixture / probe 和新 provider 接入的前置地基。否则 OpenAI、Anthropic、Gemini、DeepSeek、MiniMax、Gateway 的文本、图片、文件、工具、thinking 和错误会继续各自展示一套。

## 迭代 1：协议面拆解

第一轮先从标准协议和现有代码里拆出内容块最小全集：

1. `text`：普通文本和 Markdown。
2. `thinking`：可见思考、被隐藏思考、签名 / redacted 状态。
3. `image`：本地图片、base64、provider file id、远端 URL、缩略图引用。
4. `file`：文本文件、普通文件、provider file reference、本地附件元信息。
5. `audio` / `video`：先定义类型和元信息，不急着做播放器或发送链路。
6. `tool_call`：工具调用 ID、名称、输入和 provider 原始引用。
7. `tool_result`：工具结果、错误结果、中断结果和校验失败结果。
8. `json` / `structured`：结构化输出引用，复用已有 `StructuredSnapshot` 思路。
9. `error`：仅表达标准错误块引用，具体分类后续由 `P24 ErrorSnapshot` 负责。

第一轮还要盘点当前真实类型：

- `LlmContentPart`
- `CoreUserContentBlock`
- `DisplayEvent`
- `AttachmentSnapshot`
- `ToolSnapshot`
- `StructuredSnapshot`
- provider adapter 内部输入 / 输出块

## 迭代 2：落地边界收紧

第二轮把实现范围收紧，避免一次性重写所有展示。

本次优先做：

- 新增共享 `CcrContentBlock` 类型和必要子类型。
- 把现有 `LlmContentPart`、Core user content block、Desktop attachment / tool / structured 相关类型映射到共享类型。
- 给 provider adapter、历史恢复、Desktop display event 增加统一转换入口。
- 保持现有 UI 行为基本不变，只让数据来源更统一。
- 补 fixture / smoke，确认图片附件、工具卡、结构化输出、历史恢复仍能展示。

本次不做：

- 不新增 provider。
- 不做 Gemini adapter。
- 不做完整 `History Validator`，只预留所需字段。
- 不做完整 `ErrorSnapshot` UI，只保留 `error` block 的类型边界。
- 不做生成型图片 / 音频 / 视频输出。
- 不打包、不发布。

## 验收标准

- [x] 有一套共享 `CcrContentBlock` 类型，覆盖 text / thinking / image / file / audio / video / tool / structured / error。
- [x] Core / App Server / Desktop 不再各自发明同名内容块字段。
- [x] provider adapter 输出可以先归一到 `CcrContentBlock`，再进入展示和历史恢复。
- [x] 历史恢复可以基于统一内容块识别用户附件、assistant 输出、工具调用和工具结果。
- [x] 现有多模态图片、小文本文件、工具卡、结构化输出和历史恢复 smoke 通过。
- [x] `git diff --check` 通过。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:turn-input
npm.cmd run smoke:multimodal-provider-mapping
npm.cmd run smoke:desktop-display-events
npm.cmd run desktop:build
git diff --check
```

## 完成后下一步

完成后进入 `STD-HISTORY-01 History Validator`：

- 发送给 provider 前扫描历史。
- 修复或阻断悬空 tool call。
- 处理 OpenAI tool messages、Anthropic tool_result、Gemini functionResponse。
- 处理 reasoning / thinking 回放规则。

## 执行结果

状态：已完成第一版。

已完成：

- 新增 `src/types/contentBlocks.ts`，定义 `CcrContentBlock`、`CcrUserContentBlock`、`CcrLlmContentBlock`、标准附件块、工具块、结构化块和错误块。
- `LlmContentPart`、`CoreUserContentBlock`、App Server `TurnContentBlock` 已开始复用共享内容块基础类型。
- Desktop `DisplayEvent` 新增 `contentBlocks` 标准快照；现有 UI 渲染逻辑保持不变。
- `smoke:desktop-display-events` 补充标准内容块断言，覆盖工具结果和历史用户图片附件。

已完成验证：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:turn-input`
- `npm.cmd run smoke:multimodal-provider-mapping`
- `npm.cmd run smoke:desktop-display-events`
- `npm.cmd run desktop:build`
- `git diff --check`
