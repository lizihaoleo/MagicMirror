import { useRef, useState, useEffect } from "react";
import FloatingMagicMirror, { FloatingMagicMirrorRef } from "./components/FloatingMagicMirror";
import VoiceChat from "./components/VoiceChat";
import ExpressionTester from "./components/ExpressionTester";
import TTSTester from "./components/TTSTester";
import ModelSelector, { ModelInfo, AVAILABLE_MODELS } from "./components/ModelSelector";
import { setCurrentModel } from "./services/expressionService";

const App = () => {
  // 当前选择的模型
  const [selectedModel, setSelectedModel] = useState<ModelInfo>(AVAILABLE_MODELS[0]);
  
  // 创建 ref 用于访问 FloatingMagicMirror 的方法
  const mirrorRef = useRef<FloatingMagicMirrorRef>(null);

  // 当模型切换时，更新 expressionService 的当前模型
  useEffect(() => {
    setCurrentModel(selectedModel.id);
  }, [selectedModel]);

  const handleModelChange = (model: ModelInfo) => {
    setSelectedModel(model);
    // 模型切换时，FloatingMagicMirror 会通过 modelPath prop 的变化自动重新加载
  };

  return (
    <main className="app">
      <ModelSelector selectedModel={selectedModel} onModelChange={handleModelChange} />
      <FloatingMagicMirror 
        ref={mirrorRef} 
        modelPath={selectedModel.path}
        modelConfig={{
          position: selectedModel.position,
          scale: selectedModel.scale,
        }}
      />
      <VoiceChat mirrorRef={mirrorRef} />
      <ExpressionTester mirrorRef={mirrorRef} />
      <TTSTester mirrorRef={mirrorRef} />
    </main>
  );
};

export default App;
