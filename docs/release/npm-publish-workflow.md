# npm 发布流程

本文档记录 `cc-reforged` 的 npm 发布流程，适用于当前仓库：

- 仓库目录：`D:\agent_project\claude-code-reforged`
- npm 包名：`cc-reforged`
- CLI 命令：`ccr`
- 运行时要求：Node.js `>=24.0.0`
- 当前发布安全闸：`prepublishOnly` 要求设置 `AUTHORIZED=1`

## 1. 发布前原则

1. 发布前必须确认本次代码有权公开分发，尤其当前项目包含 sourcemap 恢复与改造内容，不要把不该公开的源码、凭据、私有配置或调试产物发布到 npm。
2. npm 包一旦公开发布，不能把“撤回发布”当作常规回滚手段；如果版本有问题，优先发布修复版或使用 `npm deprecate` 标记问题版本。
3. 不要把 npm token、2FA 恢复码、`.npmrc` 临时鉴权文件提交到 git。
4. 在 Windows 上优先使用 `npm.cmd`，避免 PowerShell 执行策略拦截 `npm.ps1`。
5. 不要在 PowerShell 5.1 里使用 `&&` / `||` 串命令；需要多步就分行执行。

## 2. 发布前检查

在仓库根目录执行：

```powershell
cd D:\agent_project\claude-code-reforged
git status --short --branch
npm.cmd whoami
npm.cmd view cc-reforged version
node -v
```

预期结果：

- `git status` 应该没有未提交的意外改动。
- `npm.cmd whoami` 应该显示当前 npm 用户名。
- `node -v` 应该显示 Node.js 24 或更高版本。
- 如果是首次发布，`npm.cmd view cc-reforged version` 可能返回 404，这是正常的，说明包名暂未发布。

如果 `npm.cmd whoami` 报 `ENEEDAUTH`，先登录：

```powershell
npm.cmd login
```

如果登录需要浏览器验证，按 npm 页面提示完成即可。

## 3. 本地质量检查

发布前至少执行：

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run build -- --pretty false
npm.cmd run smoke:llm-config
npm.cmd run smoke:llm-runtime-status
npm.cmd run smoke:codex-oauth-session
npm.cmd run smoke:codex-oauth-provider
git diff --check
```

如果任一命令失败，不要发布，先修复失败项。

## 4. 包内容预览

发布前必须先看 npm 实际会打进去哪些文件：

```powershell
npm.cmd pack --dry-run --json
```

重点检查：

- 包名是否是 `cc-reforged`。
- 版本号是否正确。
- 是否包含 `README.md`、`README.zh-CN.md`、`LICENSE.md`、`cli.js`、`bun-bundle-loader.mjs`、`dist/**/*.js`。
- 是否没有包含 sourcemap、临时日志、token、`.env`、本地配置、测试输出。
- 包体积是否在预期范围内。

如果内容不对，先调整 `package.json` 的 `files` 字段或清理本地文件，再重新 dry-run。

## 5. 版本与 git

如果是正式发布一个新版本，先确认 `package.json` 的 `version` 已更新。

推荐流程：

```powershell
git status --short --branch
git add package.json package-lock.json README.md README.zh-CN.md docs
git commit -m "Prepare release v0.1.0"
git tag v0.1.0
git push
git push origin v0.1.0
```

如果版本号已经提交和打 tag，就不要重复创建同名 tag。

## 6. npm 2FA 设置

如果 npm 要求设置双因素认证（2FA），常见方式有两种：

1. 安全密钥 / Passkey / Windows Hello。
2. Authenticator App / TOTP 动态验证码。

当前页面如果只出现 `Security key`，可以直接用 Windows Hello：

1. 安全密钥名字填写一个自己能识别的备注，例如 `luoji-windows-hello` 或 `npm-publish-windows-pc`。
2. 点击 `Add security key`。
3. 按浏览器弹出的 Windows Hello 提示输入 PIN、指纹或人脸。
4. 保存 npm 给出的恢复码。

这个名字只是设备备注，不是密码，也不是验证码。

## 7. 正式发布

当前仓库有发布安全闸，必须设置 `AUTHORIZED=1`。

如果你当前窗口是 CMD：

```cmd
cd /d D:\agent_project\claude-code-reforged
set AUTHORIZED=1
npm.cmd publish --access public
```

如果你当前窗口是 Windows PowerShell：

```powershell
cd D:\agent_project\claude-code-reforged
$env:AUTHORIZED = '1'
npm.cmd publish --access public
```

注意：

- PowerShell 里不要写 `set AUTHORIZED=1`，那是 CMD 写法。
- CMD 里不要写 `$env:AUTHORIZED = '1'`，那是 PowerShell 写法。
- `--access public` 用于公开包，当前 `package.json` 也已经配置了 `publishConfig.access=public`。

## 8. 403 和 2FA 发布失败处理

如果发布时报：

```text
403 Forbidden ... Two-factor authentication or granular access token with bypass 2fa enabled is required to publish packages.
```

说明 npm 账号策略要求发布时完成 2FA 或使用允许发布的 granular token。

优先处理方式：

1. 在 npm 网站完成 2FA 设置。
2. 重新执行发布命令。
3. 如果命令行给出浏览器验证链接，打开链接并用刚设置的安全密钥 / Windows Hello 完成确认。

如果要使用 granular access token：

1. 在 npm 网站创建 Granular Access Token。
2. 只授予发布 `cc-reforged` 所需的最小权限。
3. 如果 npm 策略要求，开启允许绕过 2FA 的发布 token。
4. 不要把 token 粘贴到聊天窗口或提交到仓库。
5. 发布后删除本地临时 token 配置。

临时 `.npmrc` 方式只适合短时间本机发布，发布后必须删除：

```powershell
cd D:\agent_project\claude-code-reforged
Set-Content -Encoding ascii -Path .npmrc -Value "//registry.npmjs.org/:_authToken=YOUR_TOKEN"
$env:AUTHORIZED = '1'
npm.cmd publish --access public
Remove-Item -LiteralPath .npmrc
```

不要提交 `.npmrc`。

## 9. 发布后验证

发布成功后执行：

```powershell
npm.cmd view cc-reforged version
npm.cmd view cc-reforged bin
npx.cmd -y --package cc-reforged ccr --version
```

如果要本机全局安装验证：

```powershell
npm.cmd install -g cc-reforged
ccr --version
ccr auth status --json
```

验证重点：

- npm 上能看到新版本。
- `bin` 显示 `ccr`。
- `ccr --version` 能正常输出。
- `ccr auth status --json` 不应误读本机旧 `claude` 配置目录。

## 10. 发布后收尾

1. 确认 git tag 已推送。
2. 在 GitHub release 或项目文档记录本次版本变化。
3. 如果发布后发现严重问题，不要覆盖同版本，发布新 patch 版本。
4. 如需提示用户不要使用某个坏版本，使用：

```powershell
npm.cmd deprecate cc-reforged@0.1.0 "This version has a known issue. Please upgrade to a newer release."
```

## 11. 常见问题速查

### prepublishOnly 阻止发布

现象：

```text
ERROR: Direct publishing is not allowed.
Please see the release workflow documentation to publish this package.
```

原因：没有设置 `AUTHORIZED=1`。

处理：

- CMD：`set AUTHORIZED=1`
- PowerShell：`$env:AUTHORIZED = '1'`

### PowerShell 执行 npm 报策略错误

原因：命中了 `npm.ps1`，被执行策略拦截。

处理：使用 `npm.cmd`。

### 2FA 页面要求填写 security key name

这里填设备备注，例如：

```text
luoji-windows-hello
```

然后用 Windows Hello / PIN / 指纹 / 人脸完成绑定。

### 发布时提示包名无权限

可能原因：

- 包名已经被别人占用。
- 当前 npm 账号不是该包 maintainer。
- 使用的是组织包但没有组织发布权限。

处理：

```powershell
npm.cmd view cc-reforged
npm.cmd owner ls cc-reforged
```

如果包名已经属于别人，需要换包名或让 owner 添加权限。

## 12. 官方参考

- npm publish 文档：https://docs.npmjs.com/cli/v10/commands/npm-publish
- npm package.json files 字段：https://docs.npmjs.com/cli/v10/configuring-npm/package-json#files
- npm two-factor authentication：https://docs.npmjs.com/configuring-two-factor-authentication
- npm access tokens：https://docs.npmjs.com/about-access-tokens
