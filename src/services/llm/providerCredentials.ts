import { mkdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { z } from 'zod'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import { getFsImplementation } from '../../utils/fsOperations.js'
import { safeParseJSON } from '../../utils/json.js'
import type { CodexOAuthCredential } from './sessions/CodexOAuthSession.js'

const llmProviderCredentialSchema = z
  .object({
    type: z.enum(['api_key', 'oauth']),
    providerType: z.string().trim().min(1),
    apiKey: z.string().optional(),
    oauth: z
      .object({
        access: z.string().optional(),
        refresh: z.string().optional(),
        expires: z.number().optional(),
        accountId: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

const llmCredentialsFileSchema = z
  .object({
    schemaVersion: z.literal(2).optional(),
    profileCredentials: z.record(llmProviderCredentialSchema).optional(),
  })
  .strict()

type LlmCredentialsFile = z.infer<typeof llmCredentialsFileSchema>

export type LlmProviderApiKeyResult = {
  apiKey?: string
  source?: string
  sourceType: 'env' | 'file' | 'missing'
}

export type LlmProviderCredentialUpdateResult = {
  provider: string
  profileId: string
  configured: boolean
  source: string
}

export function getDefaultLlmCredentialsPath(): string {
  const explicitPath = process.env.CCR_LLM_CREDENTIALS_PATH?.trim()
  return (
    explicitPath || join(getClaudeConfigHomeDir(), 'data', 'llm.credentials.local.json')
  )
}

export function getLlmProviderApiKey(input: {
  provider: string
  profileId?: string
  envNames: readonly string[]
}): LlmProviderApiKeyResult {
  const envName = input.envNames.find(name => process.env[name]?.trim())
  if (envName) {
    return {
      apiKey: process.env[envName]!.trim(),
      source: envName,
      sourceType: 'env',
    }
  }

  const credentialsPath = getDefaultLlmCredentialsPath()
  const credentials = readLlmCredentialsFile(credentialsPath)
  const profileCredential = input.profileId
    ? credentials.profileCredentials?.[input.profileId]
    : undefined
  const apiKey =
    profileCredential?.type === 'api_key'
      ? profileCredential.apiKey?.trim()
      : undefined
  if (apiKey) {
    return {
      apiKey,
      source: credentialsPath,
      sourceType: 'file',
    }
  }

  return {
    source: credentialsPath,
    sourceType: 'missing',
  }
}

export async function updateLlmProviderApiKey(input: {
  provider: string
  profileId: string
  apiKey?: string | null
}): Promise<LlmProviderCredentialUpdateResult> {
  const provider = input.provider.trim()
  const profileId = input.profileId.trim()
  if (!profileId) {
    throw new Error('LLM profile id is required for storing API key credentials.')
  }
  const credentialsPath = getDefaultLlmCredentialsPath()
  const current = readLlmCredentialsFile(credentialsPath)
  const nextProfileCredentials = { ...(current.profileCredentials ?? {}) }
  const apiKey = input.apiKey?.trim()

  if (apiKey) {
    nextProfileCredentials[profileId] = {
      type: 'api_key',
      providerType: provider,
      apiKey,
    }
  } else {
    delete nextProfileCredentials[profileId]
  }

  const next: LlmCredentialsFile = {
    schemaVersion: 2,
    ...(Object.keys(nextProfileCredentials).length > 0
      ? { profileCredentials: nextProfileCredentials }
      : {}),
  }

  await mkdir(dirname(credentialsPath), { recursive: true })
  await writeFile(
    credentialsPath,
    JSON.stringify(next, null, 2) + '\n',
    'utf8',
  )

  return {
    provider,
    profileId,
    configured: Boolean(apiKey),
    source: credentialsPath,
  }
}

export type LlmProfileOAuthResult = {
  credential?: CodexOAuthCredential
  source: string
}

export function getLlmProfileOAuthCredential(
  profileId: string | undefined,
): LlmProfileOAuthResult {
  const credentialsPath = getDefaultLlmCredentialsPath()
  if (!profileId?.trim()) {
    return { source: credentialsPath }
  }
  const credentials = readLlmCredentialsFile(credentialsPath)
  const profileCredential =
    credentials.profileCredentials?.[profileId.trim()]
  if (profileCredential?.type !== 'oauth' || !profileCredential.oauth?.access) {
    return { source: credentialsPath }
  }
  return {
    source: credentialsPath,
    credential: {
      access: profileCredential.oauth.access,
      ...(profileCredential.oauth.refresh
        ? { refresh: profileCredential.oauth.refresh }
        : {}),
      ...(typeof profileCredential.oauth.expires === 'number'
        ? { expires: profileCredential.oauth.expires }
        : {}),
      ...(profileCredential.oauth.accountId
        ? { accountId: profileCredential.oauth.accountId }
        : {}),
    },
  }
}

export async function updateLlmProfileOAuthCredential(input: {
  provider: string
  profileId: string
  credential?: CodexOAuthCredential | null
}): Promise<{ source: string; configured: boolean; profileId: string }> {
  const provider = input.provider.trim()
  const profileId = input.profileId.trim()
  if (!profileId) {
    throw new Error('LLM profile id is required for storing OAuth credentials.')
  }
  const credentialsPath = getDefaultLlmCredentialsPath()
  const current = readLlmCredentialsFile(credentialsPath)
  const nextProfileCredentials = { ...(current.profileCredentials ?? {}) }

  if (input.credential) {
    nextProfileCredentials[profileId] = {
      type: 'oauth',
      providerType: provider,
      oauth: {
        access: input.credential.access,
        ...(input.credential.refresh
          ? { refresh: input.credential.refresh }
          : {}),
        ...(typeof input.credential.expires === 'number'
          ? { expires: input.credential.expires }
          : {}),
        ...(input.credential.accountId
          ? { accountId: input.credential.accountId }
          : {}),
      },
    }
  } else {
    delete nextProfileCredentials[profileId]
  }

  const next: LlmCredentialsFile = {
    schemaVersion: 2,
    ...(Object.keys(nextProfileCredentials).length > 0
      ? { profileCredentials: nextProfileCredentials }
      : {}),
  }

  await mkdir(dirname(credentialsPath), { recursive: true })
  await writeFile(
    credentialsPath,
    JSON.stringify(next, null, 2) + '\n',
    'utf8',
  )

  return {
    source: credentialsPath,
    configured: Boolean(input.credential),
    profileId,
  }
}

export async function deleteLlmProfileCredential(
  profileId: string,
): Promise<{ source: string; deleted: boolean; profileId: string }> {
  const normalizedProfileId = profileId.trim()
  if (!normalizedProfileId) {
    throw new Error('LLM profile id is required for deleting credentials.')
  }
  const credentialsPath = getDefaultLlmCredentialsPath()
  const current = readLlmCredentialsFile(credentialsPath)
  const nextProfileCredentials = { ...(current.profileCredentials ?? {}) }
  const deleted = Boolean(nextProfileCredentials[normalizedProfileId])
  delete nextProfileCredentials[normalizedProfileId]

  const next: LlmCredentialsFile = {
    schemaVersion: 2,
    ...(Object.keys(nextProfileCredentials).length > 0
      ? { profileCredentials: nextProfileCredentials }
      : {}),
  }

  await mkdir(dirname(credentialsPath), { recursive: true })
  await writeFile(
    credentialsPath,
    JSON.stringify(next, null, 2) + '\n',
    'utf8',
  )

  return {
    source: credentialsPath,
    deleted,
    profileId: normalizedProfileId,
  }
}

function readLlmCredentialsFile(filePath: string): LlmCredentialsFile {
  const fs = getFsImplementation()
  if (!fs.existsSync(filePath)) {
    return {}
  }

  const rawContent = fs.readFileSync(filePath, { encoding: 'utf8' })
  const parsed = safeParseJSON(rawContent, true)
  if (!parsed) {
    throw new Error(`Invalid LLM credentials JSON: ${filePath}`)
  }
  return llmCredentialsFileSchema.parse(parsed)
}
