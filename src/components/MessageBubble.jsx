import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  User,
  Bot,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

function formatTimestamp(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Custom code block with syntax header & copy button
function CodeBlock({ node, inline, className, children, ...props }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeContent = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(codeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!inline && (match || codeContent.includes('\n'))) {
    return (
      <div className="my-3 rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 font-mono text-xs">
        <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900/90 border-b border-slate-800 text-slate-400 select-none">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {language || 'code'}
          </span>
          <button
            onClick={handleCopy}
            type="button"
            className="flex items-center space-x-1 text-[11px] text-slate-400 hover:text-slate-200 transition py-0.5 px-2 rounded hover:bg-slate-800"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
        <div className="p-3.5 overflow-x-auto text-slate-200 leading-relaxed">
          <code>{children}</code>
        </div>
      </div>
    );
  }

  return (
    <code
      className="bg-slate-800/80 text-blue-300 px-1.5 py-0.5 rounded text-[13px] font-mono border border-slate-700/50"
      {...props}
    >
      {children}
    </code>
  );
}

export function MessageBubble({
  message,
  isLast,
  isStreaming,
  onRegenerate,
}) {
  const isUser = message.role === 'user';
  const showRegenerate = !isUser && isLast && !isStreaming;

  return (
    <div
      className={`flex items-start space-x-3 my-4 group ${
        isUser ? 'flex-row-reverse space-x-reverse' : 'flex-row'
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-slate-800 border border-slate-700 text-blue-400'
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Bubble Container */}
      <div
        className={`flex flex-col max-w-[85%] md:max-w-[75%] ${
          isUser ? 'items-end' : 'items-start'
        }`}
      >
        {/* Sender Info / Tone Tag */}
        <div className="flex items-center space-x-2 mb-1 px-1 text-[11px] text-slate-400">
          <span className="font-medium text-slate-300">
            {isUser ? 'You' : 'Assistant'}
          </span>
          {message.tone && !isUser && (
            <span className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-[10px] text-blue-300">
              {message.tone}
            </span>
          )}
          <span>•</span>
          <span>{formatTimestamp(message.createdAt || new Date())}</span>
        </div>

        {/* Message Content Bubble */}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm break-words ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-sm selection:bg-blue-800'
              : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-sm'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none text-slate-100">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code: CodeBlock,
                  p: ({ children }) => <p className="mb-2.5 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-5 mb-2.5 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2.5 space-y-1">{children}</ol>,
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 underline hover:text-blue-300"
                    >
                      {children}
                    </a>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-3 border border-slate-700 rounded-lg">
                      <table className="min-w-full divide-y divide-slate-700 text-xs">
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="px-3 py-2 bg-slate-800 font-semibold text-left text-slate-200">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-3 py-2 border-t border-slate-800 text-slate-300">
                      {children}
                    </td>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>

              {/* Streaming cursor */}
              {isStreaming && isLast && <span className="streaming-cursor" />}
            </div>
          )}
        </div>

        {/* Action bar below assistant message */}
        {showRegenerate && (
          <div className="mt-1.5 flex items-center space-x-2 text-xs">
            <button
              onClick={onRegenerate}
              type="button"
              className="flex items-center space-x-1.5 text-slate-400 hover:text-blue-400 py-1 px-2 rounded-lg hover:bg-slate-800/80 transition"
              title="Regenerate this response"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium">Regenerate</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
