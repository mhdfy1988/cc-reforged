import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const [manifestModule, pathsModule] = await Promise.all([
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installManifest.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installPaths.js')).href),
])

const {
  CcrSkillInstallManifestSchema,
  createCcrSkillInstallManifest,
  summarizeCcrSkillInstallManifest,
  parseCcrSkillPackageOwnerMarker,
  parseCcrSkillInstalledRecord,
  parseCcrSkillInstalledIndex,
  parseCcrSkillLockRecord,
  parseCcrSkillLockIndex,
  parseSkillInstallResult,
} = manifestModule
const {
  CCR_SKILL_PACKAGE_OWNER_MARKER_FILE,
  getCcrSkillInstallPaths,
  getCcrSkillPackageDir,
  getCcrSkillPackageOwnerMarkerPath,
  sanitizeInstalledSkillDirName,
} = pathsModule

const configHome = 'D:/tmp/ccr-home'
const paths = getCcrSkillInstallPaths(configHome)
assert.equal(paths.packagesRootDir, 'D:\\tmp\\ccr-home\\skills\\packages')
assert.equal(paths.installedIndexPath, 'D:\\tmp\\ccr-home\\skills\\installed.json')
assert.equal(paths.lockFilePath, 'D:\\tmp\\ccr-home\\skills\\lock.json')
assert.equal(sanitizeInstalledSkillDirName('bad/name:here'), 'bad-name-here')
assert.equal(
  getCcrSkillPackageDir('demo-skill', configHome),
  'D:\\tmp\\ccr-home\\skills\\packages\\demo-skill',
)
assert.equal(
  getCcrSkillPackageOwnerMarkerPath('demo-skill', configHome),
  `D:\\tmp\\ccr-home\\skills\\packages\\demo-skill\\${CCR_SKILL_PACKAGE_OWNER_MARKER_FILE}`,
)

const manifest = createCcrSkillInstallManifest({
  name: 'demo-skill',
  description: 'Demo install schema skill.',
  source: {
    kind: 'imported-skill',
    path: 'D:/tmp/ccr-home/skills/imported/demo-skill',
    importMarkerPath:
      'D:/tmp/ccr-home/skills/imported/demo-skill/.ccr-skill-import.json',
  },
  compatibility: {
    vendor: 'codex',
    convertedFromCommand: false,
  },
})
assert.equal(manifest.schemaVersion, 1)
assert.equal(manifest.targetScope, 'user')
assert.equal(manifest.defaults.enabled, true)
assert.equal(manifest.defaults.modelInvocable, true)
assert.equal(manifest.defaults.userInvocable, true)
assert.equal(manifest.trust.thirdParty, true)
assert.deepEqual(manifest.trust.secretsDeclared, [])

assert.deepEqual(summarizeCcrSkillInstallManifest(manifest), {
  schemaVersion: 1,
  name: 'demo-skill',
  kind: 'imported-skill',
  targetScope: 'user',
  enabled: true,
  modelInvocable: true,
  userInvocable: true,
  originVendor: 'codex',
  convertedFromCommand: false,
})

assert.equal(
  CcrSkillInstallManifestSchema().safeParse({
    schemaVersion: 1,
    name: 'bad',
    source: {
      kind: 'imported-skill',
      path: '',
    },
  }).success,
  false,
)

const ownerMarker = parseCcrSkillPackageOwnerMarker({
  schemaVersion: 1,
  packageId: 'pkg-demo-skill',
  name: 'demo-skill',
  installedAt: '2026-06-02T00:00:00.000Z',
  source: manifest.source,
  owner: 'ccr-skill-installer',
})
assert.equal(ownerMarker.owner, 'ccr-skill-installer')
assert.throws(() =>
  parseCcrSkillPackageOwnerMarker({
    ...ownerMarker,
    owner: 'somebody-else',
  }),
)

const packagePreview = {
  schemaVersion: 1,
  id: 'installed:demo-skill:D:/tmp/ccr-home/skills/packages/demo-skill/SKILL.md',
  name: 'demo-skill',
  description: 'Demo install schema skill.',
  bodyPath: 'D:/tmp/ccr-home/skills/packages/demo-skill/SKILL.md',
  body: 'Demo body.',
  baseDir: 'D:/tmp/ccr-home/skills/packages/demo-skill',
  source: 'imported',
  origin: {
    vendor: 'codex',
    sourcePath: 'D:/tmp/ccr-home/skills/imported/demo-skill',
  },
  resources: {
    scripts: [],
    references: [],
    assets: [],
  },
  invocation: {
    modelInvocable: true,
    userInvocable: true,
    context: 'inline',
    allowedTools: [],
    argumentNames: [],
  },
  compatibility: {
    rawFrontmatter: {},
    warnings: [],
  },
}

const installedRecord = parseCcrSkillInstalledRecord({
  schemaVersion: 1,
  name: 'demo-skill',
  scope: 'user',
  installedAt: '2026-06-02T00:00:00.000Z',
  updatedAt: '2026-06-02T00:00:00.000Z',
  manifest,
  packageDir: getCcrSkillPackageDir('demo-skill', configHome),
  skillFilePath: 'D:/tmp/ccr-home/skills/packages/demo-skill/SKILL.md',
  packageOwnerMarkerPath: getCcrSkillPackageOwnerMarkerPath(
    'demo-skill',
    configHome,
  ),
  enabled: true,
  modelInvocable: true,
  userInvocable: true,
  lockKey: 'user:demo-skill',
})
assert.equal(installedRecord.lockKey, 'user:demo-skill')
assert.deepEqual(parseCcrSkillInstalledIndex({ schemaVersion: 1 }).installed, {})
assert.equal(
  parseCcrSkillInstalledIndex({
    schemaVersion: 1,
    installed: {
      [installedRecord.lockKey]: installedRecord,
    },
  }).installed[installedRecord.lockKey].name,
  'demo-skill',
)

const lockRecord = parseCcrSkillLockRecord({
  name: 'demo-skill',
  scope: 'user',
  sourceKind: 'imported-skill',
  packageDir: installedRecord.packageDir,
  skillFilePath: installedRecord.skillFilePath,
  checksum: {
    algorithm: 'sha256',
    skillMd: 'abc123',
  },
  originVendor: 'codex',
  updatedAt: '2026-06-02T00:00:00.000Z',
})
assert.equal(lockRecord.checksum.algorithm, 'sha256')
assert.deepEqual(parseCcrSkillLockIndex({ schemaVersion: 1 }).locks, {})
assert.equal(
  parseCcrSkillLockIndex({
    schemaVersion: 1,
    locks: {
      [installedRecord.lockKey]: lockRecord,
    },
  }).locks[installedRecord.lockKey].originVendor,
  'codex',
)

const result = parseSkillInstallResult({
  schemaVersion: 1,
  name: 'demo-skill',
  scope: 'user',
  packageDir: installedRecord.packageDir,
  installedRecord,
  lockRecord,
  package: packagePreview,
})
assert.equal(result.package.name, 'demo-skill')
assert.deepEqual(result.warnings, [])

console.log('smoke-skill-install-schema: ok')
