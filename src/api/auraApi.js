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
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      ...options.headers,
    },
  });
  
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  if (!response.ok || (body.success === false)) {
    throw new AuraApiError(
      body.error?.code || "INTERNAL_ERROR",
      body.error?.message || "API 요청에 실패했습니다.",
      response.status,
    );
  }

  return body.data !== undefined ? body.data : body;
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

export const finalizeAuraSession = (publicId, auraColors, accessoryId) =>
  request(`/sessions/${publicId}/outputs/finalize`, {
    method: "POST",
    body: JSON.stringify({
      aura_code: auraColors,
      attached_accessory_id: accessoryId ? Number(accessoryId) : null,
    }),
  });

export const getAuraOutputStatus = (publicId) =>
  request(`/sessions/${publicId}/outputs`, {
    method: "GET",
  });


    const result = await response.json();
    console.log("백엔드가 보낸 진짜 응답:", result);
    return result.data ? result.data : result;
  } catch (error) {
    console.error("QR 코드 생성 중 오류 발생:", error);
    throw error;
  }
};

export const getAuraOutputStatus = async (publicId) => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE}/sessions/${publicId}/outputs`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error("상태 조회에 실패했습니다.");
    }

    const result = await response.json();
    return result.data ? result.data : result;
  } catch (error) {
    console.error("상태 조회 중 오류 발생:", error);
    throw error;
  }
};

export const attachAccessory = (publicId, productId) =>
  request(`/sessions/${publicId}/accessories/${productId}/attach`, {
    method: "POST",
  });
