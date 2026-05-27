'use client';

import { LogEntry } from '@/engine/types';
import { useEffect, useRef, useCallback } from 'react';

const TYPE_COLORS: Record<string, string> = {
  move: 'text-jade-light',
  action: 'text-amber-100',
  event: 'text-vermillion-light',
  dialogue: 'text-bronze-light',
  system: 'text-amber-200/50',
  relation: 'text-vermillion',
};

function isNearBottom(el: HTMLDivElement): boolean {
  return el.scrollTop + el.clientHeight >= el.scrollHeight - 50;
}

export default function LogStream({ log }: { log: LogEntry[] }) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const wasNearBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      wasNearBottomRef.current = isNearBottom(el);
    }
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el && wasNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [log]);

  return (
    <div>
      <h3 className="text-sm font-bold text-amber-100 mb-2">事件日志</h3>
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="space-y-1 max-h-64 overflow-y-auto"
      >
        {log.slice(-50).map((entry) => (
          <div key={entry.id ?? `${entry.tick}-${entry.description}`} className="log-entry text-sm">
            <span className={`${TYPE_COLORS[entry.type] ?? 'text-amber-200/60'} leading-relaxed`}>
              {entry.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}