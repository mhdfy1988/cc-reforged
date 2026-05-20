# CCR 多模态输入输出 Todo

## 目标

把 CCR 从“纯文本输入 + 附件占位展示”推进到“按模型能力安全发送文本、图片和文件附件，并能展示、恢复和复用媒体输出”的阶段。

参考设计：[CCR 多模态输入输出设计](../architecture/multimodal-input-output-design.md)。

多供应商、模型配置档案、API Key、协议选择和供应商切换不在本文推进，单独见 [CCR 多供应商模型与协议接入 Todo](./multi-provider-model-management-todo.md)。但多模态必须消费多供应商专项提供的模型能力声明。

## 方向调整

P23 第一版不再从“输入框上传按钮”开始，而是从模型能力协商开始。

```text
模型能力声明
-> 当前 Profile + 当前模型能力解析
-> 发送前校验
-> CCR 内容块协议
-> Desktop 附件草稿队列
-> Provider adapter 映射
-> 消息展示、输出媒体和历史恢复
```

关键规则：

- 没有能力声明时，默认只支持文本输入和文本输出。
- OpenAI Compatible / 第三方中转默认未知能力，不能因为协议像 OpenAI 就默认启用图片。
- 附件可以进入草稿队列，但发送前必须标明 `可发送 / 仅预览 / 需转换 / 不支持`。
- 不支持图片、文件或音频的模型不能收到对应 content block。
- 工具、MCP、浏览器产生的图片/文件可以作为 Desktop 输出展示；能否再次发送给模型要重新走能力校验。

## 当前任务列表（实时）

- [x] MM-00 方向重排与现有 P21 能力复核
- [x] MM-01 模型能力声明、能力来源与能力解析器
- [x] MM-02 App Server 多模态输入协议与发送前校验
- [x] MM-03 Core user message 内容块归一化
- [x] MM-04 Desktop 附件草稿队列与能力提示
- [x] MM-05 图片输入最小闭环
- [x] MM-06 文本文件输入策略与大文件保护
- [x] MM-07 Provider adapter 多模态映射
- [x] MM-08 用户消息附件展示、输出媒体归一化与历史恢复
- [x] MM-09 Smoke、真机验收和文档收口

## 当前指针

- 已完成：P23 / MM-09 Smoke、真机验收和文档收口。
- 当前状态：已随 `0.5.0` 发布。GLM / MiniMax / Codex OAuth / OpenAI 生图链路已统一到生成物模型，Desktop 复用附件缩略图和预览 UI。
- 完成后下一项：`0.5.x` 继续处理图片 URL 下载兜底、历史恢复、错误诊断、工具卡片噪声和 provider 真实 probe；`0.6.0` 再进入 MCP / Skill / Plugin 主线。

## MM-00 方向重排与现有 P21 能力复核

状态：已完成。

目标：

- 确认 P21 已完成的文件、附件、引用展示模型。
- 明确哪些 UI、fixture、smoke 可以直接复用。
- 将实现顺序从“上传按钮优先”改为“能力协商优先”。

建议扫描入口：

- [desktop-file-attachment-reference-field-map.md](../architecture/desktop-file-attachment-reference-field-map.md)
- [multimodal-input-output-design.md](../architecture/multimodal-input-output-design.md)
- [multi-provider-model-management-design.md](../architecture/multi-provider-model-management-design.md)
- [fileEvents.ts](D:/agent_project/claude-code-reforged/apps/desktop/src/renderer/src/domain/fileEvents.ts)
- [displayEvents.ts](D:/agent_project/claude-code-reforged/apps/desktop/src/renderer/src/domain/displayEvents.ts)
- [ChatPage.tsx](D:/agent_project/claude-code-reforged/apps/desktop/src/renderer/src/components/pages/ChatPage.tsx)

验收：

- 列出可复用的附件/文件展示模型。
- 明确多模态第一版不需要重做哪些 P21 能力。
- 文档和 live pointer 已统一到能力协商优先。

结论：

- P21 的 `FileSnapshot` / `AttachmentSnapshot` / `ReferenceSnapshot`、输入框 `+` 占位和 display-event fixture 可以继续复用。
- P23 不再新建第二套附件/媒体模型，只补发送策略、模型能力和内容块协议。
- 当前实现入口切到 MM-01。

## MM-01 模型能力声明、能力来源与能力解析器

状态：已完成。

目标：

- 当前模型能明确回答支持哪些输入和输出模态。

计划交付：

- `LlmModelCapabilities` 类型。
- `src/services/llm/modelCapabilities.ts` 能力解析器。
- 能力来源：内置能力目录、Profile 覆盖、默认能力。
- Profile 配置新增 `capabilityOverrides`。
- `config/get`、`model/availability`、`model/list` 暴露解析后的 `modelCapabilities`。
- 未知模型默认只支持文本。

验收：

- 能解析 `inputModalities: text/image/file/audio` 和 `outputModalities: text/image/audio`。
- 能表达图片数量、mime type、大小等限制。
- 能记录能力来源：`builtin`、`profile_override`、`default`。
- 能明确区分“内置目录能力”和“当前 Profile 实际覆盖能力”。

结论：

- 已新增 `docs/goals/2026-05-15-p23-1-model-capabilities.md`，以后阶段性 goal 统一放入 `docs/goals/`。
- 已新增 `LlmModelCapabilities`、Profile `capabilityOverrides` 和能力解析器。
- 当前 `codex-oauth`、`deepseek`、`minimax` 默认按内置文本能力处理；`anthropic` 内置目录声明文本 + 图片输入；未知 provider/model 保守降级为纯文本。
- OpenAI Compatible / 第三方中转第一版不靠模型名启用图片，必须通过 Profile 覆盖声明。
- 验证通过：`npm.cmd run build`、`npm.cmd run typecheck`、`npm.cmd run smoke:model-capabilities`、`npm.cmd run smoke:llm-config`、`npm.cmd run smoke:llm-runtime-status`、`npm.cmd run desktop:build`、`git diff --check`。
- 已知情况：`npm.cmd run typecheck:desktop` 仍失败在既有 `MACRO`、Bun 和可选原生依赖类型缺失问题，不是本轮新增文件引起。

## MM-02 App Server 多模态输入协议与发送前校验

状态：已完成。

目标：

- 扩展 `turn/start` 输入结构，并在创建 turn 前完成能力校验。

计划交付：

- `input.content` schema。
- 旧 `input.text` 到 `content` 的兼容归一化。
- 图片、文件内容块的最小类型。
- 不支持时返回稳定可展示错误，不创建 turn。

验收：

- 旧纯文本客户端不回归。
- 新协议能表达文本 + 图片 + 文件附件元数据。
- 不支持图片的模型不会收到图片 block。

结论：

- 已扩展 `TurnStartParamsSchema`，`turn/start` 现在支持旧 `input.type = "text"` 和新 `input.type = "content"`。
- 已新增内容块类型：`text`、`image`、`file`、`audio`，附件块支持 `attachmentId`、`displayName`、`mimeType`、`sizeBytes` 和 `source`。
- 已新增 App Server 输入归一化层，在创建 turn 前根据当前 `modelCapabilities` 校验模态、图片 mime type、图片大小和图片数量。
- 不支持图片、文件或音频时返回稳定 `invalid_params`，不会创建 turn。
- 当前阶段仍把内容块降级为文本 fallback 交给 Core，并在 `turn.metadata.multimodalInput` 记录 deferred、块数量、模态计数和能力来源。
- 已新增 `smoke:turn-input`，覆盖旧文本、新 content 文本、默认文本模型阻止图片、Profile 覆盖允许图片、未知模型默认阻止图片。
- 验证通过：`build`、`typecheck`、`smoke:turn-input`、`smoke:model-capabilities`、`smoke:llm-config`、`smoke:llm-runtime-status`、`smoke:app-server`、`desktop:build`、`git diff --check`。
- 已知情况：`typecheck:desktop` 仍失败在既有 `MACRO`、Bun 和可选原生依赖类型缺失问题，不是本阶段新增改动引入。

## MM-03 Core user message 内容块归一化

状态：已完成。

目标：

- Core 内部不再假设用户消息只有字符串。

计划交付：

- Core turn input 类型扩展。
- 用户消息创建逻辑支持内容块。
- 纯文本路径兼容。
- 多模态内容块传递到 LLM Runtime 前的统一校验入口。

验收：

- 纯文本 turn 不回归。
- 内容块 turn 能进入 Core message。
- 不支持的内容类型不会直接落到 provider 请求。

结论：

- 已新增 Core 级 `CoreTurnInput` 和 `CoreUserContentBlock`，`CoreTurn.input` 支持 `text` 与 `content` 两种结构。
- 新 `content` input 保留 `text` fallback，标题生成、语言提示和当前 provider 请求仍可继续使用 `turn.input.text`。
- App Server 已校验内容块会传入 Core，不再只停留在 metadata 和文本摘要。
- Core 用户消息事件能暴露内容块，后续 Desktop 和历史展示可以继续消费这一结构。
- 当前阶段仍不把 image/file/audio 真实发送给 provider，provider adapter 映射留给后续阶段。
- `smoke:turn-input` 新增 Core direct fake runner，覆盖 Core 保存和传递内容块。
- 验证通过：`build`、`typecheck`、`smoke:turn-input`、`smoke:app-server`、`smoke:model-capabilities`、`desktop:build`、`git diff --check`。
- 已知情况：`typecheck:desktop` 仍失败在既有 `MACRO`、Bun 和可选原生依赖类型缺失问题，不是本阶段新增改动引入。

## MM-04 Desktop 附件草稿队列与能力提示

状态：已完成。

目标：

- 输入框支持真实选择文件并维护草稿附件。

计划交付：

- `DraftAttachment` 状态。
- 添加、删除附件。
- 文件名、大小、mime type、风险展示。
- 草稿附件的发送策略：`sendable`、`preview_only`、`convertible`、`blocked`。
- 模型切换后重新计算草稿状态。

验收：

- 用户能选择图片/文件。
- 附件发送前可以删除。
- 用户能看出附件是否会进入模型。
- 不影响纯文本发送。

结论：

- Composer 附件从单个临时标签升级为草稿队列，支持追加多个附件、重复选择去重和逐个删除。
- 草稿附件会按当前 `modelCapabilities` 动态计算 `sendable`、`convertible`、`preview_only`、`blocked` 状态。
- 图片附件已按模型能力校验 `inputModalities`、`maxImages`、`maxImageBytes` 和 `mimeTypes`，不支持时在发送前显示原因。
- 文本类文件先标记为可转换，普通文件和音频在未接真实读取/转写前只做预览或能力提示。
- 当前阶段仍不读取文件内容、不生成缩略图、不把附件随消息发送；真实图片闭环进入 MM-05。
- 验证通过：`desktop:build`、`build`、`typecheck`、`smoke:turn-input`、`smoke:app-server`、`git diff --check`。

## MM-05 图片输入最小闭环

状态：已完成。

目标：

- 先打通 Desktop 到 App Server / Core 的图片输入最小闭环。

计划交付：

- 图片 metadata 和缩略图。
- PNG / JPEG / WEBP / GIF 基础支持。
- main/preload 安全读取和大小限制。
- 图片进入 content block。

验收：

- 支持图片的 Profile 覆盖能让 image content block 通过 App Server 校验并创建 turn。
- 不支持图片的模型会在 App Server 阶段稳定拒绝。
- 图片 base64 不进入普通日志。

结论：

- Desktop main/preload 新增图片附件准备入口，负责读取可用性验证、图片大小限制、mime type 归一化和缩略图生成。
- Renderer 只持有文件选择得到的路径、main 返回的预览和安全元数据，不直接使用 Node 文件系统读取内容。
- Composer 发送时会把已准备且当前模型可发送的图片转成 `turn/start.input.content` 的 `image` block。
- 图片 block 当前使用 main 校验后的 `source.kind = "file"`，只传路径、文件名、大小和 mime type，不把 base64 写入普通日志或 App Server 请求。
- 支持图片的 Profile 覆盖可以通过 App Server 校验；默认文本模型仍会稳定返回 `invalid_params`。
- 当前阶段仍不做 provider adapter 真实图片 HTTP 请求映射，留给 MM-07。
- 验证通过：`desktop:build`、`typecheck`、`build`、`smoke:turn-input`、`smoke:app-server`、`git diff --check`。

## MM-06 文本文件输入策略与大文件保护

状态：已完成。

目标：

- 小文本文件可以进入上下文，大文件和二进制有保护。

计划交付：

- 小文本文件转文本块。
- 大文本文件要求确认或只传摘要/元信息。
- 二进制、压缩包默认 `metadata_only` 或 `blocked`。

验收：

- 文件附件不会被自动全文塞入模型。
- 大文件不会卡死 Desktop。
- 用户能知道文件是否真的随消息发送。

结论：

- Desktop main/preload 的附件准备入口已同时支持图片、小文本文件和普通文件元信息。
- 小文本文件会在 main 侧按 UTF-8 读取，128 KB 以内作为 `text` content block 随消息进入上下文。
- 大文本文件不会读取全文，返回 `metadata_only` 状态，UI 显示仅保留元信息。
- 二进制、压缩包和未知文件默认 `metadata_only`，不进入模型。
- Composer 会明确显示文本文件的可发送、读取中、读取失败、仅元信息和仅预览状态。
- 纯文本发送和图片发送不回归；provider 原生 file input 仍留给后续 adapter 阶段。
- 验证通过：`typecheck`、`desktop:build`、`build`、`smoke:turn-input`。

## MM-07 Provider adapter 多模态映射

状态：已完成。

目标：

- 把 CCR 内容块转换成 provider 请求格式。

计划交付：

- 内建 LLM Runtime 新增 `LlmImagePart`。
- `claudeApiAdapter` 将 CCR 用户消息 `image` block 转为 `LlmImagePart`。
- OpenAI Chat Completions / Compatible 将图片映射为 `image_url` part。
- Anthropic Messages 将图片映射为 `image` content block。
- 本地图片只在 provider adapter 发请求前读取并 base64 编码。
- Provider 错误诊断不输出 base64 或本地绝对路径。

验收：

- OpenAI Chat / Compatible 图片请求体离线验证通过。
- Anthropic Messages 图片请求体离线验证通过。
- 不支持图片的 provider 不会收到图片请求。
- 错误诊断只输出计数类信息，不泄露图片 payload。
- usage、错误和 stream 事件仍能归一化。
- 真实外部 provider 图片请求留到 MM-09 真机验收。

结论：

- 已新增 `LlmImagePart` 与 provider adapter 图片读取 helper。
- Core 在内建 LLM Runtime 路径会把 `content` 用户消息保留为内容块；原生 Anthropic 旧链路仍走文本 fallback，避免把 CCR 自定义 `source.kind = "file"` 直接误发给旧路径。
- `claudeApiAdapter` 已将 CCR `image` block 转成运行时图片部件，支持 `file`、`url` 和未来 `contentRef` 来源。
- OpenAI Chat / Compatible adapter 已支持用户消息 `content` 数组，图片按官方 `image_url` part 发送；本地文件图片转成 data URL。
- Anthropic Messages adapter 已支持用户消息 `image` block，文件图片转 base64 source，URL 图片保持 URL source。
- Provider 请求失败时会带安全 diagnostics，只记录消息数、文本长度、content part 数和图片 part 数，不输出 base64 或本地路径。
- 已新增 `smoke:multimodal-provider-mapping`，离线验证 Core -> LLM Runtime -> OpenAI/Anthropic 请求体映射。
- 验证通过：`typecheck`、`build`、`smoke:multimodal-provider-mapping`、`smoke:llm-claude-adapter`、`smoke:openai-chat-protocol`、`smoke:turn-input`、`smoke:app-server`、`desktop:build`。

## MM-08 用户消息附件展示、输出媒体归一化与历史恢复

状态：已完成。

目标：

- 附件进入消息、历史和输出媒体系统。

计划交付：

- 从 `text/image/file/audio/attachment` 内容块提取 `AttachmentSnapshot`。
- 用户消息 `DisplayEvent` 支持多个附件快照。
- 当前发送的图片和小文本文件在用户消息下方展示紧凑附件条。
- 历史恢复遇到用户内容块时走 completed item 回放，不再只降级成纯文本。
- 工具、MCP、浏览器输出里出现图片或文件内容块时复用同一附件展示模型。
- 本地路径只展示元信息和可复制路径，不读取文件内容。

验收：

- 当前发送的图片附件和小文本文件能在用户消息下方显示附件条。
- 历史恢复中带 `image/file/audio` 内容块的用户消息能恢复附件条。
- 工具结果里出现图片或文件内容块时能显示附件条，不只展示 raw JSON。
- 附件展示不输出 base64。

结论：

- `DisplayEvent` 已支持 `attachmentSnapshots`，事件合并和工具生命周期合并不会丢失多附件快照。
- `fileEvents.ts` 已能从用户内容块、工具结果内容块和 `attachment` wrapper 中提取附件快照，并继续过滤 `todo_reminder` 等不应渲染的系统 attachment。
- `MessageFrame` / `UserMessage` / `ToolCard` 已复用同一紧凑附件条，支持显示类型、名称、mime、大小、路径和复制路径。
- 当前发送附件不再额外写入 `[图片附件：...]` / `[文本文件：...]` 占位行；纯附件消息显示简短“已添加附件。”。
- 历史恢复中，用户 `content` block 会走 completed item replay；历史中的图片、文件、音频块能恢复为附件条。
- 本阶段不读取历史本地文件内容，不做缺失检测；文件缺失状态留给 MM-09 真机验收后按真实需求补返修。
- 验证通过：`typecheck`、`smoke:desktop-display-events`、`desktop:build`、`smoke:turn-input`。

## MM-09 Smoke、真机验收和文档收口

状态：已完成。自动 smoke、构建验证、真实 provider 图片请求、Desktop 附件展示和历史恢复/中断返修真机验收均已通过。

目标：

- 建立多模态回归护栏。

计划交付：

- App Server 新旧输入协议 smoke。
- Desktop display-event fixture。
- 文本模型 + 图片附件被阻止的 fixture。
- 图片模型 + 图片附件成功的 fixture。
- provider capability smoke。
- 文档索引更新。

验收：

- App Server 新旧输入协议 smoke 通过：已通过。
- Desktop 附件展示 smoke 通过：已通过。
- Provider adapter 离线图片请求体映射 smoke 通过：已通过。
- `typecheck`、`build`、`desktop:build`、`git diff --check` 通过：已通过。
- `codex-oauth` 纯文本链路不回归：已由 App Server/turn-input 和 `smoke:codex-oauth-provider` 自动回归覆盖基础链路。
- `codex-oauth / gpt-5.5` 图片能力：已补内置能力目录和 pi-ai image block 映射，`smoke:model-capabilities` 显示 `text + image`，`smoke:codex-oauth-provider` 离线验证图片不会以本地路径或 data URL 泄露。
- Composer 粘贴附件：已支持输入框粘贴文件和图片；有路径文件复用现有准备逻辑，无路径剪贴板图片由 main 写入受控临时文件后进入同一附件草稿队列。
- 用户消息图片展示：已把 Composer 生成的图片缩略图带入发送后的附件快照；历史或工具事件只有本地图片路径时，可通过 main 生成缩略图并在消息附件条内展示；缩略图可点击打开当前窗口内大图预览。
- 支持图片的真实 provider/Profile 图片请求：已通过。`codex-oauth / gpt-5.5` 已真实发送图片，模型能读取图片内容。
- 文本模型图片拦截：已通过。文本模型发送图片会被拦截，不会偷偷漏发给上游。
- Desktop 当前用户消息图片附件条、小文本附件条和历史恢复：已通过。图片粘贴、图片点开预览、小文本文件和历史附件恢复均已真机复核。
- 历史恢复/中断返修：已通过。已落盘 `tool_use` 中断历史恢复为工具卡“已中断”；过早中断只剩用户消息时显示“本轮已中断，未产生可恢复回复。”，不再出现 `No response requested.`。

## 后续记录（追加）

- 第 1 轮：完成 MM-01。新增模型能力声明、能力解析器、Profile 覆盖和 `modelCapabilities` 输出；当前指针切到 MM-02。
- 第 2 轮：完成 MM-02。App Server `turn/start` 支持新 `content` 输入结构，并在创建 turn 前完成多模态能力校验；当前 Core 仍走文本 fallback，下一步进入 MM-03 做 Core user message 内容块归一化。
- 第 3 轮：完成 MM-03。Core 已能保存并传递 `text/image/file/audio` 内容块，同时保留 `text` fallback 给当前 provider 请求；下一步进入 MM-04 做 Desktop 附件草稿队列与能力提示。
- 第 4 轮：完成 MM-04。Desktop Composer 已有附件草稿队列、删除入口和按模型能力计算的发送状态；下一步进入 MM-05 做图片输入最小闭环，把图片通过 main/preload 安全读取后送入 `turn/start` 内容块。
- 第 5 轮：完成 MM-05。Desktop 图片附件已通过 main/preload 准备、生成缩略图，并在发送时进入 `turn/start.input.content` 的 image block；App Server 继续按模型能力校验，provider 真实图片请求映射留给 MM-07。当前指针切到 MM-06。
- 第 6 轮：完成 MM-06。小文本文件现在由 Desktop main 读取并转成 `text` block；大文本、二进制和压缩包默认只保留元信息，不会自动进入上下文。当前指针切到 MM-07，开始 provider adapter 多模态映射。
- 第 7 轮：完成 MM-07。内建 LLM Runtime 已支持图片内容部件，OpenAI Chat / Compatible 会生成 `image_url` part，Anthropic Messages 会生成 `image` block；图片 base64 只在 provider adapter 请求体中出现，错误诊断不输出 payload 或本地路径。当前指针切到 MM-08，开始用户消息附件展示、输出媒体归一化与历史恢复。
- 第 8 轮：完成 MM-08。Desktop display event 已支持多附件快照，当前发送的图片/小文本附件、历史用户内容块以及工具输出媒体都能复用紧凑附件条展示；附件展示只暴露元信息和复制路径，不输出 base64。验证通过：`typecheck`、`smoke:desktop-display-events`、`desktop:build`、`smoke:turn-input`。当前指针切到 MM-09，进入 smoke、真机验收和文档收口。
- 第 9 轮：开始 MM-09。已新增 MM-09 Goal，并完成自动收口验证：`typecheck`、`build`、`desktop:build`、`smoke:model-capabilities`、`smoke:turn-input`、`smoke:multimodal-provider-mapping`、`smoke:desktop-display-events`、`smoke:app-server`、`git diff --check` 全部通过。真机验收和真实 provider 图片请求暂未执行，下一步需要明确是否启动开发版 Desktop 并允许一次真实模型调用。
- 第 10 轮：开发版真机复查发现 `codex-oauth / gpt-5.5` 图片附件仍显示“不支持”。根因是 `gpt-5.5` 在内置能力目录仍是 text-only，且 `CodexOAuthProvider` 用户消息映射仍拒绝非文本内容。本轮已把 `gpt-5.5` 声明为 `text + image`，并把图片映射为 pi-ai `image` content block；`gpt-5.4` / `gpt-5.4-mini` 保持文本策略。验证通过：`typecheck`、`build`、`smoke:model-capabilities`、`smoke:codex-oauth-provider`、`smoke:multimodal-provider-mapping`、`smoke:turn-input`、`desktop:build`、`smoke:app-server`、`git diff --check`。
- 第 11 轮：补 Composer 粘贴附件返修。输入框 `onPaste` 已能提取剪贴板文件/图片并加入现有附件草稿队列；有路径文件继续走现有 `prepareAttachments`，无路径剪贴板图片通过 IPC 把二进制交给 main，main 写入 `userData/attachments/clipboard` 临时文件后返回 `file` source 和缩略图。Renderer 不保存 base64，普通日志不输出图片 payload。验证通过：`typecheck`、`desktop:build`。
- 第 12 轮：补发送后图片展示。`ComposerSubmitAttachment` 和 `AttachmentSnapshot` 已携带 `previewDataUrl`，用户消息附件条遇到图片会显示真实缩略图；如果恢复事件只有本地路径，renderer 通过 `ccr:image-preview` 请求 main 生成缩略图，不直接加载 `file://`。验证通过：`typecheck`、`desktop:build`、`smoke:desktop-display-events`、`git diff --check`。
- 第 13 轮：补图片点开查看。消息附件条里的图片缩略图现在是可点击预览入口，会在当前窗口打开大图层，支持点击背景、关闭按钮或 Esc 退出；点开时按需向 main 请求最大边 1600px 的较大预览，聊天流常驻状态仍保持小缩略图；复制路径按钮样式已和缩略图按钮分离，避免互相污染。
- 第 14 轮：完成 P23-FIX 自绘窗口标题栏第一版。为解决 Electron 原生 `titleBarOverlay` 造成的顶部线条不一致和图片预览遮罩无法覆盖问题，本轮把窗口控制按钮纳入 renderer 自绘，并通过 main/preload IPC 驱动最小化、最大化还原和关闭。验证通过：`desktop:build`、`typecheck`、`smoke:desktop-display-events`、`git diff --check`；额外 `typecheck:desktop` 不再出现本轮命名冲突，剩余失败仍为既有环境噪声。
- 第 15 轮：补聊天时间线滚动被拉回底部返修。自动贴底逻辑现在区分“正在跟随底部”和“用户主动上翻历史”：向上滚动会立即暂停跟随，只有重新接近底部或手动回到底部才恢复；新消息和图片/工具卡尺寸变化不会再覆盖用户上翻意图。验证通过：`desktop:build`、`typecheck`、`smoke:desktop-display-events`、`git diff --check`。
- 第 16 轮：补聊天 Markdown 代码块复制入口。普通消息中的三反引号代码块现在和 raw JSON / 日志块一样在右上角提供复制按钮，复制内容只包含代码本体。验证通过：`desktop:build`、`typecheck`、`smoke:desktop-display-events`。
- 第 17 轮：修复历史会话刷新过滤问题。App Server 现在只把当前 `active` thread 当作当前 session 过滤，旧 thread 在新建/恢复/开始 turn 后会转为 `closed`，因此不需要重启 Desktop 才能在历史列表看到刚成为历史的会话。验证通过：`typecheck`、`build`、`smoke:app-server-client`、`smoke:app-server`、`git diff --check`。
- 第 18 轮：修复历史恢复工具状态误判。历史回放现在会把 user role 中的 `tool_result` 正确并入对应工具卡，且历史来源的孤立 `tool_use` 不再显示“执行中”。验证通过：`desktop:build`、`typecheck`、`smoke:desktop-display-events`。
- 第 19 轮：修复 DeepSeek / OpenAI-compatible 悬空工具调用和 TodoWrite schema 问题。OpenAI Chat Completions adapter 发送前会补齐缺失 tool result，使用 `TOOL_CALL_INTERRUPTED` 恢复会话连续性；`TodoWrite` 已改为 `alwaysLoad`，首轮直接给模型完整 schema；非法 TodoWrite 输入显示为可见工具错误卡，不会静默映射成正常 Todo。验证通过：`typecheck`、`build`、`smoke:openai-chat-protocol`、`smoke:deepseek-provider`、`smoke:desktop-display-events`、`smoke:app-server-client`、`desktop:build`。已知 `typecheck:desktop` 仍失败在既有 `MACRO`、`Bun` 和可选依赖类型缺失问题，不是本轮新增。
- 第 19 轮：修复内部附件 raw JSON 泄露。`attachment` 内容块不再把完整 `content` 和嵌套 file 结构铺成黑色 JSON，只显示简短附件摘要，并补充识别 `file.filePath/displayPath` 生成附件快照。验证通过：`desktop:build`、`typecheck`、`smoke:desktop-display-events`。
- 第 20 轮：补 DeepSeek 会话死锁第二层返修。历史中连续 user 消息会被 `normalizeMessagesForAPI` 合并，合并后的同一条用户消息可能同时包含 `tool_result` 和新的用户文本；`claudeApiAdapter` 现在拆分时先输出 `tool` 再输出 `user`，避免 OpenAI-compatible 请求变成 `assistant -> user -> tool`。同时 `smoke:openai-chat-protocol` 覆盖迟到 tool result 会被替换为 `TOOL_CALL_INTERRUPTED` 并丢弃孤立 tool。验证通过：`typecheck`、`build`、`smoke:llm-claude-adapter`、`smoke:openai-chat-protocol`、`smoke:deepseek-provider`、`smoke:app-server-client`、`git diff --check`；开发版 CCR 已重启。
- 第 21 轮：补中断后工具卡状态收口。`turn/cancelled` 到达时，Desktop session state 会把同一 turn 中仍为 `running / streaming / pending / waiting_permission` 的工具卡标为 `interrupted`，显示“已中断”；其它 turn 的运行中工具和已完成工具不受影响。新增 `smoke:desktop-session-state` 固定该行为。验证通过：`typecheck`、`smoke:desktop-session-state`、`desktop:build`、`smoke:desktop-display-events`、`smoke:desktop-shell-cards`、`git diff --check`；开发版 CCR 已重启。
- 第 22 轮：补历史恢复中断状态返修。App Server 恢复历史时会先扫描整段 transcript，只有 `tool_use` 找不到对应 `tool_result` 时才标记为 `interrupted`，前端历史渲染会尊重该状态，不再把孤立历史工具调用写死成“成功”。新增 `smoke:app-server-client` 历史未闭合工具调用 fixture，并扩展 `smoke:desktop-session-state` 覆盖历史工具状态。验证通过：`typecheck`、`build`、`smoke:desktop-session-state`、`smoke:app-server-client`、`desktop:build`、`smoke:desktop-display-events`、`smoke:desktop-shell-cards`、`git diff --check`；开发版 CCR 已重启。
- 第 23 轮：补内部合成消息泄露返修。`No response requested.` 是恢复/降级用的内部占位，不应该作为助手消息显示。App Server 历史恢复现在会过滤合成中断、取消、拒绝和 no-response 消息；Desktop display-event 入口也会兜底隐藏单块合成消息，覆盖实时事件和历史事件两条路径。验证通过：`typecheck`、`build`、`smoke:desktop-session-state`、`smoke:app-server-client`、`desktop:build`、`smoke:desktop-display-events`、`smoke:desktop-shell-cards`、`git diff --check`；开发版 CCR 已重启。
- 第 24 轮：补“中断太早只剩用户消息”的历史恢复提示。若 transcript 里已经有 assistant `tool_use`，继续恢复为工具卡并显示“已中断”；若中断发生在助手回复或工具调用落盘前，历史里没有可恢复的命令内容，App Server 会把内部 `No response requested.` 转成中文系统提示“本轮已中断，未产生可恢复回复。”，避免空白历史。验证通过：`typecheck`、`build`、`smoke:desktop-session-state`、`smoke:app-server-client`、`desktop:build`、`smoke:desktop-display-events`、`smoke:desktop-shell-cards`、`git diff --check`。
- 第 25 轮：完成 MM-09 真机验收。用户已确认 `codex-oauth / gpt-5.5` 真实图片请求能让模型读取图片，文本模型发送图片会被拦截，小文本文件、图片粘贴、图片点开预览和历史恢复/中断返修均已复测通过。当前进入提交前收口：补 `CHANGELOG.md`、确认 diff 分组、跑最终验证，然后 commit + push；本阶段不打包发布。
