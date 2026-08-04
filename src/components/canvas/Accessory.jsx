import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';

export function Accessory({ modelUrl, handPosRef, targetObject, initialFloatPosition, attachmentOffset = [0, 0, 0], attachmentRotation = [0, 0, 0], scale = 1 }) {
  const { camera, raycaster, size } = useThree();
  const { scene, animations } = useGLTF(modelUrl);
  const { actions } = useAnimations(animations, scene); 

  const accessoryRef = useRef();
  const hoverTimer = useRef(0); 
  const canToggleRef = useRef(true); 
  const [isAttached, setIsAttached] = useState(false); 

  const floatPosition = initialFloatPosition || new THREE.Vector3(0, -1.5, 1.5); 

  const offsetMatrix = useMemo(() => {
    const mat = new THREE.Matrix4();
    const pos = new THREE.Vector3(...attachmentOffset);
    const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(...attachmentRotation));
    mat.compose(pos, rot, new THREE.Vector3(1, 1, 1));
    return mat;
  }, [attachmentOffset, attachmentRotation]);

  useEffect(() => {
    if (actions['TiltAnimation']) {
      actions['TiltAnimation'].setLoop(THREE.LoopOnce, 1);
      actions['TiltAnimation'].clampWhenFinished = true; 
    }
  }, [actions]);

  useFrame((state, delta) => {
    if (!accessoryRef.current) return;

    if (handPosRef?.current) {
      const x = (handPosRef.current.x / size.width) * 2 - 1;
      const y = -(handPosRef.current.y / size.height) * 2 + 1;
      raycaster.setFromCamera({ x, y }, camera);
      
      const intersects = raycaster.intersectObject(scene, true).filter(hit => hit.object.isMesh && hit.object.visible);

      if (intersects.length > 0) {
        if (canToggleRef.current) {
          hoverTimer.current += delta; 

          if (hoverTimer.current >= 1.0) {
            setIsAttached((prev) => !prev);
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

    if (!isAttached) {

      const t = state.clock.elapsedTime;
      accessoryRef.current.position.y = floatPosition.y + Math.sin(t * 2) * 0.05;
      accessoryRef.current.position.x = floatPosition.x;
      accessoryRef.current.position.z = floatPosition.z;
      accessoryRef.current.rotation.set(0, 0, 0); 
    } else {
      if (targetObject && accessoryRef.current.parent) {
        targetObject.updateWorldMatrix(true, false);

        const targetWorldMat = targetObject.matrixWorld;
        const finalWorldMat = new THREE.Matrix4().multiplyMatrices(targetWorldMat, offsetMatrix);

        const parent = accessoryRef.current.parent;
        parent.updateWorldMatrix(true, false);
        const parentInverse = new THREE.Matrix4().copy(parent.matrixWorld).invert();
        
        const localMat = new THREE.Matrix4().multiplyMatrices(parentInverse, finalWorldMat);

        const _dummyScale = new THREE.Vector3();
        localMat.decompose(
          accessoryRef.current.position,
          accessoryRef.current.quaternion,
          _dummyScale
        );
      }
    }
  });

  return <primitive object={scene} ref={accessoryRef} scale={scale} />;
}