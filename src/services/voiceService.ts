import { pipeline, Pipeline, env, read_audio } from '@xenova/transformers';

// 禁用本地模型检查，避免从本地服务器加载不完整的模型文件
// 这样会直接从 Hugging Face CDN 下载模型
env.allowLocalModels = false;

// Whisper 模型实例缓存
let whisperModel: Pipeline | null = null;
let isInitializing = false;
let initPromise: Promise<Pipeline> | null = null;

// Worker 模式（让主线程不卡）
let whisperWorker: Worker | null = null;
let workerInitPromise: Promise<void> | null = null;
let requestSeq = 0;
const pending = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>();

type WorkerResponse =
  | { type: 'init:ok'; requestId: string }
  | { type: 'transcribe:ok'; requestId: string; text: string }
  | { type: 'error'; requestId: string; message: string; stack?: string };

// 录音相关
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let audioStream: MediaStream | null = null;

let platformLogged = false;

function getRuntimePlatform() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  const hc = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 2) : 2;
  return { ua, isMobile, hc };
}

function pickWhisperModelName() {
  // 简化：所有平台默认 whisper-base；如需覆盖只用 VITE_WHISPER_MODEL
  let modelName = (import.meta.env.VITE_WHISPER_MODEL as string | undefined) || 'Xenova/whisper-base';

  // 检查是否尝试使用不支持的模型
  if (modelName.includes('large-v3-turbo') && !modelName.startsWith('Xenova/')) {
    console.warn('whisper-large-v3-turbo 目前还没有 Xenova ONNX 版本，回退到 whisper-base');
    console.warn('Xenova 转换的模型列表: https://huggingface.co/Xenova');
    modelName = 'Xenova/whisper-base';
  }

  return modelName;
}

function pickWhisperThreads() {
  const { isMobile, hc } = getRuntimePlatform();
  // 手机：1 线程最稳；桌面：最多 2 线程，避免抢占 UI
  return isMobile ? 1 : Math.min(2, hc);
}

function supportsWhisperWorker(): boolean {
  try {
    return typeof Worker !== 'undefined';
  } catch {
    return false;
  }
}

function makeRequestId(prefix: string) {
  requestSeq += 1;
  return `${prefix}-${Date.now()}-${requestSeq}`;
}

function ensureWorker(): Worker | null {
  if (!supportsWhisperWorker()) return null;
  if (whisperWorker) return whisperWorker;

  try {
    whisperWorker = new Worker(new URL('../workers/whisperWorker.ts', import.meta.url), { type: 'module' });
    whisperWorker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const msg = ev.data;
      const entry = pending.get(msg.requestId);
      if (!entry) return;
      pending.delete(msg.requestId);

      if (msg.type === 'error') {
        const e = new Error(msg.message);
        (e as any).stack = msg.stack || (e as any).stack;
        entry.reject(e);
      } else {
        entry.resolve(msg);
      }
    };
    whisperWorker.onerror = (err) => {
      console.error('Whisper worker error:', err);
    };
    return whisperWorker;
  } catch (e) {
    console.warn('无法创建 Whisper Worker，回退到主线程推理:', e);
    whisperWorker = null;
    return null;
  }
}

function postToWorker(message: any, transfer?: Transferable[]): Promise<any> {
  const w = ensureWorker();
  if (!w) return Promise.reject(new Error('Whisper worker unavailable'));
  return new Promise((resolve, reject) => {
    pending.set(message.requestId, { resolve, reject });
    w.postMessage(message, transfer || []);
  });
}

/**
 * 初始化 Whisper 模型（仅首次加载）
 */
export async function initWhisper(): Promise<Pipeline> {
  // Debug once: verify mobile detection + UA
  if (!platformLogged) {
    const { ua, isMobile, hc } = getRuntimePlatform();
    // 用“纯文本 + 分行”输出，避免某些控制台把对象折叠导致看不见值
    console.log(`[Whisper] isMobile=${isMobile} hardwareConcurrency=${hc}`);
    console.log(`[Whisper] userAgent=${ua}`);
    console.log('[Whisper] runtime platform (object):', { isMobile, hardwareConcurrency: hc, userAgent: ua });
    platformLogged = true;
  }

  // 优先使用 Worker 初始化（避免主线程卡顿）
  const w = ensureWorker();
  if (w) {
    if (workerInitPromise) {
      await workerInitPromise;
      // 返回一个占位对象（仅用于表示 ready；转写会走 worker）
      return (whisperModel as any) || ({} as any);
    }

    const { isMobile, hc } = getRuntimePlatform();
    const modelName = pickWhisperModelName();
    const threads = pickWhisperThreads();

    workerInitPromise = (async () => {
      const requestId = makeRequestId('init');
      await postToWorker({ type: 'init', requestId, modelName, threads });
      console.log('Whisper Worker 已就绪:', { modelName, threads, isMobile, hardwareConcurrency: hc });
    })();

    await workerInitPromise;
    return (whisperModel as any) || ({} as any);
  }

  if (whisperModel) {
    return whisperModel;
  }

  if (isInitializing && initPromise) {
    return initPromise;
  }

  isInitializing = true;
  initPromise = (async () => {
    try {
      console.log('开始加载 Whisper 模型...');
      
      // 默认模型配置
      // 可选模型（Xenova 已转换的 ONNX 模型）：
      // - 'Xenova/whisper-tiny' (39MB, 最快，准确度一般)
      // - 'Xenova/whisper-base' (74MB, 平衡，推荐) ⭐
      // - 'onnx-community/whisper-base' (ONNX Community 版本，也可用)
      // - 'Xenova/whisper-small' (242MB, 更准确)
      // - 'Xenova/whisper-medium' (769MB, 最准确，但很大)
      // 
      // 注意：whisper-large-v3-turbo 目前还没有 Xenova ONNX 版本
      // 如果将来可用，可以通过 VITE_WHISPER_MODEL 环境变量配置
      const { isMobile, hc } = getRuntimePlatform();
      let modelName = pickWhisperModelName();
      
      // 从 CDN 加载模型（transformers.js 会自动缓存到 IndexedDB）
      console.log('从 CDN 加载模型:', modelName);
      console.log('提示：首次加载会自动下载模型到浏览器缓存（IndexedDB）');
      console.log('提示：下载完成后，后续使用会直接从缓存加载，速度更快');
      if (modelName.includes('large') || modelName.includes('turbo')) {
        console.log('警告：large/turbo 模型较大，首次下载可能需要较长时间');
      }
      
      const pipelineOptions: any = {
        // @ts-ignore - transformers.js 支持这些选项，但类型定义可能不完整
        device: 'wasm', // 使用 WebAssembly
        quantized: true, // 使用量化模型以减小体积
      };

      // 减少主线程压力：限制 wasm 线程数（移动端尤其明显）
      // transformers.js 会把该配置透传给 onnxruntime-web wasm 后端
      try {
        const threads = pickWhisperThreads();
        // @ts-ignore - env.backends 可能未在类型定义中暴露
        env.backends = env.backends || {};
        // @ts-ignore
        env.backends.onnx = env.backends.onnx || {};
        // @ts-ignore
        env.backends.onnx.wasm = env.backends.onnx.wasm || {};
        // @ts-ignore
        env.backends.onnx.wasm.numThreads = threads;
        console.log('Whisper WASM threads:', threads, '(isMobile:', isMobile, 'hardwareConcurrency:', hc, ')');
      } catch {
        // ignore
      }
      
      // 不设置 local_files_only，始终允许从 CDN 下载
      // transformers.js 会自动将模型缓存到浏览器的 IndexedDB
      // 这样即使网络有问题，后续使用也会从缓存加载
      console.log('模型将从 CDN 下载并缓存到浏览器');
      
      whisperModel = await pipeline(
        'automatic-speech-recognition',
        modelName,
        pipelineOptions
      );
      console.log('Whisper 模型加载完成');
      isInitializing = false;
      return whisperModel;
    } catch (error) {
      isInitializing = false;
      initPromise = null;
      console.error('Whisper 模型加载失败:', error);
      throw error;
    }
  })();

  return initPromise;
}

/**
 * 开始录音
 */
export async function startRecording(): Promise<void> {
  let stream: MediaStream | null = null;
  try {
    // 请求麦克风权限
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // 创建 MediaRecorder
    const mimeType = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      // 清理已打开的流
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      throw new Error(`不支持的音频格式: ${mimeType}`);
    }
    
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
    });

    audioChunks = [];
    audioStream = stream; // 保存引用以便后续清理

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.start();
    console.log('开始录音');
  } catch (error) {
    console.error('录音启动失败:', error);
    // 确保清理已打开的流
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    // 清理引用
    audioStream = null;
    mediaRecorder = null;
    throw error;
  }
}

/**
 * 停止录音并返回音频 Blob
 */
export async function stopRecording(): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      resolve(null);
      return;
    }

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      audioChunks = [];
      
      // 停止音频流
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
      }

      console.log('录音停止，音频大小:', audioBlob.size, 'bytes');
      resolve(audioBlob);
    };

    mediaRecorder.stop();
    mediaRecorder = null;
  });
}

// 注意：不再需要手动转换音频格式
// read_audio 函数会自动处理各种音频格式（WebM, WAV, MP3 等）
// 并返回 Float32Array 格式的音频数据，这正是 Whisper 模型需要的

/**
 * 使用本地 Whisper 模型转写音频
 */
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  try {
    // 确保模型已加载（可能是 worker）
    await initWhisper();

    console.log('开始语音识别...');
    
    // 将 Blob 转换为 URL
    const audioUrl = URL.createObjectURL(audioBlob);
    
    try {
      // 使用 read_audio 读取音频数据（主线程做 I/O / 解码）
      // 然后把 Float32Array 传给 worker 进行推理（避免主线程卡顿）
      const audioData = await read_audio(audioUrl, 16000);
      
      console.log('音频数据读取完成，长度:', audioData.length);

      const w = ensureWorker();
      if (w) {
        const requestId = makeRequestId('transcribe');
        const resp = await postToWorker(
          { type: 'transcribe', requestId, audioBuffer: audioData.buffer, language: 'zh' },
          [audioData.buffer]
        );
        const text = (resp as any)?.text || '';
        console.log('识别结果(Worker):', text);
        return String(text).trim();
      }

      // Worker 不可用时回退到主线程推理
      const model = whisperModel || (await initWhisper());
      const result = await (model as any)(audioData, {
        language: 'zh',
        task: 'transcribe',
        return_timestamps: false,
      });
      const text = (result as any).text || '';
      console.log('识别结果(Main):', text);
      return String(text).trim();
    } finally {
      // 清理临时 URL
      URL.revokeObjectURL(audioUrl);
    }
  } catch (error) {
    console.error('语音识别失败:', error);
    throw error;
  }
}

/**
 * 检查麦克风权限
 */
export async function checkMicrophonePermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error('麦克风权限被拒绝:', error);
    return false;
  }
}

