export type ConfirmVariant = "danger" | "warning" | "primary";

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  variant: ConfirmVariant;
  resolve: (value: boolean) => void;
}

export const CONFIRM_DIALOG_EVENT = "app-confirm-dialog";

function requestConfirmation(request: Omit<ConfirmRequest, "resolve">): Promise<boolean> {
  return new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent<ConfirmRequest>(CONFIRM_DIALOG_EVENT, {
        detail: { ...request, resolve },
      }),
    );
  });
}

export function confirmDelete(message: string, title = "Confirm Delete"): Promise<boolean> {
  return requestConfirmation({
    title,
    message,
    confirmText: "Delete",
    cancelText: "Cancel",
    variant: "danger",
  });
}

export function confirmAction(
  message: string,
  options?: {
    title?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: ConfirmVariant;
  },
): Promise<boolean> {
  return requestConfirmation({
    title: options?.title ?? "Confirm Action",
    message,
    confirmText: options?.confirmText ?? "Confirm",
    cancelText: options?.cancelText ?? "Cancel",
    variant: options?.variant ?? "danger",
  });
}
