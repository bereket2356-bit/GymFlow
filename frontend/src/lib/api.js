const API_BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "";
const BASE = API_BASE ? `${API_BASE.replace(/\/$/, "")}/api/v1` : "/api/v1";

async function request(path, options = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body,
  });

  const contentType = response.headers.get("content-type") || "";
  let payload = null;
  if (contentType.includes("application/json")) {
    payload = await response.json().catch(() => null);
  } else {
    payload = await response.text().catch(() => null);
  }

  if (!response.ok) {
    const errorMsg =
      payload?.error?.message ||
      payload?.message ||
      (typeof payload === "string" ? payload : `Request failed with status ${response.status}`);
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = payload;
    throw err;
  }

  return payload;
}

export const api = {
  get: (path, options) => request(path, { method: "GET", ...options }),
  post: (path, body, options) => request(path, { method: "POST", body, ...options }),
  patch: (path, body, options) => request(path, { method: "PATCH", body, ...options }),
  put: (path, body, options) => request(path, { method: "PUT", body, ...options }),
  del: (path, options) => request(path, { method: "DELETE", ...options }),

  auth: {
    login: (email, password) => api.post("/auth/login", { email, password }),
    logout: () => api.post("/auth/logout"),
    me: () => api.get("/auth/me"),
  },
  customers: {
    list: (params = {}) => {
      const q = new URLSearchParams();
      if (params.page) q.set("page", params.page);
      if (params.limit) q.set("limit", params.limit);
      if (params.search) q.set("search", params.search);
      if (params.status) q.set("status", params.status);
      if (params.sort) q.set("sort", params.sort);
      const str = q.toString();
      return api.get(`/customers${str ? "?" + str : ""}`);
    },
    get: (id) => api.get(`/customers/${id}`),
    create: (body) => api.post("/customers", body),
    update: (id, body) => api.patch(`/customers/${id}`, body),
    archive: (id) => api.post(`/customers/${id}/archive`),
    restore: (id) => api.post(`/customers/${id}/restore`),
    ledger: (id) => api.get(`/customers/${id}/ledger`),
    attendance: (id, days) => api.get(`/customers/${id}/attendance${days ? "?days=" + days : ""}`),
    createMembership: (id, body) => api.post(`/customers/${id}/memberships`, body),
  },
  memberships: {
    get: (id) => api.get(`/memberships/${id}`),
    renew: (id, body) => api.post(`/memberships/${id}/renew`, body),
    cancel: (id, body) => api.post(`/memberships/${id}/cancel`, body),
  },
  payments: {
    list: (params = {}) => {
      const q = new URLSearchParams();
      if (params.page) q.set("page", params.page);
      if (params.limit) q.set("limit", params.limit);
      if (params.customerId) q.set("customerId", params.customerId);
      if (params.membershipId) q.set("membershipId", params.membershipId);
      if (params.method) q.set("method", params.method);
      if (params.from) q.set("from", params.from);
      if (params.to) q.set("to", params.to);
      const str = q.toString();
      return api.get(`/payments${str ? "?" + str : ""}`);
    },
    get: (id) => api.get(`/payments/${id}`),
    create: (body) => api.post("/payments", body),
    createAdjustment: (id, body) => api.post(`/payments/${id}/adjustments`, body),
  },
  packages: {
    list: (params = {}) => {
      const q = new URLSearchParams();
      if (params.page) q.set("page", params.page);
      if (params.limit) q.set("limit", params.limit);
      if (params.status) q.set("status", params.status);
      if (params.type) q.set("type", params.type);
      if (params.search) q.set("search", params.search);
      const str = q.toString();
      return api.get(`/packages${str ? "?" + str : ""}`);
    },
    get: (id) => api.get(`/packages/${id}`),
    create: (body) => api.post("/packages", body),
    update: (id, body) => api.patch(`/packages/${id}`, body),
    activate: (id, confirm = true) => api.post(`/packages/${id}/activate`, { confirm }),
    deactivate: (id, confirm = true) => api.post(`/packages/${id}/deactivate`, { confirm }),
    delete: (id) => api.del(`/packages/${id}`),
  },
  sessions: {
    list: (params = {}) => {
      const q = new URLSearchParams();
      if (params.page) q.set("page", params.page);
      if (params.limit) q.set("limit", params.limit);
      if (params.from) q.set("from", params.from);
      if (params.to) q.set("to", params.to);
      if (params.status) q.set("status", params.status);
      const str = q.toString();
      return api.get(`/sessions${str ? "?" + str : ""}`);
    },
    get: (id) => api.get(`/sessions/${id}`),
    create: (body) => api.post("/sessions", body),
    update: (id, body) => api.patch(`/sessions/${id}`, body),
    cancel: (id) => api.post(`/sessions/${id}/cancel`),
    getAttendance: (id) => api.get(`/sessions/${id}/attendance`),
    markAttendance: (id, entries) => api.put(`/sessions/${id}/attendance`, { entries }),
  },
  settings: {
    get: () => api.get("/settings"),
    update: (body) => api.patch("/settings", body),
  },
  dashboard: {
    summary: (period) => api.get(`/dashboard/summary${period ? "?period=" + period : ""}`),
    reminders: () => api.get("/dashboard/reminders"),
    reviewReminder: (key) => api.post(`/dashboard/reminders/${encodeURIComponent(key)}/review`),
    todaySessions: () => api.get("/dashboard/sessions-today"),
  },
  reports: {
    summary: (from, to) => api.get(`/reports/summary?from=${from}&to=${to}`),
    cash: (weeks, to) => api.get(`/reports/cash?weeks=${weeks}&to=${to}`),
    attendance: (weeks, to) => api.get(`/reports/attendance?weeks=${weeks}&to=${to}`),
    outstanding: () => api.get("/reports/outstanding"),
  },
};

export default api;
