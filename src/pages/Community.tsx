// ABOUTME: Community page — browse strategies published by other players and import them.
// ABOUTME: Left: search, filters and an infinitely scrolling list (or your published / favourites). Right: detail panel.

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { SimpleSelect } from '@/components/ui/select';
import { StrategyDetailPanel } from '@/components/community/strategy-detail';
import {
  useCommunityList,
  useCommunityServerUrl,
  useCommunityStrategies,
  useCommunityTags,
} from '@/lib/hooks/use-community';
import { useStrategies } from '@/lib/hooks/use-strategies';
import {
  getFavouriteIds,
  getPublishedIds,
  getTokenForCommunityId,
  importedStrategyId,
  isFavourited,
} from '@/lib/community-storage';
import { useLeague } from '@/lib/league-context';
import type { Budget, CommunitySort, Difficulty, StrategySummary } from '@/types/community';

type Show = 'all' | 'mine' | 'favourites';

const EMPTY_TEXT: Record<Show, string> = {
  all: 'No strategies found',
  mine: 'You have not published any strategies',
  favourites: 'No favourites yet',
};

function Marker({ children }: { children: React.ReactNode }) {
  return <span className="rounded border border-poe-gold/40 px-1 text-[10px] text-poe-gold">{children}</span>;
}

function StrategyCard({
  s,
  selected,
  imported,
  mine,
  onSelect,
}: {
  s: StrategySummary;
  selected: boolean;
  imported: boolean;
  mine: boolean;
  onSelect: () => void;
}) {
  const favourited = isFavourited(s.id);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full px-3 py-2 text-left transition-colors ${
        selected
          ? 'border-l-2 border-poe-gold bg-poe-gold/8'
          : 'border-l-2 border-transparent hover:bg-poe-panel-light/30'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm text-poe-text">{s.name}</span>
        {s.stats && (
          <span className="shrink-0 text-[11px] tabular-nums text-poe-gold">
            {s.stats.medianDivPerHour.toFixed(1)} div/hr
          </span>
        )}
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-poe-text-muted">
        <span className="truncate capitalize">
          {[s.authorName, `${s.budget} budget`, s.difficulty].filter(Boolean).join(' · ')}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <Star size={11} className={favourited ? 'fill-poe-currency text-poe-currency' : ''} /> {s.favouriteCount}
        </span>
      </div>
      {(imported || mine || s.tags.length > 0) && (
        <div className="mt-1 flex flex-wrap gap-1">
          {imported && <Marker>Imported</Marker>}
          {mine && <Marker>Mine</Marker>}
          {s.tags.map((t) => (
            <span key={t} className="rounded bg-poe-panel-light/50 px-1 text-[10px] text-poe-text-dim">{t}</span>
          ))}
        </div>
      )}
    </button>
  );
}

const BUDGETS: ReadonlyArray<{ value: Budget; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const DIFFICULTIES: ReadonlyArray<{ value: Difficulty; label: string }> = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

export function Community() {
  const { leagues, currentLeague } = useLeague();
  const server = useCommunityServerUrl();
  const configured = !!server.data;
  const { data: strategies } = useStrategies();

  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  // Starts on the active league once; changing the active league later leaves this filter alone.
  const [league, setLeague] = useState(currentLeague);
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState<CommunitySort>('new');
  const [budget, setBudget] = useState<Budget | ''>('');
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('');
  const [show, setShow] = useState<Show>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const showAll = show === 'all';

  // Debounce typing so every keystroke is not a request.
  useEffect(() => {
    const t = setTimeout(() => setQ(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Strategies links here with ?id=<communityId> to open that strategy, even when it is not in the loaded pages.
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedId = searchParams.get('id');
  useEffect(() => {
    if (!linkedId) return;
    setSelectedId(linkedId);
    setSearchParams({}, { replace: true });
  }, [linkedId, setSearchParams]);

  const list = useCommunityList(
    {
      q: q || undefined,
      tag: tag || undefined,
      league: league || undefined,
      budget: budget || undefined,
      difficulty: difficulty || undefined,
      sort,
    },
    configured && showAll,
  );
  const localIds = !configured || showAll ? [] : show === 'mine' ? getPublishedIds() : getFavouriteIds();
  const local = useCommunityStrategies(localIds);
  const tags = useCommunityTags(league || null, configured && showAll);

  // Load the next page when the sentinel below the list scrolls into view.
  // showAll is a dependency because the sentinel unmounts in the other modes and comes back as a new element.
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void fetchNextPage();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, showAll]);

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

  const needle = search.trim().toLowerCase();
  // A publish between page loads shifts the pages by one, so the same strategy can arrive twice; keep it once.
  const items: StrategySummary[] = showAll
    ? [...new Map((list.data?.pages.flatMap((p) => p.items) ?? []).map((s) => [s.id, s])).values()]
    : local.items.filter((s) => s.name.toLowerCase().includes(needle));
  const loading = showAll ? list.isLoading : local.isLoading;
  const error = showAll ? list.error : local.error;

  return (
    <div className="-m-6 flex h-[calc(100%+3rem)] gap-0 overflow-hidden lg:-m-8 lg:h-[calc(100%+4rem)]">
      <aside className="flex w-80 shrink-0 flex-col border-r border-poe-border/30 xl:w-96">
        <div className="space-y-2 border-b border-poe-border/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-poe-text-dim">Community Strategies</h2>
            <SimpleSelect
              className="w-36"
              value={show}
              onValueChange={(v) => setShow(v as Show)}
              options={[
                { value: 'all', label: 'All' },
                { value: 'mine', label: 'My published' },
                { value: 'favourites', label: 'Favourites' },
              ]}
              size="sm"
              aria-label="Show"
            />
          </div>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name..." className="h-8 text-xs" />
          <div className="flex gap-2">
            <SimpleSelect
              className="flex-1"
              value={league}
              onValueChange={(v) => { setLeague(v); setTag(''); }}
              options={[{ value: '', label: 'All leagues' }, ...leagues.map((l) => ({ value: l.id, label: l.text }))]}
              size="sm"
              disabled={!showAll}
              aria-label="League"
            />
            <SimpleSelect
              value={sort}
              onValueChange={(v) => setSort(v as CommunitySort)}
              options={[
                { value: 'new', label: 'Newest' },
                { value: 'favourites', label: 'Most favourited' },
                { value: 'profit', label: 'Most profitable' },
              ]}
              size="sm"
              disabled={!showAll}
              aria-label="Sort"
            />
          </div>
          <ChipRow label="Budget" options={BUDGETS} value={budget} onChange={setBudget} disabled={!showAll} />
          <ChipRow label="Difficulty" options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} disabled={!showAll} />
          {tags.data && tags.data.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.data.map((t) => (
                <button
                  key={t.tag}
                  type="button"
                  onClick={() => setTag(tag === t.tag ? '' : t.tag)}
                  disabled={!showAll}
                  aria-pressed={tag === t.tag}
                  className={`rounded px-1.5 py-0.5 text-[11px] transition-colors disabled:opacity-50 ${
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
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : error ? (
            <p className="p-4 text-xs text-poe-error">{error.message}</p>
          ) : items.length === 0 ? (
            <p className="p-4 text-center text-sm text-poe-text-dim">{EMPTY_TEXT[show]}</p>
          ) : (
            <ul className="space-y-px p-1">
              {items.map((s) => (
                <li key={s.id}>
                  <StrategyCard
                    s={s}
                    selected={selectedId === s.id}
                    imported={importedStrategyId(s.id, strategies ?? []) !== null}
                    mine={getTokenForCommunityId(s.id) !== null}
                    onSelect={() => setSelectedId(s.id)}
                  />
                </li>
              ))}
            </ul>
          )}
          {showAll && <div ref={sentinel} className="h-px" />}
          {showAll && isFetchingNextPage && <div className="flex justify-center py-3"><Spinner size="sm" /></div>}
        </div>
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

/** One-of toggle chips; clicking the active chip clears the filter. */
function ChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T | '';
  onChange: (value: T | '') => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <span className="w-14 shrink-0 text-[11px] text-poe-text-muted">{label}</span>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(value === o.value ? '' : o.value)}
          aria-pressed={value === o.value}
          className={`rounded px-1.5 py-0.5 text-[11px] transition-colors disabled:pointer-events-none disabled:opacity-50 ${
            value === o.value ? 'bg-poe-gold/20 text-poe-gold' : 'bg-poe-panel-light/50 text-poe-text-dim hover:text-poe-text'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
