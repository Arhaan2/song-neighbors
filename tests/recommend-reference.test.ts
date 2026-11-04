import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'
import { loadCatalog } from '../src/catalog/load.ts'
import { createRecommendationEngine } from '../src/recommend/engine.ts'
import reference from './fixtures/numpy-scores.json'
import { rankingFixture } from './fixtures/ranking.ts'

it('agrees with the independent NumPy score oracle within 1e-12 (not a quality benchmark)', async () => {
  const fixture = rankingFixture([
    { id: 'test:axis-x', vector: [1, 0] }, { id: 'test:axis-y', vector: [0, 1] },
    { id: 'test:three-four', vector: [0.6, 0.8] },
    { id: 'test:diagonal', vector: [Math.SQRT1_2, Math.SQRT1_2] },
    { id: 'test:opposite', vector: [-1, 0] },
  ])
  const engine = createRecommendationEngine(fixture)
  const compare = (actual: number | undefined, expected: number) => {
    expect(actual).toBeDefined()
    expect(Math.abs(actual! - expected)).toBeLessThanOrEqual(reference.tolerance)
  }
  const x = engine.nearestNeighbors('test:axis-x')
  const y = engine.nearestNeighbors('test:axis-y')
  const blend = engine.query({ seedIds: ['test:axis-x', 'test:axis-y'], config: { diversityWeight: 0 } })
  for (const expected of reference.fixtures.slice(2)) {
    const id = `test:${expected.id}`
    compare(x.recommendations.find((entry) => entry.id === id)?.score, expected.cosineX)
    compare(y.recommendations.find((entry) => entry.id === id)?.score, expected.cosineY)
    compare(blend.recommendations.find((entry) => entry.id === id)?.score, expected.blend)
  }
  const diskRoot = new URL('../public/catalog/', import.meta.url)
  const fetcher = (async (url: string | URL | Request) => new Response(await readFile(new URL(new URL(String(url)).pathname.replace('/catalog/', ''), diskRoot)))) as typeof fetch
  const catalog = await loadCatalog('https://example.com/catalog/', fetcher)
  expect(catalog.manifest.catalogVersion).toBe(reference.catalogVersion)
  expect(catalog.manifest.files.embeddings.sha256).toBe(reference.vectorSha256)
  // Isolate fixed pairs so the oracle covers scores regardless of top-20 eligibility.
  for (const expected of reference.realScores) {
    const tracks = [expected.seedId, expected.targetId].map((id, row) => ({ ...catalog.tracks.find((track) => track.id === id)!, row }))
    const vectors = new Float64Array(tracks.flatMap((track) => {
      const original = catalog.tracks.find((item) => item.id === track.id)!
      return Array.from(catalog.vectors.subarray(original.row * catalog.dimension, (original.row + 1) * catalog.dimension))
    }))
    const pair = createRecommendationEngine({ tracks, dimension: catalog.dimension, vectors })
    compare(pair.nearestNeighbors(expected.seedId).recommendations[0]?.score, expected.cosine)
  }
})
