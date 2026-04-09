// ABOUTME: Settings page shell with sidebar navigation for app configuration.
// ABOUTME: Left sidebar: section nav. Right content: section-specific settings panels.

import { useState } from 'react';

type SettingsSection = 'general' | 'stash-ignore' | 'about';

const SECTIONS: Array<{ id: SettingsSection; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'stash-ignore', label: 'Stash Ignore List' },
  { id: 'about', label: 'About' },
];

function GeneralSection() {
  return (
    <div className="p-6">
      <h2 className="mb-1 font-display text-sm tracking-wide text-poe-text-dim">General</h2>
      <p className="text-xs text-poe-text-muted">Settings coming soon.</p>
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
