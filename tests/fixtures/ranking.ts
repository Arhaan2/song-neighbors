import type { CatalogTrack } from '../../src/catalog/contract.ts'
import type { EngineCatalog } from '../../src/recommend/engine.ts'

/** Hand-authored mathematical fixtures only, never real music analysis. */
export function rankingFixture(entries: { id: string; vector: number[]; hash?: string; group?: string; title?: string }[]): EngineCatalog {
  const tracks: CatalogTrack[] = entries.map((entry, row) => ({
    id: entry.id, row, title: entry.title ?? 'Mathematical fixture', artist: 'Synthetic test only',
    ...(entry.group ? { recordingGroupId: entry.group } : {}),
    provenance: {
      datasetId: 'test', datasetVersion: '1', sourceRecordId: entry.id,
      sourcePage: 'https://example.org/fixture', audioSha256: entry.hash ?? row.toString(16).padStart(64, '0'),
      recordingLicense: { statement: 'Test only', url: 'https://example.org/license', attribution: 'Test only' },
      publicationBasis: 'Not publishable music data',
    },
    coverage: { sourceDurationSeconds: 1, analyzedWindows: [{ startSeconds: 0, endSeconds: 1 }], describes: 'available-audio-excerpt' },
  }))
  return { tracks, dimension: entries[0]?.vector.length ?? 2, vectors: new Float64Array(entries.flatMap(({ vector }) => vector)) }
}
