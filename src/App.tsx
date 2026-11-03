import { CatalogUnavailable } from './components/CatalogUnavailable'
import './App.css'

export default function App() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="app-header">
        <div className="wordmark">
          <svg viewBox="0 0 40 24" aria-hidden="true" className="brand-mark">
            <circle cx="12" cy="12" r="10" />
            <circle cx="28" cy="12" r="10" />
            <circle className="brand-center" cx="12" cy="12" r="2" />
            <circle className="brand-center" cx="28" cy="12" r="2" />
          </svg>
          <span>Song Neighbors</span>
        </div>
        <a className="project-link" href="https://github.com/Arhaan2/song-neighbors">View project<span aria-hidden="true"> ↗</span></a>
      </header>

      <main id="main" tabIndex={-1}>
        <div className="page-heading">
          <h1>A few songs. A place to start.</h1>
          <p>Find music with a similar sound to the songs that fit your mood.</p>
        </div>
        <CatalogUnavailable />
        <details className="about-project">
          <summary>What will Song Neighbors do?</summary>
          <div className="about-content">
            <p>Once the catalog is ready, you’ll be able to search its titles and artists, choose 1–5 songs, and get up to 20 audio-similar recommendations.</p>
            <p>“More like this” and “Not this mood” will refine that session. Results will list songs and artists, with no playback or streaming account required.</p>
            <p>Only analyzed songs in the prepared catalog will be searchable. Your favorites may not be included.</p>
          </div>
        </details>
      </main>

      <footer className="app-footer">
        <span>An independent project by Arhaan.</span>
        <span>In development</span>
      </footer>
    </div>
  )
}
