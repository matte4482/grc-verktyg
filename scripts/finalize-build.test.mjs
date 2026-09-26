import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { addCsp, buildCsp, externalReferences, scriptHashes } from './finalize-build.mjs'

const page = (head, body = '') =>
  `<!doctype html><html lang="sv"><head><meta charset="UTF-8" />${head}</head><body>${body}</body></html>`

describe('externalReferences', () => {
  it('godkänner en helt inbäddad fil', () => {
    const html = page(
      `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E">` +
        `<script type="module">const ns = "http://www.w3.org/2000/svg"; el.innerHTML = '<a href="https://x.se">'</script>` +
        `<style>.a{background:url(data:image/png;base64,AAAA)}</style>`,
      '<a href="#top">Upp</a>',
    )
    expect(externalReferences(html)).toEqual([])
  })

  it('hittar externa skript, stilmallar, bilder och CSS-url:er', () => {
    const html = page(
      '<script type="module" src="/assets/index-abc.js"></script>' +
        '<link rel="stylesheet" href="/assets/index-abc.css">' +
        '<style>@import "https://fonts.example/x.css"; .a{background:url(/bg.png)}</style>',
      '<img src="logo.png">',
    )
    expect(externalReferences(html)).toEqual([
      '<script src="/assets/index-abc.js">',
      'src="/assets/index-abc.js"',
      'href="/assets/index-abc.css"',
      'src="logo.png"',
      'url(/bg.png)',
      '@import "https://fonts.example/x.css";',
    ])
  })
})

describe('CSP', () => {
  const body = 'document.body.textContent = "ok"'
  const html = page(`<script type="module">${body}</script>`)

  it('hashen gäller exakt skriptets innehåll', () => {
    const expected = createHash('sha256').update(body, 'utf8').digest('base64')
    expect(scriptHashes(html)).toEqual([`'sha256-${expected}'`])
  })

  it('förbjuder nätverkstrafik och okända skript', () => {
    const csp = buildCsp(["'sha256-abc'"])
    expect(csp).toContain("default-src 'none'")
    expect(csp).toContain("connect-src 'none'")
    expect(csp).toContain("script-src 'sha256-abc'")
    expect(csp).not.toContain('unsafe-eval')
    expect(buildCsp([])).toContain("script-src 'none'")
  })

  it('placeras direkt efter <meta charset>, före skripten', () => {
    const out = addCsp(html)
    expect(out.indexOf('Content-Security-Policy')).toBeGreaterThan(out.indexOf('charset'))
    expect(out.indexOf('Content-Security-Policy')).toBeLessThan(out.indexOf('<script'))
  })

  it('kan köras flera gånger utan att taggen dubbleras', () => {
    const twice = addCsp(addCsp(html))
    expect(twice.match(/Content-Security-Policy/g)).toHaveLength(1)
    expect(twice).toBe(addCsp(html))
  })

  it('kräver <meta charset>', () => {
    expect(() => addCsp('<html><head></head></html>')).toThrow(/meta charset/)
  })
})
