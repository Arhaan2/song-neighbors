import { useMemo, useRef } from 'react'
import { CatalogUnavailable } from './components/CatalogUnavailable'
import { SongSearch } from './components/SongSearch'
import { useSongNeighbors } from './ui/useSongNeighbors'
import { recordingDescription } from './ui/search'
import './App.css'

export default function App() {
  const app = useSongNeighbors()
  const resultHeading = useRef<HTMLHeadingElement>(null)
  const selectedHeading = useRef<HTMLHeadingElement>(null)
  const tracks = useMemo(() => app.catalog?.tracks ?? [], [app.catalog])
  const byId = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks])
  const artistCount = useMemo(() => new Set(tracks.map((track) => track.artist)).size, [tracks])
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
        <svg viewBox="0 0 40 24" aria-hidden="true" className="brand-mark">
          <circle cx="12" cy="12" r="10" /><circle cx="28" cy="12" r="10" />
          <circle className="brand-center" cx="12" cy="12" r="2" /><circle className="brand-center" cx="28" cy="12" r="2" />
        </svg>
        <span>Song Neighbors</span>
      </div>
      <a className="project-link" href="https://github.com/Arhaan2/song-neighbors">View project<span aria-hidden="true"> ↗</span></a>
    </header>
    <main id="main" tabIndex={-1}>
      <div className="page-heading">
        <h1>A few songs. A place to start.</h1>
        <p>Choose 1–5 songs that fit your mood. Find up to 20 with a similar sound.</p>
      </div>
      {app.catalogStatus === 'ready' ? <>
        <p className="catalog-coverage">Explore {tracks.length.toLocaleString()} songs from {artistCount.toLocaleString()} artists in our independent music catalog. <a href="#about-catalog">About the catalog</a></p>
        <div className="discovery-layout">
          <section className="selection-panel panel" aria-labelledby="selection-heading">
            <div className="section-heading"><h2 id="selection-heading">Your starting point</h2><span className="selection-count">{selected.length} / 5 songs</span></div>
            <SongSearch tracks={tracks} selectedIds={app.session.seedIds} onSelect={app.addSeed} />
            <div className="selected-songs">
              <h3 ref={selectedHeading} tabIndex={-1}>Selected songs</h3>
              {selected.length ? <ul className="seed-list" aria-label="Selected songs">
                {selected.map((track) => <li className="seed-chip" data-testid="seed-chip" data-track-id={track.id} key={track.id}>
                  <span className="track-text"><strong>{track.title}</strong><span>{track.artist}</span></span>
                  <button type="button" className="remove-seed" aria-label={`Remove ${track.title} by ${track.artist}`} onClick={() => {
                    app.removeSeed(track.id); selectedHeading.current?.focus()
                  }}>×</button>
                </li>)}
              </ul> : <p className="selection-empty">Your songs will appear here.</p>}
              <button type="button" className="primary-button" disabled={!selected.length || app.resultStatus === 'loading'}
                onClick={() => actOnResults(app.recommend)}>Recommend <span aria-hidden="true">↗</span></button>
              <p className="selection-note">{selected.length ? 'Changing these songs clears your refinement.' : 'Select at least one song to find its neighbors.'}</p>
            </div>
          </section>
          <section className="recommendations" aria-labelledby="recommendations-heading" aria-busy={app.resultStatus === 'loading'}>
            <div className="section-heading result-heading"><h2 id="recommendations-heading" ref={resultHeading} tabIndex={-1}>Your recommendations</h2>{app.resultStatus === 'ready' && <span className="result-count">{resultCount} songs</span>}</div>
            <p className="sr-only" role="status" aria-live="polite">{resultStatus}</p>
            {refined && <div className="refinement-panel" aria-label="Active refinement">
              <div className="refinement-heading"><h3>Refinement active</h3><button type="button" className="text-button" onClick={() => actOnResults(app.reset)}>Reset refinement</button></div>
              <p>Preferences for this session. Your selected songs stay the starting point.</p>
              <dl className="preference-list">
                {positive.length > 0 && <div data-testid="feedback-positive"><dt>More like</dt><dd>{positive.map((track) => `${track.title} — ${track.artist}`).join('; ')}</dd></div>}
                {negative.length > 0 && <div data-testid="feedback-negative"><dt>Less like</dt><dd>{negative.map((track) => `${track.title} — ${track.artist}`).join('; ')}</dd></div>}
              </dl>
            </div>}
            {app.resultStatus === 'idle' && <div className="results-message panel">
              <h3>{selected.length ? 'Ready when you are' : 'Start with a sound you love'}</h3>
              <p>{selected.length ? 'Choose Recommend to discover songs around your selection.' : 'Search for a song, or choose a starting point from the catalog. Your neighbors will appear here.'}</p>
              <p className="message-footnote">Find a direction you like? Refine it with “More like this” or “Not this mood”.</p>
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
                  return <li key={track.id} className="result-card" data-testid="recommendation-card" data-track-id={track.id}>
                    <span className="result-rank" aria-hidden="true">{index + 1}</span>
                    <div className="result-main">
                      <h3>{track.title}</h3><p className="result-artist">{track.artist}</p>
                      <p className="recording-detail">{recordingDescription(track)}</p>
                      {closest && <p className="closest-seed">Closest to your pick: {closest.title}</p>}
                      <div className="result-actions">
                        <button type="button" className="feedback-button" aria-label={`More like this: ${track.title} by ${track.artist}`} onClick={() => actOnResults(() => app.moreLike(track.id))}>More like this <span aria-hidden="true">+</span></button>
                        <button type="button" className="feedback-button" aria-label={`Not this mood: ${track.title} by ${track.artist}`} onClick={() => actOnResults(() => app.notThisMood(track.id))}>Not this mood <span aria-hidden="true">−</span></button>
                      </div>
                    </div>
                  </li>
                })}
              </ol>
              {resultCount > 0 && <p className="results-footnote">A starting point for discovery. Similar sound doesn’t always mean a song will fit your mood.</p>}
            </>}
          </section>
        </div>
      </> : <CatalogUnavailable status={app.catalogStatus} error={app.catalogError} onRetry={app.retryCatalog} />}
      <details className="about-project" id="about-catalog">
        <summary>About Song Neighbors &amp; the catalog</summary>
        <div className="about-content">
          <p>Song Neighbors finds recordings with similar audio in a small, prepared catalog from the Free Music Archive. Many familiar or commercial songs won’t be here. A search with no match means that recording isn’t available in this catalog.</p>
          {app.catalog && <p>This catalog contains {tracks.length.toLocaleString()} recordings from {artistCount.toLocaleString()} artist names. Recommendations use analyzed audio excerpts, usually around 30 seconds, rather than whole songs. The results are sound-based suggestions, not a measure of how much you will enjoy them.</p>}
          <p>Your selected songs are the starting point. “More like this” adds a positive preference; “Not this mood” excludes that recording and gently steers away from its sound. Feedback recordings are excluded from the results. Reset clears feedback and keeps your selected songs; editing those songs starts a fresh refinement.</p>
          <p>Search and ranking run in your browser. Selections and feedback stay in memory and disappear on refresh. No account or playback is needed.</p>
          {app.catalog && <p><a href={`${import.meta.env.BASE_URL}catalog/${app.catalog.manifest.catalogVersion}/ATTRIBUTION.md`}>Catalog credits, recording licenses &amp; notices</a>. Metadata comes from the FMA dataset under CC BY 4.0; recordings retain their individual CC0 or CC BY terms. Excerpts were transformed into numerical audio representations. No endorsement is implied.</p>}
          {app.catalog && <p className="technical-note">Catalog: {app.catalog.manifest.catalogVersion}. Encoder: {app.catalog.manifest.encoder.id}, {app.catalog.manifest.dimension} dimensions. Rankings use audio similarity and session feedback; their musical usefulness has not been evaluated with listeners.</p>}
        </div>
      </details>
    </main>
    <footer className="app-footer"><span>An independent project by Arhaan.</span><span>A small catalog. New directions.</span></footer>
  </div>
}
