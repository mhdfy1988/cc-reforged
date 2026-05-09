import { Fragment, type ReactNode } from 'react'
import { isNullRenderingAttachmentType } from '../../../../../../src/utils/nullRenderingAttachmentTypes.js'
import type { ChatMessage, JsonObject } from './displayTypes.js'

export function createMessageFromCompletedItem(
  itemId: string,
  kind: string | undefined,
  blocks: JsonObject[],
  statusText: string,
): ChatMessage | null {
  if (kind === 'user_message') {
    return null
  }

  const hasToolUse = blocks.some(block => block.type === 'tool_use')
  const hasToolResult = blocks.some(block => block.type === 'tool_result')
  const hasProgress = blocks.some(block => block.type === 'progress')
  const hasToolSummary = blocks.some(block => block.type === 'tool_use_summary')
  const hasThinking = blocks.some(
    block => block.type === 'thinking' || block.type === 'redacted_thinking',
  )
  const text = formatCompletedItemText(kind, blocks)
  if (!text.trim()) {
    return null
  }

  const isPlainAssistant =
    kind === 'assistant_message' &&
    !hasToolUse &&
    !hasToolResult &&
    !hasProgress &&
    !hasToolSummary &&
    !hasThinking

  return {
    id: itemId,
    role: isPlainAssistant ? 'assistant' : 'system',
    text,
    status: statusText,
    kind:
      hasThinking
        ? 'thinking-event'
        : hasToolUse || hasToolResult || hasProgress || hasToolSummary
          ? 'tool-event'
          : kind,
  }
}

export function normalizeContentBlocks(content: unknown): JsonObject[] {
  if (!Array.isArray(content)) {
    return content === undefined ? [] : [{ type: 'json', value: content }]
  }

  return content.map(block => {
    if (!block || typeof block !== 'object') {
      return { type: 'json', value: block }
    }
    return block as JsonObject
  })
}

export function renderMessageBlocks(text: string): ReactNode[] {
  const lines = normalizeMessageText(text).split('\n')
  const blocks: ReactNode[] = []
  let paragraph: string[] = []

  function flushParagraph(): void {
    if (!paragraph.length) {
      return
    }

    const key = `p-${blocks.length}`
    blocks.push(
      <p key={key}>
        {paragraph.map((line, index) => (
          <Fragment key={`${key}-${index}`}>
            {index > 0 ? <br /> : null}
            {renderInlineText(line)}
          </Fragment>
        ))}
      </p>,
    )
    paragraph = []
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()

    if (!line) {
      flushParagraph()
      continue
    }

    const codeFence = line.match(/^```(\w*)\s*$/)
    if (codeFence) {
      const codeLines: string[] = []
      index += 1
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index])
        index += 1
      }
      flushParagraph()
      blocks.push(
        <pre className="message-code" key={`code-${blocks.length}`}>
          <code>{codeLines.join('\n')}</code>
        </pre>,
      )
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      blocks.push(<h3 key={`h-${blocks.length}`}>{renderInlineText(heading[2])}</h3>)
      continue
    }

    const unordered = line.match(/^[-*]\s+(.+)$/)
    if (unordered) {
      const items: string[] = []
      while (index < lines.length) {
        const item = lines[index].trim().match(/^[-*]\s+(.+)$/)
        if (!item) {
          break
        }
        items.push(item[1])
        index += 1
      }
      index -= 1
      flushParagraph()
      blocks.push(
        <ul key={`ul-${blocks.length}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInlineText(item)}</li>
          ))}
        </ul>,
      )
      continue
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/)
    if (ordered) {
      const items: string[] = []
      while (index < lines.length) {
        const item = lines[index].trim().match(/^\d+\.\s+(.+)$/)
        if (!item) {
          break
        }
        items.push(item[1])
        index += 1
      }
      index -= 1
      flushParagraph()
      blocks.push(
        <ol key={`ol-${blocks.length}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInlineText(item)}</li>
          ))}
        </ol>,
      )
      continue
    }

    paragraph.push(line)
  }

  flushParagraph()
  return blocks.length ? blocks : [<p key="empty">暂无内容</p>]
}

function formatCompletedItemText(
  kind: string | undefined,
  blocks: JsonObject[],
): string {
  const rendered = blocks
    .map(block => formatContentBlock(block))
    .filter(Boolean)
    .join('\n\n')

  if (rendered) {
    return rendered
  }

  if (kind === 'tool_progress') {
    return '工具正在执行。'
  }

  return ''
}

function formatContentBlock(block: JsonObject): string {
  const type = typeof block.type === 'string' ? block.type : 'json'

  if (isNullRenderingContentBlock(block, type)) {
    return ''
  }

  if (type === 'text') {
    return typeof block.text === 'string' ? block.text : ''
  }

  if (type === 'thinking') {
    const thinking = typeof block.thinking === 'string' ? block.thinking : ''
    return ['思考', limitMessageText(thinking)].filter(Boolean).join('\n')
  }

  if (type === 'redacted_thinking') {
    return '思考\n思考内容已由模型服务隐藏。'
  }

  if (type === 'tool_use') {
    const name = getStringValue(block.name, '未知工具')
    return [`调用工具：${name}`, formatJsonBlock(block.input)].filter(Boolean).join('\n')
  }

  if (type === 'tool_result') {
    const title = block.isError ? '工具结果：失败' : '工具结果：成功'
    return [title, formatToolResultContent(block.content)].filter(Boolean).join('\n')
  }

  if (type === 'progress') {
    return ['工具进度', formatJsonBlock(block.data)].filter(Boolean).join('\n')
  }

  if (type === 'tool_use_summary') {
    return ['工具摘要', formatUnknownValue(block.summary)].filter(Boolean).join('\n')
  }

  if (type === 'attachment') {
    return ['附件', formatUnknownValue(block.attachment)].filter(Boolean).join('\n')
  }

  if ('value' in block) {
    return formatUnknownValue(block.value)
  }

  return formatJsonBlock(block)
}

export function isNullRenderingContentBlock(
  block: JsonObject,
  type = typeof block.type === 'string' ? block.type : 'json',
): boolean {
  if (isNullRenderingAttachmentType(type)) {
    return true
  }

  if (type !== 'attachment') {
    return false
  }

  const attachment = block.attachment
  if (!attachment || typeof attachment !== 'object') {
    return false
  }

  return isNullRenderingAttachmentType((attachment as JsonObject).type)
}

function formatToolResultContent(content: unknown): string {
  if (typeof content === 'string') {
    return limitMessageText(localizeToolResultText(content))
  }

  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'string') {
          return limitMessageText(localizeToolResultText(part))
        }
        if (part && typeof part === 'object' && 'text' in part) {
          const text = (part as JsonObject).text
          return typeof text === 'string'
            ? limitMessageText(localizeToolResultText(text))
            : formatJsonBlock(part)
        }
        return formatJsonBlock(part)
      })
      .filter(Boolean)
      .join('\n')
  }

  return formatUnknownValue(content)
}

function localizeToolResultText(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (
    normalized ===
    'Todos have been modified successfully. Ensure that you continue to use the todo list to track your progress. Please proceed with the current tasks if applicable.'
  ) {
    return 'Todo 已更新。请继续按当前任务推进。'
  }

  if (normalized === 'No changes were made to the todo list.') {
    return 'Todo 没有变化。'
  }

  return text
}

function formatUnknownValue(value: unknown): string {
  if (typeof value === 'string') {
    return limitMessageText(value)
  }
  return formatJsonBlock(value)
}

function formatJsonBlock(value: unknown): string {
  if (value === undefined) {
    return ''
  }

  let json: string
  try {
    json = JSON.stringify(value, null, 2)
  } catch {
    json = String(value)
  }

  if (!json || json === 'undefined') {
    return ''
  }

  return `\`\`\`json\n${limitMessageText(json)}\n\`\`\``
}

function getStringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function limitMessageText(text: string): string {
  const maxLength = 4_000
  if (text.length <= maxLength) {
    return text
  }
  return `${text.slice(0, maxLength)}\n... 已截断 ${text.length - maxLength} 字符`
}

function normalizeMessageText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\s+---\s+(#{1,6}\s+)/g, '\n\n$1')
    .replace(/(\S)\s+(#{1,6}\s+)/g, '$1\n\n$2')
    .replace(/([。；;：:])\s+(-\s+(?=\S))/g, '$1\n$2')
    .replace(/([。；;：:])\s+(\d+\.\s+(?=\S))/g, '$1\n$2')
}

function renderInlineText(text: string): ReactNode[] {
  return text
    .split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={index}>{part.slice(1, -1)}</code>
      }
      return <Fragment key={index}>{part}</Fragment>
    })
}
