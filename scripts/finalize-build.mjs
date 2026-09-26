// Körs efter `vite build` (se "build" i package.json). Tre steg:
//
// 1. Kontrollerar att dist/ bara innehåller index.html (B-03).
// 2. Kontrollerar att index.html inte hänvisar till något utanför filen:
//    inga <script src>, <link href>, bilder eller CSS-url:er utom data:-adresser.
// 3. Lägger in en Content-Security-Policy som förbjuder all nätverkstrafik och
//    bara tillåter exakt de skript som finns i filen (B-20).
//
// Om något är fel avslutas bygget med felkod, så att en trasig fil aldrig delas ut.

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const INLINE_SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
const INLINE_STYLE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi
const CSP_META = /\s*<meta http-equiv="Content-Security-Policy"[^>]*>/i

/** Filer i dist/ som inte är index.html. Tom lista = rätt. */
export function extraFiles(dir) {
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((f) => statSync(join(dir, f)).isFile() && f !== 'index.html')
}

/**
 * Hänvisningar i HTML:en som skulle få webbläsaren att hämta något utifrån.
 * Innehållet i <script> hoppas över: det är kod, inte hänvisningar, och
 * Svelte-runtime innehåller t.ex. namnrymden "http://www.w3.org/2000/svg".
 */
export function externalReferences(html) {
  const found = []
  const markup = html.replace(INLINE_SCRIPT, (_, attrs) => `<script${attrs}></script>`)

  for (const m of markup.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']?([^"'\s>]+)/gi)) found.push(`<script src="${m[1]}">`)
  for (const m of markup.matchAll(/\b(?:src|href|srcset|poster|action)\s*=\s*["']([^"']*)["']/gi)) {
    const url = m[1].trim()
    if (url === '' || url.startsWith('data:') || url.startsWith('#')) continue
    found.push(m[0])
  }
  for (const [, css] of html.matchAll(INLINE_STYLE)) {
    for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi))
      if (!m[1].startsWith('data:') && !m[1].startsWith('#')) found.push(`url(${m[1]})`)
    for (const m of css.matchAll(/@import\s+[^;]+;/gi)) found.push(m[0])
  }
  return found
}

/** sha256-hash i CSP-format för varje inbäddat skript, i den ordning de står. */
export function scriptHashes(html) {
  return [...html.matchAll(INLINE_SCRIPT)].map(
    ([, , body]) => `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`,
  )
}

export function buildCsp(hashes) {
  return [
    "default-src 'none'",
    `script-src ${hashes.length ? hashes.join(' ') : "'none'"}`,
    // Svelte sätter style-attribut och kan lägga in <style> vid övergångar.
    "style-src 'unsafe-inline'",
    'img-src data: blob:',
    'font-src data:',
    // Ingen nätverkstrafik alls: ingen telemetri, inga anrop hem (B-02).
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ')
}

/** Lägger in (eller ersätter) CSP-taggen direkt efter <meta charset>, före alla skript. */
export function addCsp(html) {
  const clean = html.replace(CSP_META, '')
  const tag = `<meta http-equiv="Content-Security-Policy" content="${buildCsp(scriptHashes(clean))}">`
  const charset = /<meta charset=[^>]*>/i
  if (!charset.test(clean)) throw new Error('Hittade ingen <meta charset> att placera CSP-taggen efter.')
  return clean.replace(charset, (m) => `${m}\n    ${tag}`)
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const dist = join(root, 'dist')
  const file = join(dist, 'index.html')
  const fail = (lines) => {
    console.error(['', '✗ Bygget är inte en fristående HTML-fil:', ...lines.map((l) => `  - ${l}`), ''].join('\n'))
    process.exit(1)
  }

  const extra = extraFiles(dist)
  if (extra.length) fail(extra.map((f) => `extra fil i dist/: ${f}`))

  const html = readFileSync(file, 'utf8')
  const refs = externalReferences(html)
  if (refs.length) fail(refs.map((r) => `extern hänvisning: ${r}`))

  const out = addCsp(html)
  writeFileSync(file, out, 'utf8')

  const kb = (Buffer.byteLength(out, 'utf8') / 1024).toFixed(0)
  console.log(`✓ dist/index.html: en fil, ${kb} kB, ${scriptHashes(out).length} inbäddat skript, CSP tillagd.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main()
