import { useMemo, useState, type ReactNode } from 'react'
import { DataContext, FiltersContext, type AppData, type Filters } from '../lib/store'

/** Holds the sidebar's filter state and shares it, with the data, to all pages. */
export function Providers({ data, children }: { data: AppData; children: ReactNode }) {
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())
  const [finalOnly, setFinalOnly] = useState(true)

  const filters = useMemo<Filters>(
    () => ({
      selected,
      toggleParty: (id) =>
        setSelected((current) => {
          const next = new Set(current)
          if (!next.delete(id)) next.add(id)
          return next
        }),
      clearParties: () => setSelected(new Set()),
      finalOnly,
      setFinalOnly,
    }),
    [selected, finalOnly],
  )

  return (
    <DataContext.Provider value={data}>
      <FiltersContext.Provider value={filters}>{children}</FiltersContext.Provider>
    </DataContext.Provider>
  )
}
