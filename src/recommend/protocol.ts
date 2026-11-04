import { z } from 'zod'
import type { CatalogManifest, CatalogTrack } from '../catalog/contract.ts'
import type { RecommendationQuery, RecommendationResult } from './engine.ts'

const requestId = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
export const requestSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('load'), requestId, catalogRoot: z.url() }),
  z.strictObject({
    type: z.literal('query'), requestId, queryKey: z.string(),
    query: z.strictObject({
      seedIds: z.array(z.string()), positiveIds: z.array(z.string()).optional(),
      negativeIds: z.array(z.string()).optional(), limit: z.number().optional(),
      config: z.record(z.string(), z.number()).optional(),
    }),
  }),
])
export type WorkerRequest =
  | { type: 'load'; requestId: number; catalogRoot: string }
  | { type: 'query'; requestId: number; queryKey: string; query: RecommendationQuery }
export type CatalogSummary = { manifest: CatalogManifest; tracks: CatalogTrack[] }
export type WorkerResponse =
  | { type: 'loaded'; requestId: number; catalog: CatalogSummary }
  | { type: 'result'; requestId: number; queryKey: string; result: RecommendationResult }
  | { type: 'error'; requestId: number | null; operation: 'load' | 'query' | 'protocol'; code: string; message: string; queryKey?: string }

/** Full session/config identity, independent of insertion order; no display-history exclusions. */
export function queryIdentity(query: RecommendationQuery): string {
  const ids = (values: readonly string[] = []) => [...new Set(values)].sort()
  return JSON.stringify({
    seedIds: ids(query.seedIds), positiveIds: ids(query.positiveIds), negativeIds: ids(query.negativeIds),
    limit: query.limit ?? 20,
    config: Object.fromEntries(Object.entries(query.config ?? {}).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)),
  })
}
