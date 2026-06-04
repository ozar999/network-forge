import { useEffect, useState } from 'react';
import { trackEvent } from './progress';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: number;
  isGuest: boolean;
}

const USER_KEY = 'netsem_user';
const USERS_KEY = 'netsem_users'; // local mock "directory"

const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }

function load(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch { return null; }
}
function save(u: User | null) {
  if (!u) localStorage.removeItem(USER_KEY);
  else localStorage.setItem(USER_KEY, JSON.stringify(u));
  emit();
}
function loadUsers(): Record<string, { password: string; user: User }> {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveUsers(d: Record<string, { password: string; user: User }>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(d));
}

export function signUp(email: string, password: string, name: string): { ok: boolean; error?: string; user?: User } {
  const users = loadUsers();
  const key = email.toLowerCase().trim();
  if (!key || !password || !name) return { ok: false, error: 'All fields required.' };
  if (users[key]) return { ok: false, error: 'Account already exists.' };
  const user: User = {
    id: `u-${Date.now()}`, email: key, name: name.trim(),
    createdAt: Date.now(), isGuest: false,
  };
  users[key] = { password, user };
  saveUsers(users);
  save(user);
  trackEvent('login');
  return { ok: true, user };
}

export function signIn(email: string, password: string): { ok: boolean; error?: string; user?: User } {
  const users = loadUsers();
  const key = email.toLowerCase().trim();
  const rec = users[key];
  if (!rec) return { ok: false, error: 'Account not found.' };
  if (rec.password !== password) return { ok: false, error: 'Wrong password.' };
  save(rec.user);
  trackEvent('login');
  return { ok: true, user: rec.user };
}

export function signInGuest(): User {
  const user: User = {
    id: `g-${Date.now()}`, email: 'guest@netsem.local', name: 'Guest',
    createdAt: Date.now(), isGuest: true,
  };
  save(user);
  return user;
}

export function signOut() {
  save(null);
}

export function useAuth(): { user: User | null } {
  const [user, setUser] = useState<User | null>(() => load());
  useEffect(() => {
    const l = () => setUser(load());
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return { user };
}