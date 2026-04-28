import { cp, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))

const assets = [
  {
    from: join(
      repoRoot,
      'src',
      'utils',
      'permissions',
      'yolo-classifier-prompts',
    ),
    to: join(
      repoRoot,
      'dist',
      'src',
      'utils',
      'permissions',
      'yolo-classifier-prompts',
    ),
  },
]

for (const asset of assets) {
  await mkdir(dirname(asset.to), { recursive: true })
  await cp(asset.from, asset.to, { recursive: true })
}

