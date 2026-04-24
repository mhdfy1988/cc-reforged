import { existsSync } from 'node:fs'
import { dirname, resolve as pathResolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = dirname(fileURLToPath(import.meta.url))
const bunBundleShimUrl = pathToFileURL(
  pathResolve(rootDir, 'dist/src/build/bunBundleShim.js'),
).href
const claudeForChromeMcpStubUrl = pathToFileURL(
  pathResolve(rootDir, 'vendor/claude-for-chrome-mcp-stub.mjs'),
).href

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'bun:bundle') {
    return {
      shortCircuit: true,
      url: bunBundleShimUrl,
    }
  }

  if (specifier === '@ant/claude-for-chrome-mcp') {
    return {
      shortCircuit: true,
      url: claudeForChromeMcpStubUrl,
    }
  }

  if (specifier.startsWith('src/')) {
    return {
      shortCircuit: true,
      url: pathToFileURL(pathResolve(rootDir, 'dist', specifier)).href,
    }
  }

  try {
    return await nextResolve(specifier, context)
  } catch (error) {
    if (
      error?.code === 'ERR_MODULE_NOT_FOUND' &&
      specifier.startsWith('.') &&
      context.parentURL
    ) {
      const parentPath = fileURLToPath(context.parentURL)
      const distCandidate = pathResolve(dirname(parentPath), specifier)
      const sourceCandidate = distCandidate.replace(
        pathResolve(rootDir, 'dist/src'),
        pathResolve(rootDir, 'src'),
      )
      if (existsSync(sourceCandidate)) {
        return {
          shortCircuit: true,
          url: pathToFileURL(sourceCandidate).href,
        }
      }
    }

    if (
      error?.code === 'ERR_MODULE_NOT_FOUND' &&
      specifier.startsWith('.') &&
      !specifier.match(/\.[cm]?js$/)
    ) {
      return nextResolve(`${specifier}.js`, context)
    }
    throw error
  }
}
