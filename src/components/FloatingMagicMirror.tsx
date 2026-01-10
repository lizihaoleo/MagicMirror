import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import * as PIXI from "pixi.js";
// @ts-ignore - @sujoyu/pixi-live2d-display 类型定义可能不完整
import { Live2DModel } from "@sujoyu/pixi-live2d-display/cubism4";
import { setExpression as setExpressionService, playMotion as playMotionService } from "../services/expressionService";

interface FloatingMagicMirrorProps {
  modelPath: string;
  modelConfig?: {
    position?: { x?: number; y?: number };
    scale?: { factor?: number; baseWidth?: number; baseHeight?: number };
  };
}

export interface FloatingMagicMirrorRef {
  getModel: () => Live2DModel | null;
  setExpression: (expressionName: string) => void;
  playMotion: (motionName: string, priority?: number) => Promise<void>;
}

const FloatingMagicMirror = forwardRef<FloatingMagicMirrorRef, FloatingMagicMirrorProps>(({
  modelPath,
  modelConfig,
}, ref) => {
  // 使用 ref 来跟踪之前的 modelPath，以便在路径变化时重新加载模型
  const previousModelPathRef = useRef<string>(modelPath);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // 暴露模型控制方法给父组件
  useImperativeHandle(ref, () => ({
    getModel: () => modelRef.current,
    setExpression: (expressionName: string) => {
      if (modelRef.current) {
        // 使用 expressionService 来处理表情设置（包含模型特定的逻辑）
        setExpressionService(modelRef.current, expressionName);
      } else {
        console.warn('模型实例不存在');
      }
    },
    playMotion: async (motionName: string, priority: number = 0) => {
      if (modelRef.current) {
        // 使用 expressionService 来处理动作播放（包含模型特定的逻辑）
        await playMotionService(modelRef.current, motionName, priority);
      } else {
        console.warn('模型实例不存在');
      }
    },
  }));

  // 当 modelPath 变化时，重新加载模型
  useEffect(() => {
    if (previousModelPathRef.current !== modelPath && appRef.current && modelRef.current) {
      console.log('模型路径已更改，准备重新加载:', previousModelPathRef.current, '->', modelPath);
      
      // 从 stage 中移除旧模型
      if (modelRef.current && appRef.current.stage) {
        try {
          appRef.current.stage.removeChild(modelRef.current);
          modelRef.current.destroy();
        } catch (e) {
          console.warn('移除旧模型时出错:', e);
        }
        modelRef.current = null;
      }
      
      // 加载新模型
      const loadNewModel = async () => {
        try {
          const newModel = await Live2DModel.from(modelPath);
          
          // 设置模型位置和大小
          newModel.anchor.set(0.5, 0.5);
          const screenWidth = window.innerWidth;
          const screenHeight = window.innerHeight;
          
          // 使用模型配置或默认值
          const positionX = modelConfig?.position?.x ?? 0;
          const positionY = modelConfig?.position?.y ?? 0;
          const scaleFactor = modelConfig?.scale?.factor ?? 0.8;
          const baseWidth = modelConfig?.scale?.baseWidth ?? 800;
          const baseHeight = modelConfig?.scale?.baseHeight ?? 1000;
          
          // 计算位置
          newModel.x = screenWidth / 2 + (screenWidth * positionX);
          newModel.y = screenHeight / 2 + (screenHeight * positionY);
          
          // 计算缩放
          const scale = Math.min(screenWidth / baseWidth, screenHeight / baseHeight) * scaleFactor;
          newModel.scale.set(scale);
          
          console.log('新模型位置和缩放设置:', {
            x: newModel.x,
            y: newModel.y,
            scale: scale,
            config: modelConfig,
          });
          
          // 添加到 stage
          appRef.current?.stage.addChild(newModel);
          modelRef.current = newModel;
          
          console.log('新模型加载成功:', modelPath);
        } catch (error) {
          console.error('加载新模型失败:', error);
        }
      };
      
      loadNewModel();
      previousModelPathRef.current = modelPath;
    } else if (previousModelPathRef.current !== modelPath) {
      previousModelPathRef.current = modelPath;
    }
  }, [modelPath]);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // 创建 canvas 元素
    const canvas = document.createElement("canvas");
    containerRef.current.appendChild(canvas);
    canvasRef.current = canvas;

    let isMounted = true;

    // 暴露 PIXI 到 window（pixi-live2d-display 需要）
    if (typeof window !== "undefined") {
      (window as any).PIXI = PIXI;
    }

    // 检查 Cubism Core 是否已加载
    const checkCubismCore = () => {
      return new Promise<void>((resolve, reject) => {
        if ((window as any).Live2DCubismCore) {
          console.log("Cubism Core 已加载");
          resolve();
          return;
        }

        let attempts = 0;
        const maxAttempts = 50;
        const checkInterval = setInterval(() => {
          attempts++;
          if ((window as any).Live2DCubismCore) {
            console.log("Cubism Core 已加载");
            clearInterval(checkInterval);
            resolve();
          } else if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            reject(
              new Error(
                "Cubism Core 加载超时，请确认 live2dcubismcore.min.js 已正确加载"
              )
            );
          }
        }, 100);
      });
    };

    // 初始化 PixiJS 应用
    const initApp = async () => {
      try {
        await checkCubismCore();

        // 使用 PixiJS v7 API
        const app = new PIXI.Application({
          view: canvas,
          width: window.innerWidth,
          height: window.innerHeight,
          backgroundColor: 0x050510, // 暗色魔法风格背景
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });

        // 等待 Application 完全初始化（v7 中 renderer 是同步创建的）
        if (!app.renderer) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        if (!isMounted) {
          try {
            app.destroy(true);
          } catch (e) {
            // 忽略清理错误
          }
          return;
        }

        appRef.current = app;
        console.log("PixiJS Application 初始化成功");

        // 确保交互系统可用（PixiJS v7 需要）
        // 在 v7 中，交互系统从 plugins.interaction 改为 events
        // 但 pixi-live2d-display 可能还在使用旧的 API
        if (!app.renderer.plugins.interaction && !app.renderer.events) {
          console.warn("交互系统未初始化，Live2D 交互功能可能不可用");
        }

        // 加载 Live2D 模型
        // 使用当前的 modelPath（从 props 获取）
        const currentModelPath = modelPath;
        console.log("开始加载 Live2D 模型:", currentModelPath);

        try {
          const model = await Live2DModel.from(currentModelPath);

          if (!isMounted) {
            model.destroy();
            return;
          }

          modelRef.current = model;
          console.log("Live2D 模型加载成功");
          
          // 调试：检查模型的所有方法和属性
          console.log("模型可用方法:", Object.getOwnPropertyNames(Object.getPrototypeOf(model)));
          console.log("模型 expression 方法:", typeof (model as any).expression);
          console.log("模型 motion 方法:", typeof model.motion);
          console.log("模型内部属性:", Object.keys(model));
          
          // 检查模型是否有内部模型
          if ((model as any).internalModel) {
            console.log("内部模型:", (model as any).internalModel);
            console.log("内部模型方法:", Object.getOwnPropertyNames(Object.getPrototypeOf((model as any).internalModel)));
          }

          // 禁用交互注册以避免兼容性问题
          // 在 PixiJS v7 中，交互系统已更改，需要手动处理
          if ((model as any).registerInteraction) {
            const originalRegister = (model as any).registerInteraction.bind(model);
            (model as any).registerInteraction = function() {
              try {
                // 尝试注册交互，如果失败则忽略
                if (app.renderer?.plugins?.interaction || app.renderer?.events) {
                  return originalRegister();
                }
              } catch (e) {
                // 忽略交互注册错误
                console.warn("交互注册失败，继续运行:", e);
              }
            };
          }

          // 设置模型位置和大小
          model.anchor.set(0.5, 0.5);
          // 使用实际的窗口尺寸（不考虑 devicePixelRatio）
          const screenWidth = window.innerWidth;
          const screenHeight = window.innerHeight;
          
          // 使用模型配置或默认值
          const positionX = modelConfig?.position?.x ?? 0;
          const positionY = modelConfig?.position?.y ?? 0;
          const scaleFactor = modelConfig?.scale?.factor ?? 0.8;
          const baseWidth = modelConfig?.scale?.baseWidth ?? 800;
          const baseHeight = modelConfig?.scale?.baseHeight ?? 1000;
          
          // 计算位置（positionX/Y 是相对偏移，0 表示中心，-0.5 表示向上/左移动 50%）
          model.x = screenWidth / 2 + (screenWidth * positionX);
          model.y = screenHeight / 2 + (screenHeight * positionY);
          
          // 计算缩放
          const scale = Math.min(screenWidth / baseWidth, screenHeight / baseHeight) * scaleFactor;
          model.scale.set(scale);
          
          console.log('模型位置和缩放设置:', {
            x: model.x,
            y: model.y,
            scale: scale,
            config: modelConfig,
            screenSize: `${screenWidth}x${screenHeight}`,
          });

          // Live2DModel 继承自 PIXI.Container，可以直接添加到舞台
          app.stage.addChild(model as any);

          // 禁用交互以避免兼容性问题（如果需要交互，可以后续启用）
          // 注意：pixi-live2d-display 在 v7 中可能有交互系统兼容性问题
          // 暂时禁用交互功能
          try {
            // 设置交互（如果模型支持）
            model.on("hit", (hitAreas: string[]) => {
              if (hitAreas.includes("body")) {
                try {
                  model.motion("tap_body", 0);
                } catch (e) {
                  // 如果动作不存在，忽略错误
                }
              }
            });
          } catch (e) {
            console.warn("交互功能初始化失败，继续运行:", e);
          }


          // 保存初始位置（用于浮动动画）
          const initialX = model.x;
          const initialY = model.y;

          // 使用 PixiJS ticker 进行动画循环（确保模型自动更新）
          app.ticker.add(() => {
            if (!isMounted || !appRef.current || !modelRef.current) return;

            const time = (Date.now() - startTimeRef.current) / 1000;

            // 上下浮动动画
            const floatY = Math.sin(time * 0.8) * 30;
            // 轻微左右旋转
            const rotation = Math.sin(time * 0.5) * 0.15;

            // 应用动画到所有元素
            // 注意：使用保存的初始位置，而不是屏幕中心，以支持模型配置的位置偏移
            if (modelRef.current) {
              modelRef.current.x = initialX;
              modelRef.current.y = initialY + floatY;
              modelRef.current.rotation = rotation;
            }

          });

          // 处理窗口大小变化
          const handleResize = () => {
            if (!appRef.current) return;
            appRef.current.renderer.resize(window.innerWidth, window.innerHeight);
            
            if (modelRef.current) {
              const width = window.innerWidth;
              const height = window.innerHeight;
              // 使用模型配置的位置和缩放
              const positionX = modelConfig?.position?.x ?? 0;
              const positionY = modelConfig?.position?.y ?? 0;
              const scaleFactor = modelConfig?.scale?.factor ?? 0.8;
              const baseWidth = modelConfig?.scale?.baseWidth ?? 800;
              const baseHeight = modelConfig?.scale?.baseHeight ?? 1000;
              
              modelRef.current.x = width / 2 + (width * positionX);
              modelRef.current.y = height / 2 + (height * positionY);
              const scale = Math.min(width / baseWidth, height / baseHeight) * scaleFactor;
              modelRef.current.scale.set(scale);
            }
          };

          window.addEventListener("resize", handleResize);
        } catch (error) {
          console.error("加载 Live2D 模型失败:", error);
        }
      } catch (error) {
        console.error("初始化 PixiJS Application 失败:", error);
      }
    };

    initApp();

    // 清理函数
    return () => {
      isMounted = false;
      if (appRef.current) {
        // 停止 ticker
        appRef.current.ticker.stop();
        // 清理模型
        if (modelRef.current) {
          try {
            appRef.current.stage.removeChild(modelRef.current as any);
            modelRef.current.destroy();
          } catch (e) {
            console.warn('清理模型时出错:', e);
          }
          modelRef.current = null;
        }
        // 销毁应用
        appRef.current.destroy(true);
        appRef.current = null;
      }
      if (canvasRef.current && containerRef.current) {
        try {
          containerRef.current.removeChild(canvasRef.current);
        } catch (e) {
          // 忽略错误
        }
      }
    };
  }, [modelPath]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        top: 0,
        left: 0,
      }}
    />
  );
});

FloatingMagicMirror.displayName = 'FloatingMagicMirror';

export default FloatingMagicMirror;
