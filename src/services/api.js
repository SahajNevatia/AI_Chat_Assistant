// Manage persistent user identifier for authentication-ready ownership
const USER_ID_STORAGE_KEY = 'ai_chat_user_id';

export function getUserId() {
  let id = localStorage.getItem(USER_ID_STORAGE_KEY);
  if (!id) {
    id = 'user_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    localStorage.setItem(USER_ID_STORAGE_KEY, id);
  }
  return id;
}

export function setUserId(id) {
  if (id) {
    localStorage.setItem(USER_ID_STORAGE_KEY, id);
  }
}

const API_BASE = '/api/chat';

function getDefaultHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-user-id': getUserId(),
  };
}

export async function fetchConfig() {
  const res = await fetch(`${API_BASE}/config`, {
    headers: getDefaultHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load server configuration.');
  return res.json();
}

export async function fetchConversations(query = '') {
  const url = query
    ? `${API_BASE}/conversations?q=${encodeURIComponent(query)}`
    : `${API_BASE}/conversations`;
  const res = await fetch(url, {
    headers: getDefaultHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load conversation history.');
  return res.json();
}

export async function fetchConversation(id) {
  const res = await fetch(`${API_BASE}/conversations/${id}`, {
    headers: getDefaultHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to load conversation.');
  }
  return res.json();
}

export async function updateConversation(id, data) {
  const res = await fetch(`${API_BASE}/conversations/${id}`, {
    method: 'PATCH',
    headers: getDefaultHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update conversation.');
  }
  return res.json();
}

export async function deleteConversation(id) {
  const res = await fetch(`${API_BASE}/conversations/${id}`, {
    method: 'DELETE',
    headers: getDefaultHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete conversation.');
  }
  return res.json();
}

export async function searchConversations(query) {
  const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`, {
    headers: getDefaultHeaders(),
  });
  if (!res.ok) throw new Error('Search failed.');
  return res.json();
}

/**
 * Connect to SSE streaming endpoint and parse events incrementally.
 */
export async function streamChatCompletion({
  message,
  conversationId,
  tone,
  provider,
  model,
  signal,
  onMeta,
  onChunk,
  onDone,
  onError,
}) {
  try {
    const response = await fetch(`${API_BASE}/stream`, {
      method: 'POST',
      headers: getDefaultHeaders(),
      body: JSON.stringify({
        message,
        conversationId,
        tone,
        provider,
        model,
      }),
      signal,
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP error ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop(); // Keep unfinished chunk in buffer

      for (const block of lines) {
        const line = block.trim();
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          try {
            const data = JSON.parse(jsonStr);
            if (data.type === 'meta') {
              onMeta?.(data);
            } else if (data.type === 'chunk') {
              onChunk?.(data.delta);
            } else if (data.type === 'done') {
              onDone?.(data);
            } else if (data.type === 'error') {
              onError?.(new Error(data.error));
            }
          } catch (e) {
            console.warn('Failed to parse SSE line:', jsonStr, e);
          }
        }
      }
    }
  } catch (err) {
    if (signal?.aborted) {
      // User cancelled stream
      onDone?.({ aborted: true });
      return;
    }
    onError?.(err);
  }
}

/**
 * Regenerate stream for an existing conversation.
 */
export async function streamRegenerate({
  conversationId,
  tone,
  provider,
  model,
  signal,
  onMeta,
  onChunk,
  onDone,
  onError,
}) {
  try {
    const response = await fetch(`${API_BASE}/conversations/${conversationId}/regenerate`, {
      method: 'POST',
      headers: getDefaultHeaders(),
      body: JSON.stringify({ tone, provider, model }),
      signal,
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP error ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop();

      for (const block of lines) {
        const line = block.trim();
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          try {
            const data = JSON.parse(jsonStr);
            if (data.type === 'meta') {
              onMeta?.(data);
            } else if (data.type === 'chunk') {
              onChunk?.(data.delta);
            } else if (data.type === 'done') {
              onDone?.(data);
            } else if (data.type === 'error') {
              onError?.(new Error(data.error));
            }
          } catch (e) {
            console.warn('Failed to parse SSE line:', jsonStr, e);
          }
        }
      }
    }
  } catch (err) {
    if (signal?.aborted) {
      onDone?.({ aborted: true });
      return;
    }
    onError?.(err);
  }
}
