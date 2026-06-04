export const skillInstallHelperPreset = {
    presetId: 'skill-install-helper',
    name: 'skill-install-helper',
    displayName: 'Skill 安装助手',
    description: '导入、安装、启用、禁用、检查、修复或卸载 Skill 时使用。适用于解释导入与安装的区别、生成安装计划、核对安装记录、排查 installed package 状态，以及指导用户走受控确认流程。',
    version: '0.1.0',
    files: {
        'SKILL.md': `---
name: skill-install-helper
description: 导入、安装、启用、禁用、检查、修复或卸载 Skill 时使用。适用于解释导入与安装的区别、生成安装计划、核对安装记录、排查 installed package 状态，以及指导用户走受控确认流程。
---

# Skill 安装助手

帮助用户把 Skill 从来源材料变成应用可管理的 installed package。使用时先判断用户要做的是搜索候选、导入来源、安装、调整启用状态、检查、修复还是卸载。

## 核心判断

- 导入：把本地目录、压缩包、Claude command、Codex skill 或 OpenClaw skill 归一成可识别的 Skill 包。
- 安装：从候选生成安装计划，经用户确认后写入 managed package、installed 记录和 lock 记录。
- 启用状态：控制已安装 Skill 是否进入运行时，以及是否允许模型或用户调用。
- 检查：读取安装记录、包目录、lock 记录和运行时状态，判断 installed、disabled、drifted、missing 或 invalid。
- 修复：只修复 installer-owned 的包或记录，不接管未知来源。
- 卸载：移除受控安装记录和包目录，不删除用户原始来源材料。

## 工作流程

1. 先复述用户想完成的安装管理动作。
2. 判断当前输入属于候选名、外部 Skill 来源、本地目录、压缩包、Claude command 还是已安装 Skill 名称。
3. 生成计划时说明来源、写入目标、默认启用状态、模型可调用、用户可调用和风险摘要。
4. 没有用户确认时只给 dry-run 结果，不直接写入。
5. 用户确认后才执行安装、修复或卸载。
6. 操作完成后检查 installed 状态和运行时可见状态。

## 参考资料

- 安装状态变化和异常排查说明见 \`references/install-flow.md\`。

## 输出要求

- 先说明当前动作和输入来源。
- 再列计划、风险、写入目标和需要用户确认的点。
- 如果发现不是应用管理的安装记录，明确说明不能直接修复或卸载。
- 不要承诺远端 registry 安装；远端 registry 当前是暂停项。
`,
        'references/install-flow.md': `# Skill 安装状态流

## 来源到候选

\`\`\`text
本地目录 / 本地压缩包 / Claude command / Codex skill / OpenClaw skill / 内置 preset
  -> 归一成 Skill package
  -> 生成安装候选
\`\`\`

候选只代表“可以生成计划”，还没有写入运行时。

## 候选到安装

\`\`\`text
候选
  -> 安装计划
  -> 用户确认
  -> managed package
  -> installed 记录
  -> lock 记录
  -> runtime catalog
\`\`\`

安装后运行时只读取 managed package 和安装记录，不回到原始来源目录做静默兜底。

## 常见状态

- available：可以安装。
- installed：已安装且记录存在。
- disabled：已安装但不进入运行时。
- drifted：包内容或记录与 lock 不一致。
- missing：记录存在但包或关键文件缺失。
- invalid：包结构无法被应用识别。

## 受控操作

- install：必须从候选生成计划。
- repair：只处理 installer-owned 的记录。
- uninstall：只移除应用管理的包和记录。
- import：只归一来源，不等于安装。
`,
    },
};
//# sourceMappingURL=skillInstallHelper.js.map