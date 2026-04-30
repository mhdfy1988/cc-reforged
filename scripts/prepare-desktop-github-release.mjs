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

const ghArgs = [
  'release',
  'create',
  tag,
  ...assets.map((assetPath) => relative(repoRoot, assetPath)),
  '--repo',
  repo,
  '--title',
  title,
  '--notes-file',
  relative(repoRoot, notesPath),
  '--verify-tag',
]
if (draft) {
  ghArgs.push('--draft')
}

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
  assets: assets.map((assetPath) => ({
    file: relative(repoRoot, assetPath),
    size: statSync(assetPath).size,
    sha256: sha256(assetPath),
  })),
  command: ['gh', ...ghArgs],
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

const result = spawnSync('gh', ghArgs, {
  cwd: repoRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
})

if (result.status !== 0) {
  fail('gh release create failed', {
    status: result.status,
    stdout: result.stdout?.trim(),
    stderr: result.stderr?.trim(),
    command: releaseSummary.command,
  })
}

console.log(
  JSON.stringify(
    {
      ...releaseSummary,
      stdout: result.stdout?.trim(),
      stderr: result.stderr?.trim(),
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
    '- 如果是正式公开发布，建议设置 `CCR_REQUIRE_SIGNED=1` 后重新验签。',
    '',
    '## 当前说明',
    '',
    `- package: ${packageJson.name}@${packageJson.version}`,
    '- 这份 release note 由 `scripts/prepare-desktop-github-release.mjs` 生成。',
  ]
  writeFileSync(notesPath, `${lines.join('\n')}\n`, 'utf8')
  return notesPath
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
