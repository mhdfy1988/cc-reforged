import type { ReactNode } from 'react'
import { InteractionStatusBadge } from './InteractionStatusBadge.js'
import { PermissionActionBar } from './PermissionActionBar.js'

export function InteractionCardShell(props: {
  actions?: ReactNode
  children: ReactNode
  className?: string
  meta?: ReactNode
  status: string
  title: ReactNode
  typeLabel: ReactNode
}) {
  const className = ['permission-card', props.className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className}>
      <div>
        <b>{props.typeLabel}</b>
        <strong>{props.title}</strong>
        <InteractionStatusBadge label={props.status} />
      </div>
      {props.meta ? <small>{props.meta}</small> : null}
      {props.children}
      {props.actions ? (
        <PermissionActionBar>{props.actions}</PermissionActionBar>
      ) : null}
    </div>
  )
}
