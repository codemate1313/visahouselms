export interface SuperAdminAccount {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  force_password_reset: boolean;
  created_at: string;
}
