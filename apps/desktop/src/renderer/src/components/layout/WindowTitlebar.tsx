import { useEffect, useState } from 'react'

export function WindowTitlebar() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    let mounted = true
    void window.ccr.getWindowState().then(state => {
      if (mounted) {
        setMaximized(state.maximized)
      }
    })
    const unsubscribe = window.ccr.onWindowState(state => {
      setMaximized(state.maximized)
    })
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  async function minimizeWindow(): Promise<void> {
    const state = await window.ccr.minimizeWindow()
    setMaximized(state.maximized)
  }

  async function toggleMaximizeWindow(): Promise<void> {
    const state = await window.ccr.toggleMaximizeWindow()
    setMaximized(state.maximized)
  }

  function closeWindow(): void {
    void window.ccr.closeWindow()
  }

  return (
    <div className="window-titlebar">
      <div className="window-titlebar-brand">
        <img
          alt=""
          aria-hidden="true"
          className="window-titlebar-icon"
          src="./ccr-icon.png"
        />
        <span>CCR</span>
      </div>
      <div className="window-titlebar-drag" aria-hidden="true" />
      <div className="window-titlebar-controls">
        <button
          aria-label="最小化窗口"
          className="window-control-button"
          onClick={() => void minimizeWindow()}
          title="最小化"
          type="button"
        >
          <span
            aria-hidden="true"
            className="window-control-icon window-control-icon-minimize"
          />
        </button>
        <button
          aria-label={maximized ? '还原窗口' : '最大化窗口'}
          className="window-control-button"
          onClick={() => void toggleMaximizeWindow()}
          title={maximized ? '还原' : '最大化'}
          type="button"
        >
          <span
            aria-hidden="true"
            className={`window-control-icon ${
              maximized
                ? 'window-control-icon-restore'
                : 'window-control-icon-maximize'
            }`}
          />
        </button>
        <button
          aria-label="关闭窗口"
          className="window-control-button is-close"
          onClick={closeWindow}
          title="关闭"
          type="button"
        >
          <span
            aria-hidden="true"
            className="window-control-icon window-control-icon-close"
          />
        </button>
      </div>
    </div>
  )
}
