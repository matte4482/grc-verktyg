import { svelte } from '@sveltejs/vite-plugin-svelte'
import yaml from '@rollup/plugin-yaml'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    svelte(),
    // Gör att ramverksfilerna (src/lib/frameworks/*.yaml) kan importeras
    // direkt, både i appen och i testerna (vitest läser samma config). B-09.
    yaml(),
    // Bäddar in all JavaScript och CSS i index.html vid bygget (B-03).
    // Bara vid `vite build`; utvecklingsservern och testerna behöver den inte.
    command === 'build' && viteSingleFile(),
  ],
  // Ingen public-mapp: allt som ska med i verktyget importeras från src/
  // och bäddas in. Filer i public/ skulle hamna bredvid index.html i dist/.
  publicDir: false,
  define: {
    // Versionen ur package.json, visas i sidfoten och skrivs i rapporterna.
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev'),
  },
}))
