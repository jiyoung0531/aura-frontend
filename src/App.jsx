import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { McmBag } from './components/canvas/McmBag'; // 경로에 맞게 수정

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#f0f0f0' }}>
      {/* 3D 캔버스 생성 */}
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        {/* 전체적으로 은은하게 비추는 환경광 */}
        <ambientLight intensity={1.5} />
        {/* 특정 방향에서 비추는 조명 (입체감을 줌) */}
        <directionalLight position={[10, 10, 5]} intensity={2} />
        
        {/* 우리가 만든 가방 컴포넌트 */}
        <McmBag currentMood="street" />

        {/* 마우스로 가방을 돌려보고 확대/축소해볼 수 있는 컨트롤러 */}
        <OrbitControls />
      </Canvas>
    </div>
  );
}