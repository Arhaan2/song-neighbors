declare const __CATALOG_SUMMARY__: {
  trackCount: number
  artistCount: number
  catalogVersion: string | null
}

/** Static build-time status; search and recommendations remain later-phase work. */
export function CatalogUnavailable() {
  const catalog = __CATALOG_SUMMARY__
  return (
    <section className="catalog-empty" aria-labelledby="catalog-heading">
      <div className="catalog-message">
        <h2 id="catalog-heading">{catalog.catalogVersion ? 'The catalog is prepared' : 'The catalog is not ready'}</h2>
        {catalog.catalogVersion ? (
          <>
            <p>Audio excerpts from {catalog.artistCount} artists have been analyzed. Search and recommendations are still in development.</p>
            <p><a href={`${import.meta.env.BASE_URL}catalog/${catalog.catalogVersion}/ATTRIBUTION.md`}>Catalog credits and licenses</a></p>
          </>
        ) : (
          <p>No songs have been analyzed yet. Search and recommendations will be available once the catalog and discovery tools are ready.</p>
        )}
      </div>
      <dl className="catalog-count">
        <dt>Analyzed songs</dt>
        <dd>{catalog.trackCount}</dd>
      </dl>
    </section>
  )
}
