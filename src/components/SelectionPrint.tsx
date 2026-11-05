interface SelectionPrintProps {
  ids: readonly string[]
  compact?: boolean
}

// A repeatable visual identity only: identifiers select print geometry, not audio traits.
function stamp(value: string): number {
  let hash = 2166136261
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return hash >>> 0
}

function rings(outer: number, inset: number): string {
  const paths: string[] = []
  for (let radius = inset; radius < outer - 5; radius += 4.5) {
    paths.push(`M${-radius},0a${radius},${radius} 0 1,0 ${radius * 2},0a${radius},${radius} 0 1,0 ${-radius * 2},0`)
  }
  return paths.join(' ')
}

export function SelectionPrint({ ids, compact = false }: SelectionPrintProps) {
  const unique = [...new Set(ids)].sort()
  // Every identifier, including refinement, affects the print; only visible layers are capped.
  const composition = stamp(JSON.stringify(unique))
  const seeds = unique.length ? unique.slice(0, 5) : ['song-neighbors:opening-print']
  const width = compact ? 190 : 600
  const height = 190
  const radius = compact ? 106 - (seeds.length - 1) * 11 : 190 - (seeds.length - 1) * 22

  return <svg className="selection-print" viewBox={`0 0 ${width} ${height}`}
    aria-hidden="true" focusable="false" width="100%" preserveAspectRatio="xMidYMid slice"
    style={{ display: 'block', overflow: 'hidden' }}>
    <path fill="#f0e7da" d={`M0 0h${width}v${height}H0z`} />
    {seeds.map((id, index) => {
      const hash = stamp(`${composition}:${id}`)
      const jitter = (hash % 31) - 15
      const spread = seeds.length === 2 ? .54 : .8
      const x = seeds.length === 1 ? width * .52 + jitter
        : width * ((1 - spread) / 2 + spread * (index / (seeds.length - 1))) + jitter * .35
      const y = compact ? 95 + jitter * .5 : 82 + ((hash >>> 6) % 88)
      const angle = ((hash >>> 14) % 100) - 50
      const dark = (index + (composition % 2)) % 2 === 0
      const ink = dark ? '#23241f' : '#a63720'
      const cut = dark ? '#383a32' : '#b94c32'
      const groove = dark ? '#aea89a' : '#edac86'
      const label = 21 + ((hash >>> 20) % 16)
      return <g key={id} transform={`translate(${x} ${y}) rotate(${angle})`}>
        <circle r={radius} fill={ink} />
        <path d={`M0 0L${radius} 0A${radius} ${radius} 0 0 1 0 ${radius}Z`} fill={cut} />
        <path d={rings(radius, label + 9)} fill="none" stroke={groove} strokeWidth=".8" />
        <circle r={label} fill="#f4d9b9" />
        <path d={`M${-label} 0a${label} ${label} 0 0 1 ${label * 2} 0Z`} fill="#d57957" />
        <circle r="2.8" fill={ink} />
      </g>
    })}
  </svg>
}
