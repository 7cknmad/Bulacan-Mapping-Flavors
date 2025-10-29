import React, { useMemo } from 'react';
import { useRecentVisits, type RecentVisit } from '../../hooks/useRecentVisits';
import { AnimatePresence, motion } from 'framer-motion';

interface RecentVisitsProps {
  onSelect: (visit: RecentVisit) => void;
  className?: string;
}

const RecentVisitsPanel: React.FC<RecentVisitsProps> = ({ onSelect, className = '' }) => {
  const { recentVisits, removeVisit, clearVisits } = useRecentVisits();

  const groupedVisits = useMemo(() => {
    const now = Date.now();
    return recentVisits.map(visit => ({
      ...visit,
      timeAgo: formatTimeAgo(now - visit.timestamp)
    }));
  }, [recentVisits]);

  if (!recentVisits.length) return null;

  return (
    <div className={`bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 text-sm ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-neutral-800">Recent Places</h3>
        <button
          onClick={() => clearVisits()}
          className="text-xs text-neutral-500 hover:text-neutral-700"
          aria-label="Clear all recent places"
        >
          Clear
        </button>
      </div>
      <AnimatePresence mode="sync">
        {groupedVisits.map((visit) => (
          <motion.div
            key={visit.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="relative group"
          >
            <button
              onClick={() => onSelect(visit)}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-primary-50 transition-colors flex items-start gap-2"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-neutral-800 truncate">{visit.name}</div>
                {visit.municipalityName && (
                  <div className="text-xs text-neutral-500 truncate">{visit.municipalityName}</div>
                )}
                <div className="text-xs text-neutral-400">{visit.timeAgo}</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeVisit(visit.id); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-red-500"
                aria-label={`Remove ${visit.name} from recent places`}
              >
                ×
              </button>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

function formatTimeAgo(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

export default RecentVisitsPanel;