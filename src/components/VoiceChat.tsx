import { useState, useEffect } from 'react';
import { 
  startRecording, 
  stopRecording, 
  transcribeAudio, 
  checkMicrophonePermission,
  initWhisper 
} from '../services/voiceService';
import { chat, ChatMessage, LLMResponse } from '../services/llmService';
import { speak, stopSpeaking, isTTSSupported } from '../services/ttsService';
import {
  applyExpressionAndMotion,
  getActualExpressions,
  getActualMotions,
  getAvailableExpressions,
  getAvailableMotions,
} from '../services/expressionService';
import { speakWithLipSync } from '../services/lipSyncService';
import { FloatingMagicMirrorRef } from './FloatingMagicMirror';
// @ts-ignore
import { Live2DModel } from '@sujoyu/pixi-live2d-display/cubism4';

interface VoiceChatProps {
  mirrorRef: React.RefObject<FloatingMagicMirrorRef>;
}

type ChatState = 'idle' | 'recording' | 'transcribing' | 'thinking' | 'speaking';

const VoiceChat: React.FC<VoiceChatProps> = ({ mirrorRef }) => {
  const [state, setState] = useState<ChatState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  const [isWhisperReady, setIsWhisperReady] = useState(false);
  const [transcribedText, setTranscribedText] = useState<string>('');

  const nextFrame = async () => {
    // 让浏览器先渲染一帧（移动端在 Whisper/LLM 等重计算前非常关键）
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  };

  const pickThinkingMotion = (model: Live2DModel): string | null => {
    const actual = getActualMotions(model).map(m => m.name);
    const preferred = ['Curious', 'Idle_2', 'Idle', 'Komi', 'Happy', 'Love', 'Shock'];
    return preferred.find(name => actual.includes(name)) || actual[0] || null;
  };

  const pickThinkingExpression = (model: Live2DModel): string | null => {
    const actual = getActualExpressions(model).map(e => e.name);
    const preferred = ['curious', 'eye_size', 'SignShock', 'EyesLove', 'blush', 'mouth'];
    return preferred.find(name => actual.includes(name)) || actual[0] || null;
  };

  const applyThinkingPose = async () => {
    const model = mirrorRef.current?.getModel();
    if (!model) return;

    // 这里不用 await，让 UI 更快进入状态；失败也不影响主流程
    try {
      const motion = pickThinkingMotion(model);
      if (motion) {
        mirrorRef.current?.playMotion(motion);
      }
      const expression = pickThinkingExpression(model);
      if (expression) {
        mirrorRef.current?.setExpression(expression);
      }
    } catch {
      // ignore
    }
  };

  /**
   * 在移动端“解锁”语音合成（需要在用户手势事件里调用，比如按钮点击）
   * 备注：放在组件内避免出现模块导出缓存/不一致导致的启动失败
   */
  const primeTTS = () => {
    try {
      if (!('speechSynthesis' in window)) return;
      try {
        window.speechSynthesis.resume();
      } catch {
        // ignore
      }
      const u = new SpeechSynthesisUtterance(' ');
      u.lang = 'en-US';
      u.volume = 0;
      u.rate = 10;
      u.pitch = 1;
      window.speechSynthesis.speak(u);
      setTimeout(() => {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }, 50);
    } catch {
      // ignore
    }
  };

  // 初始化 Whisper 模型（在组件加载时）
  useEffect(() => {
    let mounted = true;
    
    const initModel = async () => {
      try {
        console.log('预加载 Whisper 模型...');
        await initWhisper();
        if (mounted) {
          setIsWhisperReady(true);
          console.log('Whisper 模型已就绪');
        }
      } catch (error) {
        console.error('Whisper 模型初始化失败:', error);
        if (mounted) {
          setError('Whisper 模型加载失败，请刷新页面重试');
        }
      }
    };

    initModel();

    return () => {
      mounted = false;
    };
  }, []);

  // 检查浏览器支持
  useEffect(() => {
    if (!isTTSSupported()) {
      setError('您的浏览器不支持语音合成功能');
    }
  }, []);

  /**
   * 处理完整的对话流程
   */
  const handleConversation = async () => {
    try {
      setError(null);

      // 1. 检查麦克风权限
      const hasPermission = await checkMicrophonePermission();
      if (!hasPermission) {
        setError('需要麦克风权限才能使用语音对话功能');
        return;
      }

      // 2. 开始录音
      setState('recording');
      await startRecording();

      // 等待用户说话（这里可以添加自动停止逻辑，或让用户手动停止）
      // 暂时使用手动停止，用户需要再次点击按钮停止录音

    } catch (error: any) {
      console.error('对话流程错误:', error);
      setError(error.message || '发生未知错误');
      setState('idle');
    }
  };

  /**
   * 停止录音并处理
   */
  const stopAndProcess = async () => {
    try {
      if (state !== 'recording') return;

      // 先进入“识别中”状态并展示思考动作/表情，然后再做任何重计算
      setState('transcribing');
      await applyThinkingPose();
      await nextFrame();

      // 停止录音（相对轻量）
      const audioBlob = await stopRecording();
      if (!audioBlob) {
        setState('idle');
        return;
      }

      // 转写语音（重计算，可能导致掉帧/卡顿）
      const text = await transcribeAudio(audioBlob);
      setTranscribedText(text);

      if (!text || text.trim().length === 0) {
        setError('未能识别到语音，请重试');
        setState('idle');
        return;
      }

      // 添加到对话历史
      const userMessage: ChatMessage = { role: 'user', content: text };
      const newHistory = [...conversationHistory, userMessage];
      setConversationHistory(newHistory);

      // 调用 LLM（传入当前模型可用的表情和动作）
      setState('thinking');
      await applyThinkingPose();
      await nextFrame();
      const modelForLists = mirrorRef.current?.getModel() || null;
      // 优先使用 model3.json 中真实可用的 Name（避免把映射 key 传给 LLM）
      const availableExpressions =
        modelForLists ? getActualExpressions(modelForLists).map(e => e.name) : getAvailableExpressions();
      const availableMotions =
        modelForLists ? getActualMotions(modelForLists).map(m => m.name) : getAvailableMotions();
      const response: LLMResponse = await chat(text, conversationHistory, availableExpressions, availableMotions);

      // 更新对话历史
      const assistantMessage: ChatMessage = { 
        role: 'assistant', 
        content: response.text 
      };
      setConversationHistory([...newHistory, assistantMessage]);

      // 应用表情和动作
      const model = mirrorRef.current?.getModel();
      if (model) {
        if (response.expression) {
          console.log('应用表情:', response.expression);
          applyExpressionAndMotion(model, response.expression, response.motion);
        } else if (response.motion) {
          console.log('播放动作:', response.motion);
          applyExpressionAndMotion(model, undefined, response.motion);
        }
      } else {
        console.warn('无法获取 Live2D 模型实例');
      }

      // 播放 TTS 并同步口型
      setState('speaking');
      if (model) {
        await speakWithLipSync(response.text, model, 'zh-CN', {
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0,
        });
      } else {
        // 如果没有模型实例，使用普通 TTS（无口型同步）
        await speak(response.text, 'zh-CN', {
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0,
        });
      }

      setState('idle');
    } catch (error: any) {
      console.error('处理对话错误:', error);
      setError(error.message || '处理对话时发生错误');
      setState('idle');
    }
  };

  /**
   * 处理麦克风按钮点击
   */
  const handleMicClick = async () => {
    // 移动端需要在用户手势里先“解锁”speechSynthesis，否则异步链路结束后可能无法播放
    if (state === 'idle' || state === 'recording') {
      primeTTS();
    }

    if (state === 'idle') {
      await handleConversation();
    } else if (state === 'recording') {
      await stopAndProcess();
    } else if (state === 'speaking') {
      stopSpeaking();
      setState('idle');
    }
  };

  /**
   * 获取状态文本
   */
  const getStateText = (): string => {
    switch (state) {
      case 'idle':
        return '点击开始对话';
      case 'recording':
        return '正在录音...（再次点击停止）';
      case 'transcribing':
        return '正在识别语音...';
      case 'thinking':
        return '正在思考...';
      case 'speaking':
        return '正在说话...';
      default:
        return '';
    }
  };

  /**
   * 获取按钮图标
   */
  const getButtonIcon = (): string => {
    switch (state) {
      case 'recording':
        return '⏹️';
      case 'speaking':
        return '⏸️';
      default:
        return '🎤';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
      }}
    >
      {/* 麦克风按钮 */}
      <button
        onClick={handleMicClick}
        disabled={!isWhisperReady || state === 'transcribing' || state === 'thinking'}
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          border: 'none',
          backgroundColor: state === 'recording' ? '#ff4444' : '#4a9eff',
          color: 'white',
          fontSize: '24px',
          cursor: (!isWhisperReady || state === 'transcribing' || state === 'thinking') 
            ? 'not-allowed' 
            : 'pointer',
          opacity: (!isWhisperReady || state === 'transcribing' || state === 'thinking') 
            ? 0.5 
            : 1,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.3s ease',
        }}
        onMouseEnter={(e) => {
          if (e.currentTarget.style.cursor !== 'not-allowed') {
            e.currentTarget.style.transform = 'scale(1.1)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {getButtonIcon()}
      </button>

      {/* 状态文本 */}
      <div
        style={{
          color: 'white',
          fontSize: '14px',
          textAlign: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          padding: '8px 16px',
          borderRadius: '20px',
          minWidth: '200px',
        }}
      >
        {!isWhisperReady ? '正在加载 Whisper 模型...' : getStateText()}
      </div>

      {/* 错误提示 */}
      {error && (
        <div
          style={{
            color: '#ff4444',
            fontSize: '12px',
            textAlign: 'center',
            backgroundColor: 'rgba(255, 68, 68, 0.2)',
            padding: '8px 16px',
            borderRadius: '8px',
            maxWidth: '300px',
          }}
        >
          {error}
        </div>
      )}

      {/* 识别到的文本（可选，用于调试） */}
      {transcribedText && state !== 'recording' && (
        <div
          style={{
            color: '#aaa',
            fontSize: '12px',
            textAlign: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            padding: '6px 12px',
            borderRadius: '8px',
            maxWidth: '300px',
          }}
        >
          识别: {transcribedText}
        </div>
      )}
    </div>
  );
};

export default VoiceChat;

