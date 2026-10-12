import React, { useState, useEffect } from 'react';
import { Search, X, MessageSquare, Clock, ArrowRight } from 'lucide-react';
import { searchConversations } from '../services/api';

export function SearchModal({ isOpen, onClose, onSelectConversation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const data = await searchConversations(query.trim());
        setResults(data.results || []);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header / Input */}
        <div className="p-4 border-b border-slate-800 flex items-center space-x-3 bg-slate-950/60">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversation titles and message contents..."
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isSearching ? (
            <div className="p-8 text-center text-xs text-slate-400">Searching MongoDB...</div>
          ) : query && results.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No conversations found matching "{query}".
            </div>
          ) : !query ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Type keywords to search across all your saved conversations and messages.
            </div>
          ) : (
            results.map((res) => (
              <button
                key={res._id}
                onClick={() => {
                  onSelectConversation(res._id);
                  onClose();
                }}
                className="w-full text-left p-3 rounded-xl bg-slate-950/50 hover:bg-slate-800/80 border border-slate-850 hover:border-blue-500/40 transition flex items-start space-x-3 group"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-semibold text-slate-200 truncate group-hover:text-blue-300 transition">
                      {res.title}
                    </h4>
                    <span className="text-[10px] text-slate-400 flex items-center space-x-1 shrink-0 ml-2">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(res.updatedAt).toLocaleDateString()}</span>
                    </span>
                  </div>
                  {res.snippet && (
                    <p className="text-xs text-slate-400 line-clamp-2 italic">
                      "...{res.snippet}..."
                    </p>
                  )}
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition self-center shrink-0" />
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950/60 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between">
          <span>{results.length} conversation(s) matched</span>
          <span>Press ESC to close</span>
        </div>
      </div>
    </div>
  );
}
