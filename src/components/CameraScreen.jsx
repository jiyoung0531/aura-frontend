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
  auraResult,
}) {
  const showAnalysis = cameraPhase === "analysis";
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
        />
      )}
      <canvas ref={canvasRef} className="tracking-canvas" />
      {cameraPhase && (
        <div className="camera-ui-overlay" aria-hidden="true">
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

          <div className="camera-progress">
            <span className="camera-progress-step active">1</span>
            <img src="/aura-progress-gold.svg" alt="" />
            <span className="camera-progress-step">2</span>
            <img src="/aura-progress-white.svg" alt="" />
            <span className="camera-progress-step">3</span>
          </div>

          <img src="/mcm-logo.svg" alt="" className="camera-mcm-logo" />

          {showAnalysis && (
            <>
              <div className="camera-style-card">
                <span>STYLE</span>
                <strong>{auraResult.style}</strong>
                <b>{auraResult.matchPercentage}%</b>
              </div>
              <div className="camera-color-card">
                <span>AURA color</span>
                {auraResult.palette.map((color) =>
                  color.imageSrc ? (
                    <img
                      key={color.id}
                      src={color.imageSrc}
                      alt={color.label}
                    />
                  ) : (
                    <i
                      key={color.id}
                      className="camera-color-swatch"
                      style={{ backgroundColor: color.color }}
                      title={color.label}
                    />
                  ),
                )}
              </div>
            </>
          )}
        </div>
      )}
      {showReachPrompt && (
        <div className="camera-reach-prompt">손을 뻗어 보세요</div>
      )}
    </div>
  );
}
