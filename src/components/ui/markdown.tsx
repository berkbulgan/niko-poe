// ABOUTME: Safe markdown renderer for user-written notes (community strategies).
// ABOUTME: Raw HTML and images are dropped; links open in the system browser.

import ReactMarkdown from 'react-markdown';
import { openExternal } from '@/lib/platform';
import { cn } from '@/lib/utils';

interface MarkdownProps {
  children: string;
  className?: string;
}

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={cn('prose prose-sm prose-invert max-w-none prose-a:text-poe-gold', className)}>
      <ReactMarkdown
        skipHtml
        disallowedElements={['img']}
        components={{
          a: ({ href, children: label }) => (
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault();
                if (href && /^https?:\/\//.test(href)) void openExternal(href);
              }}
            >
              {label}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
