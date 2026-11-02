// ABOUTME: Markdown textarea with Write/Preview tabs and a small formatting toolbar.
// ABOUTME: Toolbar buttons wrap the selection (or insert a placeholder) and keep focus in the textarea.

import { useRef, useState } from 'react';
import { Markdown } from '@/components/ui/markdown';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
}

type Format = { label: string; title: string; before: string; after: string; fallback: string };

const FORMATS: Format[] = [
  { label: 'B', title: 'Bold', before: '**', after: '**', fallback: 'bold text' },
  { label: 'H', title: 'Heading', before: '\n## ', after: '\n', fallback: 'Heading' },
  { label: '•', title: 'List item', before: '\n- ', after: '', fallback: 'item' },
  { label: 'Link', title: 'Link', before: '[', after: '](https://)', fallback: 'link text' },
];

export function MarkdownEditor({ value, onChange, maxLength, placeholder }: MarkdownEditorProps) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const ref = useRef<HTMLTextAreaElement>(null);

  function apply(format: Format) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const selected = value.slice(start, end) || format.fallback;
    const next = value.slice(0, start) + format.before + selected + format.after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const from = start + format.before.length;
      el.setSelectionRange(from, from + selected.length);
    });
  }

  const tabClass = (active: boolean) =>
    `px-3 py-1.5 text-xs transition-colors ${active ? 'text-poe-gold' : 'text-poe-text-dim hover:text-poe-text'}`;

  return (
    <div className="rounded-md border border-poe-border bg-poe-panel">
      <div className="flex items-center justify-between border-b border-poe-border/50 px-1">
        <div className="flex" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'write'} className={tabClass(tab === 'write')} onClick={() => setTab('write')}>
            Write
          </button>
          <button type="button" role="tab" aria-selected={tab === 'preview'} className={tabClass(tab === 'preview')} onClick={() => setTab('preview')}>
            Preview
          </button>
        </div>
        {tab === 'write' && (
          <div className="flex gap-0.5">
            {FORMATS.map((f) => (
              <button
                key={f.title}
                type="button"
                title={f.title}
                aria-label={f.title}
                onClick={() => apply(f)}
                className="rounded px-2 py-1 text-xs text-poe-text-dim hover:bg-poe-panel-light hover:text-poe-text"
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {tab === 'write' ? (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          placeholder={placeholder}
          rows={8}
          className="block w-full resize-y bg-transparent px-3 py-2 font-mono text-xs text-poe-text placeholder:text-poe-text-muted focus:outline-none"
        />
      ) : (
        <div className="min-h-[9rem] px-3 py-2">
          {value.trim() ? <Markdown>{value}</Markdown> : <p className="text-xs text-poe-text-muted">Nothing to preview.</p>}
        </div>
      )}
      {maxLength && (
        <p className="border-t border-poe-border/50 px-3 py-1 text-right text-[11px] text-poe-text-muted">
          {value.length} / {maxLength}
        </p>
      )}
    </div>
  );
}
