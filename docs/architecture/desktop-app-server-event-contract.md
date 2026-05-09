# CCR Desktop 与 App Server 事件字段契约

## 1. 文档目标

本文档约束 Desktop 如何消费 App Server 通知，避免前端为了展示效果去猜业务字段。

核心结论：

```text
Core 产生运行事件
-> App Server 映射成稳定 JSON-RPC notification
-> Desktop renderer 归一化成 DisplayEvent
-> UI 组件只消费 DisplayEvent
```

Desktop 允许做展示归一化，但不允许重新判断权限、不允许执行工具、不允许拼 provider 请求，也不允许发明第二套 thread / turn / item 状态机。

## 2. 当前已补字段

本轮先补最基础、最容易误猜的运行定位字段：

| 字段 | 当前来源 | 当前处理 |
| --- | --- | --- |
| `itemId` | `item/started`、`item/delta`、`item/completed` | 作为展示事件主键 |
| `threadId` | `turn/started`、`item/started`、`item/delta`、`item/completed` | `item/completed` 已补齐，不再只靠前端 metadata |
| `turnId` | `turn/started`、`item/started`、`item/delta`、`item/completed` | `item/completed` 已补齐，用于后续 turn 详情面板 |
| `contentIndex` | content block 顺序或 provider block index | 当前 renderer 在归一化时保留第一版索引 |
| `toolUseId` | `tool_use.id` / `toolUseId` / `toolUseID` | 工具卡和 TodoWrite 浮层通过 `eventContract` 统一提取 |
| `raw` | 原始 params / item / block | 仅进入详情、日志和 fixture，不默认铺到聊天主界面 |
| `permissionRequestId` | 权限请求与工具卡关联 | `permission/requested.permissionRequestId` | Desktop 只做状态关联，不重新判权 |

对应实现：

- `src/core/types.ts`：`item_completed` 事件契约新增 `threadId`、`turnId`。
- `src/app-server/coreEventMapper.ts`：`item/completed` notification 输出 `threadId`、`turnId`。
- `apps/desktop/src/renderer/src/domain/eventContract.ts`：统一抽取展示事件身份字段。
- `apps/desktop/src/renderer/src/domain/toolEvents.ts`：工具快照保留 `identity` 和 `raw`。
- `apps/desktop/src/renderer/src/domain/todoEvents.ts`：TodoWrite 快照保留 `identity`。

## 3. 暂未补齐的字段缺口

下面字段暂不由 Desktop 自己推导，后续进入 P19-P24 时按真实能力逐步补 App Server contract。

| 字段 | 用途 | 暂定来源 | 当前处理 |
| --- | --- | --- | --- |
| `status` | 区分运行中、成功、失败、取消、等待权限 | Core item / tool lifecycle | P20 已在 Desktop 工具卡补第一版状态机 |
| `risk` | 权限风险、命令风险、文件风险 | Core permission / tool policy | P20 仅展示已有字段，不从命令字符串推导 |
| `latencyMs` | turn 耗时 | Core 用 `startedAt/completedAt` 计算 | P19 已补到 turn metadata；单工具耗时继续等待 Core 字段 |
| `usage` | token、上下文、计费粗略信息 | provider response / Core run summary | P19 已补到 turn metadata，provider 不支持时允许缺失 |
| `requestId` | provider 请求排障 | LLM runtime / App Server | P19 已补到 turn metadata，provider 不返回时显示 `未返回` |
| `contextCompacted` | 手动或自动压缩事件 | Core `context_compacted` -> App Server `context/compacted` | P26 已补轻量系统事件，Desktop 只展示摘要，不展示原始 compact JSON |
| `contextStatus` | 当前上下文用量与 memory/compact 状态 | App Server `context/status`、`compact/status`、`memory/session/status` | P26 已补顶部状态条和运行详情入口 |
| `fileChange` | 写文件、patch、diff 预览 | 工具输入 / 工具结果结构化事件 | P21-2 已补 `FileSnapshot`；P21-3 已从 `Write/Read/Edit` 归一化 |
| `fileReference` | 文件引用、代码行引用、搜索命中 | 工具输入 / 工具结果结构化事件 / 引用归一化 | P21-2 已补 `ReferenceSnapshot`；P21-3 已从 `Glob/Grep` 归一化；P21-5 再补交互 |
| `attachment` | 用户上传文件、工具返回附件、多模态占位 | 用户选择 / 工具结果 / MCP 资源 | P21-2 已补 `AttachmentSnapshot` 展示模型；P21-6 再补输入框入口 |
| `structuredOutput` | JSON / schema / 表格 | 模型输出或工具结果 schema | 暂缺，进入 P22 后补 |
| `media` | 图片、截图、附件 | 工具结果 / 多模态 block | 暂缺，进入 P23 后补 |

## 4. Renderer 归一化规则

Desktop renderer 第一版只做三件事：

1. 把 notification params、item metadata、content block 合并成 `DisplayEventIdentity`。
2. 把 TodoWrite、普通工具、thinking summary、assistant text 分流到不同展示事件。
3. 如果缺少关键字段，就记录 `missingFields`，不在 UI 层猜测。

不变式：

- `item/completed` 必须能定位到 `threadId`、`turnId`、`itemId`。
- `tool_use`、`tool_result` 和 `progress` 必须进入 `ToolSnapshot`，不能直接把 raw JSON 当正文。
- TodoWrite 必须进入任务浮层，不能进入主聊天流。
- raw thinking 默认不展示，只有 reasoning summary 类内容可进入用户可见思考摘要。
- 权限请求只能来自 App Server / Core，renderer 不重新判断 allow / deny。

## 5. 后续接入顺序

第一轮已经补齐运行定位字段。下一步按展示能力推进：

1. P19 已补 turn 状态、usage、stop reason、request id 的控制信息面板，字段来源见 [CCR Desktop 运行元数据字段来源表](./desktop-runtime-metadata-field-map.md)。
2. P20 已补工具卡字段第一版，包括工具分类、工作目录、shell/provider、权限关联、结果详情和错误分类；完整工具耗时等待 Core 字段。
3. P21 已先补文件、附件和引用展示模型；后续继续补工具归一化、文件卡片和安全 preload 能力，不从普通 stdout 里硬解析文件路径。
4. P22 补结构化输出 schema，不把 JSON 只当长文本。
5. P23 补多模态媒体 block。
6. P24 补错误分类、限流、模型拒答和安全拦截。
7. P26 已补原生上下文、压缩和 SessionMemory 状态桥接；后续若继续扩展，只能增加脱敏 metadata，不把 memory 正文或系统提示正文推给 renderer。

## 6. 验收方式

字段契约变更后至少验证：

- `npm.cmd run typecheck:desktop -- --pretty false`
- `npm.cmd run desktop:build`
- `npm.cmd run smoke:desktop-display-events`

涉及 Core / App Server 事件契约时，还需要补：

- `npm.cmd run typecheck -- --pretty false`
- `npm.cmd run build -- --pretty false`
