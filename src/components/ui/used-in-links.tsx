// ABOUTME: "Used in A, B" line for filter preset and atlas tree sidebar cards.
// ABOUTME: Each strategy name links to /strategies?strategy=<id>, which opens that strategy.

import { Fragment } from 'react';
import { Link } from 'react-router-dom';

export function UsedInLinks({ strategies }: { strategies: Array<{ id: string; name: string }> }) {
  return (
    <p className="truncate text-xs text-poe-text-muted">
      Used in{' '}
      {strategies.map((s, i) => (
        <Fragment key={s.id}>
          {i > 0 && ', '}
          <Link to={`/strategies?strategy=${s.id}`} className="hover:text-poe-gold">
            {s.name}
          </Link>
        </Fragment>
      ))}
    </p>
  );
}
