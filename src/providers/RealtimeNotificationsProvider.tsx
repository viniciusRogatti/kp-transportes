import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../data';

export type RealtimeNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  entity: {
    kind: string | null;
    id: string | null;
  };
  metadata: Record<string, unknown>;
  actionUrl: string | null;
  resolutionMode: 'manual' | 'automatic';
  canResolve: boolean;
  status: 'active' | 'resolved';
  createdAt: string;
  updatedAt: string;
  read: boolean;
};

type NotificationsApiResponse = {
  notifications?: unknown;
  unreadCount?: unknown;
};

type RealtimeNotificationsContextValue = {
  notifications: RealtimeNotification[];
  unreadCount: number;
  connected: boolean;
  lastReceivedAt: string | null;
  lastAlertUpdateAt: string | null;
  refreshNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  resolveNotification: (notificationId: string) => Promise<boolean>;
};

type RealtimeNotificationsProviderProps = {
  token: string | null;
  children: ReactNode;
};

const POLL_INTERVAL_MS = 20000;
const POLL_GRACE_PERIOD_MS = 8000;
const SOCKET_EVENT_NAME = 'notification:new';
const ALERT_SOCKET_EVENT_NAME = 'delivery_monitoring_alert';

const RealtimeNotificationsContext = createContext<RealtimeNotificationsContextValue>({
  notifications: [],
  unreadCount: 0,
  connected: false,
  lastReceivedAt: null,
  lastAlertUpdateAt: null,
  refreshNotifications: async () => {},
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  resolveNotification: async () => false,
});

const toTimestamp = (value: string | null | undefined) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeNotification = (input: any): RealtimeNotification | null => {
  const id = String(input?.id || '').trim();
  if (!id) return null;

  const type = String(input?.type || 'GENERAL').trim().toUpperCase();
  const title = String(input?.title || '').trim();
  const message = String(input?.message || '').trim();
  const createdAtRaw = String(input?.createdAt || input?.created_at || '').trim();
  const createdAtTimestamp = toTimestamp(createdAtRaw);
  const createdAt = createdAtTimestamp ? new Date(createdAtTimestamp).toISOString() : new Date().toISOString();
  const updatedAtRaw = String(input?.updatedAt || input?.updated_at || createdAt).trim();
  const updatedAtTimestamp = toTimestamp(updatedAtRaw);

  return {
    id,
    type,
    title,
    message,
    entity: {
      kind: input?.entity?.kind ? String(input.entity.kind).trim() : null,
      id: input?.entity?.id ? String(input.entity.id).trim() : null,
    },
    metadata: input?.metadata && typeof input.metadata === 'object' ? input.metadata : {},
    actionUrl: input?.actionUrl || input?.action_url ? String(input.actionUrl || input.action_url) : null,
    resolutionMode: input?.resolutionMode === 'manual' || input?.resolution_mode === 'manual' ? 'manual' : 'automatic',
    canResolve: Boolean(input?.canResolve ?? input?.can_resolve),
    status: input?.status === 'resolved' ? 'resolved' : 'active',
    createdAt,
    updatedAt: updatedAtTimestamp ? new Date(updatedAtTimestamp).toISOString() : createdAt,
    read: Boolean(input?.read),
  };
};

const mergeNotifications = (
  currentRows: RealtimeNotification[],
  incomingRows: RealtimeNotification[],
): { rows: RealtimeNotification[]; insertedIds: Set<string> } => {
  const byId = new Map<string, RealtimeNotification>();
  const insertedIds = new Set<string>();

  currentRows.forEach((row) => {
    byId.set(row.id, row);
  });

  incomingRows.forEach((row) => {
    if (!byId.has(row.id)) {
      insertedIds.add(row.id);
    }

    const previous = byId.get(row.id);
    if (!previous) {
      byId.set(row.id, row);
      return;
    }

    const previousTs = toTimestamp(previous.updatedAt);
    const nextTs = toTimestamp(row.updatedAt);

    if (nextTs >= previousTs) {
      byId.set(row.id, {
        ...previous,
        ...row,
      });
      return;
    }

    byId.set(row.id, {
      ...row,
      ...previous,
    });
  });

  const rows = Array.from(byId.values())
    .filter((row) => row.status === 'active')
    .sort((left, right) => toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt))
    .slice(0, 120);

  return {
    rows,
    insertedIds,
  };
};

function RealtimeNotificationsProvider({ token, children }: RealtimeNotificationsProviderProps) {
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [lastReceivedAt, setLastReceivedAt] = useState<string | null>(null);
  const [lastAlertUpdateAt, setLastAlertUpdateAt] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const pollStarterTimeoutRef = useRef<number | null>(null);
  const resolutionRefreshTimeoutRef = useRef<number | null>(null);
  const notificationsRef = useRef<RealtimeNotification[]>([]);
  const tokenRef = useRef<string | null>(token);
  const lastReceivedAtRef = useRef<string | null>(lastReceivedAt);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    lastReceivedAtRef.current = lastReceivedAt;
  }, [lastReceivedAt]);

  const stopFallbackPolling = useCallback(() => {
    if (pollStarterTimeoutRef.current !== null) {
      window.clearTimeout(pollStarterTimeoutRef.current);
      pollStarterTimeoutRef.current = null;
    }

    if (pollIntervalRef.current !== null) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const stopResolutionRefresh = useCallback(() => {
    if (resolutionRefreshTimeoutRef.current !== null) {
      window.clearTimeout(resolutionRefreshTimeoutRef.current);
      resolutionRefreshTimeoutRef.current = null;
    }
  }, []);

  const updateLastReceivedAt = useCallback((incomingDate: string | null | undefined) => {
    if (!incomingDate) return;
    const incomingTs = toTimestamp(incomingDate);
    if (!incomingTs) return;

    setLastReceivedAt((current) => {
      const currentTs = toTimestamp(current || undefined);
      if (incomingTs <= currentTs) {
        return current;
      }

      return new Date(incomingTs).toISOString();
    });
  }, []);

  const loadNotifications = useCallback(async ({
    after,
    replace,
  }: {
    after?: string | null;
    replace?: boolean;
  } = {}) => {
    const currentToken = tokenRef.current;
    if (!currentToken) return;

    const params: Record<string, string> = { limit: '120' };
    if (after && toTimestamp(after) > 0) {
      params.after = after;
    }

    try {
      const { data } = await axios.get<NotificationsApiResponse>(`${API_URL}/api/notifications`, {
        params,
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });

      const normalizedIncoming = Array.isArray(data?.notifications)
        ? data.notifications
          .map((row) => normalizeNotification(row))
          .filter((row): row is RealtimeNotification => Boolean(row))
        : [];

      const highestDate = normalizedIncoming.reduce<string | null>((acc, row) => {
        const accTs = toTimestamp(acc || undefined);
        const rowTs = toTimestamp(row.updatedAt);
        if (rowTs > accTs) {
          return row.updatedAt;
        }
        return acc;
      }, null);

      if (replace) {
        setNotifications(normalizedIncoming.sort((left, right) => toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt)));
      } else if (normalizedIncoming.length) {
        setNotifications((currentRows) => mergeNotifications(currentRows, normalizedIncoming).rows);
      }

      if (typeof data?.unreadCount === 'number' && Number.isFinite(data.unreadCount)) {
        setUnreadCount(Math.max(0, Number(data.unreadCount)));
      }

      if (highestDate) {
        updateLastReceivedAt(highestDate);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[realtime-notifications] falha ao buscar notificacoes via REST fallback', error);
      }
    }
  }, [updateLastReceivedAt]);

  const startFallbackPolling = useCallback(() => {
    stopFallbackPolling();

    pollStarterTimeoutRef.current = window.setTimeout(() => {
      const poll = async () => {
        await loadNotifications({
          after: lastReceivedAtRef.current,
          replace: false,
        });
      };

      poll();
      pollIntervalRef.current = window.setInterval(poll, POLL_INTERVAL_MS);
    }, POLL_GRACE_PERIOD_MS);
  }, [loadNotifications, stopFallbackPolling]);

  const teardownSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setConnected(false);
  }, []);

  const refreshNotifications = useCallback(async () => {
    await loadNotifications({ replace: true });
  }, [loadNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    const normalizedId = String(notificationId || '').trim();
    if (!normalizedId) return;

    const currentToken = tokenRef.current;
    if (!currentToken) return;

    const existing = notificationsRef.current.find((row) => row.id === normalizedId);
    const wasUnread = Boolean(existing && !existing.read);

    if (wasUnread) {
      setNotifications((currentRows) => currentRows.map((row) => (
        row.id === normalizedId ? { ...row, read: true } : row
      )));
      setUnreadCount((current) => Math.max(0, current - 1));
    }

    try {
      await axios.patch(
        `${API_URL}/api/notifications/${encodeURIComponent(normalizedId)}/read`,
        {},
        {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        },
      );
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[realtime-notifications] falha ao marcar notificacao como lida', error);
      }

      await loadNotifications({ replace: true });
    }
  }, [loadNotifications]);

  const markAllAsRead = useCallback(async () => {
    const currentToken = tokenRef.current;
    if (!currentToken) return;

    setNotifications((currentRows) => currentRows.map((row) => ({ ...row, read: true })));
    setUnreadCount(0);

    try {
      await axios.patch(
        `${API_URL}/api/notifications/read-all`,
        {},
        { headers: { Authorization: `Bearer ${currentToken}` } },
      );
      await loadNotifications({ replace: true });
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[realtime-notifications] falha ao marcar todas como lidas', error);
      }
      await loadNotifications({ replace: true });
    }
  }, [loadNotifications]);

  const resolveNotification = useCallback(async (notificationId: string) => {
    const normalizedId = String(notificationId || '').trim();
    const currentToken = tokenRef.current;
    if (!normalizedId || !currentToken) return false;
    try {
      await axios.patch(
        `${API_URL}/api/notifications/${encodeURIComponent(normalizedId)}/resolve`,
        {},
        { headers: { Authorization: `Bearer ${currentToken}` } },
      );
      await loadNotifications({ replace: true });
      return true;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[realtime-notifications] falha ao resolver notificacao', error);
      }
      await loadNotifications({ replace: true });
      return false;
    }
  }, [loadNotifications]);

  useEffect(() => {
    if (!token) {
      stopFallbackPolling();
      stopResolutionRefresh();
      teardownSocket();
      setNotifications([]);
      setUnreadCount(0);
      setLastReceivedAt(null);
      setLastAlertUpdateAt(null);
      return undefined;
    }

    let canceled = false;

    const setupRealtime = async () => {
      await loadNotifications({ replace: true });
      if (canceled) return;

      const socket = io(API_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 800,
        reconnectionDelayMax: 12000,
        randomizationFactor: 0.5,
        timeout: 10000,
        auth: {
          token,
        },
      });

      socketRef.current = socket;

      socket.on('connect', async () => {
        setConnected(true);
        stopFallbackPolling();

        await loadNotifications({
          after: lastReceivedAtRef.current,
          replace: false,
        });
      });

      socket.on('disconnect', () => {
        setConnected(false);
        startFallbackPolling();
      });

      socket.on('connect_error', () => {
        setConnected(false);
        startFallbackPolling();
      });

      socket.on(SOCKET_EVENT_NAME, (rawPayload: unknown) => {
        const normalized = normalizeNotification(rawPayload);
        if (!normalized) return;

        if (normalized.status === 'resolved') {
          const existing = notificationsRef.current.find((row) => row.id === normalized.id);
          setNotifications((currentRows) => currentRows.filter((row) => row.id !== normalized.id));
          if (existing && !existing.read) {
            setUnreadCount((current) => Math.max(0, current - 1));
          }
          updateLastReceivedAt(normalized.updatedAt);
          stopResolutionRefresh();
          resolutionRefreshTimeoutRef.current = window.setTimeout(() => {
            resolutionRefreshTimeoutRef.current = null;
            void loadNotifications({ replace: true });
          }, 500);
          return;
        }

        let inserted = false;
        setNotifications((currentRows) => {
          const mergedResult = mergeNotifications(currentRows, [normalized]);
          inserted = mergedResult.insertedIds.has(normalized.id);
          return mergedResult.rows;
        });

        if (inserted && !normalized.read) {
          setUnreadCount((current) => current + 1);
        }

        updateLastReceivedAt(normalized.updatedAt);
      });

      socket.on(ALERT_SOCKET_EVENT_NAME, (rawPayload: any) => {
        const emittedAt = String(rawPayload?.emitted_at || new Date().toISOString());
        setLastAlertUpdateAt(emittedAt);
      });
    };

    setupRealtime();

    return () => {
      canceled = true;
      stopFallbackPolling();
      stopResolutionRefresh();
      teardownSocket();
    };
  }, [token, loadNotifications, startFallbackPolling, stopFallbackPolling, stopResolutionRefresh, teardownSocket, updateLastReceivedAt]);

  const contextValue = useMemo<RealtimeNotificationsContextValue>(() => ({
    notifications,
    unreadCount,
    connected,
    lastReceivedAt,
    lastAlertUpdateAt,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    resolveNotification,
  }), [notifications, unreadCount, connected, lastReceivedAt, lastAlertUpdateAt, refreshNotifications, markAsRead, markAllAsRead, resolveNotification]);

  return (
    <RealtimeNotificationsContext.Provider value={contextValue}>
      {children}
    </RealtimeNotificationsContext.Provider>
  );
}

const useRealtimeNotifications = () => useContext(RealtimeNotificationsContext);

export {
  RealtimeNotificationsProvider,
  useRealtimeNotifications,
};
