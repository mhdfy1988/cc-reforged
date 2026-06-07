import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const smokeScripts = [
  'smoke-capability-management-actions.mjs',
  'smoke-capability-catalog-app-provider.mjs',
  'smoke-capability-catalog-plugin-relations.mjs',
  'smoke-tool-registry.mjs',
]

for (const script of smokeScripts) {
  await import(pathToFileURL(join(repoRoot, 'scripts', script)).href)
}

console.log('smoke-extension-capability-management-e2e: ok')
