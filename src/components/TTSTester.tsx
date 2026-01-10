import { useState } from 'react';
import { FloatingMagicMirrorRef } from './FloatingMagicMirror';
import { stopSpeaking, isTTSSupported } from '../services/ttsService';
import { speakWithLipSync, resetMouthParams } from '../services/lipSyncService';

interface TTSTesterProps {
  mirrorRef: React.RefObject<FloatingMagicMirrorRef>;
}

const TTSTester: React.FC<TTSTesterProps> = ({ mirrorRef }) => {
  const [text, setText] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);

  /**
   * 播放 TTS 并同步口型
   */
  const handleSpeak = async () => {
    if (!text.trim()) {
      return;
    }

    const model = mirrorRef.current?.getModel();
    if (!model) {
      console.warn('无法获取 Live2D 模型实例');
      return;
    }

    try {
      setIsSpeaking(true);
      
      // 使用带口型同步的 TTS 服务
      console.log('使用 TTS + 手动口型同步');
      await speakWithLipSync(text, model, 'zh-CN', {
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
      });
    } catch (error: any) {
      console.error('播放 TTS 失败:', error);
    } finally {
      setIsSpeaking(false);
    }
  };


  /**
   * 停止播放
   */
  const handleStop = () => {
    stopSpeaking();
    setIsSpeaking(false);
    const model = mirrorRef.current?.getModel();
    if (model) {
      resetMouthParams(model);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 1001,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: isCollapsed ? '10px 15px' : '15px',
        borderRadius: '12px',
        color: 'white',
        minWidth: isCollapsed ? 'auto' : '300px',
        maxWidth: isCollapsed ? 'auto' : '400px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
        transition: 'all 0.3s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: isCollapsed ? '0' : '12px',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '16px',
            color: '#4a9eff',
            cursor: 'pointer',
          }}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          🔊 TTS 测试
        </h3>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#4a9eff',
            fontSize: '18px',
            cursor: 'pointer',
            padding: '0 5px',
            lineHeight: '1',
          }}
          title={isCollapsed ? '展开' : '收缩'}
        >
          {isCollapsed ? '▶' : '▼'}
        </button>
      </div>

      {!isCollapsed && (
        <>
          {!isTTSSupported() && (
            <div
              style={{
                marginBottom: '12px',
                padding: '8px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255, 68, 68, 0.2)',
                color: '#ff4444',
                fontSize: '12px',
              }}
            >
              您的浏览器不支持语音合成功能
            </div>
          )}

          <div style={{ marginBottom: '12px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '13px',
                color: '#aaa',
              }}
            >
              输入文字:
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="输入要播放的文字..."
              disabled={isSpeaking}
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '8px',
                borderRadius: '6px',
                backgroundColor: '#1a1a1a',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                fontSize: '14px',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSpeak}
              disabled={!text.trim() || isSpeaking || !isTTSSupported()}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '6px',
                backgroundColor: text.trim() && !isSpeaking && isTTSSupported() ? '#4a9eff' : '#666',
                color: 'white',
                border: 'none',
                cursor: text.trim() && !isSpeaking && isTTSSupported() ? 'pointer' : 'not-allowed',
                fontSize: '14px',
              }}
            >
              {isSpeaking ? '播放中...' : '播放'}
            </button>
            {isSpeaking && (
              <button
                onClick={handleStop}
                style={{
                  padding: '10px 16px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 68, 68, 0.3)',
                  color: '#ff4444',
                  border: '1px solid rgba(255, 68, 68, 0.5)',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                停止
              </button>
            )}
          </div>

          <div
            style={{
              marginTop: '10px',
              padding: '8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(74, 158, 255, 0.1)',
              fontSize: '11px',
              color: '#aaa',
              lineHeight: '1.4',
            }}
          >
            💡 提示：播放时会自动同步口型
          </div>
        </>
      )}
    </div>
  );
};

export default TTSTester;
