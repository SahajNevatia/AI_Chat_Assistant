import React, { useRef, useEffect } from 'react';
import { Send, Square, AlertCircle } from 'lucide-react';

const MAX_CHARS = 8000;

export function ChatInput({
  input,
  setInput,
  onSend,
  onStop,
  isStreaming,
  placeholder = 'Type your prompt here... (Shift + Enter for new line)',
}) {
  const textareaRef = useRef(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [input]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && input.trim()) {
        onSend();
      }
    }
  };

  const isOverLimit = input.length > MAX_CHARS;
  const canSubmit = input.trim().length > 0 && !isOverLimit && !isStreaming;

  return (
    <div className="border-t border-slate-800 bg-slate-900/90 backdrop-blur-md p-3 sm:p-4">
      <div className="max-w-4xl mx-auto w-full">
        <div className="relative bg-slate-950 rounded-2xl border border-slate-800 focus-within:border-blue-500/80 focus-within:ring-1 focus-within:ring-blue-500/50 transition-all p-2 sm:p-3 shadow-inner">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-sm focus:outline-none resize-none min-h-[44px] max-h-[200px] leading-relaxed pr-12"
          />

          {/* Right Action Button (Send or Stop Generating) */}
          <div className="absolute right-3 bottom-3 flex items-center space-x-2">
            {isStreaming ? (
              <button
                onClick={onStop}
                type="button"
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium shadow-md shadow-rose-600/20 transition active:scale-95"
                title="Stop generation"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span className="hidden sm:inline">Stop</span>
              </button>
            ) : (
              <button
                onClick={onSend}
                disabled={!canSubmit}
                type="button"
                className={`p-2 rounded-xl transition ${
                  canSubmit
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25 active:scale-95'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                }`}
                title="Send prompt (Enter)"
                aria-label="Send prompt"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Bottom meta: char counter & tips */}
        <div className="mt-1.5 px-2 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center space-x-3 hidden sm:flex">
            <span>Press <kbd className="bg-slate-800 px-1 py-0.5 rounded text-[10px] text-slate-400 font-mono">Enter</kbd> to send</span>
            <span><kbd className="bg-slate-800 px-1 py-0.5 rounded text-[10px] text-slate-400 font-mono">Shift + Enter</kbd> for newline</span>
          </div>

          <div className="ml-auto flex items-center space-x-1">
            {isOverLimit && <AlertCircle className="w-3 h-3 text-rose-400" />}
            <span className={isOverLimit ? 'text-rose-400 font-medium' : 'text-slate-400'}>
              {input.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
