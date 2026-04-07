"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Text } from "@react-three/drei";
import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  Flow node: a glowing sphere with a label                           */
/* ------------------------------------------------------------------ */

function FlowNode({
  position,
  color,
  label,
  active,
  scale = 1,
}: {
  position: [number, number, number];
  color: string;
  label: string;
  active: boolean;
  scale?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.3;
    }
    if (glowRef.current) {
      const targetScale = active ? 1.8 : 1.2;
      glowRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        delta * 3,
      );
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
      <group position={position}>
        {/* Glow sphere */}
        <mesh ref={glowRef} scale={1.2}>
          <sphereGeometry args={[0.35 * scale, 32, 32]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={active ? 0.15 : 0.05}
          />
        </mesh>

        {/* Main sphere */}
        <mesh ref={meshRef} scale={scale}>
          <icosahedronGeometry args={[0.3, 1]} />
          <meshStandardMaterial
            color={active ? color : "#2a2a3a"}
            emissive={active ? color : "#000000"}
            emissiveIntensity={active ? 0.5 : 0}
            roughness={0.3}
            metalness={0.7}
          />
        </mesh>

        {/* Label */}
        <Text
          position={[0, -0.55 * scale, 0]}
          fontSize={0.12}
          color={active ? "#ffffff" : "#666677"}
          anchorX="center"
          anchorY="top"
          outlineWidth={0}
        >
          {label}
        </Text>
      </group>
    </Float>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated beam connecting two nodes                                  */
/* ------------------------------------------------------------------ */

function Beam({
  start,
  end,
  active,
  color,
}: {
  start: [number, number, number];
  end: [number, number, number];
  active: boolean;
  color: string;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const progressRef = useRef(0);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const target = active ? 1 : 0;
    progressRef.current += (target - progressRef.current) * delta * 4;

    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = progressRef.current * 0.6;

    // Scale the beam based on progress
    ref.current.scale.x = progressRef.current;
  });

  const midPoint = useMemo(() => {
    return [
      (start[0] + end[0]) / 2,
      (start[1] + end[1]) / 2 + 0.15,
      (start[2] + end[2]) / 2,
    ] as [number, number, number];
  }, [start, end]);

  const length = useMemo(() => {
    return Math.sqrt(
      (end[0] - start[0]) ** 2 +
      (end[1] - start[1]) ** 2 +
      (end[2] - start[2]) ** 2,
    );
  }, [start, end]);

  const angle = useMemo(() => {
    return Math.atan2(end[1] - start[1], end[0] - start[0]);
  }, [start, end]);

  return (
    <mesh ref={ref} position={midPoint} rotation={[0, 0, angle]}>
      <planeGeometry args={[length, 0.03]} />
      <meshBasicMaterial color={color} transparent opacity={0} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Floating particles                                                  */
/* ------------------------------------------------------------------ */

function Particles() {
  const count = 60;
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 4;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    return pos;
  }, []);

  const speeds = useMemo(() => {
    return Array.from({ length: count }, () => 0.2 + Math.random() * 0.5);
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.elapsedTime;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const x = positions[i * 3] + Math.sin(time * speeds[i] + i) * 0.3;
      const y = positions[i * 3 + 1] + Math.cos(time * speeds[i] * 0.7 + i) * 0.2;
      const z = positions[i * 3 + 2];

      dummy.position.set(x, y, z);
      dummy.scale.setScalar(0.015 + Math.sin(time * 2 + i * 1.5) * 0.008);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#4ade80" transparent opacity={0.3} />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Scene                                                               */
/* ------------------------------------------------------------------ */

function Scene() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % 6);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  // Node positions in 3D space
  const nodes = [
    { pos: [-2.2, 0.3, 0] as [number, number, number], color: "#f97316", label: "Automation", active: step >= 1 },
    { pos: [-0.8, -0.2, 0.5] as [number, number, number], color: "#eab308", label: "Request", active: step >= 2 },
    { pos: [0.5, 0.4, -0.3] as [number, number, number], color: "#3b82f6", label: "Notify", active: step >= 3 },
    { pos: [1.8, -0.1, 0.2] as [number, number, number], color: "#22c55e", label: "Approve", active: step >= 4 },
    { pos: [3.0, 0.3, -0.1] as [number, number, number], color: "#8b5cf6", label: "Continue", active: step >= 5 },
  ];

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={0.8} color="#ffffff" />
      <pointLight position={[-3, 2, -2]} intensity={0.4} color="#22c55e" />
      <pointLight position={[3, -2, 2]} intensity={0.3} color="#3b82f6" />

      {/* Nodes */}
      {nodes.map((node) => (
        <FlowNode
          key={node.label}
          position={node.pos}
          color={node.color}
          label={node.label}
          active={node.active}
        />
      ))}

      {/* Beams connecting nodes */}
      {nodes.slice(1).map((node, i) => (
        <Beam
          key={`beam-${i}`}
          start={nodes[i].pos}
          end={node.pos}
          active={node.active}
          color={node.color}
        />
      ))}

      {/* Floating particles */}
      <Particles />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Exported component                                                  */
/* ------------------------------------------------------------------ */

export function Hero3D() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // SSR placeholder. Matches the canvas dimensions
    return (
      <div className="h-[350px] w-full rounded-2xl sm:h-[400px]"
        style={{ background: "linear-gradient(135deg, #0a0f1a 0%, #0f172a 50%, #0a1628 100%)" }}
      />
    );
  }

  return (
    <div className="relative h-[350px] w-full overflow-hidden rounded-2xl sm:h-[400px]"
      style={{ background: "linear-gradient(135deg, #0a0f1a 0%, #0f172a 50%, #0a1628 100%)" }}
    >
      <Canvas
        camera={{ position: [0, 0.5, 5], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Scene />
      </Canvas>
      {/* Subtle vignette overlay */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl" style={{
        background: "radial-gradient(ellipse at center, transparent 50%, rgba(10,15,26,0.6) 100%)",
      }} />
    </div>
  );
}
