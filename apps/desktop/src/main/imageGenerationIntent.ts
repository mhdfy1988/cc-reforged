const IMAGE_NOUN =
  '(?:图片|图像|图|画面|插画|海报|照片|壁纸|头像)'
const REQUEST_PREFIX = '(?:帮我|请|给我|帮忙|麻烦你)?'
const GENERATE_VERB = '(?:生成|创建|做|设计|制作|画|绘制)'
const CLASSIFIER = '(?:一张|一个|一幅|一份|个|张|幅|份)?'

const IMAGE_GENERATION_PATTERNS = [
  /^\/(?:image|imagine)\s+(.+)$/iu,
  new RegExp(
    `^${REQUEST_PREFIX}${GENERATE_VERB}${CLASSIFIER}${IMAGE_NOUN}[\\s:：,，。.]*(.+)$`,
    'iu',
  ),
  new RegExp(
    `^${REQUEST_PREFIX}${GENERATE_VERB}${CLASSIFIER}(.+?)(?:的)?${IMAGE_NOUN}$`,
    'iu',
  ),
  /^(?:draw|generate|create|make)\s+(?:an?\s+)?(?:image|picture|illustration|poster|photo)\s*(?:of|about|:)?\s+(.+)$/iu,
  /^(?:draw|generate|create|make)\s+(.+?)\s+(?:image|picture|illustration|poster|photo)$/iu,
] as const

const IMAGE_GENERATION_COMMAND_WITHOUT_PROMPT = new RegExp(
  `^${REQUEST_PREFIX}${GENERATE_VERB}${CLASSIFIER}${IMAGE_NOUN}[\\s:：,，。.]*$`,
  'iu',
)

const REPORT_ONLY_PROMPT =
  /^(?:失败|报错|错误|异常|不对|有问题|没反应|卡住|调用方式|能力|现在的模型是什么|是什么|为什么|怎么|如何)$/u
const REQUEST_PARTICLE_SUFFIX = /(?:吧|嘛|吗|呢|呀|啦|哦)[。.!！?？]*$/u

export function extractImageGenerationPrompt(text: string): string | undefined {
  const normalized = text.trim().replace(REQUEST_PARTICLE_SUFFIX, '').trim()
  if (!normalized) {
    return undefined
  }
  if (IMAGE_GENERATION_COMMAND_WITHOUT_PROMPT.test(normalized)) {
    return undefined
  }

  for (const pattern of IMAGE_GENERATION_PATTERNS) {
    const match = normalized.match(pattern)
    const prompt = normalizeImageGenerationPrompt(match?.[1])
    if (prompt) {
      return prompt
    }
  }

  return undefined
}

function normalizeImageGenerationPrompt(
  value: string | undefined,
): string | undefined {
  const prompt = value
    ?.trim()
    .replace(/^[\s:：,，。.]*/u, '')
    .replace(/[\s。.,，]*$/u, '')
    .replace(/^(?:一张|一个|一幅|一份)\s*/u, '')
    .trim()

  if (!prompt || REPORT_ONLY_PROMPT.test(prompt)) {
    return undefined
  }

  return prompt
}
