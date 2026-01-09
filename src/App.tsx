import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import FloatingMagicMirror from "./components/FloatingMagicMirror";

const App = () => {
  return (
    <main className="app">
      <Canvas camera={{ position: [0, 1.2, 3.2], fov: 45 }}>
        <color attach="background" args={["#0a0a10"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 4, 5]} intensity={1.1} />
        <Suspense fallback={null}>
          <FloatingMagicMirror />
        </Suspense>
      </Canvas>
    </main>
  );
};

export default App;
