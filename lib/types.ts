// Core data model for the FoS Productions App.
// Every table lives in the same shape in demo mode (browser storage) and in
// Supabase (see supabase/schema.sql), so pages never care which one is active.

export type ID = string

export interface Location {
  id: ID
  name: string // "Branson"
  full_name: string // "Field of Screams Branson"
  city: string
  color: string // brand accent for chips and calendar
  sort: number
}

export interface Attraction {
  id: ID
  location_id: ID
  name: string
  color: string
  target: number // actors wanted per night
  sort: number
}

export interface Group {
  id: ID
  name: string
  color: string
  sort: number
}

export const STAFF_STATUSES = [
  'applied',
  'interview',
  'offered',
  'active',
  'inactive',
  'declined',
  'dnr',
] as const
export type StaffStatus = (typeof STAFF_STATUSES)[number]

export const DAYS = ['Thu', 'Fri', 'Sat', 'Sun'] as const
export type Day = (typeof DAYS)[number]

export const DOCS = ['W-4', 'I-9', 'Waiver', 'Handbook', 'Background check', 'Parent consent'] as const
export type Doc = (typeof DOCS)[number]

export interface Staff {
  id: ID
  location_id: ID
  first_name: string
  last_name: string
  email: string
  phone: string
  city: string
  status: StaffStatus
  position: string
  group_id: ID | null
  attraction_id: ID | null
  is_minor: boolean
  guardian_name: string
  guardian_phone: string
  emergency_name: string
  emergency_phone: string
  availability: Day[]
  shirt_size: string
  pay_rate: number | null
  seasons: number // seasons worked at FoS, including this one
  docs: Doc[] // paperwork completed
  application: Record<string, string> | null // raw answers from the apply form
  source: string
  tags: string[]
  hired_at: string | null
  created_at: string
  updated_at: string
}

export const COSTUME_STATUSES = ['ready', 'in_use', 'cleaning', 'repair', 'retired'] as const
export type CostumeStatus = (typeof COSTUME_STATUSES)[number]

export interface Costume {
  id: ID
  location_id: ID
  code: string
  name: string
  category: string
  size: string
  status: CostumeStatus
  attraction_id: ID | null
  staff_id: ID | null
  notes: string
  created_at: string
  updated_at: string
}

export const NIGHT_KINDS = ['show', 'rehearsal', 'training', 'build', 'event'] as const
export type NightKind = (typeof NIGHT_KINDS)[number]

export interface Night {
  id: ID
  location_id: ID
  date: string // YYYY-MM-DD
  kind: NightKind
  label: string
  call_time: string // HH:MM
  open_time: string
  close_time: string
  status: 'scheduled' | 'cancelled'
  notes: string
  created_at: string
}

export interface Shift {
  id: ID
  night_id: ID
  staff_id: ID
  attraction_id: ID | null
  status: 'scheduled' | 'confirmed' | 'declined'
  created_at: string
}

export const ATTENDANCE_STATUSES = ['in', 'out', 'called_in', 'no_show', 'sent_home'] as const
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]

export interface Attendance {
  id: ID
  night_id: ID
  staff_id: ID
  location_id: ID
  status: AttendanceStatus
  check_in: string | null // ISO
  check_out: string | null // ISO
  late: boolean
  note: string
  created_at: string
}

export interface Message {
  id: ID
  location_id: ID | null
  channel: 'sms' | 'email' | 'both'
  subject: string
  body: string
  recipient_ids: ID[]
  audience: string
  sent_by: string
  result: 'sent' | 'simulated' | 'partial' | 'failed'
  stats: { sms: number; email: number; failed: number }
  created_at: string
}

export interface Note {
  id: ID
  staff_id: ID
  kind: 'note' | 'praise' | 'writeup' | 'status'
  body: string
  author: string
  created_at: string
}

export interface DB {
  locations: Location[]
  attractions: Attraction[]
  groups: Group[]
  staff: Staff[]
  costumes: Costume[]
  nights: Night[]
  shifts: Shift[]
  attendance: Attendance[]
  messages: Message[]
  notes: Note[]
}

export type TableName = keyof DB
export type Row<T extends TableName> = DB[T][number]

export const TABLES: TableName[] = [
  'locations',
  'attractions',
  'groups',
  'staff',
  'costumes',
  'nights',
  'shifts',
  'attendance',
  'messages',
  'notes',
]

export const emptyDB = (): DB => ({
  locations: [],
  attractions: [],
  groups: [],
  staff: [],
  costumes: [],
  nights: [],
  shifts: [],
  attendance: [],
  messages: [],
  notes: [],
})
