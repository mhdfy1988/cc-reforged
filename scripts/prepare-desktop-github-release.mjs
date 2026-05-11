#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import YAML from 'yaml'

const repoRoot = process.cwd()
const args = new Set(process.argv.slice(2))
const checkOnly = args.has('--check')
const execute = args.has('--execute')
const draft = args.has('--draft') || !args.has('--public')

for (const arg of args) {
  if (!['--check', '--execute', '--draft', '--public'].includes(arg)) {
    fail('unknown argument', { arg })
  }
}

if (checkOnly && execute) {
  fail('--check cannot be combined with --execute')
}

const packageJson = readJson(join(repoRoot, 'package.json'))
const version = packageJson.version
const tag = process.env.CCR_DESKTOP_RELEASE_TAG || `v${version}`
const title = process.env.CCR_DESKTOP_RELEASE_TITLE || `CCR Desktop v${version}`
const githubPublish = getGitHubPublishConfig(packageJson)
const repo = `${githubPublish.owner}/${githubPublish.repo}`

const releaseDir = join(repoRoot, 'release', 'desktop')
const latestPath = join(releaseDir, 'latest.yml')
if (!existsSync(latestPath)) {
  fail('latest.yml not found; run npm.cmd run desktop:dist first', { latestPath })
}

const latest = YAML.parse(readFileSync(latestPath, 'utf8'))
if (latest.version !== version) {
  fail('latest.yml version does not match package.json version', {
    latestVersion: latest.version,
    packageVersion: version,
  })
}

const artifactName = packageJson.build?.win?.artifactName
if (artifactName !== 'CCR-Desktop-${version}-${os}-${arch}.${ext}') {
  fail('desktop artifactName must stay stable for release assets', {
    artifactName,
    expected: 'CCR-Desktop-${version}-${os}-${arch}.${ext}',
  })
}

const installerName = artifactName
  .replace('${version}', version)
  .replace('${os}', 'win')
  .replace('${arch}', 'x64')
  .replace('${ext}', 'exe')

const installerPath = join(releaseDir, installerName)
const blockmapPath = `${installerPath}.blockmap`
const assets = [installerPath, blockmapPath, latestPath]

for (const assetPath of assets) {
  if (!existsSync(assetPath)) {
    fail('desktop release asset is missing', { assetPath })
  }
}

if (latest.path !== installerName) {
  fail('latest.yml path does not match expected installer name', {
    latestPath: latest.path,
    expectedInstallerName: installerName,
  })
}

const files = Array.isArray(latest.files) ? latest.files : []
if (!files.some((file) => file?.url === installerName)) {
  fail('latest.yml files does not include the installer asset', { installerName, files })
}

const notesPath = writeReleaseNotes({
  assets,
  packageJson,
  repo,
  tag,
  title,
  version,
})

const assetSummaries = assets.map((assetPath) => ({
  name: basename(assetPath),
  file: relative(repoRoot, assetPath),
  size: statSync(assetPath).size,
  sha256: sha256(assetPath),
}))

const releaseCreateArgs = [
  'release',
  'create',
  tag,
  '--repo',
  repo,
  '--title',
  title,
  '--notes-file',
  relative(repoRoot, notesPath),
  '--verify-tag',
  '--draft',
]
const releaseEditArgs = [
  'release',
  'edit',
  tag,
  '--repo',
  repo,
  '--title',
  title,
  '--notes-file',
  relative(repoRoot, notesPath),
]
const releasePublishArgs = ['release', 'edit', tag, '--repo', repo, '--draft=false']
const uploadCommands = assetSummaries.map((asset) => [
  'gh',
  'release',
  'upload',
  tag,
  asset.file,
  '--repo',
  repo,
  '--clobber',
])

const ghAvailable = commandAvailable('gh')
const tagExists = gitTagExists(tag)
const dirtyFiles = gitDirtyFiles()
const releaseSummary = {
  ok: true,
  mode: execute ? 'execute' : checkOnly ? 'check' : 'dry-run',
  repo,
  version,
  tag,
  title,
  draft,
  ghAvailable,
  tagExists,
  dirtyFileCount: dirtyFiles.length,
  notesFile: relative(repoRoot, notesPath),
  resumable: true,
  recoveryBehavior:
    'existing releases are reused; matching assets are skipped; missing or mismatched assets are uploaded one by one',
  assets: assetSummaries,
  commands: {
    createDraftRelease: ['gh', ...releaseCreateArgs],
    refreshReleaseNotes: ['gh', ...releaseEditArgs],
    uploadAssets: uploadCommands,
    publishRelease: draft ? null : ['gh', ...releasePublishArgs],
  },
}

if (!execute) {
  console.log(JSON.stringify(releaseSummary, null, 2))
  process.exit(0)
}

if (!ghAvailable) {
  fail('GitHub CLI is not installed or not on PATH; cannot execute release creation', {
    command: 'gh --version',
  })
}

if (!tagExists) {
  fail('release tag does not exist locally; create and push the tag before publishing a GitHub Release', {
    tag,
    suggestedCommands: [`git tag ${tag}`, `git push origin ${tag}`],
  })
}

if (dirtyFiles.length > 0 && process.env.CCR_ALLOW_DIRTY_RELEASE !== '1') {
  fail('working tree is dirty; commit or explicitly set CCR_ALLOW_DIRTY_RELEASE=1 before creating a release', {
    dirtyFileCount: dirtyFiles.length,
    dirtyFiles: dirtyFiles.slice(0, 20),
  })
}

const publishResult = publishReleaseWithRecovery({
  assets: assetSummaries,
  draft,
  releaseCreateArgs,
  releaseEditArgs,
  releasePublishArgs,
  repo,
  tag,
})

console.log(
  JSON.stringify(
    {
      ...releaseSummary,
      ...publishResult,
    },
    null,
  2,
  ),
)

function getGitHubPublishConfig(packageJson) {
  const configs = Array.isArray(packageJson.build?.publish) ? packageJson.build.publish : []
  const github = configs.find((config) => config?.provider === 'github')
  if (!github?.owner || !github?.repo) {
    fail('package.json build.publish must include GitHub owner and repo')
  }
  return github
}

function readJson(path) {
  if (!existsSync(path)) {
    fail('required json file not found', { path })
  }
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeReleaseNotes({ assets, packageJson, repo, tag, title, version }) {
  const notesDir = join(repoRoot, 'tmp', 'desktop-release')
  mkdirSync(notesDir, { recursive: true })
  const notesPath = join(notesDir, `release-notes-${tag}.md`)
  const lines = [
    `# ${title}`,
    '',
    `仓库：${repo}`,
    `版本：${version}`,
    `Tag：${tag}`,
    '',
    ...formatChangelogSection(version),
    '',
    '## 发布资产',
    '',
    ...assets.flatMap((assetPath) => [
      `- \`${relative(repoRoot, assetPath)}\``,
      `  - size: ${statSync(assetPath).size}`,
      `  - sha256: ${sha256(assetPath)}`,
    ]),
    '',
    '## 发布前已知门禁',
    '',
    '- `npm.cmd run desktop:dist` 需要先生成安装器产物。',
    '- `npm.cmd run smoke:desktop-release-artifacts` 需要通过。',
    '- `npm.cmd run smoke:desktop-signing-readiness` 需要通过。',
    '- 当前默认允许 unsigned 发布；只有显式设置 `CCR_REQUIRE_SIGNED=1` 时才要求 Authenticode 签名。',
    '- Windows 可能提示未知发布者。请以 GitHub Release 资产和下方 SHA256 校验值作为安装包来源校验依据。',
    '',
    '## 当前说明',
    '',
    `- package: ${packageJson.name}@${packageJson.version}`,
    '- 这份 release note 由 `scripts/prepare-desktop-github-release.mjs` 生成。',
  ]
  writeFileSync(notesPath, `${lines.join('\n')}\n`, 'utf8')
  return notesPath
}

function formatChangelogSection(version) {
  const changelogSection = readChangelogSection(version)
  if (!changelogSection) {
    return [
      '## 更新内容',
      '',
      '- 未在 `CHANGELOG.md` 中找到当前版本条目，请发布前补齐。',
    ]
  }

  return [
    '## 更新内容',
    '',
    ...changelogSection,
  ]
}

function readChangelogSection(version) {
  const changelogPath = join(repoRoot, 'CHANGELOG.md')
  if (!existsSync(changelogPath)) {
    return null
  }

  const lines = readFileSync(changelogPath, 'utf8').split(/\r?\n/)
  const headingPattern = new RegExp(`^##\\s+${escapeRegExp(version)}(?:\\s|$)`)
  const startIndex = lines.findIndex((line) => headingPattern.test(line.trim()))
  if (startIndex === -1) {
    return null
  }

  const sectionLines = []
  for (const line of lines.slice(startIndex + 1)) {
    if (/^##\s+/.test(line)) {
      break
    }
    sectionLines.push(line)
  }

  const trimmed = trimBlankLines(sectionLines)
  return trimmed.length > 0 ? trimmed : null
}

function trimBlankLines(lines) {
  let start = 0
  let end = lines.length
  while (start < end && lines[start].trim() === '') {
    start += 1
  }
  while (end > start && lines[end - 1].trim() === '') {
    end -= 1
  }
  return lines.slice(start, end)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function publishReleaseWithRecovery({
  assets,
  draft,
  releaseCreateArgs,
  releaseEditArgs,
  releasePublishArgs,
  repo,
  tag,
}) {
  let releaseState = getReleaseState({ repo, tag })
  const actions = []

  if (!releaseState.exists) {
    actions.push(runGh(releaseCreateArgs, 'create draft release'))
  } else {
    actions.push({
      action: 'reuse existing release',
      tag,
      draft: releaseState.release.isDraft,
      url: releaseState.release.url,
    })
  }

  actions.push(runGh(releaseEditArgs, 'refresh release metadata'))
  releaseState = getReleaseState({ repo, tag })

  for (const asset of assets) {
    const remoteAsset = findAsset(releaseState.release, asset.name)
    if (assetMatches(remoteAsset, asset)) {
      actions.push({
        action: 'skip matching asset',
        asset: asset.name,
        size: asset.size,
        sha256: asset.sha256,
      })
      continue
    }

    actions.push(
      runGh(
        ['release', 'upload', tag, asset.file, '--repo', repo, '--clobber'],
        `upload asset ${asset.name}`,
      ),
    )
    releaseState = getReleaseState({ repo, tag })
  }

  releaseState = getReleaseState({ repo, tag })
  const missingAssets = assets
    .filter((asset) => !assetMatches(findAsset(releaseState.release, asset.name), asset))
    .map((asset) => asset.name)
  if (missingAssets.length > 0) {
    fail('release assets are still missing or mismatched after upload', {
      tag,
      missingAssets,
      remoteAssets: releaseState.release.assets?.map((asset) => ({
        name: asset.name,
        size: asset.size,
        digest: asset.digest,
      })),
    })
  }

  if (!draft && releaseState.release.isDraft) {
    actions.push(runGh(releasePublishArgs, 'publish release'))
    releaseState = getReleaseState({ repo, tag })
  }

  return {
    release: {
      tagName: releaseState.release.tagName,
      name: releaseState.release.name,
      isDraft: releaseState.release.isDraft,
      isPrerelease: releaseState.release.isPrerelease,
      url: releaseState.release.url,
      assetCount: releaseState.release.assets.length,
    },
    actions,
  }
}

function getReleaseState({ repo, tag }) {
  const result = spawnSync(
    'gh',
    [
      'release',
      'view',
      tag,
      '--repo',
      repo,
      '--json',
      'tagName,name,isDraft,isPrerelease,url,assets',
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() ?? ''
    if (/release not found/i.test(stderr)) {
      return {
        exists: false,
        release: null,
      }
    }
    fail('failed to inspect GitHub Release', {
      tag,
      status: result.status,
      stdout: result.stdout?.trim(),
      stderr,
    })
  }

  return {
    exists: true,
    release: JSON.parse(result.stdout),
  }
}

function findAsset(release, name) {
  return release?.assets?.find((asset) => asset.name === name) ?? null
}

function assetMatches(remoteAsset, localAsset) {
  if (!remoteAsset) {
    return false
  }
  if (remoteAsset.size !== localAsset.size) {
    return false
  }
  const digest = typeof remoteAsset.digest === 'string' ? remoteAsset.digest : ''
  return digest === '' || digest === `sha256:${localAsset.sha256}`
}

function runGh(args, action) {
  const result = spawnSync('gh', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  if (result.status !== 0) {
    fail(`gh ${action} failed`, {
      action,
      status: result.status,
      stdout: result.stdout?.trim(),
      stderr: result.stderr?.trim(),
      command: ['gh', ...args],
    })
  }

  return {
    action,
    command: ['gh', ...args],
    stdout: result.stdout?.trim(),
    stderr: result.stderr?.trim(),
  }
}

function commandAvailable(command) {
  const result = spawnSync(command, ['--version'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return result.status === 0
}

function gitTagExists(tag) {
  const result = spawnSync('git', ['rev-parse', '--verify', `refs/tags/${tag}`], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return result.status === 0
}

function gitDirtyFiles() {
  const result = spawnSync('git', ['status', '--porcelain'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) {
    fail('failed to read git status', {
      status: result.status,
      stderr: result.stderr?.trim(),
    })
  }
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function fail(message, details = {}) {
  console.error(JSON.stringify({ ok: false, message, ...details }, null, 2))
  process.exit(1)
}
