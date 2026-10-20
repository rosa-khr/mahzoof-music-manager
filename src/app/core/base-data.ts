export const BASE_RESOURCES = [
  {
    key: "teaching-types",
    title: "نوع تدریس",
    singular: "نوع تدریس",
    icon: "class",
    nameLabel: "عنوان نوع تدریس",
    phone: false,
  },
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
] as const;
export type BaseResource = (typeof BASE_RESOURCES)[number];
export interface BaseRecord {
  id: number;
  name: string;
  notes: string;
  status: string;
  version: number;
  phone?: string;
  english_name?: string;
}
