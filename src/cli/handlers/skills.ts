import { readFile } from 'fs/promises'
import {
  applyCoreSkillImport,
  applyCoreSkillInstall,
  inspectCoreSkill,
  listCoreSkillInstalls,
  planCoreSkillImport,
  planCoreSkillInstall,
  repairCoreSkill,
  searchCoreSkillInstallCandidates,
  uninstallCoreSkill,
} from '../../core/skillCore.js'
import type { SkillImportSourceInput } from '../../services/skills/importSource.js'
import type { CcrSkillInstallManifestInput } from '../../services/skills/installManifest.js'
import { cliError, cliOk } from '../exit.js'

type JsonRecord = Record<string, unknown>

type SkillCliJsonOptions = {
  json?: boolean
}

type SkillCliConfirmOptions = SkillCliJsonOptions & {
  yes?: boolean
}

type SkillCliImportOptions = SkillCliConfirmOptions & {
  kind?: string
  path?: string
}

type SkillCliInstallOptions = SkillCliConfirmOptions & {
  manifest?: string
  scope?: string
  force?: boolean
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function getRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as JsonRecord
}

function getConfirmationToken(plan: unknown): string {
  const confirmation = getRecord(getRecord(plan, 'plan').confirmation, 'confirmation')
  const token = confirmation.token
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('Skill plan did not return a confirmation token.')
  }
  return token
}

function getSkillScope(scope: string | undefined): 'user' | 'project' {
  if (scope === undefined || scope === 'user') {
    return 'user'
  }
  if (scope === 'project') {
    return 'project'
  }
  return cliError(`Skill install scope must be user or project. Got "${scope}".`)
}

function asCandidateArray(result: JsonRecord): JsonRecord[] {
  return Array.isArray(result.candidates)
    ? result.candidates.filter(
        (candidate): candidate is JsonRecord =>
          candidate !== null &&
          typeof candidate === 'object' &&
          !Array.isArray(candidate),
      )
    : []
}

function getCandidateName(candidate: JsonRecord): string {
  const manifestInput = getRecord(candidate.manifestInput, 'candidate.manifestInput')
  return typeof manifestInput.name === 'string' ? manifestInput.name : ''
}

async function getInstallCandidateByName(name: string): Promise<JsonRecord | null> {
  const result = (await searchCoreSkillInstallCandidates({ query: name })) as JsonRecord
  const candidates = asCandidateArray(result)
  return (
    candidates.find(candidate => getCandidateName(candidate) === name) ??
    candidates.find(candidate => candidate.candidateId === name) ??
    candidates[0] ??
    null
  )
}

async function readManifestFile(
  manifestPath: string,
): Promise<CcrSkillInstallManifestInput> {
  try {
    return JSON.parse(await readFile(manifestPath, 'utf8')) as CcrSkillInstallManifestInput
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return cliError(`Failed to read skill manifest "${manifestPath}": ${message}`)
  }
}

function formatSearchLines(result: JsonRecord): string {
  const candidates = asCandidateArray(result)
  if (candidates.length === 0) {
    return `No Skill install candidates found for "${String(result.query ?? '')}".`
  }
  return candidates
    .map(candidate => {
      const risks = Array.isArray(candidate.risks) ? candidate.risks.length : 0
      return [
        String(candidate.displayName ?? getCandidateName(candidate)),
        `name=${getCandidateName(candidate)}`,
        `source=${String(candidate.sourceType ?? 'unknown')}`,
        `state=${String(candidate.state ?? 'unknown')}`,
        `risks=${risks}`,
      ].join(' | ')
    })
    .join('\n')
}

function formatStatusLines(result: JsonRecord): string {
  const installed = Array.isArray(result.installed) ? result.installed : []
  if (installed.length === 0) {
    return 'No Skill installs found.'
  }
  return installed
    .map(item => {
      const record = getRecord(item, 'installed item')
      return [
        String(record.name ?? 'unknown'),
        `scope=${String(record.scope ?? 'unknown')}`,
        `status=${String(record.status ?? 'unknown')}`,
      ].join(' | ')
    })
    .join('\n')
}

function formatDryRun(kind: string, subject: string, plan: unknown): string {
  return [
    `${kind} plan for ${subject}:`,
    formatJson(plan),
    '',
    'No changes were written. Re-run with --yes to apply this plan.',
  ].join('\n')
}

export async function skillSearchHandler(
  query = '',
  options: SkillCliJsonOptions = {},
): Promise<void> {
  const result = (await searchCoreSkillInstallCandidates({ query })) as JsonRecord
  return cliOk(options.json ? formatJson(result) : formatSearchLines(result))
}

export async function skillStatusHandler(
  options: SkillCliJsonOptions = {},
): Promise<void> {
  const status = (await listCoreSkillInstalls()) as JsonRecord
  return cliOk(options.json ? formatJson(status) : formatStatusLines(status))
}

export async function skillInspectHandler(
  skillRef: string,
  options: SkillCliJsonOptions = {},
): Promise<void> {
  const inspection = (await inspectCoreSkill({ skillRef })) as JsonRecord
  if (inspection.found === false) {
    return cliError(`Skill install record was not found: ${skillRef}`)
  }
  return cliOk(options.json ? formatJson(inspection) : formatJson(inspection))
}

export async function skillImportHandler(
  options: SkillCliImportOptions,
): Promise<void> {
  if (!options.kind) {
    return cliError('Skill import requires --kind.')
  }
  if (!options.path) {
    return cliError('Skill import requires --path.')
  }
  const source = {
    kind: options.kind,
    path: options.path,
  } as SkillImportSourceInput
  const plan = await planCoreSkillImport({ source })
  if (!options.yes) {
    const output = options.json
      ? formatJson({ dryRun: true, plan })
      : formatDryRun('Import', options.path, plan)
    return cliOk(output)
  }
  const result = await applyCoreSkillImport({
    source,
    confirmed: true,
    confirmationToken: getConfirmationToken(plan),
  })
  return cliOk(formatJson(result))
}

export async function skillInstallHandler(
  candidateName: string | undefined,
  options: SkillCliInstallOptions,
): Promise<void> {
  let manifest: CcrSkillInstallManifestInput
  let subject: string
  if (options.manifest) {
    manifest = await readManifestFile(options.manifest)
    subject = options.manifest
  } else {
    if (!candidateName) {
      return cliError('Skill install requires a candidate name or --manifest.')
    }
    const candidate = await getInstallCandidateByName(candidateName)
    if (!candidate) {
      return cliError(`No Skill install candidate found for "${candidateName}".`)
    }
    manifest = getRecord(
      candidate.manifestInput,
      'candidate.manifestInput',
    ) as CcrSkillInstallManifestInput
    subject = getCandidateName(candidate) || candidateName
  }

  const scope = getSkillScope(options.scope)
  const plan = await planCoreSkillInstall({
    manifest,
    scope,
    force: Boolean(options.force),
  })
  if (!options.yes) {
    const output = options.json
      ? formatJson({ dryRun: true, plan })
      : formatDryRun('Install', subject, plan)
    return cliOk(output)
  }
  const result = await applyCoreSkillInstall({
    manifest,
    scope,
    force: Boolean(options.force),
    confirmed: true,
    confirmationToken: getConfirmationToken(plan),
  })
  return cliOk(formatJson(result))
}

export async function skillUninstallHandler(
  skillRef: string,
  options: SkillCliConfirmOptions,
): Promise<void> {
  if (!options.yes) {
    const inspection = await inspectCoreSkill({ skillRef })
    if ((inspection as JsonRecord).found === false) {
      return cliError(`Skill install record was not found: ${skillRef}`)
    }
    const output = options.json
      ? formatJson({ dryRun: true, action: 'uninstall', inspection })
      : `No changes were written. Re-run with --yes to uninstall "${skillRef}".`
    return cliOk(output)
  }
  const result = await uninstallCoreSkill({
    skillRef,
    confirmed: true,
  })
  return cliOk(formatJson(result))
}

export async function skillRepairHandler(
  skillRef: string,
  options: SkillCliConfirmOptions,
): Promise<void> {
  if (!options.yes) {
    const inspection = await inspectCoreSkill({ skillRef })
    if ((inspection as JsonRecord).found === false) {
      return cliError(`Skill install record was not found: ${skillRef}`)
    }
    const output = options.json
      ? formatJson({ dryRun: true, action: 'repair', inspection })
      : `No changes were written. Re-run with --yes to repair "${skillRef}".`
    return cliOk(output)
  }
  const result = await repairCoreSkill({
    skillRef,
    confirmed: true,
  })
  return cliOk(formatJson(result))
}
