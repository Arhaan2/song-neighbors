import { RecommendationWorkerError } from '../recommend/client.ts'
import {
  addNegative, addPositive, createSession, createSessionCatalog, editSeeds, resetRefinement,
} from '../recommend/session.ts'
import type { RecommendationQuery, RecommendationResult, SessionCatalog, SessionState } from '../recommend/engine.ts'
import type { CatalogSummary } from '../recommend/protocol.ts'

export interface SongNeighborsClient {
  load(): Promise<CatalogSummary>
  query(query: RecommendationQuery): Promise<RecommendationResult>
  dispose(): void
}

export interface SongNeighborsSnapshot {
  catalogStatus: 'loading' | 'ready' | 'error' | 'unavailable'
  catalog: CatalogSummary | null
  catalogError: string | null
  session: SessionState
  resultStatus: 'idle' | 'loading' | 'ready' | 'error'
  result: RecommendationResult | null
  resultError: string | null
}

const emptySession = (): SessionState => ({ seedIds: [], positiveIds: [], negativeIds: [] })

/** Memory-only UI state. The worker remains the only source of recommendation results. */
export function createSongNeighborsController(factory: () => SongNeighborsClient) {
  let snapshot: SongNeighborsSnapshot = {
    catalogStatus: 'loading', catalog: null, catalogError: null, session: emptySession(),
    resultStatus: 'idle', result: null, resultError: null,
  }
  const listeners = new Set<() => void>()
  let active = false
  let client: SongNeighborsClient | null = null
  let context: SessionCatalog | null = null
  let lifecycle = 0
  let revision = 0
  let querying = false

  function publish(patch: Partial<SongNeighborsSnapshot>) {
    snapshot = { ...snapshot, ...patch }
    for (const listener of listeners) listener()
  }

  function runQuery() {
    if (!active || !client || snapshot.catalogStatus !== 'ready') return
    if (!snapshot.session.seedIds.length) {
      clearResults()
      return
    }
    const requestRevision = ++revision
    const requestLifecycle = lifecycle
    querying = true
    // Capture the exact session before any asynchronous continuation can observe an edit.
    const query = snapshot.session
    publish({ resultStatus: 'loading', result: null, resultError: null })
    void client.query(query).then((result) => {
      if (!active || requestLifecycle !== lifecycle || requestRevision !== revision) return
      querying = false
      publish({ resultStatus: 'ready', result, resultError: null })
    }).catch(() => {
      if (!active || requestLifecycle !== lifecycle || requestRevision !== revision) return
      querying = false
      publish({ resultStatus: 'error', result: null, resultError: 'Recommendations couldn’t be calculated. Please try again.' })
    })
  }

  function clearResults() {
    ++revision
    if (querying && client && snapshot.catalogStatus === 'ready') {
      // The existing client cancels older requests when a new query is sent. An empty
      // query invalidates pending work without computing or displaying unrequested results.
      void client.query(emptySession()).catch(() => {})
    }
    querying = false
    publish({ resultStatus: 'idle', result: null, resultError: null })
  }

  function changeSeeds(ids: string[]) {
    if (!active || !context) return
    const session = editSeeds(context, snapshot.session, ids)
    if (session.seedIds.join('\n') === snapshot.session.seedIds.join('\n')) return
    // Invalidate first: neither a late success nor a late failure may repaint old results.
    clearResults()
    publish({ session })
  }

  function initialize(recommendAfterLoad: boolean) {
    if (!active) return
    const currentLifecycle = ++lifecycle
    const loadRevision = ++revision
    querying = false
    client?.dispose()
    client = null
    publish({
      catalogStatus: 'loading', catalogError: null, result: null, resultError: null,
      resultStatus: recommendAfterLoad && snapshot.session.seedIds.length ? 'loading' : 'idle',
    })
    // Promise.resolve also catches unsupported Worker construction and synchronous load errors.
    void Promise.resolve().then(() => {
      if (!active || currentLifecycle !== lifecycle) return null
      client = factory()
      return client.load()
    }).then((catalog) => {
      if (!catalog || !active || currentLifecycle !== lifecycle) return
      context = createSessionCatalog(catalog.tracks)
      const ids = new Set(catalog.tracks.map((track) => track.id))
      const seeds = snapshot.session.seedIds.filter((id) => ids.has(id))
      let session = createSession(context, seeds)
      // A changed catalog can remove IDs. Preserve usable seeds, and only preserve feedback
      // if the whole anchor survived; all identities are checked against the new metadata.
      if (seeds.length && seeds.length === snapshot.session.seedIds.length) {
        for (const id of snapshot.session.positiveIds.filter((id) => ids.has(id))) session = addPositive(context, session, id)
        for (const id of snapshot.session.negativeIds.filter((id) => ids.has(id))) session = addNegative(context, session, id)
      }
      publish({ catalogStatus: 'ready', catalog, catalogError: null, session, resultStatus: 'idle' })
      // Editing or resetting during a retry invalidates its automatic resubmission too.
      if (recommendAfterLoad && loadRevision === revision) runQuery()
    }).catch((error: unknown) => {
      if (!active || currentLifecycle !== lifecycle) return
      const unavailable = error instanceof RecommendationWorkerError && error.code === 'not-ready'
      publish({
        catalogStatus: unavailable ? 'unavailable' : 'error',
        catalogError: unavailable
          ? 'The catalog is not available yet. Please try again later.'
          : 'The catalog couldn’t be loaded or verified. Please try again.',
        resultStatus: 'idle', result: null, resultError: null,
      })
    })
  }

  const actions = {
    addSeed(id: string) {
      if (!context || snapshot.catalogStatus !== 'ready' || snapshot.session.seedIds.length >= 5) return
      if (!snapshot.catalog?.tracks.some((track) => track.id === id)) return
      const key = context.recordingKey(id)
      if (snapshot.session.seedIds.some((seed) => context!.recordingKey(seed) === key)) return
      changeSeeds([...snapshot.session.seedIds, id])
    },
    removeSeed(id: string) { changeSeeds(snapshot.session.seedIds.filter((seed) => seed !== id)) },
    recommend: runQuery,
    moreLike(id: string) {
      if (!context || snapshot.resultStatus !== 'ready' || !snapshot.result?.recommendations.some((item) => item.id === id)) return
      publish({ session: addPositive(context, snapshot.session, id), result: null, resultStatus: 'loading' })
      runQuery()
    },
    notThisMood(id: string) {
      if (!context || snapshot.resultStatus !== 'ready' || !snapshot.result?.recommendations.some((item) => item.id === id)) return
      publish({ session: addNegative(context, snapshot.session, id), result: null, resultStatus: 'loading' })
      runQuery()
    },
    reset() {
      if (!active) return
      ++revision
      publish({ session: resetRefinement(snapshot.session), result: null, resultError: null, resultStatus: 'idle' })
      runQuery()
    },
    retryCatalog() { initialize(false) },
    retryRecommendations() { initialize(true) },
  }

  return {
    actions,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    start() {
      if (active) return
      active = true
      initialize(false)
    },
    dispose() {
      active = false
      ++lifecycle
      ++revision
      querying = false
      client?.dispose()
      client = null
    },
  }
}
