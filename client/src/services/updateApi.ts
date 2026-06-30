/** Fragt das Backend nach der neuesten veröffentlichten Version (für den Update-Hinweis). */
import type { UpdateInfo } from '@shared/types/index';
import { apiFetch } from './api';

export function getUpdateInfo(): Promise<UpdateInfo> {
  return apiFetch<UpdateInfo>('/api/update-check');
}
