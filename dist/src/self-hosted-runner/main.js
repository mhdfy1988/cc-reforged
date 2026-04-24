function failClosed(exportName) {
    throw new Error(`Not implemented in reforged build: src/self-hosted-runner/main.ts#${exportName}`);
}
export async function main() {
    failClosed('main');
}
export async function selfHostedRunnerMain(args) {
    void args;
    failClosed('selfHostedRunnerMain');
}
//# sourceMappingURL=main.js.map