import React, { useEffect } from 'react';
import * as THREE from 'three';
import { useGLTF, useTexture } from '@react-three/drei';

const BAG_MODEL_URL = '/models/mcm_final_5.glb';
const TEXTURE_URLS = {
  //무드 구분
  street: '/textures/minimal_pattern.png', 
  romantic: '/textures/romantic_pattern.png',
  classic: '/textures/street_pattern.png',
  minimal: '/textures/street_pattern.png',
  // 로고 이미지
  logo_g: '/textures/logo_g.png', 
  logo_r: '/textures/logo_r.png',
};

export function McmBag({ currentMood = 'street' }) {
  // 가방 모델 불러오기
  const { scene } = useGLTF(BAG_MODEL_URL);

  // 무드별 2D 텍스처 불러오기
  const textures = useTexture(TEXTURE_URLS);

  // 패턴용 텍스처 설정 
  const selectedTexture = textures[currentMood];
  if (selectedTexture) {
    selectedTexture.flipY = false; 
    
    // 패턴을 바둑판처럼 반복
    selectedTexture.wrapS = THREE.RepeatWrapping;
    selectedTexture.wrapT = THREE.RepeatWrapping;

    // 패턴크기 설정
    selectedTexture.repeat.set(10, 10); 

    selectedTexture.colorSpace = THREE.SRGBColorSpace;
  }

  // 로고용 텍스처 설정 
  /*const logoKey = currentMood === 'romantic' ? 'logo_r' : 'logo_g'; 
  const logoTexture = textures[logoKey];
  
  if (logoTexture) {
    logoTexture.flipY = false; 

    logoTexture.wrapS = THREE.ClampToEdgeWrapping;
    logoTexture.wrapT = THREE.ClampToEdgeWrapping;

    logoTexture.colorSpace = THREE.SRGBColorSpace;
  }*/

  //  텍스처 모델에 덮어씌우기
  useEffect(() => {
    // 콘솔에서 메쉬/재질 이름 확인용 로그
    console.log('--- 3D 모델 메쉬 정보 확인 ---');

    scene.traverse((child) => {
      if (child.isMesh && child.material) {
        // 메쉬 이름 확인 로그
        console.log(`메쉬 이름: ${child.name} / 재질(Material) 이름: ${child.material.name}`);

        // 특정 파트에만 패턴 적용 
        // 메쉬 이름으로 필터링하여 정확한 부위에만 적용
        if (child.material.name === 'bag') {
          // 지정 파트 bag_mesh, side_panel_mesh
          if (child.name === 'bag_mesh' || child.name === 'side_panel_mesh') {
            child.material.map = selectedTexture;
            child.material.color.set('white'); 
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
          child.material.color.set('red');        
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

  // 15도 회전된 뷰
  return <primitive object={scene} rotation={[0, Math.PI / 12, 0]} scale={1.5} />;
}