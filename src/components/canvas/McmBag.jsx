import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Accessory } from './Accessory';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGLTF, useTexture } from '@react-three/drei';

const BAG_MODEL_URL = '/models/mcm_final_8.glb';
const TEXTURE_URLS = {
  street: '/textures/romantic_pattern.png', 
  romantic: '/textures/romantic_pattern.png',
  classic: '/textures/street_pattern.png',
  minimal: '/textures/street_pattern.png',
  logo_g: '/textures/logo_g.png', 
  logo_r: '/textures/logo_r.png',
};

export function McmBag({ currentMood = 'street', rotation = [0, Math.PI / 12, 0], handPosRef, setHoveredMaterial }) {
  const { scene } = useGLTF(BAG_MODEL_URL);
  const textures = useTexture(TEXTURE_URLS);
  const { camera, raycaster, size } = useThree();

  const lastHoveredCategory = useRef(null); 
  const shadowMeshRef = useRef(null);
  const audioCtxRef = useRef(null);
  const audioBuffers = useRef({}); 
  const activeSources = useRef({}); 

  const lastHitPoint = useRef(new THREE.Vector3());
  const currentPlaybackRate = useRef(1.0);

  const [phase, setPhase] = useState(2);
  const [zipperMesh, setZipperMesh] = useState(null); 
  const bagGroupRef = useRef();
  const currentRotation = phase === 3 ? [0, 0, 0] : rotation;

  useEffect(() => {
    // 20초 뒤 Phase 3 전환
    const timer = setTimeout(() => {
      setPhase(3);
      console.log("Phase 3 시작: 가방 인터랙션 종료, 악세서리 등장!");
    }, 20000); 
    return () => clearTimeout(timer); 
  }, []);

  useEffect(() => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtxRef.current = new AudioContext();

    const loadSound = async (key, url) => {
      try {
        const response = await fetch(url);
        if(!response.ok) return;
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);
        audioBuffers.current[key] = audioBuffer; 
      } catch (error) {}
    };

    loadSound('leather', '/sounds/leather.mp3');
    loadSound('metal', '/sounds/logo.mp3');
    loadSound('strap', '/sounds/handle.mp3');
    loadSound('logo', '/sounds/logo.mp3');      
    loadSound('zipper', '/sounds/zipper.mp3');   
    loadSound('handle', '/sounds/handle.mp3');
  }, []);

  const playSound = (category) => {
    if (!audioCtxRef.current) return;
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume(); 
    const buffer = audioBuffers.current[category];
    if (buffer) {
      if (activeSources.current[category]) {
        try { activeSources.current[category].stop(); } catch (e) {}
      }
      const source = audioCtxRef.current.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(audioCtxRef.current.destination);
      source.start(0); 
      activeSources.current[category] = source;
    }
  };

  const stopAllSounds = () => {
    Object.values(activeSources.current).forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    activeSources.current = {};
  };

  const shadowTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.9)'); 
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.6)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }, []);

  // 인터랙션 로직 (Phase 2와 Phase 3 분리)
  useFrame((state, delta) => {
    if (!handPosRef || !handPosRef.current || !setHoveredMaterial) return;

    const x = (handPosRef.current.x / size.width) * 2 - 1;
    const y = -(handPosRef.current.y / size.height) * 2 + 1;
    raycaster.setFromCamera({ x, y }, camera);

    const resetVisualEffect = () => {
      if (shadowMeshRef.current) {
        shadowMeshRef.current.visible = false; 
        shadowMeshRef.current.scale.set(1, 1, 1);
      }
      stopAllSounds();     
      setHoveredMaterial(null);
      lastHoveredCategory.current = null;
    };

    // Phase 2: 가방 소리, 그림자, 질감 표시 작동
    if (phase === 2) {
      const intersects = raycaster.intersectObject(scene, true);
      let category = 'none';

      if (intersects.length > 0) {
        const hit = intersects[0];
        const hitObject = hit.object;
        const hitName = hitObject.name.toLowerCase();
        
        setHoveredMaterial(hitName);

        if (hitName.includes('logo')) category = 'logo'; 
        else if (hitName.includes('zip')) category = 'zipper'; 
        else if (hitName.includes('handle')) category = 'handle'; 
        else if (hitName.includes('hardware') || hitName.includes('buckle') || hitName.includes('side')) category = 'metal'; 
        else if (hitName.includes('strap') || hitName.includes('line')) category = 'strap'; 
        else if (hitName.includes('bag') || hitName.includes('panel')) category = 'leather'; 

        if (category !== 'none') {
          if (shadowMeshRef.current) {
            shadowMeshRef.current.visible = true; 
            shadowMeshRef.current.position.copy(hit.point);
            if (hit.face) {
              const normal = hit.face.normal.clone();
              normal.transformDirection(hit.object.matrixWorld); 
              shadowMeshRef.current.lookAt(hit.point.clone().add(normal)); 
              shadowMeshRef.current.position.add(normal.multiplyScalar(0.015));
            }
            shadowMeshRef.current.scale.lerp(new THREE.Vector3(1.3, 1.3, 1.3), 0.15);
          }

          const distance = hit.point.distanceTo(lastHitPoint.current);
          lastHitPoint.current.copy(hit.point); 
          const rawSpeed = (distance / delta) * 2.0; 
          const targetRate = Math.max(0.5, Math.min(0.5 + rawSpeed, 2.5));
          currentPlaybackRate.current = THREE.MathUtils.lerp(currentPlaybackRate.current, targetRate, 0.1);

          if (activeSources.current[category]) {
            activeSources.current[category].playbackRate.value = currentPlaybackRate.current;
          }

          if (lastHoveredCategory.current !== category) {
            resetVisualEffect();
            lastHoveredCategory.current = category;
            playSound(category);        
          }
        } else {
          resetVisualEffect();
        }
      } else {
        resetVisualEffect();
      }
    } 
    // Phase 3: 가방 정면 복구 및 기존 효과 끄기 
    else if (phase === 3) {
      resetVisualEffect(); 
      
      if (bagGroupRef.current) {
        bagGroupRef.current.rotation.x = THREE.MathUtils.lerp(bagGroupRef.current.rotation.x, 0, 0.05);
        bagGroupRef.current.rotation.y = THREE.MathUtils.lerp(bagGroupRef.current.rotation.y, 0, 0.05);
        bagGroupRef.current.rotation.z = THREE.MathUtils.lerp(bagGroupRef.current.rotation.z, 0, 0.05);
      }
    }
  });

  const selectedTexture = textures[currentMood];
  if (selectedTexture) {
    selectedTexture.flipY = false; 
    selectedTexture.wrapS = THREE.RepeatWrapping;
    selectedTexture.wrapT = THREE.RepeatWrapping;
    selectedTexture.repeat.set(10, 10); 
    selectedTexture.colorSpace = THREE.SRGBColorSpace;
    selectedTexture.anisotropy = 16; 
    selectedTexture.generateMipmaps = false; 
    selectedTexture.minFilter = THREE.LinearFilter;
  }

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.flatShading = false; 
        child.geometry.computeVertexNormals();

        if (child.material.name === 'bag') {
          if (child.name === 'bag_mesh' || child.name === 'side_panel_mesh') {
            child.material.map = selectedTexture;
            child.material.color.set('#412D15'); 
            if (child.material.normalMap) child.material.normalScale.set(2, 2); 
            child.material.needsUpdate = true;
          }
        }

        if (child.name === 'shoulder_strap_001_mesh' || child.name === 'shoulder_strap_002_mesh'
            || child.name === 'strap_001_mesh' || child.name === 'strap_002_mesh'
            || child.name === 'round_line_001_mesh' || child.name === 'round_line_002_mesh'|| child.name === 'strong_handle_mesh'
        ) {
          child.material = child.material.clone(); 
          child.material.map = null; 
          child.material.color.set('#FF0000');        
          child.material.needsUpdate = true;
        }

        if (child.name === 'zipper_pull_pocket_0') {
          setZipperMesh(child); 
        }
      }
    });
  }, [scene, textures, currentMood]);

  return (
    <group>
      <group ref={bagGroupRef} rotation={currentRotation}>
        <primitive object={scene} scale={1.5} />
      </group>
      
      <mesh ref={shadowMeshRef} visible={false}>
        <planeGeometry args={[0.15, 0.15]} /> 
        <meshBasicMaterial map={shadowTexture} transparent={true} depthWrite={false} opacity={0.8} />
      </mesh>

      {phase === 3 && (
        <>
          {/* 오리지널 키링 */}
          <Accessory 
            modelUrl="/models/original_keyring.glb" 
            handPosRef={handPosRef} 
            targetObject={zipperMesh}
            initialFloatPosition={new THREE.Vector3(-0.15, -0.6, 0.5)} 
            attachmentOffset={[0.12, 0.16, 0.13]}
            scale={1.5} 
          />
          
          {/* 테디베어 키링 */}
          <Accessory 
            modelUrl="/models/teddy_keyring.glb" 
            handPosRef={handPosRef} 
            targetObject={zipperMesh}
            initialFloatPosition={new THREE.Vector3(0.15, -0.6, 0.5)} 
            attachmentOffset={[0.12, 0.16, 0.13]}
            attachmentRotation={[0, -Math.PI / 2, 0]}
            scale={1.5} 
          />
        </>
      )}
    </group>
  );
}