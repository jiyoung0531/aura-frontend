export default function CameraScreen({
  videoRef,
  canvasRef,
  visible,
  fullscreen,
  hideVideo,
  overlay,
  mirror,
}) {
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
      <canvas ref={canvasRef} className="tracking-canvas" />
    </div>
  );
}
