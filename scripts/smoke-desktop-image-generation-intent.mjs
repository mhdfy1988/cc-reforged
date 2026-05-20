import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bundleDir = join(repoRoot, '.tmp', 'smoke-desktop-image-generation-intent')
const entryPath = join(bundleDir, 'entry.mjs')
const outputPath = join(bundleDir, 'bundle.mjs')

rmSync(bundleDir, { recursive: true, force: true })
mkdirSync(bundleDir, { recursive: true })
writeFileSync(
  entryPath,
  `
    import { extractImageGenerationPrompt } from '../../apps/desktop/src/main/imageGenerationIntent.ts';

    export { extractImageGenerationPrompt };
  `,
  'utf8',
)

try {
  await build({
    entryPoints: [entryPath],
    outfile: outputPath,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent',
  })

  const { extractImageGenerationPrompt } = await import(
    pathToFileURL(outputPath).href
  )

  const positiveCases = [
    ['/image a bride standing in a meadow', 'a bride standing in a meadow'],
    ['生成图片：一辆红色跑车', '一辆红色跑车'],
    ['帮我生成一个穿着婚纱的新娘的图片', '穿着婚纱的新娘'],
    ['帮我生成一个穿着婚纱的新娘的图片吧', '穿着婚纱的新娘'],
    ['帮我生成一张奔驰女孩在原野上的图', '奔驰女孩在原野上'],
    ['请画一张猫在月亮上的插画', '猫在月亮上'],
    ['做一张海报 夏日促销', '夏日促销'],
    ['create an image of a glass city at sunrise', 'a glass city at sunrise'],
  ]

  for (const [input, expected] of positiveCases) {
    assert.equal(
      extractImageGenerationPrompt(input),
      expected,
      `${input} should be detected as an image generation prompt`,
    )
  }

  const negativeCases = [
    '',
    '生成图片',
    '生成图片失败',
    '请画图吧',
    'glm-image的调用方式好像不太对',
    '现在的模型是什么',
    '读取这张图片',
  ]

  for (const input of negativeCases) {
    assert.equal(
      extractImageGenerationPrompt(input),
      undefined,
      `${input} should stay in the normal chat route`,
    )
  }
} finally {
  rmSync(bundleDir, { recursive: true, force: true })
}
