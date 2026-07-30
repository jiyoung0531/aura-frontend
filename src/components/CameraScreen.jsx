import React from "react";

export default function CameraScreen({ videoRef, canvasRef, visible, fullscreen }) {
  return (
    <div className={`camera-panel ${visible ? "visible" : ""} ${fullscreen ? "fullscreen" : ""}`}>
      <video
        ref={videoRef}
        className="camera-layer"
        autoPlay
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="tracking-canvas" />
    </div>
  );
}
