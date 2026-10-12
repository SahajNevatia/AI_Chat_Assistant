import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Conversation } from '../src/models/Conversation.js';
import { validateTone, getSystemInstructionForTone } from '../src/services/toneService.js';
import { providerRegistry } from '../src/services/ai/ProviderRegistry.js';

let app;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await connectDB();
  app = createApp();
}, 60000);

afterAll(async () => {
  await disconnectDB();
});

beforeEach(async () => {
  await Conversation.deleteMany({});
});

describe('Tone Service & System Instructions', () => {
  it('validates all three required tones correctly', () => {
    expect(validateTone('Professional')).toBe('Professional');
    expect(validateTone('casual')).toBe('Casual');
    expect(validateTone('CONCISE')).toBe('Concise');
  });

  it('rejects invalid tone options', () => {
    expect(() => validateTone('Sarcastic')).toThrow(/Invalid tone/);
    expect(() => validateTone('Aggressive')).toThrow(/Invalid tone/);
  });

  it('generates distinct system instructions for each tone', () => {
    const prof = getSystemInstructionForTone('Professional');
    const casual = getSystemInstructionForTone('Casual');
    const concise = getSystemInstructionForTone('Concise');

    expect(prof).toContain('professional, articulate');
    expect(casual).toContain('friendly, conversational');
    expect(concise).toContain('direct, concise');

    // Make sure they are all different
    expect(prof).not.toEqual(casual);
    expect(casual).not.toEqual(concise);
    expect(prof).not.toEqual(concise);
  });
});

describe('Provider Registry', () => {
  it('returns status report of providers', () => {
    const status = providerRegistry.getStatus();
    expect(status).toHaveProperty('providers');
    expect(status.providers).toHaveProperty('openai');
    expect(status.providers).toHaveProperty('claude');
    expect(status).toHaveProperty('defaultProvider');
    expect(status).toHaveProperty('defaultTone');
  });

  it('throws when requesting an unsupported provider', () => {
    expect(() => providerRegistry.getProvider('unsupported_ai')).toThrow(/Unsupported AI provider/);
  });
});

describe('Conversation CRUD & Ownership', () => {
  const userA = 'user_alice_123';
  const userB = 'user_bob_456';

  it('creates, lists, and retrieves conversations for a user', async () => {
    const conv = await Conversation.create({
      title: 'First chat',
      userId: userA,
      tone: 'Professional',
      provider: 'openai',
      messages: [
        { role: 'user', content: 'Hello AI' },
        { role: 'assistant', content: 'Hello Alice, how can I assist you today?' },
      ],
    });

    // List conversations for userA
    const listRes = await request(app)
      .get('/api/chat/conversations')
      .set('x-user-id', userA);

    expect(listRes.status).toBe(200);
    expect(listRes.body.conversations).toHaveLength(1);
    expect(listRes.body.conversations[0].title).toBe('First chat');
    expect(listRes.body.conversations[0].messageCount).toBe(2);

    // Retrieve single conversation
    const getRes = await request(app)
      .get(`/api/chat/conversations/${conv._id}`)
      .set('x-user-id', userA);

    expect(getRes.status).toBe(200);
    expect(getRes.body.conversation.title).toBe('First chat');
    expect(getRes.body.conversation.messages).toHaveLength(2);
  });

  it('enforces conversation ownership and returns 403 when accessed by another user', async () => {
    const conv = await Conversation.create({
      title: 'Alice Private Chat',
      userId: userA,
      messages: [{ role: 'user', content: 'Confidential message' }],
    });

    // UserB tries to access Alice's conversation
    const getRes = await request(app)
      .get(`/api/chat/conversations/${conv._id}`)
      .set('x-user-id', userB);

    expect(getRes.status).toBe(403);
    expect(getRes.body.error).toContain('Unauthorized');

    // UserB tries to rename Alice's conversation
    const patchRes = await request(app)
      .patch(`/api/chat/conversations/${conv._id}`)
      .set('x-user-id', userB)
      .send({ title: 'Hacked Title' });

    expect(patchRes.status).toBe(403);

    // UserB tries to delete Alice's conversation
    const deleteRes = await request(app)
      .delete(`/api/chat/conversations/${conv._id}`)
      .set('x-user-id', userB);

    expect(deleteRes.status).toBe(403);
  });

  it('allows owner to rename and delete conversation', async () => {
    const conv = await Conversation.create({
      title: 'Original Title',
      userId: userA,
      tone: 'Casual',
    });

    const patchRes = await request(app)
      .patch(`/api/chat/conversations/${conv._id}`)
      .set('x-user-id', userA)
      .send({ title: 'Updated Title', tone: 'Concise' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.conversation.title).toBe('Updated Title');
    expect(patchRes.body.conversation.tone).toBe('Concise');

    const deleteRes = await request(app)
      .delete(`/api/chat/conversations/${conv._id}`)
      .set('x-user-id', userA);

    expect(deleteRes.status).toBe(200);
    expect(await Conversation.findById(conv._id)).toBeNull();
  });
});

describe('Search Functionality', () => {
  const userId = 'search_tester_1';

  beforeEach(async () => {
    await Conversation.create([
      {
        title: 'Python Data Science',
        userId,
        messages: [
          { role: 'user', content: 'How do I use pandas for dataframe filtering?' },
          { role: 'assistant', content: 'Use df[df["col"] > 5] for boolean indexing.' },
        ],
      },
      {
        title: 'Cooking Pasta',
        userId,
        messages: [
          { role: 'user', content: 'How to make authentic Carbonara?' },
          { role: 'assistant', content: 'Use guanciale, pecorino romano, egg yolks, and black pepper.' },
        ],
      },
    ]);
  });

  it('searches conversations by title or message content', async () => {
    const res = await request(app)
      .get('/api/chat/search?q=pandas')
      .set('x-user-id', userId);

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].title).toBe('Python Data Science');
    expect(res.body.results[0].snippet).toContain('pandas');
  });

  it('searches conversations by message content match', async () => {
    const res = await request(app)
      .get('/api/chat/search?q=guanciale')
      .set('x-user-id', userId);

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].title).toBe('Cooking Pasta');
  });
});

describe('Chat Streaming API Validation', () => {
  const userId = 'stream_tester_1';

  it('rejects empty message with 400', async () => {
    const res = await request(app)
      .post('/api/chat/stream')
      .set('x-user-id', userId)
      .send({ message: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Message cannot be empty');
  });

  it('rejects invalid tone with 400', async () => {
    const res = await request(app)
      .post('/api/chat/stream')
      .set('x-user-id', userId)
      .send({ message: 'Hello', tone: 'Angry' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid tone');
  });

  it('handles stream request and emits SSE meta event and error event if API key is not configured', async () => {
    const res = await request(app)
      .post('/api/chat/stream')
      .set('x-user-id', userId)
      .send({ message: 'Explain React hooks', tone: 'Professional', provider: 'openai' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    
    // Check that SSE stream output contains meta event
    expect(res.text).toContain('"type":"meta"');
    // And contains error or done event
    expect(res.text).toMatch(/"type":"(error|done)"/);
  });
});
