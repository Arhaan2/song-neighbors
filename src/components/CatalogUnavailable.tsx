interface Props {
  status: 'loading' | 'error' | 'unavailable'
  error: string | null
  onRetry: () => void
}

export function CatalogUnavailable({ status, error, onRetry }: Props) {
  return <section className="catalog-status panel" aria-labelledby="catalog-heading" aria-busy={status === 'loading'}>
    <h2 id="catalog-heading">{status === 'loading' ? 'Opening the catalog…' : status === 'unavailable' ? 'The catalog is unavailable' : 'We couldn’t open the catalog'}</h2>
    <p role={status === 'error' ? 'alert' : 'status'}>{status === 'loading'
      ? 'Getting the songs ready for search and recommendations.'
      : error || 'Songs are unavailable right now. Please try again in a moment.'}</p>
    {status !== 'loading' && <button type="button" className="secondary-button" onClick={onRetry}>Retry catalog</button>}
  </section>
}
