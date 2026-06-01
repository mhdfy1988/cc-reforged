import type {
  ElicitRequestURLParams,
  ElicitResult,
} from '@modelcontextprotocol/sdk/types.js'
import { isFileUrl } from './toolSafety.js'

export function extractUrlElicitationsFromErrorData(
  errorData: unknown,
): ElicitRequestURLParams[] {
  const rawElicitations =
    errorData != null &&
    typeof errorData === 'object' &&
    'elicitations' in errorData &&
    Array.isArray(errorData.elicitations)
      ? (errorData.elicitations as unknown[])
      : []

  return rawElicitations.filter(isElicitRequestUrlParams)
}

export function findBlockedFileUrlElicitation(
  elicitations: ElicitRequestURLParams[],
): ElicitRequestURLParams | undefined {
  return elicitations.find(elicitation => isFileUrl(elicitation.url))
}

export function getUrlElicitationNonAcceptContent(params: {
  action: Exclude<ElicitResult['action'], 'accept'>
  actor: 'hook' | 'user'
  tool: string
}): string {
  return `URL elicitation was ${getPastTenseAction(params.action)} by ${params.actor === 'hook' ? 'a hook' : 'the user'}. The tool "${params.tool}" could not complete because it requires the user to open a URL.`
}

function isElicitRequestUrlParams(
  value: unknown,
): value is ElicitRequestURLParams {
  if (value == null || typeof value !== 'object') {
    return false
  }
  const object = value as Record<string, unknown>
  return (
    object.mode === 'url' &&
    typeof object.url === 'string' &&
    typeof object.elicitationId === 'string' &&
    typeof object.message === 'string'
  )
}

function getPastTenseAction(action: Exclude<ElicitResult['action'], 'accept'>): string {
  return action === 'decline' ? 'declined' : `${action}ed`
}
