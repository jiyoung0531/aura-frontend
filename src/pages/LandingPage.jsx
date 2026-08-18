// src/pages/LandingPage.jsx

import { useEffect, useState, useRef } from "react";
import html2canvas from "html2canvas";
import { getLanding } from "../api/auraApi";
import "./LandingPage.css";

const API_BASE = import.meta.env.VITE_API_BASE;

const BAG_IMG_URL =
  "https://storage.googleapis.com/aura-assets-2026/products/bag_01.png";

const ACC_NORMAL_URL =
  "https://storage.googleapis.com/aura-assets-2026/products/acc_01.png";

const ACC_BEAR_URL =
  "https://storage.googleapis.com/aura-assets-2026/products/acc_02.png";

// 실제 백엔드 product_id
const NORMAL_ACCESSORY_ID = 2;
const BEAR_ACCESSORY_ID = 3;

const NORMAL_ACCESSORY_NAME = "Visetos Original Keyring";
const BEAR_ACCESSORY_NAME = "MCM Visetos Park Bear Charm";

const today = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
  .format(new Date())
  .replace(/\./g, ".")
  .slice(0, -1);

const FALLBACK_DATA = {
  bagName: "Stark Side Stud Visetos Backpack",
  auraColors: ["#FFA1C5", "#707ABB", "#838383"],
  mood: "Street Energy",
  styling: NORMAL_ACCESSORY_NAME,
  forgedAt: "MCM Cheongdam House",
  date: today,
  videoUrl: "",
};

export default function LandingPage({
  id,
  auraColors,
  mood,
  styling,
  activeAccessoryId,
}) {
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);

  const cardRef = useRef(null);

  const sendEventLog = async (eventType, productId = null) => {
    if (!id) return;

    try {
      const bodyData = {
        event_type: eventType,
      };

      if (productId) {
        bodyData.product_id = productId;
      }

      await fetch(`${API_BASE}/landing/${id}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyData),
      });
    } catch (error) {
      console.error("이벤트 로그 전송 실패:", error);
    }
  };

  useEffect(() => {
    let pollTimer;
    let attempts = 0;
    let cancelled = false;

    const fetchUserData = async () => {
      try {
        const data = await getLanding(id);

        if (cancelled) return;

        const actualData = data?.data || data;

        if (
          actualData &&
          actualData.products &&
          actualData.products.length > 0
        ) {
          setUserData(actualData);
          setIsLoading(false);

          sendEventLog("PAGE_VIEW");
          return;
        }

        if (attempts++ < 30) {
          pollTimer = window.setTimeout(fetchUserData, 2000);
          return;
        }

        setUserData(FALLBACK_DATA);
        setIsLoading(false);
      } catch (error) {
        console.warn("랜딩 데이터 로딩 실패:", error);

        if (!cancelled) {
          setUserData(FALLBACK_DATA);
          setIsLoading(false);
        }
      }
    };

    // QR / landing URL로 들어온 경우
    if (id) {
      fetchUserData();
    }

    // 현재 앱 내부에서 바로 LandingPage를 띄우는 경우
    else if (auraColors && auraColors.length > 0) {
      setUserData({
        ...FALLBACK_DATA,
        auraColors,
        mood: mood || FALLBACK_DATA.mood,
        styling: styling || FALLBACK_DATA.styling,
      });

      setIsLoading(false);
    }

    // 아무 데이터도 없을 경우
    else {
      setUserData(FALLBACK_DATA);
      setIsLoading(false);
    }

    return () => {
      cancelled = true;
      window.clearTimeout(pollTimer);
    };
  }, [id, auraColors, mood, styling]);

  if (isLoading || !userData) {
    return <div className="loading-screen">데이터를 불러오는 중입니다...</div>;
  }

  const soulTag = userData.soul_tag || {};
  const products = userData.products || [];

  // 가방
  const bag = products.find((product) => product.product_type === "BAG") || {};

  // 액세서리들
  const accessories = products.filter(
    (product) => product.product_type === "ACCESSORY",
  );

  const hasVideo =
    userData.video_status === "READY" && Boolean(userData.video_url);
  const isVideoFailed = ["FAILED", "FAIL", "ERROR"].includes(
    String(userData.video_status || "").toUpperCase(),
  );

  /*
   * =========================================================
   * 액세서리 결정
   * =========================================================
   *
   * QR/백엔드 결과가 존재하면:
   *   soul_tag.styling이 최종 결과이므로 이것만 믿음
   *
   * 백엔드 결과가 없는 로컬 화면이면:
   *   activeAccessoryId → sessionStorage 순서로 사용
   */

  let finalAccessoryId = NORMAL_ACCESSORY_ID;

  const backendStyling = soulTag.styling?.trim();

  if (backendStyling) {
    // 백엔드 최종 결과가 있는 경우
    const backendAccessory = accessories.find(
      (product) => product.name?.trim() === backendStyling,
    );

    if (backendAccessory) {
      finalAccessoryId = Number(backendAccessory.product_id);
    } else if (backendStyling === BEAR_ACCESSORY_NAME) {
      finalAccessoryId = BEAR_ACCESSORY_ID;
    } else {
      finalAccessoryId = NORMAL_ACCESSORY_ID;
    }
  } else {
    // 로컬에서 바로 결과 화면으로 넘어온 경우에만 사용
    const activeId = Number(activeAccessoryId);

    const storedId = Number(
      window.sessionStorage.getItem("aura_active_accessory_id"),
    );

    if (activeId === NORMAL_ACCESSORY_ID || activeId === BEAR_ACCESSORY_ID) {
      finalAccessoryId = activeId;
    } else if (
      storedId === NORMAL_ACCESSORY_ID ||
      storedId === BEAR_ACCESSORY_ID
    ) {
      finalAccessoryId = storedId;
    }
  }

  const selectedAccessory =
    accessories.find(
      (product) => Number(product.product_id) === finalAccessoryId,
    ) || {};

  const isBearKeyring = finalAccessoryId === BEAR_ACCESSORY_ID;

  const displayAccName =
    selectedAccessory.name ||
    (isBearKeyring ? BEAR_ACCESSORY_NAME : NORMAL_ACCESSORY_NAME);

  const displayAccImage =
    selectedAccessory.image_url ||
    (isBearKeyring ? ACC_BEAR_URL : ACC_NORMAL_URL);

  const displayBagImage = bag.image_url || BAG_IMG_URL;

  const finalProductId = selectedAccessory.product_id || finalAccessoryId;

  const finalPurchaseUrl =
    selectedAccessory.purchase_url || "https://kr.mcmworldwide.com/";

  /*
   * =========================================================
   * 카드 표시 데이터
   * =========================================================
   */

  const displayAuraColors =
    soulTag.aura_code || userData.auraColors || FALLBACK_DATA.auraColors;

  const displayMood =
    soulTag.mood || userData.mood || mood || FALLBACK_DATA.mood;

  const displayDate = soulTag.date || userData.date || FALLBACK_DATA.date;

  /*
   * =========================================================
   * 영상 다운로드
   * =========================================================
   */

  const downloadVideo = async () => {
    if (!userData.video_url) return;

    sendEventLog("VIDEO_DOWNLOAD");

    try {
      const response = await fetch(userData.video_url);
      const blob = await response.blob();

      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = blobUrl;
      link.download = "My_Aura_Experience.mp4";

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);

      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("영상 다운로드 실패:", error);

      window.open(userData.video_url, "_blank");
    }
  };

  /*
   * =========================================================
   * 카드 이미지 다운로드
   * =========================================================
   */

  const downloadImage = async () => {
    if (!cardRef.current) return;

    sendEventLog("SOUL_TAG_DOWNLOAD");

    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
      });

      const image = canvas.toDataURL("image/png");

      const link = document.createElement("a");

      link.href = image;
      link.download = "My_Aura_Card.png";

      link.click();
    } catch (error) {
      console.error("이미지 저장 실패:", error);

      alert("이미지를 저장하는 데 실패했습니다.");
    }
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

      {/* 2. 영상 */}
      <section className="video-section">
        {hasVideo ? (
          <video
            className="experience-video"
            src={userData.video_url}
            poster={userData.thumbnail_url || undefined}
            controls
            playsInline
            onPlay={() => sendEventLog("VIDEO_PLAY")}
          />
        ) : isVideoFailed ? (
          <img
            className="video-failure-image"
            src="/failpage.png"
            alt="Video generation failed"
          />
        ) : (
          <div className="video-placeholder">
            체험 영상을 준비 중입니다...
          </div>
        )}

        {hasVideo && (
          <button className="primary-btn" onClick={downloadVideo}>
            <img src="/download.svg" alt="download icon" className="btn-icon" />
            영상 저장
          </button>
        )}
      </section>

      {/* 3. AURA 카드 */}
      <section className="aura-card" ref={cardRef}>
        <div className="info-grid">
          <span className="info-label">Bag</span>

          <span className="info-value">
            {soulTag.bag_name || bag.name || "Stark Side Stud Visetos Backpack"}
          </span>

          <span className="info-label">Aura Code</span>

          <div className="aura-colors">
            {displayAuraColors.map((color, index) => (
              <span key={index} className="color-item">
                <span
                  className="color-dot"
                  style={{
                    backgroundColor: color,
                  }}
                />

                <span className="color-text">{color.toUpperCase()}</span>
              </span>
            ))}
          </div>

          <span className="info-label">Mood</span>

          <span className="info-value">{displayMood}</span>

          <span className="info-label">Styling</span>

          <span className="info-value">{displayAccName}</span>

          <span className="info-label">Forged At</span>

          <span className="info-value">
            {soulTag.forged_at || "MCM Cheongdam House"}
          </span>

          <span className="info-label">Date</span>

          <span className="info-value">{displayDate}</span>
        </div>

        <button
          className="secondary-btn"
          onClick={downloadImage}
          data-html2canvas-ignore="true"
        >
          <img src="/download.svg" alt="download icon" className="btn-icon" />
          이미지로 저장
        </button>
      </section>

      <hr className="divider" />

      {/* 4. 제품 정보 */}
      <section className="product-info-section">
        {/* BAG */}
        <div className="product-card">
          <div className="product-image-placeholder">
            <img
              src={displayBagImage}
              alt={bag.name || "Bag"}
              className="product-img"
            />
          </div>

          <div className="product-text">
            <h4>ABOUT BAG</h4>

            <p className="product-name">
              {bag.name || "Stark Side Stud Visetos Backpack"}
            </p>

            <p className="product-desc">Aura의 추천 아이템 입니다.</p>

            <div className="button-group">
              <button
                className="outline-btn"
                onClick={() => setSelectedImage(displayBagImage)}
              >
                제품 보기
              </button>

              <button
                className="solid-btn"
                onClick={() => {
                  sendEventLog("PURCHASE_CLICK", bag.product_id);

                  window.open(
                    bag.purchase_url || "https://kr.mcmworldwide.com/",
                    "_blank",
                  );
                }}
              >
                <img src="/purchase.svg" alt="purchase" className="btn-icon" />
                구매하기
              </button>
            </div>
          </div>
        </div>

        <hr className="sub-divider" />

        {/* ACCESSORY */}
        <div className="product-card transparent-card">
          <h4 className="transparent-title">ABOUT STYLING ITEM</h4>

          <div className="transparent-content">
            <div className="product-image-placeholder circle">
              <img
                src={displayAccImage}
                alt={displayAccName}
                className="product-img circle-img"
              />
            </div>

            <div className="product-text">
              <p className="product-name">MCM</p>

              <p className="product-desc">{displayAccName}</p>

              <div className="button-group">
                <button
                  className="outline-btn"
                  onClick={() => setSelectedImage(displayAccImage)}
                >
                  제품 보기
                </button>

                <button
                  className="solid-btn"
                  onClick={() => {
                    sendEventLog("PURCHASE_CLICK", finalProductId);

                    window.open(finalPurchaseUrl, "_blank");
                  }}
                >
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

        <div className="store-bg-image" />
      </footer>

      <div className="footer-logo-bar">
        <img src="/mcm-logo.svg" alt="MCM Logo" className="footer-logo" />
      </div>

      {/* 이미지 확대 */}
      {selectedImage && (
        <div
          className="image-modal-overlay"
          onClick={() => setSelectedImage(null)}
          data-html2canvas-ignore="true"
        >
          <div
            className="image-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={selectedImage} alt="Enlarged Product" />

            <button
              className="close-modal-btn"
              onClick={() => setSelectedImage(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
