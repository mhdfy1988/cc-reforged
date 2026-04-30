export function redactAccountId(accountId: string): string {
  const trimmed = accountId.trim()
  if (trimmed.length <= 4) {
    return '***'
  }
  return `***${trimmed.slice(-4)}`
}

export function redactRecord(
  record: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      isSensitiveKey(key) ? '***' : value,
    ]),
  )
}

export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url)
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (isSensitiveKey(key)) {
        parsed.searchParams.set(key, '***')
      }
    }
    if (parsed.username) {
      parsed.username = '***'
    }
    if (parsed.password) {
      parsed.password = '***'
    }
    return parsed.toString()
  } catch {
    return url
  }
}

export function isSensitiveKey(key: string): boolean {
  return /token|key|secret|password|authorization|cookie/i.test(key)
}
