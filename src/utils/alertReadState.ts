const ALERT_READ_STORAGE_PREFIX = 'kptransportes:alerts-read';
const ALERT_READ_STATE_CHANGED_EVENT = 'kptransportes:alerts-read-state-changed';
const MAX_STORED_ALERT_IDS = 600;

const isBrowser = () => typeof window !== 'undefined';

const normalizeUserScope = () => {
  if (!isBrowser()) return 'anonymous:user';

  const login = String(
    window.localStorage.getItem('user_login')
    || window.localStorage.getItem('user_name')
    || 'anonymous',
  )
    .trim()
    .toLowerCase();
  const permission = String(window.localStorage.getItem('user_permission') || 'user')
    .trim()
    .toLowerCase();

  return `${login || 'anonymous'}:${permission || 'user'}`;
};

const getAlertReadStorageKey = () => `${ALERT_READ_STORAGE_PREFIX}:${normalizeUserScope()}`;

const sanitizeAlertIds = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0),
    ),
  ).slice(-MAX_STORED_ALERT_IDS);
};

const emitAlertReadChange = () => {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(ALERT_READ_STATE_CHANGED_EVENT));
};

export const getReadAlertIds = () => {
  if (!isBrowser()) return [];

  try {
    const raw = window.localStorage.getItem(getAlertReadStorageKey());
    if (!raw) return [];
    return sanitizeAlertIds(JSON.parse(raw));
  } catch (error) {
    console.error('Falha ao ler estado de visualização dos alertas.', error);
    return [];
  }
};

export const markAlertsAsRead = (alertIds: number[]) => {
  if (!isBrowser()) return 0;

  const nextIds = sanitizeAlertIds(alertIds);
  if (!nextIds.length) return 0;

  const currentIds = getReadAlertIds();
  const mergedIds = sanitizeAlertIds([...currentIds, ...nextIds]);
  if (mergedIds.length === currentIds.length) return 0;

  try {
    window.localStorage.setItem(getAlertReadStorageKey(), JSON.stringify(mergedIds));
    emitAlertReadChange();
    return mergedIds.length - currentIds.length;
  } catch (error) {
    console.error('Falha ao salvar estado de visualização dos alertas.', error);
    return 0;
  }
};

export const subscribeToAlertReadChanges = (listener: () => void) => {
  if (!isBrowser()) {
    return () => undefined;
  }

  const handleReadChange = () => {
    listener();
  };

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key.startsWith(ALERT_READ_STORAGE_PREFIX)) {
      listener();
    }
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(ALERT_READ_STATE_CHANGED_EVENT, handleReadChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(ALERT_READ_STATE_CHANGED_EVENT, handleReadChange);
  };
};
