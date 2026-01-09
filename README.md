# MagicMirror ✨

一个使用 PixiJS 和 Live2D 的魔法镜项目，展示悬浮在空中的 Live2D 角色。

## 功能特性

- ✨ **悬浮动画** - 魔镜缓慢上下浮动和左右旋转
- 🎭 **Live2D 模型** - 支持显示 Live2D Cubism 4 模型
- 💎 **魔法效果** - 蓝色光晕和镜面框架装饰
- 🌟 **发光呼吸** - 镜面有缓慢的发光呼吸效果
- 🎨 **暗色主题** - 暗色魔法风格背景

## 技术栈

- **React** + **TypeScript**
- **PixiJS v7** - 2D WebGL 渲染引擎
- **@sujoyu/pixi-live2d-display** - Live2D 模型显示库（支持 PixiJS v7）
- **Vite** - 快速构建工具

## 快速开始

### 前置要求

1. **Node.js** 18+ 
2. **Cubism Core** - Live2D SDK 核心库
   - 从 [Live2D Cubism SDK](https://www.live2d.com/download/cubism-sdk/) 下载
   - 提取 `live2dcubismcore.min.js` 到 `public/` 目录
   - 已在 `index.html` 中引入

3. **Live2D 模型**（可选）
   - 将模型文件放到 `public/models/` 目录
   - 在 `src/App.tsx` 中设置模型路径

### 安装依赖

```bash
npm install
```

### 运行项目

```bash
npm run dev
```

打开浏览器访问显示的地址（通常是 `http://localhost:5173`）

### 构建生产版本

```bash
npm run build
```

## 项目结构

```
MagicMirror/
├── public/
│   ├── live2dcubismcore.min.js  # Cubism Core（需要自行下载）
│   └── models/                   # Live2D 模型文件
│       └── Komi/
│           ├── Komi.model3.json
│           ├── Komi.moc3
│           └── ...
├── src/
│   ├── components/
│   │   └── FloatingMagicMirror.tsx  # 主魔镜组件
│   ├── App.tsx                      # 主应用组件
│   ├── main.tsx                     # 入口文件
│   └── index.css                    # 样式文件
├── index.html
├── package.json
└── vite.config.ts
```

## 配置 Live2D 模型

### 1. 准备模型文件

将 Live2D 模型的所有文件放到 `public/models/你的模型名/` 目录，例如：

```
public/models/Komi/
├── Komi.model3.json
├── Komi.moc3
├── Komi.2048/
│   └── texture_00.png
├── Expressions/
└── Motions/
```

### 2. 设置模型路径

在 `src/App.tsx` 中修改模型路径：

```tsx
const live2dModelPath = "/models/Komi/Komi.model3.json";
```

### 3. 调整模型大小（可选）

如果模型太大或太小，可以在 `src/components/FloatingMagicMirror.tsx` 中调整缩放：

```tsx
const scale = Math.min(screenWidth / 800, screenHeight / 1000) * 0.8;
// 调整这些数值来改变模型大小
```

## 开发命令

```bash
# 开发模式
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 依赖说明

- `pixi.js@7.3.2` - PixiJS 主库
- `@pixi/core@7.3.2` - PixiJS 核心（Live2D 库需要）
- `@pixi/display@7.3.2` - PixiJS 显示模块（Live2D 库需要）
- `@sujoyu/pixi-live2d-display` - Live2D 显示库（支持 PixiJS v7）

## 常见问题

### 模型不显示

1. 确认 `live2dcubismcore.min.js` 已正确加载
2. 检查模型文件路径是否正确
3. 查看浏览器控制台的错误信息

### 模型太大/太小

在 `FloatingMagicMirror.tsx` 中调整缩放比例：
- 增大除数（如 `/800` 改为 `/1000`）→ 模型变小
- 减小除数（如 `/800` 改为 `/600`）→ 模型变大

### 交互功能不可用

当前版本中交互功能可能不可用，这是 PixiJS v7 兼容性问题。模型仍会正常显示和动画。

## 参考资源

- [@sujoyu/pixi-live2d-display](https://github.com/sujoyu/pixi-live2d-display) - Live2D 显示库
- [PixiJS 文档](https://pixijs.com/) - PixiJS 官方文档
- [Live2D Cubism SDK](https://www.live2d.com/download/cubism-sdk/) - Live2D SDK 下载

## 许可证

MIT License
