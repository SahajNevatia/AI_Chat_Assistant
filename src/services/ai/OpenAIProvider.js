import OpenAI from 'openai';
import { BaseAIProvider } from './BaseProvider.js';

export class OpenAIProvider extends BaseAIProvider {
  constructor() {
    super('openai');
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.defaultModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.client = null;

    if (this.apiKey) {
      this.client = new OpenAI({ apiKey: this.apiKey });
    }
  }

  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  getDefaultModel() {
    return this.defaultModel;
  }

  async streamCompletion({ messages, systemInstruction, model, onChunk, signal }) {
    if (!this.isConfigured()) {
      throw new Error(
        'OpenAI provider is not configured. Please set the OPENAI_API_KEY environment variable in your server configuration.'
      );
    }

    const targetModel = model || this.defaultModel;
    const formattedMessages = [
      { role: 'system', content: systemInstruction },
      ...messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    ];

    let fullText = '';

    try {
      const stream = await this.client.chat.completions.create(
        {
          model: targetModel,
          messages: formattedMessages,
          stream: true,
        },
        { signal }
      );

      for await (const chunk of stream) {
        if (signal?.aborted) {
          break;
        }
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          fullText += delta;
          onChunk(delta);
        }
      }

      return { fullText, model: targetModel };
    } catch (err) {
      if (err.name === 'AbortError' || signal?.aborted) {
        return { fullText, model: targetModel, aborted: true };
      }
      throw new Error(`OpenAI Streaming Error: ${err.message}`);
    }
  }
}
