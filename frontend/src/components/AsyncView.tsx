import type { ReactNode } from 'react'
import type { Async } from '../lib/hooks'

interface Props<T> {
  state: Async<T>
  children: (data: T) => ReactNode
}

/** Render loading and error states once, so pages only describe success. */
export function AsyncView<T>({ state, children }: Props<T>) {
  if (state.status === 'loading') {
    return (
      <p className="notice" role="status">
        Loading…
      </p>
    )
  }
  if (state.status === 'error') {
    return (
      <p className="notice notice-error" role="alert">
        Could not load data: {state.message}
      </p>
    )
  }
  return <>{children(state.data)}</>
}
