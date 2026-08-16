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

  export const finalizeAuraSession = async (publicId, auraColors, accessoryId) => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE}/sessions/${publicId}/outputs/finalize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        aura_code: auraColors, 
        attached_accessory_id: accessoryId || null 
      }),
    });

    if (!response.ok) {
      throw new Error("QR 코드 생성 실패");
    }

    const result = await response.json();
    console.log("백엔드가 보낸 진짜 응답:", result);

    return result.data ? result.data : result;
  } catch (error) {
    console.error("QR 코드 생성 중 오류 발생:", error);
    throw error;
  }
};
