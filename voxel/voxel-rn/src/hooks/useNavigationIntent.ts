const EN_TRIGGERS = [
  'take me to','navigate to','go to','directions to','how do i get to',
  'i want to go to','i need to go to','bring me to','head to',
  'route to','find route to','get me to','drive to','walk to',
]
const LG_TRIGGERS = [
  'nsomeze','genda','njigiriza','nsobola otya okugenda','nsobola ngenda',
  'nfuna ekkubo okutuuka','ngenda','nkolere ekkubo',
]
const UGANDA_PLACES = [
  'kampala','entebbe','jinja','mbale','gulu','mbarara','fort portal',
  'lira','arua','ntinda','kawempe','nakawa','mukono','wakiso',
  'mulago','makerere','kololo','naguru','bukoto','kamwokya',
  'bugolobi','kabalagala','namuwongo','katwe','nakasero',
]

export interface NavigationIntent {
  isNavigation: boolean
  destination:  string
  query:        string
  confidence:   number
}

function norm(t: string) {
  return t.toLowerCase().replace(/[.,!?'"]/g,'').replace(/\s+/g,' ').trim()
}
function fmt(raw: string) {
  return raw.split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ')
    .replace(/\b(Uganda|UG)\b/gi,'').trim()
}
function buildQuery(dest: string) {
  const d = dest.trim()
  return d.toLowerCase().includes('uganda') ? d : `${fmt(d)}, Uganda`
}

export function detectNavigationIntent(transcript: string): NavigationIntent {
  const text = norm(transcript)
  for (const t of EN_TRIGGERS) {
    if (text.includes(t)) {
      const after = text.split(t)[1]?.trim()
      if (after && after.length > 1)
        return { isNavigation:true, destination:fmt(after), query:buildQuery(after), confidence:0.95 }
    }
  }
  for (const t of LG_TRIGGERS) {
    if (text.includes(t)) {
      const after = text.split(t)[1]?.trim()
      if (after && after.length > 1)
        return { isNavigation:true, destination:fmt(after), query:buildQuery(after), confidence:0.9 }
    }
  }
  for (const p of UGANDA_PLACES) {
    if (text === p || text.startsWith(p) || text.endsWith(p))
      return { isNavigation:true, destination:fmt(p), query:buildQuery(p), confidence:0.75 }
  }
  return { isNavigation:false, destination:'', query:'', confidence:0 }
}
