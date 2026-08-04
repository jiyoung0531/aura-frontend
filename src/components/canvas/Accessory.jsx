import React, { useState, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations, useTexture } from '@react-three/drei';
import * as THREE from 'three';

export function Accessory({ modelUrl, handPosRef, targetObject, initialFloatPosition, scale = 1 }) {
  const { camera, raycaster, size } = useThree();
  const { scene, animations } = useGLTF(modelUrl);
  const { actions } = useAnimations(animations, scene); 

  const accessoryRef = useRef();
  const hoverTimer = useRef(0); 
  const [isAttached, setIsAttached] = useState(false); 

  const floatPosition = initialFloatPosition || new THREE.Vector3(0, -1.5, 1.5); 

  const logoTexture = useTexture('/textures/mcm_logo2.png');

  useEffect(() => {
    if (logoTexture) {
      logoTexture.flipY = false;
      logoTexture.colorSpace = THREE.SRGBColorSpace;

      logoTexture.wrapS = THREE.RepeatWrapping;
      logoTexture.wrapT = THREE.RepeatWrapping;
      logoTexture.repeat.set(15, 15); 
      
      logoTexture.minFilter = THREE.LinearFilter;
      logoTexture.generateMipmaps = false;
    }

    scene.traverse((child) => {
      if (child.isMesh && child.material) {
        // 곰돌이 모델 옷 입히기
        if (modelUrl.includes('teddy_keyring') && child.name === 'teddy_body') {
          child.material = child.material.clone();
          child.material.map = logoTexture;
          child.material.needsUpdate = true;
        }
      }
    });
  }, [scene, logoTexture, modelUrl]);

  useEffect(() => {
    if (actions['TiltAnimation']) {
      actions['TiltAnimation'].setLoop(THREE.LoopOnce, 1);
      actions['TiltAnimation'].clampWhenFinished = true; 
    }
  }, [actions]);

  useFrame((state, delta) => {
    if (!accessoryRef.current) return;

    if (!isAttached) {
      // 부착 전: 위아래로 둥둥 떠다기기
      const t = state.clock.elapsedTime;
      accessoryRef.current.position.y = floatPosition.y + Math.sin(t * 2) * 0.05;
      accessoryRef.current.position.x = floatPosition.x;
      accessoryRef.current.position.z = floatPosition.z;

      // 손 위치가 있을 때만 충돌 검사 수행
      if (handPosRef?.current) {
        const x = (handPosRef.current.x / size.width) * 2 - 1;
        const y = -(handPosRef.current.y / size.height) * 2 + 1;
        raycaster.setFromCamera({ x, y }, camera);
        
        const intersects = raycaster.intersectObject(scene, true);

        if (intersects.length > 0) {
          hoverTimer.current += delta; 

          if (hoverTimer.current >= 1.5) {
            setIsAttached(true); 
            if (actions['TiltAnimation']) {
              actions['TiltAnimation'].reset().play();
            }
          }
        } else {
          if (hoverTimer.current > 0) {
            hoverTimer.current = 0;
          }
        }
      }
    } else {
     if (targetObject && accessoryRef.current) {
        if (accessoryRef.current.parent !== targetObject) {
          targetObject.add(accessoryRef.current); 
          accessoryRef.current.position.set(0, 0, 0); 
          accessoryRef.current.rotation.set(0, 0, 0); 
        }
      }
    }
  });

  return <primitive object={scene} ref={accessoryRef} scale={scale} />;
}