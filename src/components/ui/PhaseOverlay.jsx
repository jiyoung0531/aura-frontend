import React, { useState } from 'react';
import { finalizeAuraSession } from '../../api/auraApi';
import QrResultScreen from './QrResultScreen';

export default function PhaseOverlay({ 
  phase, 
  orbCreated = false,
  publicId,           
  auraColors,         
  activeAccessoryId   
}) {
  const isOrbPhase = phase === 'orb';

  const [qrImageUrl, setQrImageUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const handleCompleteClick = async () => {
    setIsGenerating(true); 
    try {
      console.log("전송 데이터 확인:", { 
        publicId: publicId, 
        auraColors: auraColors, 
        activeAccessoryId: activeAccessoryId 
      });
      
      const data = await finalizeAuraSession(publicId, auraColors, activeAccessoryId);
      setQrImageUrl(data.qr_image_url);
      
    } catch (error) {
      console.error("에러 상세 내용:", error);
      alert("QR 코드 생성에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setIsGenerating(false); 
    }
  };

 if (qrImageUrl) {
    return (
      <QrResultScreen 
        qrImageUrl={qrImageUrl} 
        onReset={() => window.location.href = '/'} 
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
          <img src="/aura-progress-gold.svg" alt="progress" className="step-progress" />

          {phase === 2 || isOrbPhase ? (
            <img src="/twoy.svg" alt="Step 2 Active" className="step-item" />
          ) : (
            <img src="/check.svg" alt="Step 2 Done" className="step-item" />
          )}

          <img 
            src={phase === 3 ? "/aura-progress-gold.svg" : "/aura-progress-white.svg"} 
            alt="progress" 
            className="step-progress" 
          />

          {phase === 3 ? (
            <img src="/threey.svg" alt="Step 3 Active" className="step-item" />
          ) : (
            <img src="/threew.svg" alt="Step 3 Inactive" className="step-item" />
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

      {isOrbPhase && (
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