import { svelte } from '@sveltejs/vite-plugin-svelte'
import yaml from '@rollup/plugin-yaml'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // yaml(): gör att ramverksfilerna (src/lib/frameworks/*.yaml) kan importeras
  // direkt, både i appen och i testerna (vitest läser samma config).
  plugins: [svelte(), yaml()],
})
