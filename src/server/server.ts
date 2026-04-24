export type ServerHandle = {
  port: number
  stop: (drainSessions?: boolean) => Promise<void> | void
}

export function startServer(..._args: unknown[]): ServerHandle {
  throw new Error('server 启动入口尚未恢复：当前版本禁止直接启动直连服务。')
}
