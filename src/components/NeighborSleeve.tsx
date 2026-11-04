// Uneven gaps between groups of grooves suggest the bands on a pressed record.
const grooveRadii = [57, 61, 65, 69, 73, 77, 86, 90, 94, 98, 102, 106, 116, 120, 124, 128, 132, 136, 146, 150, 154, 158, 162, 166, 172]
const grooves = grooveRadii.map(radius =>
  `M ${-radius} 0 a ${radius} ${radius} 0 1 0 ${radius * 2} 0 a ${radius} ${radius} 0 1 0 ${-radius * 2} 0`,
).join(' ')

export function NeighborSleeve() {
  return (
    <svg className="neighbor-sleeve" viewBox="0 0 640 220" preserveAspectRatio="xMidYMid slice"
      width="100%" aria-hidden="true" focusable="false" style={{ display: 'block' }}>
      <path fill="#e99b80" d="M0 0h640v220H0z" />

      <g transform="translate(166 40) rotate(-28)">
        <circle r="179" fill="#a13e31" />
        <path d="M0 0 55-170A179 179 0 0 1 120-133ZM0 0-55 170a179 179 0 0 1-65-37Z" fill="#ad4939" />
        <path d={grooves} fill="none" stroke="#e19275" strokeWidth=".85" />
        <circle r="49" fill="#eeb89b" />
        <path d="M-49 0a49 49 0 0 1 98 0Z" fill="#d77355" />
        <circle r="3.6" fill="#642b24" />
      </g>

      <g transform="translate(463 158) rotate(-28) scale(1.08)">
        <circle r="179" fill="#282923" />
        <path d="M0 0 55-170A179 179 0 0 1 120-133ZM0 0-55 170a179 179 0 0 1-65-37Z" fill="#353630" />
        <path d={grooves} fill="none" stroke="#838075" strokeWidth=".85" />
        <circle r="49" fill="#f4dec1" />
        <path d="M-49 0a49 49 0 0 1 98 0Z" fill="#db7657" />
        <path d="M-48 9h96M-47 14h94" fill="none" stroke="#b85841" strokeWidth="1.4" />
        <circle r="3.6" fill="#282923" />
      </g>
    </svg>
  )
}
