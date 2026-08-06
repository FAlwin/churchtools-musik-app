/**
 * ChurchTools-API-Client – **nur noch ein Re-Export** (#280).
 *
 * Diese Datei war der letzte Monolith des Projekts (1137 Zeilen: HTTP-Plumbing, Anmeldung, die
 * Rechte-Policy, alle Rohdaten-Typen und zehn Schreiboperationen in einem). Aufgeteilt in neun
 * Module, deren Abhängigkeiten nur in eine Richtung zeigen:
 *
 * ```
 *   ctTypes · ctHttp · ctSessionMemos        (Wurzeln, hängen an nichts Eigenem)
 *           ↑
 *   ctAuth · ctRead · ctFiles · ctCsrf
 *           ↑
 *   ctCapabilities (→ ctAuth) · ctWrite (→ ctCsrf, ctRead)
 * ```
 *
 * **Bei neuem Code direkt aus dem passenden Modul importieren, nicht von hier.** Dieser Re-Export
 * existiert nur, damit die 15 Bestandsimporte in einem eigenen Schritt umziehen können – ohne ihn
 * wäre der Umbau selbst nicht mehr von den Import-Änderungen zu unterscheiden gewesen, wenn ein
 * Test fällt.
 */

export type {
  ChurchToolsUser,
  CtAgendaItem,
  CtAgendaSong,
  CtArrangement,
  CtArrangementFile,
  CtEvent,
  CtService,
  CtSong,
  CtSongListEntry,
} from './ctTypes.js';
export { CtOverloadedError, isCtOverloaded, parseRetryAfter, readLimited } from './ctHttp.js';
export { __resetCsrfCacheForTests, __resetSessionMemosForTests } from './ctSessionMemos.js';
export { extractSessionCookie, getUserId, login, logout, whoami } from './ctAuth.js';
export {
  computeTeamNotesAllowed,
  getActiveMemberships,
  getCapabilities,
  getCapabilitiesCached,
  getGroupRoles,
  getGroups,
  parseCapabilities,
} from './ctCapabilities.js';
export {
  __clearSubtitleMemo,
  getAgenda,
  getAllSongs,
  getAppointmentSubtitle,
  getCtServices,
  getEvents,
  getSong,
} from './ctRead.js';
export { downloadFileText, fetchFileBytes, fileIdFromUrl } from './ctFiles.js';
export { CSRF_RETRY_DELAY_MS, __getCsrfTokenForTests } from './ctCsrf.js';
export {
  createAgendaItem,
  deleteAgendaItem,
  deleteFile,
  reorderAgenda,
  setAgendaItemHidden,
  updateAgendaItem,
  uploadChordpro,
} from './ctWrite.js';

// Einzige Quelle des Typs ist `@shared`; hier re-exportiert, damit Bestandsimporte
// (z. B. capabilitiesCache) weiter aus diesem Modul beziehen können.
export type { UserCapabilities } from '@shared/types/index';
