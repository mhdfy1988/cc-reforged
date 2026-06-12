import { createInterface } from 'node:readline';
import { AppServerError, errorResponse } from './errors.js';
import { createAppServerContext, handleJsonRpcMessage } from './router.js';
import { createAppServerPluginRuntimeHostAdapter } from './pluginRuntimeHost.js';
export async function runStdioAppServer(options = {}) {
    const input = options.input ?? process.stdin;
    const output = options.output ?? process.stdout;
    const errorOutput = options.errorOutput ?? process.stderr;
    const context = createAppServerContext({
        emit: notification => writeProtocolMessage(output, notification),
        pluginRuntimeHostAdapterFactory: createAppServerPluginRuntimeHostAdapter,
    });
    input.setEncoding?.('utf8');
    const lineReader = createInterface({
        input,
        crlfDelay: Infinity,
        terminal: false,
    });
    try {
        for await (const line of lineReader) {
            if (!line.trim()) {
                continue;
            }
            const response = await handleProtocolLine(context, line);
            writeProtocolResponse(output, response);
            if (context.shutdownRequested) {
                break;
            }
        }
    }
    catch (error) {
        errorOutput.write(formatTransportError(error));
    }
    finally {
        lineReader.close();
    }
}
export async function handleProtocolLine(context, line) {
    let parsed;
    try {
        parsed = JSON.parse(line);
    }
    catch (error) {
        return errorResponse(null, new AppServerError('parse_error', undefined, getParseErrorDetails(error)));
    }
    return handleJsonRpcMessage(context, parsed);
}
export function writeProtocolResponse(output, response) {
    writeProtocolMessage(output, response);
}
export function writeProtocolMessage(output, response) {
    output.write(`${JSON.stringify(response)}\n`);
}
function getParseErrorDetails(error) {
    if (error instanceof Error) {
        return {
            message: error.message,
        };
    }
    return undefined;
}
function formatTransportError(error) {
    if (error instanceof Error) {
        return `[ccr-app-server] ${error.stack ?? error.message}\n`;
    }
    return `[ccr-app-server] ${String(error)}\n`;
}
//# sourceMappingURL=stdioTransport.js.map