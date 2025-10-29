import { useEffect, useState } from 'react';
import MapControlsPanel from './MapControlsPanel';
import RecentPanel from './RecentPanel';
import SavedPanel from './SavedPanel';
// Link removed: panels are self-contained

// The individual panels read from localStorage directly.

type TabKey = 'recent' | 'saved' | 'map';

export default function MapSidebarContent() {
  // panels handle their own data; this container only switches between them
    const [activeTab, setActiveTab] = useState<TabKey | null>(null);
  const [query, setQuery] = useState('');

  // Panels manage and read their own localStorage data. This container only switches tabs.

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ tab?: TabKey }>).detail;
      if (detail?.tab) setActiveTab(detail.tab);
      // notify panels they may refresh if needed
      window.dispatchEvent(new CustomEvent('map:sidebarRefresh'));
    };
    window.addEventListener('map:sidebarOpen', onOpen as EventListener);
    return () => window.removeEventListener('map:sidebarOpen', onOpen as EventListener);
  }, []);

  // If nothing has set an active tab yet, and we're on the map route, default to 'map'
  useEffect(() => {
    if (!activeTab && window.location.pathname.startsWith('/map')) {
      setActiveTab('map');
    }
  }, [activeTab]);

  // panels handle clearing their own data

    return (
      <div className="h-full flex flex-col">
        <div className="sticky top-0 bg-white z-10 py-2">
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search places, dishes or restaurants"
              className="w-full input input-sm input-ghost"
              aria-label="Search sidebar"
            />
          </div>
        </div>

        <div className="overflow-y-auto py-2 px-1">
          {activeTab === 'map' && <MapControlsPanel />}
          {activeTab === 'recent' && <RecentPanel />}
          {activeTab === 'saved' && <SavedPanel />}
        </div>
      </div>
    );
  }
