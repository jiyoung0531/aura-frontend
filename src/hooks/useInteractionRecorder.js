import { useRef, useCallback, useEffect } from 'react';

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  'https://aura-backend-877724382169.asia-northeast3.run.app/api';

const MIN_DWELL_MS = 150;

/* PRESS 완료 기준 -2초 */
const PRESS_COMPLETE_MS = 2000;

export function useInteractionRecorder(publicId) {
  const bufferRef = useRef([]);      // 전송 대기 이벤트
  const seqRef = useRef(0);          
  const activeRef = useRef(null);    // 현재 추적 구간
  const originRef = useRef(performance.now()); 

  /**Phase 1 시작 시 호출 */
  const markOrigin = useCallback(() => {
    originRef.current = performance.now();
  }, []);

  const exit = useCallback(() => {
    const cur = activeRef.current;
    if (!cur) return;
    activeRef.current = null;

    const dwellMs = Math.round(performance.now() - cur.startedAt);
    if (dwellMs < MIN_DWELL_MS) return;

    const event = {
      seq: ++seqRef.current,
      phase: cur.phase || null,
      target_type: cur.targetType || null,
      target_part: cur.targetPart || null,          // 값이 없으면 null
      target_product_id: cur.targetProductId || null, // 값이 없으면 null
      gesture: cur.gesture || null,
      dwell_ms: dwellMs,
      rotation_degrees: cur.gesture === 'ROTATE' ? Math.round(cur.rotationDeg || 0) : 0, // 기본값 0
      is_completed: cur.gesture === 'PRESS' ? (dwellMs >= PRESS_COMPLETE_MS) : true, // 기본값 true
      elapsed_ms: Math.round(cur.startedAt - originRef.current),
      occurred_at: new Date(Date.now() - dwellMs).toISOString(),
    };

    bufferRef.current.push(event);
  }, []);

  /* 대상 진입 */
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

  /* 버퍼 데이터 전송 */
  const flush = useCallback(async () => {
    exit();
    if (!publicId) return;
    const events = bufferRef.current;
    if (events.length === 0) return;

    console.log("백엔드로 전송하는 이벤트 데이터:", events);

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
