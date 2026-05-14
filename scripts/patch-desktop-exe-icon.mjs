#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as ResEdit from 'resedit'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDir, '..')
const defaultAppOutDir = join(root, 'release', 'desktop', 'win-unpacked')
const defaultExePath = join(defaultAppOutDir, 'CCR.exe')
const defaultIconPath = join(root, 'apps', 'desktop', 'assets', 'generated', 'icon.ico')

export default async function patchDesktopExeIcon(context = {}) {
  if (process.platform !== 'win32') {
    return null
  }

  const appOutDir = context.appOutDir ? resolve(context.appOutDir) : defaultAppOutDir
  const productFilename = context.packager?.appInfo?.productFilename || 'CCR'
  const exePath = resolve(process.env.CCR_DESKTOP_EXE_PATH || join(appOutDir, `${productFilename}.exe`))
  const iconPath = resolve(process.env.CCR_DESKTOP_ICON_PATH || defaultIconPath)

  const result = await patchExecutableIcon({ exePath, iconPath })
  console.log(JSON.stringify({ ok: true, action: 'patch-desktop-exe-icon', ...result }, null, 2))
  return result
}

export async function patchExecutableIcon({ exePath, iconPath }) {
  if (!existsSync(exePath)) {
    throw new Error(`Desktop executable does not exist: ${exePath}`)
  }
  if (!existsSync(iconPath)) {
    throw new Error(`Desktop icon does not exist: ${iconPath}`)
  }

  const exeBuffer = await readFile(exePath)
  const iconBuffer = await readFile(iconPath)
  const executable = ResEdit.NtExecutable.from(exeBuffer, { ignoreCert: true })
  const resources = ResEdit.NtExecutableResource.from(executable)
  const iconFile = ResEdit.Data.IconFile.from(iconBuffer)
  const existingGroups = ResEdit.Resource.IconGroupEntry.fromEntries(resources.entries)
  const targetGroups =
    existingGroups.length > 0
      ? existingGroups.map(group => ({ id: group.id, lang: group.lang }))
      : [{ id: 1, lang: 1033 }]

  for (const group of targetGroups) {
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
      resources.entries,
      group.id,
      group.lang,
      iconFile.icons.map(item => item.data),
    )
  }

  resources.outputResource(executable)
  await writeFile(exePath, Buffer.from(executable.generate()))

  return {
    exePath,
    iconPath,
    iconGroups: targetGroups,
    iconCount: iconFile.icons.length,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await patchDesktopExeIcon()
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          action: 'patch-desktop-exe-icon',
          message: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      ),
    )
    process.exit(1)
  }
}
