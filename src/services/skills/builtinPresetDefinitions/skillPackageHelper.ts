import type { BuiltinSkillPreset } from './types.js'

export const skillPackageHelperPreset: BuiltinSkillPreset = {
  presetId: 'skill-package-helper',
  name: 'skill-package-helper',
  displayName: 'Skill 包助手',
  description:
    '创建、更新或审查标准 Skill 包时使用。适用于把工作流整理成 SKILL.md、检查 frontmatter 与资源目录、识别 hooks/shell/allowed-tools 风险，并在需要时把 Claude command、Codex skill 或 OpenClaw skill 转成可管理 Skill。',
  version: '0.1.0',
  files: {
    'SKILL.md': `---
name: skill-package-helper
description: 创建、更新或审查标准 Skill 包时使用。适用于把工作流整理成 SKILL.md、检查 frontmatter 与资源目录、识别 hooks/shell/allowed-tools 风险，并在需要时把 Claude command、Codex skill 或 OpenClaw skill 转成可管理 Skill。
---

# Skill 包助手

帮助用户把真实工作流整理成可安装、可审计、可按需调用的标准 Skill 包。默认产物以 \`SKILL.md\` 为标准入口，其他来源只作为导入或转换输入。

## 工作方式

1. 先判断用户要做的是创建、更新、审查、转换还是生成安装配置。
2. 只把触发判断需要的信息写进 \`description\`，因为模型主要靠它决定是否使用 Skill。
3. 保持 \`SKILL.md\` 精简，把长示例、协议说明、表格和案例放进 \`references/\`。
4. 对稳定、重复、容易写错的操作，优先放进 \`scripts/\`，不要每次让模型重写。
5. 对模板、图片、字体、样例工程等输出资源，放进 \`assets/\`。
6. 发现 \`hooks\`、\`shell\`、可执行脚本、网络访问、敏感凭据或个人路径时，必须明确风险。

## 创建或更新流程

1. 明确 Skill 名称、目标用户、触发场景和 2-3 个真实使用例子。
2. 生成或修正 \`SKILL.md\` frontmatter，只保留必要字段；至少包含 \`name\` 和 \`description\`。
3. 把正文写成执行流程：输入是什么、先做什么、何时读取哪些参考资料、输出什么。
4. 判断是否需要 \`scripts/\`、\`references/\`、\`assets/\`；不需要的目录不要创建。
5. 最后按 \`references/checklist.md\` 审查一次。

## 转换流程

- Claude command：保留原始命令语义，把文件名归一成 Skill \`name\`，正文迁移到 \`SKILL.md\`。
- Codex / OpenClaw skill：优先保留 \`SKILL.md\` 的 \`name\`、\`description\`、正文流程、资源目录和工具约束；厂商私有元数据只作为参考，不写进标准包正文。

## 参考资料

- 包结构和风险审查清单见 \`references/checklist.md\`。

## 输出要求

- 创建或更新时，给出明确文件结构和需要写入的文件。
- 审查时，先列必须修复的问题，再列可优化项。
- 转换时，说明保留了哪些原始语义，删除了哪些不属于标准 Skill 包的私有元数据。
- 不要把敏感凭据、会话信息、个人绝对路径或一次性临时文件写进 Skill 包。
`,
    'references/checklist.md': `# Skill 包审查清单

## 必须满足

- \`SKILL.md\` 位于包根目录。
- \`name\` 稳定、简短，只使用小写字母、数字和短横线。
- \`description\` 同时说明“这个 Skill 做什么”和“什么时候应该使用”。
- 正文包含可执行流程，而不是只写背景介绍。
- 资源路径都在 Skill 包内部，不能依赖一次性临时路径。
- 不包含敏感凭据、会话信息、个人隐私路径或不可公开的内部数据。

## Progressive disclosure

- \`SKILL.md\` 只保留核心流程和索引。
- 长说明、协议细节、示例和表格放进 \`references/\`。
- 稳定脚本放进 \`scripts/\`，并在正文里说明何时运行。
- 模板、图片、字体、样例工程放进 \`assets/\`。
- 避免 README、CHANGELOG、快速开始等与 agent 执行无关的杂项文件。

## 运行约束

- 需要工具权限时，明确 \`allowed-tools\` 的语义。
- 需要用户显式调用时，确认 \`user-invocable\`。
- 不应该被模型自动触发时，使用 \`disable-model-invocation\`。
- 包含 \`hooks\` 或 \`shell\` 时，必须说明执行时机、命令来源和风险。
- 包含脚本、远程服务或网络访问时，安装确认里必须提示。
`,
  },
}
