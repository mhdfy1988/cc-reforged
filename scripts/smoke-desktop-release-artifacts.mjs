#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import YAML from 'yaml'

const repoRoot = process.cwd()
const releaseDir = join(repoRoot, 'release', 'desktop')
const latestPath = join(releaseDir, 'latest.yml')
const packagePath = join(repoRoot, 'package.json')

if (!existsSync(packagePath)) {
  fail('package.json not found', { packagePath })
}

if (!existsSync(latestPath)) {
  fail('latest.yml not found. Run npm.cmd run desktop:dist first.', { latestPath })
}

const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
const latest = YAML.parse(readFileSync(latestPath, 'utf8'))
const artifactName = packageJson.build?.win?.artifactName

if (artifactName !== 'CCR-${version}-${os}-${arch}.${ext}') {
  fail('desktop artifactName must be stable and whitespace-free', {
    artifactName,
    expected: 'CCR-${version}-${os}-${arch}.${ext}',
  })
}

if (latest.version !== packageJson.version) {
  fail('latest.yml version does not match package.json version', {
    latestVersion: latest.version,
    packageVersion: packageJson.version,
  })
}

const expectedInstallerName = artifactName
  .replace('${version}', packageJson.version)
  .replace('${os}', 'win')
  .replace('${arch}', 'x64')
  .replace('${ext}', 'exe')

const expectedInstallerPath = join(releaseDir, expectedInstallerName)
const expectedBlockmapPath = `${expectedInstallerPath}.blockmap`

for (const requiredPath of [expectedInstallerPath, expectedBlockmapPath]) {
  if (!existsSync(requiredPath)) {
    fail('required desktop release artifact is missing', { requiredPath })
  }
}

if (latest.path !== expectedInstallerName) {
  fail('latest.yml path does not match expected installer name', {
    latestPath: latest.path,
    expectedInstallerName,
  })
}

const files = Array.isArray(latest.files) ? latest.files : []
if (files.length === 0) {
  fail('latest.yml files must not be empty', { latestPath })
}

for (const file of files) {
  if (!file?.url) {
    fail('latest.yml file entry is missing url', { file })
  }

  if (/\s/.test(file.url)) {
    fail('latest.yml file url must not contain whitespace', { url: file.url })
  }

  const artifactPath = resolve(releaseDir, file.url)
  if (!artifactPath.startsWith(resolve(releaseDir))) {
    fail('latest.yml file url escapes release directory', { url: file.url })
  }

  if (!existsSync(artifactPath)) {
    fail('latest.yml file url points to a missing artifact', {
      url: file.url,
      artifactPath,
    })
  }

  const actualSize = statSync(artifactPath).size
  if (file.size !== actualSize) {
    fail('latest.yml file size does not match artifact size', {
      url: file.url,
      expectedSize: file.size,
      actualSize,
    })
  }

  const actualSha512 = createHash('sha512').update(readFileSync(artifactPath)).digest('base64')
  if (file.sha512 !== actualSha512 || latest.sha512 !== actualSha512) {
    fail('latest.yml sha512 does not match artifact sha512', {
      url: file.url,
      expectedFileSha512: file.sha512,
      expectedLatestSha512: latest.sha512,
      actualSha512,
    })
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      version: packageJson.version,
      installer: basename(expectedInstallerPath),
      installerSize: statSync(expectedInstallerPath).size,
      blockmap: basename(expectedBlockmapPath),
      latest: basename(latestPath),
      checked: [
        'artifactName',
        'latest.version',
        'latest.path',
        'latest.files.url',
        'artifact.size',
        'artifact.sha512',
        'blockmap.exists',
      ],
    },
    null,
    2,
  ),
)

function fail(message, details) {
  console.error(JSON.stringify({ ok: false, message, ...details }, null, 2))
  process.exit(1)
}
