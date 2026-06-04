import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [discoveryModule, plannerModule, managerModule] = await Promise.all([
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/importDiscovery.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/importPlanner.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/importManager.js')).href),
])

const { discoverSkillImportCandidate } = discoveryModule
const { createSkillImportPlan } = plannerModule
const { applySkillImportPlan } = managerModule

const root = await mkdtemp(join(tmpdir(), 'ccr-skill-import-archive-'))
const configHome = join(root, 'ccr-home')

try {
  const tarPath = join(root, 'archive-tar-demo.tar')
  await writeFile(
    tarPath,
    createTarArchive({
      'archive-tar-demo/SKILL.md':
        '---\nname: archive-tar-demo\ndescription: Tar archive import demo.\n---\n\nTar body.\n',
      'archive-tar-demo/scripts/run.js': 'console.log("tar")\n',
    }),
  )
  const tarResult = await importArchive(tarPath)
  assert.equal(tarResult.package.name, 'archive-tar-demo')
  assert.equal(tarResult.package.source, 'imported')
  assert.deepEqual(tarResult.package.resources.scripts, ['scripts/run.js'])
  const tarMarker = JSON.parse(
    await readFile(join(tarResult.targetDir, '.ccr-skill-import.json'), 'utf8'),
  )
  assert.equal(tarMarker.source.kind, 'local-archive')
  assert.equal(tarMarker.source.path, tarPath)
  assert.equal(tarMarker.source.archiveFormat, 'tar')
  assert.equal('extractedPath' in tarMarker.source, false)

  const zipPath = join(root, 'archive-zip-demo.zip')
  await writeFile(
    zipPath,
    createZipStoreArchive({
      'SKILL.md':
        '---\nname: archive-zip-demo\ndescription: Zip archive import demo.\n---\n\nZip body.\n',
      'references/info.md': 'zip reference\n',
    }),
  )
  const zipResult = await importArchive(zipPath)
  assert.equal(zipResult.package.name, 'archive-zip-demo')
  assert.deepEqual(zipResult.package.resources.references, ['references/info.md'])

  const invalidPath = join(root, 'archive-invalid.tar')
  await writeFile(
    invalidPath,
    createTarArchive({
      'one/SKILL.md':
        '---\nname: one\ndescription: One archive import demo.\n---\n\nOne.\n',
      'two/SKILL.md':
        '---\nname: two\ndescription: Two archive import demo.\n---\n\nTwo.\n',
    }),
  )
  const invalid = await discoverSkillImportCandidate({
    kind: 'local-archive',
    path: invalidPath,
  })
  assert.equal(invalid.success, false)
  assert.equal(invalid.error.reason, 'multiple-skill-md')
} finally {
  await rm(root, { recursive: true, force: true })
}

async function importArchive(path) {
  const discovered = await discoverSkillImportCandidate({
    kind: 'local-archive',
    path,
  })
  assert.equal(
    discovered.success,
    true,
    discovered.success ? '' : discovered.error.message,
  )
  assert.equal(discovered.candidate.source.kind, 'local-archive')
  assert.equal(typeof discovered.candidate.source.extractedPath, 'string')
  const plan = createSkillImportPlan(discovered.candidate, { configHomeDir: configHome })
  assert.equal(plan.importable, true)
  assert.equal(plan.source.kind, 'local-archive')
  assert.equal(typeof plan.source.extractedPath, 'string')
  return applySkillImportPlan(plan, {
    confirmationToken: plan.confirmation.token,
    configHomeDir: configHome,
    now: new Date('2026-06-03T00:00:00.000Z'),
  })
}

function createTarArchive(files) {
  const chunks = []
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content, 'utf8')
    chunks.push(createTarHeader(name, data.length), data, tarPadding(data.length))
  }
  chunks.push(Buffer.alloc(1024))
  return Buffer.concat(chunks)
}

function createTarHeader(name, size) {
  const header = Buffer.alloc(512)
  header.write(name, 0, 100, 'utf8')
  header.write('0000644\0', 100, 8, 'ascii')
  header.write('0000000\0', 108, 8, 'ascii')
  header.write('0000000\0', 116, 8, 'ascii')
  header.write(size.toString(8).padStart(11, '0') + '\0', 124, 12, 'ascii')
  header.write('00000000000\0', 136, 12, 'ascii')
  header.fill(0x20, 148, 156)
  header.write('0', 156, 1, 'ascii')
  header.write('ustar\0', 257, 6, 'ascii')
  header.write('00', 263, 2, 'ascii')
  const checksum = [...header].reduce((sum, value) => sum + value, 0)
  header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii')
  return header
}

function tarPadding(size) {
  const padding = (512 - (size % 512)) % 512
  return Buffer.alloc(padding)
}

function createZipStoreArchive(files) {
  const localChunks = []
  const centralChunks = []
  let offset = 0
  for (const [name, content] of Object.entries(files)) {
    const nameBuffer = Buffer.from(name, 'utf8')
    const data = Buffer.from(content, 'utf8')
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0, 12)
    local.writeUInt32LE(0, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuffer.length, 26)
    local.writeUInt16LE(0, 28)
    localChunks.push(local, nameBuffer, data)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0, 14)
    central.writeUInt32LE(0, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBuffer.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)
    centralChunks.push(central, nameBuffer)
    offset += local.length + nameBuffer.length + data.length
  }

  const centralDir = Buffer.concat(centralChunks)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(Object.keys(files).length, 8)
  eocd.writeUInt16LE(Object.keys(files).length, 10)
  eocd.writeUInt32LE(centralDir.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)
  return Buffer.concat([...localChunks, centralDir, eocd])
}

console.log('smoke-skill-import-local-archive: ok')
