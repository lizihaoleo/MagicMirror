import { useState } from 'react';
import { FloatingMagicMirrorRef } from './FloatingMagicMirror';
import { speak, stopSpeaking, isTTSSupported } from '../services/ttsService';

interface TTSTesterProps {
  mirrorRef: React.RefObject<FloatingMagicMirrorRef>;
}

const TTSTester: React.FC<TTSTesterProps> = ({ mirrorRef }) => {
  const [text, setText] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

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
      
      // 直接使用 TTS 服务并手动控制口型
      // 注意：Live2D 模型的 speak 方法需要音频文件 URL，不能直接传入文本
      console.log('使用 TTS + 手动口型同步');
      await speakWithLipSync(text, model);
    } catch (error: any) {
      console.error('播放 TTS 失败:', error);
    } finally {
      setIsSpeaking(false);
    }
  };

  /**
   * 使用 TTS 并手动控制口型同步
   */
  const speakWithLipSync = async (text: string, model: any): Promise<void> => {
    return new Promise((resolve, reject) => {
      let animationFrameId: number;
      let isPlaying = true;
      const startTime = Date.now();

      // 在播放过程中更新口型
      const updateLipSync = () => {
        if (!isPlaying) {
          if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
          }
          // 重置口型
          resetMouthParams(model);
          return;
        }

        // 基于时间的口型动画（模拟说话时的嘴部运动）
        const elapsed = (Date.now() - startTime) / 1000;
        // 使用多个频率的正弦波来模拟自然的说话节奏
        // mouthOpen 范围: 0-1 (Komi) 或 0-2.3 (Akari)
        const mouthOpen = Math.abs(Math.sin(elapsed * 8)) * 0.5 + 
                         Math.abs(Math.sin(elapsed * 15)) * 0.2 + 0.3;
        // mouthForm 范围: -1 到 1
        const mouthForm = Math.sin(elapsed * 6) * 0.4;

        updateMouthParams(model, mouthOpen, mouthForm);

        animationFrameId = requestAnimationFrame(updateLipSync);
      };

      // 启动口型同步动画（在播放开始前）
      console.log('开始播放 TTS，启动口型同步');
      updateLipSync();

      // 使用 ttsService 播放语音
      speak(text, 'zh-CN', {
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
      })
        .then(() => {
          console.log('TTS 播放完成');
          isPlaying = false;
          resetMouthParams(model);
          resolve();
        })
        .catch((error) => {
          console.error('TTS 播放错误:', error);
          isPlaying = false;
          resetMouthParams(model);
          reject(error);
        });
    });
  };

  /**
   * 更新嘴部参数
   */
  const updateMouthParams = (model: any, mouthOpen: number, mouthForm: number) => {
    try {
      const internalModel = model.internalModel;
      if (internalModel?.coreModel) {
        const coreModel = internalModel.coreModel;
        
        // 尝试多种方式更新参数
        const trySetParam = (paramName: string, value: number) => {
          try {
            // 方法1: 使用 getParameterId 和 setParameterValueById
            if (typeof coreModel.getParameterId === 'function' && 
                typeof coreModel.setParameterValueById === 'function') {
              const paramId = coreModel.getParameterId(paramName);
              if (paramId !== undefined && paramId !== null) {
                coreModel.setParameterValueById(paramId, value);
                return true;
              }
            }
            
            // 方法2: 遍历所有参数查找
            if (typeof coreModel.getParameterCount === 'function') {
              const paramCount = coreModel.getParameterCount();
              for (let i = 0; i < paramCount; i++) {
                try {
                  const paramId = coreModel.getParameterIdByIndex(i);
                  const paramInfo = coreModel.getParameterInfo(paramId);
                  if (paramInfo && paramInfo.name === paramName) {
                    if (typeof coreModel.setParameterValueById === 'function') {
                      coreModel.setParameterValueById(paramId, value);
                      return true;
                    }
                  }
                } catch (e) {
                  // 继续尝试下一个参数
                }
              }
            }
            
            // 方法3: 尝试直接使用 setParameterValue (如果存在)
            if (typeof (coreModel as any).setParameterValue === 'function') {
              (coreModel as any).setParameterValue(paramName, value);
              return true;
            }
          } catch (e) {
            // 忽略错误
          }
          return false;
        };

        // 尝试更新 ParamMouthOpenY 或 ParamMouthOpen
        // 注意：不同模型的参数范围可能不同
        // Komi: ParamMouthOpenY 范围 0-2.1
        // Akari: ParamMouthOpen 范围 0-2.3
        // mouthOpen 当前是 0.3-1.0，需要映射到模型范围
        const mouthOpenValue = mouthOpen * 2; // 映射到 0.6-2.0，适配模型范围
        const mouthOpenUpdated = trySetParam('ParamMouthOpenY', mouthOpenValue) || 
                                 trySetParam('ParamMouthOpen', mouthOpenValue);

        // 尝试更新 ParamMouthForm (范围 -1 到 1)
        const mouthFormValue = Math.max(-1, Math.min(mouthForm, 1));
        const mouthFormUpdated = trySetParam('ParamMouthForm', mouthFormValue);

        // 调试信息（仅在第一次调用时输出）
        if (!updateMouthParams._debugged) {
          console.log('口型同步调试:', {
            mouthOpenUpdated,
            mouthFormUpdated,
            mouthOpen,
            mouthForm,
            hasCoreModel: !!coreModel,
            methods: {
              getParameterId: typeof coreModel.getParameterId,
              setParameterValueById: typeof coreModel.setParameterValueById,
              getParameterCount: typeof coreModel.getParameterCount,
            }
          });
          updateMouthParams._debugged = true;
        }
      }
    } catch (error) {
      console.warn('更新嘴部参数失败:', error);
    }
  };

  /**
   * 重置嘴部参数
   */
  const resetMouthParams = (model: any) => {
    updateMouthParams(model, 0, 0);
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
