import { Card, PanelBadge } from './ui';
import { LogEntry } from '../lib/types';
import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';

interface ProgressSectionProps {
  progressCount: number;
  totalCount: number;
  logs: LogEntry[];
}

export function ProgressSection({ progressCount, totalCount, logs }: ProgressSectionProps) {
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const percent = totalCount > 0 ? Math.round((progressCount / totalCount) * 100) : 0;

  return (
    <Card id="progress-section" className="mt-6 border-accent-yellow/50 shadow-[0_0_30px_rgba(232,186,94,0.1)]">
      <PanelBadge>Step 3 • Execution</PanelBadge>
      
      <div className="flex justify-between font-oswald text-accent-yellow mb-3">
        <span>Processing: {progressCount} / {totalCount}</span>
        <span>{percent}%</span>
      </div>
      
      <div className="w-full h-2 bg-white/10 rounded-sm overflow-hidden mb-6">
        <motion.div 
          className="h-full bg-success"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      <div 
        ref={terminalRef}
        className="bg-black border border-border p-4 h-[250px] overflow-y-auto font-mono text-[0.85rem] flex flex-col gap-1 shadow-inner custom-scrollbar"
      >
        {logs.map((log) => {
          let colorClass = 'text-text-secondary';
          if (log.type === 'success') colorClass = 'text-success';
          if (log.type === 'error') colorClass = 'text-danger';
          if (log.type === 'warn') colorClass = 'text-accent-yellow';

          return (
            <div key={log.id} className={`${colorClass} mb-1`}>
              <span className="opacity-70 mr-2">[{log.timestamp}]</span>
              {log.message}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
