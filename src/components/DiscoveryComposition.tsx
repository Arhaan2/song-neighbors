import type { DiscoveryComposition as Composition } from '../ui/discoveryComposition'
import { SelectionPrint } from './SelectionPrint'
import './DiscoveryComposition.css'

interface Props {
  composition: Composition
  artworkIds: readonly string[]
}

/** Bounded UI vocabulary: real session state chooses the panels, never generated code. */
export function DiscoveryComposition({ composition, artworkIds }: Props) {
  const { stage, lanes, heading, description, resultIds } = composition
  const ready = stage === 'single' || stage === 'blend' || stage === 'refined'
  const hasResults = resultIds.length > 0
  const multiple = lanes.length > 1
  function jumpToResult(id: string) {
    document.getElementById(`track-${id}`)?.focus()
  }
  return <div className={`discovery-composition composition-${stage}`}
    data-testid="discovery-composition" data-stage={stage}>
    <div className="composition-intro">
      <div className="composition-print"><SelectionPrint ids={artworkIds} compact={ready} /></div>
      <div className="composition-copy">
        <h3>{heading}</h3>
        {!ready && <p>{description}</p>}
      </div>
    </div>
    {ready && multiple && <div className="neighbor-paths">
      <p className="paths-description">Among these {resultIds.length} results, closest to:</p>
      <ul className="neighbor-lanes" aria-label="Recommendations by closest selected song">
        {lanes.map(lane => <li key={lane.id} data-testid="neighbor-lane" data-seed-id={lane.id} data-count={lane.count}>
          <button className="neighbor-lane" type="button" disabled={!lane.firstResultId}
            aria-label={`${lane.title} by ${lane.artist}: ${lane.count} of ${resultIds.length} recommendations closest to this pick`}
            onClick={() => { if (lane.firstResultId) jumpToResult(lane.firstResultId) }}>
            <span className="lane-track"><strong>{lane.title}</strong><span>{lane.artist}</span></span>
            <span className="lane-count">{lane.count}<span> / {resultIds.length}</span><span aria-hidden="true"> ↘</span></span>
            <span className="lane-bar" aria-hidden="true"><span style={{ width: hasResults ? `${100 * lane.count / resultIds.length}%` : '0%' }} /></span>
          </button>
        </li>)}
      </ul>
    </div>}
    {!ready && lanes.length > 0 && <ul className="composition-picks" aria-label="Starting points in this view">
      {lanes.map(lane => <li key={lane.id}><span className="pick-print"><SelectionPrint ids={[lane.id]} compact /></span><span><strong>{lane.title}</strong><span>{lane.artist}</span></span></li>)}
    </ul>}
  </div>
}
