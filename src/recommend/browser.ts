import { createWorkerClient } from './client.ts'

/** Phase 3 entry point; all fetch/validation/vector calculation remains in the module worker. */
export function createRecommendationClient() {
  const worker = new Worker(new URL('./recommend.worker.ts', import.meta.url), { type: 'module' })
  const client = createWorkerClient(worker)
  return { ...client, load: () => client.load(new URL(`${import.meta.env.BASE_URL}catalog/`, window.location.href)) }
}
export { SupersededRequestError, RecommendationWorkerError } from './client.ts'
export { createSessionCatalog, createSession, editSeeds, addPositive, addNegative, resetRefinement, sessionRequestKey } from './session.ts'
