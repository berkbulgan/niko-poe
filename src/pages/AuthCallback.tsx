// ABOUTME: OAuth callback landing page — shown after GGG login redirect completes.
// ABOUTME: Displays success state with account name, auto-redirects to dashboard after delay.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Shield } from 'lucide-react';

const REDIRECT_DELAY_MS = 3000;

export function AuthCallback() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(3);

  // Auto-redirect to dashboard after login
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      navigate('/dashboard', { replace: true });
      return;
    }

    const timer = setTimeout(() => {
      navigate('/dashboard', { replace: true });
    }, REDIRECT_DELAY_MS);

    const interval = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-full max-w-sm text-center">

        {/* Success icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center border border-poe-success/30 bg-poe-success/8">
          <Shield className="h-8 w-8 text-poe-success" strokeWidth={1.5} />
        </div>

        {/* Status */}
        {isLoading ? (
          <>
            <h1 className="font-display text-lg tracking-wide text-poe-text">
              Verifying Session...
            </h1>
            <p className="mt-2 text-sm text-poe-text-muted">
              Exchanging authorization with GGG
            </p>
          </>
        ) : isAuthenticated && user ? (
          <>
            <h1 className="font-display text-lg tracking-wide text-poe-text">
              Welcome, <span className="text-poe-gold">{user.displayName}</span>
            </h1>
            <p className="mt-2 text-sm text-poe-text-dim">
              Account linked successfully
            </p>

            {/* Redirect countdown */}
            <div className="mt-6 space-y-3">
              {/* Progress bar */}
              <div className="mx-auto h-px w-48 overflow-hidden bg-poe-border/40">
                <div
                  className="h-full bg-poe-gold/60 transition-all duration-1000 ease-linear"
                  style={{ width: `${((3 - countdown) / 3) * 100}%` }}
                />
              </div>
              <p className="text-xs text-poe-text-muted">
                Redirecting in {countdown}...
              </p>
            </div>

            {/* Skip link */}
            <button
              onClick={() => navigate('/dashboard', { replace: true })}
              className="mt-4 text-xs text-poe-text-dim transition-colors hover:text-poe-gold"
            >
              Continue now
            </button>
          </>
        ) : (
          <>
            <h1 className="font-display text-lg tracking-wide text-poe-text">
              Session Not Found
            </h1>
            <p className="mt-2 text-sm text-poe-text-muted">
              Login may have expired or been cancelled
            </p>
            <button
              onClick={() => navigate('/dashboard', { replace: true })}
              className="mt-6 border border-poe-gold/40 px-6 py-2 text-xs tracking-wider text-poe-gold transition-colors hover:border-poe-gold/70 hover:bg-poe-gold/5"
            >
              Back to Dashboard
            </button>
          </>
        )}

        {/* Disclaimer */}
        <p className="mt-10 text-[10px] leading-relaxed text-poe-text-muted/60">
          This product isn&apos;t affiliated with or endorsed by Grinding Gear Games in any way.
        </p>
      </div>
    </div>
  );
}
