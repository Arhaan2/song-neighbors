import { useMemo, useRef, useState } from 'react'
import { CatalogUnavailable } from './components/CatalogUnavailable'
import { DiscoveryComposition } from './components/DiscoveryComposition'
import { SelectionPrint } from './components/SelectionPrint'
import { composeDiscovery } from './ui/discoveryComposition'
import { SongSearch } from './components/SongSearch'
import { useSongNeighbors } from './ui/useSongNeighbors'
import { recordingDescription } from './ui/search'
import './App.css'

export default function App() {
  const app = useSongNeighbors()
  const [adaptive, setAdaptive] = useState(true)
  const aboutCatalog = useRef<HTMLDetailsElement>(null)
  const resultHeading = useRef<HTMLHeadingElement>(null)
  const selectedHeading = useRef<HTMLHeadingElement>(null)
  const tracks = useMemo(() => app.catalog?.tracks ?? [], [app.catalog])
  const byId = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks])
  const artistCount = useMemo(() => new Set(tracks.map((track) => track.artist)).size, [tracks])
  const composition = composeDiscovery(app, byId)
  const artworkIds = [...app.session.seedIds, ...app.session.positiveIds, ...app.session.negativeIds.map(id => `away:${id}`)]
  const selected = app.session.seedIds.flatMap((id) => byId.get(id) ?? [])
  const positive = app.session.positiveIds.flatMap((id) => byId.get(id) ?? [])
  const negative = app.session.negativeIds.flatMap((id) => byId.get(id) ?? [])
  const refined = positive.length + negative.length > 0
  const resultCount = app.result?.recommendations.length ?? 0
  function actOnResults(action: () => void) {
    action()
    resultHeading.current?.focus()
  }
  const resultStatus = app.resultStatus === 'loading' ? 'Finding your neighbors…'
    : app.resultStatus === 'error' ? 'Recommendations need another try.'
      : app.resultStatus === 'ready' ? `${resultCount} ${resultCount === 1 ? 'recommendation' : 'recommendations'}${refined ? ', refined for this session' : ''}.`
        : selected.length ? 'Your selection is ready. Choose Recommend to find songs.' : 'Select a song to get started.'

  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="app-header">
      <div className="wordmark">
        <svg viewBox="0 0 52 32" aria-hidden="true" focusable="false" className="brand-mark">
          <circle cx="16" cy="16" r="14.5" fill="currentColor" /><circle cx="36" cy="16" r="14.5" fill="var(--accent)" />
          <circle cx="16" cy="16" r="6" /><circle cx="36" cy="16" r="6" />
          <circle cx="16" cy="16" r="1.8" fill="currentColor" /><circle cx="36" cy="16" r="1.8" fill="var(--accent)" />
        </svg>
        <span>Song Neighbors</span>
      </div>
      <nav aria-label="Project">
        <a href="#about-catalog" onClick={() => { if (aboutCatalog.current) aboutCatalog.current.open = true }}>About the catalog</a>
        <a className="project-link" href="https://github.com/Arhaan2/song-neighbors">GitHub <span aria-hidden="true">↗</span></a>
      </nav>
    </header>
    <main id="main" tabIndex={-1}>
      <div className="page-heading">
        <div><h1>Discover by sound.</h1>
          <p>Choose 1–5 songs you like. Find up to 20 that sound like them.</p></div>
        {app.catalogStatus === 'ready' && <div className="heading-tools">
          <dl className="catalog-figures" aria-label="Catalog coverage">
            <div><dt>Songs</dt><dd>{tracks.length.toLocaleString()}</dd></div>
            <div><dt>Artists</dt><dd>{artistCount.toLocaleString()}</dd></div>
          </dl>
          <div className="view-switch" role="group" aria-label="Recommendation view">
            <button type="button" aria-pressed={adaptive} onClick={() => setAdaptive(true)}>Adaptive</button>
            <button type="button" aria-pressed={!adaptive} onClick={() => setAdaptive(false)}>Plain list</button>
          </div>
        </div>}
      </div>
      {app.catalogStatus === 'ready' ? <>
        <div className={`discovery-layout${adaptive ? ' is-adaptive' : ''}${app.resultStatus === 'ready' ? ' has-results' : ''}`}>
          <section className="selection-panel" aria-labelledby="selection-heading">
            <div className="section-heading"><h2 id="selection-heading" tabIndex={-1}>Your starting point</h2></div>
            <SongSearch tracks={tracks} selectedIds={app.session.seedIds} onSelect={app.addSeed} />
            <div className="selected-songs">
              <div className="selection-heading"><h3 ref={selectedHeading} tabIndex={-1}>Selected songs</h3>
                <span className="selection-count"><span className="slot-meter" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, index) => <i key={index} className={index < selected.length ? 'filled' : undefined} />)}
                </span>{selected.length} / 5</span>
              </div>
              {selected.length ? <ul className="seed-list" aria-label="Selected songs">
                {selected.map((track) => <li className="seed-chip" data-testid="seed-chip" data-track-id={track.id} key={track.id}>
                  <span className="track-text"><strong>{track.title}</strong><span>{track.artist}</span></span>
                  <button type="button" className="remove-seed" aria-label={`Remove ${track.title} by ${track.artist}`} onClick={() => {
                    app.removeSeed(track.id); selectedHeading.current?.focus()
                  }}>×</button>
                </li>)}
              </ul> : <p className="selection-empty">Add a song to start your selection.</p>}
              <button type="button" className="primary-button" disabled={!selected.length || app.resultStatus === 'loading'}
                onClick={() => actOnResults(app.recommend)}>Recommend <span aria-hidden="true">→</span></button>
              {selected.length > 0 && <p className="selection-note">Changing these songs clears your refinement.</p>}
            </div>
          </section>
          <section className="recommendations" aria-labelledby="recommendations-heading" aria-busy={app.resultStatus === 'loading'}>
            <div className="section-heading result-heading"><h2 id="recommendations-heading" ref={resultHeading} tabIndex={-1}>Your recommendations</h2>{app.resultStatus === 'ready' && <span className="result-count">{resultCount} songs</span>}</div>
            <p className="sr-only" role="status" aria-live="polite">{resultStatus}</p>
            {refined && <div className="refinement-panel" aria-label="Active refinement">
              <div className="refinement-heading"><h3>Refinement active</h3><button type="button" className="text-button" onClick={() => actOnResults(app.reset)}><span aria-hidden="true">↺ </span>Reset refinement</button></div>
              <dl className="preference-list">
                {positive.length > 0 && <div data-testid="feedback-positive"><dt>More like</dt><dd>{positive.map((track) => `${track.title} — ${track.artist}`).join('; ')}</dd></div>}
                {negative.length > 0 && <div data-testid="feedback-negative"><dt>Less like</dt><dd>{negative.map((track) => `${track.title} — ${track.artist}`).join('; ')}</dd></div>}
              </dl>
            </div>}
            {adaptive && (app.resultStatus === 'idle' || (app.resultStatus === 'ready' && resultCount > 0)) &&
              <DiscoveryComposition composition={composition} artworkIds={artworkIds} />}
            {!adaptive && app.resultStatus === 'idle' && <div className="results-message">
              <h3>{selected.length ? 'Ready when you are.' : 'One song is enough.'}</h3>
              <p>Choose a starting song, then select Recommend to find its neighbors.</p>
            </div>}
            {app.resultStatus === 'loading' && <div className="results-message panel" role="status"><h3>Finding your neighbors…</h3><p>Comparing the sound of your selected songs.</p></div>}
            {app.resultStatus === 'error' && <div className="results-message panel" role="alert"><h3>We couldn’t find recommendations</h3><p>{app.resultError}</p><button type="button" className="secondary-button" onClick={() => actOnResults(app.retryRecommendations)}>Retry recommendations</button></div>}
            {app.resultStatus === 'ready' && app.result && <>
              {resultCount < 20 && <p className="insufficient-results" role="status">{resultCount ? `Only ${resultCount} eligible ${resultCount === 1 ? 'song remains' : 'songs remain'} for this selection and refinement.` : 'No eligible songs remain for this selection and refinement.'} {refined ? 'Reset refinement or change your selected songs to explore again.' : 'Try changing your selected songs.'}</p>}
              <ol className="result-list" aria-label="Ranked recommendations">
                {app.result.recommendations.map((recommendation, index) => {
                  const track = byId.get(recommendation.id)
                  const closest = byId.get(recommendation.closestSeedId)
                  if (!track) return null
                  return <li key={track.id} className="result-card" id={`track-${track.id}`} tabIndex={-1} data-testid="recommendation-card" data-track-id={track.id}>
                    <span className="result-rank" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                    <div className={`result-main${adaptive && index === 0 ? ' result-feature' : ''}`}>
                      {adaptive && index === 0 && <div className="result-art"><SelectionPrint ids={[track.id]} compact /></div>}
                      <h3>{track.title}</h3><p className="result-artist">{track.artist}</p>
                      <p className="recording-detail">{recordingDescription(track)}</p>
                      {closest && <p className="closest-seed"><span aria-hidden="true">↳ </span>Closest to your pick: <strong>{closest.title}</strong></p>}
                      <div className="result-actions">
                        <button type="button" className="feedback-button" aria-label={`More like this: ${track.title} by ${track.artist}`} onClick={() => actOnResults(() => app.moreLike(track.id))}><span aria-hidden="true">+</span> More like this</button>
                        <button type="button" className="feedback-button" aria-label={`Not this mood: ${track.title} by ${track.artist}`} onClick={() => actOnResults(() => app.notThisMood(track.id))}><span aria-hidden="true">−</span> Not this mood</button>
                      </div>
                    </div>
                  </li>
                })}
              </ol>
              {resultCount > 0 && <div className="results-end"><p>Similar sound doesn’t always mean a song will fit your mood.</p><a href="#selection-heading">Back to your songs <span aria-hidden="true">↑</span></a></div>}
            </>}
          </section>
        </div>
      </> : <CatalogUnavailable status={app.catalogStatus} error={app.catalogError} onRetry={app.retryCatalog} />}
      <details ref={aboutCatalog} className="about-project" id="about-catalog">
        <summary>About Song Neighbors &amp; the catalog<svg aria-hidden="true" focusable="false" viewBox="0 0 16 16"><path d="m3 6 5 5 5-5" /></svg></summary>
        <div className="about-content">
          <p>Song Neighbors finds recordings with similar audio in a small, prepared catalog from the Free Music Archive. Many familiar or commercial songs won’t be here. A search with no match means that recording isn’t available in this catalog.</p>
          {app.catalog && <p>This catalog contains {tracks.length.toLocaleString()} recordings from {artistCount.toLocaleString()} artist names. Recommendations use analyzed audio excerpts, usually around 30 seconds, rather than whole songs. The results are sound-based suggestions, not a measure of how much you will enjoy them.</p>}
          <p>Your selected songs are the starting point. “More like this” adds a positive preference; “Not this mood” excludes that recording and gently steers away from its sound. Feedback recordings are excluded from the results. Reset clears feedback and keeps your selected songs; editing those songs starts a fresh refinement.</p>
          <p>Adaptive view composes artwork and context around your current selection and feedback. Its path counts come from the returned songs’ closest selected track. The artwork is a generated illustration, not an audio waveform or album cover. Plain list shows the same songs in the same order.</p>
          <p>Search and ranking run in your browser. Selections and feedback stay in memory and disappear on refresh. No account or playback is needed.</p>
          {app.catalog && <p><a href={`${import.meta.env.BASE_URL}catalog/${app.catalog.manifest.catalogVersion}/ATTRIBUTION.md`}>Catalog credits, recording licenses &amp; notices</a>. Metadata comes from the FMA dataset under CC BY 4.0; recordings retain their individual CC0 or CC BY terms. Excerpts were transformed into numerical audio representations. No endorsement is implied.</p>}
          {app.catalog && <p className="technical-note">Catalog: {app.catalog.manifest.catalogVersion}. Encoder: {app.catalog.manifest.encoder.id}, {app.catalog.manifest.dimension} dimensions. Rankings use audio similarity and session feedback; their musical usefulness has not been evaluated with listeners.</p>}
        </div>
      </details>
    </main>
    <footer className="app-footer"><span>An independent project by Arhaan.</span><span>Music from the Free Music Archive</span></footer>
  </div>
}
