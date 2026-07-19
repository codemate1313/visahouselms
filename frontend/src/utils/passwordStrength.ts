export interface PasswordRule {
  label: string;
  met: boolean;
}

export interface PasswordStrength {
  score: number; // 0-4
  label: "Too weak" | "Weak" | "Fair" | "Good" | "Strong";
  rules: PasswordRule[];
  allMet: boolean;
}

// Mirrors backend/app/core/password_policy.py - keep the two in sync.
export function evaluatePassword(password: string): PasswordStrength {
  const rules: PasswordRule[] = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "An uppercase letter", met: /[A-Z]/.test(password) },
    { label: "A lowercase letter", met: /[a-z]/.test(password) },
    { label: "A digit", met: /\d/.test(password) },
    { label: "A special character", met: /[^A-Za-z0-9]/.test(password) },
  ];

  const metCount = rules.filter((rule) => rule.met).length;
  const allMet = metCount === rules.length;

  let score: number;
  if (password.length === 0) {
    score = 0;
  } else if (!allMet) {
    score = Math.min(metCount, 3) > 2 ? 2 : 1;
  } else {
    score = password.length >= 12 ? 4 : 3;
  }

  const labels: PasswordStrength["label"][] = ["Too weak", "Weak", "Fair", "Good", "Strong"];
  return { score, label: labels[score], rules, allMet };
}
