'use client'

import { useMemo } from 'react'
import { useStore } from './store'
import { DOCS, type Attendance, type DB, type Doc, type Night, type Staff } from './types'
import { hoursBetween, todayKey } from './utils'

const index = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]))

/** Id → row maps for the tables pages cross-reference constantly. */
export function useLookups() {
  const { db } = useStore()
  return useMemo(
    () => ({
      staff: index(db.staff),
      locations: index(db.locations),
      attractions: index(db.attractions),
      groups: index(db.groups),
      nights: index(db.nights),
      costumes: index(db.costumes),
      attendanceByKey: new Map(db.attendance.map((a) => [`${a.night_id}:${a.staff_id}`, a])),
    }),
    [db],
  )
}

export const sortedLocations = (db: DB) => [...db.locations].sort((a, b) => a.sort - b.sort)
export const sortedGroups = (db: DB) => [...db.groups].sort((a, b) => a.sort - b.sort)
export const attractionsFor = (db: DB, locationId: string | 'all') =>
  db.attractions
    .filter((a) => locationId === 'all' || a.location_id === locationId)
    .sort((a, b) => a.location_id.localeCompare(b.location_id) || a.sort - b.sort)

/** The night check-in should open on: today's, else the next upcoming, else the most recent. */
export function defaultNight(nights: Night[]): Night | undefined {
  const live = nights.filter((n) => n.status !== 'cancelled').sort((a, b) => a.date.localeCompare(b.date))
  const today = todayKey()
  return live.find((n) => n.date === today) ?? live.find((n) => n.date > today) ?? live[live.length - 1]
}

export interface StaffStats {
  scheduled: number
  worked: number
  hours: number
  late: number
  calledIn: number
  noShow: number
  showRate: number | null
}

export function statsFor(attendance: Attendance[], scheduledCount: number): StaffStats {
  let worked = 0,
    hours = 0,
    late = 0,
    calledIn = 0,
    noShow = 0
  for (const a of attendance) {
    if (a.status === 'in' || a.status === 'out' || a.status === 'sent_home') {
      worked++
      hours += hoursBetween(a.check_in, a.check_out)
      if (a.late) late++
    } else if (a.status === 'called_in') calledIn++
    else if (a.status === 'no_show') noShow++
  }
  const decided = worked + calledIn + noShow
  return { scheduled: scheduledCount, worked, hours, late, calledIn, noShow, showRate: decided ? worked / decided : null }
}

export const isApplicant = (s: Staff) => s.status === 'applied' || s.status === 'interview' || s.status === 'offered'

export const requiredDocs = (s: Staff): Doc[] => DOCS.filter((d) => d !== 'Parent consent' || s.is_minor)
