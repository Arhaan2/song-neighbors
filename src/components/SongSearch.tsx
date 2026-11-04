import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { CatalogTrack } from '../catalog/contract.ts'
import { catalogExamples, recordingDescription, searchCatalog } from '../ui/search.ts'

interface Props {
  tracks: readonly CatalogTrack[]
  selectedIds: readonly string[]
  onSelect: (id: string) => void
}

export function SongSearch({ tracks, selectedIds, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [announcement, setAnnouncement] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const scrollActive = useRef(false)
  const id = useId()
  const matches = useMemo(() => searchCatalog(tracks, query), [tracks, query])
  const results = matches.slice(0, 8)
  const selected = new Set(selectedIds)
  const atLimit = selectedIds.length >= 5
  const hasQuery = query.trim().length > 0
  const showResults = open && hasQuery
  const optionId = (index: number) => `${id}-option-${index}`
  useLayoutEffect(() => {
    if (showResults && active >= 0 && scrollActive.current) {
      document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
      scrollActive.current = false
    }
  }, [active, showResults, id])
  function choose(track: CatalogTrack) {
    if (atLimit || selected.has(track.id)) return
    onSelect(track.id)
    setQuery('')
    setActive(-1)
    setOpen(false)
    setAnnouncement(`Added ${track.title} by ${track.artist}.`)
    input.current?.focus()
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape') { setOpen(false); setActive(-1); return }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && hasQuery) {
      event.preventDefault()
      setOpen(true)
      if (results.length) {
        const next = event.key === 'ArrowDown'
          ? (active + 1) % results.length
          : active < 0 ? results.length - 1 : (active - 1 + results.length) % results.length
        scrollActive.current = true
        setActive(next)
      }
    } else if (event.key === 'Enter' && showResults && active >= 0 && results[active]) {
      event.preventDefault()
      choose(results[active])
    }
  }
  return <div className="song-search" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActive(-1) }
  }}>
    <label htmlFor={id}>Search songs or artists</label>
    <div className="search-field">
      <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
      <input ref={input} id={id} type="text" role="combobox" autoComplete="off" spellCheck={false}
        aria-autocomplete="list" aria-expanded={showResults && results.length > 0}
        aria-controls={showResults && results.length ? `${id}-results` : undefined}
        aria-activedescendant={showResults && active >= 0 && results[active] ? optionId(active) : undefined}
        aria-describedby={`${id}-help`} placeholder="Try Rolemusic or Bedoin Song" value={query}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(-1); setAnnouncement('') }}
        onFocus={() => setOpen(true)} onKeyDown={onKeyDown} />
      {query && <button className="clear-search" type="button" aria-label="Clear search" onClick={() => {
        setQuery(''); setActive(-1); setOpen(false); input.current?.focus()
      }}>×</button>}
    </div>
    <p id={`${id}-help`} className="search-help">{atLimit ? 'Five songs selected. Remove one to choose another.' : 'Search this catalog. Use ↑ ↓ and Enter to choose.'}</p>
    {showResults && <div className="search-matches">
      {results.length > 0 ? <>
        <p className="match-count" role="status">{matches.length > results.length ? `Showing ${results.length} of ${matches.length} matches. Keep typing to narrow them down.` : `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`}</p>
        <ul id={`${id}-results`} role="listbox" aria-label="Matching songs" className="search-options">
          {results.map((track, index) => <li key={track.id} role="none">
            <button id={optionId(index)} data-track-id={track.id} type="button" role="option" tabIndex={-1}
              aria-selected={active === index} aria-disabled={atLimit || selected.has(track.id)}
              className={`search-option${active === index ? ' is-active' : ''}`}
              onPointerDown={(event) => event.preventDefault()}
              onPointerMove={() => { scrollActive.current = false; setActive(index) }} onClick={() => choose(track)}>
              <span className="track-text"><strong>{track.title}</strong><span>{track.artist}</span><small>{recordingDescription(track)}</small></span>
              <span className="choice-mark" aria-hidden="true">{selected.has(track.id) ? 'Added' : atLimit ? 'Full' : '+'}</span>
            </button>
          </li>)}
        </ul>
      </> : <div className="no-match" role="status">
        <strong>No songs found here</strong>
        <p>Try another title or artist. This small catalog may not include the song you have in mind.</p>
      </div>}
    </div>}
    {!hasQuery && selectedIds.length === 0 && <div className="catalog-examples">
      <p className="examples-label">New here? Start with a song from the catalog.</p>
      <ul className="example-list">
        {catalogExamples(tracks).map((track) => <li key={track.id}>
          <button type="button" className="example-song" data-track-id={track.id} onClick={() => choose(track)} aria-label={`Select ${track.title} by ${track.artist}`}>
            <span className="track-text"><strong>{track.title}</strong><span>{track.artist}</span></span>
            <span className="choice-mark" aria-hidden="true">+</span>
          </button>
        </li>)}
      </ul>
    </div>}
    <span className="sr-only" role="status">{announcement}</span>
  </div>
}
