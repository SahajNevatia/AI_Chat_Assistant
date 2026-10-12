import React, { useState } from 'react';
import {
  Plus,
  MessageSquare,
  Search,
  Trash2,
  Edit2,
  Check,
  X,
  Sparkles,
  ChevronLeft,
} from 'lucide-react';

function formatDateGroup(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return 'Previous 7 Days';
  return 'Older';
}

export function Sidebar({
  conversations,
  activeId,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  onOpenSearchModal,
  isOpen,
  onClose,
  isLoading,
}) {
  const [filterQuery, setFilterQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(filterQuery.toLowerCase())
  );

  // Group by relative time
  const groups = filtered.reduce((acc, c) => {
    const groupName = formatDateGroup(c.updatedAt);
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(c);
    return acc;
  }, {});

  const handleStartEdit = (conv, e) => {
    e.stopPropagation();
    setEditingId(conv._id);
    setEditingTitle(conv.title);
  };

  const handleSaveEdit = async (conv, e) => {
    e?.stopPropagation();
    if (editingTitle.trim() && editingTitle.trim() !== conv.title) {
      await onRenameConversation(conv._id, editingTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelEdit = (e) => {
    e?.stopPropagation();
    setEditingId(null);
  };

  const handleConfirmDelete = async (id, e) => {
    e.stopPropagation();
    await onDeleteConversation(id);
    setDeletingId(null);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden"
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 w-72 bg-slate-900 border-r border-slate-800 flex flex-col z-30 transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Header & New Chat button */}
        <div className="p-4 border-b border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="font-semibold text-sm tracking-wide text-slate-100">
                AI Assistant
              </span>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={() => {
              onNewChat();
              onClose?.();
            }}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-medium text-xs shadow-md shadow-blue-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Search bar inside sidebar */}
        <div className="px-4 py-2 border-b border-slate-800/60 flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter chats..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={onOpenSearchModal}
            title="Deep search across message contents"
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-blue-400 hover:border-blue-500/50 transition text-xs shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {isLoading && conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">Loading history...</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">
              {filterQuery ? 'No matching conversations' : 'No conversations yet'}
            </div>
          ) : (
            Object.entries(groups).map(([groupTitle, items]) => (
              <div key={groupTitle} className="space-y-1">
                <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {groupTitle}
                </div>
                {items.map((conv) => {
                  const isActive = activeId === conv._id;
                  const isEditing = editingId === conv._id;
                  const isDeleting = deletingId === conv._id;

                  return (
                    <div
                      key={conv._id}
                      onClick={() => {
                        if (!isEditing && !isDeleting) {
                          onSelectConversation(conv._id);
                          onClose?.();
                        }
                      }}
                      className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition ${
                        isActive
                          ? 'bg-blue-600/15 text-blue-300 font-medium border border-blue-500/30'
                          : 'text-slate-300 hover:bg-slate-800/70 hover:text-slate-100'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1 mr-2">
                        <MessageSquare
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isActive ? 'text-blue-400' : 'text-slate-400'
                          }`}
                        />

                        {isEditing ? (
                          <input
                            type="text"
                            value={editingTitle}
                            autoFocus
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(conv, e);
                              if (e.key === 'Escape') handleCancelEdit(e);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-slate-950 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-slate-100 focus:outline-none"
                          />
                        ) : (
                          <span className="truncate">{conv.title}</span>
                        )}
                      </div>

                      {/* Action buttons (Rename, Delete) */}
                      <div className="flex items-center space-x-1 shrink-0">
                        {isEditing ? (
                          <>
                            <button
                              onClick={(e) => handleSaveEdit(conv, e)}
                              className="p-1 hover:text-emerald-400 text-slate-400"
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-1 hover:text-rose-400 text-slate-400"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : isDeleting ? (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center space-x-1 bg-rose-950/80 border border-rose-500/50 rounded px-1.5 py-0.5"
                          >
                            <span className="text-[10px] text-rose-300">Delete?</span>
                            <button
                              onClick={(e) => handleConfirmDelete(conv._id, e)}
                              className="p-0.5 text-rose-400 hover:text-rose-200"
                              title="Confirm delete"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingId(null);
                              }}
                              className="p-0.5 text-slate-400 hover:text-slate-200"
                              title="Cancel"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-0.5 transition-opacity">
                            <button
                              onClick={(e) => handleStartEdit(conv, e)}
                              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"
                              title="Rename chat"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingId(conv._id);
                              }}
                              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-rose-400"
                              title="Delete chat"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Persisted in MongoDB</span>
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
        </div>
      </aside>
    </>
  );
}
