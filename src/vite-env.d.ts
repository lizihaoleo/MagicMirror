/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GROQ_API_KEY?: string;
  readonly VITE_HUGGINGFACE_API_KEY?: string;
  readonly VITE_HUGGINGFACE_MODEL?: string;
  readonly VITE_LLM_API_KEY?: string;
  readonly VITE_LLM_PROVIDER?: 'groq' | 'huggingface';
  readonly VITE_WHISPER_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

