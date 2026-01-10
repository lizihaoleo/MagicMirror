import { pipeline, env, Pipeline } from '@xenova/transformers';

// In worker: always download from CDN and cache in IndexedDB
env.allowLocalModels = false;

type InitMessage = {
  type: 'init';
  requestId: string;
  modelName: string;
  threads?: number;
};

type TranscribeMessage = {
  type: 'transcribe';
  requestId: string;
  audioBuffer: ArrayBuffer; // Float32Array buffer (16kHz)
  language?: string;
};

type IncomingMessage = InitMessage | TranscribeMessage;

type ResponseMessage =
  | { type: 'init:ok'; requestId: string }
  | { type: 'transcribe:ok'; requestId: string; text: string }
  | { type: 'error'; requestId: string; message: string; stack?: string };

let whisperModel: Pipeline | null = null;
let initInFlight: Promise<void> | null = null;

async function initModel(modelName: string, threads?: number): Promise<void> {
  if (whisperModel) return;
  if (initInFlight) return initInFlight;

  initInFlight = (async () => {
    try {
      // Limit wasm threads to reduce contention (mobile especially)
      if (typeof threads === 'number') {
        // @ts-ignore - env.backends may not be in types
        env.backends = env.backends || {};
        // @ts-ignore
        env.backends.onnx = env.backends.onnx || {};
        // @ts-ignore
        env.backends.onnx.wasm = env.backends.onnx.wasm || {};
        // @ts-ignore
        env.backends.onnx.wasm.numThreads = threads;
      }

      const pipelineOptions: any = {
        // @ts-ignore
        device: 'wasm',
        quantized: true,
      };

      whisperModel = await pipeline(
        'automatic-speech-recognition',
        modelName,
        pipelineOptions
      );
    } finally {
      initInFlight = null;
    }
  })();

  return initInFlight;
}

function post(msg: ResponseMessage) {
  (self as any).postMessage(msg);
}

(self as any).onmessage = async (event: MessageEvent<IncomingMessage>) => {
  const data = event.data;
  try {
    if (data.type === 'init') {
      await initModel(data.modelName, data.threads);
      post({ type: 'init:ok', requestId: data.requestId });
      return;
    }

    if (data.type === 'transcribe') {
      if (!whisperModel) {
        throw new Error('Whisper worker not initialized. Call init first.');
      }

      // Reconstruct Float32Array from transferred buffer
      const audio = new Float32Array(data.audioBuffer);
      const result = await whisperModel(audio, {
        language: data.language || 'zh',
        task: 'transcribe',
        return_timestamps: false,
      });

      const text = (result as any)?.text || '';
      post({ type: 'transcribe:ok', requestId: data.requestId, text: String(text).trim() });
      return;
    }

    throw new Error(`Unknown message type: ${(data as any).type}`);
  } catch (err: any) {
    post({
      type: 'error',
      requestId: (data as any)?.requestId || 'unknown',
      message: err?.message || String(err),
      stack: err?.stack,
    });
  }
};

