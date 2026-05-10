#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import semver from 'semver'
import YAML from 'yaml'

const repoRoot = process.cwd()
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const publishConfig = getGitHubPublishConfig(packageJson)
const repo = `${publishConfig.owner}/${publishConfig.repo}`
const version = packageJson.version
const tag = process.env.CCR_DESKTOP_UPDATE_RELEASE_TAG || `v${version}`
const fromVersion = process.env.CCR_DESKTOP_UPDATE_FROM_VERSION?.trim()
const shouldDownloadInstaller =
  process.env.CCR_DESKTOP_UPDATE_DOWNLOAD_INSTALLER === '1'
const releaseBaseUrl = `https://github.com/${repo}/releases/download/${tag}`
const latestUrl = `${releaseBaseUrl}/latest.yml`

const latestText = await fetchText(latestUrl)
const latest = YAML.parse(latestText)
const artifactName = packageJson.build?.win?.artifactName
if (artifactName !== 'CCR-Desktop-${version}-${os}-${arch}.${ext}') {
  fail('desktop artifactName must stay stable for update metadata', {
    artifactName,
  })
}

const expectedInstallerName = artifactName
  .replace('${version}', version)
  .replace('${os}', 'win')
  .replace('${arch}', 'x64')
  .replace('${ext}', 'exe')

if (latest.version !== version) {
  fail('remote latest.yml version does not match package.json', {
    latestVersion: latest.version,
    packageVersion: version,
    latestUrl,
  })
}

if (fromVersion) {
  if (!semver.valid(fromVersion) || !semver.valid(version)) {
    fail('CCR_DESKTOP_UPDATE_FROM_VERSION and package version must be semver values', {
      fromVersion,
      version,
    })
  }
  if (!semver.gt(version, fromVersion)) {
    fail('remote update version must be newer than the simulated installed version', {
      fromVersion,
      version,
    })
  }
}

if (latest.path !== expectedInstallerName) {
  fail('remote latest.yml path does not point to the expected installer', {
    latestPath: latest.path,
    expectedInstallerName,
  })
}

const fileEntry = Array.isArray(latest.files)
  ? latest.files.find(file => file?.url === expectedInstallerName)
  : null
if (!fileEntry) {
  fail('remote latest.yml files does not include the installer asset', {
    expectedInstallerName,
    files: latest.files,
  })
}

if (fileEntry.sha512 !== latest.sha512) {
  fail('remote latest.yml top-level sha512 must match files[0].sha512', {
    fileSha512: fileEntry.sha512,
    latestSha512: latest.sha512,
  })
}

const installerUrl = `${releaseBaseUrl}/${encodeURIComponent(expectedInstallerName)}`
const blockmapName = `${expectedInstallerName}.blockmap`
const blockmapUrl = `${releaseBaseUrl}/${encodeURIComponent(blockmapName)}`
const installerProbe = await probeRemoteAsset(installerUrl, fileEntry.size)
const blockmapProbe = await probeRemoteAsset(blockmapUrl)

let installerSha512 = null
if (shouldDownloadInstaller) {
  const bytes = Buffer.from(await fetchArrayBuffer(installerUrl))
  installerSha512 = createHash('sha512').update(bytes).digest('base64')
  if (installerSha512 !== fileEntry.sha512) {
    fail('downloaded installer sha512 does not match latest.yml', {
      expectedSha512: fileEntry.sha512,
      actualSha512: installerSha512,
    })
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      repo,
      tag,
      latestUrl,
      version,
      fromVersion: fromVersion || null,
      installer: {
        name: expectedInstallerName,
        url: installerUrl,
        size: fileEntry.size,
        sha512: fileEntry.sha512,
        probe: installerProbe,
        downloadedSha512: installerSha512,
      },
      blockmap: {
        name: blockmapName,
        url: blockmapUrl,
        probe: blockmapProbe,
      },
      checked: [
        'remote latest.yml reachable',
        'latest.version matches package.json',
        'latest path and files url point to installer',
        'installer asset reachable',
        'blockmap asset reachable',
        ...(fromVersion ? ['remote version is newer than simulated installed version'] : []),
        ...(shouldDownloadInstaller ? ['installer sha512 verified by full download'] : []),
      ],
    },
    null,
    2,
  ),
)

function getGitHubPublishConfig(packageJson) {
  const configs = Array.isArray(packageJson.build?.publish)
    ? packageJson.build.publish
    : []
  const github = configs.find(config => config?.provider === 'github')
  if (!github?.owner || !github?.repo) {
    fail('package.json build.publish must include GitHub owner and repo')
  }
  return github
}

async function probeRemoteAsset(url, expectedSize) {
  const response = await fetch(url, {
    headers: {
      Range: 'bytes=0-0',
      'User-Agent': `cc-reforged-update-smoke/${packageJson.version}`,
    },
  })
  if (!response.ok && response.status !== 206) {
    fail('remote update asset is not reachable', {
      url,
      status: response.status,
      statusText: response.statusText,
    })
  }
  await response.arrayBuffer()

  const contentRange = response.headers.get('content-range')
  const totalSize = parseTotalSize(contentRange)
  if (expectedSize && totalSize !== null && totalSize !== expectedSize) {
    fail('remote installer size does not match latest.yml', {
      url,
      expectedSize,
      totalSize,
      contentRange,
    })
  }

  return {
    status: response.status,
    finalHost: new URL(response.url).host,
    contentType: response.headers.get('content-type'),
    contentRange,
    totalSize,
  }
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': `cc-reforged-update-smoke/${packageJson.version}`,
    },
  })
  if (!response.ok) {
    fail('failed to fetch remote update metadata', {
      url,
      status: response.status,
      statusText: response.statusText,
    })
  }
  return response.text()
}

async function fetchArrayBuffer(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': `cc-reforged-update-smoke/${packageJson.version}`,
    },
  })
  if (!response.ok) {
    fail('failed to download installer for sha512 verification', {
      url,
      status: response.status,
      statusText: response.statusText,
    })
  }
  return response.arrayBuffer()
}

function parseTotalSize(contentRange) {
  if (!contentRange) {
    return null
  }
  const match = contentRange.match(/\/(\d+)$/)
  return match ? Number(match[1]) : null
}

function fail(message, details = {}) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message,
        ...details,
        cwd: repoRoot,
      },
      null,
      2,
    ),
  )
  process.exit(1)
}
