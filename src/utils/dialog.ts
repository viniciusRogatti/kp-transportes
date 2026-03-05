export type DialogAlertOptions = {
  title?: string;
  okLabel?: string;
};

export type DialogConfirmOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
};

type DialogHandlers = {
  alert: (message: string, options?: DialogAlertOptions) => Promise<void>;
  confirm: (message: string, options?: DialogConfirmOptions) => Promise<boolean>;
};

let handlers: DialogHandlers | null = null;

export function registerDialogHandlers(nextHandlers: DialogHandlers) {
  handlers = nextHandlers;
}

export function unregisterDialogHandlers() {
  handlers = null;
}

export async function showAlert(message: string, options?: DialogAlertOptions) {
  if (handlers) {
    await handlers.alert(message, options);
    return;
  }

  if (typeof window !== 'undefined') {
    window.alert(message);
  }
}

export async function showConfirm(message: string, options?: DialogConfirmOptions) {
  if (handlers) {
    return handlers.confirm(message, options);
  }

  if (typeof window !== 'undefined') {
    return window.confirm(message);
  }

  return false;
}

