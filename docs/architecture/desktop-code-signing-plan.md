# CCR Desktop 代码签名准备方案

## 1. 目标

这一阶段只做代码签名准备，不要求当前机器已经有证书。

目标是把“未签名本机包”和“正式签名发布包”拆成两条明确路径：

```text
日常验证：npm.cmd run desktop:dist
正式签名：npm.cmd run desktop:dist:signed
```

这样开发打包不会被证书卡住，但正式发布时不会忘记签名。

## 2. 默认未签名包

默认命令：

```powershell
npm.cmd run desktop:dist
```

默认配置保持：

```json
{
  "signAndEditExecutable": false,
  "verifyUpdateCodeSignature": false
}
```

原因：

- 当前本机没有正式 Windows 代码签名证书。
- 普通开发验证不应该依赖证书。
- 未签名包只能用于本机验证，不能当作正式公开发布包。

## 3. 正式签名包

签名命令：

```powershell
npm.cmd run desktop:dist:signed
```

该命令会进入 signed 模式：

- 要求证书环境变量存在。
- 临时生成 electron-builder signed config。
- 启用 `signAndEditExecutable`。
- 启用 `verifyUpdateCodeSignature`。
- 启用 `forceCodeSigning`。

当前支持的证书环境变量：

```text
WIN_CSC_LINK + WIN_CSC_KEY_PASSWORD
CSC_LINK + CSC_KEY_PASSWORD
```

说明：

- `WIN_CSC_*` 优先用于 Windows 签名。
- `CSC_*` 是 electron-builder 通用代码签名变量。
- 证书路径、base64、密码都不能写入仓库。
- 如果只设置了其中一个变量，预检会失败。

## 4. 签名预检

预检命令：

```powershell
npm.cmd run smoke:desktop-signing-readiness
```

它会检查：

- `desktop:dist:signed` 是否存在。
- 默认打包是否仍保持未签名模式。
- 证书环境变量是否成对出现。
- 当前安装器是否存在。
- Windows 下通过 Authenticode 检查安装器签名状态。

默认情况下，未签名包不会让预检失败，因为当前阶段仍允许本机验证包。

如果正式发布前必须强制签名：

```powershell
$env:CCR_REQUIRE_SIGNED = '1'
npm.cmd run smoke:desktop-signing-readiness
```

此时安装器没有有效签名会失败。

## 5. 签名后的验收顺序

拿到证书后建议顺序：

```powershell
$env:WIN_CSC_LINK = '<pfx path or base64>'
$env:WIN_CSC_KEY_PASSWORD = '<password>'
npm.cmd run desktop:dist:signed
$env:CCR_REQUIRE_SIGNED = '1'
npm.cmd run smoke:desktop-signing-readiness
npm.cmd run smoke:desktop-release-artifacts
npm.cmd run smoke:desktop-packaged
```

注意：不要把证书密码写入脚本、文档、提交记录或 CI 日志。

## 6. 与自动更新的关系

自动更新依赖签名稳定后再做。

原因：

- `verifyUpdateCodeSignature` 需要发布者身份稳定。
- 未签名包无法作为真实自动更新链路的安全基线。
- 回滚、增量更新、签名验证失败提示都依赖签名状态可观测。

因此当前建议顺序：

```text
代码签名准备
-> 真实签名包验收
-> GitHub Release artifact
-> 自动更新状态机
```

## 7. 当前边界

当前已完成：

- signed 打包入口。
- 证书环境变量预检。
- 安装器 Authenticode 状态检查。
- 未签名与签名路径拆分。

当前未完成：

- 申请或购买代码签名证书。
- 配置真实 CI secret。
- 执行真实签名。
- 启用自动更新。
