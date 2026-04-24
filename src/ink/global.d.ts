import type { ReactNode, Ref } from 'react'
import type { DOMElement } from './dom.js'
import type { ClickEvent } from './events/click-event.js'
import type { FocusEvent } from './events/focus-event.js'
import type { KeyboardEvent } from './events/keyboard-event.js'
import type { Styles, TextStyles } from './styles.js'

type InkBoxProps = {
  children?: ReactNode
  ref?: Ref<DOMElement>
  style?: Styles
  tabIndex?: number
  autoFocus?: boolean
  stickyScroll?: boolean
  onClick?: (event: ClickEvent) => void
  onFocus?: (event: FocusEvent) => void
  onFocusCapture?: (event: FocusEvent) => void
  onBlur?: (event: FocusEvent) => void
  onBlurCapture?: (event: FocusEvent) => void
  onKeyDown?: (event: KeyboardEvent) => void
  onKeyDownCapture?: (event: KeyboardEvent) => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

type InkTextProps = {
  children?: ReactNode
  style?: Styles
  textStyles?: TextStyles
}

type InkRawAnsiProps = {
  rawText: string
  rawWidth: number
  rawHeight: number
}

type InkLinkProps = {
  children?: ReactNode
  href: string
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'ink-box': InkBoxProps
      'ink-text': InkTextProps
      'ink-raw-ansi': InkRawAnsiProps
      'ink-link': InkLinkProps
    }
  }
}

export {}
