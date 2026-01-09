import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { BlurFilter } from "pixi.js";
// @ts-ignore - @sujoyu/pixi-live2d-display 类型定义可能不完整
import { Live2DModel } from "@sujoyu/pixi-live2d-display/cubism4";

interface FloatingMagicMirrorProps {
  modelPath: string;
}

const FloatingMagicMirror: React.FC<FloatingMagicMirrorProps> = ({
  modelPath,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const glowRef = useRef<PIXI.Graphics | null>(null);
  const mirrorFrameRef = useRef<PIXI.Graphics | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());

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

        // 创建外圈蓝色光晕 - 使用 PixiJS v7 API
        const glow = new PIXI.Graphics();
        glow.beginFill(0x4a9eff, 0.4);
        glow.drawEllipse(0, 0, 200, 300);
        glow.endFill();
        glow.filters = [new BlurFilter(20)];
        glow.alpha = 0.6;
        app.stage.addChild(glow);
        glowRef.current = glow;

        // 创建镜面框架（椭圆边框）- 使用 PixiJS v7 API
        const mirrorFrame = new PIXI.Graphics();
        mirrorFrame.lineStyle(3, 0x3a5aff, 0.6);
        mirrorFrame.drawEllipse(0, 0, 180, 280);
        mirrorFrame.alpha = 0.8;
        app.stage.addChild(mirrorFrame);
        mirrorFrameRef.current = mirrorFrame;

        // 加载 Live2D 模型
        console.log("开始加载 Live2D 模型:", modelPath);

        try {
          const model = await Live2DModel.from(modelPath);

          if (!isMounted) {
            model.destroy();
            return;
          }

          modelRef.current = model;
          console.log("Live2D 模型加载成功");

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
          model.x = screenWidth / 2;
          model.y = screenHeight / 2;
          // 减小模型大小，使其完整显示在画面中
          // 根据实际窗口尺寸计算缩放，确保模型不会太大
          const scale = Math.min(screenWidth / 800, screenHeight / 1000) * 0.8; // 额外缩小 20%
          model.scale.set(scale);
          console.log(`模型缩放: ${scale}, 窗口尺寸: ${screenWidth}x${screenHeight}, 渲染尺寸: ${app.renderer?.width}x${app.renderer?.height}`);

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

          // 调整层级：光晕在最底层，镜面框架在中间，模型在最上层
          app.stage.setChildIndex(glow, 0);
          app.stage.setChildIndex(mirrorFrame, 1);
          app.stage.setChildIndex(model as any, 2);

          // 动画循环
          const animate = () => {
            if (!isMounted || !appRef.current) return;

            const time = (Date.now() - startTimeRef.current) / 1000;
            // 使用实际的窗口尺寸（不考虑 devicePixelRatio）
            const screenHeight = window.innerHeight;
            const screenWidth = window.innerWidth;

            // 上下浮动动画
            const floatY = Math.sin(time * 0.8) * 30;
            // 轻微左右旋转
            const rotation = Math.sin(time * 0.5) * 0.15;

            // 应用动画到所有元素
            if (modelRef.current) {
              modelRef.current.x = screenWidth / 2;
              modelRef.current.y = screenHeight / 2 + floatY;
              modelRef.current.rotation = rotation;
            }

            if (glowRef.current) {
              glowRef.current.x = screenWidth / 2;
              glowRef.current.y = screenHeight / 2 + floatY;
              glowRef.current.rotation = rotation;
              // 光晕脉冲效果
              const glowIntensity = 0.6 + Math.sin(time * 1.5) * 0.2;
              glowRef.current.alpha = glowIntensity;
            }

            if (mirrorFrameRef.current) {
              mirrorFrameRef.current.x = screenWidth / 2;
              mirrorFrameRef.current.y = screenHeight / 2 + floatY;
              mirrorFrameRef.current.rotation = rotation;
              // 镜面发光呼吸效果
              const breathIntensity = 0.8 + Math.sin(time * 0.6) * 0.2;
              mirrorFrameRef.current.alpha = breathIntensity;
            }

            animationFrameRef.current = requestAnimationFrame(animate);
          };

          animate();

          // 处理窗口大小变化
          const handleResize = () => {
            if (!appRef.current) return;
            appRef.current.renderer.resize(window.innerWidth, window.innerHeight);
            
            if (modelRef.current) {
              const width = window.innerWidth;
              const height = window.innerHeight;
              modelRef.current.x = width / 2;
              modelRef.current.y = height / 2;
              // 使用与初始化相同的缩放比例
              const scale = Math.min(width / 800, height / 1000) * 0.8;
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
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (modelRef.current) {
        modelRef.current.destroy();
        modelRef.current = null;
      }
      if (appRef.current) {
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
};

export default FloatingMagicMirror;
