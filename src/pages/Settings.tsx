// ABOUTME: Settings page shell with sidebar navigation for app configuration.
// ABOUTME: Left sidebar: section nav. Right content: section-specific settings panels.

import { useState } from 'react';

type SettingsSection = 'general' | 'stash-ignore';

const SECTIONS: Array<{ id: SettingsSection; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'stash-ignore', label: 'Stash Ignore List' },
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

export function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');

  return (
    <div className="flex h-full gap-0 overflow-hidden">
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
      </main>
    </div>
  );
}
