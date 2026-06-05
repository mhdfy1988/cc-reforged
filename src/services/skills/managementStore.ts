import { readFile, rm } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import {
  parseCcrSkillPackageOwnerMarker,
  summarizeCcrSkillInstallManifest,
  type CcrSkillInstalledIndex,
  type CcrSkillInstalledRecord,
  type CcrSkillInstallManifest,
  type CcrSkillInstallManifestInput,
} from './installManifest.js'
import { getCcrSkillInstallPaths } from './installPaths.js'
import {
  readInstalledIndex,
  readLockIndex,
  writeJson,
} from './installTransaction.js'

export async function updateInstalledRecord(
  skillRef: string,
  options: { configHomeDir?: string },
  mutate: (record: CcrSkillInstalledRecord) => void,
): Promise<void> {
  const paths = getCcrSkillInstallPaths(options.configHomeDir)
  const installedIndex = await readInstalledIndex(paths.installedIndexPath)
  const match = findInstalledEntry(installedIndex, skillRef)
  if (!match) {
    throw new Error(`Skill install record was not found: ${skillRef}`)
  }
  mutate(match.record)
  match.record.updatedAt = new Date().toISOString()
  installedIndex.installed[match.lockKey] = match.record
  await writeJson(paths.installedIndexPath, installedIndex)
}

export async function uninstallInstalledSkillPackage(
  input: { skillRef: string },
  options: { configHomeDir?: string } = {},
): Promise<{
  name: string
  lockKey: string
  removedPackageDir: string
}> {
  const paths = getCcrSkillInstallPaths(options.configHomeDir)
  const [installedIndex, lockIndex] = await Promise.all([
    readInstalledIndex(paths.installedIndexPath),
    readLockIndex(paths.lockFilePath),
  ])
  const match = findInstalledEntry(installedIndex, input.skillRef)
  if (!match) {
    throw new Error(`Skill install record was not found: ${input.skillRef}`)
  }
  const { lockKey, record } = match
  await assertPackageOwnership(record)

  await rm(record.packageDir, { recursive: true, force: true })
  delete installedIndex.installed[lockKey]
  delete lockIndex.locks[record.lockKey]
  await Promise.all([
    writeJson(paths.installedIndexPath, installedIndex),
    writeJson(paths.lockFilePath, lockIndex),
  ])

  return {
    name: record.name,
    lockKey,
    removedPackageDir: record.packageDir,
  }
}

export async function saveSkillInstallManifestFile(
  input: {
    manifest: CcrSkillInstallManifest
    overwrite?: boolean
  },
  options: { configHomeDir?: string } = {},
): Promise<Record<string, unknown>> {
  const paths = getCcrSkillInstallPaths(options.configHomeDir)
  const manifestPath = join(
    paths.manifestsDir,
    `${sanitizeManifestFileName(input.manifest.name)}.json`,
  )
  if (!input.overwrite && existsSync(manifestPath)) {
    throw new Error(`Skill install manifest already exists: ${manifestPath}`)
  }
  await writeJson(manifestPath, input.manifest)
  return {
    schemaVersion: 1,
    saved: true,
    name: input.manifest.name,
    path: manifestPath,
    manifest: summarizeCcrSkillInstallManifest(input.manifest),
  }
}

export async function isSkillNameInstalled(
  name: string,
  configHomeDir?: string,
): Promise<boolean> {
  const paths = getCcrSkillInstallPaths(configHomeDir)
  const installedIndex = await readInstalledIndex(paths.installedIndexPath)
  return Object.values(installedIndex.installed).some(
    record => record.name === name,
  )
}

export function findInstalledEntry(
  installedIndex: CcrSkillInstalledIndex,
  skillRef: string,
): { lockKey: string; record: CcrSkillInstalledRecord } | null {
  for (const [lockKey, record] of Object.entries(installedIndex.installed)) {
    if (lockKey === skillRef || record.lockKey === skillRef || record.name === skillRef) {
      return { lockKey, record }
    }
  }
  return null
}

export async function assertPackageOwnership(
  record: CcrSkillInstalledRecord,
): Promise<void> {
  if (!existsSync(record.packageDir)) {
    return
  }
  const marker = parseCcrSkillPackageOwnerMarker(
    JSON.parse(await readFile(record.packageOwnerMarkerPath, 'utf8')),
  )
  if (
    marker.owner !== 'ccr-skill-installer' ||
    marker.packageId !== record.lockKey ||
    marker.name !== record.name
  ) {
    throw new Error(
      `Skill package is not owned by CCR installer: ${record.packageDir}`,
    )
  }
}

function sanitizeManifestFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_')
}
