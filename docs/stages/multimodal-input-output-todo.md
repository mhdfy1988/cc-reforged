# CCR 多模态输入输出 Todo

## 目标

把 CCR 从“纯文本输入 + 工具/文件事件展示”推进到“文本、图片、文件附件可随会话输入、展示、恢复，并按模型能力安全发送”的阶段。

参考设计：[CCR 多模态输入输出设计](../architecture/multimodal-input-output-design.md)。

多供应商、模型配置档案、API Key、协议选择和供应商切换不在本文推进，单独见 [CCR 多供应商模型与协议接入 Todo](./multi-provider-model-management-todo.md)。

## 当前任务列表（实时）

- [ ] MM-00 现有 P21 文件/附件能力复核
- [ ] MM-01 App Server 多模态输入协议
- [ ] MM-02 Core user message 内容块归一化
- [ ] MM-03 Desktop 输入框附件草稿状态
- [ ] MM-04 图片预览与附件消息展示
- [ ] MM-05 发送前能力校验与错误提示
- [ ] MM-06 Provider adapter 图片输入映射
- [ ] MM-07 历史会话恢复与附件缺失状态
- [ ] MM-08 文件附件第一版边界
- [ ] MM-09 smoke、真机验收和文档收口

## 当前指针

- 进行中：MM-00 现有 P21 文件/附件能力复核
- 当前正在做：确认 P21 已有 `FileSnapshot` / `AttachmentSnapshot` / `ReferenceSnapshot`、输入框 `+`、附件占位和 display-event fixture 哪些可以复用。
- 完成后下一项：MM-01 App Server 多模态输入协议。

## 关键规则

- 多模态专项不做 provider 配置页，不做密钥管理，不做供应商切换。
- 多模态只消费当前模型能力声明，不自己判断 provider 是否真实可用。
- 旧 `input.text` 继续兼容，新协议通过 `input.content` 扩展。
- 第一版优先图片输入闭环，文件附件先做元数据、卡片、路径引用和后续扩展口。
- 不支持图片的模型必须发送前拦截。
- 不把图片 base64、密钥、token 写入普通日志。
- 不自动读取大文件全文。
- 历史恢复时附件缺失只能影响预览，不能影响整条消息渲染。

## 接下来安排

- 第一段：MM-00 到 MM-02，先把现有能力和 Core/App Server 协议定稳。
- 第二段：MM-03 到 MM-05，落 Desktop 附件选择、预览、发送前校验。
- 第三段：MM-06 到 MM-08，接 provider adapter、历史恢复和文件附件边界。
- 第四段：MM-09，补 smoke、真机验证和文档索引。

## MM-00 现有 P21 文件/附件能力复核

状态：待开始。

目标：

- 确认 P21 已完成的文件、附件、引用展示模型。
- 明确哪些 UI、fixture、smoke 可以直接复用。
- 避免重新造一套附件卡片和路径安全模型。

建议扫描入口：

- [desktop-file-attachment-reference-field-map.md](../architecture/desktop-file-attachment-reference-field-map.md)
- [fileEvents.ts](D:/agent_project/claude-code-reforged/apps/desktop/src/renderer/src/domain/fileEvents.ts)
- [displayEvents.ts](D:/agent_project/claude-code-reforged/apps/desktop/src/renderer/src/domain/displayEvents.ts)
- [ChatPage.tsx](D:/agent_project/claude-code-reforged/apps/desktop/src/renderer/src/components/pages/ChatPage.tsx)
- [Composer.tsx](D:/agent_project/claude-code-reforged/apps/desktop/src/renderer/src/components/layout/Composer.tsx)

验收：

- 列出可复用的附件/文件展示模型。
- 明确输入框 `+` 当前只做了什么，占位和真实发送差在哪里。
- 明确多模态第一版不需要重做哪些 P21 能力。

## MM-01 App Server 多模态输入协议

状态：待开始。

目标：

- 扩展 `turn/start` 输入结构。
- 保持旧纯文本客户端兼容。

计划交付：

- `input.content` schema。
- `text` 到 `content` 的兼容归一化。
- 图片、文件内容块的最小类型。
- App Server 协议文档更新。

验收：

- 旧 `input.text` 仍能发送纯文本。
- 新 `input.content` 能表达文本 + 图片 + 文件附件元数据。
- smoke 覆盖旧协议和新协议解析。

## MM-02 Core user message 内容块归一化

状态：待开始。

目标：

- Core 内部不再假设用户消息只有字符串。
- Query / Tool 主循环接收统一内容块。

计划交付：

- Core turn input 类型扩展。
- 用户消息创建逻辑支持内容块。
- 纯文本路径兼容。
- 多模态内容块传递到 LLM Runtime 前的统一校验入口。

验收：

- 纯文本 turn 不回归。
- 内容块 turn 能进入 Core message。
- 不支持的内容类型不会直接落到 provider 请求。

## MM-03 Desktop 输入框附件草稿状态

状态：待开始。

目标：

- 输入框支持真实选择文件并维护草稿附件。

计划交付：

- `DraftAttachment` 状态。
- 添加、删除附件。
- 文件名、大小、mime type 展示。
- 草稿附件错误状态。

验收：

- 用户能选择图片/文件。
- 附件发送前可以删除。
- 大小、类型和缺失状态能展示。
- 不影响纯文本发送。

## MM-04 图片预览与附件消息展示

状态：待开始。

目标：

- 图片在草稿区和消息区都有可见预览。

计划交付：

- 图片缩略图。
- 用户消息附件卡片。
- 助手消息中的图片/文件引用展示占位。
- 历史消息渲染兼容。

验收：

- 发送前能看到图片预览。
- 发送后用户消息中能看到图片。
- 非图片文件显示文件卡片。
- 附件展示复用 P21 的展示模型，不另起一套。

## MM-05 发送前能力校验与错误提示

状态：待开始。

目标：

- 当前模型不支持多模态时，发送前明确拦截。

计划交付：

- 当前 provider/model capability 读取。
- 图片支持校验。
- mime type / size / count 校验。
- 错误提示文案。

验收：

- 不支持图片时不会创建 turn。
- 支持图片时允许进入 Core。
- 错误提示可读，不暴露内部协议名。

## MM-06 Provider adapter 图片输入映射

状态：待开始。

目标：

- 把 CCR 内容块转换成 provider 请求格式。

计划交付：

- OpenAI Responses 图片映射。
- OpenAI Chat Completions / Compatible 图片映射。
- Codex OAuth 图片支持能力确认和映射或拦截。
- Anthropic Messages 扩展点。

验收：

- 至少一个支持图片的 provider 能完成真实图片请求。
- 不支持图片的 provider 不会收到图片请求。
- usage、错误和 stream 事件仍能归一化。

## MM-07 历史会话恢复与附件缺失状态

状态：待开始。

目标：

- 历史会话能稳定展示附件消息。

计划交付：

- 附件元数据持久化。
- 本地文件存在性检查。
- 文件缺失状态。
- 历史恢复 display-event fixture。

验收：

- 恢复历史后能看到附件卡片。
- 本地文件还在时能预览。
- 本地文件缺失时显示缺失状态。
- 附件缺失不导致消息渲染失败。

## MM-08 文件附件第一版边界

状态：待开始。

目标：

- 明确文件附件第一版只做什么。

计划交付：

- 文件元数据发送。
- 小文本文件是否转文本块的规则。
- 大文件拦截规则。
- PDF、压缩包、二进制文件暂缓说明。

验收：

- 文件附件不会被自动全文塞入模型。
- 文件卡片和路径引用可见。
- 后续扩展 PDF / 文本解析时有明确入口。

## MM-09 smoke、真机验收和文档收口

状态：待开始。

目标：

- 建立多模态回归护栏。

计划交付：

- App Server 协议 smoke。
- Desktop display-event fixture。
- 图片附件真机验证。
- provider capability smoke。
- 文档索引更新。

验收：

- `npm.cmd run typecheck -- --pretty false` 通过。
- `npm.cmd run build` 通过。
- App Server 新旧输入协议 smoke 通过。
- Desktop 附件展示 smoke 通过。
- `codex-oauth` 纯文本链路不回归。
