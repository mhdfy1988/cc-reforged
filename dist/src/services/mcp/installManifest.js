import { isAbsolute } from 'path';
import { z } from 'zod/v4';
import { lazySchema } from '../../utils/lazySchema.js';
import { ConfigScopeSchema, McpServerConfigSchema, } from './types.js';
export const CcrMcpInstallKindSchema = lazySchema(() => z.enum([
    'manual-config',
    'remote-url',
    'stdio-npm-package',
    'local-directory',
    'builtin-preset',
    'plugin-provided',
]));
export const CcrMcpInstallTransportSchema = lazySchema(() => z.enum([
    'stdio',
    'sse',
    'sse-ide',
    'http',
    'ws',
    'ws-ide',
    'sdk',
    'claudeai-proxy',
]));
export const CcrMcpInstallSourceSchema = lazySchema(() => z.discriminatedUnion('kind', [
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
]));
export const CcrMcpInstallEntrySchema = lazySchema(() => z.object({
    command: z.string().min(1),
    args: z.array(z.string()).default([]),
    cwd: z.string().optional(),
}));
export const CcrMcpInstallEnvVarSchema = lazySchema(() => z.object({
    name: z.string().min(1),
    required: z.boolean().default(false),
    secret: z.boolean().default(false),
    description: z.string().optional(),
}));
export const CcrMcpInstallPermissionSchema = lazySchema(() => z.object({
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
}));
export const CcrMcpChecksumSchema = lazySchema(() => z.object({
    algorithm: z.enum(['sha256', 'sha512']),
    value: z.string().min(1),
}));
export const CcrMcpInstallManifestSchema = lazySchema(() => z.object({
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
}));
export function createCcrMcpInstallManifest(input) {
    return CcrMcpInstallManifestSchema().parse({
        schemaVersion: 1,
        ...input,
    });
}
export function summarizeCcrMcpInstallManifest(manifest) {
    return {
        schemaVersion: manifest.schemaVersion,
        name: manifest.name,
        kind: manifest.source.kind,
        version: manifest.version,
        transport: manifest.transport,
        permissionKinds: manifest.permissions.map(permission => permission.kind),
        envNames: manifest.envSchema.map(env => env.name),
        dataBoundary: manifest.dataBoundary,
    };
}
export function inferCcrMcpInstallKindFromConfig(config, options = {}) {
    if (options.pluginSource || options.sourceId === 'plugin') {
        return 'plugin-provided';
    }
    if ('url' in config) {
        return 'remote-url';
    }
    if (config.type === 'sdk') {
        return 'builtin-preset';
    }
    if (isStdioLikeConfig(config)) {
        const command = config.command;
        if (isNpmCommand(command)) {
            return 'stdio-npm-package';
        }
        if (looksLikeLocalCommand(command)) {
            return 'local-directory';
        }
    }
    return 'manual-config';
}
export function getCcrMcpInstallTransport(config) {
    return (config.type ?? 'stdio');
}
function isStdioLikeConfig(config) {
    return 'command' in config && (!('type' in config) || config.type === 'stdio');
}
function isNpmCommand(command) {
    const executable = command.split(/[\\/]/).pop()?.toLowerCase() ?? command;
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
    ].includes(executable);
}
function looksLikeLocalCommand(command) {
    return (command.startsWith('.') ||
        command.includes('/') ||
        command.includes('\\') ||
        isAbsolute(command));
}
//# sourceMappingURL=installManifest.js.map