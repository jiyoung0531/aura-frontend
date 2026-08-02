import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { McmBag } from "./components/canvas/McmBag";
import CameraScreen from "./components/CameraScreen";
import "./App.css";

const getDisplayMetrics = (videoElement, canvasElement) => {
  const displayWidth = canvasElement.clientWidth || window.innerWidth;
  const displayHeight = canvasElement.clientHeight || window.innerHeight;
  const videoWidth = videoElement.videoWidth || 1280;
  const videoHeight = videoElement.videoHeight || 720;
  const scale = Math.max(
    displayWidth / videoWidth,
    displayHeight / videoHeight,
  );
  const drawWidth = videoWidth * scale;
  const drawHeight = videoHeight * scale;
  const offsetX = (displayWidth - drawWidth) / 2;
  const offsetY = (displayHeight - drawHeight) / 2;

  return {
    displayWidth,
    displayHeight,
    drawWidth,
    drawHeight,
    offsetX,
    offsetY,
  };
};

const drawAuraCursor = (context, x, y) => {
  const glow = context.createRadialGradient(x, y, 2, x, y, 64);
  glow.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  glow.addColorStop(0.45, "rgba(255, 255, 255, 0.12)");
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");

  context.save();
  context.globalCompositeOperation = "screen";
  context.beginPath();
  context.arc(x, y, 64, 0, Math.PI * 2);
  context.fillStyle = glow;
  context.fill();
  context.restore();
};

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [statusText, setStatusText] = useState("카메라 초기화 중...");
  const [isTracking, setIsTracking] = useState(false);
  const [route, setRoute] = useState(window.location.pathname || "/");
  const [permissionError, setPermissionError] = useState(false);
  const [errorDetails, setErrorDetails] = useState("");

  const showBagScene = route === "/" || route === "/bag";
  const showBagOverlay = route === "/bag";
  const showCameraPage = route === "/camera";
  const showCamera = showBagOverlay || showCameraPage;
  const showGlowOverlay = showBagOverlay;
  const mirrorCamera = showCameraPage;

  useEffect(() => {
    const handlePopState = () => setRoute(window.location.pathname || "/");
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!showCamera) {
      return undefined;
    }

    let cancelled = false;
    let cleanupStream = null;
    let handLandmarker = null;
    let animationFrameId = null;

    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;

      const context = canvas.getContext("2d");
      if (context) {
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    const handleResults = (results) => {
      if (cancelled) return;

      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas?.getContext("2d");
      if (!context || !video) return;

      const { drawWidth, drawHeight, offsetX, offsetY } = getDisplayMetrics(
        video,
        canvas,
      );
      context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      const landmarks = results.landmarks?.[0];
      if (landmarks?.length) {
        const palmPoints = [
          landmarks[0],
          landmarks[5],
          landmarks[9],
          landmarks[13],
          landmarks[17],
        ];
        const validPalmPoints = palmPoints.filter(Boolean);

        if (validPalmPoints.length >= 3) {
          const rawX =
            validPalmPoints.reduce((sum, point) => sum + point.x, 0) /
            validPalmPoints.length;
          const rawY =
            validPalmPoints.reduce((sum, point) => sum + point.y, 0) /
            validPalmPoints.length;
          const x = offsetX + (1 - rawX) * drawWidth;
          const y = offsetY + rawY * drawHeight;

          if (showGlowOverlay) {
            drawAuraCursor(context, x, y);
          }

          setIsTracking(true);
          return;
        }
      }

      setIsTracking(false);
    };

    const initializeHands = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        const message = "이 브라우저는 getUserMedia를 지원하지 않습니다.";
        setPermissionError(true);
        setErrorDetails(message);
        setStatusText(message);
        return;
      }

      try {
        const { FilesetResolver, HandLandmarker } =
          await import("@mediapipe/tasks-vision");

        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        resizeCanvas();

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.0/wasm",
        );

        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        cleanupStream = () => {
          stream.getTracks().forEach((track) => track.stop());
        };

        video.srcObject = stream;
        await video.play();
        setStatusText("손을 화면에 보여주세요");

        const detectFrame = async () => {
          if (cancelled || !video || !handLandmarker) return;

          if (video.readyState >= 2) {
            const result = await handLandmarker.detectForVideo(
              video,
              performance.now(),
            );
            handleResults(result);
          }

          animationFrameId = window.requestAnimationFrame(detectFrame);
        };

        detectFrame();
      } catch (error) {
        const name = error?.name || "UnknownError";
        const message = error?.message || "알 수 없는 카메라 오류";
        console.error("Camera error:", { name, message });
        setPermissionError(true);
        setErrorDetails(`${name}: ${message}`);
        setStatusText(
          "카메라 권한이 차단됐어요. 브라우저 주소창의 카메라 권한을 허용한 뒤 새로고침해 주세요.",
        );
      }
    };

    resizeCanvas();
    initializeHands();
    window.addEventListener("resize", resizeCanvas);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", resizeCanvas);
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
      if (cleanupStream) {
        cleanupStream();
      }
      if (handLandmarker) {
        handLandmarker.close();
      }
    };
  }, [showCamera]);

  return (
    <div className="app-shell">
      {showBagScene && (
        <div className="scene-layer">
          <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
            <ambientLight intensity={1.5} />
            <directionalLight position={[10, 10, 5]} intensity={2} />
            <McmBag currentMood="street" />
            <OrbitControls />
          </Canvas>
        </div>
      )}

      <CameraScreen
        videoRef={videoRef}
        canvasRef={canvasRef}
        visible={showCamera}
        fullscreen={showCameraPage}
        hideVideo={showBagOverlay}
        overlay={showBagOverlay}
        mirror={mirrorCamera}
      />

      {showCamera && (
        <div className="status-pill">
          <span className={`status-dot ${isTracking ? "active" : ""}`} />
          <span>{isTracking ? "Aura Hand 추적 중" : statusText}</span>
        </div>
      )}
    </div>
  );
}
