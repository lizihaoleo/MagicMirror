# MagicMirror ✨

一个基于 React + PixiJS + Live2D 的智能魔法镜项目，支持语音对话、表情动作控制和 TTS 口型同步。

## ✨ 功能特性

- 🎭 **Live2D 模型显示** - 支持 Live2D Cubism 4 模型，完整展示角色
- 🎤 **语音对话** - 使用 Whisper 进行语音识别，LLM 生成回复，TTS 语音合成
- 🎨 **表情和动作控制** - 支持动态切换表情和播放动作
- 🔊 **TTS 口型同步** - 文字转语音时自动同步模型口型
- 📱 **响应式设计** - 自动适配窗口大小，模型缩放自适应
- 🎯 **多模型支持** - 支持切换不同的 Live2D 模型（Komi、Akari 等）

## 🛠️ 技术栈

- **React 18** + **TypeScript** - 前端框架
- **PixiJS v7** - 2D WebGL 渲染引擎
- **@sujoyu/pixi-live2d-display** - Live2D 模型显示库（支持 PixiJS v7）
- **Whisper (Xenova)** - 本地语音识别
- **Groq API** - LLM 对话服务（支持 Hugging Face 备选）
- **Web Speech API** - 文字转语音（TTS）
- **Vite** - 快速构建工具

## 🚀 快速开始

### 前置要求

- **Node.js** 18 或更高版本
- **Cubism Core** - Live2D SDK 核心库（见下方说明）
- **API Keys** - Groq API Key 或 Hugging Face API Key（用于 LLM 对话）

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/lizihaoleo/MagicMirror.git
   cd MagicMirror
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   ```bash
   cp .env.sample .env
   ```
   然后编辑 `.env` 文件，填入你的 API Key：
   ```env
   VITE_GROQ_API_KEY=your_groq_api_key_here
   ```

4. **配置 Cubism Core**
   - 从 [Live2D Cubism SDK](https://www.live2d.com/download/cubism-sdk/) 下载 Cubism SDK for Web
   - 提取 `live2dcubismcore.min.js` 到 `public/` 目录
   - 文件已在 `index.html` 中引入

5. **运行项目**
   ```bash
   npm run dev
   ```

6. **访问应用**
   - 打开浏览器访问 `http://localhost:5173`
   - 应该能看到悬浮的 Live2D 魔镜

## 📦 使用 Live2D 模型

### 添加模型

1. 将 Live2D 模型的所有文件放到 `public/models/模型名/` 目录
2. 在 `src/components/ModelSelector.tsx` 中添加模型配置：

```tsx
{
  id: 'your-model',
  name: 'Your Model',
  path: '/models/your-model/model.model3.json',
  expressionsPath: '/models/your-model/expressions',
  motionsPath: '/models/your-model/motions',
  position: { x: 0, y: 0 },
  scale: { factor: 0.8, baseWidth: 800, baseHeight: 1000 },
}
```

### 模型文件结构

```
public/models/Komi/
├── Komi.model3.json      # 主模型配置文件
├── Komi.moc3             # 模型数据文件
├── Komi.2048/            # 纹理目录
│   └── texture_00.png
├── Expressions/          # 表情文件
│   └── *.exp3.json
└── Motions/              # 动作文件
    └── *.motion3.json
```

### 调整模型位置和大小

在 `src/components/ModelSelector.tsx` 中调整模型的 `position` 和 `scale` 配置：

```tsx
position: {
  x: 0,    // 水平位置：0=中心，负数=向左，正数=向右
  y: 0,    // 垂直位置：0=中心，负数=向上，正数=向下
},
scale: {
  factor: 0.8,      // 缩放因子
  baseWidth: 800,   // 基础宽度（用于计算缩放）
  baseHeight: 1000, // 基础高度（用于计算缩放）
}
```

## 🎮 功能使用

### 语音对话

1. 点击底部的麦克风按钮开始录音
2. 再次点击停止录音
3. 系统会自动：
   - 使用 Whisper 识别语音
   - 调用 LLM 生成回复
   - 应用相应的表情和动作
   - 使用 TTS 播放回复并同步口型

### 表情和动作测试

1. 点击右上角的"表情/动作测试器"
2. 选择要测试的表情或动作
3. 点击按钮即可看到效果

### TTS 测试

1. 点击右下角的"TTS 测试"
2. 输入要播放的文字
3. 点击"播放"按钮
4. 模型会播放语音并同步口型

## 📁 项目结构

```
MagicMirror/
├── public/
│   ├── live2dcubismcore.min.js  # Cubism Core（需自行下载）
│   └── models/                   # Live2D 模型文件
│       ├── Komi/                 # Komi 模型
│       └── Akari/                # Akari 模型
├── src/
│   ├── components/
│   │   ├── FloatingMagicMirror.tsx  # 主魔镜组件
│   │   ├── ModelSelector.tsx       # 模型选择器
│   │   ├── VoiceChat.tsx           # 语音对话组件
│   │   ├── ExpressionTester.tsx    # 表情/动作测试器
│   │   └── TTSTester.tsx           # TTS 测试器
│   ├── services/
│   │   ├── expressionService.ts   # 表情和动作服务
│   │   ├── llmService.ts          # LLM 对话服务
│   │   ├── ttsService.ts          # TTS 语音合成服务
│   │   └── voiceService.ts        # 语音识别服务
│   ├── App.tsx                    # 主应用组件
│   ├── main.tsx                   # 入口文件
│   └── index.css                  # 样式文件
├── .env.sample                    # 环境变量示例
├── index.html                     # HTML 入口
├── package.json                   # 依赖配置
├── vite.config.ts                 # Vite 配置
├── tsconfig.json                  # TypeScript 配置
└── README.md                      # 项目文档
```

## 🎮 开发命令

```bash
# 开发模式（热重载）
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 🔧 环境变量配置

复制 `.env.sample` 为 `.env` 并配置以下变量：

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `VITE_GROQ_API_KEY` | Groq API Key | 是（用于 LLM） |
| `VITE_HUGGINGFACE_API_KEY` | Hugging Face API Key | 否（备选 LLM） |
| `VITE_WHISPER_MODEL` | Whisper 模型名称 | 否（默认：Xenova/whisper-base） |

### 获取 API Key

- **Groq API Key**: https://console.groq.com/
- **Hugging Face API Key**: https://huggingface.co/settings/tokens

## 📚 依赖说明

### 核心依赖

- `react@18.3.1` - React 框架
- `pixi.js@7.3.2` - PixiJS 主库，2D WebGL 渲染引擎
- `@sujoyu/pixi-live2d-display` - Live2D 显示库（支持 PixiJS v7）
- `@xenova/transformers` - Whisper 语音识别模型
- `axios` - HTTP 客户端（用于 LLM API）

### 开发依赖

- `typescript@5.5.4` - TypeScript 编译器
- `vite@5.4.1` - 构建工具

## ❓ 常见问题

### 模型不显示

1. **检查 Cubism Core**
   - 确认 `public/live2dcubismcore.min.js` 文件存在
   - 查看浏览器控制台是否有加载错误

2. **检查模型路径**
   - 确认模型文件路径正确（相对于 `public/` 目录）
   - 确认所有模型文件（.moc3, 纹理等）都在正确位置

3. **查看控制台**
   - 打开浏览器开发者工具（F12）
   - 查看 Console 和 Network 标签的错误信息

### 语音识别不工作

1. **检查浏览器权限**
   - 确保已授予麦克风权限
   - 首次使用需要用户授权

2. **检查 Whisper 模型加载**
   - 首次使用会自动下载模型（约 150MB）
   - 模型会缓存到浏览器 IndexedDB，后续使用会更快

### LLM 对话不工作

1. **检查 API Key**
   - 确认 `.env` 文件中已配置正确的 API Key
   - 重启开发服务器使环境变量生效

2. **检查网络连接**
   - 确保能访问 Groq API 或 Hugging Face API

### 口型同步不工作

- 口型同步基于时间动画模拟，可能不够精确
- 不同模型的参数名称可能不同，如果无效请检查控制台调试信息

## 🔗 参考资源

- [@sujoyu/pixi-live2d-display](https://github.com/sujoyu/pixi-live2d-display) - Live2D 显示库 GitHub
- [PixiJS 文档](https://pixijs.com/) - PixiJS 官方文档
- [Live2D Cubism SDK](https://www.live2d.com/download/cubism-sdk/) - Live2D SDK 下载页面
- [Groq API](https://console.groq.com/) - Groq API 控制台
- [Whisper 模型](https://huggingface.co/Xenova) - Whisper 模型仓库

## 📝 更新日志

### v2.0.0 (当前版本)

- ✨ 添加语音对话功能（Whisper + LLM + TTS）
- 🎭 添加表情和动作测试器
- 🔊 添加 TTS 测试和口型同步功能
- 🎯 支持多模型切换
- 🎨 优化 UI 和用户体验

### v1.0.0

- ✨ 集成 Live2D Cubism 4 模型显示
- 🎨 实现悬浮魔镜效果（浮动、旋转动画）
- 🔧 从 Three.js 迁移到纯 PixiJS

## 📄 许可证

MIT License

---

**注意**：Live2D 模型文件可能受版权保护，请确保你使用的模型符合其许可证要求。
