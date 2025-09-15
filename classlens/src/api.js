export const API_BASE = (() => {
  if (typeof window !== "undefined" && (window.__API_BASE__ || window.__REACT_APP_API_BASE__)) {
    return window.__API_BASE__ || window.__REACT_APP_API_BASE__;
  }
  if (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }
  return "http://localhost:3000";
})();

export function joinUrl(base, path = "") {
  if (!path) return base;
  return `${base.replace(/\/+$/, "")}/${String(path).replace(/^\/+/, "")}`;
}
