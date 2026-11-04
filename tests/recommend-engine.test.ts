import { describe, expect, it } from 'vitest'
import { createRecommendationEngine } from '../src/recommend/engine.ts'
import { rankingFixture } from './fixtures/ranking.ts'

const ids = (result: ReturnType<ReturnType<typeof createRecommendationEngine>['query']>) => result.recommendations.map((track) => track.id)

describe('exact mathematical ranking (not musical quality)', () => {
  it('retains the exact single-seed baseline, ID ties, negative cosine and truthful explanations', () => {
    const engine = createRecommendationEngine(rankingFixture([
      { id: 'test:s', vector: [1, 0] }, { id: 'test:b', vector: [0.8, 0.6] },
      { id: 'test:a', vector: [0.8, -0.6] }, { id: 'test:c', vector: [0, 1] },
      { id: 'test:d', vector: [-1, 0] },
    ]))
    const result = engine.nearestNeighbors('test:s')
    expect(ids(result)).toEqual(['test:a', 'test:b', 'test:c', 'test:d'])
    expect(result.recommendations.map((entry) => entry.score)).toEqual([0.8, 0.8, 0, -1])
    expect(result.recommendations.every((entry) => entry.closestSeedId === 'test:s')).toBe(true)
    expect(result.recommendations[0]?.closestSeedSimilarity).toBe(0.8)
    expect(result.eligibleCount).toBe(4)
  })

  it('unions each seed neighborhood and blends closest/mean instead of only the centroid', () => {
    const engine = createRecommendationEngine(rankingFixture([
      { id: 'test:s1', vector: [1, 0] }, { id: 'test:s2', vector: [0, 1] },
      { id: 'test:a', vector: [1, 0] }, { id: 'test:b', vector: [0, 1] },
      { id: 'test:c', vector: [Math.SQRT1_2, Math.SQRT1_2] },
    ]))
    const input = { seedIds: ['test:s2', 'test:s1'], limit: 2, config: { neighborsPerAnchor: 1, diversityWeight: 0 } }
    const result = engine.query(input)
    expect(ids(result)).toEqual(['test:a', 'test:b'])
    expect(result.candidateCount).toBe(2)
    expect(result.recommendations[0]?.score).toBeCloseTo(0.825, 14)
    expect(result.recommendations[0]?.averageSeedSimilarity).toBe(0.5)
    const full = engine.query({ ...input, limit: 3 })
    expect(full.recommendations.find((entry) => entry.id === 'test:c')?.closestSeedId).toBe('test:s1')
    expect(engine.query({ ...input, seedIds: ['test:s1', 'test:s2', 'test:s1'] })).toEqual(result)
  })

  it('positive feedback cannot recommend itself and introduces a new candidate neighborhood', () => {
    const engine = createRecommendationEngine(rankingFixture([
      { id: 'test:s', vector: [1, 0] }, { id: 'test:p', vector: [0, 1] },
      { id: 'test:a', vector: [0.8, -0.6] }, { id: 'test:b', vector: [0.6, 0.8] },
    ]))
    const input = { seedIds: ['test:s'], limit: 1, config: { neighborsPerAnchor: 1, diversityWeight: 0 } }
    expect(ids(engine.query(input))).toEqual(['test:a'])
    const refined = engine.query({ ...input, positiveIds: ['test:p'] })
    expect(ids(refined)).toEqual(['test:b'])
    expect(refined.candidateCount).toBe(2)
    expect(refined.recommendations[0]?.score).toBeCloseTo(0.64, 14)
    expect(refined.recommendations[0]?.closestSeedId).toBe('test:s')
  })

  it('negative feedback excludes the record and modestly penalizes related candidates', () => {
    const engine = createRecommendationEngine(rankingFixture([
      { id: 'test:s', vector: [1, 0] }, { id: 'test:n', vector: [0, 1] },
      { id: 'test:a', vector: [0.8, 0.6] }, { id: 'test:b', vector: [0.79, -Math.sqrt(1 - 0.79 ** 2)] },
    ]))
    const result = engine.query({ seedIds: ['test:s'], negativeIds: ['test:n'], config: { diversityWeight: 0 } })
    expect(ids(result)).toEqual(['test:b', 'test:a'])
    expect(result.recommendations[1]?.score).toBeCloseTo(0.74, 14)
    expect(result.recommendations[1]?.negativeSimilarity).toBeCloseTo(0.6, 14)
    expect(result.recommendations[0]?.negativeSimilarity).toBe(0)
  })

  it('uses modest greedy diversity while keeping exact baseline available', () => {
    const engine = createRecommendationEngine(rankingFixture([
      { id: 'test:s', vector: [1, 0] }, { id: 'test:a', vector: [0.8, 0.6] },
      { id: 'test:b', vector: [0.8, 0.6] }, { id: 'test:c', vector: [0.79, -Math.sqrt(1 - 0.79 ** 2)] },
    ]))
    expect(ids(engine.nearestNeighbors('test:s'))).toEqual(['test:a', 'test:b', 'test:c'])
    const result = engine.query({ seedIds: ['test:s'] })
    expect(ids(result)).toEqual(['test:a', 'test:c', 'test:b'])
    expect(result.recommendations[0]?.diversityPenalty).toBe(0)
    expect(result.recommendations[2]?.diversityPenalty).toBeCloseTo(0.05, 14)
    expect(engine.query({ seedIds: ['test:s'] })).toEqual(result)
  })

  it('excludes transitive verified duplicates of seeds and both feedback kinds, never titles', () => {
    const engine = createRecommendationEngine(rankingFixture([
      { id: 'test:s', vector: [1, 0], hash: 'seed-hash' },
      { id: 'test:s-copy', vector: [1, 0], hash: 'seed-hash', group: 'seed-group' },
      { id: 'test:s-bridge', vector: [1, 0], group: 'seed-group' },
      { id: 'test:p', vector: [0, 1], group: 'positive-group' },
      { id: 'test:p-copy', vector: [0, 1], group: 'positive-group' },
      { id: 'test:n', vector: [-1, 0], hash: 'negative-hash' },
      { id: 'test:n-copy', vector: [-1, 0], hash: 'negative-hash' },
      { id: 'test:a', vector: [0.8, 0.6], title: 'Shared title' },
      { id: 'test:b', vector: [0.6, 0.8], title: 'Shared title' },
    ]))
    const result = engine.query({ seedIds: ['test:s'], positiveIds: ['test:p'], negativeIds: ['test:n'] })
    expect(ids(result).sort()).toEqual(['test:a', 'test:b'])
    expect(result.eligibleCount).toBe(2)
    expect(engine.recordingKey('test:s-bridge')).toBe(engine.recordingKey('test:s'))
    expect(() => engine.query({ seedIds: ['test:s'], positiveIds: ['test:s-bridge'] })).toThrow(/Conflicting/)
    expect(() => engine.query({ seedIds: ['test:s'], positiveIds: ['test:p'], negativeIds: ['test:p-copy'] })).toThrow(/Conflicting/)
  })

  it('expands the candidate pool past duplicate groups and does not pad an undersized catalog', () => {
    const engine = createRecommendationEngine(rankingFixture([
      { id: 'test:s', vector: [1, 0] }, { id: 'test:a', vector: [0.8, 0.6], group: 'same' },
      { id: 'test:b', vector: [0.8, 0.6], group: 'same' }, { id: 'test:c', vector: [0, 1] },
    ]))
    const result = engine.query({ seedIds: ['test:s'], config: { neighborsPerAnchor: 1 } })
    expect(ids(result)).toEqual(['test:a', 'test:c'])
    expect(result.eligibleCount).toBe(2)
    expect(result.candidateCount).toBe(3)
    expect(engine.query({ seedIds: ['test:s', 'test:a', 'test:c'] }).recommendations).toEqual([])
  })

  it('handles empty input and rejects invalid IDs, too many seeds and malformed configuration', () => {
    const engine = createRecommendationEngine(rankingFixture(Array.from({ length: 6 }, (_, index) => ({ id: `test:${index}`, vector: [1, 0] }))))
    expect(engine.query({ seedIds: [] }).recommendations).toEqual([])
    expect(engine.query({ seedIds: ['test:0'], limit: 0 }).recommendations).toEqual([])
    expect(() => engine.query({ seedIds: [], positiveIds: ['test:1'] })).toThrow(/requires selected seeds/)
    expect(() => engine.query({ seedIds: ['missing'] })).toThrow(/Unknown track ID/)
    expect(() => engine.query({ seedIds: ['test:0'], negativeIds: ['missing'] })).toThrow(/Unknown track ID/)
    expect(() => engine.query({ seedIds: Array.from({ length: 6 }, (_, index) => `test:${index}`) })).toThrow(/at most five/)
    expect(() => engine.query({ seedIds: ['test:0'], limit: 21 })).toThrow(/limit/)
    expect(() => engine.query({ seedIds: ['test:0'], config: { positiveWeight: 0.6 } })).toThrow(/positiveWeight/)
    expect(() => engine.query({ seedIds: ['test:0'], config: { negativeWeight: NaN } })).toThrow(/negativeWeight/)
    expect(() => engine.query({ seedIds: ['test:0'], config: { neighborsPerAnchor: 0 } })).toThrow(/neighborsPerAnchor/)
  })

  it('rejects malformed vector and row identity even when called without the browser loader', () => {
    for (const vector of [[0, 0], [NaN, 1], [Infinity, 0], [2, 0]]) {
      expect(() => createRecommendationEngine(rankingFixture([{ id: 'test:s', vector }]))).toThrow(/vector/)
    }
    const fixture = rankingFixture([{ id: 'test:s', vector: [1, 0] }, { id: 'test:a', vector: [0.8, 0.6] }])
    expect(() => createRecommendationEngine({ ...fixture, dimension: 3 })).toThrow(/shape/)
    expect(() => createRecommendationEngine({ ...fixture, tracks: [{ ...fixture.tracks[0]!, row: 1 }, fixture.tracks[1]!] })).toThrow(/identity/)
    const engine = createRecommendationEngine(fixture)
    fixture.vectors[0] = 0
    expect(engine.nearestNeighbors('test:s').recommendations[0]?.score).toBe(0.8)
  })
})
