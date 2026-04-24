function failClosed(exportName: string): never {
  throw new Error(`Not implemented in reforged build: src/cli/handlers/templateJobs.ts#${exportName}`);
}

export async function main(): Promise<void> {
  failClosed('main');
}

export async function templatesMain(args: readonly string[]): Promise<void> {
  void args;
  failClosed('templatesMain');
}
