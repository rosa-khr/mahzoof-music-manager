export const BASE_RESOURCES = [
  {
    key: "instructors",
    title: "مدرسین",
    singular: "مدرس",
    icon: "users",
    nameLabel: "نام و نام خانوادگی مدرس",
    phone: true,
  },
  {
    key: "instruments",
    title: "سازها",
    singular: "ساز",
    icon: "music",
    nameLabel: "نام ساز",
    phone: false,
  },
  {
    key: "teaching-types",
    title: "شیوه برگزاری",
    singular: "شیوه برگزاری",
    icon: "class",
    nameLabel: "عنوان شیوه برگزاری",
    phone: false,
  },
  {
    key: "session-statuses",
    title: "وضعیت جلسات ترم",
    singular: "وضعیت جلسه",
    icon: "check",
    nameLabel: "عنوان وضعیت",
    phone: false,
  },
  {
    key: "payment-methods",
    title: "شیوه‌های پرداخت",
    singular: "شیوه پرداخت",
    icon: "wallet",
    nameLabel: "عنوان شیوه پرداخت",
    phone: false,
  },
] as const;
export type BaseResource = (typeof BASE_RESOURCES)[number];
export interface BaseRecord {
  requires_academy?: number | null;
  code?: string;
  id: number;
  name: string;
  notes: string;
  status: string;
  version: number;
  phone?: string;
  english_name?: string;
  first_name?: string;
  last_name?: string;
  instrument_ids?: number[];
  instrument_names?: string;
  photo_url?: string | null;
  created_at: string;
  settlement_type?: "single" | "installment" | "free";
  payment_currency?: "rial" | "foreign" | null;
  installment_count?: number | null;
  rate_toman_30?: number | null;
  rate_usd_cents_30?: number | null;
}
