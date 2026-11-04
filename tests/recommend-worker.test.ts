import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { loadCatalog, CatalogLoadError } from '../src/catalog/load.ts'
import { createWorkerHandler } from '../src/recommend/worker-runtime.ts'
import { createWorkerClient, SupersededRequestError } from '../src/recommend/client.ts'
import { queryIdentity } from '../src/recommend/protocol.ts'
import type { WorkerRequest, WorkerResponse } from '../src/recommend/protocol.ts'
import type { WorkerPort } from '../src/recommend/client.ts'

const diskRoot = new URL('../public/catalog/', import.meta.url)
const root = new URL('https://example.com/song-neighbors/catalog/')
const diskFetch = (async (url: string | URL | Request) => new Response(await readFile(new URL(new URL(String(url)).pathname.slice(root.pathname.length), diskRoot)))) as typeof fetch
const realLoader = () => loadCatalog(root, diskFetch)
const query = { seedIds: ['fma:045099'] }
const request = (requestId: number, input = query): WorkerRequest => ({ type: 'query', requestId, query: input, queryKey: queryIdentity(input) })
const result = (requestId: number, input = query): WorkerResponse => ({ type: 'result', requestId, queryKey: queryIdentity(input), result: { recommendations: [], candidateCount: 0, eligibleCount: 0, requestKey: queryIdentity(input) } })

function fakePort() {
  const listeners = new Map<string, Set<(event: never) => void>>()
  const sent: WorkerRequest[] = []
  const worker = {
    postMessage: vi.fn((message: WorkerRequest) => { sent.push(message) }),
    addEventListener(type: string, listener: (event: never) => void) { const set = listeners.get(type) ?? new Set(); set.add(listener); listeners.set(type, set) },
    removeEventListener(type: string, listener: (event: never) => void) { listeners.get(type)?.delete(listener) },
    terminate: vi.fn(),
  } as unknown as WorkerPort
  const emit = (type: string, data?: WorkerResponse) => { for (const listener of listeners.get(type) ?? []) listener({ data } as never) }
  return { worker, sent, emit }
}

describe('worker runtime', () => {
  it('loads once across concurrent loads/queries, preserves row identity, and exposes no vectors', async () => {
    const loader = vi.fn(realLoader)
    const replies: WorkerResponse[] = []
    const handle = createWorkerHandler((reply) => replies.push(reply), loader)
    await Promise.all([handle({ type: 'load', requestId: 1, catalogRoot: root.href }), handle({ type: 'load', requestId: 2, catalogRoot: root.href }), handle(request(3))])
    expect(loader).toHaveBeenCalledTimes(1)
    const loaded = replies.find((reply) => reply.type === 'loaded')!
    expect(loaded.type).toBe('loaded')
    if (loaded.type !== 'loaded') throw new Error('Missing loaded response')
    expect(loaded.catalog).not.toHaveProperty('vectors')
    const ranked = replies.find((reply) => reply.type === 'result')!
    if (ranked.type !== 'result') throw new Error('Missing result response')
    for (const item of ranked.result.recommendations) expect(loaded.catalog.tracks[item.row]?.id).toBe(item.id)
    await handle({ type: 'load', requestId: 4, catalogRoot: 'https://example.com/different/' })
    expect(replies.at(-1)).toMatchObject({ type: 'error', requestId: 4, operation: 'load' })
  })

  it('returns explicit protocol, unloaded-query, invalid-ID, and identity errors', async () => {
    const replies: WorkerResponse[] = []
    const handle = createWorkerHandler((reply) => replies.push(reply), realLoader)
    await handle(null)
    expect(replies.at(-1)).toMatchObject({ type: 'error', requestId: null, code: 'invalid-request' })
    await handle(request(2))
    expect(replies.at(-1)).toMatchObject({ type: 'error', requestId: 2, operation: 'query' })
    await handle({ type: 'load', requestId: 3, catalogRoot: root.href })
    await handle(request(4, { seedIds: ['missing'] }))
    expect(replies.at(-1)).toMatchObject({ type: 'error', requestId: 4, code: 'query-failed' })
    await handle({ ...request(5), queryKey: 'stale identity' })
    expect(replies.at(-1)).toMatchObject({ type: 'error', requestId: 5, message: 'Query identity mismatch' })
  })

  it('allows retry after load failure and returns that failure to an awaiting query', async () => {
    const replies: WorkerResponse[] = []
    const loader = vi.fn(realLoader).mockRejectedValueOnce(new CatalogLoadError('network', 'Unavailable'))
    const handle = createWorkerHandler((reply) => replies.push(reply), loader)
    await Promise.all([handle({ type: 'load', requestId: 1, catalogRoot: root.href }), handle(request(2))])
    expect(replies).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'error', requestId: 1, code: 'network' }),
      expect.objectContaining({ type: 'error', requestId: 2, code: 'network' }),
    ]))
    await handle({ type: 'load', requestId: 3, catalogRoot: root.href })
    expect(replies.at(-1)?.type).toBe('loaded')
    expect(loader).toHaveBeenCalledTimes(2)
  })
})

describe('latest request client', () => {
  it('checks latest identity again after an already-delivered reply and before promise continuation', async () => {
    const port = fakePort()
    const client = createWorkerClient(port.worker)
    const first = client.query(query).catch((error: unknown) => error)
    port.emit('message', result(1))
    const second = client.query(query)
    expect(await first).toBeInstanceOf(SupersededRequestError)
    port.emit('message', result(2))
    await second
    const third = client.query(query)
    port.emit('message', result(3))
    client.dispose()
    await expect(third).rejects.toMatchObject({ code: 'closed' })
  })

  it('converts an already-delivered obsolete error to cancellation before its continuation', async () => {
    const port = fakePort()
    const client = createWorkerClient(port.worker)
    const first = client.query(query).catch((error: unknown) => error)
    port.emit('message', { type: 'error', requestId: 1, operation: 'query', queryKey: queryIdentity(query), code: 'query-failed', message: 'obsolete failure' })
    const second = client.query(query)
    expect(await first).toBeInstanceOf(SupersededRequestError)
    port.emit('message', result(2))
    await second
    client.dispose()
  })

  it('rejects superseded work and ignores stale results/errors and wrong identities', async () => {
    const port = fakePort()
    const client = createWorkerClient(port.worker)
    const first = client.query(query).catch((error: unknown) => error)
    const nextQuery = { seedIds: ['fma:003832'], positiveIds: ['fma:045099'], negativeIds: ['fma:045100'] }
    let finished = false
    const second = client.query(nextQuery).then((value) => { finished = true; return value })
    expect(await first).toBeInstanceOf(SupersededRequestError)
    port.emit('message', result(1))
    port.emit('message', { type: 'error', requestId: 1, operation: 'query', code: 'query-failed', message: 'stale', queryKey: queryIdentity(query) })
    port.emit('message', result(2))
    await Promise.resolve()
    expect(finished).toBe(false)
    port.emit('message', result(2, nextQuery))
    expect((await second).requestKey).toBe(queryIdentity(nextQuery))
    client.dispose()
  })

  it('includes complete feedback/config state in identity and coalesces loads', async () => {
    expect(queryIdentity(query)).not.toBe(queryIdentity({ ...query, positiveIds: ['fma:045100'] }))
    expect(queryIdentity(query)).not.toBe(queryIdentity({ ...query, negativeIds: ['fma:045100'] }))
    expect(queryIdentity(query)).not.toBe(queryIdentity({ ...query, config: { diversityWeight: 0 } }))
    expect(queryIdentity({ seedIds: ['b', 'a'], positiveIds: ['d', 'c'] })).toBe(queryIdentity({ seedIds: ['a', 'b'], positiveIds: ['c', 'd'] }))
    const port = fakePort()
    const client = createWorkerClient(port.worker)
    const one = client.load(root)
    const two = client.load(root)
    expect(one).toBe(two)
    const catalog = await realLoader()
    port.emit('message', { type: 'loaded', requestId: 1, catalog: { tracks: catalog.tracks, manifest: catalog.manifest } })
    await one
    await client.load(root)
    expect(port.sent).toHaveLength(1)
    await expect(client.load('https://example.com/different/')).rejects.toThrow('new client')
    client.dispose()
  })

  it.each(['error', 'messageerror'])('rejects pending work on %s and requires recreation', async (event) => {
    const port = fakePort()
    const client = createWorkerClient(port.worker)
    const pending = client.query(query)
    port.emit(event)
    await expect(pending).rejects.toMatchObject({ code: 'worker-failed' })
    await expect(client.query(query)).rejects.toMatchObject({ code: 'closed' })
    client.dispose()
    expect(port.worker.terminate).toHaveBeenCalledOnce()
  })

  it('propagates current errors, permits failed-load retry, and handles postMessage failures', async () => {
    const port = fakePort()
    const client = createWorkerClient(port.worker)
    const load = client.load(root)
    port.emit('message', { type: 'error', requestId: 1, operation: 'load', code: 'network', message: 'offline' })
    await expect(load).rejects.toMatchObject({ code: 'network' })
    const retry = client.load(root)
    port.emit('message', { type: 'error', requestId: 2, operation: 'load', code: 'not-ready', message: 'pending' })
    await expect(retry).rejects.toMatchObject({ code: 'not-ready' })
    const current = client.query(query)
    port.emit('message', { type: 'error', requestId: 3, operation: 'query', queryKey: queryIdentity(query), code: 'query-failed', message: 'bad ID' })
    await expect(current).rejects.toThrow('bad ID')
    vi.mocked(port.worker.postMessage).mockImplementationOnce(() => { throw new Error('clone failed') })
    await expect(client.query(query)).rejects.toMatchObject({ code: 'send-failed' })
    client.dispose()
  })
})
