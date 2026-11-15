import { useState } from 'react'
import { AsyncView, PageHeader } from '../components/ui'
import { VoteList } from '../components/VoteList'
import { fetchVotePage, PAGE_SIZE } from '../lib/api'
import { useAsync } from '../lib/hooks'
import { useLocale } from '../lib/i18n'
import { useFilters, useVisibleParties } from '../lib/store'

export function Votes() {
  const { t } = useLocale()
  const { finalOnly } = useFilters()
  const parties = useVisibleParties()
  // Paging restarts whenever the filter changes what the list contains.
  const [paging, setPaging] = useState({ page: 0, finalOnly })
  const page = paging.finalOnly === finalOnly ? paging.page : 0
  const setPage = (next: number) => setPaging({ page: next, finalOnly })

  const state = useAsync(() => fetchVotePage(page, finalOnly), [page, finalOnly])

  return (
    <>
      <PageHeader title={t('votes.title')} lede={t('votes.lede')} />
      <AsyncView state={state}>
        {(data) => (
          <>
            <VoteList page={data} parties={parties} />
            <p className="mt-3 max-w-[80ch] text-xs text-ink-3">{t('votes.footnote')}</p>
            <div className="mt-4 flex items-center gap-3 text-sm">
              <PagerButton disabled={page === 0} onClick={() => setPage(page - 1)}>
                {t('pager.newer')}
              </PagerButton>
              <span className="tabular-nums text-ink-2">{t('pager.page', { n: page + 1 })}</span>
              <PagerButton
                disabled={data.votes.length < PAGE_SIZE}
                onClick={() => setPage(page + 1)}
              >
                {t('pager.older')}
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
