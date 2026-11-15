import { useLocale } from '../lib/i18n'

interface Props {
  values: number[]
  /** Shared lower bound, so sparklines in a grid can be compared. */
  floor: number
  label: string
}

const WIDTH = 240
const HEIGHT = 56
const PAD = 4

/** A small trend line in the current --party colour, with a soft fill. */
export function Sparkline({ values, floor, label }: Props) {
  const { t } = useLocale()
  if (values.length < 2) {
    return <div className="grid h-14 place-items-center text-xs text-ink-3">{t('spark.empty')}</div>
  }
  const span = Math.max(1 - floor, 0.0001)
  const x = (index: number) => PAD + (index / (values.length - 1)) * (WIDTH - 2 * PAD)
  const y = (value: number) => PAD + (1 - (value - floor) / span) * (HEIGHT - 2 * PAD)
  const line = values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className="h-14 w-full"
      role="img"
      aria-label={label}
    >
      <polygon
        points={`${PAD},${HEIGHT} ${line} ${WIDTH - PAD},${HEIGHT}`}
        style={{ fill: 'var(--party)' }}
        opacity="0.12"
      />
      <polyline
        points={line}
        fill="none"
        style={{ stroke: 'var(--party)' }}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
