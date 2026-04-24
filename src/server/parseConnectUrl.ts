export type ParsedConnectUrl = {
  serverUrl: string
  authToken?: string
}

export function parseConnectUrl(input: string): ParsedConnectUrl {
  try {
    const url = new URL(input)
    const authToken =
      url.searchParams.get('authToken') ??
      url.searchParams.get('token') ??
      undefined

    if (url.protocol === 'cc+unix:' || url.protocol === 'unix:') {
      return {
        serverUrl: `unix:${url.pathname}`,
        authToken,
      }
    }

    if (url.protocol === 'cc:' || url.protocol === 'cc+https:' || url.protocol === 'cc+http:') {
      const protocol = url.searchParams.get('transport') === 'http' ? 'http:' : 'https:'
      return {
        serverUrl: `${protocol}//${url.host}${url.pathname}${url.search}${url.hash}`,
        authToken,
      }
    }

    return {
      serverUrl: input,
      authToken,
    }
  } catch {
    return {
      serverUrl: input,
    }
  }
}
