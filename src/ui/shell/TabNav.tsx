import { useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import { HistoryIcon, PolicyIcon, ScanIcon, SettingsIcon } from './icons'
import { TAB_IDS, TAB_LABELS, type TabId } from './tabs'
import { styleRef } from '../components/styleRef'

type IconComponent = (props: { className?: string }) => ReactElement

const TAB_ICONS: Record<TabId, IconComponent> = {
  scan: ScanIcon,
  policy: PolicyIcon,
  history: HistoryIcon,
  settings: SettingsIcon,
}

interface TabNavProps {
  active: TabId
  onSelect: (tab: TabId) => void
}

interface PillBox {
  x: number
  y: number
  width: number
  height: number
}

/** Measures the active tab so the graphite pill can slide to it. Re-measures when the nav resizes. */
function useActivePill(active: TabId) {
  const navRef = useRef<HTMLElement>(null)
  const [pill, setPill] = useState<PillBox | null>(null)

  useLayoutEffect(() => {
    const nav = navRef.current
    if (!nav) return undefined
    const measure = () => {
      const item = nav.querySelector<HTMLElement>(`[data-tab="${active}"]`)
      if (!item) return
      setPill({ x: item.offsetLeft, y: item.offsetTop, width: item.offsetWidth, height: item.offsetHeight })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(nav)
    return () => observer.disconnect()
  }, [active])

  return { navRef, pill }
}

/** Floating, centred pill navigation. The active tab is marked with aria-current="page". */
export function TabNav({ active, onSelect }: TabNavProps): ReactElement {
  const { navRef, pill } = useActivePill(active)

  return (
    <nav aria-label="Main" className="tab-nav" ref={navRef}>
      {pill && (
        <span
          className="tab-nav__pill"
          aria-hidden="true"
          ref={styleRef({
            width: `${pill.width}px`,
            height: `${pill.height}px`,
            transform: `translate(${pill.x}px, ${pill.y}px)`,
          })}
        />
      )}
      {TAB_IDS.map((id) => {
        const Icon = TAB_ICONS[id]
        return (
          <button
            key={id}
            type="button"
            data-tab={id}
            className="tab-nav__item"
            aria-current={id === active ? 'page' : undefined}
            onClick={() => onSelect(id)}
          >
            <Icon className="tab-nav__icon" />
            {TAB_LABELS[id]}
          </button>
        )
      })}
    </nav>
  )
}
