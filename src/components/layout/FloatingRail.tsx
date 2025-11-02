import React, { useEffect, useState } from 'react';
import { Menu, Bookmark, Clock, X as XIcon, Home as HomeIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RecentPanel from './RecentPanel';
import SavedPanel from './SavedPanel';

export default function FloatingRail() {
  const [open, setOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'recent' | 'saved'>('recent');
  const navigate = useNavigate();

  const togglePanel = (tab: 'recent' | 'saved') => {
    if (open && activeTab === tab) {
      setOpen(false);
    } else {
      setActiveTab(tab);
      setOpen(true);
      // Tell panels to refresh when opened so they pick up latest storage/API state
      try {
        window.dispatchEvent(new CustomEvent('map:sidebarRefresh'));
      } catch (err) {
        // ignore
      }
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Listen for external sidebar control events (dispatched by Header or app)
  useEffect(() => {
    const onOpen = (e: Event) => {
      try {
        const detail = (e as CustomEvent<{ tab?: 'recent' | 'saved' }>).detail || {};
        if (detail.tab) setActiveTab(detail.tab);
        setOpen(true);
        // refresh panels
        window.dispatchEvent(new CustomEvent('map:sidebarRefresh'));
      } catch (err) {
        // ignore
      }
    };
    const onClear = () => setOpen(false);
    window.addEventListener('map:sidebarOpen', onOpen as EventListener);
    window.addEventListener('map:sidebarClear', onClear as EventListener);
    return () => {
      window.removeEventListener('map:sidebarOpen', onOpen as EventListener);
      window.removeEventListener('map:sidebarClear', onClear as EventListener);
    };
  }, []);

  return (
    <>
      <div
        onClick={() => togglePanel('recent')}
        className="fixed left-0 top-0 z-40 h-full w-20 bg-white shadow-lg flex flex-col justify-between border-r border-neutral-100"
        role="navigation"
        aria-label="Map rail"
      >
        <div className="pt-6 flex flex-col items-center gap-4">
          <div className="group relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePanel('recent');
              }}
              className="p-2 rounded-md hover:bg-neutral-100 transition flex items-center justify-center w-10 h-10"
              aria-label="Menu"
            >
              <Menu size={22} />
            </button>
            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-neutral-900 text-white text-sm px-3 py-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Menu</div>
          </div>

          <div className="flex flex-col items-center gap-4 mt-3">
            <div className="group relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/');
                }}
                className="flex flex-col items-center text-sm text-neutral-700 hover:text-primary-700"
                aria-label="Home"
              >
                <div className="bg-neutral-50 p-2 rounded-md w-10 h-10 flex items-center justify-center">
                  <HomeIcon size={20} />
                </div>
                <span className="mt-2 text-xs font-medium text-neutral-700">Home</span>
              </button>
            </div>

            <div className="group relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePanel('saved');
                }}
                className={`flex flex-col items-center text-sm ${activeTab === 'saved' ? 'text-primary-700 font-semibold' : 'text-neutral-700'}`}
                aria-label="Saved"
              >
                <div className={`${activeTab === 'saved' ? 'bg-primary-600 text-white' : 'bg-neutral-50 text-neutral-700'} p-2 rounded-md w-10 h-10 flex items-center justify-center`}>
                  <Bookmark size={18} />
                </div>
                <span className={`mt-2 text-xs font-medium ${activeTab === 'saved' ? 'text-primary-700' : 'text-neutral-600'}`}>Saved</span>
              </button>
            </div>

            <div className="group relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePanel('recent');
                }}
                className={`flex flex-col items-center text-sm ${activeTab === 'recent' ? 'text-primary-700 font-semibold' : 'text-neutral-700'}`}
                aria-label="Recents"
              >
                <div className={`${activeTab === 'recent' ? 'bg-primary-600 text-white' : 'bg-neutral-50 text-neutral-700'} p-2 rounded-md w-10 h-10 flex items-center justify-center`}>
                  <Clock size={18} />
                </div>
                <span className={`mt-2 text-xs font-medium ${activeTab === 'recent' ? 'text-primary-700' : 'text-neutral-600'}`}>Recents</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <aside className={`fixed left-20 top-0 h-full w-[min(92vw,460px)] max-w-[460px] bg-white shadow-2xl border-r border-neutral-100 transform transition-all duration-300 ${
        open ? 'translate-x-0 pointer-events-auto z-50 visible opacity-100' : '-translate-x-full pointer-events-none z-30 invisible opacity-0'
      }`} aria-hidden={!open}>
        <div className="px-6 pt-5 pb-2 border-b bg-white">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-medium">{activeTab === 'recent' ? 'Recent Visits' : 'Saved Items'}</h2>
            <button onClick={() => setOpen(false)} className="p-2 rounded hover:bg-neutral-100" aria-label="Close sidebar">
              <XIcon size={20} />
            </button>
          </div>
        </div>

        <div className={`px-6 py-4 overflow-y-auto h-[calc(100vh-6.5rem)] transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}>
          {activeTab === 'recent' ? <RecentPanel /> : <SavedPanel />}
        </div>
      </aside>
    </>
  );
}
