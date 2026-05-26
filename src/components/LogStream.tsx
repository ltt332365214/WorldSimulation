'use client';

import { LogEntry } from '@/engine/types';
import { useEffect, useRef } from 'react';

const TYPE_COLORS: Record<string, string> = {
  move: 'text-jade-light',
  action: 'text-amber-100',
  event: 'text-vermillion-light',
  dialogue: 'text-bronze-light',
  system: 'text-amber-200/50',
  relation: 'text-vermillion',
};

export default function LogStream({ log }: { log: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [log]);

  return (
    <div>
      <h3 className="text-sm font-bold text-amber-100 mb-2">事件日志</h3>
      <div ref={ref} className="space-y-1 max-h-64 overflow-y-auto">
        {log.slice(-50).map((entry, idx) => (
          <div key={idx} className="log-entry text-sm">
            <span className={`${TYPE_COLORS[entry.type] ?? 'text-amber-200/60'} leading-relaxed`}>
              {entry.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}