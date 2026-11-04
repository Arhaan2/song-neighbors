import { loadCatalog, CatalogLoadError } from '../catalog/load.ts'
import { createRecommendationEngine } from './engine.ts'
import { queryIdentity, requestSchema } from './protocol.ts'
import type { WorkerResponse } from './protocol.ts'

/** One immutable catalog per worker. Failed loads can be retried; successful vectors stay here. */
export function createWorkerHandler(send: (response: WorkerResponse) => void, loader = loadCatalog) {
  let root: string | undefined
  let loading: ReturnType<typeof initialize> | undefined
  async function initialize(url: string) {
    const catalog = await loader(url)
    return { catalog: { manifest: catalog.manifest, tracks: catalog.tracks }, engine: createRecommendationEngine(catalog) }
  }
  return async (raw: unknown): Promise<void> => {
    const parsed = requestSchema.safeParse(raw)
    if (!parsed.success) {
      const id = typeof raw === 'object' && raw !== null && 'requestId' in raw ? raw.requestId : null
      send({ type: 'error', requestId: typeof id === 'number' && Number.isSafeInteger(id) && id >= 0 ? id : null, operation: 'protocol', code: 'invalid-request', message: 'Invalid worker request' })
      return
    }
    const request = parsed.data
    try {
      if (request.type === 'load') {
        const url = new URL(request.catalogRoot).href
        if (root && root !== url) throw new Error('Create a new worker to change catalogs')
        if (!loading) {
          root = url
          loading = initialize(url).catch((error: unknown) => { loading = undefined; root = undefined; throw error })
        }
        const { catalog } = await loading
        send({ type: 'loaded', requestId: request.requestId, catalog: { manifest: catalog.manifest, tracks: catalog.tracks } })
      } else {
        if (request.queryKey !== queryIdentity(request.query)) throw new Error('Query identity mismatch')
        if (!loading) throw new Error('Load the catalog before querying')
        const { engine } = await loading
        send({ type: 'result', requestId: request.requestId, queryKey: request.queryKey, result: engine.query(request.query) })
      }
    } catch (error) {
      send({ type: 'error', requestId: request.requestId, operation: request.type,
        code: error instanceof CatalogLoadError ? error.code : request.type === 'load' ? 'load-failed' : 'query-failed',
        message: error instanceof Error ? error.message : 'Recommendation worker failed',
        ...(request.type === 'query' ? { queryKey: request.queryKey } : {}),
      })
    }
  }
}
