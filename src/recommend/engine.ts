import type { CatalogTrack } from '../catalog/contract.ts'

export interface EngineCatalog {
  tracks: readonly CatalogTrack[]
  dimension: number
  vectors: Float64Array
}

/** Initial heuristics, not fitted or validated listener-preference parameters. */
export interface RankingConfig {
  closestSeedWeight: number
  positiveWeight: number
  negativeWeight: number
  diversityWeight: number
  neighborsPerAnchor: number
}

export const DEFAULT_RANKING_CONFIG: Readonly<RankingConfig> = Object.freeze({
  closestSeedWeight: 0.65,
  positiveWeight: 0.2,
  negativeWeight: 0.1,
  diversityWeight: 0.05,
  neighborsPerAnchor: 60,
})

export interface SessionState {
  seedIds: string[]
  positiveIds: string[]
  negativeIds: string[]
}

export interface RecommendationQuery {
  seedIds: readonly string[]
  positiveIds?: readonly string[]
  negativeIds?: readonly string[]
  limit?: number
  config?: Partial<RankingConfig>
}

export interface Recommendation {
  id: string
  row: number
  /** Ranking utility after explicit feedback and diversity, never enjoyment probability. */
  score: number
  closestSeedId: string
  closestSeedSimilarity: number
  averageSeedSimilarity: number
  positiveSimilarity: number
  negativeSimilarity: number
  diversityPenalty: number
}

export interface RecommendationResult {
  recommendations: Recommendation[]
  /** Number of distinct eligible verified recording groups, before retrieval. */
  eligibleCount: number
  candidateCount: number
  requestKey: string
}

const compareIds = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
const uniqueSorted = (ids: readonly string[]) => [...new Set(ids)].sort(compareIds)

function resolveConfig(input?: Partial<RankingConfig>): RankingConfig {
  const config = { ...DEFAULT_RANKING_CONFIG, ...input }
  if (Object.keys(config).some((key) => !Object.hasOwn(DEFAULT_RANKING_CONFIG, key))) throw new Error('Unknown ranking configuration')
  for (const key of ['closestSeedWeight', 'positiveWeight', 'negativeWeight', 'diversityWeight'] as const) {
    if (!Number.isFinite(config[key]) || config[key] < 0 || config[key] > (key === 'closestSeedWeight' ? 1 : 0.5)) {
      throw new Error(`Invalid ${key}`)
    }
  }
  if (!Number.isSafeInteger(config.neighborsPerAnchor) || config.neighborsPerAnchor < 1) throw new Error('Invalid neighborsPerAnchor')
  return config
}

export interface SessionCatalog {
  canonicalizeSession(input: Pick<RecommendationQuery, 'seedIds' | 'positiveIds' | 'negativeIds'>): SessionState
  recordingKey(id: string): string
}

/** Metadata-only identity index for the main thread; no vectors or ranking required. */
export function createSessionCatalog(tracks: readonly CatalogTrack[]): SessionCatalog {
  const ids = tracks.map((track) => track.id)
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length || tracks.some((track, index) => track.row !== index)) {
    throw new Error('Catalog row identity mismatch')
  }
  const rows = new Map(ids.map((id, row) => [id, row]))
  // Connected components allow a hash match and a verified group match to bridge identities.
  const parent = ids.map((_, row) => row)
  const find = (row: number): number => {
    let root = row
    while (parent[root] !== root) root = parent[root]!
    while (parent[row] !== row) { const next = parent[row]!; parent[row] = root; row = next }
    return root
  }
  const identities = new Map<string, number>()
  for (const [row, track] of tracks.entries()) {
    const keys = [`audio:${track.provenance.audioSha256}`]
    if (track.recordingGroupId) keys.push(`group:${track.recordingGroupId}`)
    for (const key of keys) {
      const previous = identities.get(key)
      if (previous !== undefined) parent[find(row)] = find(previous)
      else identities.set(key, row)
    }
  }
  const groupIds = new Map<number, string>()
  for (const [row, id] of ids.entries()) {
    const group = find(row)
    const previous = groupIds.get(group)
    if (!previous || compareIds(id, previous) < 0) groupIds.set(group, id)
  }
  const groupKeys = ids.map((_, row) => groupIds.get(find(row))!)
  const requireRow = (id: string): number => {
    const row = rows.get(id)
    if (row === undefined) throw new Error(`Unknown track ID: ${String(id)}`)
    return row
  }
  const recordingKey = (id: string) => groupKeys[requireRow(id)]!
  function canonicalizeSession(input: Pick<RecommendationQuery, 'seedIds' | 'positiveIds' | 'negativeIds'>): SessionState {
    const state: SessionState = {
      seedIds: uniqueSorted(input.seedIds),
      positiveIds: uniqueSorted(input.positiveIds ?? []),
      negativeIds: uniqueSorted(input.negativeIds ?? []),
    }
    if (state.seedIds.length > 5) throw new Error('Select at most five songs')
    const occupied = new Set<string>()
    for (const kind of ['seedIds', 'positiveIds', 'negativeIds'] as const) {
      const groups = new Set<string>()
      for (const id of state[kind]) {
        const group = recordingKey(id)
        if (occupied.has(group)) throw new Error('Conflicting seed or feedback recording groups')
        groups.add(group)
      }
      for (const group of groups) occupied.add(group)
    }
    return state
  }

  return { canonicalizeSession, recordingKey }
}

/** Exact scans only. Own a normalized copy so subsequent caller edits cannot alter results. */
export function createRecommendationEngine(catalog: EngineCatalog) {
  const { dimension } = catalog
  if (!Number.isSafeInteger(dimension) || dimension < 1 || !Number.isSafeInteger(catalog.tracks.length * dimension)
    || catalog.vectors.length !== catalog.tracks.length * dimension) throw new Error('Catalog vector shape mismatch')
  const ids = catalog.tracks.map((track) => track.id)
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length || catalog.tracks.some((track, index) => track.row !== index)) {
    throw new Error('Catalog row identity mismatch')
  }
  const rows = new Map(ids.map((id, row) => [id, row]))
  const vectors = new Float64Array(catalog.vectors)
  for (let row = 0; row < ids.length; row++) {
    let squareNorm = 0
    for (let column = 0; column < dimension; column++) {
      const value = vectors[row * dimension + column]!
      if (!Number.isFinite(value)) throw new Error(`Nonfinite vector: ${ids[row]}`)
      squareNorm += value * value
    }
    const norm = Math.sqrt(squareNorm)
    if (norm === 0 || !Number.isFinite(norm) || Math.abs(norm - 1) > 0.001) throw new Error(`Zero or nonnormalized vector: ${ids[row]}`)
    for (let column = 0; column < dimension; column++) vectors[row * dimension + column] = vectors[row * dimension + column]! / norm
  }
  const { canonicalizeSession, recordingKey } = createSessionCatalog(catalog.tracks)
  const groupKeys = ids.map(recordingKey)
  const requireRow = (id: string): number => {
    const row = rows.get(id)
    if (row === undefined) throw new Error(`Unknown track ID: ${String(id)}`)
    return row
  }
  const cosine = (left: number, right: number): number => {
    let dot = 0
    for (let column = 0; column < dimension; column++) dot += vectors[left * dimension + column]! * vectors[right * dimension + column]!
    return Math.max(-1, Math.min(1, dot))
  }


  function query(input: RecommendationQuery): RecommendationResult {
    const state = canonicalizeSession(input)
    const config = resolveConfig(input.config)
    const limit = input.limit ?? 20
    if (!Number.isSafeInteger(limit) || limit < 0 || limit > 20) throw new Error('Result limit must be an integer from zero to twenty')
    const requestKey = JSON.stringify({ ...state, limit, config })
    if (!state.seedIds.length) {
      if (state.positiveIds.length || state.negativeIds.length) throw new Error('Feedback requires selected seeds')
      return { recommendations: [], eligibleCount: 0, candidateCount: 0, requestKey }
    }
    const seedRows = state.seedIds.map(requireRow)
    const positiveRows = state.positiveIds.map(requireRow)
    const negativeRows = state.negativeIds.map(requireRow)
    const excludedGroups = new Set([...state.seedIds, ...state.positiveIds, ...state.negativeIds].map(recordingKey))
    const eligibleRows = ids.map((_, row) => row).filter((row) => !excludedGroups.has(groupKeys[row]!))
    const eligibleCount = new Set(eligibleRows.map((row) => groupKeys[row]!)).size
    if (!limit || !eligibleCount) return { recommendations: [], eligibleCount, candidateCount: 0, requestKey }
    const target = Math.min(limit, eligibleCount)
    const neighborhoods = [...seedRows, ...positiveRows].map((anchor) => eligibleRows.map((row) => ({ row, similarity: cosine(anchor, row) }))
      .sort((a, b) => b.similarity - a.similarity || compareIds(ids[a.row]!, ids[b.row]!)))
    let poolSize = Math.min(config.neighborsPerAnchor, eligibleRows.length)
    const retrieve = () => [...new Set(neighborhoods.flatMap((neighbors) => neighbors.slice(0, poolSize).map(({ row }) => row)))]
    let candidateRows = retrieve()
    while (new Set(candidateRows.map((row) => groupKeys[row]!)).size < target && poolSize < eligibleRows.length) {
      poolSize = Math.min(eligibleRows.length, poolSize * 2)
      candidateRows = retrieve()
    }

    const scored = candidateRows.map((row): Recommendation => {
      const seedScores = seedRows.map((seed) => cosine(seed, row))
      const closestSeedSimilarity = Math.max(...seedScores)
      const closestIndex = seedScores.indexOf(closestSeedSimilarity)
      const averageSeedSimilarity = seedScores.reduce((total, score) => total + score, 0) / seedRows.length
      const positiveSimilarity = positiveRows.length ? Math.max(...positiveRows.map((positive) => cosine(positive, row))) : 0
      const negativeSimilarity = negativeRows.length ? Math.max(0, ...negativeRows.map((negative) => cosine(negative, row))) : 0
      const seedScore = config.closestSeedWeight * closestSeedSimilarity + (1 - config.closestSeedWeight) * averageSeedSimilarity
      const anchoredScore = positiveRows.length ? (1 - config.positiveWeight) * seedScore + config.positiveWeight * positiveSimilarity : seedScore
      return {
        id: ids[row]!, row,
        score: anchoredScore - config.negativeWeight * negativeSimilarity,
        closestSeedId: state.seedIds[closestIndex]!, closestSeedSimilarity, averageSeedSimilarity,
        positiveSimilarity, negativeSimilarity, diversityPenalty: 0,
      }
    })
    const recommendations: Recommendation[] = []
    const usedGroups = new Set<string>()
    while (recommendations.length < target) {
      let best: Recommendation | undefined
      for (const candidate of scored) {
        if (usedGroups.has(groupKeys[candidate.row]!)) continue
        const diversityPenalty = config.diversityWeight * recommendations.reduce((maximum, chosen) => Math.max(maximum, cosine(candidate.row, chosen.row)), 0)
        const adjusted = { ...candidate, score: candidate.score - diversityPenalty, diversityPenalty }
        if (!best || adjusted.score > best.score || (adjusted.score === best.score && compareIds(adjusted.id, best.id) < 0)) best = adjusted
      }
      if (!best) break
      recommendations.push(best)
      usedGroups.add(groupKeys[best.row]!)
    }
    return { recommendations, eligibleCount, candidateCount: candidateRows.length, requestKey }
  }

  /** Auditable single-seed nearest-neighbor baseline, with no feedback or diversity. */
  function nearestNeighbors(seedId: string, limit = 20): RecommendationResult {
    return query({ seedIds: [seedId], limit, config: { diversityWeight: 0 } })
  }

  return { query, nearestNeighbors, canonicalizeSession, recordingKey }
}

export type RecommendationEngine = ReturnType<typeof createRecommendationEngine>
