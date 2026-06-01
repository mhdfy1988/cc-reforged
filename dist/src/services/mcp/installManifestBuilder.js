export function buildCcrMcpInstallManifestInput(input) {
    const name = requireText(input.name, 'MCP 名称');
    const displayName = optionalText(input.displayName);
    const description = optionalText(input.description);
    const base = {
        schemaVersion: 1,
        name,
        ...(displayName ? { displayName } : {}),
        ...(description ? { description } : {}),
    };
    switch (input.template) {
        case 'local-stdio': {
            const command = requireText(input.command, '启动命令');
            const args = parseLines(input.argsText);
            const directory = optionalText(input.directory) ?? '.';
            const env = parseKeyValueLines(input.envText);
            return {
                ...base,
                source: {
                    kind: 'local-directory',
                    path: directory,
                },
                transport: 'stdio',
                entry: {
                    command,
                    args,
                    ...(directory ? { cwd: directory } : {}),
                },
                ...(Object.keys(env).length > 0
                    ? {
                        serverConfig: {
                            type: 'stdio',
                            command,
                            args,
                            env,
                        },
                    }
                    : {}),
                envSchema: Object.keys(env).map(key => ({
                    name: key,
                    required: true,
                    secret: looksSecretLike(key),
                })),
                permissions: [
                    {
                        kind: 'process',
                        required: true,
                        description: '启动本地 MCP 进程。',
                    },
                ],
                dataBoundary: 'local-only',
            };
        }
        case 'local-http':
        case 'remote-http': {
            const url = requireText(input.url, 'HTTP URL');
            const headers = parseKeyValueLines(input.headersText);
            const local = input.template === 'local-http';
            return {
                ...base,
                source: {
                    kind: 'remote-url',
                    url,
                    headersRequired: Object.keys(headers).length > 0,
                },
                transport: 'http',
                ...(Object.keys(headers).length > 0
                    ? {
                        serverConfig: {
                            type: 'http',
                            url,
                            headers,
                        },
                    }
                    : {}),
                permissions: [
                    {
                        kind: 'network',
                        required: true,
                        description: local
                            ? '连接本机 HTTP MCP 服务。'
                            : '连接远端 HTTP MCP 服务。',
                    },
                ],
                dataBoundary: local ? 'local-only' : 'remote-service',
            };
        }
        case 'stdio-npm-package': {
            const packageName = requireText(input.packageName, 'npm 包名');
            const version = optionalText(input.version);
            const args = parseLines(input.argsText);
            return {
                ...base,
                ...(version ? { version } : {}),
                source: {
                    kind: 'stdio-npm-package',
                    packageName,
                    packageManager: 'npx',
                },
                transport: 'stdio',
                ...(args.length > 0
                    ? {
                        entry: {
                            command: 'npx',
                            args,
                        },
                    }
                    : {}),
                permissions: [
                    {
                        kind: 'process',
                        required: true,
                        description: '启动 npm 包提供的本地 MCP 进程。',
                    },
                    {
                        kind: 'network',
                        required: true,
                        description: '首次运行可能访问 npm registry 或 MCP 依赖的远端服务。',
                    },
                ],
                dataBoundary: 'remote-service',
            };
        }
    }
}
function requireText(value, label) {
    const text = optionalText(value);
    if (!text) {
        throw new Error(`${label}不能为空。`);
    }
    return text;
}
function optionalText(value) {
    const text = value?.trim();
    return text ? text : undefined;
}
function parseLines(value) {
    return (value ?? '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
}
function parseKeyValueLines(value) {
    const result = {};
    for (const line of parseLines(value)) {
        const separator = line.indexOf('=');
        if (separator <= 0) {
            throw new Error(`键值行必须使用 KEY=value 格式：${line}`);
        }
        const key = line.slice(0, separator).trim();
        const val = line.slice(separator + 1).trim();
        if (!key) {
            throw new Error(`键名不能为空：${line}`);
        }
        result[key] = val;
    }
    return result;
}
function looksSecretLike(name) {
    return /(?:TOKEN|KEY|SECRET|PASSWORD|CREDENTIAL)/i.test(name);
}
//# sourceMappingURL=installManifestBuilder.js.map