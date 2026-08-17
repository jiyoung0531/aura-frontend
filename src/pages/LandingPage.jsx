// src/pages/LandingPage.jsx
import { useEffect, useState } from "react";
import { getLanding } from "../api/auraApi";
import "./LandingPage.css";

const today = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
  .format(new Date())
  .replace(/\./g, ".")
  .slice(0, -1);

// 더미 데이터
const FALLBACK_DATA = {
  bagName: "MCM Stark Backpack",
  auraColors: ["#FFA1C5", "#707ABB", "#838383"],
  mood: "Street Energy",
  styling: "Silver Key Ring",
  forgedAt: "MCM Cheongdam House",
  date: today,
  videoUrl: "",
};

export default function LandingPage({ id, auraColors, mood }) {
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (auraColors && auraColors.length > 0) {
      console.log("카메라 색상 수신 완료:", auraColors);
      setUserData({
        ...FALLBACK_DATA,
        auraColors: auraColors,
        mood: mood,
      });
      setIsLoading(false);
      return;
    }

    let pollTimer;
    let attempts = 0;
    let cancelled = false;

    // QR코드나 링크로 접속해서 백엔드에서 데이터를 가져올 때
    const fetchUserData = async () => {
      try {
        const data = await getLanding(id);
        if (cancelled) return;
        setUserData(data);
        if (
          (data.video_status === "PENDING" || data.video_status === "UPLOADING") &&
          attempts++ < 30
        ) {
          pollTimer = window.setTimeout(fetchUserData, 2000);
        }
      } catch (error) {
        console.warn("랜딩 API 호출 실패, 임시 화면을 표시합니다.", error);
        if (!cancelled) setUserData(FALLBACK_DATA);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    // id가 있으면 무조건 백엔드를 찔러봄
    if (id) {
      fetchUserData();
    } else {
      // id도 없고 auraColors도 없는 비정상 접근 시 에러 방지
      setUserData(FALLBACK_DATA);
      setIsLoading(false);
    }
    return () => {
      cancelled = true;
      window.clearTimeout(pollTimer);
    };
  }, [auraColors, id, mood]);

  // 로딩 화면
  if (isLoading || !userData) {
    return <div className="loading-screen">데이터를 불러오는 중입니다...</div>;
  }

  const soulTag = userData.soul_tag || {};
  const products = userData.products || [];
  const bag = products.find((product) => product.product_type === "BAG") || {};
  const accessory =
    products.find((product) => product.product_type === "ACCESSORY") || {};
  const hasVideo = userData.video_status === "READY" && userData.video_url;
  const downloadVideo = () => {
    if (!userData.video_url) return;
    const link = document.createElement("a");
    link.href = userData.video_url;
    link.download = "aura-experience.mp4";
    link.click();
  };

  return (
    <div className="landing-container">
      {/* 1. 상단 로고 */}
      <header className="header-logo">
        <img
          src="/aura-logo.svg"
          alt="MCM AURA Logo"
          className="mcm-svg-logo"
        />
        <p>FORGED BY YOUR AURA</p>
      </header>

      {/* 2. 체험 영상 영역 */}
      <section className="video-section">
        {hasVideo ? (
          <video
            className="experience-video"
            src={userData.video_url}
            poster={userData.thumbnail_url || undefined}
            controls
            playsInline
          />
        ) : (
          <div className="video-placeholder">
            {userData.video_status === "FAILED"
              ? "체험 영상 제작에 실패했어요."
              : "체험 영상을 준비 중입니다..."}
          </div>
        )}
        <button
          className="primary-btn"
          disabled={!hasVideo}
          onClick={downloadVideo}
        >
          <img src="/download.svg" alt="download icon" className="btn-icon" />
          영상 저장
        </button>
      </section>

      {/* 3. AURA 카드 결과 영역 */}
      <section className="aura-card">

        <div className="info-grid">
          <span className="info-label">Bag</span>
          <span className="info-value">
            {soulTag.bag_name || bag.name || "-"}
          </span>

          <span className="info-label">Aura Code</span>
          <div className="aura-colors">
            {(soulTag.aura_code || []).map((color, index) => (
              <span key={index} className="color-item">
                <span
                  className="color-dot"
                  style={{ backgroundColor: color }}
                ></span>
                <span className="color-text">{color.toUpperCase()}</span>
              </span>
            ))}
          </div>

          <span className="info-label">Mood</span>
          <span className="info-value">{soulTag.mood || "-"}</span>

          <span className="info-label">Styling</span>
          <span className="info-value">
            {soulTag.styling || accessory.name || "-"}
          </span>

          <span className="info-label">Forged At</span>
          <span className="info-value">{soulTag.forged_at || "-"}</span>

          <span className="info-label">Date</span>
          <span className="info-value">{soulTag.date || "-"}</span>
        </div>

        <button className="secondary-btn">
          <img src="/download.svg" alt="download icon" className="btn-icon" />
          이미지로 저장
        </button>
      </section>

      <hr className="divider" />

      {/* 4. 제품 정보 영역 */}
      <section className="product-info-section">
        <div className="product-card">
          <div className="product-image-placeholder"></div>
          <div className="product-text">
            <h4>ABOUT BAG</h4>
            <p className="product-name">{bag.name || "-"}</p>
            <p className="product-desc">Aura의 추천 아이템 입니다.</p>
            <div className="button-group">
              <button className="outline-btn">제품 보기</button>
              <button className="solid-btn">
                <img src="/purchase.svg" alt="purchase" className="btn-icon" />
                구매하기
              </button>
            </div>
          </div>
        </div>
        <hr className="sub-divider" />

        <div className="product-card transparent-card">
          <h4 className="transparent-title">ABOUT STYLING ITEM</h4>
          <div className="transparent-content">
            <div className="product-image-placeholder circle"></div>
            <div className="product-text">
              <p className="product-name">MCM</p>
              <p className="product-desc">
                {accessory.name || soulTag.styling || "-"}
              </p>
              <div className="button-group">
                <button className="outline-btn">제품 보기</button>
                <button className="solid-btn">
                  <img
                    src="/purchase.svg"
                    alt="purchase"
                    className="btn-icon"
                  />
                  구매하기
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. 하단 배너 */}
      <footer className="footer-banner">
        <div className="banner-content">
          <p>
            MCM Official Store에서
            <br />더 많은 제품을 만나보세요.
          </p>
          <button
            className="store-btn"
            onClick={() =>
              window.open("https://kr.mcmworldwide.com/", "_blank")
            }
          >
            스토어 연결 ➔
          </button>
        </div>
        <div className="store-bg-image"></div>
      </footer>

      <div className="footer-logo-bar">
        <img src="/mcm-logo.svg" alt="MCM Logo" className="footer-logo" />
      </div>
    </div>
  );
}
