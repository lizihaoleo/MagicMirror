
export interface ModelInfo {
  id: string;
  name: string;
  path: string;
  expressionsPath?: string;
  motionsPath?: string;
  // 模型特定的位置和缩放配置
  position?: {
    x?: number; // 相对位置偏移（0-1，相对于屏幕中心）
    y?: number;
  };
  scale?: {
    factor?: number; // 缩放因子（默认 0.8）
    baseWidth?: number; // 基础宽度（用于计算缩放，默认 800）
    baseHeight?: number; // 基础高度（用于计算缩放，默认 1000）
  };
}

// 可用的模型列表
export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'komi',
    name: 'Komi',
    path: '/models/Komi/Komi.model3.json',
    expressionsPath: '/models/Komi/Expressions',
    motionsPath: '/models/Komi/Motions',
    position: {
      x: 0, // 屏幕中心
      y: 0,
    },
    scale: {
      factor: 0.8,
      baseWidth: 800,
      baseHeight: 1000,
    },
  },
  {
    id: 'akari',
    name: 'Akari',
    path: '/models/Akari/akari.model3.json',
    expressionsPath: '/models/Akari/expressions',
    motionsPath: '/models/Akari/animations',
    position: {
      x: 0, // 屏幕中心
      y: 0.1, // 向上移动 15%（因为模型可能偏下）
    },
    scale: {
      factor: 0.2, // Akari 模型可能更大，需要更小的缩放
      baseWidth: 1000,
      baseHeight: 1200,
    },
  },
];

interface ModelSelectorProps {
  selectedModel: ModelInfo;
  onModelChange: (model: ModelInfo) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ selectedModel, onModelChange }) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const modelId = e.target.value;
    const model = AVAILABLE_MODELS.find(m => m.id === modelId);
    if (model) {
      onModelChange(model);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        left: '20px',
        zIndex: 1001,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: '15px',
        borderRadius: '12px',
        color: 'white',
        minWidth: '200px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
      }}
    >
      <label
        style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '14px',
          color: '#4a9eff',
          fontWeight: 'bold',
        }}
      >
        🎭 选择Live2D模型
      </label>
      <select
        value={selectedModel.id}
        onChange={handleChange}
        style={{
          width: '100%',
          padding: '8px',
          borderRadius: '6px',
          backgroundColor: '#1a1a1a',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          fontSize: '14px',
          cursor: 'pointer',
        }}
      >
        {AVAILABLE_MODELS.map((model) => (
          <option
            key={model.id}
            value={model.id}
            style={{ backgroundColor: '#1a1a1a', color: 'white' }}
          >
            {model.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default ModelSelector;

