import { queryIdentity } from './protocol.ts'
import type { CatalogSummary, WorkerRequest, WorkerResponse } from './protocol.ts'
import type { RecommendationQuery, RecommendationResult } from './engine.ts'

export interface WorkerPort {
  postMessage(message: WorkerRequest): void
  addEventListener(type: 'message', listener: (event: { data: WorkerResponse }) => void): void
  addEventListener(type: 'error' | 'messageerror', listener: (event: Event) => void): void
  removeEventListener(type: 'message', listener: (event: { data: WorkerResponse }) => void): void
  removeEventListener(type: 'error' | 'messageerror', listener: (event: Event) => void): void
  terminate(): void
}
export class SupersededRequestError extends Error {
  constructor() { super('A newer recommendation request superseded this request'); this.name = 'SupersededRequestError' }
}
export class RecommendationWorkerError extends Error {
  readonly code: string
  constructor(code: string, message: string) { super(message); this.name = 'RecommendationWorkerError'; this.code = code }
}

type Pending = { resolve: (value: WorkerResponse) => void; reject: (error: Error) => void; type: 'load' | 'query'; key?: string }

/** Only the newest query can resolve. Superseded promises reject explicitly; handle that as cancellation. */
export function createWorkerClient(worker: WorkerPort) {
  let sequence = 0
  let latestQuery: number | undefined
  let closed = false
  let loaded: Promise<CatalogSummary> | undefined
  let catalogRoot: string | undefined
  const pending = new Map<number, Pending>()
  function receive(event: { data: WorkerResponse }) {
    const message = event.data
    if (message.requestId === null) return
    const item = pending.get(message.requestId)
    if (!item) return
    if (item.type === 'query' && (message.requestId !== latestQuery || ('queryKey' in message && message.queryKey !== item.key))) return
    if (message.type === 'error') {
      pending.delete(message.requestId)
      item.reject(new RecommendationWorkerError(message.code, message.message))
    } else if ((item.type === 'load' && message.type === 'loaded') || (item.type === 'query' && message.type === 'result')) {
      pending.delete(message.requestId)
      item.resolve(message)
    }
  }
  function failAll(message: string) {
    closed = true
    for (const item of pending.values()) item.reject(new RecommendationWorkerError('worker-failed', message))
    pending.clear()
  }
  const onError = () => failAll('Recommendation worker crashed; recreate the client to retry')
  const onMessageError = () => failAll('Recommendation worker message could not be decoded; recreate the client to retry')
  worker.addEventListener('message', receive)
  worker.addEventListener('error', onError)
  worker.addEventListener('messageerror', onMessageError)
  function send(request: WorkerRequest): Promise<WorkerResponse> {
    if (closed) return Promise.reject(new RecommendationWorkerError('closed', 'Recommendation worker is closed'))
    return new Promise((resolve, reject) => {
      pending.set(request.requestId, { resolve, reject, type: request.type, ...(request.type === 'query' ? { key: request.queryKey } : {}) })
      try { worker.postMessage(request) } catch (error) {
        pending.delete(request.requestId)
        reject(new RecommendationWorkerError('send-failed', error instanceof Error ? error.message : 'Could not send worker request'))
      }
    })
  }
  return {
    load(root: string | URL): Promise<CatalogSummary> {
      const url = new URL(root).href
      if (catalogRoot && catalogRoot !== url) return Promise.reject(new RecommendationWorkerError('catalog-change', 'Create a new client to change catalogs'))
      if (!loaded) {
        catalogRoot = url
        loaded = send({ type: 'load', requestId: ++sequence, catalogRoot: url }).then((message) => {
          if (message.type !== 'loaded') throw new Error('Unexpected load reply')
          return message.catalog
        }).catch((error: unknown) => { loaded = undefined; catalogRoot = undefined; throw error })
      }
      return loaded
    },
    async query(query: RecommendationQuery): Promise<RecommendationResult> {
      if (latestQuery !== undefined) {
        pending.get(latestQuery)?.reject(new SupersededRequestError())
        pending.delete(latestQuery)
      }
      const requestId = ++sequence
      latestQuery = requestId
      let message: WorkerResponse
      try {
        message = await send({ type: 'query', requestId, queryKey: queryIdentity(query), query })
      } catch (error) {
        if (requestId !== latestQuery) throw new SupersededRequestError()
        throw error
      }
      // Another message listener may issue a query after receive() resolves but before this continuation.
      if (requestId !== latestQuery) throw new SupersededRequestError()
      if (closed) throw new RecommendationWorkerError('closed', 'Recommendation worker is closed')
      if (message.type !== 'result') throw new Error('Unexpected query reply')
      return message.result
    },
    dispose() {
      failAll('Recommendation worker disposed')
      worker.removeEventListener('message', receive)
      worker.removeEventListener('error', onError)
      worker.removeEventListener('messageerror', onMessageError)
      worker.terminate()
    },
  }
}
