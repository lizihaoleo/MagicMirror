# Live2D 模型设置指南

## 快速设置

### 1. 下载 Cubism Core

1. 访问 [Live2D Cubism SDK 下载页面](https://www.live2d.com/download/cubism-sdk/)
2. 下载 Cubism SDK for Web（需要注册账号）
3. 提取 `live2dcubismcore.min.js` 到 `public/` 目录
4. 文件已在 `index.html` 中引入

### 2. 添加模型文件

将 Live2D 模型的所有文件放到 `public/models/模型名/` 目录：

```
public/models/Komi/
├── Komi.model3.json      # 主模型文件
├── Komi.moc3             # 模型数据
├── Komi.2048/            # 纹理目录
│   └── texture_00.png
├── Expressions/          # 表情文件
└── Motions/             # 动作文件
```

### 3. 配置模型路径

在 `src/App.tsx` 中设置：

```tsx
const live2dModelPath = "/models/Komi/Komi.model3.json";
```

## 故障排除

### 模型不显示

- ✅ 检查 `live2dcubismcore.min.js` 是否在 `public/` 目录
- ✅ 确认模型路径正确（相对于 `public/` 目录）
- ✅ 查看浏览器控制台错误信息
- ✅ 确认所有模型文件（.moc3, 纹理等）都在正确位置

### 模型太大/太小

在 `src/components/FloatingMagicMirror.tsx` 中调整：

```tsx
// 第 165 行附近
const scale = Math.min(screenWidth / 800, screenHeight / 1000) * 0.8;
// 调整这些数值：
// - 增大除数（/800 → /1000）→ 模型变小
// - 减小除数（/800 → /600）→ 模型变大
// - 调整倍数（* 0.8 → * 0.6）→ 进一步缩小
```

### 交互功能

当前版本中交互功能可能不可用（PixiJS v7 兼容性问题），但不影响模型显示和动画。

## 支持的模型格式

- ✅ Cubism 4 (.model3.json)
- ✅ Cubism 3 (.model3.json)
- ❌ Cubism 2.1 (需要不同的导入路径)

## 参考

- [Live2D Cubism SDK](https://www.live2d.com/download/cubism-sdk/)
- [@sujoyu/pixi-live2d-display](https://github.com/sujoyu/pixi-live2d-display)
