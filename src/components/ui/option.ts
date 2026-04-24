import type { ReactNode } from 'react'

export type Option<T = string> = {
  label: ReactNode
  value: T
  description?: string
  disabled?: boolean
}
