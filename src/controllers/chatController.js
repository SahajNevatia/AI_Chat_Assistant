import mongoose from 'mongoose';
import { Conversation } from '../models/Conversation.js';
import { assertOwnership } from '../middleware/auth.js';
import { validateTone, getSystemInstructionForTone } from '../services/toneService.js';
import { providerRegistry } from '../services/ai/ProviderRegistry.js';

/**
 * Generate a concise, meaningful title from user prompt.
 */
function generateTitleFromPrompt(prompt) {
  const clean = prompt.replace(/[\r\n]+/g, ' ').trim();
  if (clean.length <= 40) return clean;
  return clean.substring(0, 40) + '...';
}

/**
 * Stream a chat completion through SSE.
 */
export async function streamMessage(req, res, next) {
  const { message, conversationId, tone: rawTone, provider: rawProvider, model } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message cannot be empty.' });
  }

  if (message.length > 8000) {
    return res.status(400).json({ error: 'Message exceeds 8,000 character limit.' });
  }

  let selectedTone;
  try {
    selectedTone = validateTone(rawTone || 'Professional');
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const selectedProvider = (rawProvider || process.env.DEFAULT_PROVIDER || 'openai').toLowerCase().trim();

  let conversation;
  try {
    if (conversationId) {
      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        return res.status(400).json({ error: 'Invalid conversationId format.' });
      }
      conversation = await Conversation.findById(conversationId);
      assertOwnership(conversation, req.userId);
      // Update tone and provider if specified
      conversation.tone = selectedTone;
      if (rawProvider) conversation.provider = selectedProvider;
      if (model) conversation.model = model;
    } else {
      // Create new conversation
      conversation = new Conversation({
        title: generateTitleFromPrompt(message),
        userId: req.userId,
        tone: selectedTone,
        provider: selectedProvider,
        model: model || '',
        messages: [],
      });
    }

    // Append user message
    conversation.messages.push({
      role: 'user',
      content: message.trim(),
      tone: selectedTone,
      provider: selectedProvider,
      model: model || '',
      createdAt: new Date(),
    });

    await conversation.save();
  } catch (err) {
    return next(err);
  }

  // Setup Server-Sent Events headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const abortController = new AbortController();
  const onClose = () => {
    if (!abortController.signal.aborted) {
      abortController.abort();
    }
  };
  req.on('close', onClose);

  // Send metadata event
  res.write(
    `data: ${JSON.stringify({
      type: 'meta',
      conversationId: conversation._id.toString(),
      title: conversation.title,
      tone: conversation.tone,
      provider: conversation.provider,
      userMessageId: conversation.messages[conversation.messages.length - 1]._id.toString(),
    })}\n\n`
  );

  let fullAssistantText = '';
  try {
    const aiProvider = providerRegistry.getProvider(conversation.provider);
    const systemInstruction = getSystemInstructionForTone(selectedTone);

    // Format chat history for provider
    const history = conversation.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const result = await aiProvider.streamCompletion({
      messages: history,
      systemInstruction,
      model: model || conversation.model,
      onChunk: (chunk) => {
        fullAssistantText += chunk;
        res.write(
          `data: ${JSON.stringify({
            type: 'chunk',
            delta: chunk,
          })}\n\n`
        );
      },
      signal: abortController.signal,
    });

    // Save assistant message to database
    if (fullAssistantText.trim().length > 0) {
      conversation.messages.push({
        role: 'assistant',
        content: fullAssistantText,
        tone: selectedTone,
        provider: conversation.provider,
        model: result.model || model || '',
        createdAt: new Date(),
      });
      await conversation.save();
    }

    const assistantMessageId =
      conversation.messages.length > 0
        ? conversation.messages[conversation.messages.length - 1]._id.toString()
        : null;

    res.write(
      `data: ${JSON.stringify({
        type: 'done',
        messageId: assistantMessageId,
        content: fullAssistantText,
        aborted: Boolean(result.aborted),
      })}\n\n`
    );
    res.end();
  } catch (streamErr) {
    // If partial response was generated before error, save it
    if (fullAssistantText.trim().length > 0) {
      try {
        conversation.messages.push({
          role: 'assistant',
          content: fullAssistantText + '\n\n*(Generation interrupted)*',
          tone: selectedTone,
          provider: conversation.provider,
          createdAt: new Date(),
        });
        await conversation.save();
      } catch (saveErr) {
        console.error('Failed to save partial message:', saveErr);
      }
    }

    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        error: streamErr.message,
      })}\n\n`
    );
    res.end();
  } finally {
    req.off('close', onClose);
  }
}

/**
 * Regenerate the last assistant response.
 */
export async function regenerateMessage(req, res, next) {
  const { id } = req.params;
  const { tone: rawTone, provider: rawProvider, model } = req.body || {};

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid conversationId.' });
  }

  let conversation;
  try {
    conversation = await Conversation.findById(id);
    assertOwnership(conversation, req.userId);

    if (!conversation.messages || conversation.messages.length === 0) {
      return res.status(400).json({ error: 'Conversation has no messages to regenerate.' });
    }

    // Find the last assistant message
    const lastMsg = conversation.messages[conversation.messages.length - 1];
    if (lastMsg.role === 'assistant') {
      // Remove the last assistant message so it can be re-generated
      conversation.messages.pop();
    }

    // Make sure there is still a user message
    const hasUserMsg = conversation.messages.some((m) => m.role === 'user');
    if (!hasUserMsg) {
      return res.status(400).json({ error: 'Cannot regenerate without a previous user prompt.' });
    }

    // Update tone/provider if specified
    if (rawTone) conversation.tone = validateTone(rawTone);
    if (rawProvider) conversation.provider = rawProvider.toLowerCase().trim();
    if (model) conversation.model = model;

    await conversation.save();
  } catch (err) {
    return next(err);
  }

  // Setup SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const abortController = new AbortController();
  const onClose = () => {
    if (!abortController.signal.aborted) {
      abortController.abort();
    }
  };
  req.on('close', onClose);

  res.write(
    `data: ${JSON.stringify({
      type: 'meta',
      conversationId: conversation._id.toString(),
      title: conversation.title,
      tone: conversation.tone,
      provider: conversation.provider,
      regenerating: true,
    })}\n\n`
  );

  let fullAssistantText = '';
  try {
    const aiProvider = providerRegistry.getProvider(conversation.provider);
    const systemInstruction = getSystemInstructionForTone(conversation.tone);

    const history = conversation.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const result = await aiProvider.streamCompletion({
      messages: history,
      systemInstruction,
      model: model || conversation.model,
      onChunk: (chunk) => {
        fullAssistantText += chunk;
        res.write(
          `data: ${JSON.stringify({
            type: 'chunk',
            delta: chunk,
          })}\n\n`
        );
      },
      signal: abortController.signal,
    });

    if (fullAssistantText.trim().length > 0) {
      conversation.messages.push({
        role: 'assistant',
        content: fullAssistantText,
        tone: conversation.tone,
        provider: conversation.provider,
        model: result.model || model || '',
        createdAt: new Date(),
      });
      await conversation.save();
    }

    const assistantMessageId =
      conversation.messages.length > 0
        ? conversation.messages[conversation.messages.length - 1]._id.toString()
        : null;

    res.write(
      `data: ${JSON.stringify({
        type: 'done',
        messageId: assistantMessageId,
        content: fullAssistantText,
        aborted: Boolean(result.aborted),
      })}\n\n`
    );
    res.end();
  } catch (streamErr) {
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        error: streamErr.message,
      })}\n\n`
    );
    res.end();
  } finally {
    req.off('close', onClose);
  }
}

/**
 * List conversations for current user with optional query filter.
 */
export async function listConversations(req, res, next) {
  try {
    const { q, limit = 50, page = 1 } = req.query;
    const filter = { userId: req.userId };

    if (q && typeof q === 'string' && q.trim()) {
      const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ title: regex }, { 'messages.content': regex }];
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (parsedPage - 1) * parsedLimit;

    const [conversations, total] = await Promise.all([
      Conversation.find(filter)
        .select('_id title tone provider model updatedAt createdAt messages')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      Conversation.countDocuments(filter),
    ]);

    const formatted = conversations.map((c) => {
      const lastMsg = c.messages && c.messages.length > 0 ? c.messages[c.messages.length - 1] : null;
      return {
        _id: c._id,
        title: c.title,
        tone: c.tone,
        provider: c.provider,
        model: c.model,
        updatedAt: c.updatedAt,
        createdAt: c.createdAt,
        messageCount: c.messages ? c.messages.length : 0,
        lastMessageSnippet: lastMsg ? lastMsg.content.substring(0, 80) : '',
      };
    });

    res.json({
      conversations: formatted,
      total,
      page: parsedPage,
      limit: parsedLimit,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get single conversation by ID.
 */
export async function getConversation(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid conversationId.' });
    }

    const conversation = await Conversation.findById(id).lean();
    assertOwnership(conversation, req.userId);

    res.json({ conversation });
  } catch (err) {
    next(err);
  }
}

/**
 * Rename or update conversation metadata.
 */
export async function updateConversation(req, res, next) {
  try {
    const { id } = req.params;
    const { title, tone, provider } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid conversationId.' });
    }

    const conversation = await Conversation.findById(id);
    assertOwnership(conversation, req.userId);

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ error: 'Title cannot be empty.' });
      }
      conversation.title = title.trim().substring(0, 120);
    }

    if (tone !== undefined) {
      conversation.tone = validateTone(tone);
    }

    if (provider !== undefined) {
      conversation.provider = provider.toLowerCase().trim();
    }

    await conversation.save();

    res.json({
      message: 'Conversation updated successfully.',
      conversation: {
        _id: conversation._id,
        title: conversation.title,
        tone: conversation.tone,
        provider: conversation.provider,
        updatedAt: conversation.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Delete a conversation.
 */
export async function deleteConversation(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid conversationId.' });
    }

    const conversation = await Conversation.findById(id);
    assertOwnership(conversation, req.userId);

    await Conversation.findByIdAndDelete(id);

    res.json({
      message: 'Conversation deleted successfully.',
      id,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Search previous conversations by title and message content.
 */
export async function searchConversations(req, res, next) {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || !q.trim()) {
      return res.json({ results: [] });
    }

    const queryTerm = q.trim();
    const regex = new RegExp(queryTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const conversations = await Conversation.find({
      userId: req.userId,
      $or: [{ title: regex }, { 'messages.content': regex }],
    })
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();

    // Map results with matching snippets
    const results = conversations.map((conv) => {
      // Find matching messages
      const matchingMessages = (conv.messages || []).filter((m) =>
        regex.test(m.content)
      );

      return {
        _id: conv._id,
        title: conv.title,
        tone: conv.tone,
        provider: conv.provider,
        updatedAt: conv.updatedAt,
        messageCount: conv.messages.length,
        matchCount: matchingMessages.length,
        snippet:
          matchingMessages.length > 0
            ? matchingMessages[0].content.substring(0, 150)
            : (conv.messages[conv.messages.length - 1]?.content || '').substring(0, 150),
      };
    });

    res.json({ results });
  } catch (err) {
    next(err);
  }
}

/**
 * Get system config and AI provider availability.
 */
export function getConfig(req, res) {
  const status = providerRegistry.getStatus();
  res.json({
    userId: req.userId,
    ...status,
  });
}
