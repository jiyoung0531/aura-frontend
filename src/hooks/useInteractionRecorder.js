import { useRef, useCallback, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE; 

const MIN_DWELL_MS = 150; 

/** PRESS 완료 기준 - 2초*/
const PRESS_COMPLETE_MS = 2000; 

export function useInteractionRecorder(publicId) {
  const bufferRef = useRef([]);      
  const seqRef = useRef(0);          
  const activeRef = useRef(null);    
  const originRef = useRef(performance.now()); 

  const markOrigin = useCallback(() => {
    originRef.current = performance.now(); 
  }, []);

  const exit = useCallback(() => {
    const cur = activeRef.current; 
    if (!cur) return; 
    activeRef.current = null; 

    const dwellMs = Math.round(performance.now() - cur.startedAt); 

    if (dwellMs < MIN_DWELL_MS) return; 

    // 고정된 필드 형식
    const event = {
      seq: ++seqRef.current,
      phase: cur.phase || '',
      target_type: cur.targetType || '',
      
      // 값이 없으면 null을 보내서 형식을 일정하게 유지
      target_part: cur.targetPart || null, 
      target_product_id: cur.targetProductId || null, 
      
      gesture: cur.gesture || '',
      dwell_ms: dwellMs,
      
      is_completed: cur.gesture === 'PRESS' ? (dwellMs >= PRESS_COMPLETE_MS) : true,
      
      rotation_degrees: cur.gesture === 'ROTATE' ? Math.round(cur.rotationDeg || 0) : 0, 
      
      elapsed_ms: Math.round(cur.startedAt - originRef.current),
      occurred_at: new Date(Date.now() - dwellMs).toISOString(),
    };

    bufferRef.current.push(event); 
  }, []);

  const enter = useCallback((desc) => {
    const cur = activeRef.current; 
    const isSame =
      cur && 
      cur.gesture === desc.gesture && 
      cur.targetPart === desc.targetPart && 
      cur.targetProductId === desc.targetProductId; 

    if (isSame) return; 

    exit(); 
    activeRef.current = { ...desc, startedAt: performance.now(), rotationDeg: 0 }; 
  }, [exit]);

  const addRotation = useCallback((degDiff) => {
    if (activeRef.current && activeRef.current.gesture === 'ROTATE') {
      activeRef.current.rotationDeg += Math.abs(degDiff);
    }
  }, []);

  const flush = useCallback(async () => {
    exit(); 
    const events = bufferRef.current;
    if (events.length === 0) return;

    console.log(" 백엔드로 전송하는 이벤트 데이터:", events);

    try {
      await fetch(`${API_BASE}/sessions/${publicId}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events })
      });
      bufferRef.current = []; 
    } catch (error) {
      console.error("이벤트 전송 실패:", error);
    }
  }, [publicId, exit]);

  useEffect(() => {
    if (!publicId) return;

    const onHide = () => {
      exit(); 
      const events = bufferRef.current; 
      if (events.length === 0) return; 
      
      navigator.sendBeacon( 
        `${API_BASE}/sessions/${publicId}/interactions`, 
        new Blob([JSON.stringify({ events })], { type: 'application/json' }) 
      );
    };

    window.addEventListener('pagehide', onHide); 
    return () => window.removeEventListener('pagehide', onHide); 
  }, [publicId, exit]);

  const handleAbandon = useCallback(async () => {
    await flush(); 
    await fetch(`${API_BASE}/sessions/${publicId}/abandon`, { method: 'POST' }); 
  }, [flush, publicId]);

  return { markOrigin, enter, exit, addRotation, flush, handleAbandon };
}