const SESSION_STORAGE_KEY = 'legend_admin_session';

function isBrowser() {
  return typeof window !== 'undefined' && !!window.sessionStorage;
}

export function getSession() {
  if (!isBrowser()) {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(SESSION_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    return JSON.parse(rawValue);
  } catch (error) {
    clearSession();
    return null;
  }
}

export function saveSession(session) {
  if (!isBrowser()) {
    return;
  }

  const normalizedSession = {
    token: typeof session?.token === 'string' ? session.token : '',
    expiresAt: Number(session?.expiresAt || 0),
    reviewerId: typeof session?.reviewerId === 'string' ? session.reviewerId : '',
  };

  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(normalizedSession));
}

export function clearSession() {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

export function isSessionExpired(session) {
  if (!session || !session.token) {
    return true;
  }

  const expiresAt = Number(session.expiresAt || 0);
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now();
}
