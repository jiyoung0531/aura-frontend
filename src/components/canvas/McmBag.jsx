import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGLTF, useTexture } from '@react-three/drei';
import { Accessory } from './Accessory';
import { useInteractionRecorder } from '../../hooks/useInteractionRecorder';

const BAG_MODEL_URL = '/models/mcm_final_8.glb';
const TEXTURE_URLS = {
  mcm: "/textures/mcm_pattern.png",
  street: '/textures/street_pattern.png',
  romantic: '/textures/romantic_pattern.png',
  classic: '/textures/classic_pattern.png',
  minimal: '/textures/minimal_pattern.png',
  logo_g: '/textures/logo_g.png',
  logo_r: '/textures/logo_r.png',
};

const resolvePartName = (meshName) => {
  const name = meshName.toLowerCase();
  if (name.includes('zip')) return 'ZIPPER_LINE';
  if (name.includes('logo') || name.includes('stud')) return 'LOGO_STUD';
  if (name.includes('strap') || name.includes('buckle') || name.includes('handle') || name.includes('hardware')) return 'STRAP_BUCKLE';
  return 'BISETOS_LEATHER';
};

export function McmBag({
  currentMood = 'street',
  assetPatterns,
  auraPalette = [],
  isInfused = false,
  rotation = [0, Math.PI / 12, 0],
  phase = 2,
  handPosRef,
  sessionPublicId,
  setHoveredMaterial,
}) {
  const { scene } = useGLTF(BAG_MODEL_URL);
  const textureUrls = useMemo(
    () => ({
      original: assetPatterns?.original || TEXTURE_URLS.mcm,
      STREET: assetPatterns?.STREET || TEXTURE_URLS.street,
      ROMANTIC: assetPatterns?.ROMANTIC || TEXTURE_URLS.romantic,
      CLASSIC: assetPatterns?.CLASSIC || TEXTURE_URLS.classic,
      MINIMAL: assetPatterns?.MINIMAL || TEXTURE_URLS.minimal,
    }),
    [assetPatterns],
  );
  const textures = useTexture(textureUrls);
  const { camera, raycaster, size } = useThree();

  const lastHoveredCategory = useRef(null);
  const shadowMeshRef = useRef(null);
  const audioCtxRef = useRef(null);
  const audioBuffers = useRef({});
  const activeSources = useRef({});

  const lastHitPoint = useRef(new THREE.Vector3());
  const currentPlaybackRate = useRef(1.0);

  const [zipperMesh, setZipperMesh] = useState(null);
  const bagGroupRef = useRef();
  const bagMaterialsRef = useRef([]);
  const currentRotation = phase === 3 ? [0, 0, 0] : rotation;
  const [isBagTilted, setIsBagTilted] = useState(false);
  const tiltTimeoutRef = useRef(null);

  const [activeAccessory, setActiveAccessory] = useState(null);

  // 이벤트 트래킹 훅 연결
  const { markOrigin, enter, exit, addRotation, flush } = useInteractionRecorder(sessionPublicId);
  const prevRotY = useRef(rotation[1]);

  const handleToggleAttach = (attached) => {
    if (attached) {
      setTimeout(() => {
        setIsBagTilted(true);
        if (tiltTimeoutRef.current) clearTimeout(tiltTimeoutRef.current);
        tiltTimeoutRef.current = setTimeout(() => setIsBagTilted(false), 400);
      }, 0);
    } else {
      setTimeout(() => setIsBagTilted(false), 0);
    }
  };

  useEffect(() => {
    if (phase === 2) markOrigin();
    if (phase === 3) void flush();
  }, [flush, markOrigin, phase]);

  useEffect(() => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtxRef.current = window.__auraAudioContext || new AudioContext();

    const loadSound = async (key, url) => {
      try {
        const response = await fetch(url);
        if (!response.ok) return;
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

  const targetBagColor = useMemo(
    () => new THREE.Color(isInfused ? auraPalette[0] || '#ffffff' : '#ffffff'),
    [auraPalette, isInfused],
  );

  // 인터랙션 로직 (Phase 2와 Phase 3 분리)
  useFrame((state, delta) => {
    const colorLerp = 1 - Math.exp(-3.2 * delta);
    bagMaterialsRef.current.forEach((material) => {
      material.color?.lerp(targetBagColor, colorLerp);
    });

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
      const rotDiff = Math.abs(rotation[1] - prevRotY.current);
      const isRotating = rotDiff > 0.001;

      if (isRotating) {
        enter({
          phase: 'PHASE2_HAPTIC',
          targetType: 'BAG_PART',
          targetPart: 'BAG_BODY',
          gesture: 'ROTATE'
        });
        addRotation(rotDiff * (180 / Math.PI));
      }
      prevRotY.current = rotation[1];

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

          if (!isRotating) {
            console.log("현재 터치 중인 부위:", resolvePartName(hitName));
            enter({
              phase: 'PHASE2_HAPTIC',
              targetType: 'BAG_PART',
              targetPart: resolvePartName(hitName),
              gesture: 'HOVER'
            });
          }
        } else {
          resetVisualEffect();
          if (!isRotating) exit();
        }
      } else {
        resetVisualEffect();
        if (!isRotating) exit();
      }
    }
    // Phase 3: 가방 정면 복구 및 기존 효과 끄기
    else if (phase === 3) {
      if (shadowMeshRef.current) shadowMeshRef.current.visible = false;
      stopAllSounds();

      if (bagGroupRef.current) {
        const targetRotationX = isBagTilted ? 0.15 : 0;
        bagGroupRef.current.rotation.x = THREE.MathUtils.lerp(bagGroupRef.current.rotation.x, targetRotationX, 0.1);
        bagGroupRef.current.rotation.y = THREE.MathUtils.lerp(bagGroupRef.current.rotation.y, 0, 0.05);
        bagGroupRef.current.rotation.z = THREE.MathUtils.lerp(bagGroupRef.current.rotation.z, 0, 0.05);
      }
    }
    // 오브 주입 단계에서는 가방 촉각 효과와 사운드를 모두 끈다.
    else {
      if (shadowMeshRef.current) shadowMeshRef.current.visible = false;
      stopAllSounds();
      setHoveredMaterial(null);
    }
  });

  // 텍스처 설정
  const selectedTexture = isInfused
    ? textures[currentMood.toUpperCase()] || textures.STREET
    : textures.original;
  if (selectedTexture) {
    selectedTexture.flipY = false;
    selectedTexture.wrapS = THREE.RepeatWrapping;
    selectedTexture.wrapT = THREE.RepeatWrapping;
    selectedTexture.repeat.set(10, 10);
    selectedTexture.colorSpace = THREE.SRGBColorSpace;
    selectedTexture.anisotropy = 16;
    selectedTexture.generateMipmaps = false;
    selectedTexture.minFilter = THREE.LinearFilter;
    selectedTexture.needsUpdate = true;
  }

  useEffect(() => {
    bagMaterialsRef.current = [];
    scene.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.flatShading = false;
        child.geometry.computeVertexNormals();

        if (child.name === 'bag_mesh' || child.name === 'side_panel_mesh') {
          child.material.map = selectedTexture;
          child.material.color.set('#ffffff');
          child.material.map.needsUpdate = true;
          bagMaterialsRef.current.push(child.material);
          if (child.material.normalMap) child.material.normalScale.set(2, 2);
          child.material.needsUpdate = true;
        }

        if (
          child.name === 'shoulder_strap_001_mesh' ||
          child.name === 'shoulder_strap_002_mesh' ||
          child.name === 'strap_001_mesh' ||
          child.name === 'strap_002_mesh' ||
          child.name === 'round_line_001_mesh' ||
          child.name === 'round_line_002_mesh' ||
          child.name === 'strong_handle_mesh'
        ) {
          child.material = child.material.clone();
          child.material.map = null;
          child.material.color.set('#5E3122');
          child.material.needsUpdate = true;
        }

        if (child.name === 'zipper_pull_pocket_0') {
          setZipperMesh(child);
        }
      }
    });
  }, [scene, textures, currentMood, phase, isInfused, selectedTexture]);


  const bagScale = phase === 3 ? 3.4 : 5.9;
  const bagPosition = phase === 3 ? [0, -0.38, 0] : [0, -1.3, 0];

  return (
    <group>
      <group ref={bagGroupRef} rotation={currentRotation}>
        <primitive object={scene} scale={bagScale} position={bagPosition} />
      </group>

      <mesh ref={shadowMeshRef} visible={false}>
        <planeGeometry args={[0.15, 0.15]} />
        <meshBasicMaterial
          map={shadowTexture}
          transparent={true}
          depthWrite={false}
          opacity={0.8}
        />
      </mesh>

      {phase === 3 && (
        <>
          {/* 오리지널 키링 (ID: 1) */}
          <group
            onPointerDown={(e) => {
              e.stopPropagation();
              enter({ phase: 'PHASE3_STYLING', targetType: 'ACCESSORY', targetProductId: 1, gesture: 'PRESS' });
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              exit();
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              exit();
            }}
          >
            <Accessory
              modelUrl="/models/original_keyring.glb"
              handPosRef={handPosRef}
              targetObject={zipperMesh}
              initialFloatPosition={new THREE.Vector3(-0.3, -0.52, 0.5)}
              attachmentOffset={[0.38, 0.56, 0.43]}
              attachmentRotation={[0, Math.PI / 4, 0]}
              scale={3.5}
              attachSoundUrl="/sounds/original_sound.mp3"
             //onToggleAttach={handleToggleAttach}
             isAttached={activeAccessory === 'keyring'}
             onToggleAttach={() => setActiveAccessory(activeAccessory === 'keyring' ? null : 'keyring')}
            />
          </group>

          {/* 테디베어 키링 (ID: 2) */}
          <group
            onPointerDown={(e) => {
              e.stopPropagation();
              enter({ phase: 'PHASE3_STYLING', targetType: 'ACCESSORY', targetProductId: 2, gesture: 'PRESS' });
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              exit();
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              exit();
            }}
          >
            <Accessory
              modelUrl="/models/teddy_keyring.glb"
              handPosRef={handPosRef}
              targetObject={zipperMesh}
              initialFloatPosition={new THREE.Vector3(0.3, -0.52, 0.5)}
              attachmentOffset={[0.38, 0.56, 0.43]}
              attachmentRotation={[0, -Math.PI / 2, 0]}
              scale={3.5}
              attachSoundUrl="/sounds/teddy_sound.mp3"
              isAttached={activeAccessory === 'charm'}
              onToggleAttach={() => setActiveAccessory(activeAccessory === 'charm' ? null : 'charm')}
             // onToggleAttach={handleToggleAttach}
            />
          </group>
        </>
      )}
    </group>
  );
}
