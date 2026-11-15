import type { ReactNode } from 'react'
import { CHOICE_LABELS } from '../lib/format'
import type { Async } from '../lib/hooks'
import { partyStyle } from '../lib/parties'
import type { Choice, Party, Result } from '../lib/types'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-panel shadow-xs ${className}`}>
      {children}
    </div>
  )
}

export function PageHeader({ title, lede }: { title: string; lede?: ReactNode }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {lede && <p className="mt-1 max-w-[70ch] text-sm text-ink-2">{lede}</p>}
    </header>
  )
}

export function SectionTitle({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="mb-3 mt-10">
      <h2 className="text-lg font-semibold tracking-tight">{children}</h2>
      {note && <p className="mt-0.5 max-w-[75ch] text-sm text-ink-2">{note}</p>}
    </div>
  )
}

export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <p
      role={error ? 'alert' : 'status'}
      className={`rounded-xl border px-4 py-3 text-sm ${
        error ? 'border-against text-ink' : 'border-line text-ink-2'
      }`}
    >
      {children}
    </p>
  )
}

/** Render loading and error states once, so pages only describe success. */
export function AsyncView<T>({
  state,
  children,
}: {
  state: Async<T>
  children: (data: T) => ReactNode
}) {
  if (state.status === 'loading') {
    return <div className="h-32 animate-pulse rounded-2xl bg-sunken" role="status" aria-label="Loading" />
  }
  if (state.status === 'error') return <Notice error>Could not load data: {state.message}</Notice>
  return <>{children(state.data)}</>
}

/** A small disc in the group's colour. Decorative: always sits beside the name. */
export function PartyDot({ party }: { party: Party | undefined }) {
  return (
    <span
      aria-hidden="true"
      style={partyStyle(party)}
      className="inline-block size-2.5 shrink-0 rounded-full bg-(--party)"
    />
  )
}

export function Stat({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <Card className="min-w-0 p-4">
      <div className="truncate text-xs font-medium uppercase tracking-wide text-ink-3">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">{value}</div>
      {detail && <div className="mt-0.5 text-sm text-ink-2">{detail}</div>}
    </Card>
  )
}

const CHOICE_ICONS: Record<Choice, string> = { for: '✓', against: '✕', abstain: '○', not_voted: '–' }
const CHOICE_INK: Record<Choice, string> = {
  for: 'text-for',
  against: 'text-against',
  abstain: 'text-ink-3',
  not_voted: 'text-ink-3',
}

/** A choice as icon plus label, so it never depends on colour alone. */
export function ChoiceBadge({ choice, short = false }: { choice: Choice; short?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium">
      <span aria-hidden="true" className={CHOICE_INK[choice]}>
        {CHOICE_ICONS[choice]}
      </span>
      {short ? <span className="sr-only">{CHOICE_LABELS[choice]}</span> : CHOICE_LABELS[choice]}
    </span>
  )
}

export function ResultBadge({ result }: { result: Result }) {
  const carried = result === 'passed'
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-sunken px-2.5 py-0.5 text-xs font-semibold">
      <span aria-hidden="true" className={carried ? 'text-for' : 'text-against'}>
        {carried ? '✓' : '✕'}
      </span>
      {carried ? 'Carried' : 'Not carried'}
    </span>
  )
}

export interface Segment {
  label: string
  value: number
  className: string
}

/** A thin split bar with its numbers written out underneath. */
export function SplitBar({ segments, caption = true }: { segments: Segment[]; caption?: boolean }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  const shown = segments.filter((segment) => segment.value > 0)
  return (
    <div>
      <div
        className="flex h-2 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={segments.map((segment) => `${segment.value} ${segment.label}`).join(', ')}
      >
        {total === 0 ? (
          <div className="grow bg-sunken" />
        ) : (
          shown.map((segment) => (
            <div
              key={segment.label}
              className={`${segment.className} rounded-xs`}
              style={{ flexGrow: segment.value }}
              title={`${segment.value} ${segment.label}`}
            />
          ))
        )}
      </div>
      {caption && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-ink-2">
          {segments.map((segment) => (
            <span key={segment.label} className="inline-flex items-center gap-1">
              <span aria-hidden="true" className={`size-2 rounded-xs ${segment.className}`} />
              <span className="font-medium tabular-nums text-ink">{segment.value}</span> {segment.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
