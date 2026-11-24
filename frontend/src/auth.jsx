import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { API_ORIGIN, api, formatApiDetail } from "./ui";

const AuthContext = createContext({
  user: null,
  loading: true,
  parcels: [],
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  refreshParcels: async () => {},
  saveParcel: async () => {},
  deleteParcel: async () => {},
});

async function authFetch(path, options = {}) {
  const url = path.startsWith("http") ? path : `${API_ORIGIN}${path}`;
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(formatApiDetail(body.detail, `Error (${res.status})`));
  }
  return body;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshParcels = useCallback(async () => {
    try {
      const data = await api("/api/parcels");
      setParcels(data.parcels || []);
    } catch {
      setParcels([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`${API_ORIGIN}/api/auth/me`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.user) {
          setUser(data.user);
          refreshParcels();
        } else {
          setUser(null);
          setParcels([]);
        }
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshParcels]);

  const login = async ({ email, password }) => {
    const data = await authFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(data.user);
    await refreshParcels();
    return data.user;
  };

  const register = async ({ email, name, password }) => {
    const data = await authFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, name, password }),
    });
    setUser(data.user);
    setParcels([]);
    return data.user;
  };

  const logout = async () => {
    await authFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setParcels([]);
  };

  const saveParcel = async (payload) => {
    const data = await authFetch("/api/parcels", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setParcels((prev) => [data.parcel, ...prev]);
    return data.parcel;
  };

  const deleteParcel = async (parcelId) => {
    await authFetch(`/api/parcels/${parcelId}`, { method: "DELETE" });
    setParcels((prev) => prev.filter((p) => p.id !== parcelId));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        parcels,
        login,
        register,
        logout,
        refreshParcels,
        saveParcel,
        deleteParcel,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
