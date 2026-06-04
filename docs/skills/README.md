# CCR Skill 文档入口

本目录用于沉淀 CCR 的 Skill 标准、兼容策略、安装管理、上下文注入和后续 Plugin / 外部能力包治理设计。

Skill 在 CCR 中不是普通命令的同义词。Skill 的核心语义是：一个可被模型按需使用的本地指令包，入口文件是 `SKILL.md`，可以带脚本、参考资料和输出资源。Command 是显式调用入口；一个 skill 可以暴露成 command，也可以只允许模型通过 Skill 工具调用。

## 当前文档

- [Skill 标准兼容与安装管理设计](./skill-standard-and-install-management-design.md)：当前权威设计，覆盖标准格式、Claude / Codex / OpenClaw 兼容、CCR 内部模型、安装管理和迭代计划。
- [Goal S-1：Skill 标准模型与现有运行时归一](../goals/2026-06-02-skill-s1-standard-model-plan.md)：第一阶段实施拆分，覆盖代码结构、设计模式、不变式和 S-1.1 到 S-1.5 小 goal。
- [Goal S-5：Desktop Skill 管理面收口](../goals/2026-06-03-skill-s5-closeout.md)：记录 Desktop 管理面、App Server Skill 管理 API、导入 Skill、安装候选 UX 和验证命令。
- [Goal S-6：运行时启用治理与 installed package 接入](../goals/2026-06-03-skill-s6-closeout.md)：记录 installed skill 接入运行时、启用状态生效、冲突优先级和 smoke 验证。
- [Goal H：hooks / shell 运行时等价与安全收口](../goals/2026-06-03-skill-hooks-shell-runtime-security-plan.md)：记录 managed installed Skill 的 `hooks` / `shell` / `version` 透传与 hook 风险扫描补齐。
- [Goal S-7：Skill 来源扩展](../goals/2026-06-03-skill-s7-source-expansion-plan.md)：记录 `local-archive` 和 `builtin-preset` 来源扩展，明确不做远端 registry。
- [Goal S-8：运行时 Catalog 统一](../goals/2026-06-03-skill-s8-runtime-catalog-unification-plan.md)：记录 local / dynamic / MCP skill 的统一优先级、冲突诊断和 SkillTool 接入。
- [Goal S-9：Skill CLI 管理](../goals/2026-06-03-skill-s9-cli-management-plan.md)：记录 `ccr skill search/import/install/status/inspect/repair/uninstall` 命令行入口。
- [Goal S-10：Skill / MCP 发布前收口](../goals/2026-06-03-skill-mcp-s10-closeout-plan.md)：记录文档审计、Skill / MCP smoke、构建、dist 和提交前清点。
- [Goal S-11：内置 Skill preset 内容层](../goals/2026-06-03-skill-s11-builtin-presets-plan.md)：记录 CCR 第一批内置 Skill preset、内容边界、registry 拆分和全量内置 preset smoke。

## 当前实现状态

当前 CCR 已经具备 skill 运行时加载和调用能力，也已经完成第一版 skill 安装管理面：

- `src/skills/loadSkillsDir.ts` 能从 `.claude/skills`、用户目录、项目目录、managed installed package、plugin、bundled 和 MCP skill 加载 `SKILL.md`，并转成 `PromptCommand`。
- `src/tools/SkillTool/` 会把可用 skill 摘要暴露给模型；模型命中后再通过 Skill 工具加载正文，Desktop 安装的 enabled installed skill 已可进入模型可见列表。
- `src/services/skills/` 已提供导入、安装、安装记录、安全扫描、管理 API 聚合、运行时检查、修复 / 卸载和 cache 刷新基础能力。
- `apps/desktop/src/renderer/src/components/pages/SkillsPage.tsx` 已提供三栏管理面，支持已安装列表、详情、安全摘要、导入外部 Skill、安装、启用 / 禁用、修复和卸载；新建 Skill 由会话里的 `Skill 包助手` 生成完整包后再进入候选登记链路。
- installed managed Skill 与直接文件 Skill 在运行时已补齐 `hooks` / `shell` / `version` / `paths` 等关键 frontmatter 透传；安全扫描会提示 hook command / HTTP / env 风险。
- 导入来源已支持本地 zip/tar archive；安装候选已支持第一批 CCR 内置 Skill preset，并可安装成 managed package。
- 第一批内置 Skill preset 包括：`skill-package-helper`、`skill-install-helper`、`mcp-config-helper`、`bug-debug-helper`、`release-check-helper` 和 `docs-update-helper`。
- 第一批内置 Skill preset 的内容按跨项目通用能力编写；其中 `bug-debug-helper`、`release-check-helper` 和 `docs-update-helper` 也可作为 Codex 用户 Skill 复用，复制到 `~/.codex/skills/<name>/` 时只保留 `SKILL.md`、`references/` 和可选的 `agents/openai.yaml`，不要复制 CCR 安装记录或 lock 元数据；安装后以新建 Codex 线程验证可用性，继续旧线程或只重启后恢复旧线程不一定刷新可用 Skill 注入清单。
- `SkillRuntimeCatalog` 已统一 local、managed、plugin、bundled、dynamic、MCP 和 legacy command 的运行时优先级；SkillTool 不再私下合并 MCP skill，管理 API 可返回 runtime duplicate diagnostics。
- CLI 已支持 `ccr skill search/import/install/status/inspect/repair/uninstall`，所有写入操作默认 dry-run，显式 `--yes` 后才会应用计划。
- `src/services/skillSearch/` 仍是实验 / 占位状态，不能作为正式候选源或远端加载能力。

当前已完成 `导入 -> 安装候选 -> 安装计划 -> 用户确认 -> 安装记录 -> Desktop / CLI 管理 -> 运行时启用 -> hook 风险提示 -> 运行时冲突诊断` 主闭环，并补齐第一批来源扩展。仍需后续补充的是：

- `remote-registry` 已暂停，不进入当前 Skill 实现序列；后续需要单独设计 registry URL 配置、index schema、checksum、缓存、信任策略和失败诊断后再恢复。
- 企业 trust policy、Skill 使用统计和推荐仍未进入第一版闭环。

## 设计原则

- 以 `SKILL.md` 作为唯一核心标准，不把某一家厂商扩展当成必填格式。
- `name`、`description` 和 Markdown 正文是标准必需内容；其它 frontmatter 字段都是兼容或扩展。
- 外部 skill 可以多格式导入，但进入 CCR 后必须归一成统一的 `CcrSkillPackage`。
- 安装管理是 CCR 自己的外壳，不写进 `SKILL.md` 标准本身。
- 模型默认只看到可用 skill 摘要；只有命中或用户显式选择后，才读取 `SKILL.md` 正文。
- 支持文件按需读取，避免把 `scripts/`、`references/`、`assets/` 一次性塞进上下文。
- 第三方 skill 默认视为不可信资产，安装前需要展示来源、写入位置、风险和可执行内容摘要。

## 和 MCP 的关系

MCP 和 Skill 都属于外部能力治理，但边界不同：

- MCP 是工具协议和外部服务连接，安装结果主要写入 `mcpServers` 配置。
- Skill 是指令包和工作流知识，安装结果主要写入 skill 目录和安装记录。
- MCP 安装管理已经具备 `candidate -> plan -> confirm -> record -> repair/uninstall` 闭环；Skill 后续应复用这套安装资产治理范式，而不是重新发明一套散乱入口。
