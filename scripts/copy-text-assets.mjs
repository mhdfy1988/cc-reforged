import { cp, mkdir, stat } from 'node:fs/promises'
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
  {
    from: join(repoRoot, 'vendor', 'ripgrep'),
    to: join(repoRoot, 'dist', 'src', 'utils', 'vendor', 'ripgrep'),
    optional: true,
  },
]

for (const asset of assets) {
  if (asset.optional) {
    const exists = await stat(asset.from)
      .then(() => true)
      .catch(() => false)
    if (!exists) continue
  }
  await mkdir(dirname(asset.to), { recursive: true })
  await cp(asset.from, asset.to, { recursive: true })
}
