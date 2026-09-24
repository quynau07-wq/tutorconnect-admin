import {getIdToken} from 'firebase/auth';
import {auth} from './firebase';

export type AccountStatus = 'active' | 'locked' | 'pending' | 'rejected';
export type Tutor = {
  id: string; displayName: string; email: string; role?: 'tutor' | 'user' | 'admin';
  phoneNumber?: string | null; dateOfBirth?: string | null; age?: number | string | null;
  address?: string | null; photoURL?: string | null; avatarUrl?: string | null; avatarBase64?: string | null;
  gender?: string; province?: string; ward?: string; district?: string;
  documentBase64?: string | null; degreeImageBase64?: string | null; certificateImageBase64?: string | null;
  degreeUrl?: string | null; certificateUrl?: string | null;
  subjects?: string[]; grades?: string[]; experience?: string; bio?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected'; accountStatus?: AccountStatus; disabled?: boolean;
  createdAt?: {seconds?: number; _seconds?: number};
  tutorStatus?: string; rejectionReason?: string;
  verification?: {front?: string; back?: string; portrait?: string};
  university?: string; major?: string; educationLevel?: string; educationStatus?: string;
  startYear?: string; graduationYear?: string; levels?: string[];
  experienceYears?: string; teachingMethod?: string; achievements?: string; teachingModes?: string[];
  teachingAreas?: string; travelRadius?: string; priceUnit?: string; onlinePrice?: string; offlinePrice?: string;
  title?: string; strengths?: string; availability?: {dayOfWeek: string; startTime: string; endTime: string}[];
  certificates?: {name: string; issuer: string; issuedAt: string; expiresAt: string; image: string}[];
};
export type AdminSession = {email: string; role: 'admin' | 'super_admin'};
export type StaffAdmin = Tutor;
export type ManagedUser = Tutor;
export type ProfileUpdate = Partial<Pick<Tutor, 'displayName' | 'phoneNumber' | 'dateOfBirth' | 'age' | 'address' | 'photoURL' | 'documentBase64' | 'degreeImageBase64' | 'certificateImageBase64' | 'subjects' | 'grades' | 'experience' | 'bio'>>;
export type CreateUserPayload = ProfileUpdate & {displayName: string; email: string; password: string};
export const createUser = (role: 'user' | 'tutor', payload: CreateUserPayload) =>
  request<ManagedUser>(`/api/admin/users/${role}`, {method: 'POST', body: JSON.stringify(payload)});

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Bạn chưa đăng nhập.');
  const token = await getIdToken(user, true);
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || 'API request failed');
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
};

export const listTutors = (status: string) =>
  request<Tutor[]>(`/api/admin/tutors?status=${status}`);

export const updateTutorStatus = (uid: string, status: 'approved' | 'rejected', rejectionReason?: string) =>
  request<{id: string; approvalStatus: string}>(`/api/admin/tutors/${uid}/status`, {
    method: 'PATCH',
    body: JSON.stringify({status, rejectionReason}),
  });

export const listUsers = (role: 'user' | 'tutor') =>
  request<ManagedUser[]>(`/api/admin/users/${role}`);
export const updateUserStatus = (uid: string, status: 'active' | 'locked') =>
  request<{id: string; accountStatus: AccountStatus}>(`/api/admin/users/${uid}/status`, {
    method: 'PATCH',
    body: JSON.stringify({status}),
  });

export const getAdminSession = () => request<AdminSession>('/api/admin/session');
export const listStaff = () => request<StaffAdmin[]>('/api/admin/staff');
export const createStaff = (payload: {email: string; password: string; displayName: string; phoneNumber?: string; dateOfBirth?: string; age?: number | string; address?: string; documentBase64?: string}) =>
  request<StaffAdmin>('/api/admin/staff', {method: 'POST', body: JSON.stringify(payload)});
export const deleteStaff = (uid: string) =>
  request<void>(`/api/admin/staff/${uid}`, {method: 'DELETE'});
export const updateStaff = (uid: string, payload: ProfileUpdate & {disabled?: boolean}) =>
  request<StaffAdmin>(`/api/admin/staff/${uid}`, {method: 'PATCH', body: JSON.stringify(payload)});
export type RevenueReport = {
  from: string; to: string; timezone: string; bucket: 'hour' | 'day' | 'month';
  total: number; count: number; average: number;
  series: {key: string; total: number; count: number}[];
  tutors: {id: string; name: string; total: number; count: number}[];
};
export const getRevenue = (period: string, from = '', to = '') =>
  request<RevenueReport>(`/api/admin/revenue?${new URLSearchParams({period, from, to})}`);

export const updateUserProfile = (role: 'user' | 'tutor', uid: string, payload: ProfileUpdate) => request<ManagedUser>(`/api/admin/users/${role}/${uid}`, {method: 'PATCH', body: JSON.stringify(payload)});
export type JobPost = {id: string; userId: string; subject: string; grade: string; status: 'OPEN' | 'CLOSED' | 'MATCHED'; goal: string; location: string; budget: number; applicantCount: number; recommendationCount: number; schedule: {dayOfWeek: string; startTime: string; endTime: string}[]};
export const listJobPosts = () => request<JobPost[]>('/api/learning/admin/jobs');
export const updateJobPost = (id: string, status: 'OPEN' | 'CLOSED') => request(`/api/learning/admin/jobs/${id}`, {method: 'PATCH', body: JSON.stringify({status})});
