import { useState, useEffect, useRef } from "react";
import { finalizeAuraSession } from "../../api/auraApi";
import QrResultScreen from "./QrResultScreen";
import { getAuraOutputStatus } from "../../api/auraApi";
import { attachAccessory } from "../../api/auraApi";
import VideoPreparingScreen from "./VideoPreparingScreen";

export default function PhaseOverlay({
  phase,
  orbCreated = false,
  publicId,
  auraColors,
  activeAccessoryId,
  recorderStatus,
  onFinalizeRecording,
}) {
  const isOrbPhase = phase === "orb" || phase === "injecting";

  const [qrImageUrl, setQrImageUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [preparationProgress, setPreparationProgress] = useState(0);
  const preparationStartedAtRef = useRef(0);
  const progressTimerRef = useRef(null);

useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
      }
    };
  }, []);

  const startPreparationProgress = () => {
    preparationStartedAtRef.current = Date.now();
    setPreparationProgress(0);
    progressTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - preparationStartedAtRef.current;
      const nextProgress =
        elapsed < 3000
          ? Math.min(72, Math.round((elapsed / 3000) * 72))
          : Math.min(95, 72 + Math.round((elapsed - 3000) / 1200));
      setPreparationProgress(nextProgress);
    }, 120);
  };

  const handleCompleteClick = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setIsPreparing(true);
    startPreparationProgress();

    console.log("전송 대기 데이터 확인:", {
      publicId: publicId,
      auraColors: auraColors,
      activeAccessoryId: activeAccessoryId,
    });

    if (onFinalizeRecording) {
      console.log("최종 키링 장면 녹화 명령 전달");
      onFinalizeRecording();
    } else {
      console.error("App.jsx에서 onFinalizeRecording 안 넘김");
    }

    try {
      console.log("최종 악세사리 부착 모습 녹화 중...");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (activeAccessoryId) {
        console.log(
          `[API 전송] 최종 선택된 악세사리(${activeAccessoryId}) 백엔드 부착 요청...`,
        );
        try {
          await attachAccessory(publicId, activeAccessoryId);
          console.log("악세사리 부착 API 전송 완료!");
        } catch (attachErr) {
          console.error("악세사리 부착 실패:", attachErr);
        }
      }

      let qrUrl = null;
      const startTime = preparationStartedAtRef.current;

      while (!qrUrl) {
        const elapsed = Date.now() - startTime;
        
        if (elapsed >= 12000) {
          console.log("12초 경과: 비디오 상태 확인 종료");
          break; 
        }

        console.log("백엔드 비디오 상태 확인 시도 중...");

        try {
          const statusResult = await getAuraOutputStatus(publicId);
          const videoStatus = statusResult?.video_status || statusResult?.data?.video_status;

          if (videoStatus === "READY") {
            console.log("비디오 준비 완료! Finalize 요청 전송...");
            const finalizeResult = await finalizeAuraSession(
              publicId,
              auraColors,
              activeAccessoryId
            );
            qrUrl =
              finalizeResult?.data?.qr_image_url ||
              finalizeResult?.qr_image_url ||
              statusResult?.data?.qr_image_url ||
              statusResult?.qr_image_url;
            
            if (qrUrl) break; 
          }
        } catch (pollErr) {
          console.log("상태 확인 중 대기...", pollErr);
        }

        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      if (qrUrl) {
        console.log("비디오 생성 성공. QR 화면으로 바로 이동!");
        if (progressTimerRef.current) {
          window.clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
        setPreparationProgress(100);
        setIsPreparing(false);
        setQrImageUrl(qrUrl);

      } else {
        console.log("비디오 생성 지연/실패. 21초까지 대기 시작...");
        const elapsedNow = Date.now() - startTime;
        const remainingTo21s = 21000 - elapsedNow; 
        
        // 남은 시간만큼 로딩 화면을 계속 유지하며 대기
        if (remainingTo21s > 0) {
          await new Promise((resolve) => setTimeout(resolve, remainingTo21s));
        }

        console.log("21초 대기 완료. 백엔드 예외 처리용 Finalize 요청 전송...");
        try {
          const finalizeResult = await finalizeAuraSession(
            publicId,
            auraColors,
            activeAccessoryId
          );
          
          qrUrl = finalizeResult?.data?.qr_image_url || finalizeResult?.qr_image_url;

          if (progressTimerRef.current) {
            window.clearInterval(progressTimerRef.current);
            progressTimerRef.current = null;
          }
          setPreparationProgress(100);
          setIsPreparing(false);

          if (qrUrl) {
            setQrImageUrl(qrUrl); // 비디오가 null이어도 백엔드가 만들어준 진짜 QR 화면 띄우기
          } else {
            alert("QR 발급에 실패했습니다. 다시 시도해 주세요.");
            setIsGenerating(false);
          }
        } catch (error) {
          console.error("대체 QR 요청 중 에러:", error);
          if (progressTimerRef.current) {
            window.clearInterval(progressTimerRef.current);
            progressTimerRef.current = null;
          }
          setIsPreparing(false);
          setIsGenerating(false);
          alert("네트워크 오류가 발생했습니다.");
        }
      }
    } catch (error) {
      console.error("완료 처리 최상위 에러:", error);
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      setIsPreparing(false);
      setIsGenerating(false);
      alert("처리 중 오류가 발생했습니다.");
    }
  };

  if (isPreparing) {
    return <VideoPreparingScreen progress={preparationProgress} />;
  }

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
         <div className="phase3-title" style={{ width: "100%", display: "block", marginTop: "95px" }}>
            <h2 style={{ fontSize: "clamp(20px, 3.5vw, 50px)", whiteSpace: "nowrap", color: "#ffffff", marginLeft: "20px", lineHeight: "1.2" }}>
              Choose Your Charm
            </h2>
            <p style={{ fontSize: "clamp(14px, 2.5vw, 24px)", whiteSpace: "nowrap", color: "#ffffff", marginLeft: "20px", marginTop: "8px" }}>
             나만의 액세서리를 선택해 보세요.
            </p>
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
