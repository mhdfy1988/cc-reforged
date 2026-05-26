import assert from 'node:assert/strict'

const { resolveRuntimeContextBudget } = await import(
  '../dist/src/services/llm/contextBudget.js'
)

const deepSeek = resolveRuntimeContextBudget({
  providerId: 'deepseek',
  model: 'deepseek-v4-flash',
})

assert.equal(deepSeek.totalContextWindow, 1_000_000)
assert.equal(deepSeek.effectiveInputWindow, 980_000)
assert.equal(deepSeek.autoCompactThreshold, 967_000)
assert.equal(deepSeek.source, 'model_catalog')

const codex = resolveRuntimeContextBudget({
  providerId: 'codex-oauth',
  model: 'gpt-5.4',
})

assert.equal(codex.totalContextWindow, 200_000)
assert.equal(codex.effectiveInputWindow, 180_000)
assert.equal(codex.autoCompactThreshold, 167_000)
assert.equal(codex.source, 'model_catalog')

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: [
        'deepseek_budget_uses_model_catalog_1m',
        'codex_oauth_budget_remains_200k',
      ],
      deepSeek: {
        totalContextWindow: deepSeek.totalContextWindow,
        effectiveInputWindow: deepSeek.effectiveInputWindow,
        autoCompactThreshold: deepSeek.autoCompactThreshold,
        source: deepSeek.source,
      },
      codex: {
        totalContextWindow: codex.totalContextWindow,
        effectiveInputWindow: codex.effectiveInputWindow,
        autoCompactThreshold: codex.autoCompactThreshold,
        source: codex.source,
      },
    },
    null,
    2,
  ),
)
