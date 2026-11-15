import { useState } from 'react'
import { heatColors } from '../lib/format'
import { usePrefersDark } from '../lib/hooks'
import { useLocale, type MessageKey } from '../lib/i18n'
import { attendanceOf, dissentOf, type Region, type Totals } from '../lib/regions'
import { MAP_COUNTIES, MAP_HEIGHT, MAP_REGIONS, MAP_WIDTH } from '../lib/romaniaMap'
import { PartyMix } from './PartyMix'
import { Card } from './ui'

type Metric = 'attendance' | 'dissent'

const METRICS: { key: Metric; label: MessageKey; of: (totals: Totals) => number | null }[] = [
  { key: 'attendance', label: 'regions.attendance', of: attendanceOf },
  { key: 'dissent', label: 'regions.dissent', of: dissentOf },
]

const NO_DATA = 'var(--color-sunken)'

/**
 * Romania with its development regions, shaded by one measure. Hovering or
 * focusing a region shows its details; clicking opens its page.
 */
export function RegionMap({ regions }: { regions: Region[] }) {
  const { t, percent } = useLocale()
  const dark = usePrefersDark()
  const [metricKey, setMetricKey] = useState<Metric>('attendance')
  const [hovered, setHovered] = useState<string | null>(null)

  const metric = METRICS.find((candidate) => candidate.key === metricKey) ?? METRICS[0]
  const bySlug = new Map(regions.map((region) => [region.slug as string, region]))
  const values = new Map(regions.map((region) => [region.slug as string, metric.of(region.totals)]))

  // The measures differ by only a few points between regions, so the shading
  // spans the observed range rather than 0 to 100%. The legend states its ends.
  const known = [...values.values()].filter((value): value is number => value !== null)
  const low = known.length ? Math.min(...known) : 0
  const high = known.length ? Math.max(...known) : 0
  const colors = (slug: string) => {
    const value = values.get(slug)
    if (value === null || value === undefined) return null
    return heatColors(high > low ? (value - low) / (high - low) : 0.5, dark)
  }
  const show = (value: number | null | undefined) =>
    value === null || value === undefined ? '–' : percent(value)

  const active = hovered ? bySlug.get(hovered) : undefined
  const diaspora = bySlug.get('diaspora')
  const diasporaColors = colors('diaspora')

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 pr-0 lg:pr-28">
        <div
          role="group"
          aria-label={t('map.shadeBy')}
          className="flex rounded-lg border border-line bg-canvas p-0.5 text-sm"
        >
          {METRICS.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={metricKey === option.key}
              onClick={() => setMetricKey(option.key)}
              className={`cursor-pointer rounded-md px-3 py-1 font-medium ${
                metricKey === option.key
                  ? 'bg-accent-soft text-accent'
                  : 'text-ink-2 hover:text-ink'
              }`}
            >
              {t(option.label)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-2">
          <span className="tabular-nums">{show(known.length ? low : null)}</span>
          <span
            aria-hidden="true"
            className="h-2 w-28 rounded-full"
            style={{
              background: `linear-gradient(90deg, ${heatColors(0, dark).background}, ${heatColors(0.5, dark).background}, ${heatColors(1, dark).background})`,
            }}
          />
          <span className="tabular-nums">{show(known.length ? high : null)}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <svg
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          role="group"
          aria-label={t('map.label')}
          className="h-auto w-full"
          onMouseLeave={() => setHovered(null)}
        >
          {MAP_REGIONS.map((shape) => {
            const region = bySlug.get(shape.slug)
            const fill = colors(shape.slug)?.background ?? NO_DATA
            const name = t(`region.${shape.slug}` as MessageKey)
            return (
              <a
                key={shape.slug}
                href={`#/regions/${shape.slug}`}
                aria-label={`${name}: ${t(metric.label)} ${show(values.get(shape.slug))}`}
                onMouseEnter={() => setHovered(shape.slug)}
                onFocus={() => setHovered(shape.slug)}
                onBlur={() => setHovered(null)}
                className="outline-none"
                style={{ opacity: hovered && hovered !== shape.slug ? 0.55 : 1 }}
              >
                {MAP_COUNTIES.filter((county) => county.region === shape.slug).map((county) => (
                  <path
                    key={county.id}
                    d={county.d}
                    fill={fill}
                    stroke="var(--color-panel)"
                    strokeOpacity="0.35"
                    strokeWidth="0.75"
                  />
                ))}
                {/* The region's outline, drawn in the page colour to read as a gap. */}
                <path
                  d={shape.d}
                  fill="none"
                  stroke={hovered === shape.slug ? 'var(--color-ink)' : 'var(--color-panel)'}
                  strokeWidth={hovered === shape.slug ? 2.5 : 3}
                  strokeLinejoin="round"
                />
                {region && <title>{name}</title>}
              </a>
            )
          })}
          {/* Labels go last so no neighbouring region is painted over them. */}
          {MAP_REGIONS.map(
            (shape) =>
              shape.anchor && (
                <g key={shape.slug} pointerEvents="none">
                  <line
                    x1={shape.anchor[0]}
                    y1={shape.anchor[1]}
                    x2={shape.x}
                    y2={shape.y}
                    stroke="var(--color-ink)"
                    strokeWidth="1"
                  />
                  <circle cx={shape.anchor[0]} cy={shape.anchor[1]} r="2.5" fill="var(--color-ink)" />
                </g>
              ),
          )}
          {MAP_REGIONS.map((shape) => (
            <text
              key={shape.slug}
              x={shape.x}
              y={shape.y}
              textAnchor="middle"
              pointerEvents="none"
              fill="var(--color-ink)"
              stroke="var(--color-panel)"
              strokeWidth="4"
              strokeLinejoin="round"
              paintOrder="stroke"
              style={{ opacity: hovered && hovered !== shape.slug ? 0.55 : 1 }}
            >
              <tspan x={shape.x} fontSize="14" fontWeight="600">
                {t(`region.${shape.slug}` as MessageKey)}
              </tspan>
              <tspan x={shape.x} dy="18" fontSize="15" fontWeight="700">
                {show(values.get(shape.slug))}
              </tspan>
            </text>
          ))}
        </svg>

        <div className="flex flex-col gap-3 text-sm">
          {active ? (
            <>
              <div>
                <div className="text-lg font-semibold tracking-tight">
                  {t(`region.${active.slug}`)}
                </div>
                <div className="text-ink-2">
                  {active.counties.map((county) => county.constituency.name).join(' · ')}
                </div>
              </div>
              <dl className="grid grid-cols-3 gap-2">
                <Figure label={t('regions.colMembers')} value={String(active.totals.members)} />
                <Figure
                  label={t('regions.attendance')}
                  value={show(attendanceOf(active.totals))}
                />
                <Figure label={t('regions.dissent')} value={show(dissentOf(active.totals))} />
              </dl>
              <PartyMix members={active.members} />
            </>
          ) : (
            <p className="text-ink-2">{t('map.hint')}</p>
          )}

          {diaspora && (
            <a
              href="#/regions/diaspora"
              onMouseEnter={() => setHovered('diaspora')}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered('diaspora')}
              onBlur={() => setHovered(null)}
              className="mt-auto flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 hover:border-accent"
            >
              <span>
                <span className="font-medium">{t('region.diaspora')}</span>
                <span className="block text-xs text-ink-3">{t('map.diaspora')}</span>
              </span>
              <span
                className="rounded-lg px-2 py-1 text-sm font-semibold tabular-nums"
                style={diasporaColors ?? { background: NO_DATA }}
              >
                {show(values.get('diaspora'))}
              </span>
            </a>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-3">{t('map.credit')}</p>
    </Card>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="text-base font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
