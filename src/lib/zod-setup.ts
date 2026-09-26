import { z } from 'zod'

// Zod provar annars att snabba upp valideringen genom att generera kod med
// `new Function`. Verktygets CSP förbjuder det (B-20), och försöket ger då
// varningar i konsolen. Importeras först i main.ts, före allt som validerar.
z.config({ jitless: true })
