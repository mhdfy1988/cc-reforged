export function Composer(props: {
  activeTurnId: string | null
  busy: boolean
  canInterruptTurn: boolean
  prompt: string
  onChangePrompt: (prompt: string) => void
  onInterrupt: () => void
  onSend: () => void
}) {
  return (
    <footer className="composer">
      <button className="plus">+</button>
      <input
        value={props.prompt}
        onChange={event => props.onChangePrompt(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && props.prompt.trim()) {
            props.onSend()
          }
        }}
        placeholder="输入任务，按 Enter 发送..."
      />
      {props.activeTurnId ? (
        <button
          className="send stop"
          disabled={props.busy || !props.canInterruptTurn}
          onClick={props.onInterrupt}
        >
          停止
        </button>
      ) : (
        <button
          className="send"
          disabled={props.busy || !props.prompt.trim()}
          onClick={props.onSend}
        >
          发送
        </button>
      )}
    </footer>
  )
}
