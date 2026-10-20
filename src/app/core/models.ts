export interface User {
  id: number;
  username: string;
  role: string;
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
}
export interface Attendance {
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
}
export interface Invoice {
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
  id: number;
  subject_id: number;
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
export interface Student extends StudentRow {
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
  enrollments: { subject_id: number; subject: string }[];
  terms: Term[];
  payments?: Payment[];
  balances?: { currency: string; debt_minor: number; credit_minor: number }[];
}
