export async function rollback(_target: string, _options: unknown): Promise<void> {
  throw new Error('rollback 命令入口尚未恢复。')
}
