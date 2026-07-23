import type { GoogleCalendar, GoogleCalendarEvent, Task } from '../types';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: (options?: { prompt?: string }) => void };
          revoke: (token: string, callback: () => void) => void;
        };
      };
    };
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
export const isGoogleCalendarConfigured = Boolean(CLIENT_ID);
const TOKEN_KEY = 'kyou-note:google-calendar-token';
let googleScriptPromise: Promise<void> | undefined;

const waitForGoogle = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (window.google?.accounts) {
        window.clearInterval(timer);
        resolve();
      } else if (Date.now() - startedAt > 10_000) {
        window.clearInterval(timer);
        reject(new Error('Googleの認証画面を読み込めませんでした。通信状態とブラウザの追跡防止設定を確認してください。'));
      }
    }, 50);
  });

const loadScript = (): Promise<void> => {
  if (window.google?.accounts) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise<void>((resolve, reject) => {
    if (window.google?.accounts) return resolve();
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity]');
    if (existing) {
      void waitForGoogle().then(resolve, reject);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.dataset.googleIdentity = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Googleの認証画面を読み込めませんでした。'));
    document.head.append(script);
  }).catch((reason) => {
    googleScriptPromise = undefined;
    throw reason;
  });
  return googleScriptPromise!;
};

export const hasGoogleCalendarToken = (): boolean => Boolean(sessionStorage.getItem(TOKEN_KEY));

export const connectGoogleCalendar = async (): Promise<void> => {
  if (!CLIENT_ID) throw new Error('Google CalendarのクライアントIDが未設定です。');
  await loadScript();
  await new Promise<void>((resolve, reject) => {
    const client = window.google?.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly',
      callback: (response) => {
        if (response.error || !response.access_token) return reject(new Error('Googleアカウントとの連携を完了できませんでした。'));
        sessionStorage.setItem(TOKEN_KEY, response.access_token);
        resolve();
      }
    });
    client?.requestAccessToken({ prompt: 'consent' });
  });
};

const request = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) throw new Error('Googleカレンダーと連携してください。');
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers }
  });
  if (response.status === 401) {
    sessionStorage.removeItem(TOKEN_KEY);
    throw new Error('Google連携の有効期限が切れました。再連携してください。');
  }
  if (!response.ok) throw new Error('Googleカレンダーとの通信に失敗しました。');
  return response.json() as Promise<T>;
};

export const fetchGoogleCalendars = async (): Promise<GoogleCalendar[]> => {
  const result = await request<{
    items?: Array<{ id: string; summary?: string; primary?: boolean; accessRole?: string; deleted?: boolean }>;
  }>('/users/me/calendarList?minAccessRole=reader&showDeleted=false');
  return (result.items ?? [])
    .filter((calendar) => !calendar.deleted)
    .map((calendar) => ({
      id: calendar.id,
      name: calendar.summary || calendar.id,
      primary: Boolean(calendar.primary),
      accessRole: calendar.accessRole ?? 'reader'
    }));
};

export const fetchGoogleEvents = async (
  timeMin: string,
  timeMax: string,
  calendarId = 'primary'
): Promise<GoogleCalendarEvent[]> => {
  const params = new URLSearchParams({
    timeMin: new Date(`${timeMin}T00:00:00`).toISOString(),
    timeMax: new Date(`${timeMax}T23:59:59`).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250'
  });
  const result = await request<{
    items?: Array<{ id: string; summary?: string; start?: { date?: string; dateTime?: string }; end?: { date?: string; dateTime?: string }; htmlLink?: string }>;
  }>(`/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
  return (result.items ?? []).map((event) => ({
    id: event.id,
    title: event.summary || '無題の予定',
    start: event.start?.dateTime ?? event.start?.date ?? '',
    end: event.end?.dateTime ?? event.end?.date,
    htmlLink: event.htmlLink
  }));
};

export const createGoogleEvent = async (task: Task, calendarId = 'primary'): Promise<string> => {
  const duplicateParams = new URLSearchParams({
    privateExtendedProperty: `kyouNoteTaskId=${task.id}`,
    maxResults: '1',
    singleEvents: 'true'
  });
  const path = `/calendars/${encodeURIComponent(calendarId)}/events`;
  const duplicates = await request<{ items?: Array<{ id: string }> }>(`${path}?${duplicateParams}`);
  if (duplicates.items?.[0]) return duplicates.items[0].id;

  const hasTime = Boolean(task.startTime || task.deadline);
  const startTime = task.startTime || task.deadline || '09:00';
  const duration = task.durationMinutes ?? 30;
  const start = new Date(`${task.date}T${startTime}:00`);
  const end = new Date(start.getTime() + duration * 60_000);
  const payload = hasTime
    ? {
        summary: task.title,
        description: task.notes,
        start: { dateTime: start.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end: { dateTime: end.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        extendedProperties: { private: { kyouNoteTaskId: task.id } }
      }
    : {
        summary: task.title,
        description: task.notes,
        start: { date: task.date },
        end: { date: new Date(new Date(`${task.date}T00:00:00`).getTime() + 86_400_000).toISOString().slice(0, 10) },
        extendedProperties: { private: { kyouNoteTaskId: task.id } }
      };
  const created = await request<{ id: string }>(path, { method: 'POST', body: JSON.stringify(payload) });
  return created.id;
};

export const updateGoogleEvent = async (task: Task): Promise<void> => {
  if (!task.googleEventId) throw new Error('対応するGoogle予定がありません。');
  const calendarId = task.googleCalendarId || 'primary';
  const startTime = task.startTime || task.deadline || '09:00';
  const start = new Date(`${task.date}T${startTime}:00`);
  const end = new Date(start.getTime() + (task.durationMinutes ?? 30) * 60_000);
  await request(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(task.googleEventId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      summary: task.title,
      description: task.notes,
      start: task.startTime || task.deadline
        ? { dateTime: start.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
        : { date: task.date },
      end: task.startTime || task.deadline
        ? { dateTime: end.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
        : { date: new Date(new Date(`${task.date}T00:00:00`).getTime() + 86_400_000).toISOString().slice(0, 10) }
    })
  });
};

export const deleteGoogleEvent = async (task: Task): Promise<void> => {
  if (!task.googleEventId) return;
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) throw new Error('Googleカレンダーと再連携してください。');
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(task.googleCalendarId || 'primary')}/events/${encodeURIComponent(task.googleEventId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok && response.status !== 404) throw new Error('Googleカレンダーの予定を削除できませんでした。');
};

export const disconnectGoogleCalendar = async (): Promise<void> => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) return;
  await loadScript();
  await new Promise<void>((resolve) => window.google?.accounts.oauth2.revoke(token, resolve));
  sessionStorage.removeItem(TOKEN_KEY);
};
