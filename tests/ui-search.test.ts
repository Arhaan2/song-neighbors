import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { catalogTracksSchema } from '../src/catalog/contract.ts'
import { catalogExamples, normalizeSearch, recordingDescription, searchCatalog } from '../src/ui/search.ts'

const tracks = catalogTracksSchema.parse(JSON.parse(readFileSync(new URL('../public/catalog/fma-small-clap-general-20261104/tracks.json', import.meta.url), 'utf8')))

describe('catalog search', () => {
  it('normalizes accents, case, punctuation, and whitespace without dropping non-Latin letters', () => {
    expect(normalizeSearch('  ÉTÉ… déjà-vu  東京 ')).toBe('ete deja vu 東京')
    expect(searchCatalog(tracks, '  SPELL rolemusic ').map((track) => track.id)).toEqual(['fma:045099'])
  })
  it('uses every token across title and artist and has an honest empty result', () => {
    expect(searchCatalog(tracks, 'Lior Bedoin').map((track) => track.id)).toEqual(['fma:003832'])
    expect(searchCatalog(tracks, 'NoSuchSongInThisCatalog123')).toEqual([])
    expect(searchCatalog(tracks, '   ')).toEqual([])
  })
  it('keeps distinct real same-title recordings with album and stable ID disambiguation', () => {
    const matches = searchCatalog(tracks, 'On Axis')
    expect(matches.map((track) => track.id).sort()).toEqual(['fma:115817', 'fma:129970'])
    expect(matches.map(recordingDescription)).toEqual(['Wilderness · FMA:115817', 'Pipe Choir · FMA:129970'])
  })
  it('resolves first-visit examples from the actual loaded catalog only', () => {
    const examples = catalogExamples(tracks)
    expect(examples.map((track) => track.id)).toEqual(['fma:045099', 'fma:003832', 'fma:004037'])
    expect(catalogExamples([])).toEqual([])
    const small = tracks.slice(1, 3)
    expect(catalogExamples(small).every((track) => small.includes(track))).toBe(true)
  })
})
