export type IconActionName =
  | 'activity'
  | 'rotate'
  | 'search'
  | 'trash'
  | 'wrench'

export function IconActionButton(props: {
  danger?: boolean
  disabled?: boolean
  icon: IconActionName
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-label={props.label}
      className={props.danger ? 'icon-action danger' : 'icon-action'}
      disabled={props.disabled}
      title={props.label}
      type="button"
      onClick={props.onClick}
    >
      <ActionIcon name={props.icon} />
    </button>
  )
}

function ActionIcon(props: { name: IconActionName }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      {props.name === 'activity' ? (
        <path d="M22 12h-4l-3 8-6-16-3 8H2" />
      ) : null}
      {props.name === 'rotate' ? (
        <>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v6h6" />
        </>
      ) : null}
      {props.name === 'search' ? (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m16.5 16.5 4 4" />
        </>
      ) : null}
      {props.name === 'trash' ? (
        <>
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v5" />
          <path d="M14 11v5" />
        </>
      ) : null}
      {props.name === 'wrench' ? (
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8Z" />
      ) : null}
    </svg>
  )
}
