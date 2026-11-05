import type { CatalogTrack } from '../catalog/contract.ts'
import type { SongNeighborsSnapshot } from './controller.ts'

export type DiscoveryStage = 'discover' | 'selection' | 'loading' | 'error' | 'single' | 'blend' | 'refined' | 'empty'

export interface DiscoveryLane {
  id: string
  title: string
  artist: string
  /** Exact number of displayed recommendations whose closest selected seed is this track. */
  count: number
  firstResultId: string | null
}

export interface DiscoveryComposition {
  stage: DiscoveryStage
  heading: string
  description: string
  lanes: DiscoveryLane[]
  /** A new array in the worker's original order; this layer never reranks. */
  resultIds: string[]
  positiveCount: number
  negativeCount: number
}

type Input = Pick<SongNeighborsSnapshot, 'session' | 'resultStatus' | 'result'>
type TrackIdentity = Pick<CatalogTrack, 'id' | 'title' | 'artist'>

/** Compose a deterministic presentation from current, catalog-backed facts only. */
export function composeDiscovery(input: Input, byId: ReadonlyMap<string, TrackIdentity>): DiscoveryComposition {
  const { session, resultStatus, result } = input
  const lanes: DiscoveryLane[] = session.seedIds.flatMap((id) => {
    const track = byId.get(id)
    return track ? [{ id: track.id, title: track.title, artist: track.artist, count: 0, firstResultId: null }] : []
  })
  const base = {
    lanes, resultIds: [] as string[],
    positiveCount: session.positiveIds.length, negativeCount: session.negativeIds.length,
  }
  if (!lanes.length) return {
    ...base, stage: 'discover', heading: 'A song becomes a starting point.',
    description: 'Choose a track from the catalog. Your neighborhood takes shape around it.',
  }
  if (resultStatus === 'loading') return {
    ...base, stage: 'loading', heading: 'Finding your neighbors…',
    description: 'Comparing your selected songs with the catalog.',
  }
  if (resultStatus === 'error') return {
    ...base, stage: 'error', heading: 'Your selection is still here.',
    description: 'Recommendations could not be calculated. Try again to continue.',
  }
  const selection: DiscoveryComposition = {
    ...base, stage: 'selection',
    heading: lanes.length === 1 ? `Start with ${lanes[0]!.title}.` : `${lanes.length} starting points. One neighborhood.`,
    description: 'Choose Recommend to find the closest sounds around your selection.',
  }
  // A controller edit clears resultStatus immediately, before any pending query can finish.
  // Ignore an attached old result in every non-ready state, even if a caller retains one.
  if (resultStatus !== 'ready' || !result) return selection

  // Match the ranked list's catalog lookup without introducing any replacement titles.
  const displayed = result.recommendations.filter((item) => byId.has(item.id))
  const laneById = new Map(lanes.map((lane) => [lane.id, lane]))
  // An obsolete closest-seed reference cannot support an overview of this selection.
  if (displayed.some((item) => !laneById.has(item.closestSeedId))) return selection
  for (const item of displayed) {
    const lane = laneById.get(item.closestSeedId)!
    lane.count += 1
    lane.firstResultId ??= item.id
  }
  const ready = { ...base, resultIds: displayed.map((item) => item.id) }
  if (!displayed.length) return {
    ...ready, stage: 'empty', heading: 'No neighbors remain in this selection.',
    description: session.positiveIds.length + session.negativeIds.length
      ? 'Reset refinement or change your selected songs to explore again.'
      : 'Choose another starting song to explore the catalog.',
  }
  if (session.positiveIds.length + session.negativeIds.length) return {
    ...ready, stage: 'refined', heading: 'Your picks, refined.',
    description: 'Your feedback reshapes this list. The selected songs remain its starting points.',
  }
  if (lanes.length === 1) return {
    ...ready, stage: 'single', heading: `Around ${lanes[0]!.title}.`,
    description: 'Neighbors ranked around one starting track. Refine any result to steer the next list.',
  }
  return {
    ...ready, stage: 'blend', heading: `${lanes.length} starting points. One neighborhood.`,
    description: 'Each count shows how many results are closest to that pick. All results keep their ranked order below.',
  }
}
