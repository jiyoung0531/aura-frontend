import { useCallback, useEffect, useRef, useState } from "react";
import { completeVideoUpload, requestVideoUpload } from "../api/auraApi";

const RECORDING_DURATION_MS = 15000;
const VIDEO_MIME_TYPE = "video/mp4";
const BAG_REVEAL_DELAY_MS = 4000;
// A wider recorded framing: the scene occupies 1 / 1.5 of the output while
// the hand cursor is composited at its original size afterwards.
const RECORDING_ZOOM = 1 / 1.5;
const handImages = {
  open: Object.assign(new Image(), { src: "/hand2.png" }),
  fist: Object.assign(new Image(), { src: "/rock2.png" }),
};

const toBlob = (canvas, type, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality));

const getCoverFrame = (source, width, height) => {
  const sourceWidth = source?.videoWidth || source?.naturalWidth || source?.width;
  const sourceHeight = source?.videoHeight || source?.naturalHeight || source?.height;
  if (!sourceWidth || !sourceHeight) return null;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  return { drawWidth, drawHeight, x: (width - drawWidth) / 2, y: (height - drawHeight) / 2 };
};

const drawCover = (context, source, width, height, mirror = false) => {
  const frame = getCoverFrame(source, width, height);
  if (!frame) return;
  const { x, y, drawWidth, drawHeight } = frame;

  context.save();
  if (mirror) {
    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(source, x, y, drawWidth, drawHeight);
  } else {
    context.drawImage(source, x, y, drawWidth, drawHeight);
  }
  context.restore();
};

const drawAuraOrb = (context, orb, width, height) => {
  if (!orb?.visible) return;
  const x = ((orb.x || window.innerWidth / 2) / window.innerWidth) * width;
  const y = ((orb.y || window.innerHeight / 2) / window.innerHeight) * height;
  const radius = Math.min(width, height) * (orb.injecting ? 0.12 : 0.09);
  const glow = context.createRadialGradient(x, y, 0, x, y, radius * 1.5);
  glow.addColorStop(0, "rgba(255,255,255,0.95)");
  glow.addColorStop(0.22, "rgba(116,232,255,0.82)");
  glow.addColorStop(0.56, "rgba(0,168,220,0.34)");
  glow.addColorStop(1, "rgba(0,154,220,0)");

  context.save();
  context.globalCompositeOperation = "screen";
  context.fillStyle = glow;
  context.beginPath();
  context.arc(x, y, radius * 1.5, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(137,239,255,0.72)";
  context.lineWidth = Math.max(2, radius * 0.06);
  for (let index = 0; index < 4; index += 1) {
    context.save();
    context.translate(x, y);
    context.rotate((performance.now() * 0.001 * (index % 2 ? -1 : 1)) + index * 0.7);
    context.beginPath();
    context.ellipse(0, 0, radius * (1.05 + index * 0.06), radius * (0.55 + index * 0.04), 0, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }
  context.restore();
};

const drawAuraHand = (context, hand, width, height) => {
  if (!hand?.visible) return;
  const image = hand.isFist ? handImages.fist : handImages.open;
  if (!image.complete || !image.naturalWidth) return;
  const handWidth = (hand.width / window.innerWidth) * width;
  const handHeight = handWidth * (image.naturalHeight / image.naturalWidth);
  const x = (hand.x / window.innerWidth) * width - handWidth / 2;
  const y = (hand.y / window.innerHeight) * height - handHeight / 2;
  context.save();
  context.globalAlpha = 0.98;
  context.drawImage(image, x, y, handWidth, handHeight);
  context.restore();
};

/**
 * The app is rendered with separate video, 2D and WebGL layers. This hook
 * composites them into one canvas so MediaRecorder captures the experience,
 * rather than only the WebGL bag canvas.
 */
export function useExperienceRecorder({ videoRef, trackingCanvasRef, webglCanvasRef, bagImageRef, orbRef, handImageRef, phaseRef }) {
  const recorderRef = useRef(null);
  const compositeCanvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const drawFrameRef = useRef(null);
  const segmentTimerRef = useRef(null);
  const thumbnailBlobRef = useRef(null);
  const introStartedAtRef = useRef(null);
  const [status, setStatus] = useState("idle");

  const drawFrame = useCallback(() => {
    const canvas = compositeCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const width = canvas.width;
    const height = canvas.height;
    const background = context.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, "#714c38");
    background.addColorStop(1, "#4f3b30");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    const webglCanvas = webglCanvasRef.current;
    if (webglCanvas?.width && webglCanvas?.height) {
      // The bag renderer has an alpha canvas, letting the brown app background
      // remain visible in the exported video. Only this virtual scene uses the
      // wider recording framing; the webcam keeps its original framing.
      const sceneZoom = phaseRef?.current === 3 ? 1 : RECORDING_ZOOM;
      context.save();
      context.translate(width / 2, height / 2);
      context.scale(sceneZoom, sceneZoom);
      context.translate(-width / 2, -height / 2);
      drawCover(context, webglCanvas, width, height);
      drawAuraOrb(context, orbRef?.current, width, height);
      context.restore();
    } else {
      // The webcam and particle canvas are present during the summon sequence.
      const video = videoRef.current;
      if (video?.readyState >= 2) drawCover(context, video, width, height, true);
      const trackingCanvas = trackingCanvasRef.current;
      if (trackingCanvas) drawCover(context, trackingCanvas, width, height, true);

      // The summoned 2D bag is a DOM image, so it needs to be explicitly drawn
      // into the recording canvas as well.
      const bagImage = bagImageRef?.current;
      const bagRevealElapsed = performance.now() - (introStartedAtRef.current || performance.now());
      if (bagImage?.complete && bagRevealElapsed >= BAG_REVEAL_DELAY_MS) {
        // Particle positions are converted from the landscape tracking canvas
        // with `cover` and then mirrored. Use that same conversion for the bag.
        const frame = getCoverFrame(trackingCanvas, width, height);
        const bagCenterX = frame
          ? width - (frame.x + frame.drawWidth * 0.25)
          : width * 0.75;
        const bagCenterY = frame
          ? frame.y + frame.drawHeight * 0.47
          : height * 0.47;
        const bagWidth = width * 0.27;
        const ratio = bagImage.naturalHeight / bagImage.naturalWidth || 1;
        const bagHeight = bagWidth * ratio;
        context.save();
        context.globalAlpha = Math.min(1, (bagRevealElapsed - BAG_REVEAL_DELAY_MS) / 300);
        context.drawImage(
          bagImage,
          bagCenterX - bagWidth / 2,
          bagCenterY - bagHeight / 2,
          bagWidth,
          bagHeight,
        );
        context.restore();
      }
    }

    // Keep the hand cursor at its original visual size.
    drawAuraHand(context, handImageRef?.current, width, height);

    animationFrameRef.current = window.requestAnimationFrame(() => {
      drawFrameRef.current?.();
    });
  }, [bagImageRef, handImageRef, orbRef, phaseRef, trackingCanvasRef, videoRef, webglCanvasRef]);

  useEffect(() => {
    drawFrameRef.current = drawFrame;
  }, [drawFrame]);

  const upload = useCallback(async (publicId, videoBlob, thumbnailBlob) => {
    if (!publicId) throw new Error("영상 업로드를 위한 세션 ID가 없습니다.");
    const uploadData = await requestVideoUpload(publicId, RECORDING_DURATION_MS);

    const videoResponse = await fetch(uploadData.upload_url, {
      method: "PUT",
      headers: { "Content-Type": VIDEO_MIME_TYPE },
      body: videoBlob,
    });
    if (!videoResponse.ok) throw new Error(`영상 업로드 실패 (${videoResponse.status})`);

    let thumbnailObjectPath;
    if (thumbnailBlob && uploadData.thumbnail_upload_url) {
      const thumbnailResponse = await fetch(uploadData.thumbnail_upload_url, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: thumbnailBlob,
      });
      if (thumbnailResponse.ok) thumbnailObjectPath = uploadData.thumbnail_object_path;
      else console.warn("Thumbnail upload failed; continuing with video.");
    }

    await completeVideoUpload(publicId, {
      object_path: uploadData.object_path,
      ...(thumbnailObjectPath ? { thumbnail_object_path: thumbnailObjectPath } : {}),
      duration_ms: RECORDING_DURATION_MS,
    });
  }, []);

  const begin = useCallback((publicId) => {
    if (recorderRef.current || !publicId) return;
    if (!window.MediaRecorder?.isTypeSupported?.(VIDEO_MIME_TYPE)) {
      console.warn("This browser cannot create the required video/mp4 recording.");
      setStatus("unsupported");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 1280;
    compositeCanvasRef.current = canvas;
    thumbnailBlobRef.current = null;
    introStartedAtRef.current = performance.now();
    drawFrameRef.current?.();

    const chunks = [];
    const recorder = new MediaRecorder(canvas.captureStream(30), {
      mimeType: VIDEO_MIME_TYPE,
      videoBitsPerSecond: 8_000_000,
    });
    recorderRef.current = recorder;
    setStatus("recording");

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = async () => {
      recorderRef.current = null;
      window.clearTimeout(segmentTimerRef.current);
      window.cancelAnimationFrame(animationFrameRef.current);
      const videoBlob = new Blob(chunks, { type: VIDEO_MIME_TYPE });
      try {
        setStatus("uploading");
        await upload(publicId, videoBlob, thumbnailBlobRef.current);
        setStatus("complete");
      } catch (error) {
        console.error("Experience video upload failed:", error);
        setStatus("failed");
      }
    };

    recorder.start(250);
  }, [upload]);

  // MediaRecorder excludes paused time from the output. Each real interaction
  // can therefore be captured as a fixed-length clip and joined as one 10s MP4.
  const captureSegment = useCallback((durationMs, { thumbnail = false, finish = false, onComplete } = {}) => {
    const recorder = recorderRef.current;
    const canvas = compositeCanvasRef.current;
    if (!recorder || !canvas || recorder.state === "inactive") return;

    window.clearTimeout(segmentTimerRef.current);
    if (recorder.state === "paused") recorder.resume();
    setStatus("recording");

    segmentTimerRef.current = window.setTimeout(async () => {
      if (thumbnail) thumbnailBlobRef.current = await toBlob(canvas, "image/jpeg", 0.8);
      if (finish) {
        if (recorder.state !== "inactive") recorder.stop();
      } else if (recorder.state === "recording") {
        recorder.pause();
      }
      onComplete?.();
    }, durationMs);
  }, []);

  useEffect(() => () => {
    window.cancelAnimationFrame(animationFrameRef.current);
    window.clearTimeout(segmentTimerRef.current);
    const activeRecorder = recorderRef.current;
    if (activeRecorder && activeRecorder.state !== "inactive") activeRecorder.stop();
  }, []);

  return { begin, captureSegment, status, durationMs: RECORDING_DURATION_MS };
}
