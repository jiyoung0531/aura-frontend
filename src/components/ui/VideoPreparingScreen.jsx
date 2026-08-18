export default function VideoPreparingScreen({ progress }) {
  return (
    <div className="video-preparing-screen" role="status" aria-live="polite">
      <img
        src="/aura-corner-left.svg"
        alt=""
        className="video-preparing-corner video-preparing-corner-top-left"
      />
      <img
        src="/aura-corner-right.svg"
        alt=""
        className="video-preparing-corner video-preparing-corner-top-right"
      />
      <img
        src="/aura-corner-left.svg"
        alt=""
        className="video-preparing-corner video-preparing-corner-bottom-left"
      />
      <img
        src="/aura-corner-right.svg"
        alt=""
        className="video-preparing-corner video-preparing-corner-bottom-right"
      />

      <img src="/aura-logo.svg" alt="AURA" className="video-preparing-logo" />

      <div className="video-preparing-spinner" aria-hidden="true" />
      <p className="video-preparing-title">영상 준비 중이에요</p>

      <div className="video-preparing-progress" aria-label={`${progress}%`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <p className="video-preparing-percent">{progress}%</p>

      <div className="video-preparing-wait">잠시만 기다려주세요</div>

      <img src="/mcm-logo.svg" alt="MCM" className="video-preparing-mcm" />
    </div>
  );
}
