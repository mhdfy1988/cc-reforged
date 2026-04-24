import type { ReactNode, Ref } from 'react'
import type { DOMElement } from '../ink/dom.js'
import type { ClickEvent } from '../ink/events/click-event.js'
import type { FocusEvent } from '../ink/events/focus-event.js'
import type { KeyboardEvent } from '../ink/events/keyboard-event.js'
import type { Styles, TextStyles } from '../ink/styles.js'

type InkBoxIntrinsicProps = {
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

type InkTextIntrinsicProps = {
  children?: ReactNode
  style?: Styles
  textStyles?: TextStyles
}

type InkRawAnsiIntrinsicProps = {
  rawText: string
  rawWidth: number
  rawHeight: number
}

type InkLinkIntrinsicProps = {
  children?: ReactNode
  href: string
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'ink-box': InkBoxIntrinsicProps
      'ink-text': InkTextIntrinsicProps
      'ink-raw-ansi': InkRawAnsiIntrinsicProps
      'ink-link': InkLinkIntrinsicProps
    }
  }
}

export {}
