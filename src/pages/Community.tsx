// ABOUTME: Community page — browse strategies published by other players and import them.
// ABOUTME: Left: search, filters and results. Right: detail panel for the selected strategy.

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { StrategyDetailPanel } from '@/components/community/strategy-detail';
import { useCommunityList, useCommunityServerUrl, useCommunityTags } from '@/lib/hooks/use-community';
import { useLeague } from '@/lib/league-context';
import type { CommunitySort } from '@/types/community';
import { SimpleSelect } from '@/components/ui/select';

const PAGE_SIZE = 20;

export function Community() {
  const { leagues } = useLeague();
  const server = useCommunityServerUrl();
  const configured = !!server.data;

  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [league, setLeague] = useState('');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState<CommunitySort>('new');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Debounce typing so every keystroke is not a request.
  useEffect(() => {
    const t = setTimeout(() => { setQ(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const list = useCommunityList(
    { q: q || undefined, tag: tag || undefined, league: league || undefined, sort, page, limit: PAGE_SIZE },
    configured,
  );
  const tags = useCommunityTags(league || null, configured);
  const pages = Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE));

  if (server.isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (!configured) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h2 className="text-sm font-semibold text-poe-text-dim">Community server not configured</h2>
        <p className="mt-2 text-xs text-poe-text-muted">
          This build has no community server.
        </p>
      </div>
    );
  }

  function filter(update: () => void) {
    update();
    setPage(1);
  }

  return (
    <div className="-m-6 flex h-[calc(100%+3rem)] gap-0 overflow-hidden lg:-m-8 lg:h-[calc(100%+4rem)]">
      <aside className="flex w-80 shrink-0 flex-col border-r border-poe-border/30 xl:w-96">
        <div className="space-y-2 border-b border-poe-border/20 p-3">
          <h2 className="text-sm font-semibold text-poe-text-dim">Community Strategies</h2>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name..." className="h-8 text-xs" />
          <div className="flex gap-2">
            <SimpleSelect
              className="flex-1"
              value={league}
              onValueChange={(v) => filter(() => { setLeague(v); setTag(''); })}
              options={[{ value: '', label: 'All leagues' }, ...leagues.map((l) => ({ value: l.id, label: l.text }))]}
              size="sm"
              aria-label="League"
            />
            <SimpleSelect
              value={sort}
              onValueChange={(v) => filter(() => setSort(v as CommunitySort))}
              options={[
                { value: 'new', label: 'Newest' },
                { value: 'favourites', label: 'Most favourited' },
                { value: 'profit', label: 'Most profitable' },
              ]}
              size="sm"
              aria-label="Sort"
            />
          </div>
          {tags.data && tags.data.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.data.map((t) => (
                <button
                  key={t.tag}
                  type="button"
                  onClick={() => filter(() => setTag(tag === t.tag ? '' : t.tag))}
                  aria-pressed={tag === t.tag}
                  className={`rounded px-1.5 py-0.5 text-[11px] transition-colors ${
                    tag === t.tag ? 'bg-poe-gold/20 text-poe-gold' : 'bg-poe-panel-light/50 text-poe-text-dim hover:text-poe-text'
                  }`}
                >
                  {t.tag} <span className="text-poe-text-muted">{t.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {list.isLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : list.isError ? (
            <p className="p-4 text-xs text-poe-error">{list.error.message}</p>
          ) : list.data?.items.length === 0 ? (
            <p className="p-4 text-center text-sm text-poe-text-dim">No strategies found</p>
          ) : (
            <ul className="space-y-px p-1">
              {list.data?.items.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={`w-full px-3 py-2 text-left transition-colors ${
                      selectedId === s.id
                        ? 'border-l-2 border-poe-gold bg-poe-gold/8'
                        : 'border-l-2 border-transparent hover:bg-poe-panel-light/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-poe-text">{s.name}</span>
                      <span className="flex shrink-0 items-center gap-1 text-[11px] text-poe-text-muted">
                        <Star size={11} /> {s.favouriteCount}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] capitalize text-poe-text-muted">
                      {[s.authorName, s.league, `${s.budget} budget`, s.difficulty, ...s.tags].filter(Boolean).join(' · ')}
                    </p>
                    {s.stats && (
                      <p className="mt-0.5 text-[11px] tabular-nums text-poe-gold">
                        {s.stats.medianDivPerHour.toFixed(1)} div/hr · {s.stats.runs} runs · {s.stats.players} players
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-poe-border/20 px-3 py-2 text-xs text-poe-text-muted">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
            <span>{page} / {pages}</span>
            <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-y-auto">
        {selectedId ? (
          <StrategyDetailPanel id={selectedId} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-poe-text-muted">
            Select a strategy to preview it
          </div>
        )}
      </main>
    </div>
  );
}
