function failClosed(exportName: string): never {
  throw new Error(`Not implemented in reforged build: src/self-hosted-runner/main.ts#${exportName}`);
}

export async function main(): Promise<void> {
  failClosed('main');
}

export async function selfHostedRunnerMain(args: readonly string[]): Promise<void> {
  void args;
  failClosed('selfHostedRunnerMain');
}
