// Demo data so the app is explorable before any real data exists.
// Everything here is made up (example.com emails, 555-01xx phone numbers).
// Settings → Data has buttons to clear it when you're ready to go live.

import type {
  Attendance,
  Attraction,
  Costume,
  CostumeStatus,
  DB,
  Day,
  Doc,
  Group,
  Location,
  Message,
  Night,
  Note,
  Shift,
  Staff,
  StaffStatus,
} from './types'
import { addDays, atTime, nowISO, todayKey, uid, weekdayOf } from './utils'

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FIRST = [
  'Ava', 'Liam', 'Mia', 'Noah', 'Harper', 'Elijah', 'Emma', 'Mason', 'Ella', 'Logan', 'Avery', 'Wyatt', 'Scarlett',
  'Hunter', 'Chloe', 'Caleb', 'Lily', 'Owen', 'Zoey', 'Gavin', 'Nora', 'Colton', 'Riley', 'Jace', 'Hazel', 'Brody',
  'Aubrey', 'Tyler', 'Paisley', 'Cody', 'Brooklyn', 'Dakota', 'Kinsley', 'Ryder', 'Madison', 'Austin', 'Raven',
  'Damien', 'Willow', 'Jaxon', 'Morgan', 'Trevor', 'Skylar', 'Dylan', 'Kayla', 'Blake', 'Sierra', 'Garrett', 'Luna',
  'Tanner', 'Ivy', 'Bryce', 'Jade', 'Cole', 'Ember', 'Travis', 'Piper', 'Shane', 'Autumn', 'Derek',
]
const LAST = [
  'Miller', 'Davis', 'Wilson', 'Anderson', 'Thomas', 'Moore', 'Martin', 'Jackson', 'Thompson', 'White', 'Harris',
  'Clark', 'Lewis', 'Walker', 'Hall', 'Allen', 'Young', 'King', 'Wright', 'Hill', 'Scott', 'Green', 'Baker', 'Adams',
  'Nelson', 'Carter', 'Mitchell', 'Roberts', 'Turner', 'Phillips', 'Campbell', 'Parker', 'Evans', 'Edwards', 'Collins',
  'Stewart', 'Morris', 'Rogers', 'Reed', 'Cook', 'Bell', 'Murphy', 'Bailey', 'Cooper', 'Howard', 'Ward', 'Cox',
  'Peterson', 'Gray', 'James', 'Watson', 'Brooks', 'Kelly', 'Price', 'Bennett', 'Wood', 'Barnes', 'Ross', 'Henderson',
  'Coleman',
]
const CITIES_BR = ['Branson', 'Hollister', 'Forsyth', 'Kimberling City', 'Ozark', 'Reeds Spring', 'Branson West']
const CITIES_NX = ['Nixa', 'Ozark', 'Springfield', 'Republic', 'Clever', 'Sparta', 'Billings']

const SEASON_2026 = { start: '2026-09-25', end: '2026-11-01' }
const SEASON_2027 = { start: '2027-09-24', end: '2027-10-31' }

export function buildSeed(): DB {
  const r = rng(1031)
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(r() * arr.length)]
  const chance = (p: number) => r() < p
  const between = (a: number, b: number) => a + Math.floor(r() * (b - a + 1))
  const created = nowISO()

  // ── Setup ────────────────────────────────────────────────────────────
  const locations: Location[] = [
    { id: 'loc-branson', name: 'Branson', full_name: 'Field of Screams Branson', city: 'Branson, MO', color: '#2fe05a', sort: 1 },
    { id: 'loc-nixa', name: 'Nixa', full_name: 'Field of Screams Nixa', city: 'Nixa, MO', color: '#00c4cc', sort: 2 },
  ]

  const attractions: Attraction[] = [
    { id: 'att-carnival', location_id: 'loc-branson', name: 'Carnival of Chaos', color: '#f43f5e', target: 18, sort: 1 },
    { id: 'att-9th', location_id: 'loc-branson', name: '9th Inning Nightmare', color: '#22c55e', target: 16, sort: 2 },
    { id: 'att-forest', location_id: 'loc-nixa', name: 'Haunted Forest', color: '#16a34a', target: 18, sort: 1 },
    { id: 'att-coulro', location_id: 'loc-nixa', name: 'Coulrophobia', color: '#ff6a00', target: 16, sort: 2 },
  ]

  const groups: Group[] = [
    { id: 'grp-actors', name: 'Scare Actors', color: '#ff5a1f', sort: 1 },
    { id: 'grp-leads', name: 'Scene Leads', color: '#f59e0b', sort: 2 },
    { id: 'grp-makeup', name: 'Makeup & FX', color: '#a855f7', sort: 3 },
    { id: 'grp-wardrobe', name: 'Wardrobe', color: '#ec4899', sort: 4 },
    { id: 'grp-admissions', name: 'Admissions', color: '#38bdf8', sort: 5 },
    { id: 'grp-concessions', name: 'Concessions', color: '#facc15', sort: 6 },
    { id: 'grp-parking', name: 'Parking', color: '#94a3b8', sort: 7 },
    { id: 'grp-security', name: 'Security', color: '#ef4444', sort: 8 },
    { id: 'grp-build', name: 'Build Crew', color: '#84cc16', sort: 9 },
  ]

  const POSITION: Record<string, string> = {
    'grp-actors': 'Scare actor',
    'grp-leads': 'Scene lead',
    'grp-makeup': 'Makeup artist',
    'grp-wardrobe': 'Wardrobe',
    'grp-admissions': 'Box office',
    'grp-concessions': 'Concessions',
    'grp-parking': 'Parking attendant',
    'grp-security': 'Security',
    'grp-build': 'Build crew',
  }
  const PAY: Record<string, number> = { 'grp-leads': 17.5, 'grp-makeup': 16.5, 'grp-security': 17 }

  // ── Staff ────────────────────────────────────────────────────────────
  const staff: Staff[] = []
  const used = new Set<string>()
  let phoneN = 0

  const plan: { group: string; status: StaffStatus; n: number }[] = [
    { group: 'grp-actors', status: 'active', n: 30 },
    { group: 'grp-leads', status: 'active', n: 4 },
    { group: 'grp-makeup', status: 'active', n: 4 },
    { group: 'grp-wardrobe', status: 'active', n: 2 },
    { group: 'grp-admissions', status: 'active', n: 3 },
    { group: 'grp-concessions', status: 'active', n: 2 },
    { group: 'grp-parking', status: 'active', n: 2 },
    { group: 'grp-security', status: 'active', n: 2 },
    { group: 'grp-build', status: 'active', n: 2 },
    { group: 'grp-actors', status: 'applied', n: 6 },
    { group: 'grp-makeup', status: 'applied', n: 1 },
    { group: 'grp-admissions', status: 'applied', n: 1 },
    { group: 'grp-actors', status: 'interview', n: 3 },
    { group: 'grp-security', status: 'interview', n: 1 },
    { group: 'grp-actors', status: 'offered', n: 3 },
    { group: 'grp-actors', status: 'inactive', n: 4 },
    { group: 'grp-actors', status: 'declined', n: 2 },
  ]

  const ABOUT = [
    'I love scaring people and have done community theater for three years.',
    'Huge horror fan. I can do a mean crawl and I am not afraid to get dirty.',
    'Worked haunt season at another attraction last year and want to come to FoS.',
    'I am a cosmetology student and want to do special FX makeup.',
    'Looking for something fun on weekends. My friends work here and love it.',
    'Former high school drama club. Very loud. Very creepy.',
  ]

  for (const loc of locations) {
    const atts = attractions.filter((a) => a.location_id === loc.id)
    const cities = loc.id === 'loc-branson' ? CITIES_BR : CITIES_NX
    let attIdx = 0
    for (const p of plan) {
      for (let i = 0; i < p.n; i++) {
        let first = '',
          last = ''
        do {
          first = pick(FIRST)
          last = pick(LAST)
        } while (used.has(first + last))
        used.add(first + last)

        const minor = chance(0.16)
        const isApplicant = ['applied', 'interview', 'offered', 'declined'].includes(p.status)
        const onTrail = p.group === 'grp-actors' || p.group === 'grp-leads'
        const availability: Day[] = (['Thu', 'Fri', 'Sat', 'Sun'] as Day[]).filter((d) =>
          d === 'Fri' || d === 'Sat' ? chance(0.9) : chance(0.45),
        )
        if (!availability.length) availability.push('Sat')
        const seasons = isApplicant ? (chance(0.2) ? 2 : 1) : between(1, 6)
        const docs: Doc[] = []
        if (p.status === 'active' || p.status === 'inactive') {
          for (const d of ['W-4', 'I-9', 'Waiver', 'Handbook', 'Background check'] as Doc[]) if (chance(0.92)) docs.push(d)
          if (minor && chance(0.85)) docs.push('Parent consent')
        }
        const appliedDaysAgo = between(1, 26)
        const createdAt = isApplicant
          ? new Date(Date.now() - appliedDaysAgo * 86400000 - between(0, 80000) * 1000).toISOString()
          : `2026-0${between(7, 9)}-${String(between(1, 28)).padStart(2, '0')}T15:00:00.000Z`
        const city = pick(cities)
        const phone = `417-555-01${String(phoneN++ % 100).padStart(2, '0')}`

        staff.push({
          id: uid(),
          location_id: loc.id,
          first_name: first,
          last_name: last,
          email: `${first}.${last}@example.com`.toLowerCase(),
          phone,
          city,
          status: p.status,
          position: POSITION[p.group],
          group_id: p.group,
          attraction_id: onTrail ? atts[attIdx++ % atts.length].id : null,
          is_minor: minor,
          guardian_name: minor ? `${pick(FIRST)} ${last}` : '',
          guardian_phone: minor ? `417-555-01${String(phoneN++ % 100).padStart(2, '0')}` : '',
          emergency_name: isApplicant ? '' : `${pick(FIRST)} ${last}`,
          emergency_phone: isApplicant ? '' : `417-555-01${String(phoneN++ % 100).padStart(2, '0')}`,
          availability,
          shirt_size: pick(['S', 'M', 'M', 'L', 'L', 'XL', '2XL']),
          pay_rate: isApplicant ? null : PAY[p.group] ?? 15,
          seasons,
          docs,
          application: isApplicant
            ? {
                'Position desired': POSITION[p.group],
                'Age bracket': minor ? 'Under 18' : 'Over 18',
                "Driver's license": chance(0.7) ? 'Yes' : 'No',
                'Background check consent': 'Yes',
                'Legally eligible to work in US': 'Yes',
                'Prior haunt experience': seasons > 1 ? 'Worked here last season' : pick(['None', 'Community theater', 'Another haunt in Springfield', 'School haunted house']),
                'Worked at Field of Screams before': seasons > 1 ? 'Yes' : 'No',
                'About you': pick(ABOUT),
              }
            : null,
          source: isApplicant ? pick(['Website', 'Website', 'Website', 'Referral', 'Job fair']) : 'Returning cast',
          tags: [
            ...(seasons >= 4 ? ['Veteran'] : []),
            ...(onTrail && chance(0.15) ? ['Slider'] : []),
            ...(onTrail && chance(0.1) ? ['Stilts'] : []),
          ],
          hired_at: p.status === 'active' ? createdAt : null,
          created_at: createdAt,
          updated_at: createdAt,
        })
      }
    }
  }
  // One do-not-rehire record so the status shows up in filters.
  staff.find((s) => s.status === 'inactive')!.status = 'dnr'

  // ── Nights ───────────────────────────────────────────────────────────
  const nights: Night[] = []
  const mkNight = (location_id: string, date: string, extra: Partial<Night> = {}): Night => ({
    id: uid(),
    location_id,
    date,
    kind: 'show',
    label: '',
    call_time: '18:00',
    open_time: '19:30',
    close_time: '23:30',
    status: 'scheduled',
    notes: '',
    created_at: created,
    ...extra,
  })

  for (const loc of locations) {
    nights.push(mkNight(loc.id, '2026-09-19', { kind: 'training', label: 'Cast training & scare school', call_time: '10:00', open_time: '10:00', close_time: '15:00' }))
    for (let d = SEASON_2026.start; d <= SEASON_2026.end; d = addDays(d, 1)) {
      const w = weekdayOf(d)
      const late = d >= '2026-10-15'
      if (w === 'Fri' || w === 'Sat' || (late && (w === 'Thu' || w === 'Sun'))) {
        nights.push(
          mkNight(loc.id, d, {
            label: d === '2026-10-31' ? 'Halloween' : d === '2026-11-01' ? 'Lights Out (final night)' : '',
            close_time: w === 'Fri' || w === 'Sat' ? '00:00' : '22:30',
          }),
        )
      }
    }
    for (let d = SEASON_2027.start; d <= SEASON_2027.end; d = addDays(d, 1)) {
      const w = weekdayOf(d)
      if (w === 'Fri' || w === 'Sat') nights.push(mkNight(loc.id, d, { close_time: '00:00', label: d === SEASON_2027.start ? 'Opening night 2027' : '' }))
    }
  }
  // A practice night today at Branson so Check-in has something live to try.
  const today = todayKey()
  const demoNight = mkNight('loc-branson', today, { kind: 'rehearsal', label: 'Practice night (demo)', call_time: '18:00', open_time: '18:30', close_time: '22:00' })
  nights.push(demoNight)

  // ── Shifts + attendance for the past season ──────────────────────────
  const shifts: Shift[] = []
  const attendance: Attendance[] = []
  const pastNights = nights.filter((n) => n.date < today)
  for (const n of pastNights) {
    const w = weekdayOf(n.date)
    const pool = staff.filter(
      (s) => s.location_id === n.location_id && (s.status === 'active' || s.status === 'inactive' || s.status === 'dnr'),
    )
    for (const s of pool) {
      const avail = n.kind !== 'show' || s.availability.includes(w as Day)
      if (!avail || !chance(n.kind === 'show' ? 0.86 : 0.7)) continue
      shifts.push({ id: uid(), night_id: n.id, staff_id: s.id, attraction_id: s.attraction_id, status: 'confirmed', created_at: created })
      const roll = r()
      const base = { id: uid(), night_id: n.id, staff_id: s.id, location_id: n.location_id, note: '', created_at: created }
      if (roll < 0.045) attendance.push({ ...base, status: 'called_in', check_in: null, check_out: null, late: false, note: pick(['Sick', 'Car trouble', 'Family emergency', 'Work conflict']) })
      else if (roll < 0.065) attendance.push({ ...base, status: 'no_show', check_in: null, check_out: null, late: false })
      else {
        const offset = between(-20, 14)
        const sentHome = chance(0.015)
        attendance.push({
          ...base,
          status: sentHome ? 'sent_home' : 'out',
          check_in: atTime(n.date, n.call_time, offset),
          check_out: sentHome ? atTime(n.date, n.open_time, 90) : atTime(n.date, n.close_time, between(5, 40)),
          late: offset > 5,
          note: sentHome ? 'Sent home sick' : '',
        })
      }
    }
  }
  // Tonight's practice roster: scheduled, a couple of call-ins, nobody checked in yet.
  const tonightCrew = staff.filter((s) => s.location_id === 'loc-branson' && s.status === 'active').slice(0, 22)
  tonightCrew.forEach((s, i) => {
    shifts.push({ id: uid(), night_id: demoNight.id, staff_id: s.id, attraction_id: s.attraction_id, status: 'scheduled', created_at: created })
    if (i === 3 || i === 11)
      attendance.push({ id: uid(), night_id: demoNight.id, staff_id: s.id, location_id: 'loc-branson', status: 'called_in', check_in: null, check_out: null, late: false, note: 'Texted manager — sick', created_at: created })
  })

  // ── Costumes ─────────────────────────────────────────────────────────
  const COSTUMES: Record<string, [string, string][]> = {
    'att-carnival': [['Ringmaster coat', 'Coat'], ['Tattered clown jumpsuit', 'Jumpsuit'], ['Strongman singlet', 'Bodysuit'], ['Fortune teller robes', 'Robe'], ['Bearded lady dress', 'Dress'], ['Carnie vest & apron', 'Vest'], ['Jester mask & tunic', 'Mask'], ['Stilt walker pants', 'Pants']],
    'att-9th': [['Zombie umpire', 'Uniform'], ['Bloody home uniform', 'Uniform'], ['Rotting mascot suit', 'Full suit'], ['Groundskeeper coveralls', 'Coveralls'], ['Ghost batter', 'Uniform'], ['Catcher with cage mask', 'Mask'], ['Concession vendor ghoul', 'Vest']],
    'att-forest': [['Ghillie suit', 'Full suit'], ['Forest wraith', 'Robe'], ['Scarecrow', 'Full suit'], ['Hunter (bloody flannel)', 'Shirt'], ['Witch robe', 'Robe'], ['Plague doctor', 'Mask'], ['Lumberjack butcher', 'Apron']],
    'att-coulro': [['Evil clown — red', 'Jumpsuit'], ['Evil clown — black & white', 'Jumpsuit'], ['Twisted mime', 'Bodysuit'], ['Balloon clown', 'Jumpsuit'], ['Clown nurse', 'Dress'], ['Big top barker', 'Coat'], ['Creepy doll', 'Dress']],
  }
  const costumes: Costume[] = []
  for (const a of attractions) {
    const prefix = `${a.location_id === 'loc-branson' ? 'BR' : 'NX'}-${a.name.replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'X'}`
    const actors = staff.filter((s) => s.attraction_id === a.id && s.status === 'active')
    let k = 1
    for (const [name, category] of COSTUMES[a.id]) {
      const copies = between(1, 4)
      for (let c = 0; c < copies; c++) {
        const roll = r()
        const status: CostumeStatus = roll < 0.66 ? 'ready' : roll < 0.78 ? 'cleaning' : roll < 0.9 ? 'repair' : roll < 0.95 ? 'retired' : 'in_use'
        const owner = status !== 'retired' && chance(0.55) ? actors[(k * 7) % Math.max(actors.length, 1)] : undefined
        costumes.push({
          id: uid(),
          location_id: a.location_id,
          code: `${prefix}-${String(k++).padStart(2, '0')}`,
          name,
          category,
          size: pick(['S', 'M', 'L', 'XL', 'One size']),
          status,
          attraction_id: a.id,
          staff_id: owner?.id ?? null,
          notes: status === 'repair' ? pick(['Zipper broken', 'Torn sleeve', 'Mask strap snapped', 'Needs re-distressing']) : '',
          created_at: created,
          updated_at: created,
        })
      }
    }
  }
  for (let i = 0; i < 6; i++) {
    costumes.push({
      id: uid(),
      location_id: i % 2 ? 'loc-nixa' : 'loc-branson',
      code: `${i % 2 ? 'NX' : 'BR'}-SPR-${String(i + 1).padStart(2, '0')}`,
      name: pick(['Black hooded robe', 'Generic zombie rags', 'Blank latex mask', 'Black ninja suit']),
      category: 'Spare',
      size: 'One size',
      status: 'ready',
      attraction_id: null,
      staff_id: null,
      notes: 'Spare / walk-in stock',
      created_at: created,
      updated_at: created,
    })
  }

  // ── Messages & notes ─────────────────────────────────────────────────
  const activeIds = (loc?: string) => staff.filter((s) => s.status === 'active' && (!loc || s.location_id === loc)).map((s) => s.id)
  const messages: Message[] = [
    {
      id: uid(), location_id: null, channel: 'both', subject: 'Welcome to the 2026 season!',
      body: 'Hey {first_name}! Welcome to the 2026 Field of Screams cast. Training is Sat 9/19 at 10 AM — wear closed-toe shoes and bring water.',
      recipient_ids: activeIds(), audience: 'All active cast & crew — both locations', sent_by: 'Demo', result: 'simulated',
      stats: { sms: activeIds().length, email: activeIds().length, failed: 0 }, created_at: '2026-09-12T18:00:00.000Z',
    },
    {
      id: uid(), location_id: 'loc-nixa', channel: 'sms', subject: '',
      body: 'Weather update: we are OPEN tonight. Call time stays 6:00 PM. Bring a poncho!',
      recipient_ids: activeIds('loc-nixa'), audience: 'Nixa — all active', sent_by: 'Demo', result: 'simulated',
      stats: { sms: activeIds('loc-nixa').length, email: 0, failed: 0 }, created_at: '2026-10-16T20:15:00.000Z',
    },
    {
      id: uid(), location_id: null, channel: 'both', subject: 'Thank you — season wrap party',
      body: 'That is a wrap on 2026, {first_name}! Thank you for an amazing season. Wrap party is Sat 11/7 at 6 PM.',
      recipient_ids: activeIds(), audience: 'All active cast & crew — both locations', sent_by: 'Demo', result: 'simulated',
      stats: { sms: activeIds().length, email: activeIds().length, failed: 0 }, created_at: '2026-11-02T17:00:00.000Z',
    },
  ]

  const notes: Note[] = []
  const actives = staff.filter((s) => s.status === 'active')
  for (let i = 0; i < 14; i++) {
    const s = actives[(i * 11) % actives.length]
    const kind = pick(['note', 'praise', 'praise', 'writeup'] as const)
    notes.push({
      id: uid(),
      staff_id: s.id,
      kind,
      body:
        kind === 'praise'
          ? pick(['Guests screamed the whole way through their scene. Great energy.', 'Covered two scenes on Halloween when we were short.', 'Helped train the new actors in scare school.'])
          : kind === 'writeup'
            ? pick(['Touched a guest — reminded of no-contact rule.', 'Phone out in scene twice.', 'Left post without telling scene lead.'])
            : pick(['Wants to try stilts next season.', 'Prefers the Coulrophobia clown room.', 'Can come in early for makeup on Saturdays.']),
      author: 'Demo',
      created_at: `2026-10-${String(between(2, 31)).padStart(2, '0')}T23:00:00.000Z`,
    })
  }

  return { locations, attractions, groups, staff, costumes, nights, shifts, attendance, messages, notes }
}
