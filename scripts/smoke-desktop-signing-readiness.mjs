#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const requireSigned = process.env.CCR_REQUIRE_SIGNED === '1'
const signingRequested = process.env.CCR_DESKTOP_SIGN === '1'
const certStatus = inspectCertificateEnv()
const installerName = packageJson.build.win.artifactName
  .replace('${version}', packageJson.version)
  .replace('${os}', 'win')
  .replace('${arch}', 'x64')
  .replace('${ext}', 'exe')
const installerPath = join(root, 'release', 'desktop', installerName)

if (packageJson.scripts['desktop:dist:signed'] !== 'node ./scripts/desktop-package.mjs --dist --signed') {
  fail('desktop:dist:signed script is missing or changed unexpectedly', {
    script: packageJson.scripts['desktop:dist:signed'],
  })
}

if (packageJson.build.win.signAndEditExecutable !== false) {
  fail('default unsigned desktop build must keep signAndEditExecutable disabled', {
    signAndEditExecutable: packageJson.build.win.signAndEditExecutable,
  })
}

if (packageJson.build.win.verifyUpdateCodeSignature !== false) {
  fail('default unsigned desktop build must keep verifyUpdateCodeSignature disabled', {
    verifyUpdateCodeSignature: packageJson.build.win.verifyUpdateCodeSignature,
  })
}

if (certStatus.partial.length > 0) {
  fail('certificate environment is incomplete', { missing: certStatus.partial })
}

if (signingRequested && !certStatus.available) {
  fail('CCR_DESKTOP_SIGN=1 requires certificate environment', {
    required: ['WIN_CSC_LINK/WIN_CSC_KEY_PASSWORD', 'CSC_LINK/CSC_KEY_PASSWORD'],
  })
}

const signature = inspectInstallerSignature(installerPath)

if (requireSigned && signature.status !== 'Valid') {
  fail('installer must be signed when CCR_REQUIRE_SIGNED=1', {
    installerPath,
    signature,
  })
}

console.log(
  JSON.stringify(
    {
      ok: true,
      defaultBuild: 'unsigned',
      signedBuildCommand: 'npm.cmd run desktop:dist:signed',
      signingEnvAvailable: certStatus.available,
      installer: existsSync(installerPath) ? installerPath : null,
      installerSignature: signature,
      checked: [
        'desktop:dist:signed',
        'default unsigned config',
        'certificate env pairing',
        'installer Authenticode status',
      ],
    },
    null,
    2,
  ),
)

function inspectCertificateEnv() {
  const pairs = [
    ['WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD'],
    ['CSC_LINK', 'CSC_KEY_PASSWORD'],
  ]

  const partial = []
  let available = false

  for (const [linkKey, passwordKey] of pairs) {
    const hasLink = Boolean(process.env[linkKey])
    const hasPassword = Boolean(process.env[passwordKey])
    if (hasLink && hasPassword) {
      available = true
    } else if (hasLink || hasPassword) {
      partial.push(hasLink ? passwordKey : linkKey)
    }
  }

  return { available, partial }
}

function inspectInstallerSignature(installerPath) {
  if (!existsSync(installerPath)) {
    return {
      status: 'missing',
      note: 'installer not found; run npm.cmd run desktop:dist before artifact signature verification',
    }
  }

  if (process.platform !== 'win32') {
    return {
      status: 'skipped',
      note: 'Authenticode verification is Windows-only in this script',
    }
  }

  const powershell = process.env.ComSpec ? 'powershell.exe' : 'powershell.exe'
  const command = `
$sig = Get-AuthenticodeSignature -LiteralPath $env:CCR_SIGNING_CHECK_PATH
$result = [pscustomobject]@{
  Status = $sig.Status.ToString()
  StatusMessage = $sig.StatusMessage
  SignerSubject = if ($sig.SignerCertificate) { $sig.SignerCertificate.Subject } else { $null }
  TimeStamperSubject = if ($sig.TimeStamperCertificate) { $sig.TimeStamperCertificate.Subject } else { $null }
}
$result | ConvertTo-Json -Compress
`

  const result = spawnSync(powershell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      CCR_SIGNING_CHECK_PATH: installerPath,
    },
  })

  if (result.error) {
    return {
      status: 'error',
      message: result.error.message,
    }
  }

  if (result.status !== 0) {
    return {
      status: 'error',
      exitCode: result.status,
      stderr: result.stderr.trim(),
    }
  }

  try {
    const parsed = JSON.parse(result.stdout)
    return {
      status: parsed.Status,
      statusMessage: parsed.StatusMessage,
      signerSubject: parsed.SignerSubject,
      timeStamperSubject: parsed.TimeStamperSubject,
    }
  } catch (error) {
    return {
      status: 'error',
      message: `Failed to parse Authenticode result: ${error.message}`,
      stdout: result.stdout.trim(),
    }
  }
}

function fail(message, details) {
  console.error(JSON.stringify({ ok: false, message, ...details }, null, 2))
  process.exit(1)
}
