import { Link } from 'react-router-dom';
import { Search, Layers, MapPin, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { useState } from 'react';

export default function MapControlsPanel() {
  const [opacity, setOpacity] = useState<number>(1);
  const [tilesOn, setTilesOn] = useState<boolean>(true);
  const [locating, setLocating] = useState<boolean>(false);

  const handleOpacity = (v: number) => {
    setOpacity(v);
    window.dispatchEvent(new CustomEvent('map:setOpacity', { detail: { opacity: v } }));
  };

  const toggleTiles = () => {
    const next = !tilesOn;
    setTilesOn(next);
    window.dispatchEvent(new CustomEvent('map:toggleTile', { detail: { enabled: next } }));
  };

  const handleLocate = () => {
    setLocating(true);
    window.dispatchEvent(new CustomEvent('map:locate'));
    // brief UI feedback — map will manage actual locate state
    setTimeout(() => setLocating(false), 1200);
  };

  const zoom = (delta: number) => {
    window.dispatchEvent(new CustomEvent('map:zoomDelta', { detail: { delta } }));
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Navigate</h3>
        <div className="mt-2 flex flex-col gap-2 text-sm">
          <Link to="/map" className="font-medium">Explore map</Link>
          <Link to="/restaurants" className="font-medium">Restaurants</Link>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('header:openSearch'))}
            className="text-left text-neutral-700 flex items-center gap-2"
            aria-label="Open search"
          >
            <Search size={14} />
            <span>Search</span>
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold">Map controls</h3>
        <div className="mt-2 flex flex-col gap-3 text-sm">
          <div>
            <label className="text-xs text-neutral-500 block mb-1">Layer opacity — {(opacity * 100).toFixed(0)}%</label>
            <input
              aria-label="Set layer opacity"
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => handleOpacity(Number(e.currentTarget.value))}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={toggleTiles}
              className={`px-3 py-1 rounded-md text-sm ${tilesOn ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-800'}`}
              aria-pressed={tilesOn}
              title={tilesOn ? 'Using primary tiles' : 'Using alternate tiles'}
            >
              <Layers size={14} className="inline-block mr-2" />
              {tilesOn ? 'Tiles: On' : 'Tiles: Off'}
            </button>

            <button
              onClick={handleLocate}
              className={`px-3 py-1 rounded-md text-sm ${locating ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-800'}`}
              aria-pressed={locating}
              title="Center map on your location"
            >
              <MapPin size={14} className="inline-block mr-2" />
              {locating ? 'Locating…' : 'Locate'}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => zoom(1)}
              className="px-3 py-1 rounded-md bg-neutral-100 text-neutral-800 text-sm"
              aria-label="Zoom in"
            >
              <ZoomIn size={14} className="inline-block mr-2" />
              Zoom in
            </button>
            <button
              onClick={() => zoom(-1)}
              className="px-3 py-1 rounded-md bg-neutral-100 text-neutral-800 text-sm"
              aria-label="Zoom out"
            >
              <ZoomOut size={14} className="inline-block mr-2" />
              Zoom out
            </button>
          </div>

          <div>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('map:reset'))}
              className="text-sm text-neutral-700 flex items-center gap-2"
              aria-label="Reset map view"
            >
              <RefreshCw size={14} />
              Reset view
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
