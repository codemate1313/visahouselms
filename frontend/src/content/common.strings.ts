/**
 * Shared copy used across multiple screens/components. Page-specific text
 * belongs in that page's own `PageName.strings.ts`, not here — this file is
 * only for genuinely app-wide labels and messages.
 */

export const commonActions = {
  save: "Save",
  cancel: "Cancel",
  delete: "Delete",
  edit: "Edit",
  add: "Add",
  close: "Close",
  confirm: "Confirm",
  back: "Back",
  next: "Next",
  retry: "Retry",
  clearAll: "Clear all",
  selectAll: "Select all",
  copy: "Copy",
  copied: "Copied",
  clearSearch: "Clear search",
} as const;

export const loaderMessages = {
  idle: "Loading...",
  cycle: [
    "Processing request...",
    "Syncing data with server...",
    "Finalizing changes...",
    "Almost ready...",
  ],
} as const;

export const dialogDefaults = {
  successTitle: "Success",
  errorTitle: "Action Failed",
  warningTitle: "Warning",
  infoTitle: "Notice",
} as const;

export const passwordRuleLabels = {
  minLength: "At least 8 characters",
  uppercase: "An uppercase letter",
  lowercase: "A lowercase letter",
  digit: "A digit",
  specialChar: "A special character",
} as const;

export const emptyStateDefaults = {
  noResultsTitle: "No results found",
  noResultsDescription: "Try adjusting your search or filters.",
} as const;
