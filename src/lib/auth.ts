import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { trackEvent } from './progress';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: number;
  isGuest: boolean;
  avatarUrl?: string;
}

const GUEST_KEY = 'netsem_guest';
const listeners = new Set<(u: User | null) => void>();
let current: User | null = null;

function emit() { for (const l of listeners) l(current); }

function fromSession(session: { user: { id: string; email?: string | null; user_metadata?: Record<string, unknown>; created_at?: string } } | null): User | null {
  if (!session?.user) return null;
  const u = session.user;
  const meta = (u.user_metadata || {}) as Record<string, string>;
  return {
    id: u.id,
    email: u.email || '',
    name: meta.full_name || meta.name || (u.email ? u.email.split('@')[0] : 'User'),
    avatarUrl: meta.avatar_url,
    createdAt: u.created_at ? new Date(u.created_at).getTime() : Date.now(),
    isGuest: false,
  };
}

function loadGuest(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch { return null; }
}

// Initialise session on the client
if (typeof window !== 'undefined') {
  supabase.auth.getSession().then(({ data }) => {
    current = fromSession(data.session as never) ?? loadGuest();
    emit();
  });
  supabase.auth.onAuthStateChange((event, session) => {
    if (session) localStorage.removeItem(GUEST_KEY);
    current = fromSession(session as never) ?? loadGuest();
    emit();
    if (event === 'SIGNED_IN') trackEvent('login');
  });
}

export async function signUp(email: string, password: string, name: string): Promise<{ ok: boolean; error?: string }> {
  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined;
  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: name.trim() }, emailRedirectTo: redirectTo },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signInWithGoogle(): Promise<{ ok: boolean; error?: string; redirected?: boolean }> {
  const result = await lovable.auth.signInWithOAuth('google', {
    redirect_uri: typeof window !== 'undefined' ? window.location.origin + '/dashboard' : undefined,
  });
  if (result.error) return { ok: false, error: result.error.message };
  if (result.redirected) return { ok: true, redirected: true };
  return { ok: true };
}

export function signInGuest(): User {
  const user: User = {
    id: `g-${Date.now()}`, email: 'guest@netsem.local', name: 'Guest',
    createdAt: Date.now(), isGuest: true,
  };
  if (typeof window !== 'undefined') localStorage.setItem(GUEST_KEY, JSON.stringify(user));
  current = user;
  emit();
  return user;
}

export async function signOut() {
  if (typeof window !== 'undefined') localStorage.removeItem(GUEST_KEY);
  await supabase.auth.signOut();
  current = null;
  emit();
}

export function useAuth(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(current);
  const [loading, setLoading] = useState<boolean>(current === null);
  useEffect(() => {
    const l = (u: User | null) => { setUser(u); setLoading(false); };
    listeners.add(l);
    // Trigger initial check if needed
    if (typeof window !== 'undefined') {
      supabase.auth.getSession().then(() => setLoading(false));
    }
    return () => { listeners.delete(l); };
  }, []);
  return { user, loading };
}