import { MessageFrame } from './MessageFrame.js'
import type { DisplayEvent } from '../../domain/displayEvents.js'

export function ErrorCard(props: { event: DisplayEvent }) {
  return <MessageFrame label="!" event={props.event} />
}
