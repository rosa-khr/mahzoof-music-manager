export interface User {
  id: number;
  username: string;
  role: string;
  roleName?: string;
  permissions?: string[];
  education: boolean;
  finance: boolean;
  admin: boolean;
}
export interface Subject {
  id: number;
  name: string;
}
export interface StudentRow {
  photo_url?: string | null;
  id: number;
  code: string;
  first_name: string;
  last_name: string;
  phone: string;
  status: string;
  version: number;
}
export interface Attendance {
  group_members?: {
    id: number;
    version: number;
    status: string;
    first_name: string;
    last_name: string;
  }[];
  workflow_version?: number;
  id: number;
  session_id: number;
  status: string;
  counts: number;
  reason: string;
  cancelled_by: string;
  version: number;
  starts_at: string;
  timezone: string;
  duration_minutes: number | null;
  replacement_for: number | null;
  requested_by?: string;
  justified?: number | null;
}
export interface Invoice {
  settlement_flow?: string;
  id: number;
  currency: string;
  base_minor: number;
  discount_minor: number;
  reason: string;
  due_date: string | null;
  total_minor: number;
  allocated_minor: number;
  balance_minor: number;
  financial_status: string;
  overdue: boolean;
  payment_method_id?: number;
  payment_method_name?: string;
  settlement_type?: string;
  installments?: Installment[];
}
export interface Installment {
  id: number;
  number: number;
  amount_minor: number;
  allocated_minor: number;
  balance_minor: number;
  due_date: string;
  financial_status: string;
  overdue: boolean;
}
export interface Counts {
  quota: number;
  present: number;
  absent: number;
  cancelled: number;
  reserved: number;
  consumed: number;
  remaining: number;
  schedulable: number;
}
export interface Term {
  version?: number;
  workflow_version?: number;
  structure?: string;
  id: number;
  subject_id: number;
  instrument_id?: number;
  instructor_id?: number;
  teaching_type_id?: number;
  academy_id?: number;
  teacher?: string;
  teaching_type?: string;
  subject: string;
  number: number;
  quota: number;
  status: string;
  renewed_from: number | null;
  mode: string;
  location: string;
  course_format: string;
  duration_minutes: number | null;
  registered_on: string;
  start_date: string | null;
  end_date: string | null;
  invoice?: Invoice;
  counters?: Counts;
  sessions?: Attendance[];
  schedules?: WeeklySchedule[];
  discount_type?: "legacy" | "none" | "percent" | "fixed";
  discount_value?: number;
  base_rate_minor_30?: number | null;
  currency_snapshot?: string | null;
  policy_id?: number | null;
}
export interface Payment {
  id: number;
  currency: string;
  amount_minor: number;
  credit_minor: number;
  received_on: string;
  method: string;
  status: string;
}
export interface WeeklySchedule {
  id?: number;
  weekday: number;
  start_time: string;
  duration_minutes: number;
  timezone: string;
}
export interface Student extends StudentRow {
  contact_owner?: "student" | "parent" | "other";
  birth_date?: string | null;
  gender?: string;
  national_id?: string;
  landline?: string;
  country?: string;
  city?: string;
  education_level?: string;
  artistic_history?: string;
  referral_source?: string;
  registration_goal?: string;
  interview_notes?: string;
  internal_notes?: string;
  audience_group?: string;
  education_preferences?: {
    instrument_id: number;
    instructor_id: number;
    teaching_type_id: number;
    academy_id: number | null;
    mode: string;
    payment_method_id: number;
  } | null;
  created_at?: string;
  address?: string;
  age?: number | null;
  version: number;
  possible_duplicates: StudentRow[];
  english_first: string;
  english_last: string;
  timezone: string;
  history: string;
  missing_contact_reason: string;
  first_registered: string | null;
  guardians: {
    id: number;
    name: string;
    phone: string;
    relationship: string;
  }[];
  enrollments: {
    id: number;
    subject_id: number | null;
    instrument_id?: number;
    subject: string;
    settings?: Record<string, unknown> | null;
    schedules?: WeeklySchedule[];
  }[];
  terms: Term[];
  payments?: Payment[];
  balances?: { currency: string; debt_minor: number; credit_minor: number }[];
}
