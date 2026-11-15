import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

type Input = string | number | boolean | undefined

export type Async<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T }

/**
 * Run an async loader, again whenever one of `inputs` changes, ignoring
 * results that arrive after a newer run has started.
 */
export function useAsync<T>(load: () => Promise<T>, inputs: readonly Input[]): Async<T> {
  // Inputs are primitives, so their JSON form is a stable effect dependency.
  const key = JSON.stringify(inputs)
  const [settled, setSettled] = useState<{ key: string; state: Async<T> } | null>(null)

  const latestLoad = useRef(load)
  useEffect(() => {
    latestLoad.current = load
  })

  useEffect(() => {
    let current = true
    latestLoad.current().then(
      (data) => current && setSettled({ key, state: { status: 'ready', data } }),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        if (current) setSettled({ key, state: { status: 'error', message } })
      },
    )
    return () => {
      current = false
    }
  }, [key])

  // A result for other inputs is stale: show loading until the new one lands.
  return settled?.key === key ? settled.state : { status: 'loading' }
}

function subscribeToHash(notify: () => void) {
  window.addEventListener('hashchange', notify)
  return () => window.removeEventListener('hashchange', notify)
}

/** The path after "#", e.g. "/mp/12". Hash routing needs no server rewrites on GitHub Pages. */
export function useHashPath(): string {
  return useSyncExternalStore(subscribeToHash, () => window.location.hash.slice(1) || '/')
}

const darkQuery = '(prefers-color-scheme: dark)'

function subscribeToScheme(notify: () => void) {
  const media = window.matchMedia(darkQuery)
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}

export function usePrefersDark(): boolean {
  return useSyncExternalStore(subscribeToScheme, () => window.matchMedia(darkQuery).matches)
}
