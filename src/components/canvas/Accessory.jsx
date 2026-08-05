import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';

export function Accessory({ 
  modelUrl, 
  handPosRef, 
  targetObject, 
  initialFloatPosition, 
  attachmentOffset = [0, 0, 0], 
  attachmentRotation = [0, 0, 0], 
  scale = 1, 
  onToggleAttach, 
  attachSoundUrl = '/sounds/attach.mp3'  
}) {
  const { camera, raycaster, size } = useThree();
  const { scene, animations } = useGLTF(modelUrl);
  const { actions } = useAnimations(animations, scene); 

  const groupRef = useRef(null); 
  const hoverTimer = useRef(0); 
  const canToggleRef = useRef(true); 
  const [isAttached, setIsAttached] = useState(false); 

  const attachSound = useMemo(() => new Audio(attachSoundUrl), [attachSoundUrl]);
  const floatPos = useMemo(() => initialFloatPosition || new THREE.Vector3(0, -1.5, 1.5), [initialFloatPosition]);

  useEffect(() => {
    if (actions['TiltAnimation']) {
      actions['TiltAnimation'].setLoop(THREE.LoopOnce, 1);
      actions['TiltAnimation'].clampWhenFinished = true; 
    }
  }, [actions]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // 1. 손 충돌 감지
    if (handPosRef?.current) {
      const x = (handPosRef.current.x / size.width) * 2 - 1;
      const y = -(handPosRef.current.y / size.height) * 2 + 1;
      raycaster.setFromCamera({ x, y }, camera);
      
      const intersects = raycaster.intersectObject(scene, true).filter(hit => hit.object.isMesh && hit.object.visible);

      if (intersects.length > 0) {
        if (canToggleRef.current) {
          hoverTimer.current += delta; 
          if (hoverTimer.current >= 1.0) {
            setIsAttached((prev) => {
              const newState = !prev;
              if (newState) {
                attachSound.currentTime = 0; 
                attachSound.play().catch(() => {});
              }
              if (onToggleAttach) onToggleAttach(newState); 
              return newState;
            });
            hoverTimer.current = 0; 
            canToggleRef.current = false; 

            if (actions['TiltAnimation']) {
              actions['TiltAnimation'].reset().play();
            }
          }
        }
      } else {
        if (hoverTimer.current > 0) hoverTimer.current = 0;
        canToggleRef.current = true;
      }
    }

    // 2. 위치 업데이트 (버그 원천 차단)
    if (!isAttached) {
      // 떨어져 있을 때: 둥둥 떠다니기
      const t = state.clock.elapsedTime;
      groupRef.current.position.set(floatPos.x, floatPos.y + Math.sin(t * 2) * 0.05, floatPos.z);
      groupRef.current.rotation.set(0, 0, 0); 
    } else {
      // 붙었을 때: 지퍼의 최신 위치를 즉각 복사해서 따라다니기
      if (targetObject) {
        targetObject.updateWorldMatrix(true, false);
        targetObject.getWorldPosition(groupRef.current.position);
        targetObject.getWorldQuaternion(groupRef.current.quaternion);

        // 사용자가 지정한 위치(Offset)만큼 밀어주기
        groupRef.current.translateX(attachmentOffset[0]);
        groupRef.current.translateY(attachmentOffset[1]);
        groupRef.current.translateZ(attachmentOffset[2]);

        // 사용자가 지정한 각도(Rotation)만큼 틀어주기
        const offsetQuat = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(attachmentRotation[0], attachmentRotation[1], attachmentRotation[2])
        );
        groupRef.current.quaternion.multiply(offsetQuat);
      }
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={scale} />
    </group>
  );
}