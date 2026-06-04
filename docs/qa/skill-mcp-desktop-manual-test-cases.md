# Skill / MCP Desktop 人工测试用例

适用版本：`0.6.0` 发布前人工验收。

这份文档用于在 CCR Desktop 里手动验证 Skill / MCP 管理页。自动 smoke 已覆盖协议和 Core 行为；这里重点看页面展示、确认流程、错误卡和重复状态。

## 1. 测试前准备

先生成本地测试数据：

```powershell
npm.cmd run fixtures:desktop-management-acceptance
```

命令会输出 5 个路径。把输出填到这里：

```text
SkillDir =
ClaudeCommand =
McpHttpManifest =
McpStdioManifest =
SkillManifest =
```

示例：

```text
SkillDir = C:\Users\<user>\AppData\Local\Temp\ccr-desktop-management-fixtures-xxxxxx\skill-local
ClaudeCommand = C:\Users\<user>\AppData\Local\Temp\ccr-desktop-management-fixtures-xxxxxx\.claude\commands\desktop-acceptance-command.md
McpHttpManifest = C:\Users\<user>\AppData\Local\Temp\ccr-desktop-management-fixtures-xxxxxx\manifests\mcp-local-http.json
McpStdioManifest = C:\Users\<user>\AppData\Local\Temp\ccr-desktop-management-fixtures-xxxxxx\manifests\mcp-local-stdio.json
SkillManifest = C:\Users\<user>\AppData\Local\Temp\ccr-desktop-management-fixtures-xxxxxx\manifests\skill-install-manifest.json
```

测试前建议先跑：

```powershell
npm.cmd run smoke:desktop-release-gate
```

## 2. MCP 管理页

### MCP-01 初始页

步骤：

1. 打开 Desktop 的 MCP 管理页。
2. 点击刷新。

预期：

- 能看到已安装列表、当前 server 列表和安装候选。
- Context7、Sentry、Playwright 等候选展示正常。
- 默认是用户全局，不展示无意义的安装范围切换。
- 候选卡片不乱、不重复。

### MCP-02 导入 HTTP MCP 安装配置

步骤：

1. 点击“导入 MCP 安装配置”。
2. 选择 `McpHttpManifest`。

预期：

- 页面进入安装计划确认区。
- 能看到名称、HTTP、URL、网络权限、本地数据边界。
- 不会直接静默安装。

### MCP-03 保存常用安装配置并安装

步骤：

1. 在 MCP-02 的确认区勾选“保存到常用安装配置”。
2. 确认安装。
3. 刷新候选列表。

预期：

- 安装成功。
- 已安装区出现对应记录。
- 候选列表里能看到保存后的本地 manifest。

### MCP-04 已安装详情

步骤：

1. 点击刚安装的 MCP。
2. 查看详情。

预期：

- 安装状态显示“配置一致”。
- 能看到配置文件、写入目标、命令或 URL。
- 卸载入口在详情或已安装记录语义下，不在普通候选卡片上。

### MCP-05 禁用 / 启用 / 检测 / 重启

步骤：

1. 对刚安装的 MCP 执行禁用。
2. 再执行启用。
3. 执行检测。
4. 执行重启。

预期：

- 禁用后状态变化。
- 启用后状态恢复。
- 检测失败时有明确错误信息，不出现空白卡。
- 重启显示可接受或等待运行时状态。

### MCP-06 卸载

步骤：

1. 卸载刚安装的 MCP。
2. 刷新页面。

预期：

- installed record 被移除。
- 保存的本地 manifest 候选仍保留。
- 可再次从候选安装。

### MCP-07 stdio MCP 安装计划

步骤：

1. 点击“导入 MCP 安装配置”。
2. 选择 `McpStdioManifest`。

预期：

- 能生成 stdio 安装计划。
- 能看到 command、args、cwd。
- 这条只验证计划即可，不一定安装。

## 3. Skill 管理页

### SKILL-01 初始页

步骤：

1. 打开 Desktop 的 Skill 管理页。
2. 点击刷新。

预期：

- 页面不是占位页。
- 能看到已安装、候选、风险或诊断信息。
- 没有大段重复说明文本。

### SKILL-02 导入本地 Skill 目录

步骤：

1. 点击“导入 Skill”。
2. 选择 `SkillDir`。
3. 确认导入。

预期：

- 出现导入计划。
- 确认后候选列表出现 `desktop_acceptance_skill`。
- 不会直接静默安装。

### SKILL-03 安装 Skill

步骤：

1. 对 `desktop_acceptance_skill` 点击安装。
2. 查看安装计划。
3. 确认安装。

预期：

- 能看到安全摘要、来源和目标路径。
- 安装后进入已安装列表。
- 风险摘要展示清楚，不挤在候选卡片里。

### SKILL-04 启用状态切换

步骤：

1. 打开已安装 Skill 详情。
2. 依次切换启用 / 禁用。
3. 切换模型自动调用。
4. 切换用户 slash 调用。
5. 刷新页面。

预期：

- 每个开关能保存。
- 刷新后状态仍一致。
- 页面语义清楚区分 enabled、modelInvocable、userInvocable。

### SKILL-05 详情检查

步骤：

1. 打开已安装 Skill 详情。
2. 查看来源、状态、安全摘要、资源列表、`SKILL.md` 预览。

预期：

- 详情信息完整。
- 卡片不拥挤。
- `SKILL.md` 预览可读。

### SKILL-06 修复

步骤：

1. 对已安装 Skill 点击修复。
2. 确认修复。

预期：

- 修复需要明确确认动作。
- 修复后状态仍为 installed / 正常。
- 不出现空白错误。

### SKILL-07 卸载

步骤：

1. 卸载已安装 Skill。
2. 刷新页面。

预期：

- 已安装列表移除该 Skill。
- 导入来源仍保留。
- 刷新后还能作为候选再次安装。

### SKILL-08 Claude Command 转 Skill

步骤：

1. 点击“导入 Skill”。
2. 选择 `ClaudeCommand`。
3. 确认导入。

预期：

- 页面提示这是 command 转 Skill。
- 转换后的 Skill 出现在候选列表。
- 能生成安装计划。

### SKILL-09 Skill 安装配置 manifest

步骤：

1. 导入或保存 `SkillManifest`。
2. 刷新候选列表。

预期：

- 它作为本地 manifest 候选出现。
- 能生成安装计划。
- 来源显示为本地安装配置。

## 4. 异常和回归

### ERR-01 重复安装

步骤：

1. 对已经 installed 的 MCP 或 Skill 再从候选区尝试安装。

预期：

- 候选显示已安装或冲突状态。
- 不出现两个同义主卡片。
- 不重复写入安装记录。

### ERR-02 坏 manifest

步骤：

1. 新建一个坏 JSON 文件，例如只写 `{}`。
2. 尝试作为 MCP 或 Skill manifest 导入。

预期：

- 出现 schema / 字段错误。
- 能看到错误来源和 message。
- 不生成安装记录。

### ERR-03 空目录导入 Skill

步骤：

1. 新建一个空目录。
2. 尝试作为 Skill 导入。

预期：

- 提示缺少 `SKILL.md`。
- 不进入候选。

### ERR-04 页面刷新稳定性

步骤：

1. 在 MCP 页面连续刷新 3 次。
2. 在 Skill 页面连续刷新 3 次。

预期：

- 列表状态稳定。
- 不重复追加卡片。
- 旧错误不会污染正常列表。

## 5. 测试结论记录

```text
测试日期：
测试版本：
测试人：

通过：
失败：
阻塞：

问题截图 / 备注：
```

重点关注：

- 是否重复展示。
- 错误是否明确。
- 写入动作是否都需要确认。
- 卸载是否只影响 installer-owned 记录。
- 保存到常用安装配置后是否能重新作为候选出现。
