import { describe, expect, it, vi } from 'vitest'
import { activeTestCatalog } from './fixtures/active-catalog.ts'
import { RecommendationWorkerError } from '../src/recommend/client.ts'
import { createRecommendationEngine, type RecommendationResult } from '../src/recommend/engine.ts'
import type { CatalogSummary } from '../src/recommend/protocol.ts'
import { createSongNeighborsController, type SongNeighborsClient } from '../src/ui/controller.ts'
import { rankingFixture } from './fixtures/ranking.ts'

// Only the orchestration fixtures are synthetic. Production data and ranking remain unchanged.
const fixture = rankingFixture([
  { id: 'test:a', vector: [1, 0] },
  { id: 'test:b', vector: [0.8, 0.6] },
  { id: 'test:c', vector: [0, 1] },
  { id: 'test:d', vector: [-0.8, 0.6] },
  { id: 'test:e', vector: [-1, 0] },
  { id: 'test:f', vector: [0, -1] },
  { id: 'test:g', vector: [0.6, -0.8] },
])
const engine = createRecommendationEngine(fixture)
const { manifest } = activeTestCatalog()
const catalog: CatalogSummary = { manifest, tracks: [...fixture.tracks] }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function immediateClient(): SongNeighborsClient {
  return { load: vi.fn(async () => catalog), query: vi.fn(async (query) => engine.query(query)), dispose: vi.fn() }
}

async function ready(client = immediateClient()) {
  const controller = createSongNeighborsController(() => client)
  controller.start()
  await vi.waitFor(() => expect(controller.getSnapshot().catalogStatus).toBe('ready'))
  return controller
}

async function settled(controller: ReturnType<typeof createSongNeighborsController>) {
  await vi.waitFor(() => expect(controller.getSnapshot().resultStatus).toBe('ready'))
  return controller.getSnapshot().result!
}

async function flush() {
  for (let turn = 0; turn < 10; turn++) await Promise.resolve()
}

describe('selection-to-recommendation orchestration', () => {
  it('waits for explicit Recommend, enforces 1–5 unique seeds and immediately clears results on edit', async () => {
    const client = immediateClient()
    const controller = await ready(client)
    controller.actions.addSeed('test:a')
    controller.actions.addSeed('test:a')
    expect(controller.getSnapshot().session.seedIds).toEqual(['test:a'])
    expect(client.query).not.toHaveBeenCalled()
    controller.actions.recommend()
    const result = await settled(controller)
    expect(result.recommendations).toHaveLength(6)
    expect(result.recommendations.some((item) => item.id === 'test:a')).toBe(false)
    for (const track of fixture.tracks) controller.actions.addSeed(track.id)
    expect(controller.getSnapshot().session.seedIds).toEqual(['test:a', 'test:b', 'test:c', 'test:d', 'test:e'])
    expect(controller.getSnapshot().resultStatus).toBe('idle')
    expect(controller.getSnapshot().result).toBeNull()
    controller.actions.removeSeed('test:c')
    expect(controller.getSnapshot().session.seedIds).toEqual(['test:a', 'test:b', 'test:d', 'test:e'])
    controller.dispose()
  })

  it('keeps positive/negative preferences separate, excludes feedback and reset restores seed-only ranking', async () => {
    const controller = await ready()
    controller.actions.addSeed('test:a')
    controller.actions.recommend()
    const initial = await settled(controller)
    const liked = initial.recommendations[0]!.id
    controller.actions.moreLike(liked)
    const refined = await settled(controller)
    expect(controller.getSnapshot().session).toEqual({ seedIds: ['test:a'], positiveIds: [liked], negativeIds: [] })
    expect(refined.recommendations.some((item) => item.id === liked)).toBe(false)
    const rejected = refined.recommendations[0]!.id
    controller.actions.notThisMood(rejected)
    expect((await settled(controller)).recommendations.some((item) => item.id === rejected)).toBe(false)
    controller.actions.reset()
    expect(await settled(controller)).toEqual(initial)
    expect(controller.getSnapshot().session).toEqual({ seedIds: ['test:a'], positiveIds: [], negativeIds: [] })
    controller.actions.moreLike(liked)
    await settled(controller)
    controller.actions.addSeed('test:c')
    expect(controller.getSnapshot().session).toEqual({ seedIds: ['test:a', 'test:c'], positiveIds: [], negativeIds: [] })
    expect(controller.getSnapshot().result).toBeNull()
    controller.dispose()
  })

  it.each(['success', 'error'] as const)('ignores an old %s after removing the last chip during a query', async (outcome) => {
    const pending = deferred<RecommendationResult>()
    const client = immediateClient()
    client.query = vi.fn((query) => query.seedIds.length ? pending.promise : Promise.resolve(engine.query(query)))
    const controller = await ready(client)
    controller.actions.addSeed('test:a')
    controller.actions.recommend()
    controller.actions.removeSeed('test:a')
    expect(client.query).toHaveBeenLastCalledWith({ seedIds: [], positiveIds: [], negativeIds: [] })
    if (outcome === 'success') pending.resolve(engine.query({ seedIds: ['test:a'] }))
    else pending.reject(new Error('obsolete error'))
    await flush()
    expect(controller.getSnapshot().session.seedIds).toEqual([])
    expect(controller.getSnapshot().resultStatus).toBe('idle')
    expect(controller.getSnapshot().resultError).toBeNull()
    expect(controller.getSnapshot().result).toBeNull()
    controller.dispose()
  })

  it('guards a settled response whose continuation runs after the seed edit', async () => {
    const pending = deferred<RecommendationResult>()
    const client = immediateClient()
    client.query = vi.fn((query) => query.seedIds.length ? pending.promise : Promise.resolve(engine.query(query)))
    const controller = await ready(client)
    controller.actions.addSeed('test:a')
    controller.actions.recommend()
    pending.resolve(engine.query({ seedIds: ['test:a'] }))
    controller.actions.addSeed('test:c')
    await flush()
    expect(controller.getSnapshot().session.seedIds).toEqual(['test:a', 'test:c'])
    expect(controller.getSnapshot().resultStatus).toBe('idle')
    expect(controller.getSnapshot().result).toBeNull()
    controller.dispose()
  })

  it.each(['success', 'error'] as const)('reset wins over a delayed feedback %s', async (outcome) => {
    const pending = deferred<RecommendationResult>()
    const client = immediateClient()
    client.query = vi.fn((query) => query.positiveIds?.length ? pending.promise : Promise.resolve(engine.query(query)))
    const controller = await ready(client)
    controller.actions.addSeed('test:a')
    controller.actions.recommend()
    const initial = await settled(controller)
    const liked = initial.recommendations[0]!.id
    controller.actions.moreLike(liked)
    controller.actions.reset()
    expect(await settled(controller)).toEqual(initial)
    if (outcome === 'success') pending.resolve(engine.query({ seedIds: ['test:a'], positiveIds: [liked] }))
    else pending.reject(new Error('obsolete feedback error'))
    await flush()
    expect(controller.getSnapshot().result).toEqual(initial)
    expect(controller.getSnapshot().resultError).toBeNull()
    controller.dispose()
  })

  it('recreates a failed worker and restores current chips and preferences before retrying', async () => {
    const first = immediateClient()
    first.query = vi.fn(async (query) => {
      if (query.positiveIds?.length) throw new RecommendationWorkerError('worker-failed', 'crashed')
      return engine.query(query)
    })
    const second = immediateClient()
    const factory = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second)
    const controller = createSongNeighborsController(factory)
    controller.start()
    await vi.waitFor(() => expect(controller.getSnapshot().catalogStatus).toBe('ready'))
    controller.actions.addSeed('test:a')
    controller.actions.recommend()
    const liked = (await settled(controller)).recommendations[0]!.id
    controller.actions.moreLike(liked)
    await vi.waitFor(() => expect(controller.getSnapshot().resultStatus).toBe('error'))
    controller.actions.retryRecommendations()
    const result = await settled(controller)
    expect(first.dispose).toHaveBeenCalledOnce()
    expect(second.load).toHaveBeenCalledOnce()
    expect(second.query).toHaveBeenLastCalledWith({ seedIds: ['test:a'], positiveIds: [liked], negativeIds: [] })
    expect(result.recommendations.some((item) => item.id === liked)).toBe(false)
    expect(controller.getSnapshot().session.seedIds).toEqual(['test:a'])
    controller.dispose()
  })

  it('an edit during recovery cancels automatic resubmission and preserves the edited chips', async () => {
    const first = immediateClient()
    const load = deferred<CatalogSummary>()
    const second = immediateClient()
    second.load = vi.fn(() => load.promise)
    const factory = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second)
    const controller = createSongNeighborsController(factory)
    controller.start()
    await vi.waitFor(() => expect(controller.getSnapshot().catalogStatus).toBe('ready'))
    controller.actions.addSeed('test:a')
    controller.actions.addSeed('test:c')
    controller.actions.retryRecommendations()
    await flush()
    controller.actions.removeSeed('test:a')
    load.resolve(catalog)
    await flush()
    expect(controller.getSnapshot().session.seedIds).toEqual(['test:c'])
    expect(controller.getSnapshot().resultStatus).toBe('idle')
    expect(second.query).not.toHaveBeenCalled()
    controller.dispose()
  })

  it('distinguishes unavailable catalogs from retryable failures and retries with a fresh client', async () => {
    const unavailable = immediateClient()
    unavailable.load = vi.fn(async () => { throw new RecommendationWorkerError('not-ready', 'No data') })
    const failed = immediateClient()
    failed.load = vi.fn(async () => { throw new RecommendationWorkerError('network', 'offline') })
    const factory = vi.fn().mockReturnValueOnce(unavailable).mockReturnValueOnce(failed).mockReturnValueOnce(immediateClient())
    const controller = createSongNeighborsController(factory)
    controller.start()
    await vi.waitFor(() => expect(controller.getSnapshot().catalogStatus).toBe('unavailable'))
    controller.actions.retryCatalog()
    await vi.waitFor(() => expect(controller.getSnapshot().catalogStatus).toBe('error'))
    controller.actions.retryCatalog()
    await vi.waitFor(() => expect(controller.getSnapshot().catalogStatus).toBe('ready'))
    expect(factory).toHaveBeenCalledTimes(3)
    expect(unavailable.dispose).toHaveBeenCalledOnce()
    expect(failed.dispose).toHaveBeenCalledOnce()
    controller.dispose()
  })

  it('survives StrictMode start/dispose/start and ignores stale load completions after disposal', async () => {
    const oldLoad = deferred<CatalogSummary>()
    const first = immediateClient()
    first.load = vi.fn(() => oldLoad.promise)
    const second = immediateClient()
    const factory = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second)
    const controller = createSongNeighborsController(factory)
    const listener = vi.fn()
    const unsubscribe = controller.subscribe(listener)
    controller.start()
    await flush()
    controller.dispose()
    controller.start()
    await flush()
    expect(controller.getSnapshot().catalogStatus).toBe('ready')
    controller.actions.addSeed('test:a')
    oldLoad.reject(new Error('obsolete load failed'))
    await flush()
    expect(controller.getSnapshot().catalogStatus).toBe('ready')
    expect(controller.getSnapshot().session.seedIds).toEqual(['test:a'])
    controller.dispose()
    const updates = listener.mock.calls.length
    controller.actions.recommend()
    await flush()
    expect(listener).toHaveBeenCalledTimes(updates)
    expect(first.dispose).toHaveBeenCalledOnce()
    expect(second.dispose).toHaveBeenCalledOnce()
    unsubscribe()
  })

  it('reports Worker construction failure without throwing into React', async () => {
    const controller = createSongNeighborsController(() => { throw new Error('Worker unavailable') })
    controller.start()
    await flush()
    expect(controller.getSnapshot().catalogStatus).toBe('error')
    expect(controller.getSnapshot().catalogError).toContain('try again')
    controller.dispose()
  })
})
