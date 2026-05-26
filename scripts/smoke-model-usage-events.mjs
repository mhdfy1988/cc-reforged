import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const usageEvents = await import(
  '../dist/src/services/usage/modelUsageEvents.js'
)
const usageStats = await import('../dist/src/services/usage/modelUsageStats.js')

const tempRoot = mkdtempSync(join(tmpdir(), 'ccr-usage-events-'))
const usageDir = join(tempRoot, 'usage-events')
process.env.CCR_USAGE_EVENTS_DIR = usageDir

const contextBudget = {
  providerId: 'deepseek',
  profileId: 'deepseek-default',
  model: 'deepseek-v4-flash',
  totalContextWindow: 1_000_000,
  maxOutputTokens: 16_000,
  reservedOutputTokens: 16_000,
  effectiveInputWindow: 984_000,
  autoCompactThreshold: 971_000,
  warningThreshold: 951_000,
  errorThreshold: 951_000,
  blockingLimit: 981_000,
  source: 'model_catalog',
}

try {
  const input = {
    timestamp: '2026-05-26T10:20:30.000Z',
    provider: 'deepseek',
    providerDisplayName: 'DeepSeek',
    profileId: 'deepseek-default',
    profileName: 'DeepSeek',
    model: 'deepseek-v4-flash',
    requestedModel: 'deepseek-v4-flash',
    contextBudget,
    usage: {
      inputTokens: 1200,
      outputTokens: 300,
      cacheReadInputTokens: 40,
      cacheCreationInputTokens: 20,
      totalTokens: 1560,
      webSearchRequests: 1,
    },
    costUSD: 0.00123,
    costStatus: 'calculated',
    sessionId: 'session_001',
    threadId: 'thread_001',
    turnId: 'turn_001',
    requestId: 'msg_001',
    cwd: 'D:\\agent_project\\claude-code-reforged',
    projectPath: 'D:\\agent_project\\claude-code-reforged',
    source: 'core',
  }

  const first = usageEvents.createModelUsageEvent(input)
  const second = usageEvents.createModelUsageEvent(input)
  assert.equal(first.eventVersion, 1)
  assert.equal(first.eventId, second.eventId)
  assert.equal(first.contextBudget.totalContextWindow, 1_000_000)

  const write = usageEvents.appendModelUsageEvent(input)
  assert.equal(write.ok, true)
  assert.equal(write.filePath, join(usageDir, '2026-05.jsonl'))
  usageEvents.appendModelUsageEvent({
    ...input,
    requestId: 'msg_003',
    costUSD: undefined,
    costStatus: 'unavailable',
    costUnavailableReason: 'model_pricing_not_configured',
  })

  const lines = readFileSync(write.filePath, 'utf8').trim().split('\n')
  assert.equal(lines.length, 2)
  const parsed = JSON.parse(lines[0])
  assert.equal(parsed.eventId, first.eventId)
  assert.equal(parsed.provider, 'deepseek')
  assert.equal(parsed.usage.totalTokens, 1560)
  assert.equal(parsed.costStatus, 'calculated')

  const stats = await usageStats.readModelUsageStats({
    from: '2026-05-01T00:00:00.000Z',
    to: '2026-05-31T23:59:59.999Z',
  })
  assert.equal(stats.totals.eventCount, 2)
  assert.equal(stats.totals.totalTokens, 3120)
  assert.equal(stats.totals.unknownCostEvents, 1)
  assert.equal(stats.byProvider[0]?.key, 'deepseek')

  const blockedDir = join(tempRoot, 'blocked')
  writeFileSync(blockedDir, 'not a directory', 'utf8')
  process.env.CCR_USAGE_EVENTS_DIR = blockedDir
  const failed = usageEvents.appendModelUsageEvent({
    ...input,
    timestamp: '2026-06-01T00:00:00.000Z',
    requestId: 'msg_002',
  })
  assert.equal(failed.ok, false)
  assert.match(failed.error, /EEXIST|ENOTDIR|not a directory|file already exists/i)

  console.log('smoke:model-usage-events ok')
} finally {
  delete process.env.CCR_USAGE_EVENTS_DIR
  rmSync(tempRoot, { recursive: true, force: true })
}
