export type Continue = {
  kind: 'continue'
  reason: string
}

export type Terminal = {
  kind: 'terminal'
  reason: string
}
