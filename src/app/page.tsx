// ABOUTME: Landing page for C.A.D.I.R.O. — the first thing exiles see.
// ABOUTME: PoE-gothic aesthetic with gold inscriptions, animated particles, and item-tooltip-style cards.

import Link from 'next/link';

function GoldDivider() {
  return (
    <div className="flex items-center justify-center gap-4 py-8" aria-hidden="true">
      <span className="h-px w-16 bg-gradient-to-r from-transparent to-poe-gold/60" />
      <span className="h-1.5 w-1.5 rotate-45 bg-poe-gold/80" />
      <span className="h-px w-16 bg-gradient-to-l from-transparent to-poe-gold/60" />
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  rarity,
}: {
  icon: string;
  title: string;
  description: string;
  rarity: 'unique' | 'rare' | 'currency' | 'gem';
}) {
  const rarityColors = {
    unique: 'border-poe-unique/40 hover:border-poe-unique/80',
    rare: 'border-poe-rare/30 hover:border-poe-rare/60',
    currency: 'border-poe-currency/30 hover:border-poe-currency/60',
    gem: 'border-poe-gem/30 hover:border-poe-gem/60',
  } as const;

  const rarityGlow = {
    unique: 'hover:shadow-[0_0_30px_-5px_rgba(175,96,37,0.3)]',
    rare: 'hover:shadow-[0_0_30px_-5px_rgba(255,255,0,0.15)]',
    currency: 'hover:shadow-[0_0_30px_-5px_rgba(255,215,0,0.2)]',
    gem: 'hover:shadow-[0_0_30px_-5px_rgba(27,162,155,0.25)]',
  } as const;

  const rarityText = {
    unique: 'text-poe-unique',
    rare: 'text-poe-rare',
    currency: 'text-poe-currency',
    gem: 'text-poe-gem',
  } as const;

  return (
    <div
      className={`
        group relative border bg-poe-panel/60 p-6
        transition-all duration-300 ease-out
        ${rarityColors[rarity]} ${rarityGlow[rarity]}
      `}
    >
      {/* Corner accents — like PoE item frame */}
      <span className="absolute left-0 top-0 h-3 w-px bg-poe-gold/40" aria-hidden="true" />
      <span className="absolute left-0 top-0 h-px w-3 bg-poe-gold/40" aria-hidden="true" />
      <span className="absolute right-0 top-0 h-3 w-px bg-poe-gold/40" aria-hidden="true" />
      <span className="absolute right-0 top-0 h-px w-3 bg-poe-gold/40" aria-hidden="true" />
      <span className="absolute bottom-0 left-0 h-3 w-px bg-poe-gold/40" aria-hidden="true" />
      <span className="absolute bottom-0 left-0 h-px w-3 bg-poe-gold/40" aria-hidden="true" />
      <span className="absolute bottom-0 right-0 h-3 w-px bg-poe-gold/40" aria-hidden="true" />
      <span className="absolute bottom-0 right-0 h-px w-3 bg-poe-gold/40" aria-hidden="true" />

      <div className="text-3xl" aria-hidden="true">{icon}</div>
      <h3 className={`mt-4 font-display text-lg tracking-wide ${rarityText[rarity]}`}>
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-poe-text-dim">
        {description}
      </p>
    </div>
  );
}

function StepIndicator({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative flex h-14 w-14 items-center justify-center">
        <span className="absolute inset-0 rotate-45 border border-poe-gold/50 bg-poe-panel" />
        <span className="relative font-display text-xl text-poe-gold">{step}</span>
      </div>
      <h3 className="mt-4 font-display text-base tracking-wide text-poe-text">{title}</h3>
      <p className="mt-1 max-w-[200px] text-sm text-poe-text-dim">{description}</p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background texture & vignette */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden="true"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(175,96,37,0.08), transparent),
            radial-gradient(circle at 50% 50%, transparent 40%, rgba(0,0,0,0.4))
          `,
        }}
      />

      {/* Animated particles (CSS-only) */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        {[...Array(12)].map((_, i) => (
          <span
            key={i}
            className="absolute h-px w-px rounded-full bg-poe-currency/60"
            style={{
              left: `${8 + i * 8}%`,
              top: `${10 + (i % 4) * 22}%`,
              animation: `particle-float ${6 + (i % 4) * 2}s ease-in-out ${i * 0.5}s infinite`,
              boxShadow: '0 0 4px 1px rgba(255,215,0,0.3)',
            }}
          />
        ))}
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12">
        <span className="font-display text-sm tracking-[0.3em] text-poe-gold">
          C.A.D.I.R.O.
        </span>
        <Link
          href="/login"
          className="border border-poe-gold/30 bg-poe-gold/5 px-5 py-2 font-display text-xs tracking-widest text-poe-gold transition-all duration-200 hover:border-poe-gold/60 hover:bg-poe-gold/10"
        >
          ENTER
        </Link>
      </nav>

      {/* ═══════════════════════════════ HERO ═══════════════════════════════ */}
      <section className="relative z-10 flex flex-col items-center px-6 pb-16 pt-20 md:pt-32">
        {/* Cadiro quote — sets the mood */}
        <p className="font-mono text-xs tracking-wider text-poe-text-muted">
          &quot;A fair bargain, exile. A fair bargain.&quot;
        </p>

        {/* Main title */}
        <h1 className="mt-8 text-center font-display text-4xl tracking-[0.15em] text-poe-gold md:text-6xl lg:text-7xl">
          <span className="cadiro-title inline-block">C.A.D.I.R.O.</span>
        </h1>

        {/* Subtitle - the acronym expanded */}
        <p className="mt-5 text-center font-display text-sm tracking-[0.2em] text-poe-text-dim md:text-base">
          Capture All Data, Identify Real Opportunities
        </p>

        {/* Description */}
        <p className="mt-6 max-w-md text-center text-sm leading-relaxed text-poe-text-dim md:text-base">
          The exile&apos;s toolkit for regex-powered item filtering,
          instant trade search, and map profit tracking.
        </p>

        {/* CTA */}
        <div className="mt-10 flex gap-4">
          <Link
            href="/login"
            className="group relative overflow-hidden bg-gradient-to-b from-poe-gold to-amber-800 px-8 py-3 font-display text-sm tracking-widest text-white shadow-lg shadow-poe-gold/20 transition-all duration-300 hover:shadow-poe-gold/40"
          >
            <span className="relative z-10">GET STARTED</span>
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </Link>
          <a
            href="#features"
            className="border border-poe-border px-8 py-3 font-display text-sm tracking-widest text-poe-text-dim transition-all duration-200 hover:border-poe-text-muted hover:text-poe-text"
          >
            LEARN MORE
          </a>
        </div>

        {/* Decorative line down */}
        <div className="mt-16 h-24 w-px bg-gradient-to-b from-poe-gold/40 to-transparent" aria-hidden="true" />
      </section>

      {/* ═══════════════════════════════ FEATURES ═══════════════════════════════ */}
      <section id="features" className="relative z-10 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-display text-xs tracking-[0.4em] text-poe-text-muted">
            WHAT AWAITS YOU
          </h2>

          <GoldDivider />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon="⚔️"
              title="Regex Filters"
              description="Create powerful regex patterns to match exactly the mods you need. Test them instantly against item text."
              rarity="unique"
            />
            <FeatureCard
              icon="💰"
              title="Trade Search"
              description="Turn your regex filters into pathofexile.com/trade queries. Find items in seconds, copy whisper with one click."
              rarity="currency"
            />
            <FeatureCard
              icon="🗺️"
              title="Map Cost Calculator"
              description="Track your investment per map — scarabs, fragments, currency. Know your profit before you even run the map."
              rarity="rare"
            />
            <FeatureCard
              icon="🌿"
              title="Strategy Sharing"
              description="Share your farming strategies with the community. Atlas passives, item filters, expected returns — all in one place."
              rarity="gem"
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ HOW IT WORKS ═══════════════════════════════ */}
      <section className="relative z-10 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center font-display text-xs tracking-[0.4em] text-poe-text-muted">
            THREE STEPS TO PROFIT
          </h2>

          <GoldDivider />

          <div className="flex flex-col items-center gap-8 md:flex-row md:justify-between">
            <StepIndicator
              step={1}
              title="Create Filters"
              description="Build regex patterns for the stats and mods you want"
            />

            {/* Arrow connector */}
            <div className="hidden h-px w-12 bg-gradient-to-r from-poe-gold/40 to-poe-gold/40 md:block" aria-hidden="true" />
            <div className="h-8 w-px bg-gradient-to-b from-poe-gold/40 to-poe-gold/40 md:hidden" aria-hidden="true" />

            <StepIndicator
              step={2}
              title="Search Trade"
              description="Instantly find matching items on the official trade site"
            />

            <div className="hidden h-px w-12 bg-gradient-to-r from-poe-gold/40 to-poe-gold/40 md:block" aria-hidden="true" />
            <div className="h-8 w-px bg-gradient-to-b from-poe-gold/40 to-poe-gold/40 md:hidden" aria-hidden="true" />

            <StepIndicator
              step={3}
              title="Track Profit"
              description="Know your return on investment for every map strategy"
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ COMMUNITY ═══════════════════════════════ */}
      <section className="relative z-10 px-6 py-20 md:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-6 h-px w-24 bg-gradient-to-r from-transparent via-poe-gold/40 to-transparent" aria-hidden="true" />

          <p className="font-display text-3xl tracking-wide text-poe-text md:text-4xl">
            <span className="text-poe-currency">2,847</span> exiles
          </p>
          <p className="mt-2 text-sm text-poe-text-dim">
            are already optimizing their maps with C.A.D.I.R.O.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-8">
            <div>
              <p className="font-display text-2xl text-poe-gold">14K+</p>
              <p className="text-xs text-poe-text-muted">filters created</p>
            </div>
            <div className="h-8 w-px bg-poe-border" aria-hidden="true" />
            <div>
              <p className="font-display text-2xl text-poe-gold">89K+</p>
              <p className="text-xs text-poe-text-muted">trade searches</p>
            </div>
            <div className="h-8 w-px bg-poe-border" aria-hidden="true" />
            <div>
              <p className="font-display text-2xl text-poe-gold">340+</p>
              <p className="text-xs text-poe-text-muted">shared strategies</p>
            </div>
          </div>

          <Link
            href="/login"
            className="mt-10 inline-block border border-poe-gold/40 bg-poe-gold/5 px-10 py-3 font-display text-sm tracking-widest text-poe-gold transition-all duration-200 hover:border-poe-gold/70 hover:bg-poe-gold/10"
          >
            JOIN THE EXILES
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════ FOOTER ═══════════════════════════════ */}
      <footer className="relative z-10 border-t border-poe-border/30 px-6 py-10 md:px-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 md:flex-row md:justify-between">
          <div className="flex items-center gap-3">
            <span className="font-display text-xs tracking-[0.3em] text-poe-gold/60">
              C.A.D.I.R.O.
            </span>
            <span className="text-xs text-poe-text-muted">
              &mdash; Not affiliated with Grinding Gear Games
            </span>
          </div>

          <div className="flex gap-6 text-xs text-poe-text-muted">
            <a href="#features" className="transition-colors hover:text-poe-text-dim">Features</a>
            <Link href="/login" className="transition-colors hover:text-poe-text-dim">Login</Link>
            <span className="cursor-default">GitHub</span>
          </div>
        </div>
      </footer>

      {/* Keyframe animations in a style tag (Next.js Server Component compatible) */}
      <style>{`
        @keyframes particle-float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.4; }
          50% { transform: translateY(-30px) scale(1.5); opacity: 0.8; }
        }

        .cadiro-title {
          background: linear-gradient(
            135deg,
            #AF6025 0%,
            #FFD700 40%,
            #AF6025 60%,
            #FFD700 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: gold-shimmer 4s linear infinite;
        }

        @keyframes gold-shimmer {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>
    </div>
  );
}
