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

export type DialogPromptOptions = {
  title?: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  required?: boolean;
};

type DialogHandlers = {
  alert: (message: string, options?: DialogAlertOptions) => Promise<void>;
  confirm: (message: string, options?: DialogConfirmOptions) => Promise<boolean>;
  prompt: (message: string, options?: DialogPromptOptions) => Promise<string | null>;
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

  if (typeof console !== 'undefined') console.warn(message);
}

export async function showConfirm(message: string, options?: DialogConfirmOptions) {
  if (handlers) {
    return handlers.confirm(message, options);
  }

  return false;
}

export async function showPrompt(message: string, options?: DialogPromptOptions) {
  if (handlers) return handlers.prompt(message, options);
  return null;
}
