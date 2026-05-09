import { execa } from 'execa';
export function startAppServerProcess(options = {}) {
    const command = options.command ?? process.execPath;
    const args = options.args ?? ['cli.js', 'app-server', '--listen', 'stdio'];
    const child = execa(command, [...args], {
        cwd: options.cwd,
        env: options.env,
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        cleanup: true,
        reject: false,
    });
    const lineListeners = new Set();
    const stderrListeners = new Set();
    const closeListeners = new Set();
    let stdoutBuffer = '';
    let stderr = '';
    let closeEvent = null;
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', chunk => {
        stdoutBuffer += String(chunk);
        for (;;) {
            const newline = stdoutBuffer.indexOf('\n');
            if (newline === -1) {
                break;
            }
            const line = stdoutBuffer.slice(0, newline);
            stdoutBuffer = stdoutBuffer.slice(newline + 1);
            for (const listener of lineListeners) {
                listener(line);
            }
        }
    });
    child.stderr?.on('data', chunk => {
        const text = String(chunk);
        stderr += text;
        for (const listener of stderrListeners) {
            listener(text);
        }
    });
    child.on('error', error => {
        emitClose({
            code: null,
            signal: null,
            stderr,
            error,
        });
    });
    child.then(result => {
        emitClose({
            code: result.exitCode ?? null,
            signal: result.signal ?? null,
            stderr,
        });
    }, error => {
        emitClose({
            code: null,
            signal: null,
            stderr,
            error,
        });
    });
    function emitClose(event) {
        if (closeEvent) {
            return;
        }
        closeEvent = event;
        for (const listener of closeListeners) {
            listener(event);
        }
    }
    return {
        pid: child.pid,
        sendLine(line) {
            if (!child.stdin) {
                throw new Error('App Server stdin is not available.');
            }
            child.stdin.write(`${line}\n`);
        },
        close() {
            if (closeEvent) {
                return;
            }
            child.kill('SIGTERM');
        },
        onLine(listener) {
            lineListeners.add(listener);
            return () => lineListeners.delete(listener);
        },
        onClose(listener) {
            closeListeners.add(listener);
            if (closeEvent) {
                listener(closeEvent);
            }
            return () => closeListeners.delete(listener);
        },
        getStderr() {
            return stderr;
        },
        onStderr(listener) {
            stderrListeners.add(listener);
            return () => stderrListeners.delete(listener);
        },
        async waitForExit() {
            if (closeEvent) {
                return closeEvent;
            }
            return new Promise(resolve => {
                const unsubscribe = this.onClose(event => {
                    unsubscribe();
                    resolve(event);
                });
            });
        },
    };
}
//# sourceMappingURL=appServerProcess.js.map