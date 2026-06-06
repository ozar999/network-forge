import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import React, { useState } from 'react';
import { signIn, signUp, signInGuest, signInWithGoogle, useAuth } from '@/lib/auth';

export const Route = createFileRoute('/auth')({
  head: () => ({
    meta: [
      { title: 'Sign In — NetSem' },
      { name: 'description', content: 'Sign in or create a NetSem account to save your labs and track progress' },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user && !user.isGuest) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-6">
        <div className="border border-border rounded-lg p-6 bg-card max-w-md w-full text-center">
          <h1 className="text-xl font-display text-terminal mb-2">Already signed in</h1>
          <p className="text-sm text-muted-foreground mb-4">Hi {user.name} ({user.email})</p>
          <Link to="/dashboard" className="inline-block px-4 py-2 rounded bg-primary text-primary-foreground text-xs">Go to Dashboard</Link>
        </div>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password, name);
    setBusy(false);
    if (!res.ok) { setError(res.error || 'Failed'); return; }
    if (mode === 'signup') {
      setError('Account created. Check your email to confirm, then sign in.');
      setMode('signin');
      return;
    }
    navigate({ to: '/dashboard' });
  };

  const onGoogle = async () => {
    setError(null);
    setBusy(true);
    const res = await signInWithGoogle();
    setBusy(false);
    if (!res.ok) setError(res.error || 'Google sign-in failed');
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-6">
      <div className="border border-border rounded-lg p-8 bg-card/80 backdrop-blur-sm max-w-md w-full">
        <h1 className="text-2xl font-display text-terminal text-glow tracking-wider text-center mb-1">
          {mode === 'signin' ? 'SIGN IN' : 'SIGN UP'}
        </h1>
        <p className="text-xs text-muted-foreground text-center mb-6">
          {mode === 'signin' ? 'Welcome back, operator.' : 'Create your operator account.'}
        </p>
        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && (
            <input
              type="text" required placeholder="Name" value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 bg-secondary/50 border border-border rounded text-sm outline-none focus:border-terminal"
            />
          )}
          <input
            type="email" required placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2 bg-secondary/50 border border-border rounded text-sm outline-none focus:border-terminal"
          />
          <input
            type="password" required placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2 bg-secondary/50 border border-border rounded text-sm outline-none focus:border-terminal"
          />
          {error && <p className="text-xs text-noc-red">{error}</p>}
          <button type="submit" disabled={busy} className="w-full py-2 rounded bg-primary text-primary-foreground text-sm font-display tracking-wider hover:opacity-90 disabled:opacity-50">
            {busy ? '...' : mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
          </button>
        </form>
        <div className="flex items-center my-4 gap-2 text-[10px] text-muted-foreground">
          <div className="flex-1 h-px bg-border" /> OR <div className="flex-1 h-px bg-border" />
        </div>
        <button
          onClick={onGoogle}
          disabled={busy}
          className="w-full py-2 mb-2 rounded border border-border bg-background text-sm hover:border-terminal/50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8L6.1 33C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41.4 35.5 44 30.1 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
          Continue with Google
        </button>
        <button
          onClick={() => { signInGuest(); navigate({ to: '/lab' }); }}
          className="w-full py-2 rounded border border-border text-sm hover:border-terminal/50 hover:text-terminal transition-colors"
        >Continue as Guest</button>
        <p className="text-xs text-center text-muted-foreground mt-4">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }} className="text-terminal hover:underline">
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
        <p className="text-[10px] text-center text-muted-foreground/60 mt-3">
          Your progress is securely saved to Lovable Cloud.
        </p>
      </div>
    </div>
  );
}