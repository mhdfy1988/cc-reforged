# CCR Desktop GitHub Actions 发布流水线

## 1. 目标

这份文档定义 CCR Desktop 的正式发布流水线。

核心目标是把 Desktop 安装器发布从“本机手动上传”升级为“GitHub Actions 可重复构建、校验、生成 / 恢复 GitHub Release、上传资产”的流程。

当前第一版只做：

```text
手动触发 workflow
-> 从已有 tag checkout
-> 安装依赖
-> 构建与 smoke
-> 打包 Desktop 安装器
-> 校验 release 资产
-> 创建或恢复 GitHub Release draft
-> 上传 exe / blockmap / latest.yml
-> 公开发布时验证远端自动更新 feed
```

当前不做：

- 不自动创建 tag。
- 不购买或默认强制代码签名。
- 不替代人工安装验收。

## 2. 为什么选 GitHub Actions

本地 `gh release create` 可以上传安装器，但它依赖当前电脑环境：

- 本机 Node / npm / Electron Builder 版本。
- 本机是否安装并登录 `gh`。
- 本机是否有未提交改动。
- 本机是否有证书或临时环境变量。

GitHub Actions 更适合作为正式发布路径，因为它能保证：

- 发布从同一个 tag 对应的 commit 构建。
- 构建、typecheck、smoke、打包、校验顺序固定。
- release asset 由 CI 统一上传。
- 后续代码签名证书可以放 GitHub Secrets，不进入仓库。
- 自动更新依赖的 `latest.yml` 和安装器来自同一次构建。

## 3. 当前 workflow

文件：

```text
.github/workflows/desktop-release.yml
```

触发方式：

```yaml
workflow_dispatch
```

输入参数：

| 参数 | 类型 | 默认值 | 作用 |
| --- | --- | --- | --- |
| `tag` | string | 必填 | 已存在的 git tag，例如 `v0.2.0` |
| `draft` | boolean | `true` | 是否创建 GitHub Release 草稿 |
| `signed` | boolean | `false` | 是否使用签名打包入口 |
| `require_signed` | boolean | `false` | 是否要求安装器 Authenticode 签名有效 |

权限：

```yaml
permissions:
  contents: write
```

原因是创建 GitHub Release 和上传资产需要写入 release 内容。

## 4. 发布流程

### 第 1 轮：unsigned 内测包

输入：

```text
tag = v0.2.0
draft = true
signed = false
require_signed = false
```

流程：

```text
checkout tag
-> npm.cmd install
-> CCR_SMOKE_SKIP_HEADLESS_AUTH_GATE=1 npm.cmd run ci:smoke
-> npm.cmd run desktop:dist
-> npm.cmd run smoke:desktop-release-artifacts
-> npm.cmd run smoke:desktop-signing-readiness
-> npm.cmd run release:desktop:check
-> node scripts/prepare-desktop-github-release.mjs --execute --draft
```

输出：

- GitHub Release draft。
- `CCR-Desktop-<version>-win-x64.exe`。
- `CCR-Desktop-<version>-win-x64.exe.blockmap`。
- `latest.yml`。
- release notes。

### 第 2 轮：unsigned 正式公开发布

输入：

```text
tag = v0.2.0
draft = false
signed = false
require_signed = false
```

这是当前短期策略：不购买代码签名证书，允许 Windows 显示未知发布者提示；发布说明中必须保留 SHA256，自动更新依赖 GitHub Release HTTPS 和 `latest.yml` sha512 校验。

公开发布会额外执行：

```text
npm.cmd run smoke:desktop-auto-update-feed
```

它会从 GitHub Release 下载真实 `latest.yml`，检查安装包和 `.blockmap` 是否可达，并可用 `CCR_DESKTOP_UPDATE_FROM_VERSION` 模拟旧版本升级。

### 第 3 轮：未来签名发布

```text
tag = v0.2.0
draft = false
signed = true
require_signed = true
```

这只是未来选项。只有购买代码签名证书后再启用，并要求 `CCR_REQUIRE_SIGNED=1` 对应检查通过。

## 5. 与本地 gh 脚本的关系

本地脚本：

```text
scripts/prepare-desktop-github-release.mjs
```

不是被废弃，而是作为发布逻辑的单一入口：

```text
本地 dry-run
-> release:desktop:check
-> release:desktop:dry-run

CI 正式上传
-> node scripts/prepare-desktop-github-release.mjs --execute --draft
```

这样能避免本地一套上传逻辑、CI 又一套上传逻辑。

脚本里使用 `gh release create --verify-tag`，作用是：如果 tag 不存在于 GitHub 仓库，发布会失败，而不是帮我们临时创建一个 tag。

脚本会先创建 draft release，再逐个上传资产；如果 release 已经存在，它会复用已有 release，跳过已匹配资产，补传缺失或不匹配资产。这样本地或 CI 上传大 exe 超时后，重新运行同一命令可以继续恢复。

## 6. 边界和不变式

- 发布必须基于已有 tag。
- workflow 不自动创建 tag。
- workflow 不自动推送 tag。
- 默认创建 draft，不默认公开发布。
- 默认 unsigned，不默认要求证书；短期不购买代码签名证书。
- signed 模式只从 GitHub Secrets 读取证书环境变量。
- release 资产必须先通过本地 metadata 校验。
- `latest.yml`、安装器和 `.blockmap` 必须来自同一次构建。
- public release 必须通过 `smoke:desktop-auto-update-feed` 验证远端更新 feed。
- workflow 只负责发布 Desktop 安装器，不负责 npm publish。
- workflow 中的 smoke 必须是可重复的隔离测试，不允许依赖本机 `~/.ccr`、真实登录态或用户目录里的 OAuth 凭据；如果要验证未登录分支，必须显式指定临时 `CCR_CONFIG_DIR`、临时 `CCR_LLM_CONFIG_PATH`、临时 `CCR_CODEX_OAUTH_CREDENTIAL_FILE`。
- Desktop 发布 workflow 会显式设置 `CCR_SMOKE_SKIP_HEADLESS_AUTH_GATE=1`，跳过需要启动 `cli.js -p` 的未登录 headless prompt 子进程。原因是 GitHub Actions 无用户态、无真实 OAuth 凭据，这条检查容易变成环境相关超时；本地 `ci:smoke` 仍保留完整未登录 JSON auth gate 验证。
- runtime smoke 不再用 `getTools()` 枚举全量工具。全量枚举会触发 WebSearch 等认证相关工具的 `isEnabled()` 逻辑，导致无凭据 CI 误走 Anthropic 认证链路；发布门禁只直接导入并验证核心本地工具。
- 在 `CCR_SMOKE_SKIP_HEADLESS_AUTH_GATE=1` 下，runtime smoke 不校验 `FileReadTool.mapToolResultToToolResultBlockParam()`。该转换路径会读取主模型能力开关，在无凭据 CI 中会触发默认 Anthropic 认证判断；发布门禁只验证工具调用 roundtrip。

## 7. 本地校验

校验 workflow 结构：

```powershell
npm.cmd run smoke:desktop-github-actions-release
```

校验发布清单：

```powershell
npm.cmd run release:desktop:check
```

完整本地 smoke：

```powershell
npm.cmd run ci:smoke
```

## 8. 后续进入自动更新

GitHub Actions 发布流水线稳定后，自动更新状态机就可以基于 GitHub Release 产物设计：

```text
Desktop 启动
-> 检查 GitHub Release latest.yml
-> 比较版本
-> 展示更新提示
-> 下载更新包
-> 安装或提示重启
-> 失败时展示错误和回退指引
```

自动更新不应该在发布流水线稳定前先写死 URL，否则会把“不稳定的发布资产”变成客户端逻辑的一部分。

## 9. 官方参考

- GitHub Actions workflow syntax: https://docs.github.com/actions/reference/workflows-and-actions/workflow-syntax
- GitHub CLI `gh release create`: https://cli.github.com/manual/gh_release_create
- GitHub Releases REST API: https://docs.github.com/rest/releases
- electron-builder publishing: https://www.electron.build/publish.html
