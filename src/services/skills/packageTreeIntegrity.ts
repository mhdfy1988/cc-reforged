import { createHash } from 'crypto'
import { readdir, readFile, stat } from 'fs/promises'
import { basename, join, relative } from 'path'
import { CCR_SKILL_PACKAGE_OWNER_MARKER_FILE } from './installPaths.js'

export type CcrSkillPackageTreeFileDigest = {
  path: string
  size: number
  sha256: string
}

export type CcrSkillPackageTreeDigest = {
  algorithm: 'sha256'
  files: CcrSkillPackageTreeFileDigest[]
  sha256: string
}

const EXCLUDED_PACKAGE_TREE_FILE_NAMES = new Set([
  CCR_SKILL_PACKAGE_OWNER_MARKER_FILE,
])

export async function hashSkillPackageTree(
  packageDir: string,
): Promise<CcrSkillPackageTreeDigest> {
  const files = await collectPackageTreeFiles(packageDir, packageDir)
  files.sort((a, b) => a.path.localeCompare(b.path))
  const treeHash = createHash('sha256')
  for (const file of files) {
    treeHash.update(`${file.path}\0${file.size}\0${file.sha256}\n`, 'utf8')
  }
  return {
    algorithm: 'sha256',
    files,
    sha256: treeHash.digest('hex'),
  }
}

async function collectPackageTreeFiles(
  packageDir: string,
  currentDir: string,
): Promise<CcrSkillPackageTreeFileDigest[]> {
  const entries = await readdir(currentDir, { withFileTypes: true })
  const files: CcrSkillPackageTreeFileDigest[] = []
  for (const entry of entries) {
    const absolutePath = join(currentDir, entry.name)
    if (entry.isDirectory()) {
      if (isInstallerTempDir(entry.name)) {
        continue
      }
      files.push(...(await collectPackageTreeFiles(packageDir, absolutePath)))
      continue
    }
    if (!entry.isFile() || EXCLUDED_PACKAGE_TREE_FILE_NAMES.has(entry.name)) {
      continue
    }
    const fileStat = await stat(absolutePath)
    files.push({
      path: normalizeRelativePath(relative(packageDir, absolutePath)),
      size: fileStat.size,
      sha256: createHash('sha256').update(await readFile(absolutePath)).digest('hex'),
    })
  }
  return files
}

function isInstallerTempDir(name: string): boolean {
  return (
    name.startsWith('.') &&
    (name.endsWith('.install-staging') || name.endsWith('.install-backup'))
  )
}

function normalizeRelativePath(path: string): string {
  return path.split('\\').join('/')
}

export function isPackageTreeTempPath(path: string): boolean {
  return isInstallerTempDir(basename(path))
}
