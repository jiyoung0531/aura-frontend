const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://aura-backend-877724382169.asia-northeast3.run.app/api";

class AuraApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = "AuraApiError";
    this.code = code;
    this.status = status;
  }
}

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const body = await response.json();

  if (!body.success) {
    throw new AuraApiError(
      body.error?.code || "INTERNAL_ERROR",
      body.error?.message || "API 요청에 실패했습니다.",
      response.status,
    );
  }

  return body.data;
};

export const createSession = () =>
  request("/sessions", {
    method: "POST",
    body: JSON.stringify({ store_id: 1, consent_agreed: true }),
  });

export const getAssetsManifest = () => request("/assets/manifest");

export const analyzeAura = (publicId, imageBase64) =>
  request(`/sessions/${publicId}/analysis`, {
    method: "POST",
    body: JSON.stringify({ image_base64: imageBase64 }),
  });

export const updateSessionStatus = (publicId, status) =>
  request(`/sessions/${publicId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

export const requestVideoUpload = (publicId, durationMs = 10000) =>
  request(`/sessions/${publicId}/outputs/video-url`, {
    method: "POST",
    body: JSON.stringify({
      content_type: "video/mp4",
      duration_ms: durationMs,
      include_thumbnail: true,
    }),
  });

export const completeVideoUpload = (publicId, payload) =>
  request(`/sessions/${publicId}/outputs/video-complete`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getLanding = (publicId) => request(`/landing/${publicId}`);
