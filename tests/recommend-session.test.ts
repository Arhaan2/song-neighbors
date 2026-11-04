import { describe, expect, it } from 'vitest'
import { createRecommendationEngine } from '../src/recommend/engine.ts'
import { addNegative, addPositive, createSessionCatalog, createSession, editSeeds, resetRefinement, sessionRequestKey } from '../src/recommend/session.ts'
import { rankingFixture } from './fixtures/ranking.ts'

const engine = createRecommendationEngine(rankingFixture([
  { id: 'test:s1', vector: [1, 0] }, { id: 'test:s2', vector: [0, 1] },
  { id: 'test:a', vector: [0.8, 0.6], group: 'a' }, { id: 'test:a-copy', vector: [0.8, 0.6], group: 'a' },
  { id: 'test:b', vector: [-1, 0] }, { id: 'test:c', vector: [0, -1] },
]))

describe('session preferences independent of the seed selector', () => {
  it('adds idempotent positive feedback, resolves opposing groups and preserves selected seeds', () => {
    const initial = createSession(engine, ['test:s1'])
    const liked = addPositive(engine, initial, 'test:a')
    expect(liked.seedIds).toEqual(['test:s1'])
    expect(liked.positiveIds).toEqual(['test:a'])
    expect(addPositive(engine, liked, 'test:a')).toEqual(liked)
    expect(addPositive(engine, liked, 'test:a-copy')).toEqual(liked)
    const rejected = addNegative(engine, liked, 'test:a-copy')
    expect(rejected.positiveIds).toEqual([])
    expect(rejected.negativeIds).toEqual(['test:a-copy'])
    expect(addPositive(engine, rejected, 'test:a')).toEqual(liked)
    expect(() => addNegative(engine, liked, 'test:s1')).toThrow(/anchor/)
    expect(initial.positiveIds).toEqual([])
  })

  it('edits seeds by clearing refinement and reset retains current seeds with original seed-only ranking', () => {
    const initial = createSession(engine, ['test:s2', 'test:s1'])
    const initialRanking = engine.query(initial)
    const refined = addNegative(engine, addPositive(engine, initial, 'test:a'), 'test:b')
    expect(editSeeds(engine, refined, initial.seedIds)).toEqual(refined)
    const reset = resetRefinement(refined)
    expect(reset).toEqual(initial)
    expect(reset.seedIds).toEqual(['test:s2', 'test:s1'])
    expect(refined.seedIds).toEqual(['test:s2', 'test:s1'])
    expect(engine.query(reset)).toEqual(initialRanking)
    const edited = editSeeds(engine, refined, ['test:s2'])
    expect(edited).toEqual({ seedIds: ['test:s2'], positiveIds: [], negativeIds: [] })
    expect(resetRefinement(addPositive(engine, edited, 'test:c')).seedIds).toEqual(['test:s2'])
    expect(editSeeds(engine, refined, [])).toEqual({ seedIds: [], positiveIds: [], negativeIds: [] })
  })

  it('request identity includes seed/positive/negative state and ignores order and displayed history', () => {
    const initial = createSession(engine, ['test:s1', 'test:s2'])
    const liked = addPositive(engine, initial, 'test:a')
    const rejected = addNegative(engine, initial, 'test:a')
    expect(sessionRequestKey(initial)).not.toBe(sessionRequestKey(liked))
    expect(sessionRequestKey(liked)).not.toBe(sessionRequestKey(rejected))
    expect(sessionRequestKey(initial)).toBe(sessionRequestKey({ ...initial, seedIds: ['test:s2', 'test:s1'] }))
    expect(engine.query(initial)).toEqual(engine.query(initial))
    expect(engine.query(initial).requestKey).not.toBe(engine.query(liked).requestKey)
    expect(engine.query(initial).requestKey).not.toBe(engine.query({ ...initial, limit: 1 }).requestKey)
  })

  it('supports main-thread session actions using metadata without vectors', () => {
    const fixture = rankingFixture([
      { id: 'test:s', vector: [1, 0] },
      { id: 'test:a', vector: [0, 1], group: 'verified' },
      { id: 'test:b', vector: [0, 1], group: 'verified' },
    ])
    const context = createSessionCatalog(fixture.tracks)
    const liked = addPositive(context, createSession(context, ['test:s']), 'test:a')
    expect(addPositive(context, liked, 'test:b')).toEqual(liked)
    expect(addNegative(context, liked, 'test:b').positiveIds).toEqual([])
    expect(resetRefinement(liked).seedIds).toEqual(['test:s'])
  })

  it('rejects missing IDs and feedback without seeds without mutating state', () => {
    const empty = createSession(engine)
    expect(() => addPositive(engine, empty, 'test:a')).toThrow(/requires selected seeds/)
    const state = createSession(engine, ['test:s1'])
    expect(() => addNegative(engine, state, 'missing')).toThrow(/Unknown track ID/)
    expect(() => editSeeds(engine, state, ['missing'])).toThrow(/Unknown track ID/)
    expect(state).toEqual(createSession(engine, ['test:s1']))
  })
})
