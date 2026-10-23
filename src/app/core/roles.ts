export interface RoleRecord {
  id: number;
  code: string;
  name: string;
  permissions: string[];
  is_admin: number;
  active: number;
  version: number;
  user_count?: number;
}
