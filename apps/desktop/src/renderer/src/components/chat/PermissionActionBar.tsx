import type { ReactNode } from 'react'

export function PermissionActionBar(props: {
  children: ReactNode
  className?: string
}) {
  const className = ['permission-actions', props.className]
    .filter(Boolean)
    .join(' ')
  return <div className={className}>{props.children}</div>
}
