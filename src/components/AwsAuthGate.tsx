import { FormEvent, ReactNode, useEffect, useState } from 'react';
import {
  completeAwsNewPassword,
  getAwsIdToken,
  isAwsCognitoConfigured,
  signInToAws,
  signOutFromAws,
} from '@/lib/aws-cognito-auth';
import { isAwsDataApiConfigured } from '@/lib/aws-data-api';
import { seedAwsIndianDataIfEmpty } from '@/lib/indian-data-seeder';

type Challenge = Awaited<ReturnType<typeof signInToAws>>['challenge'];

export default function AwsAuthGate({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(() => !isAwsCognitoConfigured() || Boolean(getAwsIdToken()));
  const [seedReady, setSeedReady] = useState(() => !isAwsDataApiConfigured() || !getAwsIdToken());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [challenge, setChallenge] = useState<Challenge>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!signedIn || !isAwsDataApiConfigured()) return;
    let current = true;
    setSeedReady(false);
    seedAwsIndianDataIfEmpty()
      .catch((reason) => console.error('AWS demo data initialization failed:', reason))
      .finally(() => { if (current) setSeedReady(true); });
    return () => { current = false; };
  }, [signedIn]);

  if (!isAwsCognitoConfigured() || (signedIn && seedReady)) {
    return (
      <>
        {children}
        {isAwsCognitoConfigured() && (
          <button
            type="button"
            onClick={() => { signOutFromAws(); setSignedIn(false); }}
            className="fixed bottom-4 right-4 z-50 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-lg hover:text-foreground"
          >
            Sign out of AWS
          </button>
        )}
      </>
    );
  }

  if (signedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Preparing MarketPulse AWS data…</p>
      </main>
    );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (challenge) {
        await completeAwsNewPassword(challenge, newPassword);
        setChallenge(undefined);
        setNewPassword('');
        setSignedIn(true);
      } else {
        const result = await signInToAws(username, password);
        setPassword('');
        if (result.challenge) setChallenge(result.challenge);
        else setSignedIn(true);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not sign in to AWS Cognito');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground">
      <form onSubmit={handleSubmit} className="mx-auto w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">MarketPulse</p>
          <h1 className="mt-2 text-2xl font-semibold">AWS administrator sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {challenge ? 'Set a new password to finish signing in.' : 'Sign in with your Cognito user pool account to use the dashboard.'}
          </p>
        </div>
        {!challenge && (
          <>
            <label className="block space-y-2 text-sm">
              <span>Email or username</span>
              <input autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" />
            </label>
            <label className="block space-y-2 text-sm">
              <span>Password</span>
              <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" />
            </label>
          </>
        )}
        {challenge && (
          <label className="block space-y-2 text-sm">
            <span>New password</span>
            <input type="password" autoComplete="new-password" minLength={12} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" />
          </label>
        )}
        {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? 'Signing in…' : challenge ? 'Set password and continue' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
