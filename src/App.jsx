import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';
import { EmptyState } from './components/EmptyState';
import { SearchModal } from './components/SearchModal';
import {
  fetchConfig,
  fetchConversations,
  fetchConversation,
  updateConversation,
  deleteConversation,
  streamChatCompletion,
  streamRegenerate,
} from './services/api';
import { AlertCircle, RotateCcw, X } from 'lucide-react';

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [selectedTone, setSelectedTone] = useState('Professional');
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [providerStatus, setProviderStatus] = useState(null);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [lastFailedMessage, setLastFailedMessage] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const abortControllerRef = useRef(null);

  // Load initial config and conversations
  const loadInitialData = useCallback(async () => {
    try {
      const [configData, convData] = await Promise.all([
        fetchConfig().catch((err) => {
          console.warn('Config fetch warning:', err);
          return null;
        }),
        fetchConversations().catch((err) => {
          console.warn('Conversations fetch warning:', err);
          return { conversations: [] };
        }),
      ]);

      if (configData) {
        setProviderStatus(configData);
        if (configData.defaultTone) setSelectedTone(configData.defaultTone);
        if (configData.defaultProvider) setSelectedProvider(configData.defaultProvider);
      }

      const list = convData?.conversations || [];
      setConversations(list);

      // If conversations exist, load the most recent one
      if (list.length > 0) {
        try {
          const firstConv = await fetchConversation(list[0]._id);
          setActiveConversation(firstConv.conversation);
          if (firstConv.conversation.tone) {
            setSelectedTone(firstConv.conversation.tone);
          }
          if (firstConv.conversation.provider) {
            setSelectedProvider(firstConv.conversation.provider);
          }
        } catch (e) {
          console.warn('Could not load first conversation:', e);
        }
      }
    } catch (err) {
      console.error('Initialization error:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Refresh conversation list in sidebar
  const refreshConversationList = async () => {
    try {
      const data = await fetchConversations();
      setConversations(data.conversations || []);
    } catch (err) {
      console.error('Failed to refresh conversation list:', err);
    }
  };

  // Select a conversation from sidebar or search
  const handleSelectConversation = async (id) => {
    if (isStreaming) {
      handleStopStreaming();
    }
    setErrorMessage(null);
    try {
      const data = await fetchConversation(id);
      setActiveConversation(data.conversation);
      if (data.conversation.tone) setSelectedTone(data.conversation.tone);
      if (data.conversation.provider) setSelectedProvider(data.conversation.provider);
    } catch (err) {
      setErrorMessage(err.message || 'Could not load selected conversation.');
    }
  };

  // Start a new chat
  const handleNewChat = () => {
    if (isStreaming) {
      handleStopStreaming();
    }
    setActiveConversation(null);
    setInput('');
    setErrorMessage(null);
  };

  // Rename a conversation
  const handleRenameConversation = async (id, newTitle) => {
    try {
      await updateConversation(id, { title: newTitle });
      setConversations((prev) =>
        prev.map((c) => (c._id === id ? { ...c, title: newTitle } : c))
      );
      if (activeConversation?._id === id) {
        setActiveConversation((prev) => (prev ? { ...prev, title: newTitle } : prev));
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to rename conversation.');
    }
  };

  // Delete a conversation
  const handleDeleteConversation = async (id) => {
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c._id !== id));
      if (activeConversation?._id === id) {
        setActiveConversation(null);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to delete conversation.');
    }
  };

  // Tone change
  const handleToneChange = async (tone) => {
    setSelectedTone(tone);
    if (activeConversation?._id) {
      try {
        await updateConversation(activeConversation._id, { tone });
        setActiveConversation((prev) => (prev ? { ...prev, tone } : prev));
      } catch (err) {
        console.warn('Failed to persist tone to active conversation:', err);
      }
    }
  };

  // Provider change
  const handleProviderChange = async (provider) => {
    setSelectedProvider(provider);
    if (activeConversation?._id) {
      try {
        await updateConversation(activeConversation._id, { provider });
        setActiveConversation((prev) => (prev ? { ...prev, provider } : prev));
      } catch (err) {
        console.warn('Failed to persist provider to active conversation:', err);
      }
    }
  };

  // Stop active streaming
  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  // Send a message and stream response
  const handleSendMessage = async (textToSend = null) => {
    const messageContent = (textToSend !== null ? textToSend : input).trim();
    if (!messageContent || isStreaming) return;

    setInput('');
    setErrorMessage(null);
    setLastFailedMessage(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setIsStreaming(true);

    const tempUserMsg = {
      role: 'user',
      content: messageContent,
      tone: selectedTone,
      provider: selectedProvider,
      createdAt: new Date().toISOString(),
    };

    const tempAssistantMsg = {
      role: 'assistant',
      content: '',
      tone: selectedTone,
      provider: selectedProvider,
      createdAt: new Date().toISOString(),
    };

    // Optimistically update conversation messages
    setActiveConversation((prev) => {
      if (!prev) {
        return {
          title: messageContent.substring(0, 40),
          tone: selectedTone,
          provider: selectedProvider,
          messages: [tempUserMsg, tempAssistantMsg],
        };
      }
      return {
        ...prev,
        messages: [...(prev.messages || []), tempUserMsg, tempAssistantMsg],
      };
    });

    let currentConversationId = activeConversation?._id;

    await streamChatCompletion({
      message: messageContent,
      conversationId: currentConversationId,
      tone: selectedTone,
      provider: selectedProvider,
      signal: abortController.signal,
      onMeta: (meta) => {
        currentConversationId = meta.conversationId;
        setActiveConversation((prev) => ({
          ...prev,
          _id: meta.conversationId,
          title: meta.title || prev?.title,
          tone: meta.tone,
          provider: meta.provider,
        }));
      },
      onChunk: (delta) => {
        setActiveConversation((prev) => {
          if (!prev || !prev.messages) return prev;
          const updated = [...prev.messages];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: updated[lastIdx].content + delta,
            };
          }
          return { ...prev, messages: updated };
        });
      },
      onDone: (data) => {
        setIsStreaming(false);
        abortControllerRef.current = null;
        refreshConversationList();
      },
      onError: (err) => {
        console.error('Streaming error caught:', err);
        setIsStreaming(false);
        abortControllerRef.current = null;
        setErrorMessage(err.message || 'Stream connection failed.');
        setLastFailedMessage(messageContent);
      },
    });
  };

  // Regenerate last assistant response
  const handleRegenerateLast = async () => {
    if (!activeConversation?._id || isStreaming) return;

    setErrorMessage(null);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setIsStreaming(true);

    // Replace the last assistant message with empty placeholder
    setActiveConversation((prev) => {
      if (!prev || !prev.messages) return prev;
      const msgs = [...prev.messages];
      if (msgs[msgs.length - 1]?.role === 'assistant') {
        msgs.pop();
      }
      msgs.push({
        role: 'assistant',
        content: '',
        tone: selectedTone,
        provider: selectedProvider,
        createdAt: new Date().toISOString(),
      });
      return { ...prev, messages: msgs };
    });

    await streamRegenerate({
      conversationId: activeConversation._id,
      tone: selectedTone,
      provider: selectedProvider,
      signal: abortController.signal,
      onMeta: (meta) => {
        // Updated metadata
      },
      onChunk: (delta) => {
        setActiveConversation((prev) => {
          if (!prev || !prev.messages) return prev;
          const updated = [...prev.messages];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: updated[lastIdx].content + delta,
            };
          }
          return { ...prev, messages: updated };
        });
      },
      onDone: () => {
        setIsStreaming(false);
        abortControllerRef.current = null;
        refreshConversationList();
      },
      onError: (err) => {
        setIsStreaming(false);
        abortControllerRef.current = null;
        setErrorMessage(err.message || 'Regeneration failed.');
      },
    });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 font-sans">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeConversation?._id}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        onOpenSearchModal={() => setIsSearchModalOpen(true)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isLoading={isLoadingHistory}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Top Header */}
        <Header
          activeConversation={activeConversation}
          selectedTone={selectedTone}
          onToneChange={handleToneChange}
          selectedProvider={selectedProvider}
          onProviderChange={handleProviderChange}
          providerStatus={providerStatus}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          isStreaming={isStreaming}
        />

        {/* Global Error Banner with Retry */}
        {errorMessage && (
          <div className="bg-rose-950/80 border-b border-rose-500/40 text-rose-200 px-4 py-2.5 flex items-center justify-between text-xs animate-in slide-in-from-top-2">
            <div className="flex items-center space-x-2 min-w-0 mr-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="truncate">{errorMessage}</span>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              {lastFailedMessage && (
                <button
                  onClick={() => handleSendMessage(lastFailedMessage)}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-800 hover:bg-rose-700 text-white font-medium transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              )}
              <button
                onClick={() => setErrorMessage(null)}
                className="p-1 text-rose-400 hover:text-rose-200 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Chat Message Stream & List */}
        <MessageList
          messages={activeConversation?.messages || []}
          isStreaming={isStreaming}
          onRegenerateLast={handleRegenerateLast}
          emptyStateComponent={
            <EmptyState
              selectedTone={selectedTone}
              onSelectSuggestion={(prompt) => handleSendMessage(prompt)}
            />
          }
        />

        {/* Multiline Prompt Input Area */}
        <ChatInput
          input={input}
          setInput={setInput}
          onSend={() => handleSendMessage()}
          onStop={handleStopStreaming}
          isStreaming={isStreaming}
        />
      </div>

      {/* Global Deep Search Modal */}
      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectConversation={handleSelectConversation}
      />
    </div>
  );
}
