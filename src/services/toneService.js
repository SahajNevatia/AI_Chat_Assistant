export const TONE_SYSTEM_INSTRUCTIONS = {
  Professional:
    'You are a professional, articulate, and authoritative AI assistant. Deliver well-structured, thorough, and objective responses. Use precise terminology, maintain polite formality, and format content clearly with logical sections or bullet points where helpful.',
  Casual:
    'You are a friendly, conversational, and approachable AI assistant. Communicate warmly and naturally, using everyday conversational language, engaging explanations, and an upbeat, supportive vibe while remaining helpful.',
  Concise:
    'You are an ultra-direct, concise AI assistant. Provide high-density, strictly factual answers without filler, conversational pleasantries, or preamble. Present the solution or core facts in as few clear words as possible.',
};

export function validateTone(tone) {
  if (!tone || typeof tone !== 'string') {
    return 'Professional';
  }
  const normalized = tone.trim();
  const matched = Object.keys(TONE_SYSTEM_INSTRUCTIONS).find(
    (key) => key.toLowerCase() === normalized.toLowerCase()
  );

  if (!matched) {
    throw new Error(
      `Invalid tone "${tone}". Allowed tones are: ${Object.keys(
        TONE_SYSTEM_INSTRUCTIONS
      ).join(', ')}`
    );
  }

  return matched;
}

export function getSystemInstructionForTone(tone) {
  const validTone = validateTone(tone);
  return TONE_SYSTEM_INSTRUCTIONS[validTone];
}
