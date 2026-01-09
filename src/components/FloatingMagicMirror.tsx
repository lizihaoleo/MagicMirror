import { Float, MeshTransmissionMaterial, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";

const FloatingMagicMirror = () => {
  const mirrorRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (!mirrorRef.current) return;
    mirrorRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.4) * 0.35;
  });

  return (
    <group position={[0, 0.2, 0]}>
      <Float speed={1.4} rotationIntensity={0.4} floatIntensity={0.8}>
        <RoundedBox ref={mirrorRef} args={[1.4, 2.2, 0.08]} radius={0.2}>
          <MeshTransmissionMaterial
            thickness={0.6}
            chromaticAberration={0.05}
            anisotropy={0.2}
            distortion={0.1}
            transmission={1}
            roughness={0.15}
            clearcoat={1}
            color="#5ee8ff"
          />
        </RoundedBox>
      </Float>
      <mesh position={[0, -1.05, -0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.2, 32]} />
        <meshStandardMaterial color="#19232b" roughness={0.8} />
      </mesh>
    </group>
  );
};

export default FloatingMagicMirror;
