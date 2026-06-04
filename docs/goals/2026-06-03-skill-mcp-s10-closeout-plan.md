# Goal S-10：Skill / MCP 发布前收口

## 1. 目标

S-10 的目标是在 Skill 和 MCP 当前阶段功能完成后，做一次发布前收口：

```text
文档 -> smoke -> build -> 工作区清点 -> commit/push 前确认
```

本 goal 不新增大功能，重点是确认已经完成的能力、暂停的能力和后续 backlog 都写清楚，并且本地验证命令能跑通。

## 2. 为什么需要 S-10

当前 MCP 和 Skill 都经历了多轮快速迭代，工作区里同时存在：

- 源码改动。
- Desktop 页面改动。
- dist 构建产物。
- docs / goals 文档。
- smoke 脚本。
- package script 更新。

如果不单独 closeout，容易出现：

- 文档仍停留在旧口径。
- CHANGELOG 漏掉关键能力。
- dist 和 src 不一致。
- smoke 脚本没纳入 package。
- 远端 registry 暂停项被误写成当前已实现。
- 提交时漏 stage 或把无关文件混进去。

## 3. 范围

本阶段做：

- 审核 Skill 文档入口和权威设计文档。
- 审核 MCP 文档入口和安装管理文档。
- 明确 remote registry 在 MCP / Skill 两边都暂停。
- 汇总 S-7 / S-8 / S-9 完成状态。
- 跑 Skill / MCP 关键 smoke。
- 跑 build / typecheck。
- 检查 dist 是否与 src 同步。
- 检查 `git diff --check`。
- 形成提交前文件清单。

本阶段不做：

- 不做远端 registry。
- 不做新的 Skill 来源。
- 不做新的 MCP preset。
- 不做 UI 大改。
- 不发布前绕过失败 smoke。

## 4. 文档清单

需要核对：

```text
README.md
CHANGELOG.md
docs/README.md
docs/goals/README.md
docs/skills/README.md
docs/skills/skill-standard-and-install-management-design.md
docs/mcp/README.md
docs/mcp/install-manifest-and-import-design.md
docs/mcp/integration-standard.md
docs/mcp/modularization-roadmap.md
docs/mcp/config-examples.md
```

文档不变式：

- 当前已实现能力写成当前状态。
- 暂停能力写成暂停 / backlog。
- 不把 remote registry 写成正在实现。
- 不把 Desktop-only 能力写成 CLI 已支持。
- 不把手写配置写成 CCR installer-owned。

## 5. 验证清单

建议基础命令：

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run build
```

建议 Skill smoke：

```powershell
npm.cmd run smoke:skill-foundation
npm.cmd run smoke:skill-import
npm.cmd run smoke:skill-install-candidates
npm.cmd run smoke:skill-install-apply
npm.cmd run smoke:skill-install-inspector
npm.cmd run smoke:skill-management-api
npm.cmd run smoke:skill-runtime-installed-loader
npm.cmd run smoke:skill-runtime-activation-policy
npm.cmd run smoke:skill-runtime-catalog
npm.cmd run smoke:skill-runtime-tool-context
npm.cmd run smoke:skill-runtime-slash-command
npm.cmd run smoke:skill-runtime-installed-metadata
npm.cmd run smoke:skill-security-scanner
```

建议 MCP smoke：

```powershell
npm.cmd run smoke:mcp-install-candidates
npm.cmd run smoke:mcp-result-processing
npm.cmd run smoke:mcp-tool-runtime
npm.cmd run smoke:mcp-transport-factory
npm.cmd run smoke:mcp-remote-transport-options
npm.cmd run smoke:mcp-adopt
```

最终检查：

```powershell
git status --short
git diff --check
```

## 6. 迭代拆分

### S-10.1 文档审计

目标：

- 对 README、CHANGELOG、Skill 文档、MCP 文档做 stale wording 审计。
- 统一“远端 registry 暂停”口径。
- 补齐 S-7 / S-8 / S-9 的完成记录。

验收：

```powershell
git diff --check -- README.md CHANGELOG.md docs\README.md docs\skills docs\mcp docs\goals
```

### S-10.2 Smoke 分组验证

目标：

- 按 Skill / MCP 分组跑关键 smoke。
- 失败时只修当前阶段相关问题。
- 记录无法运行或环境依赖问题。

验收：

```powershell
npm.cmd run smoke:skill-foundation
npm.cmd run smoke:skill-management-api
npm.cmd run smoke:skill-runtime-catalog
npm.cmd run smoke:mcp-install-candidates
```

### S-10.3 Build / dist 同步

目标：

- 跑 typecheck。
- 跑 build。
- 确认 dist 产物和 src 改动同步。

验收：

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run build
git status --short
```

### S-10.4 提交前清点

目标：

- 分类列出 staged 候选：src、desktop、dist、docs、smoke、package。
- 排除无关临时文件。
- 准备 commit message。

验收：

```powershell
git diff --cached --name-only
git status --short
```

## 7. 成功标准

S-10 完成时：

- 文档不再停留在旧版本描述。
- Skill / MCP 已实现和暂停项边界清晰。
- build / typecheck / 关键 smoke 通过，或失败点有明确记录。
- dist 与 src 同步。
- 工作区提交范围清楚，可进入 commit / push / release。

## 8. 后续入口

S-10 完成后再考虑：

- 远端 registry 单独恢复设计。
- 企业 trust policy。
- Skill 使用统计和推荐。
- MCP 团队共享候选源。

## 9. 完成记录

状态：已完成。

文档收口：

- `docs/README.md` 当前公开版本更新为 `0.6.0`，版本线补上 Skill / Plugin 外部能力包治理入口。
- `README.md` 新增 Skill CLI 安装与使用示例。
- `docs/skills/README.md`、`docs/skills/skill-standard-and-install-management-design.md` 同步 S-7 / S-8 / S-9 / S-10 完成状态。
- MCP 文档继续保持远端 registry 暂停 / backlog 口径，未写成当前已实现。

代码收口中发现并修复：

- S-8 后 dynamic skill 纳入 `loadAllCommands()` 后，conditional skill 激活没有让 memoized command load key 变化；已给 dynamic skill 状态增加版本号，使 `getCommands()` 在 dynamic state 变化后重新装配 runtime catalog。
- conditional skill 因路径命中被激活时不再改写原始 `loadedFrom`，installed managed skill 会继续保留 `managed` 来源和 `hooks` / `shell` / `version` / `paths` 元数据。

验证记录：

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run build
npm.cmd run smoke:skill-foundation
npm.cmd run smoke:skill-import
npm.cmd run smoke:skill-install-candidates
npm.cmd run smoke:skill-install-apply
npm.cmd run smoke:skill-install-inspector
npm.cmd run smoke:skill-management-api
npm.cmd run smoke:skill-runtime-installed-loader
npm.cmd run smoke:skill-runtime-activation-policy
npm.cmd run smoke:skill-runtime-catalog
npm.cmd run smoke:skill-runtime-tool-context
npm.cmd run smoke:skill-runtime-slash-command
npm.cmd run smoke:skill-runtime-installed-metadata
npm.cmd run smoke:skill-runtime-dynamic-catalog
npm.cmd run smoke:skill-runtime-catalog-unified
npm.cmd run smoke:skill-security-scanner
npm.cmd run smoke:skill-cli-search
npm.cmd run smoke:skill-cli-import-install
npm.cmd run smoke:skill-cli-status-repair-uninstall
npm.cmd run smoke:mcp-install-candidates
npm.cmd run smoke:mcp-result-processing
npm.cmd run smoke:mcp-tool-runtime
npm.cmd run smoke:mcp-transport-factory
npm.cmd run smoke:mcp-remote-transport-options
npm.cmd run smoke:mcp-adopt
npm.cmd run smoke:mcp-cli-install
git diff --check
```

提交前分类：

```text
src：Skill 管理服务、runtime loader/catalog、CLI handler、App Server skill handlers、MCP helper/modularization 相关代码。
desktop：SkillsPage、MCP/Skill 管理面、Desktop IPC/preload/main 和样式改动。
dist：最终 build 生成的 JS / map，与 src 改动同步。
docs：README、CHANGELOG、docs/skills、docs/mcp、docs/goals 和架构入口文档。
smoke：Skill / MCP 新增与回归 smoke 脚本。
package：新增 smoke script 注册。
```
