import { pipeline, Pipeline, env, read_audio } from '@xenova/transformers';

// 禁用本地模型检查，避免从本地服务器加载不完整的模型文件
// 这样会直接从 Hugging Face CDN 下载模型
env.allowLocalModels = false;

// Whisper 模型实例缓存
let whisperModel: Pipeline | null = null;
let isInitializing = false;
let initPromise: Promise<Pipeline> | null = null;

// 录音相关
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let audioStream: MediaStream | null = null;

/**
 * 初始化 Whisper 模型（仅首次加载）
 */
export async function initWhisper(): Promise<Pipeline> {
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
      const defaultModel = import.meta.env.VITE_WHISPER_MODEL || 'Xenova/whisper-base';
      let modelName = defaultModel;
      
      // 检查是否尝试使用不支持的模型
      if (modelName.includes('large-v3-turbo') && !modelName.startsWith('Xenova/')) {
        console.warn('whisper-large-v3-turbo 目前还没有 Xenova ONNX 版本，回退到 whisper-base');
        console.warn('Xenova 转换的模型列表: https://huggingface.co/Xenova');
        modelName = 'Xenova/whisper-base';
      }
      
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
  try {
    // 请求麦克风权限
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // 创建 MediaRecorder
    mediaRecorder = new MediaRecorder(audioStream, {
      mimeType: 'audio/webm;codecs=opus',
    });

    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.start();
    console.log('开始录音');
  } catch (error) {
    console.error('录音启动失败:', error);
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
    // 确保模型已加载
    const model = await initWhisper();

    console.log('开始语音识别...');
    
    // 将 Blob 转换为 URL
    const audioUrl = URL.createObjectURL(audioBlob);
    
    try {
      // 使用 read_audio 读取音频数据
      // Whisper 模型需要 Float32Array 格式的音频数据
      // read_audio 的第二个参数是采样率（number），Whisper 使用 16kHz
      const audioData = await read_audio(audioUrl, 16000);
      
      console.log('音频数据读取完成，长度:', audioData.length);
      
      // 使用 Whisper 转写
      const result = await model(audioData, {
        language: 'zh', // 中文
        task: 'transcribe',
        return_timestamps: false,
      });

      const text = (result as any).text || '';
      console.log('识别结果:', text);
      
      return text.trim();
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

