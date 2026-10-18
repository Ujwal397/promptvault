/**
 * Dynamic styles without the `style` attribute. Our CSP has `style-src 'self'` (no 'unsafe-inline'), and WebKit
 * reports React's `style={...}` prop as a style-src-attr violation. CSSOM writes (`style.setProperty`) are not
 * governed by CSP in any browser, so dynamic values (widths, transforms, stagger indexes) go through this ref.
 *
 * Keys are CSS property names as written in CSS: 'width', 'transform', '--i'.
 */
export type StyleValues = Readonly<Record<string, string | number>>

export function styleRef(values: StyleValues): (el: HTMLElement | null) => void {
  return (el) => {
    if (!el) return
    for (const [property, value] of Object.entries(values)) el.style.setProperty(property, String(value))
  }
}
