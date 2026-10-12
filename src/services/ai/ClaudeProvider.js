import Anthropic from '@anthropic-ai/sdk';
import { BaseAIProvider } from './BaseProvider.js';

export class ClaudeProvider extends BaseAIProvider {
  constructor() {
    super('claude');
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    this.defaultModel = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
    this.client = null;

    if (this.apiKey) {
      this.client = new Anthropic({ apiKey: this.apiKey });
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
        'Claude provider is not configured. Please set the ANTHROPIC_API_KEY environment variable in your server configuration.'
      );
    }

    const targetModel = model || this.defaultModel;
    
    // Anthropic requires strictly alternating user/assistant messages and system as a separate field
    const formattedMessages = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    // Ensure first message is user
    if (formattedMessages.length > 0 && formattedMessages[0].role !== 'user') {
      formattedMessages.unshift({ role: 'user', content: 'Hello' });
    }

    let fullText = '';

    try {
      const stream = this.client.messages.stream(
        {
          model: targetModel,
          max_tokens: 4096,
          system: systemInstruction,
          messages: formattedMessages,
        },
        { signal }
      );

      for await (const event of stream) {
        if (signal?.aborted) {
          break;
        }

        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          const text = event.delta.text || '';
          if (text) {
            fullText += text;
            onChunk(text);
          }
        }
      }

      return { fullText, model: targetModel };
    } catch (err) {
      if (err.name === 'AbortError' || signal?.aborted) {
        return { fullText, model: targetModel, aborted: true };
      }
      throw new Error(`Claude Streaming Error: ${err.message}`);
    }
  }
}
