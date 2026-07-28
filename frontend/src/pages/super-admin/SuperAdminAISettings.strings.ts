/**
 * Copy for the AI evaluation/scoring settings screen.
 *
 * Kept separate from DeveloperSettings.strings.ts `ai` block: that one
 * configures the advisory Writing rubric evaluator inside the developer panel,
 * while this screen owns the platform-wide scoring engine.
 */
export const superAdminAiSettingsStrings = {
  title: "AI Evaluation & Scoring Settings",
  subtitle:
    "Configure AI scoring engines for automatic Writing and Speaking test evaluations.",
  loading: "Loading AI evaluation settings...",
  configuredBadge: "Engine Configured & Ready",
  setupRequiredBadge: "Setup Required",
  apiKeyActiveBadge: "API Key Saved & Active (Encrypted)",

  providerLegend: "AI Evaluation Provider Mode",
  providers: {
    gemini: {
      label: "Google Gemini 1.5 / 2.0 Flash",
      description:
        "Direct multimodality: evaluates Writing (text) and Speaking (raw audio) natively. Free-tier supported.",
    },
    customJson: {
      label: "Our System AI Evaluator (Custom JSON Endpoint)",
      description:
        "Connects to our internal custom HTTP JSON evaluator microservice or self-hosted LLM server (Ollama, vLLM).",
    },
    disabled: {
      label: "Disabled",
      description:
        "Disable AI scoring suggestions. All evaluations remain 100% human examiner rated.",
    },
  },

  geminiKeyLabel: "Google Gemini API Key",
  geminiKeyPlaceholder: "Enter API key (e.g. AQ.Ab8RN6...)",
  geminiKeyHelpPrefix: "Get a free API key from",
  geminiKeyHelpLinkLabel: "Google AI Studio",
  geminiKeyHelpSuffix: ". Key is encrypted at rest.",
  geminiKeyHelpUrl: "https://aistudio.google.com/",

  securityNoteLabel: "Security Note:",
  securityNoteBody:
    "Your API key is active and encrypted at rest in the database. For security compliance, saved secrets are masked when loaded. To replace it, type a new API key.",

  endpointLabel: "Custom Evaluator Endpoint URL",
  endpointPlaceholder: "https://api.yourdomain.com/v1/evaluate",
  modelLabel: "Model Name",
  defaultModel: "gemini-2.0-flash",
  monthlyQuotaLabel: "Monthly Evaluation Quota Limit",

  saving: "Saving AI Settings...",
  save: "Save AI Settings",

  errors: {
    load: "Failed to load AI evaluation settings",
    save: "Failed to update AI evaluation settings",
  },
} as const;
