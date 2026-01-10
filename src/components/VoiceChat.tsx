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
import { applyExpressionAndMotion, getAvailableExpressions, getAvailableMotions } from '../services/expressionService';
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

      // 停止录音
      const audioBlob = await stopRecording();
      if (!audioBlob) {
        setState('idle');
        return;
      }

      // 转写语音
      setState('transcribing');
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
      const availableExpressions = getAvailableExpressions();
      const availableMotions = getAvailableMotions();
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

      // 播放 TTS
      setState('speaking');
      await speak(response.text, 'zh-CN', {
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
      });

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

