import { OpenAIProvider } from './OpenAIProvider.js';
import { ClaudeProvider } from './ClaudeProvider.js';

class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.initialized = false;
  }

  init() {
    this.providers.set('openai', new OpenAIProvider());
    this.providers.set('claude', new ClaudeProvider());
    this.initialized = true;
  }

  registerProvider(name, providerInstance) {
    if (!this.initialized) {
      this.init();
    }
    this.providers.set(name.toLowerCase().trim(), providerInstance);
  }

  getProvider(name) {
    if (!this.initialized) {
      this.init();
    }

    const normalized = (name || process.env.DEFAULT_PROVIDER || 'openai').toLowerCase().trim();
    const provider = this.providers.get(normalized);

    if (!provider) {
      throw new Error(
        `Unsupported AI provider "${name}". Supported providers are: ${Array.from(
          this.providers.keys()
        ).join(', ')}`
      );
    }

    return provider;
  }

  getStatus() {
    if (!this.initialized) {
      this.init();
    }

    const openai = this.providers.get('openai');
    const claude = this.providers.get('claude');

    return {
      providers: {
        openai: {
          available: openai.isConfigured(),
          defaultModel: openai.getDefaultModel(),
          supportedModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
        },
        claude: {
          available: claude.isConfigured(),
          defaultModel: claude.getDefaultModel(),
          supportedModels: [
            'claude-3-5-sonnet-20241022',
            'claude-3-5-haiku-20241022',
            'claude-3-haiku-20240307',
          ],
        },
      },
      defaultProvider: process.env.DEFAULT_PROVIDER || 'openai',
      defaultTone: process.env.DEFAULT_TONE || 'Professional',
    };
  }
}

export const providerRegistry = new ProviderRegistry();
