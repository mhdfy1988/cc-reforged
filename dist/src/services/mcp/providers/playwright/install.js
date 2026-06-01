import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { getClaudeConfigHomeDir } from '../../../../utils/envUtils.js';
import { execFileNoThrowWithCwd } from '../../../../utils/execFileNoThrow.js';
import { getPlatform } from '../../../../utils/platform.js';
import { jsonStringify } from '../../../../utils/slowOperations.js';
export const PLAYWRIGHT_MCP_SERVER_NAME = 'playwright';
const PLAYWRIGHT_MCP_PACKAGE_NAME = '@playwright/mcp';
const PLAYWRIGHT_MCP_BIN_NAME = 'playwright-mcp';
const MANIFEST_FILE_NAME = 'manifest.json';
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function normalizePlaywrightVersion(version) {
    const normalized = version?.trim();
    return normalized || 'latest';
}
function getPlaywrightPackageRef(version) {
    return `${PLAYWRIGHT_MCP_PACKAGE_NAME}@${normalizePlaywrightVersion(version)}`;
}
function buildPlaywrightServerArgs(options) {
    const args = [];
    if (options.headless) {
        args.push('--headless');
    }
    if (options.config) {
        args.push('--config', options.config);
    }
    return args;
}
export function ensurePlaywrightMcpMode(mode) {
    const normalized = mode?.trim().toLowerCase() || 'npx';
    if (normalized === 'npx' || normalized === 'managed') {
        return normalized;
    }
    throw new Error(`Unsupported Playwright MCP mode "${mode}". Expected "npx" or "managed".`);
}
export function getPlaywrightMcpManagedInstallDir() {
    return join(getClaudeConfigHomeDir(), 'mcp', 'servers', 'playwright');
}
export function getPlaywrightMcpManagedManifestPath() {
    return join(getPlaywrightMcpManagedInstallDir(), MANIFEST_FILE_NAME);
}
export function createPlaywrightNpxMcpServerConfig(options) {
    const args = [
        '-y',
        getPlaywrightPackageRef(options.version),
        ...buildPlaywrightServerArgs(options),
    ];
    if (getPlatform() === 'windows') {
        return {
            type: 'stdio',
            command: 'npx.cmd',
            args,
        };
    }
    return {
        type: 'stdio',
        command: 'npx',
        args,
    };
}
function readPackageJsonBinEntry(packageJson) {
    const bin = packageJson.bin;
    if (typeof bin === 'string' && bin.trim()) {
        return bin;
    }
    if (!isRecord(bin)) {
        throw new Error(`${PLAYWRIGHT_MCP_PACKAGE_NAME} package.json does not expose a valid bin entry.`);
    }
    const namedEntry = bin[PLAYWRIGHT_MCP_BIN_NAME];
    if (typeof namedEntry === 'string' && namedEntry.trim()) {
        return namedEntry;
    }
    const entries = Object.values(bin).filter((value) => typeof value === 'string' && value.trim() !== '');
    if (entries.length === 1) {
        return entries[0];
    }
    throw new Error(`${PLAYWRIGHT_MCP_PACKAGE_NAME} package.json does not contain a unique runnable bin entry.`);
}
async function readInstalledPlaywrightPackageJson(packageJsonPath) {
    const raw = await readFile(packageJsonPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) {
        throw new Error(`${PLAYWRIGHT_MCP_PACKAGE_NAME} package.json is not a JSON object.`);
    }
    return parsed;
}
async function writeManagedPackageJson(installDir) {
    const packageJson = {
        private: true,
        name: 'ccr-managed-playwright-mcp',
        version: '0.0.0',
        description: 'CCR managed install root for Playwright MCP.',
    };
    await writeFile(join(installDir, 'package.json'), `${jsonStringify(packageJson, null, 2)}\n`, 'utf8');
}
async function installNpmPackage(params) {
    const command = getPlatform() === 'windows' ? 'npm.cmd' : 'npm';
    const result = await execFileNoThrowWithCwd(command, [
        'install',
        '--prefix',
        params.installDir,
        '--no-audit',
        '--fund=false',
        params.packageRef,
    ], {
        cwd: params.installDir,
        timeout: 10 * 60 * 1000,
        preserveOutputOnError: true,
        maxBuffer: 2_000_000,
    });
    if (result.code !== 0) {
        const details = result.stderr || result.stdout || result.error || 'unknown';
        throw new Error(`Failed to install ${params.packageRef}: ${details}`);
    }
}
export async function installPlaywrightMcpManaged(options) {
    const installDir = getPlaywrightMcpManagedInstallDir();
    const requestedVersion = normalizePlaywrightVersion(options.version);
    const packageRef = getPlaywrightPackageRef(requestedVersion);
    await mkdir(installDir, { recursive: true });
    await writeManagedPackageJson(installDir);
    await installNpmPackage({ installDir, packageRef });
    const packageDir = join(installDir, 'node_modules', '@playwright', 'mcp');
    const packageJsonPath = join(packageDir, 'package.json');
    const packageJson = await readInstalledPlaywrightPackageJson(packageJsonPath);
    if (packageJson.name !== PLAYWRIGHT_MCP_PACKAGE_NAME) {
        throw new Error(`Unexpected package installed at ${packageJsonPath}: ${String(packageJson.name)}`);
    }
    if (typeof packageJson.version !== 'string' || !packageJson.version) {
        throw new Error(`${PLAYWRIGHT_MCP_PACKAGE_NAME} package.json is missing a version.`);
    }
    const binEntry = readPackageJsonBinEntry(packageJson);
    const entryPath = join(packageDir, binEntry);
    const manifest = {
        schemaVersion: 1,
        packageName: PLAYWRIGHT_MCP_PACKAGE_NAME,
        requestedVersion,
        installedVersion: packageJson.version,
        installedAt: new Date().toISOString(),
        installDir,
        packageDir,
        entryPath,
        binName: PLAYWRIGHT_MCP_BIN_NAME,
        nodeCommand: process.execPath,
    };
    await writeFile(getPlaywrightMcpManagedManifestPath(), `${jsonStringify(manifest, null, 2)}\n`, 'utf8');
    return manifest;
}
export async function createPlaywrightManagedMcpServerConfig(options) {
    const manifest = await installPlaywrightMcpManaged({
        version: options.version,
    });
    return {
        type: 'stdio',
        command: manifest.nodeCommand,
        args: [manifest.entryPath, ...buildPlaywrightServerArgs(options)],
    };
}
export async function createPlaywrightMcpServerConfig(options) {
    const mode = options.mode ?? 'npx';
    if (mode === 'managed') {
        return createPlaywrightManagedMcpServerConfig(options);
    }
    return createPlaywrightNpxMcpServerConfig(options);
}
//# sourceMappingURL=install.js.map