import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const { createDefaultLlmRuntime } = await import(
  '../dist/src/services/llm/defaultRuntime.js'
)
const {
  getLlmProfileForProvider,
  listResolvedLlmProfiles,
  loadLlmConfig,
} = await import('../dist/src/services/llm/llmConfig.js')
const {
  getDefaultLlmCredentialsPath,
  getLlmProviderApiKey,
} = await import('../dist/src/services/llm/providerCredentials.js')
const { createDefaultCodexOAuthSession } = await import(
  '../dist/src/services/llm/sessions/defaultCodexOAuthSession.js'
)

const TARGET_PROVIDER_IDS = [
  'codex-oauth',
  'deepseek',
  'minimax',
  'minimax-cn',
  'kimi-api',
  'kimi-code',
  'glm-api',
  'glm-coding',
]

const PROVIDER_PROBE_SPECS = {
  'codex-oauth': {
    auth: 'oauth',
    defaultModel: 'gpt-5.4',
    imageModel: 'gpt-5.5',
  },
  deepseek: {
    auth: 'api_key',
    defaultModel: 'deepseek-v4-flash',
    envNames: ['CCR_DEEPSEEK_API_KEY', 'DEEPSEEK_API_KEY'],
  },
  minimax: {
    auth: 'api_key',
    defaultModel: 'MiniMax-M2.7',
    imageModel: 'image-01',
    envNames: ['CCR_MINIMAX_API_KEY', 'MINIMAX_API_KEY'],
  },
  'minimax-cn': {
    auth: 'api_key',
    defaultModel: 'MiniMax-M2.7',
    imageModel: 'image-01',
    envNames: [
      'CCR_MINIMAX_CN_API_KEY',
      'MINIMAX_CN_API_KEY',
      'CCR_MINIMAXI_API_KEY',
      'MINIMAXI_API_KEY',
    ],
  },
  'kimi-api': {
    auth: 'api_key',
    defaultModel: 'kimi-k2.6',
    envNames: ['CCR_KIMI_API_KEY', 'KIMI_API_KEY', 'MOONSHOT_API_KEY'],
  },
  'kimi-code': {
    auth: 'api_key',
    defaultModel: 'kimi-for-coding',
    envNames: ['CCR_KIMI_CODE_API_KEY', 'KIMI_CODE_API_KEY'],
  },
  'glm-api': {
    auth: 'api_key',
    defaultModel: 'glm-5.1',
    imageModel: 'glm-image',
    envNames: [
      'CCR_GLM_API_KEY',
      'GLM_API_KEY',
      'ZAI_API_KEY',
      'ZHIPUAI_API_KEY',
    ],
  },
  'glm-coding': {
    auth: 'api_key',
    defaultModel: 'glm-5.1',
    envNames: [
      'CCR_GLM_CODING_API_KEY',
      'GLM_CODING_API_KEY',
      'ZAI_CODING_API_KEY',
    ],
  },
}

const DEFAULT_CHECKS = ['auth', 'text', 'stream']
const FULL_CHECKS = ['auth', 'text', 'stream', 'tool', 'image']

const args = parseArgs(process.argv.slice(2))
const config = loadLlmConfig()
const runtime = createDefaultLlmRuntime()
const startedAt = new Date()
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const probeHome = join(repoRoot, '.tmp', 'provider-probe')
await mkdir(probeHome, { recursive: true })

const targets = resolveTargets(args.targets, config)
const checks = resolveChecks(args)
const results = []
for (const target of targets) {
  results.push(await probeTarget({ target, checks, config, runtime, args }))
}

const summary = {
  ok: results.every(result =>
    result.checks.every(check =>
      ['passed', 'skipped'].includes(check.status),
    ),
  ),
  dryRun: args.dryRun,
  checkedAt: startedAt.toISOString(),
  configPath: config.path,
  configSource: config.source,
  credentialsPath: getDefaultLlmCredentialsPath(),
  checks,
  targets: targets.map(target => ({
    providerId: target.providerId,
    ...(target.profileId ? { profileId: target.profileId } : {}),
    model: target.model,
  })),
  results,
}

console.log(JSON.stringify(summary, null, 2))
process.exitCode = summary.ok ? 0 : 1

function parseArgs(values) {
  const parsed = {
    targets: [],
    dryRun: false,
    full: false,
    checks: undefined,
    timeoutMs: 45_000,
  }
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (value === '--dry-run') {
      parsed.dryRun = true
      continue
    }
    if (value === '--full') {
      parsed.full = true
      continue
    }
    if (value === '--checks') {
      parsed.checks = splitChecks(values[++index] ?? '')
      continue
    }
    if (value.startsWith('--checks=')) {
      parsed.checks = splitChecks(value.slice('--checks='.length))
      continue
    }
    if (value === '--timeout-ms') {
      parsed.timeoutMs = parsePositiveInteger(values[++index], parsed.timeoutMs)
      continue
    }
    if (value.startsWith('--timeout-ms=')) {
      parsed.timeoutMs = parsePositiveInteger(
        value.slice('--timeout-ms='.length),
        parsed.timeoutMs,
      )
      continue
    }
    if (value === '--help' || value === '-h') {
      printHelpAndExit()
    }
    parsed.targets.push(value)
  }
  return parsed
}

function splitChecks(value) {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function resolveChecks(args) {
  const checks = args.checks ?? (args.full ? FULL_CHECKS : DEFAULT_CHECKS)
  const normalized = Array.from(new Set(checks))
  const invalid = normalized.filter(
    check => !['auth', 'text', 'stream', 'tool', 'image'].includes(check),
  )
  if (invalid.length > 0) {
    throw new Error(`Unknown probe checks: ${invalid.join(', ')}`)
  }
  return normalized.includes('auth') ? normalized : ['auth', ...normalized]
}

function resolveTargets(requestedTargets, resolvedConfig) {
  const profiles = resolvedConfig.profiles
  const targetIds = requestedTargets.length > 0 ? requestedTargets : TARGET_PROVIDER_IDS
  return targetIds.map(targetId => {
    const profile = profiles[targetId]
    if (profile) {
      return createTargetFromProfile(profile)
    }

    const providerId = targetId.trim()
    if (!PROVIDER_PROBE_SPECS[providerId]) {
      throw new Error(`Unknown provider/profile probe target: ${targetId}`)
    }
    const providerProfile = getLlmProfileForProvider(providerId, resolvedConfig)
    if (providerProfile) {
      return createTargetFromProfile(providerProfile)
    }
    const providerConfig = resolvedConfig.providers[providerId]
    return {
      providerId,
      model:
        providerConfig?.defaultModel ||
        PROVIDER_PROBE_SPECS[providerId].defaultModel,
      baseUrl: providerConfig?.baseUrl,
      source: 'provider-default',
    }
  })
}

function createTargetFromProfile(profile) {
  return {
    providerId: profile.providerType,
    profileId: profile.id,
    model: profile.defaultModel,
    baseUrl: profile.baseUrl,
    source: 'profile',
  }
}

async function probeTarget({ target, checks, runtime, args }) {
  const auth = await probeAuth(target)
  const result = {
    providerId: target.providerId,
    ...(target.profileId ? { profileId: target.profileId } : {}),
    model: target.model,
    ...(target.baseUrl ? { baseUrl: target.baseUrl } : {}),
    source: target.source,
    auth,
    checks: [],
  }

  for (const checkName of checks) {
    if (checkName === 'auth') {
      result.checks.push({
        name: 'auth',
        status: auth.available ? 'passed' : 'skipped',
        reason: auth.message,
        source: auth.sourceType,
      })
      continue
    }

    if (!auth.available) {
      result.checks.push({
        name: checkName,
        status: 'skipped',
        reason: 'auth_missing',
      })
      continue
    }

    if (args.dryRun) {
      result.checks.push({
        name: checkName,
        status: 'skipped',
        reason: 'dry_run',
      })
      continue
    }

    if (checkName === 'image' && !PROVIDER_PROBE_SPECS[target.providerId].imageModel) {
      result.checks.push({
        name: 'image',
        status: 'skipped',
        reason: 'unsupported',
      })
      continue
    }

    result.checks.push(
      await runTimedCheck(checkName, args.timeoutMs, signal =>
        runProbeCheck({ runtime, target, checkName, signal }),
      ),
    )
  }

  return result
}

async function probeAuth(target) {
  const spec = PROVIDER_PROBE_SPECS[target.providerId]
  if (spec.auth === 'oauth') {
    const availability = await createDefaultCodexOAuthSession({
      ...(target.profileId ? { profileId: target.profileId } : {}),
    }).getAvailability()
    return {
      configured: availability.configured,
      available: availability.available,
      sourceType: availability.details?.source === 'env' ? 'env' : 'file',
      source: availability.details?.source,
      message: availability.reason,
      ...(availability.details?.accountId
        ? { accountIdPresent: true }
        : {}),
      ...(availability.details?.expiresAt
        ? { expiresAt: availability.details.expiresAt }
        : {}),
    }
  }

  const credential = getLlmProviderApiKey({
    provider: target.providerId,
    profileId: target.profileId,
    envNames: spec.envNames,
  })
  return {
    configured: Boolean(credential.apiKey),
    available: Boolean(credential.apiKey),
    sourceType: credential.sourceType,
    source: credential.source,
    message: credential.apiKey
      ? `${target.providerId} API key is available.`
      : `${target.providerId} API key is missing.`,
  }
}

async function runProbeCheck({ runtime, target, checkName, signal }) {
  switch (checkName) {
    case 'text':
      return probeText({ runtime, target, signal })
    case 'stream':
      return probeStream({ runtime, target, signal })
    case 'tool':
      return probeTool({ runtime, target, signal })
    case 'image':
      return probeImage({ runtime, target, signal })
    default:
      throw new Error(`Unsupported probe check: ${checkName}`)
  }
}

async function runTimedCheck(name, timeoutMs, callback) {
  const controller = new AbortController()
  const started = performance.now()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const details = await callback(controller.signal)
    return {
      name,
      status: 'passed',
      durationMs: Math.round(performance.now() - started),
      ...details,
    }
  } catch (error) {
    return {
      name,
      status: 'failed',
      durationMs: Math.round(performance.now() - started),
      error: normalizeProbeError(error),
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function probeText({ runtime, target, signal }) {
  const response = await runtime.generate({
    provider: target.providerId,
    ...(target.profileId ? { profileId: target.profileId } : {}),
    model: target.model,
    messages: [
      {
        role: 'user',
        parts: [
          {
            type: 'text',
            text: 'Reply with exactly: CCR_PROBE_OK',
          },
        ],
      },
    ],
    maxOutputTokens: 64,
    temperature: 0,
    signal,
  })
  return {
    model: response.model,
    stopReason: response.stopReason,
    outputTypes: response.output.map(part => part.type),
    usage: summarizeUsage(response.usage),
  }
}

async function probeStream({ runtime, target, signal }) {
  const eventTypes = []
  let finalModel
  let usage
  for await (const event of runtime.stream({
    provider: target.providerId,
    ...(target.profileId ? { profileId: target.profileId } : {}),
    model: target.model,
    messages: [
      {
        role: 'user',
        parts: [
          {
            type: 'text',
            text: 'Reply briefly with CCR_PROBE_STREAM_OK',
          },
        ],
      },
    ],
    maxOutputTokens: 64,
    temperature: 0,
    signal,
  })) {
    eventTypes.push(event.type)
    if (event.type === 'response_complete') {
      finalModel = event.response.model
      usage = summarizeUsage(event.response.usage)
    }
  }
  return {
    model: finalModel ?? target.model,
    eventTypes,
    usage,
  }
}

async function probeTool({ runtime, target, signal }) {
  const response = await runtime.generate({
    provider: target.providerId,
    ...(target.profileId ? { profileId: target.profileId } : {}),
    model: target.model,
    messages: [
      {
        role: 'user',
        parts: [
          {
            type: 'text',
            text: 'Call the probe_status tool once with {"ok": true}.',
          },
        ],
      },
    ],
    tools: [
      {
        name: 'probe_status',
        description: 'Return probe status.',
        inputSchema: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
          },
          required: ['ok'],
        },
      },
    ],
    maxOutputTokens: 128,
    temperature: 0,
    signal,
  })
  const toolCalls = response.output.filter(part => part.type === 'tool_call')
  if (!toolCalls.some(part => part.name === 'probe_status')) {
    throw new Error('Provider did not return the expected probe_status tool call.')
  }
  return {
    model: response.model,
    stopReason: response.stopReason,
    toolCallCount: toolCalls.length,
    outputTypes: response.output.map(part => part.type),
    usage: summarizeUsage(response.usage),
  }
}

async function probeImage({ runtime, target, signal }) {
  const spec = PROVIDER_PROBE_SPECS[target.providerId]
  const model = spec.imageModel
  const response = await runtime.generateImage({
    provider: target.providerId,
    ...(target.profileId ? { profileId: target.profileId } : {}),
    model,
    sessionId: `probe_${target.providerId.replace(/-/g, '_')}`,
    outputId: `out_probe_${target.providerId.replace(/-/g, '_')}`,
    ccrHome: probeHome,
    prompt: 'A tiny blue square icon on a white background. No text.',
    outputFormat: 'png',
    signal,
  })
  return {
    model: response.model,
    outputCount: response.output.length,
    generatedArtifactCount: response.generatedArtifacts.length,
    outputSources: response.output.map(part => part.source?.kind ?? 'unknown'),
    savedPaths: response.output
      .map(part => part.savedPath)
      .filter(value => typeof value === 'string' && value.trim()),
  }
}

function summarizeUsage(usage) {
  if (!usage) {
    return undefined
  }
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
  }
}

function normalizeProbeError(error) {
  const message = error instanceof Error ? error.message : String(error)
  return {
    category: classifyProbeError(message),
    message: sanitizeErrorMessage(message),
    ...(extractHttpStatus(message) ? { httpStatus: extractHttpStatus(message) } : {}),
  }
}

function classifyProbeError(message) {
  const normalized = message.toLowerCase()
  if (
    normalized.includes('api key is missing') ||
    normalized.includes('credential') && normalized.includes('missing') ||
    normalized.includes('no codex oauth credential')
  ) {
    return 'auth_missing'
  }
  if (
    normalized.includes('401') ||
    normalized.includes('403') ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden') ||
    normalized.includes('invalid api key')
  ) {
    return 'auth'
  }
  if (normalized.includes('429') || normalized.includes('rate limit')) {
    return 'rate_limit'
  }
  if (normalized.includes('quota') || normalized.includes('insufficient')) {
    return 'quota'
  }
  if (
    normalized.includes('fetch failed') ||
    normalized.includes('network') ||
    normalized.includes('econn') ||
    normalized.includes('enotfound') ||
    normalized.includes('timeout') ||
    normalized.includes('aborted')
  ) {
    return 'network'
  }
  if (
    normalized.includes('returned no usable content') ||
    normalized.includes('no image_generation_call') ||
    normalized.includes('did not return the expected') ||
    normalized.includes('invalid') ||
    normalized.includes('parse')
  ) {
    return 'protocol'
  }
  return 'unknown'
}

function sanitizeErrorMessage(message) {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer <redacted>')
    .replace(/sk-[A-Za-z0-9._-]+/g, 'sk-<redacted>')
    .replace(/(api[_-]?key["'\s:=]+)[A-Za-z0-9._-]+/gi, '$1<redacted>')
    .slice(0, 800)
}

function extractHttpStatus(message) {
  const match = message.match(/\b([1-5][0-9]{2})\b/)
  return match ? Number.parseInt(match[1], 10) : undefined
}

function printHelpAndExit() {
  let configuredProfiles = ''
  try {
    configuredProfiles = listResolvedLlmProfiles(loadLlmConfig())
      .map(profile => `${profile.id}(${profile.providerType})`)
      .join(', ')
  } catch {
    configuredProfiles = ''
  }
  console.log(`Usage:
  npm.cmd run probe:provider -- [providerId|profileId ...] [--checks text,stream,tool,image] [--full] [--dry-run] [--timeout-ms 45000]

Default targets:
  ${TARGET_PROVIDER_IDS.join(', ')}

Configured profiles:
  ${configuredProfiles || '(none)'}

Notes:
  Default checks are auth,text,stream. Use --full or --checks image to run image generation probes.
  Output is JSON and does not print raw prompts, raw responses, API keys, or base64 payloads.
`)
  process.exit(0)
}
