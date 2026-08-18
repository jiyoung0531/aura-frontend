import { useState, useEffect, useRef } from "react";
import { finalizeAuraSession } from "../../api/auraApi";
import QrResultScreen from "./QrResultScreen";
import { getAuraOutputStatus } from "../../api/auraApi";
import { attachAccessory } from '../../api/auraApi';

export default function PhaseOverlay({
  phase,
  orbCreated = false,
  publicId,
  auraColors,
  activeAccessoryId,
  recorderStatus,
  captureSegment,
}) {
  const isOrbPhase = phase === "orb" || phase === "injecting";

  const [qrImageUrl, setQrImageUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleCompleteClick = async () => {
    if (isGenerating) return;
    setIsGenerating(true);

    console.log("전송 대기 데이터 확인:", {
      publicId: publicId,
      auraColors: auraColors,
      activeAccessoryId: activeAccessoryId,
    });

    try {
      console.log("최종 악세사리 부착 모습 녹화 중...");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (captureSegment) {
        console.log("비디오 녹화 종료 명령 전달");
        captureSegment(0, { finish: true });
      } else {
        console.error("App.jsx에서 captureSegment 안 넘김");
      }

      if (activeAccessoryId) {
        console.log(`[API 전송] 최종 선택된 악세사리(${activeAccessoryId}) 백엔드 부착 요청...`);
        try {
          await attachAccessory(publicId, activeAccessoryId);
          console.log("악세사리 부착 API 전송 완료!");
        } catch (attachErr) {
          console.error("악세사리 부착 실패:", attachErr);
        }
      }

      let qrUrl = null;
      let attempts = 0;

      while (!qrUrl && attempts < 30) {
        attempts++;
        console.log(`백엔드 비디오 상태 확인 시도 중... (${attempts}/30)`);

        try {
          const statusResult = await getAuraOutputStatus(publicId);
          const videoStatus =
            statusResult?.video_status || statusResult?.data?.video_status;

          if (videoStatus === "READY") {
            console.log("비디오 준비 완료, Finalize 요청 전송...");

            const finalizeResult = await finalizeAuraSession(
              publicId,
              auraColors,
              activeAccessoryId,
            );
            console.log("Finalize 최종 응답:", finalizeResult);

            qrUrl =
              finalizeResult?.data?.qr_image_url ||
              finalizeResult?.qr_image_url ||
              statusResult?.data?.qr_image_url ||
              statusResult?.qr_image_url;

            if (qrUrl) {
              console.log("QR 생성 완료:", qrUrl);
              break;
            }
          }
        } catch (pollErr) {
          console.log("아직 처리 중, 2초 후 재시도...", pollErr);
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      if (qrUrl) {
        setQrImageUrl(qrUrl);
      } else {
        alert("QR 생성 시간이 초과되었습니다. 다시 시도해 주세요.");
        setIsGenerating(false);
      }
    } catch (error) {
      console.error("완료 처리 중 에러 발생:", error);
      alert("처리 중 오류가 발생했습니다.");
      setIsGenerating(false);
    }
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

      {phase === "orb" &&
        (orbCreated ? (
          <div className="aura-orb-push-guidance">
            <img src="/icons/press-bag.svg" alt="" />
            <span>가방에 press하세요</span>
            <small>Press on the bag</small>
          </div>
        ) : (
          <div className="aura-orb-gather-guidance">
            <img src="/icons/hands-praying-gather.svg" alt="" />
            <span>손을 모아보세요</span>
            <small>Gather your hands</small>
          </div>
        ))}

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
