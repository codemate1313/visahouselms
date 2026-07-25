export interface LoginProps {
  allowedRoles?: string[];
  title?: string;
  subtitle?: string;
  disableAnimation?: boolean;
}

export interface RoleOption {
  role: string;
  label: string;
  basePath: string;
}
