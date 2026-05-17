export const DEFAULT_AUTO_SCROLL_THRESHOLD_PX = 120
export const AUTO_SCROLL_RESUME_THRESHOLD_PX = 24
export const SCROLL_CONTENT_BELOW_THRESHOLD_PX = 4
export const USER_SCROLL_DIRECTION_EPSILON_PX = 2

export type ScrollMetrics = {
  clientHeight: number
  scrollHeight: number
  scrollTop: number
}

export function getScrollMetrics(element: {
  clientHeight: number
  scrollHeight: number
  scrollTop: number
}): ScrollMetrics {
  return {
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
  }
}

export function getDistanceToBottom(metrics: ScrollMetrics): number {
  return metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight
}

export function isNearScrollBottom(
  metrics: ScrollMetrics,
  thresholdPx = DEFAULT_AUTO_SCROLL_THRESHOLD_PX,
): boolean {
  return getDistanceToBottom(metrics) <= thresholdPx
}

export function hasScrollableContentBelow(
  metrics: ScrollMetrics,
  thresholdPx = SCROLL_CONTENT_BELOW_THRESHOLD_PX,
): boolean {
  return getDistanceToBottom(metrics) > thresholdPx
}
