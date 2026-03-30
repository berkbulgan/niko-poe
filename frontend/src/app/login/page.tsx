// ABOUTME: Login page — the gateway to C.A.D.I.R.O. for exiles.
// ABOUTME: PoE-themed login form with gold accents, Cadiro quote, and animated background.

'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(username, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Login failed. Check your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      {/* Background — subtle radial glow from top */}
      <div
        className="pointer-events-none fixed inset-0"
        aria-hidden="true"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 60% 40% at 50% 0%, rgba(175,96,37,0.06), transparent),
            radial-gradient(circle at 50% 100%, rgba(0,0,0,0.5), transparent)
          `,
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo / Title */}
        <div className="mb-10 text-center">
          <Link href="/" className="inline-block">
            <h1 className="font-display text-3xl tracking-[0.2em] text-poe-gold">
              C.A.D.I.R.O.
            </h1>
          </Link>
          <p className="mt-3 font-mono text-xs text-poe-text-muted">
            &quot;I have what you need, exile.&quot;
          </p>
        </div>

        {/* Login card */}
        <div className="relative border border-poe-border/60 bg-poe-panel/40 p-8">
          {/* Corner accents */}
          <span className="absolute left-0 top-0 h-4 w-px bg-poe-gold/50" aria-hidden="true" />
          <span className="absolute left-0 top-0 h-px w-4 bg-poe-gold/50" aria-hidden="true" />
          <span className="absolute right-0 top-0 h-4 w-px bg-poe-gold/50" aria-hidden="true" />
          <span className="absolute right-0 top-0 h-px w-4 bg-poe-gold/50" aria-hidden="true" />
          <span className="absolute bottom-0 left-0 h-4 w-px bg-poe-gold/50" aria-hidden="true" />
          <span className="absolute bottom-0 left-0 h-px w-4 bg-poe-gold/50" aria-hidden="true" />
          <span className="absolute bottom-0 right-0 h-4 w-px bg-poe-gold/50" aria-hidden="true" />
          <span className="absolute bottom-0 right-0 h-px w-4 bg-poe-gold/50" aria-hidden="true" />

          <h2 className="font-display text-sm tracking-[0.3em] text-poe-text-dim">
            IDENTIFY YOURSELF
          </h2>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="username"
                className="mb-1.5 block text-xs tracking-wider text-poe-text-muted"
              >
                USERNAME
              </label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="exile"
                autoComplete="username"
                required
                autoFocus
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs tracking-wider text-poe-text-muted"
              >
                PASSWORD
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                autoComplete="current-password"
                required
              />
            </div>

            {error !== null && (
              <div className="border border-poe-error/30 bg-poe-error/5 px-3 py-2 text-sm text-poe-error">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full font-display tracking-widest"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'ENTERING...' : 'ENTER WRAECLAST'}
            </Button>
          </form>
        </div>

        {/* Back to landing */}
        <p className="mt-6 text-center text-xs text-poe-text-muted">
          <Link
            href="/"
            className="text-poe-text-dim transition-colors hover:text-poe-gold"
          >
            &larr; Back to shore
          </Link>
        </p>
      </div>
    </div>
  );
}
