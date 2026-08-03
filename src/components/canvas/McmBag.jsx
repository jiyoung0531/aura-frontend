import React, { useEffect, useMemo } from 'react';
import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGLTF, useTexture } from '@react-three/drei';

const BAG_MODEL_URL = '/models/mcm_final_7.glb';
const TEXTURE_URLS = {
  //무드 구분
  street: '/textures/romantic_pattern.png', 
  romantic: '/textures/romantic_pattern.png',
  classic: '/textures/street_pattern.png',
  minimal: '/textures/street_pattern.png',
  // 로고 이미지
  logo_g: '/textures/logo_g.png', 
  logo_r: '/textures/logo_r.png',
};

export function McmBag({ currentMood = 'street', rotation = [0, Math.PI / 12, 0], handPosRef, setHoveredMaterial }) {
  const { scene } = useGLTF(BAG_MODEL_URL);
  // 무드별 2D 텍스처 불러오기
  const textures = useTexture(TEXTURE_URLS);
  const { camera, raycaster, size } = useThree();

  const hoverTimer = useRef(0);
  const lastHoveredCategory = useRef(null); 
  const shadowMeshRef = useRef(null);

  const sounds = useRef({
    leather: new Audio('/sounds/leather.mp3'),
    metal: new Audio('/sounds/metal.mp3'),
    strap: new Audio('/sounds/strap.mp3'),
  });

  // 그림자 생성 코드
  const shadowTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    // 그림자 색상 설정
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.6)'); 
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }, []);

  useFrame((state, delta) => {
    if (!handPosRef || !handPosRef.current || !setHoveredMaterial) return;

    const x = (handPosRef.current.x / size.width) * 2 - 1;
    const y = -(handPosRef.current.y / size.height) * 2 + 1;

    raycaster.setFromCamera({ x, y }, camera);
    const intersects = raycaster.intersectObject(scene, true);

    const resetVisualEffect = () => {
      if (shadowMeshRef.current) {
        shadowMeshRef.current.visible = false; 
        shadowMeshRef.current.scale.set(1, 1, 1);
      }

      Object.values(sounds.current).forEach((audio) => {
        audio.pause();           
        audio.currentTime = 0;   
      });
    };

    if (intersects.length > 0) {
      const hitObject = intersects[0].object;
      const hitName = hitObject.name;

      setHoveredMaterial(hitName);

      // 미세한 손떨림을 무시
      let category = 'none';
      if (hitName.includes('bag') || hitName.includes('panel')) category = 'leather';
      else if (hitName.includes('hardware') || hitName.includes('buckle') || hitName.includes('zip') || hitName.includes('logo')) category = 'metal';
      else if (hitName.includes('strap') || hitName.includes('line') || hitName.includes('handle')) category = 'strap';

      if (category !== 'none') {
        if (lastHoveredCategory.current === category) {
          hoverTimer.current += delta; 

          if (hoverTimer.current >= 2.0) {   
            // ASMR 사운드 대타: 콘솔창에 한 번만 알림 띄우기
            if (hoverTimer.current < 2.05) { 
              console.log(`🔊 띠링! [${category}] ASMR 사운드 재생 완료!`);
              // 오디오 파일이 없어서 나는 에러를 막기 위해 임시 주석 처리
              // sounds.current[category]?.play().catch(() => {}); 
            }

            if (shadowMeshRef.current) {
              shadowMeshRef.current.visible = true; 
              
              const hit = intersects[0];
              shadowMeshRef.current.position.copy(hit.point);
              
              if (hit.face) {
              const normal = hit.face.normal.clone();
                normal.transformDirection(hit.object.matrixWorld); 
                shadowMeshRef.current.lookAt(hit.point.clone().add(normal)); 
                // 그림자가 가방을 파고들지 않게 표면에서 살짝 띄우기 (0.015)
                shadowMeshRef.current.position.add(normal.multiplyScalar(0.015));
              }
              shadowMeshRef.current.scale.lerp(new THREE.Vector3(1.5, 1.5, 1.5), 0.15);
            }
          }
        } else {
          resetVisualEffect();
          lastHoveredCategory.current = category;
          hoverTimer.current = 0;

          if (sounds.current[category]) {
            const audio = sounds.current[category];
            audio.currentTime = 0; // 손으로 빠르게 쓱쓱 쓸어내릴 때마다 소리가 즉시 다시 나도록 처음으로 되감기!
            audio.play().catch((error) => {
              console.log("🔊 화면을 클릭해야 소리가 납니다!", error);
            });
          }         
        }
      } else {
        resetVisualEffect();
        lastHoveredCategory.current = null;
        hoverTimer.current = 0;
      }
    } else {
      resetVisualEffect();
      setHoveredMaterial(null);
      lastHoveredCategory.current = null;
      hoverTimer.current = 0;
    }
  });

  const selectedTexture = textures[currentMood];
  if (selectedTexture) {
    selectedTexture.flipY = false; 
    // 패턴을 바둑판처럼 반복
    selectedTexture.wrapS = THREE.RepeatWrapping;
    selectedTexture.wrapT = THREE.RepeatWrapping;
    // 패턴크기 설정
    selectedTexture.repeat.set(10, 10); 
    selectedTexture.colorSpace = THREE.SRGBColorSpace;
    selectedTexture.anisotropy = 16; // 패턴을 기울여서 볼 때 선명도 유지
    selectedTexture.generateMipmaps = false; // 이미지 축소 시 가장자리 번짐(격자) 원천 차단
    selectedTexture.minFilter = THREE.LinearFilter;
  }

  useEffect(() => {
    console.log('--- 3D 모델 메쉬 정보 확인 ---');

    scene.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.flatShading = false; // 각지게 보이는 설정 끄기
        child.geometry.computeVertexNormals();
        
        console.log(`메쉬 이름: ${child.name} / 재질(Material) 이름: ${child.material.name}`);

        // 특정 파트에만 패턴 적용 
        // 메쉬 이름으로 필터링하여 정확한 부위에만 적용
        if (child.material.name === 'bag') {
          // 지정 파트 bag_mesh, side_panel_mesh
          if (child.name === 'bag_mesh' || child.name === 'side_panel_mesh') {
            child.material.map = selectedTexture;
            child.material.color.set('#412D15'); 
            if (child.material.normalMap) {
              child.material.normalScale.set(2, 2); 
            }
            child.material.needsUpdate = true;
          }
        }


        // 스트랩 테스트
        if (child.name === 'shoulder_strap_001_mesh' || child.name === 'shoulder_strap_002_mesh'
            || child.name === 'strap_001_mesh' || child.name === 'strap_002_mesh'
            || child.name === 'round_line_001_mesh' || child.name === 'round_line_002_mesh'|| child.name === 'strong_handle_mesh'
        ) {
          child.material = child.material.clone(); 
          child.material.map = null; 
          child.material.color.set('#FF0000');        
          child.material.needsUpdate = true;
        }

        
        // 로고 적용
     /*   if (child.name === 'logo_plate_mesh') {
          child.material.map = logoTexture;
          child.material.color.set('white');
          child.material.needsUpdate = true;
          child.material.transparent = true;
        }*/
      }
    });
  }, [scene, textures, currentMood]);

  return (
    <group>
      <primitive object={scene} rotation={rotation} scale={1.5} />
      
      {/* 2초 누를때 그림자 */}
      <mesh ref={shadowMeshRef} visible={false}>
        <planeGeometry args={[0.15, 0.15]} /> 
        <meshBasicMaterial 
          map={shadowTexture} 
          transparent={true} 
          depthWrite={false} 
          opacity={0.8} // 그림자 진한 정도 조절
        />
      </mesh>
    </group>
  );
}