/** Run in a real browser page against the production entry from dist/.vite/manifest.json.
 * No UI implementation and no synthetic catalog. Throws on any failed assertion.
 */
export async function runEngineSmoke(engineModuleUrl) {
  const api = await import(engineModuleUrl)
  const client = api.createRecommendationClient()
  const assert = (condition, message) => { if (!condition) throw new Error(message) }
  const ids = (result) => result.recommendations.map((track) => track.id)
  const started = performance.now()
  try {
    const catalog = await client.load()
    const loadMs = performance.now() - started
    assert(!('vectors' in catalog), 'Vector data leaked to main thread')
    assert((await client.load()) === catalog, 'Client reloaded catalog')
    const sessionCatalog = api.createSessionCatalog(catalog.tracks)
    const queryTimes = []
    const run = async (query) => {
      const start = performance.now()
      const result = await client.query(query)
      queryTimes.push(performance.now() - start)
      for (const item of result.recommendations) assert(catalog.tracks[item.row]?.id === item.id, 'Row identity lost')
      return result
    }
    const one = api.createSession(sessionCatalog, ['fma:045099'])
    const two = api.createSession(sessionCatalog, ['fma:003832'])
    const first = await run(one)
    const second = await run(two)
    assert(JSON.stringify(ids(first)) !== JSON.stringify(ids(second)), 'Different seeds did not change ranking')
    assert(JSON.stringify(first) === JSON.stringify(await run(one)), 'Repeated query changed ranking')
    const positiveId = first.recommendations[0].id
    const positive = api.addPositive(sessionCatalog, one, positiveId)
    assert(JSON.stringify(api.addPositive(sessionCatalog, positive, positiveId)) === JSON.stringify(positive), 'Positive is not idempotent')
    const refined = await run(positive)
    assert(!ids(refined).includes(positiveId), 'Positive recommended itself')
    const negativeId = refined.recommendations[0].id
    const negative = api.addNegative(sessionCatalog, positive, negativeId)
    const rejected = await run(negative)
    assert(!ids(rejected).includes(negativeId) && !ids(rejected).includes(positiveId), 'Feedback exclusions failed')
    const reset = api.resetRefinement(negative)
    assert(JSON.stringify(reset.seedIds) === JSON.stringify(one.seedIds), 'Reset removed seed chips')
    assert(JSON.stringify(await run(reset)) === JSON.stringify(first), 'Reset did not restore seed ranking')
    const edited = api.editSeeds(sessionCatalog, negative, two.seedIds)
    assert(!edited.positiveIds.length && !edited.negativeIds.length, 'Seed edit kept feedback')
    assert(JSON.stringify(await run(edited)) === JSON.stringify(second), 'Seed edit did not restore seed ranking')
    const superseded = client.query(one).catch((error) => error.name)
    const latest = client.query(two)
    assert(await superseded === 'SupersededRequestError', 'Old request was not cancelled')
    assert(JSON.stringify(await latest) === JSON.stringify(second), 'Newest request lost')
    const invalid = await client.query({ seedIds: ['not-an-id'] }).then(() => 'unexpected result', (error) => error.code)
    assert(invalid === 'query-failed', 'Worker query error was not propagated')
    assert((await run({ seedIds: [] })).recommendations.length === 0, 'Empty query returned songs')
    const fiveState = {
      seedIds: catalog.tracks.slice(0, 5).map((track) => track.id),
      positiveIds: [catalog.tracks[100].id], negativeIds: [catalog.tracks[200].id],
    }
    const five = await run(fiveState)
    assert(five.recommendations.length === 20 && new Set(ids(five)).size === 20, 'Five-seed case did not return 20 unique results')
    assert(five.eligibleCount === catalog.tracks.length - 7, 'Five-seed exclusions failed')
    const examples = (result) => result.recommendations.slice(0, 3).map((item) => ({ id: item.id, title: catalog.tracks[item.row].title, artist: catalog.tracks[item.row].artist, cosineToClosestSeed: item.closestSeedSimilarity }))
    return {
      catalogVersion: catalog.manifest.catalogVersion, trackCount: catalog.tracks.length,
      dimension: catalog.manifest.dimension, loadMs, queryTimesMs: queryTimes,
      seedCases: [{ seedId: one.seedIds[0], top3: examples(first) }, { seedId: two.seedIds[0], top3: examples(second) }],
      fiveSeedCase: { ...fiveState, eligibleCount: five.eligibleCount, candidateCount: five.candidateCount, resultIds: ids(five) },
      checks: ['actual module worker and Pages base', 'row identity', 'metadata-only session state', 'load coalescing', 'seed-sensitive results', 'determinism', 'positive idempotence and exclusion', 'negative exclusion', 'reset', 'seed edits', 'latest-request-wins', 'worker query errors', 'empty input', 'five seeds and twenty results'],
    }
  } finally { client.dispose() }
}
