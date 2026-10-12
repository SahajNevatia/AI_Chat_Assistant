import React from 'react';
import { Sparkles, Code2, BookOpen, Lightbulb, MessageSquare } from 'lucide-react';

const SUGGESTIONS = [
  {
    icon: Code2,
    title: 'Code Architecture',
    prompt: 'Compare React Server Components with traditional SSR and list key architectural trade-offs.',
  },
  {
    icon: Lightbulb,
    title: 'Product Strategy',
    prompt: 'Draft a product launch checklist for an AI-powered SaaS application.',
  },
  {
    icon: BookOpen,
    title: 'Technical Explanation',
    prompt: 'Explain how Server-Sent Events work under the hood compared to WebSockets.',
  },
  {
    icon: MessageSquare,
    title: 'Executive Summary',
    prompt: 'Write an executive brief explaining the benefits of adopting MongoDB with schema design patterns.',
  },
];

export function EmptyState({ onSelectSuggestion, selectedTone }) {
  return (
    <div className="max-w-2xl w-full text-center py-8 px-4 flex flex-col items-center">
      {/* Hero Badge */}
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20 mb-5">
        <Sparkles className="w-7 h-7" />
      </div>

      <h2 className="text-2xl font-bold text-slate-100 tracking-tight mb-2">
        How can I help you today?
      </h2>
      <p className="text-sm text-slate-400 max-w-md mb-8">
        Currently operating in <span className="text-blue-400 font-semibold">{selectedTone}</span> mode.
        Ask anything, generate code, or explore ideas with real-time streaming.
      </p>

      {/* Suggestion Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
        {SUGGESTIONS.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={index}
              onClick={() => onSelectSuggestion(item.prompt)}
              className="group p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-850 hover:shadow-lg hover:shadow-blue-500/5 transition-all text-left flex flex-col justify-between"
            >
              <div className="flex items-center space-x-2 text-blue-400 mb-2">
                <Icon className="w-4 h-4" />
                <span className="text-xs font-semibold text-slate-200">
                  {item.title}
                </span>
              </div>
              <p className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors line-clamp-2">
                "{item.prompt}"
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
