import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchIcon, XIcon } from 'lucide-react';
import { SearchResult } from '../../types';
import { mockSearchResults } from '../../data/mockData';
interface SearchBarProps {
  onClose?: () => void;
  compact?: boolean;
}
const SearchBar: React.FC<SearchBarProps> = ({
  onClose,
  compact = false
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node) && inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  useEffect(() => {
    const searchItems = async () => {
      if (query.trim().length === 0) {
        setResults([]);
        return;
      }
      setIsLoading(true);
      // Simulate API call with setTimeout
      setTimeout(() => {
        const filteredResults = mockSearchResults.filter(item => item.name.toLowerCase().includes(query.toLowerCase()) || item.description.toLowerCase().includes(query.toLowerCase()));
        setResults(filteredResults);
        setIsLoading(false);
      }, 300);
    };
    // Debounce search
    const timeoutId = setTimeout(() => {
      searchItems();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [query]);
  const handleResultClick = (result: SearchResult) => {
    switch (result.type) {
      case 'dish':
        navigate(`/dish/${result.id}`);
        break;
      case 'restaurant':
        navigate(`/restaurant/${result.id}`);
        break;
      case 'municipality':
        navigate(`/map?municipality=${result.id}`);
        break;
    }
    setQuery('');
    setResults([]);
    if (onClose) onClose();
  };
  return <div className={`relative ${compact ? 'w-full' : 'w-full'}`}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <SearchIcon size={18} className="text-neutral-500" />
        </div>
        <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)} onFocus={() => setIsFocused(true)} className="w-full pl-10 pr-10 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-300" placeholder="Search dishes, restaurants, or municipalities..." />
        {query && <button className="absolute inset-y-0 right-0 pr-3 flex items-center" onClick={() => setQuery('')} aria-label="Clear search">
            <XIcon size={18} className="text-neutral-500" />
          </button>}
      </div>
      {/* Results dropdown */}
      {isFocused && (query || results.length > 0) && <div ref={resultsRef} className="absolute mt-1 w-full bg-white rounded-md shadow-lg z-10 max-h-96 overflow-y-auto">
          {isLoading ? <div className="p-4 text-center text-neutral-500">Searching...</div> : results.length > 0 ? <ul className="py-1">
              {results.map(result => <li key={`${result.type}-${result.id}`}>
                  <button className="w-full text-left px-4 py-2 hover:bg-neutral-100 flex items-center" onClick={() => handleResultClick(result)}>
                    <img src={result.image} alt={result.name} className="w-10 h-10 object-cover rounded-md mr-3" />
                    <div>
                      <div className="font-medium">{result.name}</div>
                      <div className="text-xs text-neutral-500 capitalize">
                        {result.type}
                      </div>
                    </div>
                  </button>
                </li>)}
            </ul> : query ? <div className="p-4 text-center text-neutral-500">
              No results found
            </div> : null}
        </div>}
    </div>;
};
export default SearchBar;