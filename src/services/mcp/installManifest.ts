import { isAbsolute } from 'path'
import { z } from 'zod/v4'
import { lazySchema } from '../../utils/lazySchema.js'
import {
  ConfigScopeSchema,
  McpServerConfigSchema,
  type McpServerConfig,
} from './types.js'

export const CcrMcpInstallKindSchema = lazySchema(() =>
  z.enum([
    'manual-config',
    'remote-url',
    'stdio-npm-package',
    'local-directory',
    'builtin-preset',
    'plugin-provided',
  ]),
)
export type CcrMcpInstallKind = z.infer<
  ReturnType<typeof CcrMcpInstallKindSchema>
>

export const CcrMcpInstallTransportSchema = lazySchema(() =>
  z.enum([
    'stdio',
    'sse',
    'sse-ide',
    'http',
    'ws',
    'ws-ide',
    'sdk',
    'claudeai-proxy',
  ]),
)
export type CcrMcpInstallTransport = z.infer<
  ReturnType<typeof CcrMcpInstallTransportSchema>
>

export const CcrMcpInstallSourceSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('manual-config'),
      scope: ConfigScopeSchema(),
      configPath: z.string().nullable(),
    }),
    z.object({
      kind: z.literal('remote-url'),
      url: z.string().min(1),
      headersRequired: z.boolean().default(false),
    }),
    z.object({
      kind: z.literal('stdio-npm-package'),
      packageName: z.string().min(1),
      packageManager: z.enum(['npm', 'npx', 'pnpm', 'yarn', 'bun']).default('npx'),
      registry: z.string().optional(),
    }),
    z.object({
      kind: z.literal('local-directory'),
      path: z.string().min(1),
    }),
    z.object({
      kind: z.literal('builtin-preset'),
      presetId: z.string().min(1),
    }),
    z.object({
      kind: z.literal('plugin-provided'),
      pluginSource: z.string().min(1),
      pluginName: z.string().optional(),
      serverName: z.string().optional(),
    }),
  ]),
)
export type CcrMcpInstallSource = z.infer<
  ReturnType<typeof CcrMcpInstallSourceSchema>
>

export const CcrMcpInstallEntrySchema = lazySchema(() =>
  z.object({
    command: z.string().min(1),
    args: z.array(z.string()).default([]),
    cwd: z.string().optional(),
  }),
)
export type CcrMcpInstallEntry = z.infer<
  ReturnType<typeof CcrMcpInstallEntrySchema>
>

export const CcrMcpInstallEnvVarSchema = lazySchema(() =>
  z.object({
    name: z.string().min(1),
    required: z.boolean().default(false),
    secret: z.boolean().default(false),
    description: z.string().optional(),
  }),
)
export type CcrMcpInstallEnvVar = z.infer<
  ReturnType<typeof CcrMcpInstallEnvVarSchema>
>

export const CcrMcpInstallPermissionSchema = lazySchema(() =>
  z.object({
    kind: z.enum([
      'network',
      'filesystem',
      'process',
      'oauth',
      'secret',
      'environment',
    ]),
    required: z.boolean().default(false),
    description: z.string().optional(),
  }),
)
export type CcrMcpInstallPermission = z.infer<
  ReturnType<typeof CcrMcpInstallPermissionSchema>
>

export const CcrMcpChecksumSchema = lazySchema(() =>
  z.object({
    algorithm: z.enum(['sha256', 'sha512']),
    value: z.string().min(1),
  }),
)
export type CcrMcpChecksum = z.infer<ReturnType<typeof CcrMcpChecksumSchema>>

export const CcrMcpInstallManifestSchema = lazySchema(() =>
  z.object({
    schemaVersion: z.literal(1),
    name: z.string().min(1),
    displayName: z.string().optional(),
    description: z.string().optional(),
    version: z.string().optional(),
    source: CcrMcpInstallSourceSchema(),
    transport: CcrMcpInstallTransportSchema(),
    serverConfig: McpServerConfigSchema().optional(),
    entry: CcrMcpInstallEntrySchema().optional(),
    envSchema: z.array(CcrMcpInstallEnvVarSchema()).default([]),
    permissions: z.array(CcrMcpInstallPermissionSchema()).default([]),
    homepage: z.string().optional(),
    checksum: CcrMcpChecksumSchema().optional(),
    dataBoundary: z
      .enum(['local-only', 'remote-service', 'plugin-defined', 'unknown'])
      .default('unknown'),
  }),
)
export type CcrMcpInstallManifest = z.infer<
  ReturnType<typeof CcrMcpInstallManifestSchema>
>
export type CcrMcpInstallManifestInput = z.input<
  ReturnType<typeof CcrMcpInstallManifestSchema>
>

export function createCcrMcpInstallManifest(
  input: Omit<CcrMcpInstallManifestInput, 'schemaVersion'> & {
    schemaVersion?: 1
  },
): CcrMcpInstallManifest {
  return CcrMcpInstallManifestSchema().parse({
    schemaVersion: 1,
    ...input,
  })
}

export function summarizeCcrMcpInstallManifest(
  manifest: CcrMcpInstallManifest,
): {
  schemaVersion: 1
  name: string
  kind: CcrMcpInstallKind
  version?: string
  transport: CcrMcpInstallTransport
  permissionKinds: string[]
  envNames: string[]
  dataBoundary: CcrMcpInstallManifest['dataBoundary']
} {
  return {
    schemaVersion: manifest.schemaVersion,
    name: manifest.name,
    kind: manifest.source.kind,
    version: manifest.version,
    transport: manifest.transport,
    permissionKinds: manifest.permissions.map(permission => permission.kind),
    envNames: manifest.envSchema.map(env => env.name),
    dataBoundary: manifest.dataBoundary,
  }
}

export function inferCcrMcpInstallKindFromConfig(
  config: McpServerConfig,
  options: {
    pluginSource?: string
    sourceId?: string
  } = {},
): CcrMcpInstallKind {
  if (options.pluginSource || options.sourceId === 'plugin') {
    return 'plugin-provided'
  }

  if ('url' in config) {
    return 'remote-url'
  }

  if (config.type === 'sdk') {
    return 'builtin-preset'
  }

  if (isStdioLikeConfig(config)) {
    const command = config.command
    if (isNpmCommand(command)) {
      return 'stdio-npm-package'
    }
    if (looksLikeLocalCommand(command)) {
      return 'local-directory'
    }
  }

  return 'manual-config'
}

export function getCcrMcpInstallTransport(
  config: McpServerConfig,
): CcrMcpInstallTransport {
  return (config.type ?? 'stdio') as CcrMcpInstallTransport
}

function isStdioLikeConfig(
  config: McpServerConfig,
): config is McpServerConfig & { command: string; args?: string[] } {
  return 'command' in config && (!('type' in config) || config.type === 'stdio')
}

function isNpmCommand(command: string): boolean {
  const executable = command.split(/[\\/]/).pop()?.toLowerCase() ?? command
  return [
    'npm',
    'npm.cmd',
    'npm.exe',
    'npx',
    'npx.cmd',
    'npx.exe',
    'pnpm',
    'pnpm.cmd',
    'pnpm.exe',
    'yarn',
    'yarn.cmd',
    'yarn.exe',
    'bun',
    'bun.exe',
    'bunx',
    'bunx.exe',
  ].includes(executable)
}

function looksLikeLocalCommand(command: string): boolean {
  return (
    command.startsWith('.') ||
    command.includes('/') ||
    command.includes('\\') ||
    isAbsolute(command)
  )
}
