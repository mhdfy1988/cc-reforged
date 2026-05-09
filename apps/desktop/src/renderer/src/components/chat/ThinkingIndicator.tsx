export function ThinkingIndicator(props: { canStop: boolean }) {
  return (
    <div aria-live="polite" className="message assistant thinking-message">
      <b>C</b>
      <div className="thinking-content">
        <span>{props.canStop ? '正在处理，可点击停止' : '正在启动'}</span>
        <span className="thinking-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
    </div>
  )
}
