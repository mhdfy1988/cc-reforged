# npm 发布流程（Trusted Publishing / OIDC）

本文档记录 `cc-reforged` 的 npm 正式发布流程。当前默认方案为 **GitHub Actions + npm Trusted Publishing（OIDC）**，不再依赖长期 `NPM_TOKEN`。

- 仓库目录：`D:\agent_project\claude-code-reforged`
- npm 包名：`cc-reforged`
- CLI 命令：`ccr`
- 运行时要求：Node.js `>=24.0.0`
- 发布安全闸：`prepublishOnly` 要求 `AUTHORIZED=1`（CI 发布步骤已注入）
- 发布工作流：`.github/workflows/npm-release.yml`

## 1. 目标与边界

目标：

1. 用 GitHub OIDC 临时身份在 CI 中执行 `npm publish`。
2. 不把长期 npm 发布 token 存到仓库或本地配置。
3. 发布前固定执行依赖安装、smoke 和包内容校验。

边界：

1. Trusted Publishing 只替代 `npm publish` 的认证，不替代你们现有的质量门禁。
2. 若项目后续引入私有依赖，`npm ci` 可能仍需要只读安装凭据（发布凭据仍建议保持 OIDC）。
3. 当前发布入口默认是 **push tag 自动触发**，并保留 `workflow_dispatch` 作为兜底重试。

## 2. 一次性配置（npm 网站）

在 npm 包页面为 `cc-reforged` 添加 Trusted Publisher（GitHub Actions）：

1. 打开 npm 包设置页面，进入 `Trusted Publisher`。
2. 选择 `GitHub Actions`。
3. 填入以下字段：
   - `Organization or user`：`mhdfy1988`
   - `Repository`：`cc-reforged`
   - `Workflow filename`：`npm-release.yml`
   - `Environment name`：留空（若后续启用 GitHub Environment 门禁，再补）
   - `Allowed actions`：至少勾选 `npm publish`
4. 保存配置。

建议同步执行：

1. 在 npm 包的 `Publishing access` 页面开启 `Require two-factor authentication and disallow tokens`。
2. 清理不再使用的旧 automation token（如历史 `NPM_TOKEN`）。

## 3. GitHub 工作流

仓库内发布工作流：[`.github/workflows/npm-release.yml`](../../.github/workflows/npm-release.yml)

关键点：

1. `permissions.id-token: write`：允许 Actions 申请 OIDC 身份。
2. 固定从输入 tag 检出代码。
3. 检查 `tag` 与 `package.json.version` 一致，不一致即失败。
4. 运行 `npm.cmd ci`、`npm.cmd run ci:smoke`、`npm.cmd pack --dry-run`。
5. 最后执行 `npm.cmd publish --access public`（无 `NODE_AUTH_TOKEN`）。

## 4. 日常发布步骤

### 4.1 本地准备

```powershell
cd D:\agent_project\claude-code-reforged
git status --short --branch
node -e "const p=require('./package.json'); console.log(p.name, p.version)"
npm.cmd pack --dry-run
```

确认：

1. 工作区干净（无意外未提交改动）。
2. 版本号是本次目标版本。
3. 包内容和体积符合预期。

### 4.2 打 tag 并推送

```powershell
git tag v<version>
git push origin v<version>
```

### 4.3 自动触发发布工作流

推送版本 tag 后会自动触发 `NPM Release`，不需要再手点 Run：

1. Workflow：`NPM Release`
2. 触发来源：`push tag`（例如 `v0.5.2`）
3. 自动执行发布

### 4.4 手动兜底触发（可选）

如果自动流程需要重试，也可以手动运行 `workflow_dispatch`：

1. Workflow：`NPM Release`
2. 输入 `tag`：`v<version>`
3. 点击 Run workflow

## 5. 发布后验证

```powershell
npm.cmd view cc-reforged version dist-tags --json
npm.cmd view cc-reforged@<version> bin --json
npm.cmd pack cc-reforged@<version>
$dst = Join-Path $env:TEMP "ccr-pack-<version>"
if (Test-Path $dst) { Remove-Item -LiteralPath $dst -Recurse -Force }
New-Item -ItemType Directory -Path $dst | Out-Null
tar -xf cc-reforged-<version>.tgz -C $dst
node (Join-Path $dst "package\\cli.js") --version
```

验证要点：

1. `dist-tags.latest` 指向新版本。
2. `bin` 包含 `ccr`。
3. 解包后的 `cli.js --version` 输出正确版本号。
4. 本机如果有全局 `ccr`，不要用 `npx ... ccr --version` 当发布验证口径。

## 6. 常见失败与处理

### 6.1 `id-token` 权限错误

现象：workflow 报 OIDC/permission 相关错误。
处理：确认 `npm-release.yml` 顶层包含：

```yaml
permissions:
  contents: read
  id-token: write
```

### 6.2 npm 未配置 Trusted Publisher

现象：`npm publish` 阶段报未授权。
处理：回到 npm 包设置，核对 `org/repo/workflow filename` 与仓库一致，特别是 `npm-release.yml` 文件名必须完全一致。

### 6.3 版本不一致

现象：workflow 在 `Verify tag matches package version` 失败。
处理：修正 `package.json.version` 或重新打正确 tag，不要强行覆盖旧 tag。

### 6.4 `prepublishOnly` 拒绝发布

现象：

```text
ERROR: Direct publishing is not allowed.
```

处理：这是预期保护。CI 工作流已在 publish step 设置 `AUTHORIZED=1`，不要删除该环境变量。

### 6.5 本机 `npx ... ccr --version` 显示旧版本

现象：npm `latest` 已是新版本，但 `npx.cmd -y --package cc-reforged ccr --version` 仍显示旧版本（例如 `CCR v0.1`）。

处理：

1. 先检查是否存在全局 `ccr`：`Get-Command ccr`。
2. 若命中 `C:\Users\<user>\AppData\Roaming\npm\ccr.*`，说明被全局命令抢占。
3. 用“发布后验证”里的 `npm pack + node package/cli.js --version` 作为权威验证。
4. 如需清理本机冲突：`npm.cmd uninstall -g cc-reforged` 或升级全局到新版本 `npm.cmd install -g cc-reforged@latest`。

## 7. 应急路径（仅故障兜底）

默认不建议本机直发；仅当 GitHub Actions 或 OIDC 临时故障且必须紧急发版时，才使用本机发布：

1. 本机登录 npm。
2. 手动设置 `AUTHORIZED=1`。
3. 执行 `npm.cmd publish --access public`。
4. 事后回到 OIDC 主路径，避免长期依赖本机 token。

## 8. 发布记录

| 日期 | 版本 | 触发方式 | 结果 |
| --- | --- | --- | --- |
| 2026-06-16 | `0.6.5` | push tag `v0.6.5` | 通过 npm Trusted Publishing / OIDC 发布；GitHub Actions run：`27591303943`；npm `latest=0.6.5` |
| 2026-05-31 | `0.5.2` | push tag `v0.5.2` | 通过 npm Trusted Publishing / OIDC 发布；GitHub Actions run：`26716738566`；npm `latest=0.5.2` |
| 2026-05-22 | `0.5.1` | `workflow_dispatch`，输入 `tag=v0.5.1` | 首次通过 npm Trusted Publishing / OIDC 发布；GitHub Actions run：`26270002796`；npm `latest=0.5.1` |

## 9. 官方参考

1. npm Trusted Publishing（GitHub Actions）：https://docs.npmjs.com/trusted-publishers/
2. npm publish 命令：https://docs.npmjs.com/cli/publish/
