import type { ReactElement, ReactNode } from 'react'

interface IconProps {
  className?: string
}

interface SvgProps extends IconProps {
  strokeWidth?: number
  children: ReactNode
}

// Stroke icons copied from the approved Write mockup. Sizes come from CSS classes.
function Svg({ className, strokeWidth = 1.8, children }: SvgProps): ReactElement {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export function ScanIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <path d="M4 8V6a2 2 0 0 1 2-2h2" />
      <path d="M16 4h2a2 2 0 0 1 2 2v2" />
      <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
      <path d="M8 20H6a2 2 0 0 1-2-2v-2" />
    </Svg>
  )
}

export function PolicyIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </Svg>
  )
}

export function HistoryIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  )
}

export function SettingsIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <path d="M4.9 4.9l2.1 2.1" />
      <path d="M17 17l2.1 2.1" />
      <path d="M2 12h3" />
      <path d="M19 12h3" />
      <path d="M4.9 19.1L7 17" />
      <path d="M17 7l2.1-2.1" />
    </Svg>
  )
}

export function AttachIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />
    </Svg>
  )
}

export function ArrowRightIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props} strokeWidth={2}>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </Svg>
  )
}
