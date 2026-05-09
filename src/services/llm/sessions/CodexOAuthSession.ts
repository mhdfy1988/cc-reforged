import { createHash, randomBytes } from 'crypto'
import { spawn } from 'child_process'
import { createServer } from 'http'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import type { Socket } from 'net'
import { dirname, join } from 'path'
import { homedir } from 'os'

const DEFAULT_BASE_URL = 'https://chatgpt.com/backend-api'
const DEFAULT_AUTHORIZE_URL = 'https://auth.openai.com/oauth/authorize'
const DEFAULT_TOKEN_URL = 'https://auth.openai.com/oauth/token'
const DEFAULT_REDIRECT_URI = 'http://localhost:1455/auth/callback'
const DEFAULT_SCOPE = 'openid profile email offline_access'
const DEFAULT_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
const DEFAULT_JWT_CLAIM_PATH = 'https://api.openai.com/auth'
const DEFAULT_CALLBACK_HOST = '127.0.0.1'
const DEFAULT_CALLBACK_PORT = 1455
const DEFAULT_CREDENTIAL_FILE = join(
  homedir(),
  '.ccr',
  'data',
  'codex-oauth.json',
)
const REFRESH_WINDOW_MS = 60_000

export interface CodexOAuthCredential {
  access: string
  refresh?: string
  expires?: number
  accountId?: string
}

export interface CodexAuthorizationFlow {
  state: string
  verifier: string
  authorizationUrl: string
}

export interface CodexOAuthAvailability {
  available: boolean
  configured: boolean
  reason: string
  details?: {
    baseUrl: string
    source: string
    accountId?: string
    expiresAt?: number
  }
}

export interface CodexOAuthSessionOptions {
  baseUrl?: string
  authorizeUrl?: string
  tokenUrl?: string
  redirectUri?: string
  scope?: string
  clientId?: string
  jwtClaimPath?: string
  callbackHost?: string
  callbackPort?: number
  credentialFilePath?: string
  fetchFn?: typeof fetch
  now?: () => number
  openExternalUrl?: (url: string) => Promise<void> | void
}

interface CallbackServerController {
  waitForCode(timeoutMs?: number): Promise<string | null>
  cancel(): void
  close(): Promise<void>
}

export class CodexOAuthSession {
  readonly #baseUrl: string
  readonly #authorizeUrl: string
  readonly #tokenUrl: string
  readonly #redirectUri: string
  readonly #scope: string
  readonly #clientId: string
  readonly #jwtClaimPath: string
  readonly #callbackHost: string
  readonly #callbackPort: number
  readonly #credentialFilePath: string
  readonly #fetchFn: typeof fetch
  readonly #now: () => number
  readonly #openExternalUrl: (url: string) => Promise<void> | void

  constructor(options: CodexOAuthSessionOptions = {}) {
    this.#baseUrl = normalizeBaseUrl(
      options.baseUrl ||
        process.env.CCR_CODEX_OAUTH_BASE_URL ||
        DEFAULT_BASE_URL,
    )
    this.#authorizeUrl =
      options.authorizeUrl ||
      process.env.CCR_CODEX_OAUTH_AUTHORIZE_URL ||
      DEFAULT_AUTHORIZE_URL
    this.#tokenUrl =
      options.tokenUrl ||
      process.env.CCR_CODEX_OAUTH_TOKEN_URL ||
      DEFAULT_TOKEN_URL
    this.#redirectUri =
      options.redirectUri ||
      process.env.CCR_CODEX_OAUTH_REDIRECT_URI ||
      DEFAULT_REDIRECT_URI
    this.#scope =
      options.scope ||
      process.env.CCR_CODEX_OAUTH_SCOPE ||
      DEFAULT_SCOPE
    this.#clientId =
      options.clientId ||
      process.env.CCR_CODEX_OAUTH_CLIENT_ID ||
      DEFAULT_CLIENT_ID
    this.#jwtClaimPath = options.jwtClaimPath || DEFAULT_JWT_CLAIM_PATH
    this.#callbackHost = options.callbackHost || DEFAULT_CALLBACK_HOST
    this.#callbackPort = options.callbackPort || DEFAULT_CALLBACK_PORT
    this.#credentialFilePath =
      options.credentialFilePath ||
      process.env.CCR_CODEX_OAUTH_CREDENTIAL_FILE ||
      DEFAULT_CREDENTIAL_FILE
    this.#fetchFn = options.fetchFn || fetch
    this.#now = options.now || (() => Date.now())
    this.#openExternalUrl = options.openExternalUrl || openExternalUrl
  }

  get baseUrl(): string {
    return this.#baseUrl
  }

  get credentialFilePath(): string {
    return this.#credentialFilePath
  }

  async getAvailability(): Promise<CodexOAuthAvailability> {
    const credential = await this.loadCredential()
    if (!credential) {
      return {
        available: false,
        configured: false,
        reason: '未检测到 Codex OAuth 凭据。',
        details: {
          baseUrl: this.#baseUrl,
          source: credentialSourceFromEnv()
            ? 'env'
            : this.#credentialFilePath,
        },
      }
    }

    if (credential.expires && credential.expires <= this.#now() && !credential.refresh) {
      return {
        available: false,
        configured: true,
        reason: 'Codex OAuth access token 已过期，且没有 refresh token。',
        details: {
          baseUrl: this.#baseUrl,
          source: credentialSourceFromEnv()
            ? 'env'
            : this.#credentialFilePath,
          ...(credential.accountId ? { accountId: credential.accountId } : {}),
          expiresAt: credential.expires,
        },
      }
    }

    return {
      available: true,
      configured: true,
      reason: 'Codex OAuth 凭据可用。',
      details: {
        baseUrl: this.#baseUrl,
        source: credentialSourceFromEnv() ? 'env' : this.#credentialFilePath,
        ...(credential.accountId ? { accountId: credential.accountId } : {}),
        ...(credential.expires ? { expiresAt: credential.expires } : {}),
      },
    }
  }

  async loadCredential(): Promise<CodexOAuthCredential | null> {
    const fromEnv = loadCredentialFromEnv()
    if (fromEnv) {
      return fromEnv
    }

    try {
      const raw = await readFile(this.#credentialFilePath, 'utf8')
      const payload = JSON.parse(stripJsonBom(raw)) as {
        access?: string
        refresh?: string
        expires?: number
        accountId?: string
      }
      if (!payload.access || typeof payload.access !== 'string') {
        return null
      }
      return {
        access: payload.access,
        ...(typeof payload.refresh === 'string'
          ? { refresh: payload.refresh }
          : {}),
        ...(typeof payload.expires === 'number'
          ? { expires: payload.expires }
          : {}),
        ...(typeof payload.accountId === 'string'
          ? { accountId: payload.accountId }
          : {}),
      }
    } catch (error) {
      if (isMissingFile(error)) {
        return null
      }
      throw error
    }
  }

  async saveCredential(credential: CodexOAuthCredential): Promise<void> {
    await mkdir(dirname(this.#credentialFilePath), { recursive: true })
    await writeFile(
      this.#credentialFilePath,
      JSON.stringify(credential, null, 2),
      'utf8',
    )
  }

  async clearCredential(): Promise<void> {
    await rm(this.#credentialFilePath, { force: true })
  }

  async getValidCredential(): Promise<CodexOAuthCredential> {
    const credential = await this.loadCredential()
    if (!credential) {
      throw new Error(
        '未检测到 Codex OAuth 凭据。请先登录，或手动配置 CCR_CODEX_OAUTH_* 环境变量。',
      )
    }

    if (!needsRefresh(credential, this.#now())) {
      return credential
    }

    if (!credential.refresh) {
      throw new Error('Codex OAuth access token 即将过期，但当前没有可用的 refresh token。')
    }

    const refreshed = await this.refreshCredential(credential)
    if (!credentialSourceFromEnv()) {
      await this.saveCredential(refreshed)
    }
    return refreshed
  }

  async refreshCredential(
    credential: CodexOAuthCredential,
  ): Promise<CodexOAuthCredential> {
    if (!credential.refresh) {
      throw new Error('当前凭据不包含 refresh token，无法刷新。')
    }

    const response = await this.#fetchFn(this.#tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: credential.refresh,
        client_id: this.#clientId,
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(
        `Codex OAuth refresh 失败（${response.status}）：${body || 'empty response'}`,
      )
    }

    const payload = (await response.json()) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
    }

    if (!payload.access_token || typeof payload.expires_in !== 'number') {
      throw new Error('Codex OAuth refresh 返回了不完整凭据。')
    }

    return {
      access: payload.access_token,
      refresh:
        typeof payload.refresh_token === 'string'
          ? payload.refresh_token
          : credential.refresh,
      expires: this.#now() + payload.expires_in * 1000,
      accountId:
        extractAccountId(payload.access_token, this.#jwtClaimPath) ||
        credential.accountId,
    }
  }

  async beginAuthorization(): Promise<CodexAuthorizationFlow> {
    const verifier = base64urlEncode(randomBytes(32))
    const challenge = createHash('sha256')
      .update(verifier, 'utf8')
      .digest('base64url')
    const state = randomBytes(16).toString('hex')
    const url = new URL(this.#authorizeUrl)

    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', this.#clientId)
    url.searchParams.set('redirect_uri', this.#redirectUri)
    url.searchParams.set('scope', this.#scope)
    url.searchParams.set('code_challenge', challenge)
    url.searchParams.set('code_challenge_method', 'S256')
    url.searchParams.set('state', state)
    url.searchParams.set('id_token_add_organizations', 'true')
    url.searchParams.set('codex_cli_simplified_flow', 'true')
    url.searchParams.set('originator', 'pi')

    return {
      state,
      verifier,
      authorizationUrl: url.toString(),
    }
  }

  async exchangeAuthorizationCode(
    code: string,
    verifier: string,
  ): Promise<CodexOAuthCredential> {
    const response = await this.#fetchFn(this.#tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.#clientId,
        code,
        code_verifier: verifier,
        redirect_uri: this.#redirectUri,
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(
        `Codex OAuth 换取 token 失败（${response.status}）：${body || 'empty response'}`,
      )
    }

    const payload = (await response.json()) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
    }

    if (
      !payload.access_token ||
      typeof payload.refresh_token !== 'string' ||
      typeof payload.expires_in !== 'number'
    ) {
      throw new Error('Codex OAuth token exchange 返回了不完整凭据。')
    }

    const accountId = extractAccountId(payload.access_token, this.#jwtClaimPath)
    return {
      access: payload.access_token,
      refresh: payload.refresh_token,
      expires: this.#now() + payload.expires_in * 1000,
      ...(accountId ? { accountId } : {}),
    }
  }

  async loginWithBrowser(timeoutMs = 120_000): Promise<CodexOAuthCredential> {
    const authorization = await this.beginAuthorization()
    const callbackServer = await startLocalCallbackServer({
      expectedState: authorization.state,
      host: this.#callbackHost,
      port: this.#callbackPort,
    })

    try {
      await this.#openExternalUrl(authorization.authorizationUrl)
      const code = await callbackServer.waitForCode(timeoutMs)
      if (!code) {
        throw new Error('等待 Codex OAuth 回调超时，请改用手动粘贴 code 的方式。')
      }
      const credential = await this.exchangeAuthorizationCode(
        code,
        authorization.verifier,
      )
      await this.saveCredential(credential)
      return credential
    } finally {
      callbackServer.cancel()
      await callbackServer.close()
    }
  }
}

async function startLocalCallbackServer(input: {
  expectedState: string
  host: string
  port: number
}): Promise<CallbackServerController> {
  let authorizationCode: string | null = null
  let cancelled = false
  let closed = false
  const sockets = new Set<Socket>()

  const server = createServer((request, response) => {
    try {
      const url = new URL(
        request.url || '',
        `http://${input.host}:${input.port}`,
      )
      if (url.pathname !== '/auth/callback') {
        response.statusCode = 404
        response.end('Not found')
        return
      }

      if (url.searchParams.get('state') !== input.expectedState) {
        response.statusCode = 400
        response.end('State mismatch')
        return
      }

      const code = url.searchParams.get('code')
      if (!code) {
        response.statusCode = 400
        response.end('Missing authorization code')
        return
      }

      response.statusCode = 200
      response.setHeader('Content-Type', 'text/html; charset=utf-8')
      response.setHeader('Connection', 'close')
      response.shouldKeepAlive = false
      response.once('finish', () => {
        authorizationCode = code
      })
      response.end(
        '<!doctype html><title>Authentication successful</title><p>Authentication successful. Return to your terminal to continue.</p>',
      )
    } catch {
      response.statusCode = 500
      response.end('Internal error')
    }
  })

  server.on('connection', socket => {
    sockets.add(socket)
    socket.on('close', () => {
      sockets.delete(socket)
    })
  })

  const started = await new Promise<boolean>(resolve => {
    server.listen(input.port, input.host, () => resolve(true))
    server.once('error', () => resolve(false))
  })

  if (!started) {
    try {
      server.close()
    } catch {
      // ignore
    }
    throw new Error(`无法启动 Codex OAuth 本地回调服务：${input.host}:${input.port}`)
  }

  server.unref()

  return {
    async waitForCode(timeoutMs = 120_000) {
      const intervalMs = 100
      const maxIterations = Math.ceil(timeoutMs / intervalMs)
      for (let index = 0; index < maxIterations; index += 1) {
        if (authorizationCode) {
          return authorizationCode
        }
        if (cancelled) {
          return null
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs))
      }
      return null
    },
    cancel() {
      cancelled = true
    },
    async close() {
      if (closed) {
        return
      }
      closed = true
      try {
        server.closeAllConnections?.()
        server.closeIdleConnections?.()
        for (const socket of sockets) {
          socket.destroy()
        }
        await new Promise<void>(resolve => {
          server.close(() => resolve())
        })
      } catch {
        // ignore
      }
    },
  }
}

function loadCredentialFromEnv(): CodexOAuthCredential | null {
  const access = process.env.CCR_CODEX_OAUTH_ACCESS_TOKEN?.trim()
  if (!access) {
    return null
  }

  const refresh = process.env.CCR_CODEX_OAUTH_REFRESH_TOKEN?.trim()
  const expires = Number.parseInt(
    process.env.CCR_CODEX_OAUTH_EXPIRES_AT ?? '',
    10,
  )
  const accountId = process.env.CCR_CODEX_OAUTH_ACCOUNT_ID?.trim()

  return {
    access,
    ...(refresh ? { refresh } : {}),
    ...(Number.isFinite(expires) ? { expires } : {}),
    ...(accountId ? { accountId } : {}),
  }
}

function credentialSourceFromEnv(): boolean {
  return Boolean(process.env.CCR_CODEX_OAUTH_ACCESS_TOKEN?.trim())
}

function stripJsonBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value
}

function extractAccountId(
  accessToken: string,
  jwtClaimPath: string,
): string | null {
  try {
    const payload = accessToken.split('.')[1]
    if (!payload) {
      return null
    }
    const json = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as Record<string, unknown>
    const authClaims = json[jwtClaimPath]
    if (!authClaims || typeof authClaims !== 'object') {
      return null
    }
    const accountId = (authClaims as Record<string, unknown>)
      .chatgpt_account_id
    return typeof accountId === 'string' && accountId.length > 0
      ? accountId
      : null
  } catch {
    return null
  }
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/u, '')
}

function needsRefresh(credential: CodexOAuthCredential, now: number): boolean {
  return (
    typeof credential.expires === 'number' &&
    credential.expires <= now + REFRESH_WINDOW_MS
  )
}

function base64urlEncode(value: Uint8Array | Buffer): string {
  return Buffer.from(value).toString('base64url')
}

function isMissingFile(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT',
  )
}

async function openExternalUrl(url: string): Promise<void> {
  const launch = buildOpenExternalCommand(url)
  await new Promise<void>((resolve, reject) => {
    const child = spawn(launch.command, launch.args, {
      stdio: 'ignore',
      ...(launch.windowsVerbatimArguments
        ? { windowsVerbatimArguments: true }
        : {}),
    })
    child.once('error', reject)
    child.once('close', code => {
      if (typeof code === 'number' && code !== 0) {
        reject(new Error(`无法打开浏览器（exit ${code}）。`))
        return
      }
      resolve()
    })
  })
}

export function buildOpenExternalCommand(url: string): {
  command: string
  args: string[]
  windowsVerbatimArguments?: boolean
} {
  if (process.platform === 'win32') {
    return {
      command: 'cmd',
      args: ['/c', 'start', '""', `"${url}"`],
      windowsVerbatimArguments: true,
    }
  }

  if (process.platform === 'darwin') {
    return {
      command: 'open',
      args: [url],
    }
  }

  return {
    command: 'xdg-open',
    args: [url],
  }
}
