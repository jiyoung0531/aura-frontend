import React, { useState, useEffect, useRef } from "react";
import { finalizeAuraSession } from "../../api/auraApi";
import QrResultScreen from "./QrResultScreen";
import { getAuraOutputStatus } from '../../api/auraApi';

export default function PhaseOverlay({
  phase,
  orbCreated = false,
  publicId,
  auraColors,
  activeAccessoryId,
  recorderStatus,
  captureSegment
}) {
  const isOrbPhase = phase === "orb" || phase === "injecting";

  const [qrImageUrl, setQrImageUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const hasStartedRef = useRef(false);

  useEffect(() => {
    console.log("현재 영상 상태:", recorderStatus);

    if (recorderStatus !== "complete") return;
    if (hasStartedRef.current) return; 
    hasStartedRef.current = true;

    let isCancelled = false;
    let timerId = null;

    console.log("영상 업로드 완료");

    const checkStatus = async () => {
      if (isCancelled) return;

      try {
        const statusResult = await getAuraOutputStatus(publicId);
        if (isCancelled) return;

        console.log("백엔드 상태 응답:", statusResult);

        const videoStatus = statusResult?.video_status || statusResult?.data?.video_status;

        if (videoStatus === "READY") {
          console.log("비디오 준비 완료");

          try {
            const finalizeResult = await finalizeAuraSession(publicId, auraColors, activeAccessoryId);
            if (isCancelled) return;
            console.log("Finalize 최종 응답:", finalizeResult);

            const qrUrl = 
              finalizeResult?.data?.qr_image_url || 
              finalizeResult?.qr_image_url || 
              statusResult?.data?.qr_image_url || 
              statusResult?.qr_image_url;

            if (qrUrl) {
              console.log("QR 생성 완료", qrUrl);
              setQrImageUrl(qrUrl);
              setIsGenerating(false);
              return; // 성공 시 폴링 완전 종료
            }
          } catch (finError) {
            console.log("Finalize 아직 처리 중 (재시도 예정)...", finError);
          }

          // 주소가 아직 없다면 2초 뒤 재시도 예약
          if (!isCancelled) {
            timerId = setTimeout(checkStatus, 2000);
          }
        } else {
          console.log("영상 가공 중");
          if (!isCancelled) {
            timerId = setTimeout(checkStatus, 3000);
          }
        }
      } catch (error) {
        console.error("상태 확인 중 에러 발생 (재시도 중):", error);
        if (!isCancelled) {
          timerId = setTimeout(checkStatus, 3000);
        }
      }
    };

    checkStatus(); 

    return () => {
      isCancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [recorderStatus, publicId]); 

  const handleCompleteClick = async () => {
    setIsGenerating(true);

    if (captureSegment) {
      console.log("비디오 녹화 종료 명령 전달");
      captureSegment(0, { finish: true }); 
    } else {
      console.error("App.jsx에서 captureSegment 안 넘김");
    }

    console.log("전송 대기 데이터 확인:", {
      publicId: publicId,
      auraColors: auraColors,
      activeAccessoryId: activeAccessoryId,
    });
  };

  if (qrImageUrl) {
    return (
      <QrResultScreen
        qrImageUrl={qrImageUrl}
        onReset={() => (window.location.href = "/")}
      />
    );
  }

  return (
    <div className="phase-ui-overlay">
      {/* 상단 영역 */}
      <div className="top-banner">
        <img src="/aura-logo.svg" alt="AURA Logo" className="aura-logo" />

        {/* 스테퍼 */}
        <div className="stepper-row">
          <img src="/check.svg" alt="Step 1 Done" className="step-item" />
          <img
            src="/aura-progress-gold.svg"
            alt="progress"
            className="step-progress"
          />

          {phase === 2 || isOrbPhase ? (
            <img src="/twoy.svg" alt="Step 2 Active" className="step-item" />
          ) : (
            <img src="/check.svg" alt="Step 2 Done" className="step-item" />
          )}

          <img
            src={
              phase === 3
                ? "/aura-progress-gold.svg"
                : "/aura-progress-white.svg"
            }
            alt="progress"
            className="step-progress"
          />

          {phase === 3 ? (
            <img src="/threey.svg" alt="Step 3 Active" className="step-item" />
          ) : (
            <img
              src="/threew.svg"
              alt="Step 3 Inactive"
              className="step-item"
            />
          )}
        </div>
      </div>

      {phase === 3 && (
        <div className="phase3-content">
          <div className="phase3-title">
            <h2>Choose Your Charm</h2>
            <p>나만의 액세서리를 선택해 보세요.</p>
          </div>
        </div>
      )}

      {phase === "orb" && (
        <div className="aura-gather-prompt">
          {orbCreated ? "오브를 밀어넣어보세요" : "손을 모아보세요"}
        </div>
      )}

      {/* 하단 영역 */}
      <div className="bottom-banner">
        {phase === 3 && (
          <>
            <button
              className="complete-btn"
              onClick={handleCompleteClick}
              disabled={isGenerating}
            >
              {isGenerating ? "QR 생성 중..." : "완료"}
            </button>
          </>
        )}
        <img src="/mcm-logo.svg" alt="MCM Logo" className="mcm-logo" />
      </div>
    </div>
  );
}