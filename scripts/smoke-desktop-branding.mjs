#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const sourceSvg = join(root, 'apps', 'desktop', 'assets', 'ccr-desktop-icon.svg')
const generatedDir = join(root, 'apps', 'desktop', 'assets', 'generated')
const iconPng = join(generatedDir, 'icon.png')
const iconIco = join(generatedDir, 'icon.ico')
const expectedIcon = 'apps/desktop/assets/generated/icon.ico'

for (const requiredPath of [sourceSvg, iconPng, iconIco]) {
  if (!existsSync(requiredPath)) {
    fail('desktop branding asset is missing', { requiredPath })
  }
}

const svgText = readFileSync(sourceSvg, 'utf8')
if (/placeholder/i.test(svgText)) {
  fail('desktop source SVG still contains placeholder wording', { sourceSvg })
}

assertPng(iconPng)
assertIco(iconIco)

const winConfig = packageJson.build?.win
const nsisConfig = packageJson.build?.nsis

if (winConfig?.icon !== expectedIcon) {
  fail('build.win.icon must point to generated desktop icon', {
    actual: winConfig?.icon,
    expected: expectedIcon,
  })
}

if (nsisConfig?.installerIcon !== expectedIcon || nsisConfig?.uninstallerIcon !== expectedIcon) {
  fail('NSIS installer and uninstaller icons must point to generated desktop icon', {
    installerIcon: nsisConfig?.installerIcon,
    uninstallerIcon: nsisConfig?.uninstallerIcon,
    expected: expectedIcon,
  })
}

if (packageJson.build?.productName !== 'CCR Desktop') {
  fail('productName must stay CCR Desktop', { productName: packageJson.build?.productName })
}

console.log(
  JSON.stringify(
    {
      ok: true,
      productName: packageJson.build.productName,
      icon: winConfig.icon,
      installerIcon: nsisConfig.installerIcon,
      iconPngSize: statSync(iconPng).size,
      iconIcoSize: statSync(iconIco).size,
      checked: ['sourceSvg', 'icon.png', 'icon.ico', 'build.win.icon', 'nsis.icons', 'productName'],
    },
    null,
    2,
  ),
)

function assertPng(file) {
  const signature = readFileSync(file).subarray(0, 8)
  const expected = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (!signature.equals(expected)) {
    fail('invalid PNG signature', { file })
  }
}

function assertIco(file) {
  const data = readFileSync(file)
  if (data.length < 22) {
    fail('ICO file is too small', { file, size: data.length })
  }

  const reserved = data.readUInt16LE(0)
  const type = data.readUInt16LE(2)
  const count = data.readUInt16LE(4)

  if (reserved !== 0 || type !== 1 || count < 4) {
    fail('invalid ICO header', { file, reserved, type, count })
  }
}

function fail(message, details) {
  console.error(JSON.stringify({ ok: false, message, ...details }, null, 2))
  process.exit(1)
}
