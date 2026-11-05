import { describe, expect, it } from 'vitest'
import { composeDiscovery } from '../src/ui/discoveryComposition.ts'
import { createRecommendationEngine } from '../src/recommend/engine.ts'
import type { RecommendationResult } from '../src/recommend/engine.ts'
import { addNegative, addPositive, createSession, resetRefinement } from '../src/recommend/session.ts'
import { rankingFixture } from './fixtures/ranking.ts'

// Clearly isolated mathematical fixtures; this file supplies no product catalog data.
const fixture = rankingFixture([
  { id: 'test:one', title: 'First test anchor', vector: [1, 0] },
  { id: 'test:two', title: 'Second test anchor', vector: [0, 1] },
  { id: 'test:three', title: 'Third test anchor', vector: [-1, 0] },
  { id: 'test:four', title: 'Fourth test anchor', vector: [0, -1] },
  { id: 'test:five', title: 'Fifth test anchor', vector: [0.6, 0.8] },
  { id: 'test:a', title: 'Test candidate A', vector: [0.8, 0.6] },
  { id: 'test:b', title: 'Test candidate B', vector: [-0.6, 0.8] },
  { id: 'test:c', title: 'Test candidate C', vector: [0.6, -0.8] },
])
const engine = createRecommendationEngine(fixture)
const byId = new Map(fixture.tracks.map((track) => [track.id, track]))
const fiveSeeds = fixture.tracks.slice(0, 5).map((track) => track.id)

function snapshot(seedIds: string[]) {
  const session = createSession(engine, seedIds)
  return { session, resultStatus: 'ready' as const, result: engine.query(session) }
}

describe('deterministic discovery composition', () => {
  it('uses every selected seed, including zero-count lanes, without changing the ranked result', () => {
    const input = snapshot(fiveSeeds)
    const before = structuredClone(input)
    const view = composeDiscovery(input, byId)
    expect(view.stage).toBe('blend')
    expect(view.lanes.map((lane) => lane.id)).toEqual(fiveSeeds)
    expect(view.lanes.filter((lane) => lane.count === 0).length).toBeGreaterThan(0)
    expect(view.lanes.reduce((sum, lane) => sum + lane.count, 0)).toBe(input.result.recommendations.length)
    expect(view.resultIds).toEqual(input.result.recommendations.map((item) => item.id))
    for (const lane of view.lanes) {
      const neighbors = input.result.recommendations.filter((item) => item.closestSeedId === lane.id)
      expect(lane.firstResultId).toBe(neighbors[0]?.id ?? null)
      expect(lane.count).toBe(neighbors.length)
      expect(lane.title).toBe(byId.get(lane.id)!.title)
    }
    expect(input).toEqual(before)
  })

  it('clears the visual result for selection edits, loading and errors even with a stale payload', () => {
    const input = snapshot(['test:one'])
    for (const [resultStatus, stage] of [['idle', 'selection'], ['loading', 'loading'], ['error', 'error']] as const) {
      const view = composeDiscovery({ ...input, resultStatus }, byId)
      expect(view.stage).toBe(stage)
      expect(view.resultIds).toEqual([])
      expect(view.lanes).toEqual([{ id: 'test:one', title: 'First test anchor', artist: 'Synthetic test only', count: 0, firstResultId: null }])
    }
    expect(composeDiscovery({ ...input, session: createSession(engine) }, byId).stage).toBe('discover')
    const obsolete = { ...input, session: createSession(engine, ['test:two']) }
    expect(composeDiscovery(obsolete, byId).stage).toBe('selection')
    expect(composeDiscovery(obsolete, byId).resultIds).toEqual([])
  })

  it('represents actual feedback and restores the exact original composition after reset', () => {
    const initial = snapshot(['test:one'])
    const baseline = composeDiscovery(initial, byId)
    expect(baseline.stage).toBe('single')
    const positive = addPositive(engine, initial.session, initial.result.recommendations[0]!.id)
    const session = addNegative(engine, positive, engine.query(positive).recommendations[0]!.id)
    const view = composeDiscovery({ ...initial, session, result: engine.query(session) }, byId)
    expect(view.stage).toBe('refined')
    expect(view.positiveCount).toBe(1)
    expect(view.negativeCount).toBe(1)
    expect(view.resultIds.some((id) => session.positiveIds.includes(id) || session.negativeIds.includes(id))).toBe(false)
    const reset = resetRefinement(session)
    expect(composeDiscovery({ ...initial, session: reset, result: engine.query(reset) }, byId)).toEqual(baseline)
    expect(composeDiscovery(initial, byId)).toEqual(baseline)
  })

  it('represents an empty pool and missing metadata without fabricated cards or counts', () => {
    const input = snapshot(['test:one'])
    const exhausted: RecommendationResult = { ...input.result, recommendations: [], eligibleCount: 0, candidateCount: 0 }
    const empty = composeDiscovery({ ...input, result: exhausted }, byId)
    expect(empty.stage).toBe('empty')
    expect(empty.resultIds).toEqual([])
    expect(empty.lanes[0]!.count).toBe(0)
    expect(empty.lanes[0]!.firstResultId).toBeNull()
    const oneUnavailable = new Map(byId)
    const removed = input.result.recommendations[0]!.id
    oneUnavailable.delete(removed)
    const known = composeDiscovery(input, oneUnavailable)
    expect(known.resultIds).toEqual(input.result.recommendations.map((item) => item.id).filter((id) => id !== removed))
    expect(known.lanes[0]!.count).toBe(known.resultIds.length)
  })
})
