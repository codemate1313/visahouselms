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
    welcome: "IELTS LMS terminal - preset commands only.",
    selectCommand: "Select a command from the palette on the left.",
  },
  connectionClosed: "Connection closed.",
} as const;
