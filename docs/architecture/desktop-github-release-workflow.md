# CCR Desktop GitHub Release 发布流程

## 1. 目标

这一阶段把 Desktop 安装器从“本机有产物”推进到“可以安全整理为 GitHub Release 草稿”的状态。

当前默认只做发布准备，不自动创建 GitHub Release。真正触网发布有两条路径：

- 正式路径：GitHub Actions `Desktop Release` workflow。
- 辅助路径：本地 `release:desktop:draft`。

本地路径适合临时验证或应急补发；长期正式发布应优先走 GitHub Actions。

## 2. 为什么先做 GitHub Release

Desktop 自动更新依赖三个前置条件：

- 安装器文件名稳定。
- `latest.yml` 能被下载并且指向真实安装器。
- 发布资产和版本号、tag、release note 能稳定对应。

如果直接做自动更新状态机，而没有稳定的 release artifact，后面会出现“客户端能检查更新，但更新源本身不可信”的问题。所以顺序应为：

```text
安装器产物
-> 产物校验
-> 代码签名准备
-> GitHub Release 草稿发布流程
-> 自动更新状态机
```

## 3. 当前命令

生成安装器：

```powershell
npm.cmd run desktop:dist
```

校验安装器 metadata：

```powershell
npm.cmd run smoke:desktop-release-artifacts
```

校验签名准备状态：

```powershell
npm.cmd run smoke:desktop-signing-readiness
```

生成 GitHub Release 发布清单，不触网：

```powershell
npm.cmd run release:desktop:check
```

生成 GitHub Release dry-run 命令，不触网：

```powershell
npm.cmd run release:desktop:dry-run
```

创建或恢复 GitHub Release 草稿：

```powershell
npm.cmd run release:desktop:draft
```

`release:desktop:draft` 会调用：

```text
gh release create <tag> --repo mhdfy1988/cc-reforged --draft --title ... --notes-file ... --verify-tag
gh release upload <tag> <asset> --repo mhdfy1988/cc-reforged --clobber
```

脚本现在是可恢复发布流程：如果 release 已存在，会复用现有 release；如果某个资产已经上传且大小 / sha256 匹配，会跳过；如果资产缺失或不匹配，会逐个补传。这样即使 100MB 以上安装包上传超时，重新运行同一命令也会从缺失资产继续。

正式公开发布：

```powershell
npm.cmd run release:desktop:public
```

正式发布流水线见 [CCR Desktop GitHub Actions 发布流水线](./desktop-github-actions-release-workflow.md)。

## 4. 关键输入输出

输入：

- `package.json` 的 `version`。
- `package.json` 的 `build.publish` GitHub owner/repo。
- `release/desktop/latest.yml`。
- `release/desktop/CCR-Desktop-<version>-win-x64.exe`。
- `release/desktop/CCR-Desktop-<version>-win-x64.exe.blockmap`。

输出：

- `tmp/desktop-release/release-notes-v<version>.md`，其中会自动带入 `CHANGELOG.md` 里对应版本的更新内容。
- dry-run JSON，包括 tag、title、assets、sha256、GitHub CLI 命令。
- 可选的 GitHub Release 草稿。
- 公开发布后可用 `npm.cmd run smoke:desktop-auto-update-feed` 验证远端 `latest.yml` 和安装包资产。

## 5. 状态变化

默认状态：

```text
本机产物存在
-> release:desktop:check
-> 输出发布清单
-> 不触网、不创建 release
```

正式草稿发布或公开发布：

```text
本机产物存在
-> 工作区干净
-> 本地 tag 存在
-> gh 可用
-> release:desktop:draft 或 release:desktop:public
-> GitHub Release draft 或 public release
```

如果没有安装 GitHub CLI，`release:desktop:check` 仍然可以输出清单；只有 `release:desktop:draft` 会失败。

## 6. 边界和不变式

- 默认命令不得触网发布。
- 不自动创建 git tag，避免把未确认 commit 绑定到 release。
- 不自动推送 tag。
- 不自动公开发布，默认只创建 draft。
- 真实执行时先创建 draft，再逐个上传资产；公开发布只发生在资产全部匹配之后。
- 工作区脏时不允许执行真实发布，除非显式设置 `CCR_ALLOW_DIRTY_RELEASE=1`。
- 证书、token、GitHub 凭据不写入仓库。
- 当前默认允许 unsigned 发布；只有显式设置 `CCR_REQUIRE_SIGNED=1` 才把未签名视为失败。
- unsigned 发布依赖 GitHub Release HTTPS、`latest.yml` 的 sha512 和 release note 中的 SHA256 做来源校验。

## 7. 版本和 tag

默认 tag：

```text
v<package.json version>
```

例如：

```text
v0.2.0
```

如果需要临时改 tag，可设置：

```powershell
$env:CCR_DESKTOP_RELEASE_TAG = 'v0.2.0-desktop-test'
```

如果需要改 release 标题，可设置：

```powershell
$env:CCR_DESKTOP_RELEASE_TITLE = 'CCR Desktop v0.2.0'
```

## 8. 正式发布前建议顺序

```powershell
npm.cmd run desktop:dist
npm.cmd run smoke:desktop-release-artifacts
npm.cmd run smoke:desktop-signing-readiness
npm.cmd run release:desktop:check
git status --short --branch
git tag v0.2.0
git push origin v0.2.0
npm.cmd run release:desktop:draft
```

如果要公开发布并验证自动更新 feed：

```powershell
npm.cmd run release:desktop:public
npm.cmd run smoke:desktop-auto-update-feed
```

如果未来已经有真实签名证书，再在正式发布前执行：

```powershell
$env:CCR_REQUIRE_SIGNED = '1'
npm.cmd run smoke:desktop-signing-readiness
```

## 9. 当前限制

- 当前安装器默认未签名，这是有意策略；短期不购买代码签名证书。
- Windows 可能提示未知发布者，release note 必须保留 SHA256 校验值。
- Release note 已接入 `CHANGELOG.md` 对应版本条目；发布前必须确认当前版本更新内容已经补齐。
