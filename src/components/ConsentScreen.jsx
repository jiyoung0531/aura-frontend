import { useState } from "react";

export default function ConsentScreen({ onStart }) {
  const [cameraConsent, setCameraConsent] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const canStart = cameraConsent && privacyConsent && !isSubmitting;

  const handleStart = async () => {
    if (!canStart) return;
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await onStart();
    } catch (error) {
      setErrorMessage(
        error?.message || "세션을 시작하지 못했습니다. 다시 시도해 주세요.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <main className="consent-screen">
      <img
        src="/consent-mcm-logo.svg"
        alt="MCM"
        className="consent-mcm-logo"
      />

      <section className="consent-intro">
        <h1>Discover Your Aura</h1>
        <p>
          보이는 스타일 너머,
          <br />
          <strong>나만의 고유한 AURA</strong>를 만나보세요.
        </p>
        <img src="/consent-divider.svg" alt="" className="consent-divider" />
        <span className="consent-aura-mark">
          <img src="/consent-aura-glow.svg" alt="" />
          <img src="/consent-aura-logo.svg" alt="AURA" />
        </span>
      </section>

      <section className="consent-actions">
        <label className="consent-check-row">
          <input
            type="checkbox"
            checked={cameraConsent}
            onChange={(event) => setCameraConsent(event.target.checked)}
          />
          <span className="consent-checkbox" aria-hidden="true">
            {cameraConsent && <img src="/consent-check.svg" alt="" />}
          </span>
          <span>영상 촬영 및 AI 분석에 동의합니다.</span>
        </label>

        <label className="consent-check-row secondary">
          <input
            type="checkbox"
            checked={privacyConsent}
            onChange={(event) => setPrivacyConsent(event.target.checked)}
          />
          <span className="consent-checkbox" aria-hidden="true">
            {privacyConsent && <img src="/consent-check.svg" alt="" />}
          </span>
          <span>개인정보 처리방침에 동의합니다.</span>
        </label>

        {errorMessage && <p className="consent-error">{errorMessage}</p>}

        <button type="button" disabled={!canStart} onClick={handleStart}>
          {isSubmitting ? "시작하는 중..." : "START 시작하기"}
        </button>
      </section>
    </main>
  );
}
