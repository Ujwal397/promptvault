import type { ReactElement, ReactNode } from 'react'

interface IconProps {
  className?: string
}

// Stroke icons from the approved Review and Sanitized mockups. Sizes come from CSS classes.
function Svg({ className, strokeWidth = 2, children }: IconProps & { strokeWidth?: number; children: ReactNode }): ReactElement {
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

export function ArrowLeftIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <path d="M19 12H5" />
      <path d="M11 6l-6 6 6 6" />
    </Svg>
  )
}

export function CopyIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props} strokeWidth={1.8}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </Svg>
  )
}

export function LockIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  )
}
