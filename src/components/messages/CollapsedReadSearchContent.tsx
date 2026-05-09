import { c as _c } from "react/compiler-runtime";
import { createRequire } from 'node:module';
import { feature } from 'bun:bundle';
import { basename } from 'path';
import React, { useRef } from 'react';
import { useMinDisplayTime } from '../../hooks/useMinDisplayTime.js';
import { Ansi, Box, Text, useTheme } from '../../ink.js';
import { findToolByName, type Tools } from '../../Tool.js';
import { getReplPrimitiveTools } from '../../tools/REPLTool/primitiveTools.js';
import type { CollapsedReadSearchGroup } from '../../types/message.js';
import { uniq } from '../../utils/array.js';
import { getDisplayPath } from '../../utils/file.js';
import { formatDuration, formatSecondsShort } from '../../utils/format.js';
import { isFullscreenEnvEnabled } from '../../utils/fullscreen.js';
import type { buildMessageLookups } from '../../utils/messages.js';
import type { ThemeName } from '../../utils/theme.js';
import { CtrlOToExpand } from '../CtrlOToExpand.js';
import { useSelectedMessageBg } from '../messageActions.js';
import { PrBadge } from '../PrBadge.js';
import { ToolUseLoader } from '../ToolUseLoader.js';

const require = createRequire(import.meta.url);

/* eslint-disable @typescript-eslint/no-require-imports */
const teamMemCollapsed = feature('TEAMMEM') ? require('./teamMemCollapsed.js') as typeof import('./teamMemCollapsed.js') : null;
/* eslint-enable @typescript-eslint/no-require-imports */

// Hold each ⤿ hint for a minimum duration so fast-completing tool calls
// (bash commands, file reads, search patterns) are actually readable instead
// of flickering past in a single frame.
const MIN_HINT_DISPLAY_MS = 700;
type Props = {
  message: CollapsedReadSearchGroup;
  inProgressToolUseIDs: Set<string>;
  shouldAnimate: boolean;
  verbose: boolean;
  tools: Tools;
  lookups: ReturnType<typeof buildMessageLookups>;
  /** True if this is the currently active collapsed group (last one, still loading) */
  isActiveGroup?: boolean;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

type CountState = {
  value: number;
  isRecovered: boolean;
};

function toNonNegativeCountState(value: unknown): CountState {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? {
    value,
    isRecovered: true
  } : {
    value: 0,
    isRecovered: false
  };
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function toStringArrayOrNull(value: unknown): string[] | null {
  return Array.isArray(value) && value.every(item => typeof item === 'string') ? value : null;
}

type ReplToolCallStartProgress = {
  type: 'repl_tool_call';
  phase: 'start';
  toolInput?: {
    command?: string;
    pattern?: string;
    file_path?: string;
  };
  toolName?: string;
};

function isReplToolCallStartProgress(value: unknown): value is ReplToolCallStartProgress {
  if (!isObjectRecord(value) || value.type !== 'repl_tool_call' || value.phase !== 'start') {
    return false;
  }
  if (value.toolName !== undefined && typeof value.toolName !== 'string') {
    return false;
  }
  if (value.toolInput === undefined) {
    return true;
  }
  return isObjectRecord(value.toolInput) && (value.toolInput.command === undefined || typeof value.toolInput.command === 'string') && (value.toolInput.pattern === undefined || typeof value.toolInput.pattern === 'string') && (value.toolInput.file_path === undefined || typeof value.toolInput.file_path === 'string');
}

type HookInfoView = {
  command: string;
  durationMs?: number;
};

function toHookInfoArray(value: unknown): HookInfoView[] | null {
  return Array.isArray(value) && value.every(info => isObjectRecord(info) && typeof info.command === 'string' && (info.durationMs === undefined || typeof info.durationMs === 'number')) ? value : null;
}

type RelevantMemoryView = {
  path: string;
  content: string;
};

function toRelevantMemoryArray(value: unknown): RelevantMemoryView[] | null {
  return Array.isArray(value) && value.every(memory => isObjectRecord(memory) && typeof memory.path === 'string' && typeof memory.content === 'string') ? value : null;
}

type AssistantFirstContentView = Record<string, unknown> & {
  type: string;
};

type ToolUseContentView = {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
};

type ConsumableAssistantMessageView = {
  type: 'assistant';
  message: {
    content: [AssistantFirstContentView, ...unknown[]];
  };
};

type ConsumableGroupedToolUseMessageView = {
  type: 'grouped_tool_use';
  messages: ConsumableAssistantMessageView[];
};

type ConsumableCollapsedMessageView = ConsumableAssistantMessageView | ConsumableGroupedToolUseMessageView;

function isAssistantFirstContentView(value: unknown): value is AssistantFirstContentView {
  return isObjectRecord(value) && typeof value.type === 'string';
}

function isToolUseContentView(value: unknown): value is ToolUseContentView {
  return isObjectRecord(value) && value.type === 'tool_use' && typeof value.id === 'string' && typeof value.name === 'string' && 'input' in value && value.input !== undefined;
}

function isConsumableAssistantMessageView(value: unknown): value is ConsumableAssistantMessageView {
  return isObjectRecord(value) && value.type === 'assistant' && isObjectRecord(value.message) && Array.isArray(value.message.content) && value.message.content.length > 0 && isAssistantFirstContentView(value.message.content[0]);
}

function isConsumableCollapsedMessage(value: unknown): value is ConsumableCollapsedMessageView {
  if (isConsumableAssistantMessageView(value)) {
    return true;
  }
  return isObjectRecord(value) && value.type === 'grouped_tool_use' && Array.isArray(value.messages) && value.messages.every(isConsumableAssistantMessageView);
}

function toNormalizedAssistantMessages(value: unknown): ConsumableCollapsedMessageView[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.filter(isConsumableCollapsedMessage);
}

function getToolUseIdsFromCollapsedMessages(messages: ConsumableCollapsedMessageView[] | null): string[] {
  if (messages === null) {
    return [];
  }
  const ids: string[] = [];
  for (const message of messages) {
    if (message.type === 'assistant') {
      const content = message.message.content[0];
      if (isToolUseContentView(content)) {
        ids.push(content.id);
      }
      continue;
    }
    for (const groupedMessage of message.messages) {
      const content = groupedMessage.message.content[0];
      if (isToolUseContentView(content)) {
        ids.push(content.id);
      }
    }
  }
  return ids;
}

type ShellProgressData = {
  type: 'bash_progress' | 'powershell_progress';
  elapsedTimeSeconds: number;
  totalLines: number;
};

function isShellProgressData(value: unknown): value is ShellProgressData {
  return isObjectRecord(value) && (value.type === 'bash_progress' || value.type === 'powershell_progress') && typeof value.elapsedTimeSeconds === 'number' && typeof value.totalLines === 'number';
}

type CommitView = {
  kind: 'committed' | 'amended' | 'cherry-picked';
  sha: string;
};

function toCommitArray(value: unknown): CommitView[] | null {
  return Array.isArray(value) && value.every(commit => isObjectRecord(commit) && (commit.kind === 'committed' || commit.kind === 'amended' || commit.kind === 'cherry-picked') && typeof commit.sha === 'string') ? value : null;
}

type PushView = {
  branch: string;
};

function toPushArray(value: unknown): PushView[] | null {
  return Array.isArray(value) && value.every(push => isObjectRecord(push) && typeof push.branch === 'string') ? value : null;
}

type BranchView = {
  action: 'merged' | 'rebased';
  ref: string;
};

function toBranchArray(value: unknown): BranchView[] | null {
  return Array.isArray(value) && value.every(branch => isObjectRecord(branch) && (branch.action === 'merged' || branch.action === 'rebased') && typeof branch.ref === 'string') ? value : null;
}

type PullRequestView = {
  action: 'created' | 'edited' | 'merged' | 'commented' | 'closed' | 'ready';
  number: number;
  url?: string;
};

function toPullRequestArray(value: unknown): PullRequestView[] | null {
  return Array.isArray(value) && value.every(pr => isObjectRecord(pr) && (pr.action === 'created' || pr.action === 'edited' || pr.action === 'merged' || pr.action === 'commented' || pr.action === 'closed' || pr.action === 'ready') && typeof pr.number === 'number' && (pr.url === undefined || typeof pr.url === 'string')) ? value : null;
}

/** Render a single tool use in verbose mode */
function VerboseToolUse(t0) {
  const $ = _c(24);
  const {
    content,
    tools,
    lookups,
    inProgressToolUseIDs,
    shouldAnimate,
    theme
  } = t0;
  const bg = useSelectedMessageBg();
  let t1;
  let t2;
  if ($[0] !== bg || $[1] !== content.id || $[2] !== content.input || $[3] !== content.name || $[4] !== inProgressToolUseIDs || $[5] !== lookups || $[6] !== shouldAnimate || $[7] !== theme || $[8] !== tools) {
    t2 = Symbol.for("react.early_return_sentinel");
    bb0: {
      const tool = findToolByName(tools, content.name) ?? findToolByName(getReplPrimitiveTools(), content.name);
      if (!tool) {
        t2 = null;
        break bb0;
      }
      let t3;
      if ($[11] !== content.id || $[12] !== lookups.resolvedToolUseIDs) {
        t3 = lookups.resolvedToolUseIDs.has(content.id);
        $[11] = content.id;
        $[12] = lookups.resolvedToolUseIDs;
        $[13] = t3;
      } else {
        t3 = $[13];
      }
      const isResolved = t3;
      let t4;
      if ($[14] !== content.id || $[15] !== lookups.erroredToolUseIDs) {
        t4 = lookups.erroredToolUseIDs.has(content.id);
        $[14] = content.id;
        $[15] = lookups.erroredToolUseIDs;
        $[16] = t4;
      } else {
        t4 = $[16];
      }
      const isError = t4;
      let t5;
      if ($[17] !== content.id || $[18] !== inProgressToolUseIDs) {
        t5 = inProgressToolUseIDs.has(content.id);
        $[17] = content.id;
        $[18] = inProgressToolUseIDs;
        $[19] = t5;
      } else {
        t5 = $[19];
      }
      const isInProgress = t5;
      const resultMsg = lookups.toolResultByToolUseID.get(content.id);
      const rawToolResult = resultMsg?.type === "user" ? resultMsg.toolUseResult : undefined;
      const parsedOutput = tool.outputSchema?.safeParse(rawToolResult);
      const toolResult = parsedOutput?.success ? parsedOutput.data : undefined;
      const parsedInput = tool.inputSchema.safeParse(content.input);
      const input = parsedInput.success ? parsedInput.data : undefined;
      const userFacingName = tool.userFacingName(input);
      const toolUseMessage = input ? tool.renderToolUseMessage(input, {
        theme,
        verbose: true
      }) : null;
      const t6 = shouldAnimate && isInProgress;
      const t7 = !isResolved;
      let t8;
      if ($[20] !== isError || $[21] !== t6 || $[22] !== t7) {
        t8 = <ToolUseLoader shouldAnimate={t6} isUnresolved={t7} isError={isError} />;
        $[20] = isError;
        $[21] = t6;
        $[22] = t7;
        $[23] = t8;
      } else {
        t8 = $[23];
      }
      t1 = <Box key={content.id} flexDirection="column" marginTop={1} backgroundColor={bg}><Box flexDirection="row">{t8}<Text><Text bold={true}>{userFacingName}</Text>{toolUseMessage && <Text>({toolUseMessage})</Text>}</Text>{input && tool.renderToolUseTag?.(input)}</Box>{isResolved && !isError && toolResult !== undefined && <Box>{tool.renderToolResultMessage?.(toolResult, [], {
            verbose: true,
            tools,
            theme
          })}</Box>}</Box>;
    }
    $[0] = bg;
    $[1] = content.id;
    $[2] = content.input;
    $[3] = content.name;
    $[4] = inProgressToolUseIDs;
    $[5] = lookups;
    $[6] = shouldAnimate;
    $[7] = theme;
    $[8] = tools;
    $[9] = t1;
    $[10] = t2;
  } else {
    t1 = $[9];
    t2 = $[10];
  }
  if (t2 !== Symbol.for("react.early_return_sentinel")) {
    return t2;
  }
  return t1;
}
export function CollapsedReadSearchContent({
  message,
  inProgressToolUseIDs,
  shouldAnimate,
  verbose,
  tools,
  lookups,
  isActiveGroup
}: Props): React.ReactNode {
  const bg = useSelectedMessageBg();
  const {
    searchCount: rawSearchCount,
    readCount: rawReadCount,
    listCount: rawListCount,
    replCount,
    memorySearchCount,
    memoryReadCount,
    memoryWriteCount,
    messages: groupMessages
  } = message;
  const [theme] = useTheme();
  const collapsedMessages = toNormalizedAssistantMessages(groupMessages);
  const toolUseIds = getToolUseIdsFromCollapsedMessages(collapsedMessages);
  const anyError = toolUseIds.some(id => lookups.erroredToolUseIDs.has(id));
  const readCountState = toNonNegativeCountState(rawReadCount);
  const searchCountState = toNonNegativeCountState(rawSearchCount);
  const listCountState = toNonNegativeCountState(rawListCount);
  const replCountState = toNonNegativeCountState(replCount);
  const memorySearchCountState = toNonNegativeCountState(memorySearchCount);
  const memoryReadCountState = toNonNegativeCountState(memoryReadCount);
  const memoryWriteCountState = toNonNegativeCountState(memoryWriteCount);
  const mcpCallCountState = toNonNegativeCountState(message.mcpCallCount);
  const bashCountState = toNonNegativeCountState(message.bashCount);
  const gitOpBashCountState = toNonNegativeCountState(message.gitOpBashCount);
  const hookTotalMsState = toNonNegativeCountState(message.hookTotalMs);
  const readPaths = toStringArrayOrNull(message.readFilePaths);
  const searchArgs = toStringArrayOrNull(message.searchArgs);
  const hookInfos = toHookInfoArray(message.hookInfos);
  const relevantMemories = toRelevantMemoryArray(message.relevantMemories);
  const commits = toCommitArray(message.commits);
  const pushes = toPushArray(message.pushes);
  const branches = toBranchArray(message.branches);
  const prs = toPullRequestArray(message.prs);
  const mcpServerNames = toStringArrayOrNull(message.mcpServerNames);
  const hasMemoryOps = !memorySearchCountState.isRecovered || !memoryReadCountState.isRecovered || !memoryWriteCountState.isRecovered || memorySearchCountState.value > 0 || memoryReadCountState.value > 0 || memoryWriteCountState.value > 0;
  const hasTeamMemoryOps = feature('TEAMMEM') ? teamMemCollapsed!.checkHasTeamMemOps(message) : false;

  // Track the max seen counts so they only ever increase. The debounce timer
  // causes extra re-renders at arbitrary times; during a brief "invisible window"
  // in the streaming executor the group count can dip, which causes jitter.
  const maxReadCountRef = useRef(0);
  const maxSearchCountRef = useRef(0);
  const maxListCountRef = useRef(0);
  const maxMcpCountRef = useRef(0);
  const maxBashCountRef = useRef(0);
  maxReadCountRef.current = Math.max(maxReadCountRef.current, readCountState.value);
  maxSearchCountRef.current = Math.max(maxSearchCountRef.current, searchCountState.value);
  maxListCountRef.current = Math.max(maxListCountRef.current, listCountState.value);
  maxMcpCountRef.current = Math.max(maxMcpCountRef.current, mcpCallCountState.value);
  maxBashCountRef.current = Math.max(maxBashCountRef.current, bashCountState.value);
  const readCount = maxReadCountRef.current;
  const searchCount = maxSearchCountRef.current;
  const listCount = maxListCountRef.current;
  const mcpCallCount = maxMcpCountRef.current;
  // Subtract commands surfaced as "Committed …" / "Created PR …" so the
  // same command isn't counted twice. gitOpBashCount is read live (no max-ref
  // needed — it's 0 until results arrive, then only grows).
  const gitOpBashCount = gitOpBashCountState.value;
  const bashCount = isFullscreenEnvEnabled() ? Math.max(0, maxBashCountRef.current - gitOpBashCount) : 0;
  const hasNonMemoryOps = !readCountState.isRecovered || !searchCountState.isRecovered || !listCountState.isRecovered || !replCountState.isRecovered || !mcpCallCountState.isRecovered || !bashCountState.isRecovered || !gitOpBashCountState.isRecovered || searchCount > 0 || readCount > 0 || listCount > 0 || replCountState.value > 0 || mcpCallCount > 0 || bashCount > 0 || gitOpBashCount > 0;
  let incomingHint = toOptionalString(message.latestDisplayHint);
  if (incomingHint === undefined) {
    const lastSearchRaw = searchArgs?.at(-1);
    const lastSearch = lastSearchRaw !== undefined ? `"${lastSearchRaw}"` : undefined;
    const lastRead = readPaths?.at(-1);
    incomingHint = lastRead !== undefined ? getDisplayPath(lastRead) : lastSearch;
  }

  // Active REPL calls emit repl_tool_call progress with the current inner
  // tool's name+input. Virtual messages don't arrive until REPL completes,
  // so this is the only source of a live hint during execution.
  if (isActiveGroup) {
    for (const id_0 of toolUseIds) {
      if (!inProgressToolUseIDs.has(id_0)) continue;
      const latest = lookups.progressMessagesByToolUseID.get(id_0)?.at(-1)?.data;
      if (isReplToolCallStartProgress(latest)) {
        const input = latest.toolInput;
        incomingHint = input?.file_path ?? (input?.pattern ? `"${input.pattern}"` : undefined) ?? input?.command ?? latest.toolName;
      }
    }
  }
  const displayedHint = useMinDisplayTime(incomingHint, MIN_HINT_DISPLAY_MS);

  // In verbose mode, render each tool use with its 1-line result summary
  if (verbose) {
    const toolUses: ConsumableAssistantMessageView[] = [];
    for (const msg of collapsedMessages ?? []) {
      if (msg.type === 'assistant') {
        toolUses.push(msg);
      } else if (msg.type === 'grouped_tool_use') {
        toolUses.push(...msg.messages);
      }
    }
    return <Box flexDirection="column">
        {toolUses.map(msg_0 => {
        const content = msg_0.message.content[0];
        if (!isToolUseContentView(content)) return null;
        return <VerboseToolUse key={content.id} content={content} tools={tools} lookups={lookups} inProgressToolUseIDs={inProgressToolUseIDs} shouldAnimate={shouldAnimate} theme={theme} />;
      })}
        {hookInfos !== null && hookInfos.length > 0 && <>
            <Text dimColor>
              {'  ⎿  '}Ran {message.hookCount} PreToolUse{' '}
              {message.hookCount === 1 ? 'hook' : 'hooks'} (
              {formatSecondsShort(toNonNegativeCountState(message.hookTotalMs).value)})
            </Text>
            {hookInfos.map((info, idx) => <Text key={`hook-${idx}`} dimColor>
                {'     ⎿ '}
                {info.command} ({formatSecondsShort(info.durationMs ?? 0)})
              </Text>)}
          </>}
        {relevantMemories !== null && relevantMemories.map(m => <Box key={m.path} flexDirection="column" marginTop={1}>
            <Text dimColor>
              {'  ⎿  '}Recalled {basename(m.path)}
            </Text>
            <Box paddingLeft={5}>
              <Text>
                <Ansi>{m.content}</Ansi>
              </Text>
            </Box>
          </Box>)}
      </Box>;
  }

  // Non-verbose mode: Show counts with blinking grey dot while active, green dot when finalized
  // Use present tense when active, past tense when finalized

  // Defensive: If all counts are 0, don't render the collapsed group
  // This shouldn't happen in normal operation, but handles edge cases
  if (!hasMemoryOps && !hasTeamMemoryOps && !hasNonMemoryOps) {
    return null;
  }

  // Find the slowest in-progress shell command in this group. BashTool yields
  // progress every second but the collapsed renderer never showed it — long
  // commands (npm install, tests) looked frozen. Shown after 2s so fast
  // commands stay clean; the ticking counter reassures that slow ones aren't stuck.
  let shellProgressSuffix = '';
  if (isFullscreenEnvEnabled() && isActiveGroup) {
    let elapsed: number | undefined;
    let lines = 0;
    for (const id_1 of toolUseIds) {
      if (!inProgressToolUseIDs.has(id_1)) continue;
      const data = lookups.progressMessagesByToolUseID.get(id_1)?.at(-1)?.data;
      if (!isShellProgressData(data)) {
        continue;
      }
      if (elapsed === undefined || data.elapsedTimeSeconds > elapsed) {
        elapsed = data.elapsedTimeSeconds;
        lines = data.totalLines;
      }
    }
    if (elapsed !== undefined && elapsed >= 2) {
      const time = formatDuration(elapsed * 1000);
      shellProgressSuffix = lines > 0 ? ` (${time} · ${lines} ${lines === 1 ? 'line' : 'lines'})` : ` (${time})`;
    }
  }

  // Build non-memory parts first (search, read, repl, mcp, bash) — these render
  // before memory so the line reads "Ran 3 bash commands, recalled 1 memory".
  const nonMemParts: React.ReactNode[] = [];

  // Git operations lead the line — they're the load-bearing outcome.
  function pushPart(key: string, verb: string, body: React.ReactNode): void {
    const isFirst = nonMemParts.length === 0;
    if (!isFirst) nonMemParts.push(<Text key={`comma-${key}`}>, </Text>);
    nonMemParts.push(<Text key={key}>
        {isFirst ? verb[0]!.toUpperCase() + verb.slice(1) : verb} {body}
      </Text>);
  }
  if (isFullscreenEnvEnabled() && commits !== null && commits.length > 0) {
    const byKind = {
      committed: 'committed',
      amended: 'amended commit',
      'cherry-picked': 'cherry-picked'
    };
    for (const kind of ['committed', 'amended', 'cherry-picked'] as const) {
      const shas = commits.filter(c => c.kind === kind).map(c_0 => c_0.sha);
      if (shas.length) {
        pushPart(kind, byKind[kind], <Text bold>{shas.join(', ')}</Text>);
      }
    }
  }
  if (isFullscreenEnvEnabled() && pushes !== null && pushes.length > 0) {
    const pushBranches = uniq(pushes.map(p => p.branch));
    pushPart('push', 'pushed to', <Text bold>{pushBranches.join(', ')}</Text>);
  }
  if (isFullscreenEnvEnabled() && branches !== null && branches.length > 0) {
    const byAction = {
      merged: 'merged',
      rebased: 'rebased onto'
    };
    for (const b of branches) {
      pushPart(`br-${b.action}-${b.ref}`, byAction[b.action], <Text bold>{b.ref}</Text>);
    }
  }
  if (isFullscreenEnvEnabled() && prs !== null && prs.length > 0) {
    const verbs = {
      created: 'created',
      edited: 'edited',
      merged: 'merged',
      commented: 'commented on',
      closed: 'closed',
      ready: 'marked ready'
    };
    for (const pr of prs) {
      pushPart(`pr-${pr.action}-${pr.number}`, verbs[pr.action], pr.url ? <PrBadge number={pr.number} url={pr.url} bold /> : <Text bold>PR #{pr.number}</Text>);
    }
  }
  if (searchCount > 0) {
    const isFirst_0 = nonMemParts.length === 0;
    const searchVerb = isActiveGroup ? isFirst_0 ? 'Searching for' : 'searching for' : isFirst_0 ? 'Searched for' : 'searched for';
    if (!isFirst_0) {
      nonMemParts.push(<Text key="comma-s">, </Text>);
    }
    nonMemParts.push(<Text key="search">
        {searchVerb} <Text bold>{searchCount}</Text>{' '}
        {searchCount === 1 ? 'pattern' : 'patterns'}
      </Text>);
  }
  if (readCount > 0) {
    const isFirst_1 = nonMemParts.length === 0;
    const readVerb = isActiveGroup ? isFirst_1 ? 'Reading' : 'reading' : isFirst_1 ? 'Read' : 'read';
    if (!isFirst_1) {
      nonMemParts.push(<Text key="comma-r">, </Text>);
    }
    nonMemParts.push(<Text key="read">
        {readVerb} <Text bold>{readCount}</Text>{' '}
        {readCount === 1 ? 'file' : 'files'}
      </Text>);
  }
  if (listCount > 0) {
    const isFirst_2 = nonMemParts.length === 0;
    const listVerb = isActiveGroup ? isFirst_2 ? 'Listing' : 'listing' : isFirst_2 ? 'Listed' : 'listed';
    if (!isFirst_2) {
      nonMemParts.push(<Text key="comma-l">, </Text>);
    }
    nonMemParts.push(<Text key="list">
        {listVerb} <Text bold>{listCount}</Text>{' '}
        {listCount === 1 ? 'directory' : 'directories'}
      </Text>);
  }
  if (!replCountState.isRecovered || replCountState.value > 0) {
    const replVerb = isActiveGroup ? "REPL'ing" : "REPL'd";
    if (nonMemParts.length > 0) {
      nonMemParts.push(<Text key="comma-repl">, </Text>);
    }
    nonMemParts.push(replCountState.isRecovered ? <Text key="repl">
        {replVerb} <Text bold>{replCountState.value}</Text>{' '}
        {replCountState.value === 1 ? 'time' : 'times'}
      </Text> : <Text key="repl-unavailable">
        {replVerb} REPL activity unavailable
      </Text>);
  }
  if (mcpCallCount > 0) {
    const serverLabel = mcpServerNames !== null && mcpServerNames.length > 0 ? mcpServerNames.map(n => n.replace(/^claude\.ai /, '')).join(', ') : 'MCP';
    const isFirst_3 = nonMemParts.length === 0;
    const verb_0 = isActiveGroup ? isFirst_3 ? 'Querying' : 'querying' : isFirst_3 ? 'Queried' : 'queried';
    if (!isFirst_3) {
      nonMemParts.push(<Text key="comma-mcp">, </Text>);
    }
    nonMemParts.push(<Text key="mcp">
        {verb_0} {serverLabel}
        {mcpCallCount > 1 && <>
            {' '}
            <Text bold>{mcpCallCount}</Text> times
          </>}
      </Text>);
  }
  if (isFullscreenEnvEnabled() && bashCount > 0) {
    const isFirst_4 = nonMemParts.length === 0;
    const verb_1 = isActiveGroup ? isFirst_4 ? 'Running' : 'running' : isFirst_4 ? 'Ran' : 'ran';
    if (!isFirst_4) {
      nonMemParts.push(<Text key="comma-bash">, </Text>);
    }
    nonMemParts.push(<Text key="bash">
        {verb_1} <Text bold>{bashCount}</Text> bash{' '}
        {bashCount === 1 ? 'command' : 'commands'}
      </Text>);
  }

  // Build memory parts (auto-memory) — rendered after nonMemParts
  const hasPrecedingNonMem = nonMemParts.length > 0;
  const memParts: React.ReactNode[] = [];
  if (!memoryReadCountState.isRecovered || memoryReadCountState.value > 0) {
    const isFirst_5 = !hasPrecedingNonMem && memParts.length === 0;
    const verb_2 = isActiveGroup ? isFirst_5 ? 'Recalling' : 'recalling' : isFirst_5 ? 'Recalled' : 'recalled';
    if (!isFirst_5) {
      memParts.push(<Text key="comma-mr">, </Text>);
    }
    memParts.push(memoryReadCountState.isRecovered ? <Text key="mem-read">
        {verb_2} <Text bold>{memoryReadCountState.value}</Text>{' '}
        {memoryReadCountState.value === 1 ? 'memory' : 'memories'}
      </Text> : <Text key="mem-read-unavailable">
        {verb_2} memory recall unavailable
      </Text>);
  }
  if (!memorySearchCountState.isRecovered || memorySearchCountState.value > 0) {
    const isFirst_6 = !hasPrecedingNonMem && memParts.length === 0;
    const verb_3 = isActiveGroup ? isFirst_6 ? 'Searching' : 'searching' : isFirst_6 ? 'Searched' : 'searched';
    if (!isFirst_6) {
      memParts.push(<Text key="comma-ms">, </Text>);
    }
    memParts.push(memorySearchCountState.isRecovered ? <Text key="mem-search">{`${verb_3} memories`}</Text> : <Text key="mem-search-unavailable">
        {verb_3} memory search unavailable
      </Text>);
  }
  if (!memoryWriteCountState.isRecovered || memoryWriteCountState.value > 0) {
    const isFirst_7 = !hasPrecedingNonMem && memParts.length === 0;
    const verb_4 = isActiveGroup ? isFirst_7 ? 'Writing' : 'writing' : isFirst_7 ? 'Wrote' : 'wrote';
    if (!isFirst_7) {
      memParts.push(<Text key="comma-mw">, </Text>);
    }
    memParts.push(memoryWriteCountState.isRecovered ? <Text key="mem-write">
        {verb_4} <Text bold>{memoryWriteCountState.value}</Text>{' '}
        {memoryWriteCountState.value === 1 ? 'memory' : 'memories'}
      </Text> : <Text key="mem-write-unavailable">
        {verb_4} memory write unavailable
      </Text>);
  }
  return <Box flexDirection="column" marginTop={1} backgroundColor={bg}>
      <Box flexDirection="row">
        {isActiveGroup ? <ToolUseLoader shouldAnimate isUnresolved isError={anyError} /> : <Box minWidth={2} />}
        <Text dimColor={!isActiveGroup}>
          {nonMemParts}
          {memParts}
          {feature('TEAMMEM') ? teamMemCollapsed!.TeamMemCountParts({
          message,
          isActiveGroup,
          hasPrecedingParts: hasPrecedingNonMem || memParts.length > 0
        }) : null}
          {isActiveGroup && <Text key="ellipsis">…</Text>} <CtrlOToExpand />
        </Text>
      </Box>
      {isActiveGroup && displayedHint !== undefined &&
    // Row layout: 5-wide gutter for ⎿, then a flex column for the text.
    // Ink's wrap stays inside the right column so continuation lines
    // indent under ⎿. MAX_HINT_CHARS in commandAsHint caps total at ~5 lines.
    <Box flexDirection="row">
          <Box width={5} flexShrink={0}>
            <Text dimColor>{'  ⎿  '}</Text>
          </Box>
          <Box flexDirection="column" flexGrow={1}>
            {displayedHint.split('\n').map((line, i, arr) => <Text key={`hint-${i}`} dimColor>
                {line}
                {i === arr.length - 1 && shellProgressSuffix}
              </Text>)}
          </Box>
        </Box>}
      {(message.hookTotalMs !== undefined || !hookTotalMsState.isRecovered) && (hookTotalMsState.value > 0 || !hookTotalMsState.isRecovered) && <Text dimColor>
          {'  ⎿  '}Ran {message.hookCount} PreToolUse{' '}
          {message.hookCount === 1 ? 'hook' : 'hooks'} (
          {hookTotalMsState.isRecovered ? formatSecondsShort(hookTotalMsState.value) : 'timing unavailable'})
        </Text>}
    </Box>;
}
