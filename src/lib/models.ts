export type ModelType = 'language' | 'embedding' | 'image' | 'video';

export type GatewayModel = {
  id: string;
  name: string;
  description?: string;
  type: ModelType;
  context_window?: number;
  max_tokens?: number;
  tags?: string[];
  pricing?: {
    input?: string;
    output?: string;
    input_cache_read?: string;
    input_cache_write?: string;
    image?: string;
    web_search?: string;
  };
  owned_by?: string;
};

// Minimal fallback used only if /v1/models is unreachable.
// Runtime source of truth is the dynamic endpoint (see api/models/route.ts).
export const STATIC_MODEL_FALLBACK: GatewayModel[] = [
  { id: 'anthropic/claude-opus-4.6', name: 'Claude Opus 4.6', type: 'language' },
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', type: 'language' },
  { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5', type: 'language' },
  { id: 'openai/gpt-5.2', name: 'GPT-5.2', type: 'language' },
  { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', type: 'language' },
  { id: 'openai/gpt-5-nano', name: 'GPT-5 Nano', type: 'language' },
  { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro', type: 'language' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', type: 'language' },
  { id: 'xai/grok-4.1-fast-reasoning', name: 'Grok 4.1 Fast Reasoning', type: 'language' },
  // Multimodal (returns images via generateText in result.files)
  {
    id: 'google/gemini-2.5-flash-image',
    name: 'Nano Banana (Gemini 2.5 Flash Image)',
    type: 'language',
    tags: ['vision'],
  },
  {
    id: 'google/gemini-3-pro-image',
    name: 'Nano Banana Pro (Gemini 3 Pro Image)',
    type: 'language',
    tags: ['vision'],
  },
  // Image-only (experimental_generateImage)
  { id: 'bfl/flux-2-pro', name: 'FLUX.2 Pro', type: 'image' },
  { id: 'bfl/flux-2-flex', name: 'FLUX.2 Flex', type: 'image' },
  { id: 'bfl/flux-2-max', name: 'FLUX.2 Max', type: 'image' },
  { id: 'bfl/flux-2-klein-4b', name: 'FLUX.2 Klein 4B', type: 'image' },
  { id: 'bfl/flux-2-klein-9b', name: 'FLUX.2 Klein 9B', type: 'image' },
  { id: 'bfl/flux-kontext-pro', name: 'FLUX.1 Kontext Pro', type: 'image' },
  { id: 'bfl/flux-kontext-max', name: 'FLUX.1 Kontext Max', type: 'image' },
  { id: 'bfl/flux-pro-1.1', name: 'FLUX 1.1 Pro', type: 'image' },
  { id: 'bfl/flux-pro-1.1-ultra', name: 'FLUX 1.1 Pro Ultra', type: 'image' },
  { id: 'google/imagen-4.0-generate-001', name: 'Imagen 4', type: 'image' },
  { id: 'google/imagen-4.0-ultra-generate-001', name: 'Imagen 4 Ultra', type: 'image' },
  { id: 'google/imagen-4.0-fast-generate-001', name: 'Imagen 4 Fast', type: 'image' },
  { id: 'recraft/recraft-v3', name: 'Recraft V3', type: 'image' },
  { id: 'recraft/recraft-v2', name: 'Recraft V2', type: 'image' },
];
