function failClosed(exportName) {
    throw new Error(`Not implemented in reforged build: src/environment-runner/main.ts#${exportName}`);
}
export async function main() {
    failClosed('main');
}
export async function environmentRunnerMain(args) {
    void args;
    failClosed('environmentRunnerMain');
}
//# sourceMappingURL=main.js.map