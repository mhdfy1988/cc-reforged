declare module 'google-auth-library' {
  export interface GoogleAuthOptions {
    projectId?: string
    scopes?: string[]
    credentials?: Record<string, unknown>
    keyFile?: string
  }

  export interface GoogleAuthClient {
    getAccessToken(): Promise<{
      token?: string | null
      res?: unknown
    }>
    getRequestHeaders(): Promise<Record<string, string>>
  }

  export class GoogleAuth {
    constructor(options?: GoogleAuthOptions)
    getClient(): Promise<GoogleAuthClient>
  }
}

declare module '@anthropic-ai/bedrock-sdk' {
  interface AnthropicClientTransportOptions {
    defaultHeaders?: Record<string, string>
    maxRetries?: number
    timeout?: number
    dangerouslyAllowBrowser?: boolean
    fetchOptions?: unknown
    fetch?: unknown
    logger?: unknown
  }

  export interface AnthropicBedrockOptions
    extends AnthropicClientTransportOptions {
    awsRegion?: string
    skipAuth?: boolean
    awsAccessKey?: string
    awsSecretKey?: string
    awsSessionToken?: string
  }

  export class AnthropicBedrock {
    constructor(options: AnthropicBedrockOptions)
  }
}

declare module '@anthropic-ai/foundry-sdk' {
  interface AnthropicClientTransportOptions {
    defaultHeaders?: Record<string, string>
    maxRetries?: number
    timeout?: number
    dangerouslyAllowBrowser?: boolean
    fetchOptions?: unknown
    fetch?: unknown
    logger?: unknown
  }

  export interface AnthropicFoundryOptions
    extends AnthropicClientTransportOptions {
    azureADTokenProvider?: () => Promise<string>
  }

  export class AnthropicFoundry {
    constructor(options: AnthropicFoundryOptions)
  }
}

declare module '@anthropic-ai/vertex-sdk' {
  interface AnthropicClientTransportOptions {
    defaultHeaders?: Record<string, string>
    maxRetries?: number
    timeout?: number
    dangerouslyAllowBrowser?: boolean
    fetchOptions?: unknown
    fetch?: unknown
    logger?: unknown
  }

  export interface AnthropicVertexOptions
    extends AnthropicClientTransportOptions {
    region: string
    googleAuth: unknown
  }

  export class AnthropicVertex {
    constructor(options: AnthropicVertexOptions)
  }
}

declare module '@azure/identity' {
  export class DefaultAzureCredential {
    constructor()
  }

  export function getBearerTokenProvider(
    credential: DefaultAzureCredential,
    scopes: string | string[],
  ): () => Promise<string>
}

declare module '@aws-sdk/client-bedrock' {
  export interface BedrockClientConfig {
    region: string
    endpoint?: string
    requestHandler?: import('@smithy/node-http-handler').NodeHttpHandler
    httpAuthSchemes?: Array<{
      schemeId: string
      identityProvider?: () => () => Promise<Record<string, unknown>>
      signer?: unknown
    }>
    httpAuthSchemeProvider?: () => Array<{ schemeId: string }>
    credentials?:
      | {
          accessKeyId: string
          secretAccessKey: string
          sessionToken?: string
        }
      | undefined
  }

  export class BedrockClient {
    constructor(config: BedrockClientConfig)
    send(command: unknown): Promise<{
      inferenceProfileSummaries?: Array<{ inferenceProfileId?: string }>
      nextToken?: string
      models?: Array<{ modelArn?: string }>
    }>
  }

  export class ListInferenceProfilesCommand {
    constructor(input: {
      nextToken?: string
      typeEquals: 'SYSTEM_DEFINED'
    })
  }

  export class GetInferenceProfileCommand {
    constructor(input: { inferenceProfileIdentifier: string })
  }
}

declare module '@aws-sdk/client-bedrock-runtime' {
  export interface BedrockRuntimeClientConfig {
    region: string
    endpoint?: string
    requestHandler?: import('@smithy/node-http-handler').NodeHttpHandler
    httpAuthSchemes?: Array<{
      schemeId: string
      identityProvider?: () => () => Promise<Record<string, unknown>>
      signer?: unknown
    }>
    httpAuthSchemeProvider?: () => Array<{ schemeId: string }>
    credentials?:
      | {
          accessKeyId: string
          secretAccessKey: string
          sessionToken?: string
        }
      | undefined
  }

  export class BedrockRuntimeClient {
    constructor(config: BedrockRuntimeClientConfig)
    send(command: unknown): Promise<{ inputTokens?: number }>
  }

  export interface CountTokensCommandInput {
    modelId: string
    input: {
      invokeModel: {
        body: Uint8Array
      }
    }
  }

  export class CountTokensCommand {
    constructor(input: CountTokensCommandInput)
  }
}

declare module '@aws-sdk/client-sts' {
  export class STSClient {
    constructor(config?: Record<string, unknown>)
    send(command: unknown): Promise<unknown>
  }

  export class GetCallerIdentityCommand {
    constructor(input: Record<string, unknown>)
  }
}

declare module '@aws-sdk/credential-providers' {
  export interface FromIniOptions {
    ignoreCache?: boolean
  }

  export function fromIni(
    options?: FromIniOptions,
  ): () => Promise<Record<string, unknown>>
}

declare module '@smithy/node-http-handler' {
  export class NodeHttpHandler {
    constructor(options?: Record<string, unknown>)
  }
}

declare module '@smithy/core' {
  export class NoAuthSigner {
    constructor()
  }
}

declare module 'xss' {
  const xss: (input: string) => string
  export default xss
}

declare module 'cli-highlight' {
  export type CliHighlightChalkStyle = {
    (codePart: string): string
    [styleName: string]: unknown
  }

  export type CliHighlightJsonStyle = string | readonly string[]

  export type CliHighlightStyle =
    | CliHighlightChalkStyle
    | CliHighlightJsonStyle

  export interface CliHighlightTheme {
    [token: string]: CliHighlightStyle | undefined
    default?: CliHighlightStyle
  }

  export interface CliHighlightOptions {
    language?: string
    ignoreIllegals?: boolean
    languageSubset?: readonly string[]
    theme?: CliHighlightTheme
  }

  export function highlight(code: string, options?: CliHighlightOptions): string
  export function supportsLanguage(language: string): boolean
}

declare module 'highlight.js' {
  export interface HighlightJsLanguage {
    name?: string
    aliases?: string[]
    [key: string]: unknown
  }

  export interface HighlightJsHighlightOptions {
    language: string
    ignoreIllegals?: boolean
  }

  export interface HighlightJsHighlightResult {
    value: string
    relevance: number
    illegal: boolean
    language?: string
    code?: string
    top?: unknown
    _emitter?: unknown
    emitter?: unknown
  }

  export interface HighlightJsApi {
    getLanguage(name: string): HighlightJsLanguage | undefined
    highlight(
      code: string,
      options: HighlightJsHighlightOptions,
    ): HighlightJsHighlightResult
  }

  const hljs: HighlightJsApi
  export default hljs
}

declare module 'sharp' {
  export interface SharpResizeOptions {
    fit?: 'inside'
    withoutEnlargement?: boolean
  }

  export interface SharpJpegOptions {
    quality?: number
  }

  export interface SharpInstance {
    resize(
      width: number,
      height: number,
      options?: SharpResizeOptions,
    ): SharpInstance
    jpeg(options?: SharpJpegOptions): SharpInstance
    toBuffer(): Promise<Buffer>
  }

  export interface SharpModule {
    (input: Buffer | Uint8Array): SharpInstance
  }

  const sharp: SharpModule
  export default sharp
}

declare module '@ant/computer-use-mcp/types' {
  export type CoordinateMode = 'pixels' | 'normalized'

  export interface CuGrantFlags {
    clipboardRead: boolean
    clipboardWrite: boolean
    systemKeyCombos: boolean
  }

  export interface CuSubGates {
    pixelValidation: boolean
    clipboardPasteMultiline: boolean
    mouseAnimation: boolean
    hideBeforeAction: boolean
    autoTargetDisplay: boolean
    clipboardGuard: boolean
  }

  export interface CuResolvedApp {
    bundleId: string
    displayName: string
    path?: string
  }

  export interface CuPermissionAppRequest {
    requestedName: string
    resolved?: CuResolvedApp
    alreadyGranted?: boolean
  }

  export interface CuPermissionRequest {
    apps: readonly CuPermissionAppRequest[]
    requestedFlags: CuGrantFlags
    reason?: string
    willHide?: readonly string[]
    tccState?: {
      accessibility: boolean
      screenRecording: boolean
    }
  }

  export interface CuPermissionResponse {
    granted: readonly Array<{
      bundleId: string
      displayName: string
      grantedAt: number
    }>
    denied: readonly Array<{
      bundleId: string
      reason: 'user_denied' | 'not_installed'
    }>
    flags: CuGrantFlags
  }

  export const DEFAULT_GRANT_FLAGS: CuGrantFlags

  export interface Logger {
    silly(message: string, ...args: unknown[]): void
    debug(message: string, ...args: unknown[]): void
    info(message: string, ...args: unknown[]): void
    warn(message: string, ...args: unknown[]): void
    error(message: string, ...args: unknown[]): void
  }

  export interface ComputerUseHostAdapter {
    serverName: string
    logger: Logger
    executor: import('@ant/computer-use-mcp').ComputerExecutor
    ensureOsPermissions(): Promise<
      | { granted: true }
      | { granted: false; accessibility: boolean; screenRecording: boolean }
    >
    isDisabled(): boolean
    getSubGates(): CuSubGates
    getAutoUnhideEnabled(): boolean
    cropRawPatch(...args: readonly unknown[]): Buffer | Uint8Array | null
  }
}

declare module '@ant/computer-use-mcp/sentinelApps' {
  export type SentinelCategory = 'shell' | 'filesystem' | 'system_settings'

  export function getSentinelCategory(
    bundleId: string,
  ): SentinelCategory | undefined
}

declare module '@ant/computer-use-mcp' {
  import type {
    ComputerUseHostAdapter,
    CoordinateMode,
    CuGrantFlags,
    CuPermissionRequest,
    CuPermissionResponse,
  } from '@ant/computer-use-mcp/types'

  export type {
    ComputerUseHostAdapter,
    CoordinateMode,
    CuGrantFlags,
    CuPermissionRequest,
    CuPermissionResponse,
  }

  export const DEFAULT_GRANT_FLAGS: CuGrantFlags

  export interface DisplayGeometry {
    width: number
    height: number
    scaleFactor: number
    displayId?: number
    originX?: number
    originY?: number
  }

  export interface FrontmostApp {
    bundleId: string
    displayName: string
  }

  export interface InstalledApp {
    bundleId: string
    displayName: string
    path: string
    iconDataUrl?: string
  }

  export interface RunningApp {
    bundleId: string
    displayName: string
  }

  export type ResolvePrepareCaptureResult = Readonly<Record<string, unknown>>

  export interface ScreenshotDims {
    width: number
    height: number
    displayWidth: number
    displayHeight: number
    displayId: number
    originX: number
    originY: number
  }

  export interface ScreenshotResult extends Partial<ScreenshotDims> {
    base64: string
    width: number
    height: number
  }

  export interface ComputerUseCapabilities {
    screenshotFiltering: string
    platform: string
    hostBundleId?: string
  }

  export interface ComputerExecutor {
    capabilities: ComputerUseCapabilities
    prepareForAction(
      allowlistBundleIds: string[],
      displayId?: number,
    ): Promise<string[]>
    previewHideSet(
      allowlistBundleIds: string[],
      displayId?: number,
    ): Promise<Array<{ bundleId: string; displayName: string }>>
    getDisplaySize(displayId?: number): Promise<DisplayGeometry>
    listDisplays(): Promise<DisplayGeometry[]>
    findWindowDisplays(
      bundleIds: string[],
    ): Promise<Array<{ bundleId: string; displayIds: number[] }>>
    resolvePrepareCapture(opts: {
      allowedBundleIds: string[]
      preferredDisplayId?: number
      autoResolve: boolean
      doHide?: boolean
    }): Promise<ResolvePrepareCaptureResult>
    screenshot(opts: {
      allowedBundleIds: string[]
      displayId?: number
    }): Promise<ScreenshotResult>
    zoom(
      regionLogical: { x: number; y: number; w: number; h: number },
      allowedBundleIds: string[],
      displayId?: number,
    ): Promise<{ base64: string; width: number; height: number }>
    key(keySequence: string, repeat?: number): Promise<void>
    holdKey(keyNames: string[], durationMs: number): Promise<void>
    type(text: string, opts: { viaClipboard: boolean }): Promise<void>
    readClipboard(): Promise<string>
    writeClipboard(text: string): Promise<void>
    moveMouse(x: number, y: number): Promise<void>
    click(
      x: number,
      y: number,
      button: 'left' | 'right' | 'middle',
      count: 1 | 2 | 3,
      modifiers?: string[],
    ): Promise<void>
    mouseDown(): Promise<void>
    mouseUp(): Promise<void>
    getCursorPosition(): Promise<{ x: number; y: number }>
    drag(
      from: { x: number; y: number } | undefined,
      to: { x: number; y: number },
    ): Promise<void>
    scroll(x: number, y: number, dx: number, dy: number): Promise<void>
    getFrontmostApp(): Promise<FrontmostApp | null>
    appUnderPoint(
      x: number,
      y: number,
    ): Promise<{ bundleId: string; displayName: string } | null>
    listInstalledApps(): Promise<InstalledApp[]>
    getAppIcon(path: string): Promise<string | undefined>
    listRunningApps(): Promise<RunningApp[]>
    openApp(bundleId: string): Promise<void>
  }

  export interface ComputerUseToolDefinition {
    name: string
    description?: string
    inputSchema?: unknown
  }

  export interface ComputerUseMcpServer {
    setRequestHandler(schema: unknown, handler: (...args: unknown[]) => unknown): void
    connect(transport: unknown): Promise<void>
    close(): Promise<void>
  }

  export interface ComputerUseSessionContext {
    getAllowedApps(): readonly Array<{
      bundleId: string
      displayName: string
      grantedAt: number
    }>
    getGrantFlags(): CuGrantFlags
    getUserDeniedBundleIds(): readonly string[]
    getSelectedDisplayId(): number | undefined
    getDisplayPinnedByModel(): boolean
    getDisplayResolvedForApps(): string | undefined
    getLastScreenshotDims(): ScreenshotDims | undefined
    onPermissionRequest(
      req: CuPermissionRequest,
      dialogSignal?: AbortSignal,
    ): Promise<CuPermissionResponse>
    onAllowedAppsChanged(
      apps: readonly Array<{
        bundleId: string
        displayName: string
        grantedAt: number
      }>,
      flags: CuGrantFlags,
    ): void
    onAppsHidden(ids: readonly string[]): void
    onResolvedDisplayUpdated(id: number | undefined): void
    onDisplayPinned(id: number | undefined): void
    onDisplayResolvedForApps(key: string | undefined): void
    onScreenshotCaptured(dims: ScreenshotDims): void
    checkCuLock(): Promise<{ holder: string | undefined; isSelf: boolean }>
    acquireCuLock(): Promise<void>
    formatLockHeldMessage(holder: string): string
  }

  export interface CuCallToolResult {
    content:
      | string
      | readonly Array<
          | { type: 'text'; text: string }
          | { type: 'image'; data: string; mimeType?: string }
          | { type: 'audio'; data?: string; mimeType?: string }
          | { type: 'resource'; uri?: string; mimeType?: string }
        >
    telemetry?: {
      error_kind?: string
      [key: string]: unknown
    }
  }

  export const API_RESIZE_PARAMS: Readonly<Record<string, number>>

  export function targetImageSize(
    width: number,
    height: number,
    params: Readonly<Record<string, number>>,
  ): [number, number]

  export function buildComputerUseTools(
    capabilities: ComputerUseCapabilities,
    coordinateMode: CoordinateMode,
    installedAppNames?: readonly string[],
  ): ComputerUseToolDefinition[]

  export function createComputerUseMcpServer(
    adapter: ComputerUseHostAdapter,
    coordinateMode: CoordinateMode,
  ): ComputerUseMcpServer

  export function bindSessionContext(
    adapter: ComputerUseHostAdapter,
    coordinateMode: CoordinateMode,
    ctx: ComputerUseSessionContext,
  ): (name: string, args: unknown) => Promise<CuCallToolResult>
}

declare module '@ant/computer-use-swift' {
  import type {
    DisplayGeometry,
    InstalledApp,
    ResolvePrepareCaptureResult,
    RunningApp,
    ScreenshotResult,
  } from '@ant/computer-use-mcp'

  export interface SwiftHotkeyAPI {
    registerEscape(onEscape: () => void): boolean
    unregister(): void
    notifyExpectedEscape(): void
  }

  export interface SwiftTccAPI {
    checkAccessibility(): boolean
    checkScreenRecording(): boolean
  }

  export interface SwiftDisplayAPI {
    getSize(displayId?: number): DisplayGeometry
    listAll(): Promise<DisplayGeometry[]>
  }

  export interface PrepareDisplayResult {
    hidden: string[]
    activated?: string
  }

  export interface SwiftAppsAPI {
    prepareDisplay(
      allowlistBundleIds: string[],
      hostBundleId: string,
      displayId?: number,
    ): Promise<PrepareDisplayResult>
    previewHideSet(
      allowlistBundleIds: string[],
      displayId?: number,
    ): Promise<Array<{ bundleId: string; displayName: string }>>
    findWindowDisplays(
      bundleIds: string[],
    ): Promise<Array<{ bundleId: string; displayIds: number[] }>>
    appUnderPoint(
      x: number,
      y: number,
    ): Promise<{ bundleId: string; displayName: string } | null>
    listInstalled(): Promise<InstalledApp[]>
    iconDataUrl(path: string): string | null
    listRunning(): Promise<RunningApp[]>
    open(bundleId: string): Promise<void>
    unhide(bundleIds: string[]): Promise<void>
  }

  export interface SwiftScreenshotAPI {
    captureExcluding(
      allowedBundleIds: string[],
      jpegQuality: number,
      width: number,
      height: number,
      displayId?: number,
    ): Promise<ScreenshotResult>
    captureRegion(
      allowedBundleIds: string[],
      x: number,
      y: number,
      width: number,
      height: number,
      outputWidth: number,
      outputHeight: number,
      jpegQuality: number,
      displayId?: number,
    ): Promise<{ base64: string; width: number; height: number }>
  }

  export interface ComputerUseAPI {
    _drainMainRunLoop(): void
    hotkey: SwiftHotkeyAPI
    tcc: SwiftTccAPI
    display: SwiftDisplayAPI
    apps: SwiftAppsAPI
    resolvePrepareCapture(
      allowedBundleIds: string[],
      hostBundleId: string,
      jpegQuality: number,
      width: number,
      height: number,
      preferredDisplayId?: number,
      autoResolve?: boolean,
      doHide?: boolean,
    ): Promise<ResolvePrepareCaptureResult>
    screenshot: SwiftScreenshotAPI
  }
}

declare module '@ant/computer-use-input' {
  export interface ComputerUseInputAPI {
    isSupported: true
    key(key: string, action: 'press' | 'release'): Promise<void>
    keys(keys: readonly string[]): Promise<void>
    moveMouse(x: number, y: number, animated: boolean): Promise<void>
    typeText(text: string): Promise<void>
    mouseButton(
      button: 'left' | 'right' | 'middle',
      action: 'click' | 'press' | 'release',
      count?: 1 | 2 | 3,
    ): Promise<void>
    mouseLocation(): Promise<{ x: number; y: number }>
    mouseScroll(amount: number, axis: 'vertical' | 'horizontal'): Promise<void>
    getFrontmostAppInfo():
      | {
          bundleId?: string | null
          appName: string
        }
      | null
  }

  export type ComputerUseInput =
    | ComputerUseInputAPI
    | {
        isSupported: false
      }
}

declare module 'https-proxy-agent' {
  import type { LookupOptions } from 'dns'
  import type { Agent as HttpAgent } from 'http'

  export interface HttpsProxyAgentOptions<T extends string = string> {
    cert?: string | Buffer
    key?: string | Buffer
    passphrase?: string
    ca?: string | string[] | Buffer
    lookup?: (
      hostname: string,
      options: LookupOptions,
      callback: (
        err: Error | null,
        address: string,
        family: 0 | 4 | 6,
      ) => void,
    ) => void
    headers?: Record<string, string>
    [key: string]: unknown
  }

  export class HttpsProxyAgent<T extends string = string> extends HttpAgent {
    constructor(proxy: T | URL, options?: HttpsProxyAgentOptions<T>)
  }
}

declare module 'undici' {
  export abstract class Dispatcher {}

  export interface TLSConnectionOptions {
    cert?: string | Buffer
    key?: string | Buffer
    passphrase?: string
    ca?: string | string[] | Buffer
  }

  export interface AgentOptions {
    connect?: TLSConnectionOptions
    connectTimeout?: number
    pipelining?: number
  }

  export class Agent extends Dispatcher {
    constructor(options?: AgentOptions)
  }

  export namespace EnvHttpProxyAgent {
    interface Options {
      httpProxy?: string
      httpsProxy?: string
      noProxy?: string
      connect?: TLSConnectionOptions
      connectTimeout?: number
      requestTls?: TLSConnectionOptions
    }
  }

  export class EnvHttpProxyAgent extends Dispatcher {
    constructor(options?: EnvHttpProxyAgent.Options)
  }

  export function setGlobalDispatcher(dispatcher: Dispatcher): void
}

declare module '@aws-sdk/credential-provider-node' {
  export interface DefaultProviderOptions {
    clientConfig?: {
      requestHandler?: import('@smithy/node-http-handler').NodeHttpHandler
    }
  }

  export function defaultProvider(
    options?: DefaultProviderOptions,
  ): () => Promise<Record<string, unknown>>
}

declare module 'type-fest' {
  export type Except<
    ObjectType,
    KeysType extends keyof ObjectType,
  > = Pick<ObjectType, Exclude<keyof ObjectType, KeysType>>

  export type IsEqual<A, B> =
    (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
      ? (<T>() => T extends B ? 1 : 2) extends <T>() => T extends A ? 1 : 2
        ? true
        : false
      : false
}

declare module '@anthropic-ai/mcpb' {
  export interface McpbUserConfigurationOption {
    type: 'string' | 'number' | 'boolean' | 'file' | 'directory'
    title?: string
    required?: boolean
    multiple?: boolean
    min?: number
    max?: number
    [key: string]: unknown
  }

  export interface McpbManifest {
    name: string
    author: {
      name: string
      [key: string]: unknown
    }
    user_config?: Record<string, McpbUserConfigurationOption>
    [key: string]: unknown
  }

  export interface McpbManifestFlattenedError {
    fieldErrors: Record<string, string[] | undefined>
    formErrors: string[]
  }

  export interface McpbManifestParseError {
    flatten(): McpbManifestFlattenedError
  }

  export type McpbManifestSafeParseResult =
    | {
        success: true
        data: McpbManifest
      }
    | {
        success: false
        error: McpbManifestParseError
      }

  export const McpbManifestSchema: {
    safeParse(input: unknown): McpbManifestSafeParseResult
  }

  export function getMcpConfigForManifest(params: {
    manifest: McpbManifest
    extensionPath: string
    systemDirs: unknown
    userConfig?: Record<string, string | number | boolean | string[]>
    pathSeparator: string
  }): Promise<import('../services/mcp/types.js').McpServerConfig | null>
}

declare module 'audio-capture-napi' {
  export function isNativeAudioAvailable(): boolean
  export function isNativeRecordingActive(): boolean
  export function startNativeRecording(
    onData: (data: Buffer) => void,
    onEnd: () => void,
  ): boolean
  export function stopNativeRecording(): void
}

declare module 'turndown' {
  class TurndownService {
    constructor(options?: unknown)
    turndown(input: string): string
  }

  export = TurndownService
}

declare module 'image-processor-napi' {
  type SharpInstance = {
    metadata(): Promise<{ width: number; height: number; format: string }>
    resize(
      width: number,
      height: number,
      options?: { fit?: string; withoutEnlargement?: boolean },
    ): SharpInstance
    jpeg(options?: { quality?: number }): SharpInstance
    png(options?: {
      compressionLevel?: number
      palette?: boolean
      colors?: number
    }): SharpInstance
    webp(options?: { quality?: number }): SharpInstance
    toBuffer(): Promise<Buffer>
  }

  type SharpFunction = (input: Buffer) => SharpInstance

  export interface NativeClipboardImage {
    png: Buffer
    width: number
    height: number
    originalWidth: number
    originalHeight: number
  }

  export interface NativeClipboardModule {
    hasClipboardImage?(): boolean
    readClipboardImage?(
      maxWidth: number,
      maxHeight: number,
    ): NativeClipboardImage | null
  }

  export function getNativeModule(): NativeClipboardModule | null
  export const sharp: SharpFunction

  const defaultExport: SharpFunction
  export default defaultExport
}

declare module 'url-handler-napi' {
  export function waitForUrlEvent(timeoutMs: number): string | null
}

declare module '@ant/claude-for-chrome-mcp' {
  export type PermissionMode =
    | 'ask'
    | 'skip_all_permission_checks'
    | 'follow_a_plan'

  export interface Logger {
    silly(message: string, ...args: unknown[]): void
    debug(message: string, ...args: unknown[]): void
    info(message: string, ...args: unknown[]): void
    warn(message: string, ...args: unknown[]): void
    error(message: string, ...args: unknown[]): void
  }

  export interface BrowserTool {
    name: string
    [key: string]: unknown
  }

  export interface ClaudeForChromeContext {
    serverName: string
    logger: Logger
    socketPath: string
    getSocketPaths: () => string[]
    clientTypeId: string
    onAuthenticationError?: () => void
    onToolCallDisconnected?: () => string
    onExtensionPaired?: (deviceId: string, name: string) => void
    getPersistedDeviceId?: () => string | undefined
    bridgeConfig?: {
      url: string
      getUserId?: () => Promise<string | undefined>
      getOAuthToken?: () => Promise<string>
      devUserId?: string
      [key: string]: unknown
    }
    initialPermissionMode?: PermissionMode
    callAnthropicMessages?: (req: {
      model: string
      max_tokens: number
      system: string
      messages: unknown[]
      stop_sequences?: string[]
      signal?: AbortSignal
    }) => Promise<{
      content: Array<{ type: 'text'; text: string }>
      stop_reason: string | null
      usage?: { input_tokens: number; output_tokens: number }
    }>
    trackEvent?: (
      eventName: string,
      metadata?: Record<string, string | number | boolean | undefined>,
    ) => void
    [key: string]: unknown
  }

  export interface ClaudeForChromeMcpServer {
    connect(transport: unknown): Promise<void>
    close(): Promise<void>
  }

  export const BROWSER_TOOLS: ReadonlyArray<BrowserTool>

  export function createClaudeForChromeMcpServer(
    context: ClaudeForChromeContext,
  ): ClaudeForChromeMcpServer
}
