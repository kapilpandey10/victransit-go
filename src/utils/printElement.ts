/**
 * Prints an isolated HTML element using a hidden iframe.
 *
 * Why this is needed:
 * Standard `window.print()` prints the entire document flow, which causes browsers
 * to render empty/blank pages for hidden application containers (resulting in "Page 4 of 4"
 * or blank pages before the content). By rendering the target element into a dedicated,
 * isolated iframe with clean print CSS, the browser prints ONLY the intended document,
 * starting at Page 1, with zero blank pages.
 */
export function printElement(elementId: string, title = 'Document'): boolean {
  if (typeof document === 'undefined') return false

  const target = document.getElementById(elementId)
  if (!target) return false

  // Remove any stale print iframes
  const oldFrame = document.getElementById('app-print-sandbox')
  if (oldFrame) oldFrame.remove()

  const iframe = document.createElement('iframe')
  iframe.id = 'app-print-sandbox'
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.setAttribute('aria-hidden', 'true')
  document.body.appendChild(iframe)

  const frameDoc = iframe.contentWindow?.document
  if (!frameDoc) {
    if (typeof window !== 'undefined') window.print()
    return false
  }

  // Collect active application stylesheets and fonts
  const styleTags = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map(el => el.outerHTML)
    .join('\n')

  frameDoc.open()
  frameDoc.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  ${styleTags}
  <style>
    @page {
      margin: 8mm 10mm;
      size: auto;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: white !important;
      color: #0f172a !important;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
    }
    #printable-story-report,
    #printable-program-report {
      position: static !important;
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      box-shadow: none !important;
      background: white !important;
    }
  </style>
</head>
<body>
  ${target.outerHTML}
</body>
</html>`)
  frameDoc.close()

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch {
      // Graceful fallback for test environments without full window.print support
    }
    setTimeout(() => {
      iframe.remove()
    }, 1500)
  }, 250)

  return true
}
