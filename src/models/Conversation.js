import mongoose from 'mongoose';

export const ALLOWED_TONES = ['Professional', 'Casual', 'Concise'];
export const ALLOWED_PROVIDERS = ['openai', 'claude'];

const MessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      enum: ['user', 'assistant', 'system'],
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    tone: {
      type: String,
      enum: ALLOWED_TONES,
      default: 'Professional',
    },
    provider: {
      type: String,
      enum: ALLOWED_PROVIDERS,
      default: 'openai',
    },
    model: {
      type: String,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const ConversationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      default: 'New Chat',
      maxlength: 120,
    },
    userId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    tone: {
      type: String,
      enum: ALLOWED_TONES,
      default: 'Professional',
    },
    provider: {
      type: String,
      enum: ALLOWED_PROVIDERS,
      default: 'openai',
    },
    model: {
      type: String,
      trim: true,
    },
    messages: [MessageSchema],
  },
  {
    timestamps: true,
  }
);

// Compound index for user conversations sorted by update time
ConversationSchema.index({ userId: 1, updatedAt: -1 });

// Text index for robust title and content search
ConversationSchema.index({
  title: 'text',
  'messages.content': 'text',
});

export const Conversation = mongoose.model('Conversation', ConversationSchema);
