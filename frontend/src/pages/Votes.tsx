import { useState } from 'react'
import { AsyncView, PageHeader } from '../components/ui'
import { VoteList } from '../components/VoteList'
import { fetchVotePage, PAGE_SIZE } from '../lib/api'
import { useAsync } from '../lib/hooks'
import { useFilters, useVisibleParties } from '../lib/store'

export function Votes() {
  const { finalOnly } = useFilters()
  const parties = useVisibleParties()
  // Paging restarts whenever the filter changes what the list contains.
  const [paging, setPaging] = useState({ page: 0, finalOnly })
  const page = paging.finalOnly === finalOnly ? paging.page : 0
  const setPage = (next: number) => setPaging({ page: next, finalOnly })

  const state = useAsync(() => fetchVotePage(page, finalOnly), [page, finalOnly])

  return (
    <>
      <PageHeader
        title="Votes"
        lede="Every electronic vote in the Chamber of Deputies and in joint sittings, newest first. Each chip shows how the majority of a group voted; pick groups in the sidebar to narrow them down."
      />
      <AsyncView state={state}>
        {(data) => (
          <>
            <VoteList page={data} parties={parties} />
            <p className="mt-3 max-w-[80ch] text-xs text-ink-3">
              “Carried” means more votes for than against. The source does not publish the official
              outcome, which for some votes depends on a qualified majority.
            </p>
            <div className="mt-4 flex items-center gap-3 text-sm">
              <PagerButton disabled={page === 0} onClick={() => setPage(page - 1)}>
                ← Newer
              </PagerButton>
              <span className="tabular-nums text-ink-2">Page {page + 1}</span>
              <PagerButton
                disabled={data.votes.length < PAGE_SIZE}
                onClick={() => setPage(page + 1)}
              >
                Older →
              </PagerButton>
            </div>
          </>
        )}
      </AsyncView>
    </>
  )
}

function PagerButton(props: { disabled: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      {...props}
      className="cursor-pointer rounded-lg border border-line bg-panel px-3 py-1.5 font-medium hover:bg-sunken disabled:cursor-default disabled:text-ink-3 disabled:hover:bg-panel"
    />
  )
}
