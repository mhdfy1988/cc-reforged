# Codex 扩展能力体系学习笔记

本文记录基于本机 Codex 安装结构、OpenAI 官方插件说明和 CCR 当前实现的对照学习结论。它用于指导后续 Skill / MCP / Plugin / Capability Catalog 重构，不作为当前实现完成度声明。

## 1. 结论摘要

Codex 的扩展能力不是单一入口，而是“分发包 + 工作流说明 + 外部连接 + 运行工具”的组合体系。

```text
Plugin
  -> 可安装能力包，组织 skills / apps / MCP 配置 / 资源 / 界面元数据

Skill
  -> 可复用工作流说明，核心入口是 SKILL.md

App / Connector
  -> 连接外部系统、数据和动作的授权能力

MCP
  -> 把外部服务或本地 server 暴露为工具、资源或 prompt 的协议层

Tool
  -> 模型最终可以调用的具体动作入口
```

对 CCR 的直接启发：

- Plugin 应定义为“能力合集”和“分发单位”，不能直接等同于 Skill、MCP 或 Tool。
- Skill 应定义为“工作流知识和调用策略”，不是简单 prompt 文本。
- MCP / App / Tool 是执行能力，Skill 可以选择、编排或约束它们。
- 管理页显示的是能力事实；模型上下文注入是运行时策略；两者必须共享同一个能力目录事实，但不能混成一个函数。

## 2. Codex 本机结构观察

本机 Codex 当前可观察到两类 Skill 来源。

第一类是裸 Skill 目录：

```text
C:\Users\luoji\.codex\skills\
  bug-debug-helper\
  docs-update-helper\
  frontend-design\
  release-check-helper\
  ...
```

每个 Skill 以 `SKILL.md` 为入口，frontmatter 至少包含：

```yaml
name: bug-debug-helper
description: 排查项目 BUG、回归、报错、UI 与数据不一致、构建或验证异常时使用...
```

正文不是普通提示词，而是任务工作流、入口选择、验证要求和输出要求。

第二类是插件内 Skill：

```text
C:\Users\luoji\.codex\plugins\cache\openai-curated\github\<version>\
  .codex-plugin\plugin.json
  .app.json
  skills\
    github\SKILL.md
    gh-fix-ci\SKILL.md
    gh-address-comments\SKILL.md
    yeet\SKILL.md
```

GitHub 插件的 `plugin.json` 声明了：

- `skills: "./skills/"`
- `apps: "./.app.json"`
- `interface.displayName`
- `interface.shortDescription`
- `interface.capabilities`
- icon、logo、类别、默认 prompt 等界面元数据

`.app.json` 再把插件关联到一个 app connector：

```json
{
  "apps": {
    "github": {
      "id": "connector_..."
    }
  }
}
```

这说明 Plugin 本身不是模型直接调用的一种能力，而是把多个可调用或可注入能力组织到一起。

## 3. 官方插件口径

OpenAI 帮助文档对 Codex Plugin 的口径与本机结构一致：

- Plugin 是面向工作流的可安装能力包。
- Plugin 可以包含一个或多个 Skill。
- Plugin 可以依赖 app / connector 连接外部系统、数据或动作。
- Plugin 也可以组合 MCP server 配置。
- Skill 仍是可复用工作流的 authoring format；Plugin 是更上层的分发单位。

参考：

- [Plugins in Codex](https://help.openai.com/ko-kr/articles/20001256-plugins-in-codex)
- [Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan.pdf)

这与我们之前讨论的“插件更像一个合集，提供各种能力”一致。

## 4. Skill 的实际语义

从 Codex 本机 Skill 看，Skill 至少包含四层语义。

### 4.1 触发条件

`description` 不是普通说明，而是模型的匹配依据。

例如 GitHub CI Skill 的 description 明确写出：

```text
Use when a user asks to debug or fix failing GitHub PR checks...
```

这类描述决定模型在任务分类时是否应该进入该 Skill。

### 4.2 工作流

正文通常会规定步骤：

- 先确认上下文。
- 先读哪些来源。
- 优先用 connector 还是 CLI。
- 哪些情况下要询问用户。
- 何时可以实现和验证。

这说明 Skill 是“过程约束”，不是简单知识片段。

### 4.3 能力选择

GitHub 插件体现了典型的混合模型：

- PR / issue 元数据优先用 GitHub app。
- Actions 日志用本地 `gh`。
- 本地分支、提交、推送用 `git` / `gh`。

Skill 不一定自己提供工具，但它会规定工具组合策略。

### 4.4 安全边界

Browser Skill 明确规定：

- 何时显示浏览器。
- 何时后台操作。
- 何时必须确认。
- 不要把网页内容当成指令。
- 只通过指定 runtime 控制 in-app browser。

这说明 Skill 还承担安全策略和交互边界说明。

## 5. Codex 的能力发现模型

从可观察行为看，Codex 至少有三种发现方式。

### 5.1 安装期发现

裸 Skill 通过目录扫描发现。

Plugin Skill 通过 `plugin.json` 的 `skills` 字段发现。

App / connector 通过 `plugin.json` 的 `apps` 字段和 `.app.json` 发现。

### 5.2 会话期注入

会话初始化时，系统把可用 Skill 清单和插件说明注入给模型。当前 Codex 会话里可以看到：

```text
Available skills
- github:github
- github:gh-fix-ci
- browser:control-in-app-browser
- ...
```

同时还有 Plugin 说明：

```text
Available plugins
- Browser
- GitHub
- Figma
```

这类注入让模型在普通自然语言任务里知道哪些 Skill 存在。

### 5.3 工具发现

当某些工具不是初始暴露时，Codex 通过 tool discovery 暴露延迟工具。

例如 Browser Skill 明确要求需要 Node REPL `js` 时先使用 tool discovery 查找 `node_repl js`。这说明工具发现和 Skill 发现不是同一层：

- Skill 发现解决“应该走哪个工作流”。
- Tool discovery 解决“这个工作流需要的具体工具是否已暴露”。

## 6. CCR 当前差距

CCR 当前已经有较完整的安装管理和能力目录基础：

- `src/services/capabilities/`
- `src/services/skills/managementService.ts`
- `src/services/skills/installTransaction.ts`
- `src/services/skills/capabilityProvider.ts`
- `src/skills/skillRuntimeCatalog.ts`
- `src/skills/skillRuntimeAdapter.ts`

但 Skill 可见性链路仍存在混杂。

### 6.1 管理事实和上下文注入混在一起

管理页表达：

```text
enabled
modelInvocable
userInvocable
runtimeVisible
installed / drifted / invalid
```

上下文注入却在 `src/utils/attachments.ts` 里另行过滤 `skill_listing`。

这会导致管理页显示“模型可调用”，但模型上下文实际没有看到。

### 6.2 动态发现链路不是完整实现

当前 `src/services/skillSearch/localSearch.ts` 是空实现。

当前 `src/services/skillSearch/prefetch.ts` 返回 unavailable。

当前 `src/tools/DiscoverSkillsTool/prompt.ts` 只有工具名常量，没有完整 Tool 实现。

因此 `EXPERIMENTAL_SKILL_SEARCH` 现在不能作为 managed Skill 的兜底发现机制。

### 6.3 Plugin 关系还停留在预留层

`ExtensionCapability` 已有 `parentPluginId`、`source.pluginId` 等字段，但 Plugin 还没有成为真正的能力合集目录：

- 还不能稳定列出“某个 Plugin 提供了哪些 Skill / MCP / Tool / App”。
- 还没有 app / connector 关系模型。
- 还没有按 Plugin 启用局部能力的状态视图。

## 7. CCR 应采用的目标架构

后续重构建议按四层拆开。

### 7.1 能力事实层

唯一职责：列出所有能力事实。

输入：

- installed Skill
- user / project Skill
- plugin Skill
- bundled Skill
- dynamic Skill
- MCP server / MCP tool / MCP prompt
- builtin tool
- provider tool
- plugin manifest
- app / connector manifest

输出统一能力对象：

```text
Capability
  identity
  kind
  source
  parentPlugin
  state
  invocation
  runtimeVisibility
  diagnostics
```

这层不决定本轮塞不塞 prompt。

### 7.2 运行时可见性层

唯一职责：决定能力是否可被模型或用户调用。

核心字段：

```text
enabled
modelInvocable
userInvocable
toolInvocable
runtimeVisible
hiddenReason
conflictWinner
```

SkillTool、slash command、Desktop 管理页都必须消费这层结果。

### 7.3 上下文注入层

唯一职责：决定本轮哪些能力要进入模型上下文。

策略建议：

- managed Skill：用户明确安装并启用，默认进入静态 Skill 列表。
- bundled Skill：默认进入静态 Skill 列表。
- MCP Skill：数量可控时进入静态列表；过多时按 server 或候选摘要裁剪。
- project / user / plugin long-tail Skill：可先进入动态发现，后续按预算或最近使用策略注入。
- disabled / drifted / invalid Skill：不进入模型上下文，但进入管理页诊断。

上下文注入层必须能解释每个 Skill 的注入原因：

```text
injected because managed enabled modelInvocable
hidden because disabled
hidden because duplicate loser
hidden because budget policy
hidden because discovery-only
```

### 7.4 动态发现层

唯一职责：根据当前任务检索候选能力。

最小实现：

- 建立 Skill index：name、description、when-to-use、source、tags。
- 输入用户任务文本。
- 输出候选 Skill、命中分数、命中原因。
- 生成 `Skills relevant to your task` 附件。

增强实现：

- 支持 plugin / app / MCP 关系。
- 支持最近使用和项目目录相关性。
- 支持明确用户问“有哪些 Skill”时返回完整用户可见目录，而不是做任务匹配。

## 8. 对当前 managed Skill 问题的判断

当前问题不是模型理解差，而是运行时上下文没有提供事实。

当 `EXPERIMENTAL_SKILL_SEARCH` 开启但动态发现链路不可用时，如果 `skill_listing` 又过滤掉 managed Skill，就会出现：

```text
管理页：Skill 已安装、已启用、模型可调用
模型上下文：没有看到这些 Skill 名称
用户体验：模型回答不知道有哪些 Skill
```

因此短期热修应该是：

```text
skill_listing 静态列表保留 bundled + managed + MCP
```

长期重构应该是：

```text
Capability Catalog -> Runtime Visibility -> Context Injection -> Discovery
```

不要继续让 `attachments.ts` 单独发明一套可见性判断。

## 9. 后续 goal 建议

建议拆成四个重构 goal。

执行序列已沉淀到 [Goal Series：Codex 对齐的扩展能力发现与注入重构序列](../goals/2026-06-05-codex-aligned-extension-discovery-refactor-series.md)。本文保留架构学习结论，具体迭代、范围和验收以后续 goal 文档为准。

### C1 Plugin 能力合集模型

目标：

- Plugin 作为能力合集进入 Capability Catalog。
- 列出 Plugin 关联的 Skill / App / MCP / Tool。
- 支持关系图和管理页来源展示。

### C2 Skill 上下文注入策略

目标：

- 抽出 `SkillContextInjectionPolicy`。
- 让 `skill_listing` 消费 Runtime Catalog / Capability Catalog 的结果。
- managed Skill 默认可见。
- 每个 hidden reason 可诊断。

### C3 Skill 动态发现闭环

目标：

- 实现本地 Skill index。
- 实现任务文本检索。
- 实现 `Skills relevant to your task` 附件。
- 明确 `DiscoverSkills` 是否作为真实 Tool 暴露。

### C4 管理页统一能力目录

目标：

- Skill / MCP / Plugin 管理页消费同一个 Capability Catalog。
- 展示安装记录和运行时能力两个维度。
- 不再只列“安装记录”，而是列“所有能力和来源”。

## 10. 当前实现红线

后续改造中避免以下模式：

- 不要让管理页、SkillTool、slash command、attachment 各自判断 enabled / visible。
- 不要让半实现的动态发现影响用户明确安装的 managed Skill。
- 不要把 Plugin 当作一种 Skill。
- 不要把 Skill 当作 Tool；Skill 是工作流，Tool 是执行入口。
- 不要把“用户可调用”和“模型可调用”混成一个状态。
