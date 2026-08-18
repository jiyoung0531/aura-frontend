export default function CameraScreen({
  videoRef,
  canvasRef,
  visible,
  fullscreen,
  hideVideo,
  overlay,
  mirror,
  cameraPhase,
  showReachPrompt,
  showReachRetryPrompt = false,
  onReachRetry,
  auraResult,
  analysisFallback = false,
  bagImageRef,
}) {
  const showAnalysis = cameraPhase === "result";
  const showScanStatus = cameraPhase === "scanning" || cameraPhase === "complete";
  const showBagReveal = cameraPhase === "particles" || cameraPhase === "reach";

  return (
    <div
      className={`camera-panel ${visible ? "visible" : ""} ${fullscreen ? "fullscreen" : ""} ${overlay ? "overlay" : ""} ${mirror ? "mirrored" : ""}`}
    >
      <video
        ref={videoRef}
        className={`camera-layer${hideVideo ? " hidden" : ""}`}
        autoPlay
        playsInline
        muted
      />
      {showBagReveal && (
        <img
          src="/mcmbag2D.png"
          alt="MCM bag"
          className="camera-bag-reveal"
          ref={bagImageRef}
        />
      )}
      <canvas ref={canvasRef} className="tracking-canvas" />
      {cameraPhase && (
        <div className="camera-ui-overlay">
          <img
            src="/aura-corner-left.svg"
            alt=""
            className="camera-corner camera-corner-top-left"
          />
          <img
            src="/aura-corner-right.svg"
            alt=""
            className="camera-corner camera-corner-top-right"
          />
          <img
            src="/aura-corner-left.svg"
            alt=""
            className="camera-corner camera-corner-bottom-left"
          />
          <img
            src="/aura-corner-right.svg"
            alt=""
            className="camera-corner camera-corner-bottom-right"
          />

          <img src="/aura-logo.svg" alt="" className="camera-aura-logo" />

          {!showScanStatus && (
            <div className="camera-progress">
              <span className="camera-progress-step active">1</span>
              <img src="/aura-progress-gold.svg" alt="" />
              <span className="camera-progress-step">2</span>
              <img src="/aura-progress-white.svg" alt="" />
              <span className="camera-progress-step">3</span>
            </div>
          )}

          <img src="/mcm-logo.svg" alt="" className="camera-mcm-logo" />

          {showReachRetryPrompt && (
            <>
              <div className="camera-reach-retry-screen">
                <div className="camera-reach-focus">
                  <span className="camera-reach-focus-corner top-left" />
                  <span className="camera-reach-focus-corner top-right" />
                  <span className="camera-reach-focus-corner bottom-left" />
                  <span className="camera-reach-focus-corner bottom-right" />
                  <img src="/aura-hand-detect-failed.svg" alt="" />
                </div>
                <strong>손 인식을 실패했어요</strong>
                <small>손을 화면 중앙에 다시 맞춰주세요</small>
                <button type="button" onClick={onReachRetry}>
                  다시 시도하기
                </button>
              </div>
            </>
          )}

          {showAnalysis &&
            (analysisFallback ? (
              <div className="camera-fallback-screen">
                <span className="camera-fallback-clock">
                  <img src="/aura-delay-clock.svg" alt="" />
                  <img src="/aura-delay-clock-hand.svg" alt="" />
                </span>
                <strong>AI 분석이 지연되고 있어요</strong>
                <small>기본 무드로 진행 중입니다</small>
              </div>
            ) : (
              <>
              <div className="camera-style-card">
                <span>STYLE</span>
                <strong>{auraResult.style}</strong>
                <b>{auraResult.matchPercentage}%</b>
              </div>
              <div className="camera-color-card">
                <span className="camera-color-title">AURA color</span>
                <div className="camera-color-list">
                  {auraResult.palette.map((color) =>
                    color.imageSrc ? (
                      <img
                        key={color.id}
                        className="camera-color-item"
                        src={color.imageSrc}
                        alt={color.label}
                      />
                    ) : (
                      <i
                        key={color.id}
                        className="camera-color-item camera-color-swatch"
                        style={{ backgroundColor: color.color }}
                        title={color.label}
                      />
                    ),
                  )}
                </div>
              </div>
            </>
            ))}

          {showAnalysis && analysisFallback && (
            <div className="camera-fallback-wait">
              잠시만 기다려주세요
            </div>
          )}

          {showScanStatus && (
            <div className="camera-analysis-status">
              <p>
                {cameraPhase === "scanning"
                  ? "Analyzing Your Data..."
                  : "Analyzing Complete"}
              </p>
              {cameraPhase === "scanning" ? (
                <img
                  src="/aura-analysis-spinner.svg"
                  alt=""
                  className="camera-analysis-spinner"
                />
              ) : (
                <span className="camera-analysis-complete">
                  <img src="/aura-analysis-complete-ring.svg" alt="" />
                  <img src="/aura-analysis-check.svg" alt="" />
                </span>
              )}
              <div className="camera-facing-prompt">정면을 바라봐 주세요</div>
            </div>
          )}
        </div>
      )}
      {showReachPrompt && (
        <div className="camera-reach-prompt">
          <img src="/icons/extend-hand.svg" alt="" />
          <span>손을 뻗어 보세요</span>
          <small>Extend your hand</small>
        </div>
      )}
    </div>
  );
}
