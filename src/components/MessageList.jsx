import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MessageBubble } from './MessageBubble';
import { ArrowDown } from 'lucide-react';

export function MessageList({
  messages,
  isStreaming,
  onRegenerateLast,
  emptyStateComponent,
}) {
  const containerRef = useRef(null);
  const bottomRef = useRef(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const isAutoScrollActive = useRef(true);

  // Monitor scroll position
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

    // If user is within 100px of bottom, treat as bottom
    const isAtBottom = distanceFromBottom < 100;
    isAutoScrollActive.current = isAtBottom;
    setShowScrollBottom(!isAtBottom);
  }, []);

  // Scroll to bottom helper
  const scrollToBottom = useCallback((smooth = true) => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  }, []);

  // Auto-scroll when messages update or stream updates
  useEffect(() => {
    if (isAutoScrollActive.current) {
      scrollToBottom(false);
    }
  }, [messages, isStreaming, scrollToBottom]);

  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
        {emptyStateComponent}
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-4 space-y-2"
      >
        <div className="max-w-4xl mx-auto w-full">
          {messages.map((msg, index) => {
            const isLast = index === messages.length - 1;
            return (
              <MessageBubble
                key={msg._id || index}
                message={msg}
                isLast={isLast}
                isStreaming={isStreaming && isLast}
                onRegenerate={onRegenerateLast}
              />
            );
          })}
          <div ref={bottomRef} className="h-4" />
        </div>
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-5 right-8 p-2 rounded-full bg-slate-800/90 border border-slate-700 text-slate-300 hover:text-white shadow-lg backdrop-blur hover:bg-slate-700 transition active:scale-95 z-10"
          title="Scroll to bottom"
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
