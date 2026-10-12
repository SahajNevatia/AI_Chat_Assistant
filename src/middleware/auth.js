import crypto from 'crypto';

export function authMiddleware(req, res, next) {
  let userId = req.headers['x-user-id'];

  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    // If no user ID header provided, use a deterministic or guest ID from cookie / IP or generate a secure fallback
    const fallbackId = `guest_${crypto.createHash('sha256').update(req.ip || '127.0.0.1').digest('hex').substring(0, 16)}`;
    userId = fallbackId;
  } else {
    userId = userId.trim();
  }

  // Sanitize and validate length/format
  if (userId.length > 128 || !/^[a-zA-Z0-9_\-\.@]+$/.test(userId)) {
    return res.status(400).json({
      error: 'Invalid x-user-id header format. Must be alphanumeric with dashes/underscores, max 128 chars.',
    });
  }

  req.userId = userId;
  req.user = { id: userId };
  
  // Set response header so frontend can persist its user identity
  res.setHeader('x-user-id', userId);
  next();
}

export function assertOwnership(conversation, userId) {
  if (!conversation) {
    const err = new Error('Conversation not found');
    err.status = 404;
    throw err;
  }
  if (conversation.userId !== userId) {
    const err = new Error('Unauthorized: You do not have permission to access this conversation.');
    err.status = 403;
    throw err;
  }
}
