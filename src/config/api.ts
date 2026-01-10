/**
 * LLM API 配置
 */
export const LLM_CONFIG = {
  // 使用 Groq API（推荐）
  groq: {
    apiKey: import.meta.env.VITE_GROQ_API_KEY || '',
    baseURL: 'https://api.groq.com/openai/v1',
    model: 'llama-3.1-8b-instant',
  },
  
  // 使用 Hugging Face Inference API（备选）
  huggingface: {
    apiKey: import.meta.env.VITE_HUGGINGFACE_API_KEY || '',
    model: 'meta-llama/Meta-Llama-3-8B-Instruct',
  },
  
  // 默认使用的提供商
  defaultProvider: (import.meta.env.VITE_LLM_PROVIDER || 'groq') as 'groq' | 'huggingface',
};

/**
 * 获取当前使用的 API Key
 */
export function getApiKey(): string {
  const provider = LLM_CONFIG.defaultProvider;
  return provider === 'groq' 
    ? LLM_CONFIG.groq.apiKey 
    : LLM_CONFIG.huggingface.apiKey;
}

/**
 * 检查 API Key 是否已配置
 */
export function isApiKeyConfigured(): boolean {
  return !!getApiKey();
}

