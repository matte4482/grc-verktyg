import { z } from 'zod'

// Projektfilens format (.grc.json), se ARCHITECTURE B-10 och B-17.
//
// Regler:
// - Beräknade värden sparas aldrig (riskvärde, nivå, faktisk restrisk, uppfyllnadsgrad).
// - Nya fält läggs till som valfria, så att äldre projektfiler fortsätter validera.
// - Kontroller som saknas i `controls` tolkas som ej bedömda och tillämpliga.
// - Kopplingar mot ramverket (okända kontroll-ID:n, SoA-lås) kontrolleras i
//   checkAgainstFramework() i project.ts, eftersom schemat inte känner till ramverket.

export const PROJECT_SCHEMA_VERSION = 1

// ── Grundtyper ──────────────────────────────────────────────────────────────

const isoDate = z.iso.date() // "2026-09-22"
const isoDateTime = z.iso.datetime({ offset: true }) // "2026-09-22T14:42:00Z"
const text = z.string() // fritext, får vara tom
const name = z.string().min(1)

export const RISK_ID = /^R-\d{3,}$/
export const ACTION_ID = /^ATG-\d{3,}$/
export const EVIDENCE_ID = /^EV-\d{3,}$/

export const StatusSchema = z.enum(['not_assessed', 'fulfilled', 'partial', 'not_fulfilled'])

export const TreatmentSchema = z.enum(['undecided', 'reduce', 'share', 'accept', 'avoid'])

export const ActionStatusSchema = z.enum(['not_started', 'in_progress', 'done'])

/** Nivå 1–5 i riskmetodens skalor. */
export const LevelSchema = z.int().min(1).max(5)

export const RiskScoreSchema = z.object({
  consequence: LevelSchema,
  likelihood: LevelSchema,
})

export const ChangeSchema = z.object({
  at: isoDateTime,
  by: text,
})

// ── Evidens ─────────────────────────────────────────────────────────────────

export const EvidenceSchema = z.object({
  id: z.string().regex(EVIDENCE_ID, 'Evidens-ID ska ha formen EV-001'),
  file: name, // sökväg relativt projektfilen, t.ex. "evidens/Natverkspolicy_v2.1.pdf"
  size: z.int().min(0),
  sha256: z.string().regex(/^[0-9a-f]{64}$/), // upptäcker flyttad eller ändrad fil
  source: z.enum(['manual', 'automatic']), // automatic = importerad från t.ex. CloudSecComp
  addedBy: text,
  addedAt: isoDateTime,
  note: text.optional(),
})

// ── Kontroller och grundkrav ────────────────────────────────────────────────

export const ControlAssessmentSchema = z.object({
  status: StatusSchema,
  /**
   * Valfri uppdelning i teknisk och organisatorisk del (B-18). Övergripande
   * `status` sätts alltid av konsulten; delarna är underlag, inte en beräkning.
   */
  parts: z
    .object({
      technical: StatusSchema.optional(),
      organizational: StatusSchema.optional(),
    })
    .optional(),
  comment: text.default(''),
  owner: text.default(''),
  /** Fritextreferens till dokument eller system, när ingen fil bifogas. */
  evidenceNote: text.default(''),
  evidence: z.array(EvidenceSchema).default([]),
  /** Gäller bara kontroller i avsnitt med soa: true. */
  applicable: z.boolean().default(true),
  soaJustification: text.default(''),
  updated: ChangeSchema.optional(),
})

// ── Riskmetod ───────────────────────────────────────────────────────────────

export const RiskMethodSchema = z
  .object({
    consequence: z.object({
      types: z.array(name).min(1), // t.ex. "Verksamhet och ekonomi"
      levels: z
        .array(
          z.object({
            level: LevelSchema,
            name: name,
            descriptions: z.array(text), // en per konsekvenstyp
          }),
        )
        .length(5),
    }),
    likelihood: z.object({
      levels: z
        .array(
          z.object({
            level: LevelSchema,
            name: name,
            frequency: text,
            interpretation: text,
          }),
        )
        .length(5),
    }),
    acceptanceThreshold: z.int().min(1).max(25),
    reviewIntervalMonths: z.int().min(1),
    approvedBy: text.default(''),
    approvedAt: isoDate.optional(),
  })
  .superRefine((m, ctx) => {
    m.consequence.levels.forEach((l, i) => {
      if (l.descriptions.length !== m.consequence.types.length)
        ctx.addIssue({
          code: 'custom',
          path: ['consequence', 'levels', i, 'descriptions'],
          message: `Nivå ${l.level} har ${l.descriptions.length} beskrivningar men det finns ${m.consequence.types.length} konsekvenstyper`,
        })
    })
  })

// ── Risker ──────────────────────────────────────────────────────────────────

/**
 * Koppling mellan risk och kontroll. Effekt och typ är valfria tills
 * regeln för restrisk är beslutad (ARCHITECTURE Ö-03).
 */
export const RiskControlLinkSchema = z.object({
  control: name, // kontroll-ID, t.ex. "A.8.20"
  effect: z.enum(['low', 'medium', 'high']).optional(),
  type: z.enum(['preventive', 'limiting']).optional(), // sänker sannolikhet resp. konsekvens
})

export const RiskSchema = z.object({
  id: z.string().regex(RISK_ID, 'Risk-ID ska ha formen R-001'),
  title: name,
  description: text.default(''),
  threat: text.default(''),
  vulnerability: text.default(''),
  assets: z.array(name).default([]),
  owner: text.default(''),
  before: RiskScoreSchema.optional(),
  planned: RiskScoreSchema.optional(),
  treatment: TreatmentSchema.default('undecided'),
  treatmentPlan: text.default(''),
  controls: z.array(RiskControlLinkSchema).default([]),
  evidence: z.array(EvidenceSchema).default([]),
  /** ID på typrisken den skapades från, om någon. */
  template: z.string().optional(),
  identifiedAt: isoDate,
  lastAssessedAt: isoDate.optional(),
  approval: z
    .object({
      by: name,
      at: isoDate,
      /** Aktivt beslut att acceptera restrisk över acceptansnivån. Kräver motivering. */
      aboveThreshold: z.boolean().default(false),
      justification: text.default(''),
    })
    .refine((a) => !a.aboveThreshold || a.justification.trim() !== '', {
      message: 'Godkännande över acceptansnivån kräver en motivering',
      path: ['justification'],
    })
    .nullable()
    .default(null),
  history: z.array(ChangeSchema.extend({ text: name })).default([]),
})

// ── Åtgärder ────────────────────────────────────────────────────────────────

export const ActionSchema = z.object({
  id: z.string().regex(ACTION_ID, 'Åtgärds-ID ska ha formen ATG-001'),
  title: name,
  description: text.default(''),
  owner: text.default(''),
  due: isoDate.optional(),
  status: ActionStatusSchema.default('not_started'),
  /** Varifrån åtgärden kom. `id` är kontroll- eller risk-ID. */
  source: z.discriminatedUnion('type', [
    z.object({ type: z.literal('control'), id: name }),
    z.object({ type: z.literal('risk'), id: z.string().regex(RISK_ID) }),
    z.object({ type: z.literal('manual') }),
  ]),
  controls: z.array(name).default([]),
  risks: z.array(z.string().regex(RISK_ID)).default([]),
  createdAt: isoDate,
  completedAt: isoDate.optional(),
})

// ── Projektfilen ────────────────────────────────────────────────────────────

export const ProjectSchema = z
  .object({
    schemaVersion: z.literal(PROJECT_SCHEMA_VERSION),
    tool: z.literal('method-grc'),
    /** Unikt ID för bedömningen. */
    id: z.uuid(),
    /** ID på bedömningen den här utgår från (fas 7, jämförelse). */
    previousId: z.uuid().optional(),
    client: z.object({ name: name }),
    framework: z.object({ id: name, version: name }),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,

    riskMethod: RiskMethodSchema.optional(),
    risks: z.array(RiskSchema).default([]),
    controls: z.record(z.string(), ControlAssessmentSchema).default({}),
    actions: z.array(ActionSchema).default([]),

    /**
     * Nästa lediga löpnummer. ID:n återanvänds aldrig, inte ens när en risk
     * eller åtgärd tas bort, så att två bedömningar kan jämföras (fas 7).
     */
    nextNumber: z
      .object({
        risk: z.int().min(1),
        action: z.int().min(1),
        evidence: z.int().min(1),
      })
      .default({ risk: 1, action: 1, evidence: 1 }),
  })
  .superRefine((p, ctx) => {
    const unique = (ids: string[], kind: string, path: string) => {
      const seen = new Set<string>()
      for (const id of ids) {
        if (seen.has(id)) ctx.addIssue({ code: 'custom', path: [path], message: `Dubblett-ID för ${kind}: ${id}` })
        seen.add(id)
      }
    }
    unique(p.risks.map((r) => r.id), 'risk', 'risks')
    unique(p.actions.map((a) => a.id), 'åtgärd', 'actions')
    const evidenceIds = [...Object.values(p.controls), ...p.risks].flatMap((x) => x.evidence.map((e) => e.id))
    unique(evidenceIds, 'evidens', 'controls')

    const numberOf = (id: string) => Number(id.slice(id.lastIndexOf('-') + 1))
    const maxOf = (ids: string[]) => ids.reduce((m, id) => Math.max(m, numberOf(id)), 0)
    const checks: [keyof typeof p.nextNumber, number][] = [
      ['risk', maxOf(p.risks.map((r) => r.id))],
      ['action', maxOf(p.actions.map((a) => a.id))],
      ['evidence', maxOf(evidenceIds)],
    ]
    for (const [kind, max] of checks)
      if (p.nextNumber[kind] <= max)
        ctx.addIssue({
          code: 'custom',
          path: ['nextNumber', kind],
          message: `nextNumber.${kind} är ${p.nextNumber[kind]} men högsta använda nummer är ${max}`,
        })
  })

export type Status = z.infer<typeof StatusSchema>
export type Treatment = z.infer<typeof TreatmentSchema>
export type ActionStatus = z.infer<typeof ActionStatusSchema>
export type Evidence = z.infer<typeof EvidenceSchema>
export type ControlAssessment = z.infer<typeof ControlAssessmentSchema>
export type RiskMethod = z.infer<typeof RiskMethodSchema>
export type RiskControlLink = z.infer<typeof RiskControlLinkSchema>
export type Risk = z.infer<typeof RiskSchema>
export type Action = z.infer<typeof ActionSchema>
export type Project = z.infer<typeof ProjectSchema>
