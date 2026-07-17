import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearSession, getStoredAdmin, getToken, getExpiry, isSessionExpired, saveSession } from '../api/client';
import { connectRealtime, disconnectRealtime, subscribeRealtime } from '../utils/realtime';
import { isAdministratorRole } from '../utils/roles';

const AuthContext = createContext(null);

function scheduleMidnightLogout(onExpire) {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const ms = midnight.getTime() - now.getTime();
  return window.setTimeout(onExpire, ms);
}

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(getStoredAdmin());
  const [loading, setLoading] = useState(true);

  const logout = () => {
    clearSession();
    disconnectRealtime();
    setAdmin(null);
  };

  const refreshAdmin = async () => {
    const result = await api.me();
    if (result.admin) {
      saveSession({
        token: getToken(),
        expiresAt: getExpiry(),
        admin: result.admin,
      });
      setAdmin(result.admin);
    }
    return result.admin;
  };

  useEffect(() => {
    if (isSessionExpired()) {
      logout();
      setLoading(false);
      return;
    }

    if (getStoredAdmin()) {
      api.me()
        .then((result) => {
          if (result.admin) {
            saveSession({
              token: getToken(),
              expiresAt: getExpiry(),
              admin: result.admin,
            });
            setAdmin(result.admin);
          }
        })
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    const timer = scheduleMidnightLogout(() => {
      logout();
      window.location.href = '/login?expired=1';
    });

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token || isSessionExpired() || !admin?.adminId) {
      disconnectRealtime();
      return undefined;
    }

    connectRealtime(token);

    const unsubscribeAuth = subscribeRealtime('auth:updated', async (payload) => {
      if (payload?.adminId && payload.adminId === admin.adminId) {
        await refreshAdmin();
      }
    });

    const unsubscribeSession = subscribeRealtime('auth:session-ended', (payload) => {
      if (!payload?.adminId || payload.adminId === admin.adminId) {
        logout();
        window.location.href = '/login?session-ended=1';
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSession();
    };
  }, [admin?.adminId]);

  const value = useMemo(
    () => ({
      admin,
      loading,
      isAuthenticated: Boolean(admin) && !isSessionExpired(),
      isAdministrator: isAdministratorRole(admin?.role),
      login: async (username, password) => {
        const result = await api.login(username, password);
        saveSession(result);
        setAdmin(result.admin);
        return result;
      },
      refreshAdmin,
      logout,
    }),
    [admin, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
