/**
 * Basis-URL des eigenen Backends. Liegt bewusst in einem eigenen Modul, damit sowohl `api.ts` als
 * auch `reachability.ts` sie nutzen können, ohne sich gegenseitig zu importieren (Zirkelbezug:
 * `api` meldet an `reachability`, `reachability` fragt selbst beim Server nach – #218).
 */
export const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
