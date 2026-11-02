// ABOUTME: Settings page shell with sidebar navigation for app configuration.
// ABOUTME: Left sidebar: section nav. Right content: section-specific settings panels.

import { useState } from 'react';
import { PoeIcon } from '@/components/ui/poe-icon';
import { useCurrencyDisplay } from '@/lib/stores/currency-display-store';

type SettingsSection = 'general' | 'stash-ignore' | 'about';

const SECTIONS: Array<{ id: SettingsSection; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'stash-ignore', label: 'Stash Ignore List' },
  { id: 'about', label: 'About' },
];

function GeneralSection() {
  const { unit, setUnit } = useCurrencyDisplay();

  return (
    <div className="space-y-4 p-6">
      <h2 className="mb-1 font-display text-sm tracking-wide text-poe-text-dim">General</h2>
      <div>
        <p className="mb-1 text-xs text-poe-text-dim">Show values in</p>
        <div className="flex" role="radiogroup" aria-label="Currency display unit">
          {(['divine', 'chaos'] as const).map((u) => (
            <button
              key={u}
              type="button"
              role="radio"
              aria-checked={unit === u}
              onClick={() => setUnit(u)}
              className={`flex items-center gap-1.5 border border-poe-border/30 px-3 py-1.5 text-xs capitalize transition-colors ${
                unit === u ? 'bg-poe-gold/15 text-poe-gold' : 'text-poe-text-dim hover:bg-poe-panel/40'
              }`}
            >
              <PoeIcon name={u} size={14} />
              {u}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StashIgnoreSection() {
  return (
    <div className="p-6">
      <h2 className="mb-1 font-display text-sm tracking-wide text-poe-text-dim">Stash Ignore List</h2>
      <p className="text-xs text-poe-text-muted">Configure items to hide from stash view.</p>
    </div>
  );
}

function AboutSection() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="mb-1 font-display text-sm tracking-wide text-poe-text-dim">About N.I.K.O.</h2>
        <p className="text-xs text-poe-text-muted">
          Desktop companion for Path of Exile 1 players. Regex filter builder, trade search,
          strategy cost calculator, atlas tree planner, and GGG account integration.
        </p>
      </div>

      {/* Developer */}
      <div className="space-y-3">
        <p className="text-xs text-poe-text-dim">
          Developed by <span className="text-poe-gold">Berk Bulgan</span> for Exiles
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="https://x.com/AbrahamBulgs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 items-center gap-1.5 border border-poe-border/30 px-2.5 text-xs text-poe-text-dim transition-colors hover:border-poe-gold/40 hover:text-poe-text"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            @AbrahamBulgs
          </a>
          <a
            href="https://github.com/berkbulgan"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 items-center gap-1.5 border border-poe-border/30 px-2.5 text-xs text-poe-text-dim transition-colors hover:border-poe-gold/40 hover:text-poe-text"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            berkbulgan
          </a>
          <a
            href="https://berkbulgan.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 items-center gap-1.5 border border-poe-border/30 px-2.5 text-xs text-poe-text-dim transition-colors hover:border-poe-gold/40 hover:text-poe-text"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
            </svg>
            berkbulgan.com
          </a>
          <a
            href="https://buymeacoffee.com/berkbulgan"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-opacity hover:opacity-80"
          >
            <img src="/bmc-button.svg" alt="Buy Me a Coffee" className="h-8" />
          </a>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="border-l-2 border-poe-gold/20 bg-poe-panel/20 px-4 py-3">
        <h3 className="mb-1.5 text-xs font-medium tracking-wide text-poe-text-dim">Legal Notice</h3>
        <p className="text-[11px] leading-relaxed text-poe-text-muted">
          This product isn&apos;t affiliated with or endorsed by Grinding Gear Games in any way.
        </p>
      </div>
    </div>
  );
}

export function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');

  return (
    <div className="-m-6 flex h-[calc(100%+3rem)] gap-0 overflow-hidden lg:-m-8 lg:h-[calc(100%+4rem)]">
      {/* Left sidebar */}
      <aside className="flex w-48 shrink-0 flex-col border-r border-poe-border/30 xl:w-56">
        <div className="border-b border-poe-border/20 px-3 py-3">
          <h2 className="text-sm font-semibold text-poe-text-dim">Settings</h2>
        </div>
        <nav className="mt-1 flex-1 space-y-px p-1" aria-label="Settings navigation">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={`w-full px-3 py-2 text-left text-sm transition-all duration-100 ${
                activeSection === section.id
                  ? 'border-l-2 border-poe-gold bg-poe-gold/8 text-poe-gold'
                  : 'border-l-2 border-transparent text-poe-text-dim hover:bg-poe-panel-light/30 hover:text-poe-text'
              }`}
            >
              {section.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Right content */}
      <main className="flex-1 overflow-y-auto">
        {activeSection === 'general' && <GeneralSection />}
        {activeSection === 'stash-ignore' && <StashIgnoreSection />}
        {activeSection === 'about' && <AboutSection />}
      </main>
    </div>
  );
}
