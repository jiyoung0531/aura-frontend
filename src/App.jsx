import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { McmBag } from "./components/canvas/McmBag";
import CameraScreen from "./components/CameraScreen";
import ConsentScreen from "./components/ConsentScreen";
import AuraOrbOverlay from "./components/AuraOrbOverlay";
import "./App.css";
import PhaseOverlay from "./components/ui/PhaseOverlay";
import { analyzeAura, createSession, updateSessionStatus } from "./api/auraApi";

const INITIAL_BAG_YAW = Math.PI / 12;
const INITIAL_BAG_PITCH = 0;
const DEFAULT_AURA_RESULT = {
  style: "Street",
  matchPercentage: 94,
  palette: [
    { id: "street", imageSrc: "/aura-color-street.svg", color: "#8E5A3B", label: "Street brown" },
    { id: "gold", imageSrc: "/aura-color-gold.svg", color: "#B99556", label: "Aura gold" },
    { id: "white", imageSrc: "/aura-color-white.svg", color: "#F8F4EA", label: "Aura white" },
  ],
};

const captureVideoFrame = (video) => {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  const scale = 512 / Math.max(sourceWidth, sourceHeight);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sourceWidth * scale);
  canvas.height = Math.round(sourceHeight * scale);
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
};

const toAuraResult = (analysis) => ({
  style: analysis.style.charAt(0) + analysis.style.slice(1).toLowerCase(),
  matchPercentage: analysis.energy_level,
  mood: analysis.mood,
  patternUrl: analysis.pattern_url,
  palette: analysis.palette.map((color, index) => ({
    id: `${index}-${color}`,
    color,
    label: `Aura color ${index + 1}`,
  })),
});

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

const createParticleField = (
  width,
  height,
  count = 270,
  energyLevel = 50,
  palette = ["#FFFFFF"],
) => {
  const maxRadius = Math.max(width, height) * 0.38;
  const speedMultiplier = 0.75 + energyLevel / 200;

  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + Math.random() * 0.8;
    const radius = maxRadius * (0.8 + Math.random() * 0.9);

    return {
      angle,
      radius,
      angularSpeed: (0.0022 + Math.random() * 0.0028) * speedMultiplier,
      radiusDecay: 0.9978 - Math.random() * 0.00035,
      size: 1 + Math.random() * 2.2,
      alpha: 0.24 + Math.random() * 0.5,
      color: palette[index % palette.length] || "#FFFFFF",
      phase: Math.random() * Math.PI * 2,
    };
  });
};

const hexToRgba = (hex, alpha) => {
  const value = hex?.replace("#", "") || "FFFFFF";
  const normalized = value.length === 3
    ? value.split("").map((character) => character + character).join("")
    : value;
  const integer = Number.parseInt(normalized, 16);
  if (Number.isNaN(integer)) return `rgba(255,255,255,${alpha})`;
  return `rgba(${(integer >> 16) & 255},${(integer >> 8) & 255},${integer & 255},${alpha})`;
};

const drawParticleField = (context, width, height, particles, time) => {
  if (!particles?.length) return;

  const centerX = width * 0.25;
  const centerY = height / 2;
  const progress = Math.min(1, time / 12000);

  // 가방이 선명해진 뒤 0.5초만 파티클을 남긴다.
  if (time >= 4800) return;

  context.save();
  context.globalCompositeOperation = "screen";

  particles.forEach((particle, index) => {
    particle.angle += particle.angularSpeed;
    particle.radius *= Math.pow(particle.radiusDecay, 1.8);

    const swirlRadius =
      particle.radius *
      (0.88 + 0.12 * Math.sin(time * 0.001 + particle.phase + index * 0.018));
    const spiralAngle = particle.angle + index * 0.03;

    const x = centerX + Math.cos(spiralAngle) * swirlRadius;
    const y = centerY + Math.sin(spiralAngle) * swirlRadius;

    const alpha = Math.max(
      0.14,
      particle.alpha * (0.65 + (1 - progress) * 0.35),
    );
    const size =
      particle.size * (0.85 + 0.45 * Math.sin(time * 0.002 + particle.phase));

    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fillStyle = hexToRgba(particle.color, alpha);
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
  const [bagYaw, setBagYaw] = useState(INITIAL_BAG_YAW);
  const [bagPitch, setBagPitch] = useState(INITIAL_BAG_PITCH);
  const [phase, setPhase] = useState(2);
  const phaseRef = useRef(phase);
  const [orb, setOrb] = useState({
    visible: false,
    injecting: false,
    x: 0,
    y: 0,
  });
  const orbGatherStartedAtRef = useRef(null);
  const orbStartDepthRef = useRef(null);
  const orbStartHandSpanRef = useRef(null);
  const orbCreatedAtRef = useRef(null);
  const orbInjectionTriggeredRef = useRef(false);
  const orbRef = useRef(orb);

  useEffect(() => {
    if (route === "/bag" && phase === 2) {
      const timer = setTimeout(() => {
        setPhase("orb");
      }, 20000);

      return () => clearTimeout(timer);
    }
  }, [phase, route]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    orbRef.current = orb;
  }, [orb]);

  useEffect(() => {
    if (phase !== "orb") {
      orbGatherStartedAtRef.current = null;
      orbStartDepthRef.current = null;
      orbStartHandSpanRef.current = null;
      orbCreatedAtRef.current = null;
      orbInjectionTriggeredRef.current = false;
    }
  }, [phase]);

  const handPosRef = useRef({ x: 0, y: 0 });
  const hoveredMaterialRef = useRef(null); // 가방에서 터치된 재질 이름
  const cursorRef = useRef({ x: null, y: null }); // 커서 속도 변조용
  const fistConfidenceRef = useRef(0);
  const openHandStartedAtRef = useRef(null);
  const showReachPromptRef = useRef(false);
  const navigationTriggeredRef = useRef(false);
  const cameraPhaseRef = useRef("scanning");
  const particleStateRef = useRef(null);
  const [showReachPrompt, setShowReachPrompt] = useState(false);
  const [cameraPhase, setCameraPhase] = useState("scanning");
  const [auraResult, setAuraResult] = useState(DEFAULT_AURA_RESULT);
  const [analysisReady, setAnalysisReady] = useState(false);
  const [publicId, setPublicId] = useState(() =>
    window.sessionStorage.getItem("aura_public_id"),
  );
  const publicIdRef = useRef(publicId);
  const analysisStartedRef = useRef(false);

  const showConsentPage = route === "/" || route === "/consent";
  const showBagScene = route === "/bag";
  const showBagOverlay = route === "/bag";
  const showCameraPage = route === "/camera";
  const showCamera = showBagOverlay || showCameraPage;
  const mirrorCamera = showCameraPage;

  useEffect(() => {
    const handlePopState = () => setRoute(window.location.pathname || "/");
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleConsentStart = async () => {
    const session = await createSession();
    publicIdRef.current = session.public_id;
    setPublicId(session.public_id);
    window.sessionStorage.setItem("aura_public_id", session.public_id);
    analysisStartedRef.current = false;
    setAnalysisReady(false);
    setAuraResult(DEFAULT_AURA_RESULT);
    setCameraPhase("scanning");
    window.history.pushState({}, "", "/camera");
    setRoute("/camera");
  };

  useEffect(() => {
    cameraPhaseRef.current = cameraPhase;
  }, [cameraPhase]);

  useEffect(() => {
    showReachPromptRef.current = false;
    navigationTriggeredRef.current = false;
    openHandStartedAtRef.current = null;

    const resetTimer = window.setTimeout(() => {
      setShowReachPrompt(false);
      setCameraPhase("scanning");
    }, 0);

    if (!showCameraPage) {
      return () => window.clearTimeout(resetTimer);
    }

    return () => window.clearTimeout(resetTimer);
  }, [showCameraPage]);

  useEffect(() => {
    if (!showCameraPage || cameraPhase !== "complete") return undefined;

    const completeTimer = window.setTimeout(() => {
      setCameraPhase("result");
    }, 2000);

    return () => window.clearTimeout(completeTimer);
  }, [cameraPhase, showCameraPage]);

  useEffect(() => {
    if (!showCameraPage || cameraPhase !== "result" || !analysisReady) {
      return undefined;
    }

    const particleTimer = window.setTimeout(() => {
      const canvas = canvasRef.current;
      particleStateRef.current = {
        particles: createParticleField(
          canvas?.clientWidth || window.innerWidth,
          canvas?.clientHeight || window.innerHeight,
          160 + Math.round(auraResult.matchPercentage * 2.4),
          auraResult.matchPercentage,
          auraResult.palette.map((color) => color.color).filter(Boolean),
        ),
        startedAt: performance.now(),
      };
      setCameraPhase("particles");
    }, 10000);

    return () => window.clearTimeout(particleTimer);
  }, [analysisReady, auraResult, cameraPhase, showCameraPage]);

  useEffect(() => {
    if (!showCameraPage || cameraPhase !== "particles") return undefined;

    const revealTimer = window.setTimeout(() => {
      showReachPromptRef.current = true;
      setShowReachPrompt(true);
      setCameraPhase("reach");
    }, 6000);

    return () => window.clearTimeout(revealTimer);
  }, [cameraPhase, showCameraPage]);

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
        particles: createParticleField(nextWidth, nextHeight, 280),
        startedAt: performance.now(),
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

      const triggerOrbInjection = () => {
        if (orbInjectionTriggeredRef.current) return;
        orbInjectionTriggeredRef.current = true;
        setOrb((current) => ({
          ...current,
          injecting: true,
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        }));
        window.setTimeout(() => {
          setOrb({ visible: false, injecting: false, x: 0, y: 0 });
          setPhase(3);
        }, 1100);
      };

      if (!particleStateRef.current?.particles?.length) {
        particleStateRef.current = {
          particles: createParticleField(
            canvas.clientWidth,
            canvas.clientHeight,
            280,
          ),
          startedAt: performance.now(),
        };
      }

      if (showCameraPage && cameraPhaseRef.current === "particles") {
        drawParticleField(
          context,
          canvas.clientWidth,
          canvas.clientHeight,
          particleStateRef.current.particles,
          performance.now() - particleStateRef.current.startedAt,
        );
      }

      const hands = results.landmarks || [];
      if (phaseRef.current === "orb" && hands.length >= 2) {
        const getPalmCenter = (hand) => {
          const palmIndexes = [0, 5, 9, 13, 17];
          const points = palmIndexes.map((index) => hand[index]).filter(Boolean);
          return points.reduce(
            (center, point) => ({
              x: center.x + point.x / points.length,
              y: center.y + point.y / points.length,
              z: center.z + (point.z || 0) / points.length,
            }),
            { x: 0, y: 0, z: 0 },
          );
        };
        const firstPalm = getPalmCenter(hands[0]);
        const secondPalm = getPalmCenter(hands[1]);
        const palmDistance = Math.hypot(
          firstPalm.x - secondPalm.x,
          firstPalm.y - secondPalm.y,
        );
        const midpoint = {
          x: (firstPalm.x + secondPalm.x) / 2,
          y: (firstPalm.y + secondPalm.y) / 2,
          z: (firstPalm.z + secondPalm.z) / 2,
        };
        const orbX = offsetX + (1 - midpoint.x) * drawWidth;
        const orbY = offsetY + midpoint.y * drawHeight;

        if (!orbRef.current.visible && palmDistance < 0.22) {
          if (orbGatherStartedAtRef.current === null) {
            orbGatherStartedAtRef.current = performance.now();
          }
          if (performance.now() - orbGatherStartedAtRef.current >= 600) {
            const firstPalmSpan = Math.hypot(
              hands[0][5].x - hands[0][17].x,
              hands[0][5].y - hands[0][17].y,
            );
            orbStartDepthRef.current = hands[0][0].z || midpoint.z;
            orbStartHandSpanRef.current = firstPalmSpan;
            orbCreatedAtRef.current = performance.now();
            setOrb({ visible: true, injecting: false, x: orbX, y: orbY });
          }
        } else if (!orbRef.current.visible) {
          orbGatherStartedAtRef.current = null;
        }

      }

      if (
        phaseRef.current === "orb" &&
        orbRef.current.visible &&
        !orbInjectionTriggeredRef.current &&
        hands[0]?.[0] &&
        hands[0]?.[5] &&
        hands[0]?.[17] &&
        performance.now() - (orbCreatedAtRef.current || performance.now()) > 500
      ) {
        const currentSpan = Math.hypot(
          hands[0][5].x - hands[0][17].x,
          hands[0][5].y - hands[0][17].y,
        );
        const movedTowardCamera =
          hands[0][0].z < (orbStartDepthRef.current ?? 0) - 0.015 ||
          currentSpan > (orbStartHandSpanRef.current ?? currentSpan) * 1.1;

        if (movedTowardCamera) triggerOrbInjection();
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
          const palmWidth =
            landmarks[5] && landmarks[17]
              ? Math.hypot(
                  landmarks[5].x - landmarks[17].x,
                  landmarks[5].y - landmarks[17].y,
                )
              : 0.18;
          const wristToMiddle =
            landmarks[0] && landmarks[9]
              ? Math.hypot(
                  landmarks[0].x - landmarks[9].x,
                  landmarks[0].y - landmarks[9].y,
                )
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
          fistConfidenceRef.current = Math.min(
            1,
            Math.max(0, fistConfidenceRef.current + fistDelta),
          );
          const isFist = fistConfidenceRef.current >= 0.5;
          const extendedFingerCount = fingerTips.slice(1).filter((point) => {
            const dx = point.x - rawX;
            const dy = point.y - rawY;
            return Math.hypot(dx, dy) > handSize * 0.9;
          }).length;
          const openHand = fingerTips.length === 5 && extendedFingerCount >= 3;

          if (showReachPromptRef.current) {
            if (openHand && !isFist) {
              if (openHandStartedAtRef.current === null) {
                openHandStartedAtRef.current = performance.now();
              }
            } else {
              openHandStartedAtRef.current = null;
            }

            if (
              openHandStartedAtRef.current !== null &&
              performance.now() - openHandStartedAtRef.current >= 2000 &&
              !navigationTriggeredRef.current
            ) {
              navigationTriggeredRef.current = true;
              showReachPromptRef.current = false;
              setShowReachPrompt(false);
              if (publicIdRef.current) {
                void updateSessionStatus(
                  publicIdRef.current,
                  "SUMMONING",
                ).catch((error) =>
                  console.error("Session status update failed:", error),
                );
              }
              setPhase(2);
              setOrb({ visible: false, injecting: false, x: 0, y: 0 });
              window.history.pushState({}, "", "/bag");
              setRoute("/bag");
            }
          }
          // debug: log fist detection
          console.log(
            "App: rawFist=",
            rawFist,
            "isFist=",
            isFist,
            "confidence=",
            fistConfidenceRef.current.toFixed(2),
            "fingerTipsCount=",
            fingerTips.length,
            "threshold=",
            fistThreshold.toFixed(3),
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

          if (
            phaseRef.current === "orb" &&
            orbRef.current.visible &&
            !orbInjectionTriggeredRef.current
          ) {
            setOrb((current) => ({
              ...current,
              x: cursorRef.current.x,
              y: cursorRef.current.y,
            }));
          }

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

          if (showBagOverlay && phaseRef.current === 2) {
            if (isFist) {
              const yawFromX = ((0.5 - rawX) * Math.PI * 2.2) % (Math.PI * 2);
              const pitchFromY = ((rawY - 0.5) * Math.PI * 0.8) % (Math.PI * 2);
              setBagYaw(yawFromX);
              setBagPitch(pitchFromY);
            } else {
              setBagYaw((prev) => prev + (INITIAL_BAG_YAW - prev) * 0.12);
              setBagPitch((prev) => prev + (INITIAL_BAG_PITCH - prev) * 0.12);
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
      openHandStartedAtRef.current = null;
      setIsTracking(false);
    };

    const initializeHands = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        const message = "이 브라우저는 getUserMedia를 지원하지 않습니다.";
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
          numHands: 2,
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

        if (showCameraPage && !analysisStartedRef.current) {
          analysisStartedRef.current = true;
          void (async () => {
            try {
              const sessionPublicId = publicIdRef.current;
              if (!sessionPublicId) {
                throw new Error("분석 세션이 없습니다. 동의 화면부터 다시 시작해 주세요.");
              }
              const analysis = await analyzeAura(
                sessionPublicId,
                captureVideoFrame(video),
              );
              if (cancelled) return;
              setAuraResult(toAuraResult(analysis));
            } catch (error) {
              console.error("Aura analysis failed; using fallback:", error);
            } finally {
              if (!cancelled) setAnalysisReady(true);
              if (!cancelled) {
                cameraPhaseRef.current = "complete";
                setCameraPhase("complete");
              }
            }
          })();
        }

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
  }, [showBagOverlay, showCamera, showCameraPage]);

  return (
    <div className="app-shell">
      {showConsentPage && <ConsentScreen onStart={handleConsentStart} />}

      {showBagScene && (
        <div className="scene-layer">
          <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
            <ambientLight intensity={3.5} />
            <directionalLight position={[10, 10, 5]} intensity={3} />

            <McmBag
              currentMood="street"
              rotation={[bagPitch, bagYaw, 0]}
              phase={phase}
              handPosRef={handPosRef}
              sessionPublicId={publicId}
              setHoveredMaterial={(name) => {
                hoveredMaterialRef.current = name;
              }}
            />

            <OrbitControls />
          </Canvas>
          <PhaseOverlay phase={phase} orbCreated={orb.visible} />
          <AuraOrbOverlay orb={orb} />
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
        cameraPhase={showCameraPage ? cameraPhase : null}
        showReachPrompt={showCameraPage && showReachPrompt}
        auraResult={auraResult}
      />

      {showCamera && !showCameraPage && (
        <div className="status-pill">
          <span className={`status-dot ${isTracking ? "active" : ""}`} />
          <span>{isTracking ? "Aura Hand 추적 중" : statusText}</span>
        </div>
      )}
    </div>
  );
}
