import type { SessionCatalog, SessionState } from './engine.ts'
export { createSessionCatalog } from './engine.ts'
export type { SessionState, SessionCatalog } from './engine.ts'

function validateState(catalog: SessionCatalog, state: SessionState): SessionState {
  // Ranking canonicalizes set order; selected chips keep the user's insertion order.
  return { ...catalog.canonicalizeSession(state), seedIds: [...new Set(state.seedIds)] }
}

export function createSession(engine: SessionCatalog, seedIds: readonly string[] = []): SessionState {
  return validateState(engine, { seedIds: [...seedIds], positiveIds: [], negativeIds: [] })
}

/** Changing selected seeds clears all refinement; unchanged selected IDs retain it. */
export function editSeeds(engine: SessionCatalog, state: SessionState, seedIds: readonly string[]): SessionState {
  const next = createSession(engine, seedIds)
  if (JSON.stringify(next.seedIds) === JSON.stringify(state.seedIds)) return validateState(engine, state)
  return next
}

function addFeedback(engine: SessionCatalog, state: SessionState, id: string, kind: 'positiveIds' | 'negativeIds'): SessionState {
  const current = validateState(engine, state)
  if (!current.seedIds.length) throw new Error('Feedback requires selected seeds')
  const group = engine.recordingKey(id)
  if (current.seedIds.some((seed) => engine.recordingKey(seed) === group)) throw new Error('Selected seeds remain the session anchor')
  const opposite = kind === 'positiveIds' ? 'negativeIds' : 'positiveIds'
  // A recording has one session preference, even when another catalog ID names it.
  const existing = current[kind].find((candidate) => engine.recordingKey(candidate) === group)
  return validateState(engine, {
    ...current,
    [kind]: existing ? current[kind] : [...current[kind], id],
    [opposite]: current[opposite].filter((candidate) => engine.recordingKey(candidate) !== group),
  })
}

export const addPositive = (engine: SessionCatalog, state: SessionState, id: string): SessionState => addFeedback(engine, state, id, 'positiveIds')
export const addNegative = (engine: SessionCatalog, state: SessionState, id: string): SessionState => addFeedback(engine, state, id, 'negativeIds')

export function resetRefinement(state: SessionState): SessionState {
  return { seedIds: [...state.seedIds], positiveIds: [], negativeIds: [] }
}

/** Canonical set identity includes every explicit preference, never displayed-result history. */
export function sessionRequestKey(state: SessionState): string {
  return JSON.stringify({
    seedIds: [...new Set(state.seedIds)].sort(),
    positiveIds: [...new Set(state.positiveIds)].sort(),
    negativeIds: [...new Set(state.negativeIds)].sort(),
  })
}
