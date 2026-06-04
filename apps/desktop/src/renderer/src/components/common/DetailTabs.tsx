export type DetailTabOption<T extends string = string> = {
  id: T
  label: string
}

export function DetailTabs<T extends string>(props: {
  activeTab: T
  ariaLabel: string
  tabs: ReadonlyArray<DetailTabOption<T>>
  onChange: (tab: T) => void
}) {
  return (
    <div className="detail-tabs" role="tablist" aria-label={props.ariaLabel}>
      {props.tabs.map(tab => (
        <button
          aria-selected={props.activeTab === tab.id}
          className={props.activeTab === tab.id ? 'active' : ''}
          key={tab.id}
          role="tab"
          type="button"
          onClick={() => props.onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
