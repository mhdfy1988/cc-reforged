function failClosed(exportName: string): never {
  throw new Error(`Not implemented in reforged build: src/environment-runner/main.ts#${exportName}`);
}

export async function main(): Promise<void> {
  failClosed('main');
}

export async function environmentRunnerMain(args: readonly string[]): Promise<void> {
  void args;
  failClosed('environmentRunnerMain');
}
