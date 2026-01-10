// @ts-ignore - @sujoyu/pixi-live2d-display 类型定义可能不完整
import { Live2DModel } from '@sujoyu/pixi-live2d-display/cubism4';

type LipSyncState = { mouthOpen: number; mouthForm: number };
const lipSyncState = new WeakMap<Live2DModel, LipSyncState>();

/**
 * 更新嘴部参数
 * @param model Live2D 模型实例
 * @param mouthOpen 嘴部开合值 (0-2.3)
 * @param mouthForm 嘴部形状值 (-1 到 1)
 */
export function updateMouthParams(model: Live2DModel, mouthOpen: number, mouthForm: number): void {
  try {
    const internalModel = (model as any).internalModel;
    if (internalModel?.coreModel) {
      const coreModel = internalModel.coreModel;
      
      // 尝试多种方式更新参数
      const trySetParam = (paramName: string, value: number): boolean => {
        try {
          // 最优先：Cubism Core 的常见签名就是 setParameterValueById(id: string, value: number)
          // 在本项目里我们观测到 getParameterId 不存在，但 setParameterValueById 存在（见调试输出）
          if (typeof coreModel.setParameterValueById === 'function') {
            try {
              coreModel.setParameterValueById(paramName, value);
              return true;
            } catch (e) {
              // 继续尝试其他方法
            }
          }

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
                // 在 Cubism Core 中，id 通常是 string（例如 "ParamMouthOpenY"）
                const paramId = coreModel.getParameterIdByIndex?.(i);
                if (paramId === paramName && typeof coreModel.setParameterValueById === 'function') {
                  coreModel.setParameterValueById(paramId, value);
                  return true;
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
      const mouthOpenValue = Math.max(0, Math.min(mouthOpen, 2.3));
      const mouthOpenUpdated = trySetParam('ParamMouthOpenY', mouthOpenValue) || 
                               trySetParam('ParamMouthOpen', mouthOpenValue);

      // 尝试更新 ParamMouthForm (范围 -1 到 1)
      const mouthFormValue = Math.max(-1, Math.min(mouthForm, 1));
      const mouthFormUpdated = trySetParam('ParamMouthForm', mouthFormValue);

      // 调试信息（仅在第一次调用时输出）
      if (!(updateMouthParams as any)._debugged) {
        console.log('口型同步调试:', {
          mouthOpenUpdated,
          mouthFormUpdated,
          mouthOpen: mouthOpenValue,
          mouthForm: mouthFormValue,
          hasCoreModel: !!coreModel,
          methods: {
            getParameterId: typeof coreModel.getParameterId,
            setParameterValueById: typeof coreModel.setParameterValueById,
            getParameterCount: typeof coreModel.getParameterCount,
            getParameterIdByIndex: typeof coreModel.getParameterIdByIndex,
          }
        });
        (updateMouthParams as any)._debugged = true;
      }
    }
  } catch (error) {
    console.warn('更新嘴部参数失败:', error);
  }
}

/**
 * 设置当前帧要应用的口型参数（不直接写入；由 hook 在渲染前应用，避免被 motion/physics 覆盖）
 */
export function setLipSync(model: Live2DModel, mouthOpen: number, mouthForm: number): void {
  lipSyncState.set(model, { mouthOpen, mouthForm });
}

/**
 * 清除口型覆盖
 */
export function clearLipSync(model: Live2DModel): void {
  lipSyncState.delete(model);
}

/**
 * 在合适时机应用口型覆盖
 */
export function applyLipSync(model: Live2DModel): void {
  const state = lipSyncState.get(model);
  if (!state) return;
  updateMouthParams(model, state.mouthOpen, state.mouthForm);
}

/**
 * 确保在模型 update/_render 之后（渲染前）应用口型，避免被内部 motion/physics 每帧覆盖
 */
export function ensureLipSyncHook(model: Live2DModel): void {
  const anyModel = model as any;
  if (anyModel.__lipSyncHooked) return;
  anyModel.__lipSyncHooked = true;

  // 1) wrap update: 许多实现会在每帧 update 内计算 motion/physics
  if (typeof anyModel.update === 'function') {
    const originalUpdate = anyModel.update.bind(anyModel);
    anyModel.update = (...args: any[]) => {
      const result = originalUpdate(...args);
      try {
        applyLipSync(model);
      } catch {
        // ignore
      }
      return result;
    };
  }

  // 2) wrap _render: Pixi 会在渲染阶段调用 _render；在这里应用可以保证“最后写入”
  if (typeof anyModel._render === 'function') {
    const originalRender = anyModel._render.bind(anyModel);
    anyModel._render = (...args: any[]) => {
      try {
        applyLipSync(model);
      } catch {
        // ignore
      }
      return originalRender(...args);
    };
  }
}

/**
 * 重置嘴部参数
 * @param model Live2D 模型实例
 */
export function resetMouthParams(model: Live2DModel): void {
  clearLipSync(model);
  updateMouthParams(model, 0, 0);
}

/**
 * 使用 TTS 并手动控制口型同步
 * @param text 要播放的文字
 * @param model Live2D 模型实例
 * @param lang 语言代码（默认：zh-CN）
 * @param options TTS 选项
 * @returns Promise<void>
 */
export async function speakWithLipSync(
  text: string,
  model: Live2DModel,
  lang: string = 'zh-CN',
  options: {
    rate?: number;
    pitch?: number;
    volume?: number;
    /**
     * 口型强度 (0-1). 越大嘴巴开合越明显
     * 默认 1
     */
    intensity?: number;
  } = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    // 动态导入 ttsService 以避免循环依赖
    import('./ttsService').then(({ speak }) => {
      // 关键：确保口型写入发生在模型渲染前（避免被 motion/physics 覆盖）
      ensureLipSyncHook(model);

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
        const intensity = Math.max(0, Math.min(options.intensity ?? 1.0, 1.0));

        // 口型强度：为“肉眼明显开合”而设计（更接近 0↔最大值）
        // open01: 0~1
        const open01 =
          (Math.abs(Math.sin(elapsed * 8.5)) * 0.7 + Math.abs(Math.sin(elapsed * 15.5)) * 0.3);
        // 让开口更容易打到峰值（否则很多模型肉眼几乎看不出来）
        const open = Math.min(1, Math.pow(open01 * 1.6, 0.8));

        // 映射到模型参数范围：0 ~ 2.3（Akari 的 VTS 配置就是这个范围）
        // Komi 通常也能吃这个范围（会被内部 clamp）
        const mouthOpenValue = open * 2.3 * intensity;

        // mouthForm 范围: -1 到 1（稍微大一点更明显）
        const mouthForm = Math.sin(elapsed * 5.2) * 0.75 * intensity;

        // 不直接写入，由 hook 在渲染前应用
        setLipSync(model, mouthOpenValue, mouthForm);

        animationFrameId = requestAnimationFrame(updateLipSync);
      };

      // 启动口型同步动画（在播放开始前）
      console.log('开始播放 TTS，启动口型同步');
      updateLipSync();

      // 使用 ttsService 播放语音
      speak(text, lang, {
        rate: options.rate ?? 1.0,
        pitch: options.pitch ?? 1.0,
        volume: options.volume ?? 1.0,
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
    }).catch((error) => {
      console.error('加载 TTS 服务失败:', error);
      reject(error);
    });
  });
}
