import type { AICapabilities, ProviderId } from '../../shared/ai';
import { AIError } from './errors';

const no: AICapabilities = { chat: false, structuredOutput: false, images: false, video: false, audio: false, transcribe: false, segmentTimestamps: false, wordTimestamps: false, known: false };
// Deliberately conservative: modalities are enabled only for names verified in
// the linked official documentation. Custom IDs remain editable in settings.
const openaiChat = ['gpt-6-astra', 'gpt-4o', 'gpt-4o-mini'];
const geminiChat = ['gemini-3.8-flash'];

export function capabilities(provider: ProviderId, model: string): AICapabilities {
  if (provider === 'openai') {
    if (['gpt-transcribe', 'gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'whisper-1'].includes(model)) return { ...no, audio: true, transcribe: true, segmentTimestamps: model === 'whisper-1', known: true };
    if (openaiChat.includes(model)) return { ...no, chat: true, structuredOutput: true, images: true, known: true };
  } else if (geminiChat.includes(model)) return { ...no, chat: true, structuredOutput: true, images: true, video: true, audio: true, transcribe: true, segmentTimestamps: true, known: true };
  // Custom model IDs may be used for text chat, but unverified modalities are never assumed.
  return { ...no, chat: true };
}

export function validateConfiguration(provider: ProviderId, model: string, key: string): AICapabilities {
  if (!['openai', 'gemini'].includes(provider)) throw new AIError('invalid_input', 'Choose a supported provider.');
  if (!key.trim() || key.length > 4096 || /[\r\n]/.test(key)) throw new AIError('authentication', 'Add a valid API key in settings.');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(model)) throw new AIError('invalid_input', 'The model identifier is invalid.');
  return capabilities(provider, model);
}
