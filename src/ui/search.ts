import type { CatalogTrack } from '../catalog/contract.ts'

/** Search is metadata lookup only. Recommendation ranking stays in the audio engine. */
export function normalizeSearch(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ')
}

export function searchCatalog(tracks: readonly CatalogTrack[], query: string): CatalogTrack[] {
  const normalized = normalizeSearch(query)
  if (!normalized) return []
  const words = normalized.split(' ')
  return tracks.filter((track) => {
    const haystack = normalizeSearch(`${track.title} ${track.artist}`)
    return words.every((word) => haystack.includes(word))
  }).sort((a, b) => {
    const relevance = (track: CatalogTrack) => {
      const title = normalizeSearch(track.title)
      return title === normalized ? 0 : title.startsWith(normalized) ? 1 : 2
    }
    return relevance(a) - relevance(b) || a.title.localeCompare(b.title) || a.artist.localeCompare(b.artist) || a.id.localeCompare(b.id)
  })
}

export function recordingDescription(track: CatalogTrack): string {
  return `${track.album || 'Album not listed'} · ${track.id.toUpperCase()}`
}

/** Editorial starting points are resolved against loaded data, never substituted results. */
export function catalogExamples(tracks: readonly CatalogTrack[]): CatalogTrack[] {
  const preferred = ['fma:045099', 'fma:003832', 'fma:004037']
  const examples = preferred.flatMap((id) => tracks.find((track) => track.id === id) ?? [])
  const artists = new Set(examples.map((track) => track.artist))
  for (const track of tracks) {
    if (examples.length >= 3) break
    if (!artists.has(track.artist)) { examples.push(track); artists.add(track.artist) }
  }
  return examples
}
