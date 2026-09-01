import axios from 'axios';
import { API_URL } from '../data';

export type TutorialStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped' | 'dismissed_by_admin';
export type TutorialProgress = {
  id: number;
  user_id: number;
  tutorial_version: string;
  status: TutorialStatus;
  current_module: string | null;
  current_step: number;
  completed_modules: string[];
  skipped_steps: string[];
  started_at: string | null;
  last_interaction_at: string | null;
  paused_at: string | null;
  completed_at: string | null;
  permission: string | null;
};

const baseUrl = `${API_URL}/api/tutorial-progress`;
const authConfig = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
});

export const isRetryableTutorialSyncError = (error: unknown) => {
  if (!axios.isAxiosError(error)) return false;
  if (!error.response) return true;
  const status = Number(error.response.status || 0);
  return status === 408 || status === 429 || status >= 500;
};

export const getCurrentTutorialProgress = async () => {
  const { data } = await axios.get<{ current_version: string; progress: TutorialProgress }>(`${baseUrl}/current`, authConfig());
  return data;
};
export const updateTutorialProgress = async (payload: Partial<TutorialProgress>) => {
  const { data } = await axios.patch<TutorialProgress>(`${baseUrl}/current`, payload, authConfig());
  return data;
};
export const pauseTutorialProgress = async (payload: Partial<TutorialProgress>) => {
  const { data } = await axios.post<TutorialProgress>(`${baseUrl}/current/pause`, payload, authConfig());
  return data;
};
export const completeTutorialProgress = async (completedModules: string[]) => {
  const { data } = await axios.post<TutorialProgress>(`${baseUrl}/current/complete`, { completed_modules: completedModules }, authConfig());
  return data;
};
export type TutorialAdminRow = TutorialProgress & {
  user?: { id: number; username: string; name: string; permission: string };
};
export const listTutorialProgressAdmin = async () => {
  const { data } = await axios.get<TutorialAdminRow[]>(`${baseUrl}/admin`, authConfig());
  return data;
};
export const resetTutorialProgressAdmin = async (userId: number) => {
  const { data } = await axios.post<TutorialProgress>(`${baseUrl}/admin/${userId}/reset`, {}, authConfig());
  return data;
};
export const dismissTutorialProgressAdmin = async (userId: number, reason: string) => {
  const { data } = await axios.post<TutorialProgress>(`${baseUrl}/admin/${userId}/dismiss`, { reason }, authConfig());
  return data;
};
