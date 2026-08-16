export default function PhaseOverlay({ phase, orbCreated = false }) {
  const isOrbPhase = phase === 'orb' || phase === 'injecting';

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

      {phase === 'orb' && (
        <div className="aura-gather-prompt">
          {orbCreated ? "오브를 밀어넣어보세요" : "손을 모아보세요"}
        </div>
      )}

{/* 하단 영역 */}
<div className="bottom-banner">
  {phase === 3 && (
    <>
      <button className="complete-btn">완료</button>
    </>
  )}
  <img src="/mcm-logo.svg" alt="MCM Logo" className="mcm-logo" />
</div>
    </div>
  );
}
