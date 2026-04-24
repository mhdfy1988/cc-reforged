function failClosed(exportName: string): never {
  throw new Error(`Not implemented in reforged build: src/cli/bg.ts#${exportName}`);
}

export async function main(): Promise<void> {
  failClosed('main');
}

export async function psHandler(args: readonly string[]): Promise<void> {
  void args;
  failClosed('psHandler');
}

export async function logsHandler(sessionId?: string): Promise<void> {
  void sessionId;
  failClosed('logsHandler');
}

export async function attachHandler(sessionId?: string): Promise<void> {
  void sessionId;
  failClosed('attachHandler');
}

export async function killHandler(sessionId?: string): Promise<void> {
  void sessionId;
  failClosed('killHandler');
}

export async function handleBgFlag(args: readonly string[]): Promise<void> {
  void args;
  failClosed('handleBgFlag');
}
