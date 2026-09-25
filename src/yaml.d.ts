// Typdeklaration för YAML-importer via @rollup/plugin-yaml.
// Innehållet valideras med zod (src/lib/frameworks/schema.ts), därför "unknown".
declare module '*.yaml' {
  const data: unknown
  export default data
}
