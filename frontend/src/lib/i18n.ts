import { createContext, useContext } from 'react'
import type { Choice } from './types'

export type Lang = 'ro' | 'en'

export const LANGS: { code: Lang; label: string; name: string }[] = [
  { code: 'ro', label: 'RO', name: 'Română' },
  { code: 'en', label: 'EN', name: 'English' },
]

/** Romanian is the default: it is the language of the votes themselves. */
export const DEFAULT_LANG: Lang = 'ro'

const ro = {
  'app.title': 'Monitor voturi Parlament',
  'brand.line1': 'Parlament',
  'brand.line2': 'Monitor voturi',
  'language': 'Limbă',
  'loading': 'Se încarcă…',
  'error.load': 'Datele nu au putut fi încărcate: {message}',
  'error.noSource':
    'Această versiune nu are o sursă de date. Setează VITE_SUPABASE_URL și VITE_SUPABASE_ANON_KEY și reconstruiește aplicația.',
  'error.notFound': 'Pagina nu a fost găsită.',

  'nav.parties': 'Partide',
  'nav.votes': 'Voturi',
  'nav.members': 'Parlamentari',
  'menu.open': 'Deschide meniul și filtrele',
  'menu.close': 'Închide meniul',

  'sidebar.find': 'Caută un parlamentar',
  'search.placeholder': 'Caută după nume…',
  'search.aria': 'Caută parlamentari după nume',
  'search.none': 'Niciun parlamentar găsit.',
  'sidebar.parties': 'Partide',
  'sidebar.selected': '{n} selectate · șterge',
  'sidebar.all': 'toate {n}',
  'sidebar.partyTitle': '{name}: {n} membri',
  'sidebar.partiesHelp':
    'Alege unul sau mai multe pentru a filtra toate paginile. Numărul arată câți membri are grupul; bara îi compară mărimea cu cel mai mare grup.',
  'sidebar.votes': 'Voturi',
  'sidebar.finalOnly': 'Doar voturi finale',
  'sidebar.finalHelp': 'Ascunde voturile procedurale, cum ar fi aprobarea ordinii de zi.',
  'sidebar.sourceBefore': 'Date de la',
  'sidebar.sourceAfter': ', actualizate zilnic. Nu este o publicație oficială.',

  'dash.title': 'Partidele dintr-o privire',
  'dash.lede':
    'Câte un panou pentru fiecare grup parlamentar: cât de unit votează, ce poziție a avut la voturile recente și cu cine votează cel mai asemănător. Primele trei ca mărime sunt afișate implicit; alege altele din bara laterală.',
  'stat.partiesShown': 'Partide afișate',
  'stat.ofN': 'din {n}',
  'stat.ofNSelected': 'din {n} selectate',
  'stat.members': 'Parlamentari',
  'stat.membersDetail': 'în partidele afișate',
  'stat.latestSitting': 'Ultima ședință',
  'stat.recentVotes': 'Voturi recente comparate',
  'stat.finalOnly': 'doar voturi finale',
  'stat.allVotes': 'toate voturile',
  'dash.showAll': 'Arată toate cele {n} partide',
  'dash.showThree': 'Arată doar primele trei',
  'dash.similarityTitle': 'Cine votează cu cine',
  'dash.similarityNote':
    'Procentul voturilor{year} la care două grupuri au avut aceeași poziție majoritară. Cu cât o celulă iese mai mult în evidență față de pagină, cu atât cele două au votat mai des la fel. Treci cu mouse-ul peste o celulă pentru numărul de voturi.',
  'dash.inYear': ' din {year}',

  'widget.members': '{n} membri',
  'widget.cohesion': 'Coeziune',
  'widget.delta': '{delta} față de luna anterioară',
  'widget.notBloc':
    'Parlamentarii neafiliați nu votează ca un bloc, așa că nu se afișează coeziunea.',
  'widget.recentPositions': 'Poziția la voturile recente',
  'widget.mostLike': 'Cel mai asemănător',
  'widget.leastLike': 'Cel mai diferit',
  'spark.label': 'Coeziunea {party} pe luni',
  'spark.empty': 'Date insuficiente deocamdată',
  'delta.unit': 'pp',

  'tally.for': 'pentru',
  'tally.against': 'împotrivă',
  'tally.abstained': 'abțineri',
  'choice.for': 'Pentru',
  'choice.against': 'Împotrivă',
  'choice.abstain': 'Abținere',
  'choice.not_voted': 'Nu a votat',
  'result.carried': 'A trecut',
  'result.notCarried': 'Nu a trecut',

  'votes.title': 'Voturi',
  'votes.lede':
    'Toate voturile electronice din Camera Deputaților și din ședințele comune, cele mai noi primele. Fiecare etichetă arată cum a votat majoritatea unui grup; alege grupuri din bara laterală pentru a le restrânge.',
  'votes.footnote':
    '„A trecut” înseamnă mai multe voturi pentru decât împotrivă. Sursa nu publică rezultatul oficial, care pentru unele voturi depinde de o majoritate calificată.',
  'votes.none': 'Niciun vot de afișat.',
  'pager.newer': '← Mai noi',
  'pager.older': 'Mai vechi →',
  'pager.page': 'Pagina {n}',
  'vote.final': 'Vot final',
  'vote.billPage': 'Pagina proiectului',
  'chamber.deputies': 'Camera Deputaților',
  'chamber.senate': 'Senat',
  'chamber.joint': 'Ședință comună',
  'chip.voted': '{party}: {a} din {b} au votat astfel',
  'chip.none': '{party}: niciun vot exprimat',

  'heatmap.cell': '{a} și {b}: aceeași poziție la {percent} din {n} voturi',
  'heatmap.need': 'Selectează cel puțin două partide cu voturi pentru a le compara.',

  'party.back': '← Toate partidele',
  'party.none': 'Partid inexistent.',
  'party.members': 'Membri',
  'party.currentLegislature': 'legislatura curentă',
  'party.deputiesSenators': 'Deputați / senatori',
  'party.cohesionDetail': '{month}, {n} voturi',
  'party.cohesionTitle': 'Coeziunea în timp',
  'party.cohesionNote':
    'Din voturile exprimate de membrii săi în fiecare lună, ponderea celor care au coincis cu poziția majoritară a grupului.',
  'party.likeTitle': 'Votează cel mai asemănător cu',
  'party.likeNote':
    'Ponderea voturilor la care acest grup și un altul au avut aceeași poziție majoritară.',
  'party.likeRow': 'Aceeași poziție la {percent} din {n} voturi',
  'party.noCompare': 'Nu există încă date de comparație.',
  'party.recentTitle': 'Voturi recente',
  'party.recentNote': 'Eticheta de la fiecare vot arată cum a votat majoritatea acestui grup.',
  'party.noMembers': 'Niciun membru în legislatura curentă.',
  'chart.cohesionValue': '{percent} din {n} voturi',

  'role.deputies': 'Deputat',
  'role.senate': 'Senator',
  'members.title': 'Parlamentari',
  'members.lede':
    'Deputații și senatorii din legislatura curentă, pe grupuri. Senatorii apar aici pentru că votează în ședințele comune.',
  'members.all': 'Toți',
  'members.deputies': 'Deputați',
  'members.senators': 'Senatori',
  'members.chamber': 'Cameră',

  'member.back': '← Toți parlamentarii',
  'member.none': 'Parlamentar inexistent.',
  'member.legislature': 'legislatura {n}',
  'member.attendance': 'Prezență',
  'member.attendanceDetail': 'prezent la {a} din {b} voturi',
  'member.againstGroup': 'Voturi împotriva propriului grup',
  'member.againstDetail': '{percent} din {n} voturi exprimate',
  'member.noVotesCast': 'niciun vot exprimat',
  'member.presentNoVote': 'Prezent fără a vota',
  'member.times': 'ori',
  'member.footnote':
    'Calculat de la {from} până la {to}. Sursa listează doar parlamentarii prezenți, așa că absența este dedusă din voturile ținute în această perioadă.',
  'member.recentTitle': 'Voturi recente',
  'member.noBallots': 'Niciun vot înregistrat.',
  'member.ballot': 'Vot',
  'member.groupPosition': 'Poziția grupului',
  'member.dissent': '⚠ Împotriva propriului grup',
}

export type MessageKey = keyof typeof ro

const en: Record<MessageKey, string> = {
  'app.title': 'Parliament Vote Tracker',
  'brand.line1': 'Parliament',
  'brand.line2': 'Vote Tracker',
  'language': 'Language',
  'loading': 'Loading…',
  'error.load': 'Could not load data: {message}',
  'error.noSource':
    'This build has no data source. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY and rebuild.',
  'error.notFound': 'Page not found.',

  'nav.parties': 'Parties',
  'nav.votes': 'Votes',
  'nav.members': 'Members',
  'menu.open': 'Open menu and filters',
  'menu.close': 'Close menu',

  'sidebar.find': 'Find a member',
  'search.placeholder': 'Search by name…',
  'search.aria': 'Search members by name',
  'search.none': 'No members match.',
  'sidebar.parties': 'Parties',
  'sidebar.selected': '{n} selected · clear',
  'sidebar.all': 'all {n}',
  'sidebar.partyTitle': '{name}: {n} members',
  'sidebar.partiesHelp':
    'Pick one or more to focus every page on them. The number is the group’s members; the bar compares its size with the largest.',
  'sidebar.votes': 'Votes',
  'sidebar.finalOnly': 'Final votes only',
  'sidebar.finalHelp': 'Hides procedural votes such as agenda approvals.',
  'sidebar.sourceBefore': 'Data from',
  'sidebar.sourceAfter': ', updated daily. Not an official publication.',

  'dash.title': 'Parties at a glance',
  'dash.lede':
    'One widget per parliamentary group: how united it votes, where it stood on recent votes and who it votes most like. The three largest are shown first; pick others in the sidebar.',
  'stat.partiesShown': 'Parties shown',
  'stat.ofN': 'of {n}',
  'stat.ofNSelected': 'of {n} selected',
  'stat.members': 'Members',
  'stat.membersDetail': 'in the parties shown',
  'stat.latestSitting': 'Latest sitting',
  'stat.recentVotes': 'Recent votes compared',
  'stat.finalOnly': 'final votes only',
  'stat.allVotes': 'all votes',
  'dash.showAll': 'Show all {n} parties',
  'dash.showThree': 'Show only the three largest',
  'dash.similarityTitle': 'Who votes with whom',
  'dash.similarityNote':
    'The percentage of votes{year} on which two groups took the same majority position. The more a cell stands out from the page, the more often the two voted alike. Hover a cell for the number of votes.',
  'dash.inYear': ' in {year}',

  'widget.members': '{n} members',
  'widget.cohesion': 'Cohesion',
  'widget.delta': '{delta} on the month before',
  'widget.notBloc': 'Unaffiliated members do not vote as a bloc, so cohesion is not shown.',
  'widget.recentPositions': 'Position on recent votes',
  'widget.mostLike': 'Votes most like',
  'widget.leastLike': 'Least like',
  'spark.label': '{party} cohesion by month',
  'spark.empty': 'Not enough data yet',
  'delta.unit': 'pts',

  'tally.for': 'for',
  'tally.against': 'against',
  'tally.abstained': 'abstained',
  'choice.for': 'For',
  'choice.against': 'Against',
  'choice.abstain': 'Abstained',
  'choice.not_voted': 'Did not vote',
  'result.carried': 'Carried',
  'result.notCarried': 'Not carried',

  'votes.title': 'Votes',
  'votes.lede':
    'Every electronic vote in the Chamber of Deputies and in joint sittings, newest first. Each chip shows how the majority of a group voted; pick groups in the sidebar to narrow them down.',
  'votes.footnote':
    '“Carried” means more votes for than against. The source does not publish the official outcome, which for some votes depends on a qualified majority.',
  'votes.none': 'No votes to show.',
  'pager.newer': '← Newer',
  'pager.older': 'Older →',
  'pager.page': 'Page {n}',
  'vote.final': 'Final vote',
  'vote.billPage': 'Bill page',
  'chamber.deputies': 'Chamber of Deputies',
  'chamber.senate': 'Senate',
  'chamber.joint': 'Joint sitting',
  'chip.voted': '{party}: {a} of {b} voted this way',
  'chip.none': '{party}: no votes cast',

  'heatmap.cell': '{a} and {b}: same position on {percent} of {n} votes',
  'heatmap.need': 'Select at least two parties with votes to compare them.',

  'party.back': '← All parties',
  'party.none': 'No such party.',
  'party.members': 'Members',
  'party.currentLegislature': 'current legislature',
  'party.deputiesSenators': 'Deputies / senators',
  'party.cohesionDetail': '{month}, {n} votes',
  'party.cohesionTitle': 'Cohesion over time',
  'party.cohesionNote':
    'Of the votes its members cast each month, the share that matched the group’s majority position.',
  'party.likeTitle': 'Votes most like',
  'party.likeNote':
    'The share of votes on which this group and another took the same majority position.',
  'party.likeRow': 'Same position on {percent} of {n} votes',
  'party.noCompare': 'No comparison data yet.',
  'party.recentTitle': 'Recent votes',
  'party.recentNote': 'The chip on each vote shows how the majority of this group voted.',
  'party.noMembers': 'No members in the current legislature.',
  'chart.cohesionValue': '{percent} over {n} votes',

  'role.deputies': 'Deputy',
  'role.senate': 'Senator',
  'members.title': 'Members',
  'members.lede':
    'Deputies and senators of the current legislature, by group. Senators appear here because they vote in joint sittings.',
  'members.all': 'All',
  'members.deputies': 'Deputies',
  'members.senators': 'Senators',
  'members.chamber': 'Chamber',

  'member.back': '← All members',
  'member.none': 'No such member.',
  'member.legislature': 'legislature {n}',
  'member.attendance': 'Attendance',
  'member.attendanceDetail': 'present at {a} of {b} votes',
  'member.againstGroup': 'Votes against own group',
  'member.againstDetail': '{percent} of {n} votes cast',
  'member.noVotesCast': 'no votes cast',
  'member.presentNoVote': 'Present without voting',
  'member.times': 'times',
  'member.footnote':
    'Counted from {from} to {to}. The source lists only members who were present, so absence is inferred from the votes held in that period.',
  'member.recentTitle': 'Recent ballots',
  'member.noBallots': 'No ballots recorded.',
  'member.ballot': 'Ballot',
  'member.groupPosition': 'Group position',
  'member.dissent': '⚠ Against own group',
}

const MESSAGES: Record<Lang, Record<MessageKey, string>> = { ro, en }
const INTL: Record<Lang, string> = { ro: 'ro-RO', en: 'en-GB' }

type Vars = Record<string, string | number>

/** Text and number formatting for one language. */
export interface Locale {
  lang: Lang
  setLang: (lang: Lang) => void
  /** Look up a message and fill in its {placeholders}. */
  t: (key: MessageKey, vars?: Vars) => string
  /** Format an ISO date ("2026-11-10") without shifting it across time zones. */
  date: (iso: string) => string
  month: (iso: string) => string
  percent: (share: number) => string
  /** A change between two shares, in percentage points: "+1.2 pts". */
  delta: (change: number) => string
  choice: (choice: Choice) => string
}

export function createLocale(lang: Lang, setLang: (lang: Lang) => void): Locale {
  const messages = MESSAGES[lang]
  const tag = INTL[lang]
  const dateFormat = new Intl.DateTimeFormat(tag, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const monthFormat = new Intl.DateTimeFormat(tag, { month: 'short', year: 'numeric', timeZone: 'UTC' })
  const percentFormat = new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 1 })
  const pointsFormat = new Intl.NumberFormat(tag, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })

  const t = (key: MessageKey, vars: Vars = {}) =>
    messages[key].replace(/\{(\w+)\}/g, (placeholder, name: string) =>
      name in vars ? String(vars[name]) : placeholder,
    )

  return {
    lang,
    setLang,
    t,
    date: (iso) => dateFormat.format(new Date(`${iso}T00:00:00Z`)),
    month: (iso) => monthFormat.format(new Date(`${iso}T00:00:00Z`)),
    percent: (share) => percentFormat.format(share),
    delta: (change) => {
      const points = change * 100
      const sign = points > 0 ? '+' : points < 0 ? '−' : '±'
      return `${sign}${pointsFormat.format(Math.abs(points))} ${messages['delta.unit']}`
    },
    choice: (choice) => messages[`choice.${choice}`],
  }
}

export const LocaleContext = createContext<Locale | null>(null)

export function useLocale(): Locale {
  const locale = useContext(LocaleContext)
  if (!locale) throw new Error('useLocale must be used inside <LanguageProvider>')
  return locale
}
