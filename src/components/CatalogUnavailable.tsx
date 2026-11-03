/** Phase 0 intentionally has no search, player, or recommendation results. */
export function CatalogUnavailable() {
  return (
    <section className="catalog-empty" aria-labelledby="catalog-heading">
      <div className="catalog-message">
        <h2 id="catalog-heading">The catalog is not ready</h2>
        <p>No songs have been analyzed yet. Search and recommendations will be available once the catalog is ready.</p>
      </div>
      <dl className="catalog-count">
        <dt>Analyzed songs</dt>
        <dd>0</dd>
      </dl>
    </section>
  )
}
