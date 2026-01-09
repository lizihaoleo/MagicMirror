import FloatingMagicMirror from "./components/FloatingMagicMirror";

const App = () => {
  // Live2D 模型路径
  const live2dModelPath = "/models/Komi/Komi.model3.json";

  return (
    <main className="app">
      <FloatingMagicMirror modelPath={live2dModelPath} />
    </main>
  );
};

export default App;
