export interface Staff {
  id: number;
  username: string;
  role: string;
  role_name?: string;
  active: number;
  version: number;
}
export const STAFF_ROLES: Record<string, string> = {
  admin: "مدیر",
  secretary: "منشی",
  accountant: "حسابدار",
};
