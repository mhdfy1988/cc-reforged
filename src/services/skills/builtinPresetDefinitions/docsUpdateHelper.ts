import type { BuiltinSkillPreset } from './types.js'

export const docsUpdateHelperPreset: BuiltinSkillPreset = {
  presetId: 'docs-update-helper',
  name: 'docs-update-helper',
  displayName: '文档更新助手',
  description:
    '项目功能大改、阶段收口、发布前或用户要求检查文档是否过时时使用。适用于同步 README、CHANGELOG、goal 文档、Skill/MCP 专题文档和架构说明，并区分已实现、暂停和后续 backlog。',
  version: '0.1.0',
  files: {
    'SKILL.md': `---
name: docs-update-helper
description: 项目功能大改、阶段收口、发布前或用户要求检查文档是否过时时使用。适用于同步 README、CHANGELOG、goal 文档、Skill/MCP 专题文档和架构说明，并区分已实现、暂停和后续 backlog。
---

# 文档更新助手

帮助用户在项目大改后检查和同步文档。使用时先确认当前代码事实，再改文档；不要用旧文档反推当前功能。

## 工作流程

1. 明确文档更新原因：功能完成、设计变更、发布前、用户发现旧口径，还是 goal closeout。
2. 先确认当前实现：源码、smoke、页面状态、CLI 能力或配置 schema。
3. 把差异分成三类：当前已实现、暂停项、后续 backlog。
4. 按入口层级更新：README / CHANGELOG 先写用户可见变化，专题文档写细节，goal 文档写阶段结论。
5. 删除或改写旧口径：不要让旧版本说明继续暗示当前行为。
6. 检查中英文 README 是否需要同步。
7. 最后跑文档相关 diff check，并列出仍未确认的文档。

## 文档口径

- 已实现：用现在时，写清入口、范围和限制。
- 暂停项：明确写“暂停”或“后续”，不要写成正在实现。
- 设计占位：必须标明未落地，不进入用户可用能力列表。
- Desktop-only：不要写成 CLI/TUI 已支持。
- installer-owned：不要和手工配置混写。

## 参考资料

- 目标项目是 CCR，且需要选择文档清单或做 stale wording 审计时，可参考 \`references/doc-audit-checklist.md\`。
- 其他项目优先参考项目自己的 README、CHANGELOG、docs 入口和任务计划文档。

## 输出要求

- 先列本次应更新的文档范围。
- 再列每份文档的改动理由。
- 更新后说明已同步、未同步和需要用户确认的项。
- 不要为了填满文档而重复页面文案或实现细节。
`,
    'references/doc-audit-checklist.md': `# CCR 文档审计清单

以下清单只在目标项目是 CCR 时使用；其他项目应以当前仓库自己的文档入口为准。

## 顶层入口

- \`README.md\`
- \`README.zh-CN.md\`
- \`README.en.md\`
- \`CHANGELOG.md\`
- \`docs/README.md\`
- \`docs/goals/README.md\`

## Skill

- \`docs/skills/README.md\`
- \`docs/skills/skill-standard-and-install-management-design.md\`
- \`docs/goals/*skill*.md\`
- Skill 相关 smoke 脚本和 package script

## MCP

- \`docs/mcp/README.md\`
- \`docs/mcp/install-manifest-and-import-design.md\`
- \`docs/mcp/integration-standard.md\`
- \`docs/mcp/modularization-roadmap.md\`
- \`docs/mcp/config-examples.md\`

## Desktop / Release

- \`docs/architecture/desktop-release-acceptance-runbook.md\`
- \`docs/architecture/desktop-auto-update-state-machine.md\`
- \`docs/architecture/desktop-installer-release-readiness.md\`
- Desktop release smoke 和打包脚本说明

## 审计关键词

- 旧版本号。
- 远端 registry。
- Desktop-only / CLI / TUI。
- 手工配置 / 安装记录 / 常用安装配置。
- 已完成 / 暂停 / 后续。
- dist 与 src 是否同步。
`,
  },
}
