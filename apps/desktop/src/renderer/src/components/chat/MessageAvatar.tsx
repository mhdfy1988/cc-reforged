import {
  resolveMessageAvatar,
  type AvatarIconName,
  type MessageAvatarDescriptor,
  type MessageAvatarRuntime,
} from '../../domain/avatarEvents.js'
import type { DisplayEvent } from '../../domain/displayEvents.js'

export function MessageAvatar(props: {
  event: DisplayEvent
  runtime?: MessageAvatarRuntime
  descriptor?: MessageAvatarDescriptor
}) {
  const descriptor =
    props.descriptor ?? resolveMessageAvatar(props.event, props.runtime)
  return (
    <b
      aria-label={descriptor.title}
      className={[
        'message-avatar',
        `message-avatar-tone-${descriptor.tone}`,
        descriptor.status ? `message-avatar-status-${descriptor.status}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
      title={descriptor.title}
    >
      {descriptor.icon ? (
        <AvatarIcon name={descriptor.icon} />
      ) : (
        <span>{descriptor.label}</span>
      )}
    </b>
  )
}

function AvatarIcon(props: { name: AvatarIconName }) {
  return (
    <svg
      aria-hidden="true"
      className="message-avatar-icon"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      {getAvatarIconPath(props.name)}
    </svg>
  )
}

function getAvatarIconPath(name: AvatarIconName) {
  switch (name) {
    case 'archive':
      return (
        <>
          <path d="M4 7h16" />
          <path d="M5 7l1 13h12l1-13" />
          <path d="M8 7V4h8v3" />
          <path d="M9 12h6" />
        </>
      )
    case 'bot':
      return (
        <>
          <rect x="5" y="8" width="14" height="10" rx="3" />
          <path d="M12 5v3" />
          <path d="M9 13h.01" />
          <path d="M15 13h.01" />
          <path d="M9.5 17h5" />
        </>
      )
    case 'brain':
      return (
        <>
          <path d="M9 6a3 3 0 0 0-3 3v1a3 3 0 0 0 0 6v1a3 3 0 0 0 5 2" />
          <path d="M15 6a3 3 0 0 1 3 3v1a3 3 0 0 1 0 6v1a3 3 0 0 1-5 2" />
          <path d="M12 6v13" />
        </>
      )
    case 'circleHelp':
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M9.8 9a2.4 2.4 0 1 1 4.1 1.7c-.9.8-1.9 1.2-1.9 2.6" />
          <path d="M12 17h.01" />
        </>
      )
    case 'cog':
      return (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v3" />
          <path d="M12 18v3" />
          <path d="M3 12h3" />
          <path d="M18 12h3" />
          <path d="M5.6 5.6l2.1 2.1" />
          <path d="M16.3 16.3l2.1 2.1" />
          <path d="M18.4 5.6l-2.1 2.1" />
          <path d="M7.7 16.3l-2.1 2.1" />
        </>
      )
    case 'file':
      return (
        <>
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h6" />
          <path d="M9 17h4" />
        </>
      )
    case 'fileEdit':
      return (
        <>
          <path d="M6 3h8l4 4v6" />
          <path d="M14 3v5h5" />
          <path d="M8 21h3l8-8-3-3-8 8z" />
        </>
      )
    case 'filePlus':
      return (
        <>
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M14 3v5h5" />
          <path d="M12 12v6" />
          <path d="M9 15h6" />
        </>
      )
    case 'fileSearch':
      return (
        <>
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M14 3v5h5" />
          <circle cx="11" cy="14" r="3" />
          <path d="M13.2 16.2 16 19" />
        </>
      )
    case 'globe':
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M4 12h16" />
          <path d="M12 4a12 12 0 0 1 0 16" />
          <path d="M12 4a12 12 0 0 0 0 16" />
        </>
      )
    case 'image':
      return (
        <>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="M20 16l-4.5-4.5L7 19" />
        </>
      )
    case 'info':
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 11v5" />
          <path d="M12 8h.01" />
        </>
      )
    case 'listTodo':
      return (
        <>
          <path d="M8 6h12" />
          <path d="M8 12h12" />
          <path d="M8 18h12" />
          <path d="M3.5 6l1 1 2-2" />
          <path d="M3.5 12l1 1 2-2" />
          <path d="M3.5 18l1 1 2-2" />
        </>
      )
    case 'paperclip':
      return (
        <path d="M8 12.5l5.8-5.8a3 3 0 0 1 4.2 4.2l-7.2 7.2a5 5 0 0 1-7.1-7.1l7.4-7.4" />
      )
    case 'plug':
      return (
        <>
          <path d="M9 7V3" />
          <path d="M15 7V3" />
          <path d="M7 7h10v4a5 5 0 0 1-10 0z" />
          <path d="M12 16v5" />
        </>
      )
    case 'search':
      return (
        <>
          <circle cx="11" cy="11" r="6" />
          <path d="M16 16l4 4" />
        </>
      )
    case 'shield':
      return (
        <>
          <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />
          <path d="M12 8v5" />
          <path d="M12 16h.01" />
        </>
      )
    case 'sliders':
      return (
        <>
          <path d="M4 7h8" />
          <path d="M16 7h4" />
          <circle cx="14" cy="7" r="2" />
          <path d="M4 17h4" />
          <path d="M12 17h8" />
          <circle cx="10" cy="17" r="2" />
        </>
      )
    case 'terminal':
      return (
        <>
          <path d="M4 5h16v14H4z" />
          <path d="M7 9l3 3-3 3" />
          <path d="M12 15h5" />
        </>
      )
    case 'triangleAlert':
      return (
        <>
          <path d="M12 3l9 16H3z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </>
      )
  }
}
