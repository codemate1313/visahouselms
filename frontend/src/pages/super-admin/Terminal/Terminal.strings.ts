export const terminalStrings = {
  title: "CMD Terminal",
  authGate: {
    hint: "Security check: re-enter your password to open a terminal session. Only whitelisted preset commands can run; every command is audit-logged.",
    passwordLabel: "Password",
    opening: "Opening...",
    openTerminal: "Open Terminal",
  },
  errors: {
    open: "Failed to open terminal.",
  },
  banner: {
    welcome: "LanguageCert terminal - preset commands only.",
    selectCommand: "Select a command from the palette on the left.",
  },
  connectionClosed: "Connection closed.",
  presetConfirmTitle: "Run Preset Command",
  presetConfirm: (label: string) => `Run preset "${label}"? This executes a real command on the server and cannot be undone.`,
} as const;
