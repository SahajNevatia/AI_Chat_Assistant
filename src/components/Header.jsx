import React from 'react';
import {
  Menu,
  Briefcase,
  Smile,
  Zap,
  Sparkles,
  Bot,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export const TONE_OPTIONS = [
  { id: 'Professional', label: 'Professional', icon: Briefcase, desc: 'Structured & formal' },
  { id: 'Casual', label: 'Casual', icon: Smile, desc: 'Friendly & conversational' },
  { id: 'Concise', label: 'Concise', icon: Zap, desc: 'Direct & to the point' },
];

export function Header({
  activeConversation,
  selectedTone,
  onToneChange,
  selectedProvider,
  onProviderChange,
  providerStatus,
  onToggleSidebar,
  isStreaming,
}) {
  const currentProviderInfo = providerStatus?.providers?.[selectedProvider] || {
    available: false,
    defaultModel: 'default',
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-4 flex items-center justify-between z-10 select-none">
      {/* Left: Mobile hamburger & Chat title */}
      <div className="flex items-center space-x-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition lg:hidden"
          title="Toggle conversation list"
          aria-label="Toggle conversation list"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2 truncate">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="truncate">
            <h1 className="text-sm font-semibold text-slate-100 truncate">
              {activeConversation?.title || 'New Conversation'}
            </h1>
            <p className="text-xs text-slate-400 hidden sm:block">
              {activeConversation ? `${activeConversation.messages?.length || 0} messages` : 'Ready to assist'}
            </p>
          </div>
        </div>
      </div>

      {/* Right: Controls (Tone selector + Provider selector) */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Tone Selector: Exactly 3 options */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          {TONE_OPTIONS.map((tone) => {
            const Icon = tone.icon;
            const isSelected = selectedTone === tone.id;
            return (
              <button
                key={tone.id}
                type="button"
                disabled={isStreaming}
                onClick={() => onToneChange(tone.id)}
                title={`${tone.label} tone: ${tone.desc}`}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 disabled:opacity-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden md:inline">{tone.label}</span>
              </button>
            );
          })}
        </div>

        {/* Provider Selector: OpenAI & Claude */}
        <div className="relative flex items-center">
          <div className="flex items-center bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
            <Bot className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
            <select
              value={selectedProvider}
              disabled={isStreaming}
              onChange={(e) => onProviderChange(e.target.value)}
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer pr-1 disabled:opacity-50"
            >
              <option value="openai" className="bg-slate-900 text-slate-200">
                OpenAI (GPT-4o)
              </option>
              <option value="claude" className="bg-slate-900 text-slate-200">
                Claude (Anthropic)
              </option>
            </select>
            {/* Status indicator dot */}
            <span
              title={
                currentProviderInfo.available
                  ? `${selectedProvider.toUpperCase()} is configured and ready`
                  : `${selectedProvider.toUpperCase()} key missing in server .env`
              }
              className="ml-1 inline-flex items-center"
            >
              {currentProviderInfo.available ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-amber-500/80 animate-pulse" />
              )}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
