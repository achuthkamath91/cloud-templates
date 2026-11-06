import { currentSession } from './auth';

const BASE = import.meta.env.VITE_API_URL as string;

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  email?: string;
  phone?: string;
  status: 'lead' | 'active' | 'inactive';
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await currentSession();
  if (!session) throw new Error('Not signed in');
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session.idToken}` },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? res.statusText);
  }
  return (await res.json()) as T;
}

export const listPatients = () => call<{ items: Patient[]; next?: string }>('/patients');

export const createPatient = (p: Omit<Patient, 'id'>) =>
  call<Patient>('/patients', { method: 'POST', body: JSON.stringify(p) });
