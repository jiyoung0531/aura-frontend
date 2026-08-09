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

const createParticleField = (width, height, count = 270) => {
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.max(width, height) * 0.38;

  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + Math.random() * 0.8;
    const radius = maxRadius * (0.8 + Math.random() * 0.9);

    return {
      angle,
      radius,
      angularSpeed: 0.0022 + Math.random() * 0.0028,
      radiusDecay: 0.9978 - Math.random() * 0.00035,
      size: 1 + Math.random() * 2.2,
      alpha: 0.24 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
    };
  });
};

const drawParticleField = (context, width, height, particles, time) => {
  if (!particles?.length) return;

  const centerX = width * 0.25;
  const centerY = height / 2;
  const progress = Math.min(1, time / 12000);

  context.save();
  context.globalCompositeOperation = "screen";

  particles.forEach((particle, index) => {
    particle.angle += particle.angularSpeed;
    particle.radius *= particle.radiusDecay;

    const swirlRadius = particle.radius *
      (0.88 + 0.12 * Math.sin(time * 0.001 + particle.phase + index * 0.018));
    const spiralAngle = particle.angle + index * 0.03;

    const x = centerX + Math.cos(spiralAngle) * swirlRadius;
    const y = centerY + Math.sin(spiralAngle) * swirlRadius;

    const alpha = Math.max(0.14, particle.alpha * (0.65 + (1 - progress) * 0.35));
    const size = particle.size * (0.85 + 0.45 * Math.sin(time * 0.002 + particle.phase));

    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fillStyle = `rgba(255,255,255,${alpha})`;
    context.fill();
  });

  context.restore();
};

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wasFistRef = useRef(false);
  const [statusText, setStatusText] = useState("카메라 초기화 중...");
  const [isTracking, setIsTracking] = useState(false);
  const [isFistState, setIsFistState] = useState(false);
  const [handImagePos, setHandImagePos] = useState({
    x: 0,
    y: 0,
    visible: false,
    width: 170,
  });
  const fistPhotoSrc = "/rock2.png";
  const [route, setRoute] = useState(window.location.pathname || "/");
  const [permissionError, setPermissionError] = useState(false);
  const [errorDetails, setErrorDetails] = useState("");
  const initialBagYaw = Math.PI / 12;
  const initialBagPitch = 0;
  const [bagYaw, setBagYaw] = useState(initialBagYaw);
  const [bagPitch, setBagPitch] = useState(initialBagPitch);

  const handPosRef = useRef({ x: 0, y: 0 });
  const hoveredMaterialRef = useRef(null); // 가방에서 터치된 재질 이름
  const cursorRef = useRef({ x: null, y: null }); // 커서 속도 변조용
  const fistConfidenceRef = useRef(0);
  const particleStateRef = useRef(null);

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

      const nextWidth = width || window.innerWidth;
      const nextHeight = height || window.innerHeight;
      particleStateRef.current = {
        particles: createParticleField(nextWidth, nextHeight, 140),
      };
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

      if (!particleStateRef.current?.particles?.length) {
        particleStateRef.current = {
          particles: createParticleField(canvas.clientWidth, canvas.clientHeight, 140),
        };
      }

      if (showCameraPage) {
        drawParticleField(
          context,
          canvas.clientWidth,
          canvas.clientHeight,
          particleStateRef.current.particles,
          performance.now(),
        );
      }

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
          const rawZ =
            validPalmPoints.reduce((sum, point) => sum + (point.z || 0), 0) /
            validPalmPoints.length;

          const fingerTips = [
            landmarks[4],
            landmarks[8],
            landmarks[12],
            landmarks[16],
            landmarks[20],
          ].filter(Boolean);
          const palmWidth = landmarks[5] && landmarks[17]
            ? Math.hypot(landmarks[5].x - landmarks[17].x, landmarks[5].y - landmarks[17].y)
            : 0.18;
          const wristToMiddle = landmarks[0] && landmarks[9]
            ? Math.hypot(landmarks[0].x - landmarks[9].x, landmarks[0].y - landmarks[9].y)
            : 0.18;
          const handSize = Math.max(palmWidth, wristToMiddle, 0.08);
          const fistThreshold = Math.min(0.32, Math.max(0.16, handSize * 0.9));
          const rawFist =
            fingerTips.length === 5 &&
            fingerTips.every((point) => {
              const dx = point.x - rawX;
              const dy = point.y - rawY;
              return Math.hypot(dx, dy) < fistThreshold;
            });
          const fistDelta = rawFist ? 0.16 : -0.08;
          fistConfidenceRef.current = Math.min(1, Math.max(0, fistConfidenceRef.current + fistDelta));
          const isFist = fistConfidenceRef.current >= 0.5;
          // debug: log fist detection
          // eslint-disable-next-line no-console
          console.log(
            'App: rawFist=', rawFist,
            'isFist=', isFist,
            'confidence=', fistConfidenceRef.current.toFixed(2),
            'fingerTipsCount=', fingerTips.length,
            'threshold=', fistThreshold.toFixed(3),
          );

          const x = offsetX + (1 - rawX) * drawWidth;
          const y = offsetY + rawY * drawHeight;
          const z = rawZ;

          handPosRef.current = { x, y, z };

          let speed = 1.0;
          const currentMaterial = hoveredMaterialRef.current;

          // 재질에 따라 커서 속도 조정
          if (currentMaterial) {
            if (
              currentMaterial.includes("bag") ||
              currentMaterial.includes("panel")
            )
              speed = 0.38;
            else if (
              currentMaterial.includes("zip") ||
              currentMaterial.includes("buckle") ||
              currentMaterial.includes("logo") ||
              currentMaterial.includes("hardware")
            )
              speed = 1.2;
            else if (
              currentMaterial.includes("strap") ||
              currentMaterial.includes("handle") ||
              currentMaterial.includes("line")
            )
              speed = 0.2;
          }

          if (cursorRef.current.x === null) {
            cursorRef.current.x = x;
            cursorRef.current.y = y;
          }

          if (isFist) {
            cursorRef.current.x = x;
            cursorRef.current.y = y;
          } else {
            // 보간 적용
            cursorRef.current.x += (x - cursorRef.current.x) * (0.2 * speed);
            cursorRef.current.y += (y - cursorRef.current.y) * (0.2 * speed);
          }

          handPosRef.current = {
            x: cursorRef.current.x,
            y: cursorRef.current.y,
            z,
            targetX: x,
            targetY: y,
            isFist,
            handSize,
          };

          const dynamicWidth = Math.max(
            110,
            Math.min(230, 260 - handSize * 600),
          );

          setIsFistState(isFist);
          setHandImagePos({
            x: cursorRef.current.x,
            y: cursorRef.current.y,
            visible: true,
            width: isFist ? Math.max(100, dynamicWidth * 0.85) : dynamicWidth,
          });

          const rect = canvas.getBoundingClientRect();
          const clientX = rect.left + cursorRef.current.x;
          const clientY = rect.top + cursorRef.current.y;

          window.dispatchEvent(
            new MouseEvent("mousemove", {
              bubbles: true,
              clientX,
              clientY,
            }),
          );

          if (showBagOverlay) {
            if (isFist) {
              const yawFromX = ((0.5 - rawX) * Math.PI * 2.2) % (Math.PI * 2);
              const pitchFromY = ((rawY - 0.5) * Math.PI * 0.8) % (Math.PI * 2);
              setBagYaw(yawFromX);
              setBagPitch(pitchFromY);
            } else {
              setBagYaw((prev) => prev + (initialBagYaw - prev) * 0.12);
              setBagPitch((prev) => prev + (initialBagPitch - prev) * 0.12);
            }
          }

          if (!wasFistRef.current && isFist) {
            const target = document.elementFromPoint(clientX, clientY);
            target?.dispatchEvent(
              new MouseEvent("mousedown", {
                bubbles: true,
                button: 0,
                clientX,
                clientY,
              }),
            );
            target?.dispatchEvent(
              new MouseEvent("mouseup", {
                bubbles: true,
                button: 0,
                clientX,
                clientY,
              }),
            );
            target?.dispatchEvent(
              new MouseEvent("click", {
                bubbles: true,
                button: 0,
                clientX,
                clientY,
              }),
            );
          }

          wasFistRef.current = isFist;

          setIsTracking(true);
          return;
        }
      }

      setHandImagePos((prev) => ({ ...prev, visible: false }));
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
  }, [showCamera, showCameraPage]);

  return (
    <div className="app-shell">
      {showBagScene && (
        <div className="scene-layer">
          <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
            <ambientLight intensity={3.5} />
            <directionalLight position={[10, 10, 5]} intensity={3} />

            <McmBag
              currentMood="street"
              rotation={[bagPitch, bagYaw, 0]}
              handPosRef={handPosRef}
              setHoveredMaterial={(name) => {
                hoveredMaterialRef.current = name;
              }}
            />

            <OrbitControls />
          </Canvas>
          <img
            src={isFistState ? fistPhotoSrc : "/hand2.png"}
            alt="Hand overlay"
            className="hand-image-overlay"
            style={{
              left: `${handImagePos.x}px`,
              top: `${handImagePos.y}px`,
              opacity: handImagePos.visible ? 1 : 0,
              width: `${handImagePos.width}px`,
            }}
          />
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
