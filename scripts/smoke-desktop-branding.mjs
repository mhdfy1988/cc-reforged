#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const sourceSvg = join(root, 'apps', 'desktop', 'assets', 'ccr-icon.svg')
const generatedDir = join(root, 'apps', 'desktop', 'assets', 'generated')
const rendererPublicIcon = join(
  root,
  'apps',
  'desktop',
  'src',
  'renderer',
  'public',
  'ccr-icon.png',
)
const rendererIndexHtml = join(root, 'apps', 'desktop', 'src', 'renderer', 'index.html')
const rendererTitlebar = join(
  root,
  'apps',
  'desktop',
  'src',
  'renderer',
  'src',
  'components',
  'layout',
  'WindowTitlebar.tsx',
)
const iconPng = join(generatedDir, 'icon.png')
const iconIco = join(generatedDir, 'icon.ico')
const expectedIcon = 'apps/desktop/assets/generated/icon.ico'
const expectedAfterPack = 'scripts/patch-desktop-exe-icon.mjs'

for (const requiredPath of [
  sourceSvg,
  iconPng,
  iconIco,
  rendererPublicIcon,
  rendererIndexHtml,
  rendererTitlebar,
]) {
  if (!existsSync(requiredPath)) {
    fail('desktop branding asset is missing', { requiredPath })
  }
}

const svgText = readFileSync(sourceSvg, 'utf8')
if (/placeholder/i.test(svgText)) {
  fail('desktop source SVG still contains placeholder wording', { sourceSvg })
}

const rendererIndexText = readFileSync(rendererIndexHtml, 'utf8')
const rendererTitlebarText = readFileSync(rendererTitlebar, 'utf8')
for (const [file, text] of [
  [rendererIndexHtml, rendererIndexText],
  [rendererTitlebar, rendererTitlebarText],
]) {
  if (!text.includes('ccr-icon.png')) {
    fail('desktop renderer must use the generated brand icon', { file })
  }
}

assertPng(iconPng)
assertPng(rendererPublicIcon)
assertIco(iconIco)

const winConfig = packageJson.build?.win
const nsisConfig = packageJson.build?.nsis

if (winConfig?.icon !== expectedIcon) {
  fail('build.win.icon must point to generated desktop icon', {
    actual: winConfig?.icon,
    expected: expectedIcon,
  })
}

if (winConfig?.signAndEditExecutable !== false) {
  fail('default unsigned desktop build must not enable electron-builder signing/resource editing', {
    signAndEditExecutable: winConfig?.signAndEditExecutable,
  })
}

if (packageJson.build?.afterPack !== expectedAfterPack) {
  fail('desktop build must patch CCR.exe icon after pack without invoking winCodeSign', {
    afterPack: packageJson.build?.afterPack,
    expected: expectedAfterPack,
  })
}

if (nsisConfig?.installerIcon !== expectedIcon || nsisConfig?.uninstallerIcon !== expectedIcon) {
  fail('NSIS installer and uninstaller icons must point to generated desktop icon', {
    installerIcon: nsisConfig?.installerIcon,
    uninstallerIcon: nsisConfig?.uninstallerIcon,
    expected: expectedIcon,
  })
}

if (nsisConfig?.shortcutName !== 'CCR') {
  fail('NSIS shortcut name must stay CCR', { shortcutName: nsisConfig?.shortcutName })
}

if (packageJson.build?.productName !== 'CCR') {
  fail('productName must stay CCR', { productName: packageJson.build?.productName })
}

console.log(
  JSON.stringify(
    {
      ok: true,
      productName: packageJson.build.productName,
      afterPack: packageJson.build.afterPack,
      icon: winConfig.icon,
      installerIcon: nsisConfig.installerIcon,
      shortcutName: nsisConfig.shortcutName,
      iconPngSize: statSync(iconPng).size,
      iconIcoSize: statSync(iconIco).size,
      rendererPublicIconSize: statSync(rendererPublicIcon).size,
      checked: [
        'sourceSvg',
        'icon.png',
        'icon.ico',
        'rendererPublicIcon',
        'rendererIconReferences',
        'build.win.icon',
        'build.afterPack',
        'build.win.signAndEditExecutable',
        'nsis.icons',
        'nsis.shortcutName',
        'productName',
      ],
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

  for (let index = 0; index < count; index += 1) {
    const directoryOffset = 6 + index * 16
    const bytesInResource = data.readUInt32LE(directoryOffset + 8)
    const imageOffset = data.readUInt32LE(directoryOffset + 12)
    const dibHeaderSize = data.readUInt32LE(imageOffset)
    if (bytesInResource <= 40 || dibHeaderSize !== 40) {
      fail('ICO image must use BMP/DIB entries for Windows resource compatibility', {
        file,
        index,
        bytesInResource,
        dibHeaderSize,
      })
    }
  }
}

function fail(message, details) {
  console.error(JSON.stringify({ ok: false, message, ...details }, null, 2))
  process.exit(1)
}
