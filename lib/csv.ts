import type { Day, Staff, StaffStatus } from './types'
import { nowISO, uid } from './utils'

/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, CRLF). */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') row.push(cell), (cell = '')
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell || row.length) row.push(cell), rows.push(row)
  return rows.filter((r) => r.some((x) => x.trim()))
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z]/g, '')

const HEADERS: Record<string, string[]> = {
  first_name: ['firstname', 'first', 'fname', 'givenname'],
  last_name: ['lastname', 'last', 'lname', 'surname', 'familyname'],
  full_name: ['name', 'fullname', 'contactname'],
  email: ['email', 'emailaddress'],
  phone: ['phone', 'mobile', 'cell', 'phonenumber', 'mobilephone', 'cellphone'],
  city: ['city', 'town'],
  status: ['status', 'hiringstatus', 'stage'],
  position: ['position', 'role', 'positiondesired', 'job', 'title'],
  location: ['location', 'site', 'applyingforlocation', 'park'],
  availability: ['availability', 'nights', 'daysavailable'],
  shirt_size: ['shirtsize', 'shirt', 'size'],
  pay_rate: ['payrate', 'rate', 'wage', 'hourlyrate'],
  emergency_name: ['emergencycontact', 'emergencyname'],
  emergency_phone: ['emergencyphone', 'emergencycontactphone'],
}

export function mapHeaders(header: string[]) {
  const out: Partial<Record<keyof typeof HEADERS, number>> = {}
  header.forEach((h, i) => {
    const n = norm(h)
    for (const [field, aliases] of Object.entries(HEADERS)) {
      if (out[field as keyof typeof HEADERS] === undefined && aliases.includes(n)) out[field as keyof typeof HEADERS] = i
    }
  })
  return out
}

const STATUS_WORDS: [RegExp, StaffStatus][] = [
  [/appl|new|lead/i, 'applied'],
  [/interv|audition/i, 'interview'],
  [/offer/i, 'offered'],
  [/active|hired|current|employ/i, 'active'],
  [/declin|reject|withdr/i, 'declined'],
  [/rehire|dnr|banned/i, 'dnr'],
  [/inactive|former|quit|term/i, 'inactive'],
]

export function rowsToStaff(
  rows: string[][],
  opts: { defaultLocation: string; defaultStatus: StaffStatus; locations: { id: string; name: string }[] },
): Staff[] {
  const [header, ...body] = rows
  const m = mapHeaders(header)
  const get = (r: string[], k: keyof typeof HEADERS) => (m[k] === undefined ? '' : (r[m[k]!] ?? '').trim())
  const now = nowISO()
  return body
    .map((r) => {
      let first = get(r, 'first_name')
      let last = get(r, 'last_name')
      if (!first && !last) {
        const parts = get(r, 'full_name').split(/\s+/)
        first = parts.shift() ?? ''
        last = parts.join(' ')
      }
      if (!first && !last) return null
      const statusText = get(r, 'status')
      const status = STATUS_WORDS.find(([re]) => re.test(statusText))?.[1] ?? opts.defaultStatus
      const locText = get(r, 'location').toLowerCase()
      const loc = opts.locations.find((l) => locText && locText.includes(l.name.toLowerCase()))?.id ?? opts.defaultLocation
      const avText = get(r, 'availability').toLowerCase()
      const availability = (['Thu', 'Fri', 'Sat', 'Sun'] as Day[]).filter((d) => avText.includes(d.toLowerCase()))
      const rate = Number(get(r, 'pay_rate').replace(/[^0-9.]/g, ''))
      const s: Staff = {
        id: uid(),
        location_id: loc,
        first_name: first,
        last_name: last,
        email: get(r, 'email').toLowerCase(),
        phone: get(r, 'phone'),
        city: get(r, 'city'),
        status,
        position: get(r, 'position') || 'Scare actor',
        group_id: null,
        attraction_id: null,
        is_minor: false,
        guardian_name: '',
        guardian_phone: '',
        emergency_name: get(r, 'emergency_name'),
        emergency_phone: get(r, 'emergency_phone'),
        availability: availability.length ? availability : ['Fri', 'Sat'],
        shirt_size: get(r, 'shirt_size').toUpperCase(),
        pay_rate: rate > 0 ? rate : null,
        seasons: 1,
        docs: [],
        application: null,
        source: 'CSV import',
        tags: [],
        hired_at: status === 'active' ? now : null,
        created_at: now,
        updated_at: now,
      }
      return s
    })
    .filter((s): s is Staff => !!s)
}
