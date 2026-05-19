import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tempDir = join(repoRoot, '.tmp', 'smoke-generated-output-provider')
const entryPath = join(tempDir, 'entry.ts')
const outputPath = join(tempDir, 'entry.mjs')

await rm(tempDir, { recursive: true, force: true })
await mkdir(tempDir, { recursive: true })
await writeFile(
  entryPath,
  `
    import assert from 'node:assert/strict'
    import { readFile } from 'node:fs/promises'
    import { OpenAiImageGenerationAdapter, normalizeOpenAiImageGenerationCall, toOpenAiImageGenerationRequestBody } from '../../src/services/llm/protocols/openaiImageGenerationAdapter.ts'
    import { OpenAiResponsesImageGenerationAdapter, toOpenAiResponsesImageGenerationRequestBody } from '../../src/services/llm/protocols/openaiResponsesImageGenerationAdapter.ts'
    import { OpenAiResponsesHostedImageGenerationAdapter } from '../../src/services/llm/protocols/openaiResponsesHostedImageGenerationAdapter.ts'
    import { CodexOAuthProvider } from '../../src/services/llm/providers/CodexOAuthProvider.ts'
    import { toCodexOAuthImageGenerationRequestBody } from '../../src/services/llm/protocols/codexOAuthImageGenerationAdapter.ts'
    import { MiniMaxImageGenerationAdapter, toMiniMaxImageGenerationRequestBody } from '../../src/services/llm/protocols/minimaxImageGenerationAdapter.ts'
    import { shouldUseOpenAiResponsesImageGeneration } from '../../src/services/llm/openaiImageGenerationRouting.ts'
    import { createDisplayEventFromCompletedItem } from '../../apps/desktop/src/renderer/src/domain/displayEvents.ts'
    import { sanitizeGeneratedArtifactsForResume } from '../../src/utils/generatedArtifacts.ts'

    const onePixelPngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/axJpXcAAAAASUVORK5CYII='
    const generatedArtifactsHome = ${JSON.stringify(join(tempDir, 'generated-artifacts-home'))}
    const requests: Array<{ url: string; body: Record<string, unknown> }> = []
    const fetchImpl: typeof fetch = async (url, init) => {
      requests.push({
        url: String(url),
        body: JSON.parse(String(init?.body ?? '{}')),
      })
      return new Response(
        JSON.stringify({
          created: 1770000000,
          data: [
            {
              b64_json: onePixelPngBase64,
              revised_prompt: 'A clean sunrise over calm water.',
            },
          ],
          usage: {
            total_tokens: 12,
          },
        }),
        {
          status: 200,
          statusText: 'OK',
          headers: {
            'content-type': 'application/json',
          },
        },
      )
    }

    const adapter = new OpenAiImageGenerationAdapter({
      providerId: 'openai',
      providerLabel: 'OpenAI',
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.test/v1',
      defaultModel: 'gpt-image-1',
      fetchImpl,
    })

    const response = await adapter.generateImage({
      provider: 'openai',
      model: 'gpt-image-1',
      sessionId: 'thread_fixture',
      outputId: 'out_provider_image',
      ccrHome: generatedArtifactsHome,
      prompt: '画一张日出图片',
      size: '1024x1024',
      quality: 'low',
    })

    assert.equal(requests[0].url, 'https://api.openai.test/v1/images/generations')
    assert.equal(requests[0].body.model, 'gpt-image-1')
    assert.equal(requests[0].body.prompt, '画一张日出图片')
    assert.equal(requests[0].body.size, '1024x1024')
    assert.equal(requests[0].body.quality, 'low')
    assert.equal('response_format' in requests[0].body, false)
    assert.equal(response.provider, 'openai')
    assert.equal(response.model, 'gpt-image-1')
    assert.equal(response.output.length, 1)
    assert.equal(response.generatedArtifacts.length, 1)

    const generatedBlock = response.output[0]
    assert.equal(generatedBlock.type, 'image')
    assert.equal(generatedBlock.origin, 'model_output')
    assert.equal(generatedBlock.lifecycle, 'persisted')
    assert.equal(generatedBlock.safety, 'needs_review')
    assert.equal(generatedBlock.provider, 'openai')
    assert.equal(generatedBlock.model, 'gpt-image-1')
    assert.equal(generatedBlock.outputId, 'out_provider_image')
    assert.equal(generatedBlock.source?.kind, 'file')
    assert.equal(generatedBlock.savedPath, response.generatedArtifacts[0].savedPath)
    assert.match(generatedBlock.savedPath ?? '', /generated_outputs/)
    assert.deepEqual(
      await readFile(generatedBlock.savedPath!),
      Buffer.from(onePixelPngBase64, 'base64'),
    )

    const event = createDisplayEventFromCompletedItem(
      'fixture-provider-generated-image',
      'assistant_message',
      response.output,
      'completed',
      {
        itemId: 'fixture-provider-generated-image',
        threadId: 'thread_fixture',
        turnId: 'turn_fixture',
      },
    )
    assert.equal(event?.type, 'assistant_message')
    assert.match(event?.text ?? '', /模型生成图片/)
    assert.match(event?.text ?? '', /已保存/)
    assert.equal(event?.attachmentSnapshots?.[0]?.source, 'ModelOutput')
    assert.equal(event?.attachmentSnapshots?.[0]?.status, 'generated')
    assert.equal(event?.attachmentSnapshots?.[0]?.savedPath, generatedBlock.savedPath)

    const eventJson = JSON.stringify(event)
    assert.equal(eventJson.includes('b64_json'), false)
    assert.equal(eventJson.includes('base64,'), false)
    assert.equal(eventJson.includes(onePixelPngBase64), false)

    const resumePayload = sanitizeGeneratedArtifactsForResume({
      content: response.output,
      call: {
        type: 'image_generation_call',
        id: 'ig_provider_image',
        result: 'data:image/png;base64,' + onePixelPngBase64,
      },
    })
    const resumeJson = JSON.stringify(resumePayload)
    assert.equal(resumeJson.includes('base64,'), false)
    assert.equal(resumeJson.includes(onePixelPngBase64), false)
    assert.equal(resumePayload.call.result, '')
    assert.equal(resumePayload.content[0].savedPath, generatedBlock.savedPath)

    const responsesToolResult = await normalizeOpenAiImageGenerationCall(
      {
        type: 'image_generation_call',
        id: 'ig_codex_style',
        status: 'completed',
        result: 'data:image/png;base64,' + onePixelPngBase64,
        revised_prompt: 'A clean sunrise over calm water.',
      },
      {
        provider: 'openai',
        model: 'gpt-5.5',
        sessionId: 'thread_fixture',
        ccrHome: generatedArtifactsHome,
        prompt: '画一张日出图片',
      },
    )
    assert.equal(responsesToolResult.provider, 'openai')
    assert.equal(responsesToolResult.model, 'gpt-5.5')
    assert.equal(responsesToolResult.output.length, 1)
    assert.equal(responsesToolResult.generatedArtifacts.length, 1)
    const responsesGeneratedBlock = responsesToolResult.output[0]
    assert.equal(responsesGeneratedBlock.type, generatedBlock.type)
    assert.equal(responsesGeneratedBlock.origin, generatedBlock.origin)
    assert.equal(responsesGeneratedBlock.lifecycle, generatedBlock.lifecycle)
    assert.equal(responsesGeneratedBlock.safety, generatedBlock.safety)
    assert.equal(responsesGeneratedBlock.provider, generatedBlock.provider)
    assert.equal(responsesGeneratedBlock.mimeType, generatedBlock.mimeType)
    assert.equal(responsesGeneratedBlock.model, 'gpt-5.5')
    assert.equal(responsesGeneratedBlock.outputId, 'ig_codex_style')
    assert.equal(responsesGeneratedBlock.source?.kind, 'file')
    assert.deepEqual(
      await readFile(responsesGeneratedBlock.savedPath!),
      Buffer.from(onePixelPngBase64, 'base64'),
    )
    assert.equal(JSON.stringify(responsesToolResult.raw).includes(onePixelPngBase64), false)

    const responsesEvent = createDisplayEventFromCompletedItem(
      'fixture-responses-generated-image',
      'assistant_message',
      responsesToolResult.output,
      'completed',
      {
        itemId: 'fixture-responses-generated-image',
        threadId: 'thread_fixture',
        turnId: 'turn_fixture',
      },
    )
    assert.equal(responsesEvent?.attachmentSnapshots?.[0]?.source, 'ModelOutput')
    assert.equal(responsesEvent?.attachmentSnapshots?.[0]?.provider, 'openai')
    assert.equal(responsesEvent?.attachmentSnapshots?.[0]?.model, 'gpt-5.5')
    assert.equal(responsesEvent?.attachmentSnapshots?.[0]?.outputId, 'ig_codex_style')
    assert.equal(JSON.stringify(responsesEvent).includes(onePixelPngBase64), false)

    const responsesApiRequests: Array<{ url: string; body: Record<string, unknown> }> = []
    const responsesApiFetchImpl: typeof fetch = async (url, init) => {
      responsesApiRequests.push({
        url: String(url),
        body: JSON.parse(String(init?.body ?? '{}')),
      })
      return new Response(
        JSON.stringify({
          id: 'resp_fixture',
          model: 'gpt-5.5',
          output: [
            {
              type: 'message',
              id: 'msg_ignored',
              content: [{ type: 'output_text', text: 'Here is the image.' }],
            },
            {
              type: 'image_generation_call',
              id: 'ig_responses_api',
              status: 'completed',
              result: onePixelPngBase64,
              revised_prompt: 'A clean sunrise over calm water.',
            },
          ],
          usage: {
            input_tokens: 9,
            output_tokens: 4,
            total_tokens: 13,
          },
        }),
        {
          status: 200,
          statusText: 'OK',
          headers: {
            'content-type': 'application/json',
          },
        },
      )
    }
    const responsesApiAdapter = new OpenAiResponsesImageGenerationAdapter({
      providerId: 'openai',
      providerLabel: 'OpenAI',
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.test/v1',
      defaultModel: 'gpt-5.5',
      fetchImpl: responsesApiFetchImpl,
    })
    const responsesApiResult = await responsesApiAdapter.generateImage({
      provider: 'openai',
      model: 'gpt-5.5',
      sessionId: 'thread_fixture',
      outputId: 'out_responses_api_image',
      ccrHome: generatedArtifactsHome,
      prompt: '画一张日出图片',
      size: '1024x1024',
      quality: 'low',
      outputFormat: 'png',
    })
    assert.equal(responsesApiRequests[0].url, 'https://api.openai.test/v1/responses')
    assert.equal(responsesApiRequests[0].body.model, 'gpt-5.5')
    assert.equal(responsesApiRequests[0].body.input, '画一张日出图片')
    assert.deepEqual(responsesApiRequests[0].body.tools, [
      {
        type: 'image_generation',
        size: '1024x1024',
        quality: 'low',
        output_format: 'png',
      },
    ])
    assert.equal(responsesApiResult.provider, 'openai')
    assert.equal(responsesApiResult.model, 'gpt-5.5')
    assert.equal(responsesApiResult.output.length, 1)
    assert.equal(responsesApiResult.generatedArtifacts.length, 1)
    assert.equal(responsesApiResult.output[0].outputId, 'out_responses_api_image')
    assert.equal(responsesApiResult.output[0].source?.kind, 'file')
    assert.equal(JSON.stringify(responsesApiResult.raw).includes(onePixelPngBase64), false)
    assert.deepEqual(
      await readFile(responsesApiResult.output[0].savedPath!),
      Buffer.from(onePixelPngBase64, 'base64'),
    )

    const hostedRequests: Array<{
      url: string
      body: Record<string, unknown>
      authorization?: string | null
    }> = []
    const hostedAdapter = new OpenAiResponsesHostedImageGenerationAdapter({
      providerId: 'openai-compatible',
      providerLabel: 'OpenAI-compatible gateway',
      baseUrl: 'https://gateway.openai-compatible.test/v1',
      defaultModel: 'gpt-5',
      headers: {
        authorization: 'Bearer gateway-key',
        'content-type': 'application/json',
      },
      fetchImpl: async (url, init) => {
        const headers = new Headers(init?.headers)
        hostedRequests.push({
          url: String(url),
          body: JSON.parse(String(init?.body ?? '{}')),
          authorization: headers.get('authorization'),
        })
        return new Response(
          JSON.stringify({
            id: 'resp_hosted_fixture',
            model: 'gpt-5',
            output: [
              {
                type: 'image_generation_call',
                id: 'ig_hosted_gateway',
                status: 'completed',
                result: onePixelPngBase64,
                revised_prompt: 'A clean sunrise over calm water.',
              },
            ],
          }),
          {
            status: 200,
            statusText: 'OK',
            headers: {
              'content-type': 'application/json',
            },
          },
        )
      },
    })
    const hostedResult = await hostedAdapter.generateImage({
      provider: 'openai-compatible',
      model: 'gpt-5',
      sessionId: 'thread_fixture',
      outputId: 'out_hosted_gateway_image',
      ccrHome: generatedArtifactsHome,
      prompt: '画一张日出图片',
      outputFormat: 'png',
    })
    assert.equal(
      hostedRequests[0].url,
      'https://gateway.openai-compatible.test/v1/responses',
    )
    assert.equal(hostedRequests[0].authorization, 'Bearer gateway-key')
    assert.equal(hostedRequests[0].body.model, 'gpt-5')
    assert.equal(hostedRequests[0].body.input, '画一张日出图片')
    assert.deepEqual(hostedRequests[0].body.tools, [
      {
        type: 'image_generation',
        output_format: 'png',
      },
    ])
    assert.equal(hostedResult.provider, 'openai-compatible')
    assert.equal(hostedResult.model, 'gpt-5')
    assert.equal(hostedResult.output[0].outputId, 'out_hosted_gateway_image')
    assert.equal(hostedResult.output[0].source?.kind, 'file')
    assert.equal(JSON.stringify(hostedResult.raw).includes(onePixelPngBase64), false)

    assert.equal(
      shouldUseOpenAiResponsesImageGeneration({ imageGenerationApi: 'responses' }),
      true,
    )
    assert.equal(
      shouldUseOpenAiResponsesImageGeneration({ apiMode: 'openai-responses' }),
      true,
    )
    assert.equal(
      shouldUseOpenAiResponsesImageGeneration({
        useResponsesImageGeneration: true,
      }),
      true,
    )
    assert.equal(shouldUseOpenAiResponsesImageGeneration(undefined), false)

    const responsesBody = toOpenAiResponsesImageGenerationRequestBody({
      defaultModel: 'gpt-5.5',
      request: {
        provider: 'openai',
        model: 'gpt-5.5',
        sessionId: 'thread_fixture',
        outputId: 'out_responses_body',
        prompt: 'Generate a small icon.',
        outputFormat: 'webp',
      },
    })
    assert.equal(responsesBody.model, 'gpt-5.5')
    assert.equal(responsesBody.input, 'Generate a small icon.')
    assert.equal(responsesBody.tools[0].type, 'image_generation')
    assert.equal(responsesBody.tools[0].output_format, 'webp')

    const codexRequests: Array<{
      url: string
      body: Record<string, unknown>
      headers: Record<string, string | null>
    }> = []
    const codexFetchImpl: typeof fetch = async (url, init) => {
      const headers = new Headers(init?.headers)
      codexRequests.push({
        url: String(url),
        body: JSON.parse(String(init?.body ?? '{}')),
        headers: {
          authorization: headers.get('authorization'),
          accountId: headers.get('chatgpt-account-id'),
          beta: headers.get('OpenAI-Beta'),
          accept: headers.get('accept'),
          contentType: headers.get('content-type'),
          originator: headers.get('originator'),
        },
      })
      return new Response(
        [
          'event: response.output_item.done',
          'data: ' +
            JSON.stringify({
              type: 'response.output_item.done',
              item: {
                type: 'image_generation_call',
                id: 'ig_codex_oauth',
                status: 'completed',
                result: 'data:image/png;base64,' + onePixelPngBase64,
                revised_prompt: 'A clean sunrise over calm water.',
              },
            }),
          '',
          'event: response.completed',
          'data: ' +
            JSON.stringify({
              type: 'response.completed',
              response: {
                id: 'resp_codex_oauth',
                model: 'gpt-5.5',
                usage: {
                  total_tokens: 13,
                },
              },
            }),
          '',
        ].join('\\n'),
        {
          status: 200,
          statusText: 'OK',
          headers: {
            'content-type': 'text/event-stream',
          },
        },
      )
    }
    const codexProvider = new CodexOAuthProvider({
      session: {
        getValidCredential: async () => ({
          access: 'codex-token',
          accountId: 'acct_codex_fixture',
        }),
        getAvailability: async () => ({
          available: true,
          configured: true,
          reason: 'fixture',
        }),
      } as any,
      baseUrl: 'https://chatgpt.com/backend-api',
      defaultModel: 'gpt-5.5',
      fetchImpl: codexFetchImpl,
    })
    const codexResult = await codexProvider.generateImage({
      provider: 'codex-oauth',
      model: 'gpt-5.5',
      sessionId: 'thread_fixture',
      outputId: 'out_codex_oauth_image',
      ccrHome: generatedArtifactsHome,
      prompt: '画一张日出图片',
      size: '1024x1024',
      quality: 'low',
      outputFormat: 'png',
    })
    assert.equal(codexRequests[0].url, 'https://chatgpt.com/backend-api/codex/responses')
    assert.equal(codexRequests[0].headers.authorization, 'Bearer codex-token')
    assert.equal(codexRequests[0].headers.accountId, 'acct_codex_fixture')
    assert.equal(codexRequests[0].headers.beta, 'responses=experimental')
    assert.equal(codexRequests[0].headers.accept, 'text/event-stream')
    assert.equal(codexRequests[0].headers.contentType, 'application/json')
    assert.equal(codexRequests[0].headers.originator, 'ccr')
    assert.equal(codexRequests[0].body.model, 'gpt-5.5')
    assert.equal(codexRequests[0].body.store, false)
    assert.equal(codexRequests[0].body.stream, true)
    assert.equal(codexRequests[0].body.tool_choice, 'auto')
    assert.equal(codexRequests[0].body.parallel_tool_calls, true)
    assert.deepEqual(codexRequests[0].body.tools, [
      {
        type: 'image_generation',
        output_format: 'png',
      },
    ])
    assert.equal('size' in codexRequests[0].body, false)
    assert.equal('quality' in codexRequests[0].body, false)
    assert.equal('response_format' in codexRequests[0].body, false)
    const codexInput = codexRequests[0].body.input as Array<{
      role: string
      content: Array<{ type: string; text: string }>
    }>
    assert.equal(codexInput[0].role, 'user')
    assert.equal(codexInput[0].content[0].type, 'input_text')
    assert.equal(codexInput[0].content[0].text, '画一张日出图片')
    assert.equal(codexResult.provider, 'codex-oauth')
    assert.equal(codexResult.model, 'gpt-5.5')
    assert.equal(codexResult.output.length, 1)
    assert.equal(codexResult.generatedArtifacts.length, 1)
    assert.equal(codexResult.output[0].provider, 'codex-oauth')
    assert.equal(codexResult.output[0].source?.kind, 'file')
    assert.equal(codexResult.output[0].outputId, 'out_codex_oauth_image')
    assert.deepEqual(
      await readFile(codexResult.output[0].savedPath!),
      Buffer.from(onePixelPngBase64, 'base64'),
    )
    assert.equal(JSON.stringify(codexResult.raw).includes(onePixelPngBase64), false)

    const codexBody = toCodexOAuthImageGenerationRequestBody({
      defaultModel: 'gpt-5.5',
      systemPrompt: 'System prompt fixture.',
      request: {
        provider: 'codex-oauth',
        model: 'gpt-5.5',
        sessionId: 'thread_fixture',
        outputId: 'out_codex_body',
        prompt: 'Generate a small icon.',
        outputFormat: 'webp',
      },
    })
    assert.equal(codexBody.model, 'gpt-5.5')
    assert.equal(codexBody.stream, true)
    assert.equal((codexBody.instructions as string).includes('image_generation'), true)
    assert.deepEqual(codexBody.tools, [
      {
        type: 'image_generation',
        output_format: 'webp',
      },
    ])
    assert.equal('size' in codexBody, false)

    const compatibleBody = toOpenAiImageGenerationRequestBody({
      defaultModel: 'dall-e-3',
      request: {
        provider: 'openai-compatible',
        model: 'dall-e-3',
        sessionId: 'thread_fixture',
        outputId: 'out_compatible_image',
        prompt: 'Generate a small icon.',
      },
    })
    assert.equal(compatibleBody.response_format, 'b64_json')

    const minimaxRequests: Array<{ url: string; body: Record<string, unknown>; authorization?: string | null }> = []
    const minimaxFetchImpl: typeof fetch = async (url, init) => {
      const headers = new Headers(init?.headers)
      minimaxRequests.push({
        url: String(url),
        body: JSON.parse(String(init?.body ?? '{}')),
        authorization: headers.get('authorization'),
      })
      return new Response(
        JSON.stringify({
          id: 'minimax_fixture',
          data: {
            image_base64: [onePixelPngBase64],
          },
          metadata: {
            success_count: 1,
            failed_count: 0,
          },
          base_resp: {
            status_code: 0,
            status_msg: 'success',
          },
        }),
        {
          status: 200,
          statusText: 'OK',
          headers: {
            'content-type': 'application/json',
          },
        },
      )
    }
    const minimaxAdapter = new MiniMaxImageGenerationAdapter({
      providerId: 'minimax',
      providerLabel: 'MiniMax 国际版',
      apiKey: 'test-key',
      baseUrl: 'https://api.minimax.test/v1',
      defaultModel: 'image-01',
      fetchImpl: minimaxFetchImpl,
    })
    const minimaxResult = await minimaxAdapter.generateImage({
      provider: 'minimax',
      model: 'image-01',
      sessionId: 'thread_fixture',
      outputId: 'out_minimax_image',
      ccrHome: generatedArtifactsHome,
      prompt: '画一张日出图片',
      size: '1024x1024',
      n: 1,
      metadata: {
        promptOptimizer: true,
        seed: 123,
      },
    })
    assert.equal(minimaxRequests[0].url, 'https://api.minimax.test/v1/image_generation')
    assert.equal(minimaxRequests[0].authorization, 'Bearer test-key')
    assert.equal(minimaxRequests[0].body.model, 'image-01')
    assert.equal(minimaxRequests[0].body.prompt, '画一张日出图片')
    assert.equal(minimaxRequests[0].body.response_format, 'base64')
    assert.equal(minimaxRequests[0].body.aspect_ratio, '1:1')
    assert.equal(minimaxRequests[0].body.n, 1)
    assert.equal(minimaxRequests[0].body.prompt_optimizer, true)
    assert.equal(minimaxRequests[0].body.seed, 123)
    assert.equal(minimaxResult.provider, 'minimax')
    assert.equal(minimaxResult.model, 'image-01')
    assert.equal(minimaxResult.output.length, 1)
    assert.equal(minimaxResult.generatedArtifacts.length, 1)
    assert.equal(minimaxResult.output[0].provider, 'minimax')
    assert.equal(minimaxResult.output[0].source?.kind, 'file')
    assert.equal(minimaxResult.output[0].outputId, 'out_minimax_image')
    assert.deepEqual(
      await readFile(minimaxResult.output[0].savedPath!),
      Buffer.from(onePixelPngBase64, 'base64'),
    )
    assert.equal(JSON.stringify(minimaxResult.raw).includes(onePixelPngBase64), false)

    const minimaxUrlRequests: Array<{ url: string; body: Record<string, unknown> }> = []
    const minimaxUrlAdapter = new MiniMaxImageGenerationAdapter({
      providerId: 'minimax-cn',
      providerLabel: 'MiniMax 国内版',
      apiKey: 'test-key',
      baseUrl: 'https://api.minimaxi.test/v1',
      defaultModel: 'image-01',
      fetchImpl: async (url, init) => {
        minimaxUrlRequests.push({
          url: String(url),
          body: JSON.parse(String(init?.body ?? '{}')),
        })
        return new Response(
          JSON.stringify({
            id: 'minimax_url_fixture',
            data: {
              image_urls: ['https://static.minimax.test/generated.png'],
            },
            metadata: {
              success_count: 1,
              failed_count: 0,
            },
            base_resp: {
              status_code: 0,
              status_msg: 'success',
            },
          }),
          {
            status: 200,
            statusText: 'OK',
            headers: {
              'content-type': 'application/json',
            },
          },
        )
      },
    })
    const minimaxUrlResult = await minimaxUrlAdapter.generateImage({
      provider: 'minimax-cn',
      model: 'image-01',
      sessionId: 'thread_fixture',
      outputId: 'out_minimax_url_image',
      ccrHome: generatedArtifactsHome,
      prompt: '画一张日出图片',
      responseFormat: 'url',
      metadata: {
        aspectRatio: '16:9',
        width: 1344,
        height: 768,
      },
    })
    assert.equal(minimaxUrlRequests[0].url, 'https://api.minimaxi.test/v1/image_generation')
    assert.equal(minimaxUrlRequests[0].body.response_format, 'url')
    assert.equal(minimaxUrlRequests[0].body.aspect_ratio, '16:9')
    assert.equal(minimaxUrlRequests[0].body.width, 1344)
    assert.equal(minimaxUrlRequests[0].body.height, 768)
    assert.equal(minimaxUrlResult.provider, 'minimax-cn')
    assert.equal(minimaxUrlResult.output[0].source?.kind, 'url')
    assert.equal(minimaxUrlResult.output[0].lifecycle, 'temporary')
    assert.equal(minimaxUrlResult.generatedArtifacts.length, 0)

    const minimaxBody = toMiniMaxImageGenerationRequestBody({
      defaultModel: 'image-01',
      request: {
        provider: 'minimax',
        model: 'image-01-live',
        sessionId: 'thread_fixture',
        outputId: 'out_minimax_body',
        prompt: 'Generate a small icon.',
        responseFormat: 'url',
        size: '1536x1024',
        metadata: {
          aigcWatermark: false,
        },
      },
    })
    assert.equal(minimaxBody.model, 'image-01-live')
    assert.equal(minimaxBody.response_format, 'url')
    assert.equal(minimaxBody.aspect_ratio, '3:2')
    assert.equal(minimaxBody.aigc_watermark, false)

    console.log('smoke-generated-output-provider: ok')
  `,
  'utf8',
)

await build({
  entryPoints: [entryPath],
  outfile: outputPath,
  bundle: true,
  external: [
    '@anthropic-ai/bedrock-sdk',
    '@anthropic-ai/foundry-sdk',
    '@anthropic-ai/vertex-sdk',
    '@aws-sdk/client-bedrock',
    '@aws-sdk/client-sts',
    '@aws-sdk/credential-providers',
    '@azure/identity',
  ],
  platform: 'node',
  format: 'esm',
  jsx: 'automatic',
  banner: {
    js: "import { createRequire as __ccrCreateRequire } from 'node:module'; const require = __ccrCreateRequire(import.meta.url);",
  },
  logLevel: 'silent',
})

try {
  await import(pathToFileURL(outputPath).href)
} finally {
  await rm(tempDir, { recursive: true, force: true })
}
