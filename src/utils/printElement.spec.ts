import { describe, expect, it } from 'vitest'
import { printElement } from './printElement'

describe('printElement utility', () => {
  it('returns false gracefully when element not found in DOM', () => {
    const res = printElement('non-existent-id')
    expect(res).toBe(false)
  })

  it('creates an isolated iframe and initiates print when element exists', () => {
    const div = document.createElement('div')
    div.id = 'test-print-elem'
    div.innerHTML = '<h1>Leonardo</h1>'
    document.body.appendChild(div)

    const res = printElement('test-print-elem', 'Test Print')
    expect(res).toBe(true)

    const iframe = document.getElementById('app-print-sandbox')
    expect(iframe).not.toBeNull()

    div.remove()
    iframe?.remove()
  })
})
