export class BaseAIProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * Check whether this provider has a configured API key.
   * @returns {boolean}
   */
  isConfigured() {
    throw new Error('isConfigured() must be implemented by subclass');
  }

  /**
   * Get default model for this provider.
   * @returns {string}
   */
  getDefaultModel() {
    throw new Error('getDefaultModel() must be implemented by subclass');
  }

  /**
   * Stream a chat completion through the given callback.
   * @param {Object} options
   * @param {Array<{role: string, content: string}>} options.messages
   * @param {string} options.systemInstruction
   * @param {string} [options.model]
   * @param {(chunk: string) => void} options.onChunk
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<{ fullText: string, model: string }>}
   */
  async streamCompletion({ messages, systemInstruction, model, onChunk, signal }) {
    throw new Error('streamCompletion() must be implemented by subclass');
  }
}
