import express from 'express';
import {
  streamMessage,
  regenerateMessage,
  listConversations,
  getConversation,
  updateConversation,
  deleteConversation,
  searchConversations,
  getConfig,
} from '../controllers/chatController.js';
import { chatRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Configuration & system status
router.get('/config', getConfig);

// Search conversations
router.get('/search', searchConversations);

// Conversation management
router.get('/conversations', listConversations);
router.get('/conversations/:id', getConversation);
router.patch('/conversations/:id', updateConversation);
router.delete('/conversations/:id', deleteConversation);

// Streaming AI chat & regeneration (rate limited)
router.post('/stream', chatRateLimiter, streamMessage);
router.post('/conversations/:id/regenerate', chatRateLimiter, regenerateMessage);

export default router;
