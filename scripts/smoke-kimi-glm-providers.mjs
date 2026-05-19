import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const { KimiApiProvider, KimiCodeProvider } = await import(
  '../dist/src/services/llm/providers/KimiProvider.js'
)
const { GlmApiProvider, GlmCodingProvider } = await import(
  '../dist/src/services/llm/providers/GlmProvider.js'
)

const PROVIDERS = {
  'kimi-api': {
    Provider: KimiApiProvider,
    model: 'kimi-k2.6',
    baseUrl: 'https://api.moonshot.cn/v1',
    envNames: ['CCR_KIMI_API_KEY', 'KIMI_API_KEY', 'MOONSHOT_API_KEY'],
  },
  'kimi-code': {
    Provider: KimiCodeProvider,
    model: 'kimi-for-coding',
    apiMode: 'anthropic-messages',
    baseUrl: 'https://api.kimi.com/coding/v1',
    expectedGenerateUrl: 'https://api.kimi.com/coding/v1/messages',
    envNames: ['CCR_KIMI_CODE_API_KEY', 'KIMI_CODE_API_KEY'],
  },
  'glm-api': {
    Provider: GlmApiProvider,
    model: 'glm-5.1',
    models: ['glm-4.7', 'glm-4.6v', 'glm-4.5-air', 'glm-5v-turbo', 'glm-image'],
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    envNames: [
      'CCR_GLM_API_KEY',
      'GLM_API_KEY',
      'ZAI_API_KEY',
      'ZHIPUAI_API_KEY',
    ],
  },
  'glm-coding': {
    Provider: GlmCodingProvider,
    model: 'glm-5.1',
    baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
    envNames: [
      'CCR_GLM_CODING_API_KEY',
      'GLM_CODING_API_KEY',
      'ZAI_CODING_API_KEY',
    ],
  },
}

const requestedProviderIds = process.argv.slice(2)
const providerIds =
  requestedProviderIds.length > 0 ? requestedProviderIds : Object.keys(PROVIDERS)

for (const providerId of providerIds) {
  assert.ok(PROVIDERS[providerId], `unknown provider smoke target: ${providerId}`)
}

const tempDir = mkdtempSync(join(tmpdir(), 'ccr-kimi-glm-providers-'))
const previousConfigPath = process.env.CCR_LLM_CONFIG_PATH
const previousCredentialsPath = process.env.CCR_LLM_CREDENTIALS_PATH
const previousEnvValues = new Map()
for (const envName of new Set(Object.values(PROVIDERS).flatMap(item => item.envNames))) {
  previousEnvValues.set(envName, process.env[envName])
  delete process.env[envName]
}

process.env.CCR_LLM_CONFIG_PATH = join(tempDir, 'llm.config.local.json')
process.env.CCR_LLM_CREDENTIALS_PATH = join(
  tempDir,
  'llm.credentials.local.json',
)

try {
  writeFileSync(
    process.env.CCR_LLM_CONFIG_PATH,
    JSON.stringify(createConfig(), null, 2),
    'utf8',
  )
  writeFileSync(
    process.env.CCR_LLM_CREDENTIALS_PATH,
    JSON.stringify(createCredentials(), null, 2),
    'utf8',
  )

  const results = []
  for (const providerId of providerIds) {
    results.push(await smokeProvider(providerId, PROVIDERS[providerId]))
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        checked: providerIds,
        results,
      },
      null,
      2,
    ),
  )
} finally {
  if (previousConfigPath === undefined) {
    delete process.env.CCR_LLM_CONFIG_PATH
  } else {
    process.env.CCR_LLM_CONFIG_PATH = previousConfigPath
  }
  if (previousCredentialsPath === undefined) {
    delete process.env.CCR_LLM_CREDENTIALS_PATH
  } else {
    process.env.CCR_LLM_CREDENTIALS_PATH = previousCredentialsPath
  }
  for (const [envName, previousValue] of previousEnvValues) {
    if (previousValue === undefined) {
      delete process.env[envName]
    } else {
      process.env[envName] = previousValue
    }
  }
  rmSync(tempDir, { recursive: true, force: true })
}

async function smokeProvider(providerId, settings) {
  if (settings.apiMode === 'anthropic-messages') {
    return smokeAnthropicProvider(providerId, settings)
  }

  const requests = []
  const fetchMock = async (url, init) => {
    const body = JSON.parse(init.body)
    requests.push({
      url,
      headers: init.headers,
      body,
    })

    if (String(url).endsWith('/images/generations')) {
      return new Response(
        JSON.stringify({
          created: 1770000000,
          data: [
            {
              url: 'https://static.bigmodel.test/generated-glm-image.png',
              revised_prompt: 'A clean product screenshot.',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      )
    }

    if (body.stream) {
      return new Response(
        [
          `data: {"id":"${providerId}-stream","model":"${body.model}","choices":[{"delta":{"content":"stream "}}]}`,
          `data: {"id":"${providerId}-stream","model":"${body.model}","choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}`,
          `data: {"id":"${providerId}-stream","model":"${body.model}","choices":[],"usage":{"prompt_tokens":4,"completion_tokens":2,"total_tokens":6}}`,
          'data: [DONE]',
          '',
        ].join('\n'),
        {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        },
      )
    }

    return new Response(
      JSON.stringify({
        id: `${providerId}-response`,
        model: body.model,
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              content: `${providerId} response`,
              tool_calls: [
                {
                  id: `call_${providerId.replace(/-/g, '_')}`,
                  type: 'function',
                  function: {
                    name: 'check_status',
                    arguments: '{"ok":true}',
                  },
                },
              ],
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    )
  }

  const provider = new settings.Provider({ fetchImpl: fetchMock })
  const response = await provider.generate({
    provider: providerId,
    profileId: `${providerId}-secondary`,
    model: settings.model,
    ...(providerId === 'kimi-api' ? { temperature: 0 } : {}),
    messages: [
      {
        role: 'user',
        parts: [{ type: 'text', text: 'start tool work' }],
      },
      {
        role: 'assistant',
        parts: [
          {
            type: 'tool_call',
            id: `call_missing_${providerId.replace(/-/g, '_')}`,
            name: 'TodoWrite',
            input: {
              todos: [
                {
                  content: `verify ${providerId}`,
                  status: 'pending',
                  activeForm: `verifying ${providerId}`,
                },
              ],
            },
          },
        ],
      },
      {
        role: 'user',
        parts: [{ type: 'text', text: 'continue after interruption' }],
      },
    ],
    tools: [
      {
        name: 'TodoWrite',
        description: 'Update todo state',
        inputSchema: {
          type: 'object',
          properties: {
            todos: {
              type: 'array',
              items: { type: 'object' },
            },
          },
        },
      },
      {
        name: 'check_status',
        description: 'Check provider status',
        inputSchema: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
          },
        },
      },
    ],
  })

  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, `${settings.baseUrl}/chat/completions`)
  assert.equal(
    requests[0].headers.authorization,
    `Bearer sk-${providerId}-secondary`,
  )
  assert.equal(requests[0].body.model, settings.model)
  assert.equal(requests[0].body.stream, false)
  if (providerId === 'kimi-api') {
    assert.equal(requests[0].body.temperature, 1)
  }
  assert.equal(requests[0].body.tools.length, 2)
  assert.equal('thinking' in requests[0].body, false)
  assert.equal('reasoning_effort' in requests[0].body, false)
  const repairedMessages = requests[0].body.messages
  const missingToolIndex = repairedMessages.findIndex(
    message =>
      message.role === 'assistant' &&
      message.tool_calls?.[0]?.id ===
        `call_missing_${providerId.replace(/-/g, '_')}`,
  )
  assert.notEqual(missingToolIndex, -1)
  assert.equal(repairedMessages[missingToolIndex + 1].role, 'tool')
  assert.equal(
    repairedMessages[missingToolIndex + 1].tool_call_id,
    `call_missing_${providerId.replace(/-/g, '_')}`,
  )
  assert.match(
    repairedMessages[missingToolIndex + 1].content,
    /TOOL_CALL_INTERRUPTED/,
  )
  assert.equal(response.provider, providerId)
  assert.equal(response.model, settings.model)
  assert.equal(response.stopReason, 'tool_use')
  assert.equal(response.output[0].type, 'text')
  assert.equal(response.output[1].type, 'tool_call')
  assert.deepEqual(response.output[1].input, { ok: true })
  assert.equal(response.usage.totalTokens, 15)

  const events = []
  for await (const event of provider.stream({
    provider: providerId,
    profileId: `${providerId}-secondary`,
    model: settings.model,
    ...(providerId === 'kimi-api' ? { temperature: 0 } : {}),
    messages: [
      {
        role: 'user',
        parts: [{ type: 'text', text: 'stream hello' }],
      },
    ],
  })) {
    events.push(event)
  }

  assert.equal(requests.length, 2)
  assert.equal(requests[1].body.stream, true)
  if (providerId === 'kimi-api') {
    assert.equal(requests[1].body.temperature, 1)
  }
  assert.deepEqual(
    events.map(event => event.type),
    ['content_part', 'content_part', 'response_complete'],
  )
  assert.equal(events[2].response.provider, providerId)
  assert.equal(events[2].response.output[0].text, 'stream ok')
  assert.equal(events[2].response.usage.totalTokens, 6)

  let imageResult
  if (providerId === 'glm-api') {
    imageResult = await provider.generateImage({
      provider: providerId,
      profileId: `${providerId}-secondary`,
      model: 'glm-image',
      sessionId: 'thread_glm_image',
      outputId: 'out_glm_image',
      prompt: 'generate a product screenshot',
    })
    assert.equal(requests.length, 3)
    assert.equal(requests[2].url, `${settings.baseUrl}/images/generations`)
    assert.equal(requests[2].body.model, 'glm-image')
    assert.equal(requests[2].body.prompt, 'generate a product screenshot')
    assert.equal('response_format' in requests[2].body, false)
    assert.equal(
      requests[2].headers.authorization,
      `Bearer sk-${providerId}-secondary`,
    )
    assert.equal(imageResult.provider, providerId)
    assert.equal(imageResult.model, 'glm-image')
    assert.equal(imageResult.output[0].type, 'image')
    assert.equal(imageResult.output[0].source.kind, 'url')
    assert.equal(imageResult.output[0].outputId, 'out_glm_image')
    assert.equal(imageResult.generatedArtifacts.length, 0)

    await assert.rejects(
      () =>
        provider.generate({
          provider: providerId,
          profileId: `${providerId}-secondary`,
          model: 'glm-image',
          messages: [
            {
              role: 'user',
              parts: [{ type: 'text', text: 'hello from chat path' }],
            },
          ],
        }),
      /GLM-Image only supports the image generation route/,
    )
    assert.equal(requests.length, 3)

    await assert.rejects(
      async () => {
        for await (const _event of provider.stream({
          provider: providerId,
          profileId: `${providerId}-secondary`,
          model: 'glm-image',
          messages: [
            {
              role: 'user',
              parts: [{ type: 'text', text: 'hello from stream path' }],
            },
          ],
        })) {
          // No event should be yielded for the guarded chat route.
        }
      },
      /GLM-Image only supports the image generation route/,
    )
    assert.equal(requests.length, 3)
  }

  return {
    providerId,
    generateUrl: requests[0].url,
    streamUrl: requests[1].url,
    ...(imageResult ? { imageUrl: requests[2].url } : {}),
    model: requests[0].body.model,
    requestMessageRoles: repairedMessages.map(message => message.role),
    eventTypes: events.map(event => event.type),
  }
}

async function smokeAnthropicProvider(providerId, settings) {
  const requests = []
  const fetchMock = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url
    const headers = init?.headers ?? input.headers
    const bodyText =
      typeof init?.body === 'string'
        ? init.body
        : typeof input.text === 'function'
          ? await input.clone().text()
          : '{}'
    const body = JSON.parse(bodyText || '{}')
    requests.push({
      url,
      headers,
      body,
    })

    if (body.stream) {
      return new Response(
        [
          toSse('message_start', {
            type: 'message_start',
            message: {
              id: `${providerId}-stream`,
              type: 'message',
              role: 'assistant',
              model: body.model,
              content: [],
              stop_reason: null,
              stop_sequence: null,
              usage: { input_tokens: 4, output_tokens: 0 },
            },
          }),
          toSse('content_block_start', {
            type: 'content_block_start',
            index: 0,
            content_block: { type: 'text', text: '' },
          }),
          toSse('content_block_delta', {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: 'stream ' },
          }),
          toSse('content_block_delta', {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: 'ok' },
          }),
          toSse('content_block_stop', {
            type: 'content_block_stop',
            index: 0,
          }),
          toSse('message_delta', {
            type: 'message_delta',
            delta: { stop_reason: 'end_turn', stop_sequence: null },
            usage: { output_tokens: 2 },
          }),
          toSse('message_stop', { type: 'message_stop' }),
          '',
        ].join('\n'),
        {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        },
      )
    }

    return new Response(
      JSON.stringify({
        id: `${providerId}-response`,
        type: 'message',
        role: 'assistant',
        model: body.model,
        content: [
          { type: 'text', text: `${providerId} response` },
          {
            type: 'tool_use',
            id: `call_${providerId.replace(/-/g, '_')}`,
            name: 'check_status',
            input: { ok: true },
          },
        ],
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    )
  }

  const provider = new settings.Provider({ fetchImpl: fetchMock })
  const response = await provider.generate({
    provider: providerId,
    profileId: `${providerId}-secondary`,
    model: settings.model,
    messages: [
      {
        role: 'user',
        parts: [{ type: 'text', text: 'start tool work' }],
      },
    ],
    tools: [
      {
        name: 'check_status',
        description: 'Check provider status',
        inputSchema: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
          },
        },
      },
    ],
  })

  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, settings.expectedGenerateUrl)
  assert.equal(getHeaderValue(requests[0].headers, 'x-api-key'), `sk-${providerId}-secondary`)
  assert.equal(requests[0].body.model, settings.model)
  assert.equal(requests[0].body.stream, false)
  assert.equal(requests[0].body.tools.length, 1)
  assert.equal(response.provider, providerId)
  assert.equal(response.model, settings.model)
  assert.equal(response.stopReason, 'tool_use')
  assert.equal(response.output[0].type, 'text')
  assert.equal(response.output[1].type, 'tool_call')
  assert.deepEqual(response.output[1].input, { ok: true })
  assert.equal(response.usage.totalTokens, 15)

  const events = []
  for await (const event of provider.stream({
    provider: providerId,
    profileId: `${providerId}-secondary`,
    model: settings.model,
    messages: [
      {
        role: 'user',
        parts: [{ type: 'text', text: 'stream hello' }],
      },
    ],
  })) {
    events.push(event)
  }

  assert.equal(requests.length, 2)
  assert.equal(requests[1].url, settings.expectedGenerateUrl)
  assert.equal(requests[1].body.stream, true)
  assert.deepEqual(
    events.map(event => event.type),
    ['content_part', 'content_part', 'response_complete'],
  )
  assert.equal(events[2].response.provider, providerId)
  assert.equal(events[2].response.output[0].text, 'stream ok')
  assert.equal(events[2].response.usage.outputTokens, 2)

  return {
    providerId,
    generateUrl: requests[0].url,
    streamUrl: requests[1].url,
    model: requests[0].body.model,
    requestMessageRoles: requests[0].body.messages.map(message => message.role),
    eventTypes: events.map(event => event.type),
  }
}

function createConfig() {
  return {
    schemaVersion: 2,
    current: {
      profileId: 'kimi-api-primary',
      model: PROVIDERS['kimi-api'].model,
    },
    profiles: Object.fromEntries(
      Object.entries(PROVIDERS).flatMap(([providerId, settings]) => [
        [
          `${providerId}-primary`,
          createProfile(providerId, settings, 'primary'),
        ],
        [
          `${providerId}-secondary`,
          createProfile(providerId, settings, 'secondary'),
        ],
      ]),
    ),
  }
}

function createProfile(providerId, settings, suffix) {
  return {
    name: `${providerId} ${suffix}`,
    providerType: providerId,
    apiMode: settings.apiMode ?? 'openai-chat',
    endpoint: {
      baseUrl: settings.baseUrl,
    },
    auth: {
      strategy: 'api_key',
    },
    defaultModel: settings.model,
    models: {
      source: 'mixed',
      default: settings.model,
      include: settings.models ?? [],
    },
  }
}

function toSse(event, payload) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n`
}

function getHeaderValue(headers, name) {
  if (typeof headers?.get === 'function') {
    return headers.get(name)
  }
  const target = name.toLowerCase()
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (key.toLowerCase() === target) {
      return value
    }
  }
  return undefined
}

function createCredentials() {
  return {
    schemaVersion: 2,
    profileCredentials: Object.fromEntries(
      Object.keys(PROVIDERS).flatMap(providerId => [
        [
          `${providerId}-primary`,
          {
            type: 'api_key',
            providerType: providerId,
            apiKey: `sk-${providerId}-primary`,
          },
        ],
        [
          `${providerId}-secondary`,
          {
            type: 'api_key',
            providerType: providerId,
            apiKey: `sk-${providerId}-secondary`,
          },
        ],
      ]),
    ),
  }
}
