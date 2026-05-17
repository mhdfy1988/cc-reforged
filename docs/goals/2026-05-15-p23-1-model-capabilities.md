# Goal: P23-1 模型能力声明、能力来源与能力解析器

## 目标

让 CCR 在发送多模态消息之前，能够基于 `profileId + model + apiMode` 得到一份明确、可解释、可覆盖的模型能力声明。

第一版只解决“这个模型在当前 Profile 下能不能接收/输出某类内容”这个前置问题，不直接实现图片上传、文件上传、实时音频或图像生成。

## 为什么先做这个

同一个模型名在不同官方 provider、OpenAI Compatible 转发、第三方网关里能力可能不同。只按模型名判断会导致：

- 文本模型误显示图片入口。
- 支持图片的模型被当成纯文本模型。
- 第三方转发禁用了图片、工具调用或结构化输出，但 UI 和发送层不知道。
- 后续多模态输入、输出渲染和错误提示都缺少统一依据。

因此 P23 的第一步必须先把能力解析做成稳定基础，再继续做输入组件、消息协议和 provider 适配。

## 第一版范围

1. 新增统一的模型能力结构 `ModelCapabilities`。
2. 新增内置能力目录，能力信息来自官方文档和当前项目确认过的 provider 语义。
3. 允许 Profile 覆盖模型能力，解决 OpenAI Compatible / 第三方中转无法只靠模型名判断的问题。
4. 未命中内置目录且没有 Profile 覆盖时，默认降级为纯文本能力。
5. 将解析后的能力接入当前模型状态或模型列表，让前端后续可以直接消费。
6. 增加最小验证脚本，覆盖官方模型、Profile 覆盖、同名模型不同 Profile、未知模型默认值。

## 明确不做

- 不做远程模型目录读取。
- 不做探测式能力判断。
- 不做图片上传 UI。
- 不做 provider 图片请求体映射。
- 不做实时音频、视频、图像生成。
- 不做模型自动推荐或能力排行榜。

这些可以作为 P23 后续阶段增强，不能混进 P23-1。

## 能力来源

### 1. 内置能力目录

仓库内维护版本化的能力目录，按 provider / apiMode / model 记录模型能力。

适合官方 provider，例如 OpenAI、Anthropic、Gemini、DeepSeek、MiniMax 等明确文档可确认的模型。

### 2. Profile 覆盖

Profile 覆盖优先级高于内置目录。覆盖对象必须绑定当前 Profile，不能只绑定模型名。

典型场景：

- OpenAI Compatible 转发只允许文本。
- 某个第三方网关禁用了图片输入。
- 同名 `gpt-4o` 在一个 Profile 支持图片，在另一个 Profile 只支持文本。
- 某个 Profile 的工具调用或结构化输出能力被关闭。

### 3. 默认能力

未命中内置目录且没有覆盖时，默认：

- 只支持文本输入。
- 只支持文本输出。
- 不声明图片、音频、文件、工具调用、结构化输出等高级能力。
- `source` 标记为 `default`。

## 能力结构要求

`ModelCapabilities` 至少要表达：

- 输入模态：文本、图片、文件、音频。
- 输出模态：文本、图片、音频。
- 工具调用能力。
- 结构化输出能力。
- 图片限制：最大图片数量、最大图片大小、支持的 MIME 类型。
- 来源：内置目录、Profile 覆盖、默认值。
- 解析说明：用于 UI 或日志解释“为什么得到这个能力”。

字段命名可以按项目现有 TypeScript 风格调整，但语义不能缩水。

## 解析规则

1. 读取当前 Profile。
2. 根据 `profileId + model + apiMode` 查 Profile 覆盖。
3. 如果有覆盖，用覆盖结果并标记 `source = profile_override`。
4. 如果没有覆盖，按 provider / apiMode / model 查内置能力目录。
5. 如果命中内置能力，用内置能力并标记 `source = builtin`。
6. 如果仍未命中，返回默认纯文本能力并标记 `source = default`。

Profile 覆盖可以是完整覆盖，也可以是局部覆盖；第一版优先选择实现成本低、行为清晰的方案。如果采用局部合并，必须在代码里保证数组字段和布尔字段合并规则明确。

## 二次验证迭代

实现后必须做一次二次验证，不只是跑类型检查。

验证样例至少包含：

- 官方纯文本模型。
- 官方图片输入模型。
- OpenAI Compatible / 第三方转发纯文本 Profile。
- 同一个模型名在两个 Profile 下得到不同能力。
- 未知模型回落到默认纯文本能力。

如果验证时发现 `ModelCapabilities` 表达不了真实场景，必须先反向更新结构和文档，再继续后续多模态输入实现。

## 验收标准

- 代码里有统一能力类型和解析入口。
- Profile 配置结构允许声明能力覆盖。
- 当前模型状态或模型列表能返回解析后的能力。
- 未知模型不会报错，会安全降级为文本。
- 验证脚本覆盖上述样例，并能在本地跑通。
- `docs/stages/multimodal-input-output-todo.md` 的当前指针仍指向 P23 主线，不新增重复 active todo。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run smoke:model-capabilities
git diff --check
```

如果项目既有 typecheck 暂时存在历史问题，需要在本轮总结里说明实际运行结果和替代验证。

## 后续 goal 管理规则

以后每个阶段性目标都放到 `docs/goals/`。

命名格式：

```text
YYYY-MM-DD-p<阶段号>-<简短主题>.md
```

Goal 文档只记录本阶段“要达成什么、为什么、范围、非目标、验收和验证”；实时任务推进继续放在 `docs/stages/*-todo.md`，避免目标文档和 todo 文档互相重复。

## 完成记录

状态：已完成。

落地内容：

- 新增 `LlmModelCapabilities`、`LlmModelCapabilityOverride` 和能力来源枚举。
- 新增 `src/services/llm/modelCapabilities.ts`。
- Profile 配置新增 `capabilityOverrides`。
- `config/get`、`model/availability`、`model/list` 已返回 `modelCapabilities`。
- 新增 `smoke:model-capabilities`，覆盖官方文本模型、官方图片输入模型、第三方中转文本覆盖、同名模型不同 Profile 和未知模型默认文本。

验证：

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd run smoke:model-capabilities
npm.cmd run smoke:llm-config
npm.cmd run smoke:llm-runtime-status
npm.cmd run desktop:build
git diff --check
```

补充说明：`npm.cmd run typecheck:desktop` 当前仍失败在既有 `MACRO`、Bun 和可选原生依赖类型缺失问题，不是本阶段新增文件引起。
