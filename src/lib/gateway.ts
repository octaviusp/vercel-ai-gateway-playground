import { createGateway } from '@ai-sdk/gateway';

// The default gateway provider. AI_GATEWAY_API_KEY is read from env automatically.
export const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY,
  baseURL: 'https://ai-gateway.vercel.sh/v1/ai',
});
