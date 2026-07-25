export interface Branding {
  institute_id: number;
  institute_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  heading_font_weight: number;
  body_font_weight: number;
}

export const FONT_OPTIONS = ["Plus Jakarta Sans", "Inter", "Sora", "Outfit", "system-ui"];
export const FONT_WEIGHTS = [400, 500, 600, 700, 800];
