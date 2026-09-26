<script lang="ts">
  // Fas 0: ett skal som visar att bygget, ramverken och datamodellen fungerar.
  // Startsidan med "Nytt arbete" och "Öppna" byggs i fas 2, sparandet i fas 1.
  import { FRAMEWORKS, countControls } from './lib/frameworks'
  import { PROJECT_SCHEMA_VERSION } from './lib/project/schema'

  const version = __APP_VERSION__
</script>

<header class="app">
  <div class="wrap">
    <div class="eyebrow">Method</div>
    <h1>GRC-verktyget</h1>
  </div>
</header>

<main class="wrap">
  <section class="card">
    <h2>Ramverk</h2>
    <ul class="frameworks">
      {#each FRAMEWORKS as entry (entry.id + entry.version)}
        <li class:upcoming={!entry.framework}>
          <span class="name">{entry.name}</span>
          {#if entry.framework}
            <span class="meta">
              {countControls(entry.framework, 'clauses')} krav ·
              {countControls(entry.framework, 'annex-a')} kontroller
            </span>
          {:else}
            <span class="badge">Kommer</span>
          {/if}
        </li>
      {/each}
    </ul>
  </section>

  <p class="info">Bedömningen sparas som en fil i kundens mapp. Inget lagras hos Method IT.</p>
</main>

<footer class="wrap">
  Version {version} · projektfilformat {PROJECT_SCHEMA_VERSION}
</footer>
