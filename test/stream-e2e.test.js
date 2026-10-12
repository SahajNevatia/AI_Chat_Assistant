import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Conversation } from '../src/models/Conversation.js';
import { providerRegistry } from '../src/services/ai/ProviderRegistry.js';
import { BaseAIProvider } from '../src/services/ai/BaseProvider.js';

let app;

// Create a Mock Provider to simulate genuine real-time streaming chunks for testing
class MockStreamingProvider extends BaseAIProvider {
  constructor(name) {
    super(name);
    this.lastReceivedSystemInstruction = null;
    this.lastReceivedMessages = null;
  }

  isConfigured() {
    return true;
  }

  getDefaultModel() {
    return 'mock-model-v1';
  }

  async streamCompletion({ messages, systemInstruction, model, onChunk, signal }) {
    this.lastReceivedSystemInstruction = systemInstruction;
    this.lastReceivedMessages = messages;

    const chunks = ['Streaming ', 'chunk ', '1. ', 'Streaming ', 'chunk ', '2. ', 'Complete!'];
    let fullText = '';

    for (const chunk of chunks) {
      if (signal?.aborted) {
        return { fullText, model: 'mock-model-v1', aborted: true };
      }
      fullText += chunk;
      onChunk(chunk);
      // Small tick
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    return { fullText, model: 'mock-model-v1' };
  }
}

const mockOpenAI = new MockStreamingProvider('openai');
const mockClaude = new MockStreamingProvider('claude');

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await connectDB();

  // Register mock providers in test environment
  providerRegistry.registerProvider('openai', mockOpenAI);
  providerRegistry.registerProvider('claude', mockClaude);

  app = createApp();
}, 60000);

afterAll(async () => {
  await disconnectDB();
});

beforeEach(async () => {
  await Conversation.deleteMany({});
});

describe('E2E Streaming, Tone Application & Persistence', () => {
  const userId = 'user_stream_test_99';

  it('genuinely streams response via SSE and persists conversation and messages in MongoDB', async () => {
    const res = await request(app)
      .post('/api/chat/stream')
      .set('x-user-id', userId)
      .send({
        message: 'Explain how Node.js streams work',
        tone: 'Professional',
        provider: 'openai',
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');

    const body = res.text;
    expect(body).toContain('"type":"meta"');
    expect(body).toContain('"type":"chunk"');
    expect(body).toContain('"type":"done"');
    expect(body).toContain('Streaming chunk 1.');

    // Verify system instruction delivered to AI provider matches Professional tone
    expect(mockOpenAI.lastReceivedSystemInstruction).toContain('professional, articulate');

    // Verify persisted in MongoDB
    const conversations = await Conversation.find({ userId });
    expect(conversations).toHaveLength(1);
    const conv = conversations[0];
    expect(conv.tone).toBe('Professional');
    expect(conv.messages).toHaveLength(2);
    expect(conv.messages[0].role).toBe('user');
    expect(conv.messages[0].content).toBe('Explain how Node.js streams work');
    expect(conv.messages[1].role).toBe('assistant');
    expect(conv.messages[1].content).toBe('Streaming chunk 1. Streaming chunk 2. Complete!');
  });

  it('converts Casual tone into validated casual system instruction', async () => {
    await request(app)
      .post('/api/chat/stream')
      .set('x-user-id', userId)
      .send({
        message: 'Tell me a joke',
        tone: 'Casual',
        provider: 'openai',
      });

    expect(mockOpenAI.lastReceivedSystemInstruction).toContain('friendly, conversational');
  });

  it('converts Concise tone into validated concise system instruction', async () => {
    await request(app)
      .post('/api/chat/stream')
      .set('x-user-id', userId)
      .send({
        message: 'What is water?',
        tone: 'Concise',
        provider: 'claude',
      });

    expect(mockClaude.lastReceivedSystemInstruction).toContain('direct, concise');
  });

  it('regenerates the last assistant response, updating the MongoDB document', async () => {
    // 1. Create a conversation with an existing response
    const conv = await Conversation.create({
      title: 'Regeneration Test',
      userId,
      tone: 'Professional',
      provider: 'openai',
      messages: [
        { role: 'user', content: 'Give me a quote' },
        { role: 'assistant', content: 'Old response that will be replaced' },
      ],
    });

    // 2. Request regeneration
    const regenRes = await request(app)
      .post(`/api/chat/conversations/${conv._id}/regenerate`)
      .set('x-user-id', userId)
      .send({
        tone: 'Casual',
        provider: 'openai',
      });

    expect(regenRes.status).toBe(200);
    expect(regenRes.text).toContain('"type":"meta"');
    expect(regenRes.text).toContain('"regenerating":true');
    expect(regenRes.text).toContain('"type":"done"');

    // 3. Verify in MongoDB that old response was replaced
    const updatedConv = await Conversation.findById(conv._id);
    expect(updatedConv.messages).toHaveLength(2);
    expect(updatedConv.messages[0].role).toBe('user');
    expect(updatedConv.messages[1].role).toBe('assistant');
    expect(updatedConv.messages[1].content).toBe('Streaming chunk 1. Streaming chunk 2. Complete!');
    expect(updatedConv.messages[1].content).not.toContain('Old response');
  });

  it('survives page refresh: conversation can be fetched by ID and appears in history list', async () => {
    const conv = await Conversation.create({
      title: 'Persistent Architecture Review',
      userId,
      tone: 'Concise',
      provider: 'openai',
      messages: [
        { role: 'user', content: 'What is Mongoose?' },
        { role: 'assistant', content: 'An ODM for MongoDB.' },
      ],
    });

    // Fetch history
    const listRes = await request(app)
      .get('/api/chat/conversations')
      .set('x-user-id', userId);

    expect(listRes.status).toBe(200);
    expect(listRes.body.conversations).toHaveLength(1);
    expect(listRes.body.conversations[0]._id).toBe(conv._id.toString());

    // Fetch single conversation
    const getRes = await request(app)
      .get(`/api/chat/conversations/${conv._id}`)
      .set('x-user-id', userId);

    expect(getRes.status).toBe(200);
    expect(getRes.body.conversation.messages).toHaveLength(2);
  });
});
