# CCR Desktop 通用卡片渲染重构计划

> 当前边界：本文讨论 Desktop Renderer 的通用卡片骨架和视觉组件复用，不改变 App Server 展示协议。展示事实仍以 `ThreadDisplaySnapshot.items` / `ThreadDisplayPatch.operations` 为准，协议边界见 [CCR ThreadDisplay Reducer 契约](./thread-display-reducer-contract.md)。

## 背景

Desktop 当前已经有统一展示协议，例如 `DisplayEvent`、`toolSnapshot`、`fileSnapshot`、`attachmentSnapshots`、`errorSnapshot` 和 `contentBlocks`。但渲染层仍然主要按卡片类型分别实现，例如工具卡、文件卡、错误卡、系统提示卡、权限卡、附件预览卡等各自处理标题、状态、按钮、展开区和元信息。

这里的 `DisplayEvent` 是 Renderer 视觉模型，不是 App Server 历史 / 实时展示事实源。当前事实源是 `ThreadDisplaySnapshot.items` 和 `ThreadDisplayPatch.operations`；本计划只整理这些事实进入 React 组件后的通用外壳。

这种方式适合快速补齐特殊能力，但长期会带来三个问题：

- 同一种状态语言在不同卡片里重复实现，容易出现文案、颜色、位置不一致。
- 同一种生命周期事件，例如等待、执行中、完成、失败、取消，需要在多个组件里各自补逻辑。
- 新增工具、附件、媒体、权限、计划等卡片时，容易继续复制外壳和操作区代码。

后续重构目标不是把所有卡片强行做成一个大组件，而是抽出稳定的通用卡片骨架，并允许特殊类型保留专用内容渲染器。

## 目标

- 建立统一卡片骨架，复用头像、标题、状态、元信息、操作区、详情区和展开逻辑。
- 保留特殊卡片的专用主体，例如图片预览、权限确认、错误诊断、Todo 列表、diff 展示、计划审批。
- 让工具生命周期、模型输出、附件输出和系统事件共用一套状态语言。
- 降低新增卡片类型的成本，避免每次从零写外壳、状态和按钮。
- 不改变 App Server 协议语义；重构优先发生在 Desktop renderer 的展示组件层。

## 分层方案

```text
ThreadDisplaySnapshot.items / ThreadDisplayPatch.operations
  -> DisplayEvent / snapshots / contentBlocks
  -> CardViewModel 通用卡片视图模型
  -> GenericCardFrame 通用骨架
  -> SpecializedCardBody 特殊主体渲染器
```

第一层：展示事实输入

- `ThreadDisplaySnapshot.items`
- `ThreadDisplayPatch.operations`

第二层：Renderer 展示事件

- `DisplayEvent.type`
- `toolSnapshot`
- `fileSnapshot`
- `attachmentSnapshots`
- `errorSnapshot`
- `compactSnapshot`
- `contentBlocks`

第三层：卡片视图模型

建议新增类似 `resolveCardViewModel(event)` 的集中入口，输出面向 UI 的稳定结构：

```ts
type CardViewModel = {
  id: string
  kind: CardKind
  avatar: MessageAvatarDescriptor
  title: string
  subtitle?: string
  status?: CardStatusView
  meta?: CardMetaItem[]
  actions?: CardAction[]
  details?: CardDetailSection[]
  body: CardBodyDescriptor
  tone?: CardTone
  collapsible?: boolean
}
```

第四层：通用骨架

`GenericCardFrame` 只负责稳定布局：

- 头像
- 标题区
- 状态角标
- 元信息行
- 主体 slot
- 操作按钮区
- 展开 / 收起
- 详情区
- 错误 / 警告 / 运行中色调

第五层：特殊主体渲染器

不同 `body.type` 分发到专用组件：

- `text`
- `tool`
- `imageAttachment`
- `fileChange`
- `permission`
- `errorDiagnostics`
- `todoList`
- `planApproval`
- `rawJsonDiagnostic`

## 可通用的能力

这些能力应从具体卡片里抽出来：

| 能力 | 说明 |
| --- | --- |
| 头像 | 复用 `MessageAvatar` 与头像分类解析 |
| 标题 / 副标题 | 工具名、文件名、系统事件标题、模型名都进入同一标题模型 |
| 状态 badge | 等待、运行中、成功、失败、已取消、已拒绝、超时 |
| 耗时 | 运行中动态耗时、完成后固定耗时 |
| 操作按钮区 | 打开、定位、复制、另存、重试、展开 |
| 元信息行 | provider、model、mime、路径、cwd、token、大小 |
| 展开详情 | raw input、raw result、stdout/stderr、诊断信息 |
| 路径动作 | 文件、附件、生成物都复用路径动作 |
| 显式诊断展示 | 未知事件、未知工具、协议缺口统一展示为诊断 / 错误卡 |

## 保留专用的能力

这些能力不适合塞进完全通用组件，只挂在通用骨架的主体 slot 里：

| 专用主体 | 原因 |
| --- | --- |
| 图片 / 媒体预览 | 有缩略图、打开、另存、复制、远程 URL 与本地文件差异 |
| 权限确认 | 有允许、拒绝、规则保存、参数修改等交互 |
| 错误诊断 | 有分类、建议动作、敏感信息脱敏、复制诊断 |
| Todo 列表 | 有条目状态、activeForm、完成度 |
| 文件 diff / 编辑 | 需要 diff 布局和变更摘要 |
| 计划审批 | 有计划正文、批准/拒绝、反馈 |
| 浏览器 / Web 预览 | 有 URL、来源、截图或页面元信息 |

## 状态与生命周期原则

通用卡片骨架必须承认“同一个展示项 ID 的多条 patch 是同一张卡的视觉演进”：

- 初始 patch 创建占位卡，例如 `queued`、`running`、`waiting_permission`。
- 后续同 `itemId` patch 更新原卡，而不是新增重复卡。
- 结束事件补齐 `result`、`output`、`error`、`durationMs`、`completedAt`。
- 特殊类型只解释最终 payload，例如图片生图把 `result` 解释成图片文件。

这条原则适用于工具调用、Responses `image_generation_call`、权限请求、文件操作和后续媒体生成能力。工具 lifecycle 的跨事件归并在 App Server reducer 内完成，Renderer 只处理 reducer 输出后的同 ID 视觉更新。

## 第一版落点

第一版不做大规模重写，建议按以下顺序推进：

1. 先抽 `CardStatusView`、`CardMetaItem`、`CardAction` 三个纯 UI view model。
2. 从 `ToolCard` 和 `FileCard` 开始复用状态、元信息和操作区。
3. 把 `AttachmentImagePreview` 的动作区接入通用 `CardAction`。
4. 把 `ErrorCard` 的标题、状态和操作按钮接入通用骨架，诊断主体保留专用。
5. 等工具、文件、附件三类稳定后，再考虑权限卡和计划卡。

## 不变式

- 不为了通用而牺牲特殊卡片的信息密度。
- 不把业务解析逻辑放进 React 组件深处；解析集中在 domain/view-model 层。
- 不用外层 `message.type` 单独决定渲染；必须结合 inner content block、snapshot 和 identity。
- 不让 unknown 类型空白；未知事件必须进入显式诊断 / 错误卡。
- 不改变 Core、App Server 协议，只重排 Desktop 渲染模型。

## 验收清单

- 工具卡、文件卡、附件卡、错误卡视觉外壳一致。
- 同一状态在不同卡片中颜色、文案、位置一致。
- 图片、权限、错误、Todo、计划等特殊主体仍保留专用展示。
- 新增一种普通工具卡不需要复制完整卡片外壳。
- 回归覆盖至少包含：运行中工具、失败工具、生成图片、文件路径动作、错误诊断、未知事件诊断卡。
