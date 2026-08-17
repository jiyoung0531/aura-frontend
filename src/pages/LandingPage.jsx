// src/pages/LandingPage.jsx
import { useEffect, useState, useRef } from "react";
import html2canvas from "html2canvas";
import { getLanding } from "../api/auraApi";
import "./LandingPage.css";

const API_BASE = import.meta.env.VITE_API_BASE;

const BAG_IMG_URL = "https://storage.googleapis.com/aura-assets-2026/products/bag_01.png";
const ACC_NORMAL_URL = "https://storage.googleapis.com/aura-assets-2026/products/acc_01.png"; // 일반 키링
const ACC_BEAR_URL = "https://storage.googleapis.com/aura-assets-2026/products/acc_02.png"; // 곰돌이 키링

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
  bagName: "Stark Side Stud Visetos Backpack",
  auraColors: ["#FFA1C5", "#707ABB", "#838383"],
  mood: "Street Energy",
  styling: "Silver Key Ring",
  forgedAt: "MCM Cheongdam House",
  date: today,
  videoUrl: "",
};

export default function LandingPage({ id, auraColors, mood, styling, activeAccessoryId}) {
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const cardRef = useRef(null);

  const sendEventLog = async (eventType, productId = null) => {
    if (!id) return;
    try {
      const bodyData = { event_type: eventType };
      if (productId) bodyData.product_id = productId; // 구매 클릭 시 상품 ID 필수
      await fetch(`${API_BASE}/landing/${id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData)
      });
      console.log(`이벤트 로그 전송 완료: ${eventType}`);
    } catch (error) {
      console.error("이벤트 로그 전송 실패:", error);
    }
  };

  useEffect(() => {
    let pollTimer;
    let attempts = 0;
    let cancelled = false;
    // QR코드나 링크로 접속해서 백엔드에서 데이터를 가져올 때
    const fetchUserData = async () => {
      try {
        const data = await getLanding(id);
        if (cancelled) return;
        const actualData = data?.data || data;
        if (actualData && actualData.products && actualData.products.length > 0) {
        setUserData(actualData);
        setIsLoading(false);
        sendEventLog("PAGE_VIEW");
      } else if (attempts++ < 30) {
        console.log("백엔드 데이터가 아직 비어있음, 2초 후 재시도...");
        pollTimer = window.setTimeout(fetchUserData, 2000);
      } else {
        setUserData(FALLBACK_DATA);
        setIsLoading(false);
      }
    } catch (error) {
      console.warn("데이터 로딩 중 오류:", error);
      if (!cancelled) {
        setUserData(FALLBACK_DATA);
        setIsLoading(false);
      }
    }
  };

    // id가 있으면 무조건 백엔드를 찔러봄
    if (id) {
      fetchUserData();
    } else if (auraColors && auraColors.length > 0) {
      console.log("API ID 없음 - 로컬 데이터로 폴백 화면 렌더링");
      setUserData({
        ...FALLBACK_DATA,
        auraColors: auraColors,
        mood: mood,
        styling: styling || FALLBACK_DATA.styling,
      });
      setIsLoading(false);
    } else {
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
 
  const dynamicAuraCodes = soulTag.aura_code || soulTag.auraColors || FALLBACK_DATA.auraColors;
  const dynamicMood = soulTag.mood || FALLBACK_DATA.mood;
  const dynamicDate = soulTag.date || FALLBACK_DATA.date;
  
 const currentAccId = (activeAccessoryId !== null && activeAccessoryId !== undefined)
    ? activeAccessoryId 
    : (Number(window.sessionStorage.getItem("aura_active_accessory_id")) || accessory.product_id || 1);

  const finalAccessoryId = currentAccId;

  const isBearKeyring = Number(finalAccessoryId) === 2;

  const displayAccName = isBearKeyring ? "MCM Visetos Park Bear Charm" : "Visetos Original Keyring";
  const displayAccImage = isBearKeyring ? ACC_BEAR_URL : ACC_NORMAL_URL;
  const displayBagImage = bag.image_url || BAG_IMG_URL;

  const BEAR_PURCHASE_URL = "https://kr.mcmworldwide.com/ko_KR/%EA%B0%80%EB%B0%A9/%EC%8A%A4%ED%8A%B8%EB%9E%A9-%EC%95%A1%EC%84%B8%EC%84%9C%EB%A6%AC/mcm-%EB%B9%84%EC%84%B8%ED%86%A0%EC%8A%A4-%ED%8C%8C%ED%81%AC%EB%B2%A0%EC%96%B4-%EC%B0%B8/MXZFSTA11CO001.html?cgid=bags-bag-accessories";
  const finalProductId = isBearKeyring ? 2 : (accessory.product_id || 1);
  const finalPurchaseUrl = isBearKeyring
    ? BEAR_PURCHASE_URL
    : (accessory.purchase_url || "https://kr.mcmworldwide.com/");

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

  const downloadImage = async () => {
    if (!cardRef.current) return;
    sendEventLog("SOUL_TAG_DOWNLOAD");

    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null // 원래 배경색 살리기
      });

      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = `My_Aura_Card.png`;
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

      {/* 2. 체험 영상 영역 */}
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
      <section className="aura-card" ref={cardRef}>

        <div className="info-grid">
          <span className="info-label">Bag</span>
          <span className="info-value">
            {/*{soulTag.bag_name || bag.name || "-"}*/}
            Stark Side Stud Visetos Backpack
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
            {displayAccName}
          </span>

          <span className="info-label">Forged At</span>
          <span className="info-value">
            {/*{soulTag.forged_at || "-"}*/}
            MCM Cheongdam House
          </span>

          <span className="info-label">Date</span>
          <span className="info-value">{soulTag.date || "-"}</span>
        </div>

        <button className="secondary-btn"
        onClick={downloadImage}
          data-html2canvas-ignore="true"
        >
          <img src="/download.svg" alt="download icon" className="btn-icon" />
          이미지로 저장
        </button>
      </section>

      <hr className="divider" />

      {/* 4. 제품 정보 영역 */}
      <section className="product-info-section">
        <div className="product-card">
          <div className="product-image-placeholder">
            <img src={displayBagImage} alt={bag.name || "Bag"} className="product-img" />
          </div>
          <div className="product-text">
            <h4>ABOUT BAG</h4>
            <p className="product-name">{bag.name || "-"}</p>
            <p className="product-desc">Aura의 추천 아이템 입니다.</p>
            <div className="button-group">
              <button className="outline-btn" onClick={() => setSelectedImage(displayBagImage)}>제품 보기</button>
              <button className="solid-btn"
              onClick={() => {
                  sendEventLog("PURCHASE_CLICK", bag.product_id);
                  window.open(bag.purchase_url || "https://kr.mcmworldwide.com/", "_blank");
                }}>
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
            <div className="product-image-placeholder circle">
              <img src={displayAccImage} alt={accessory.name || "Accessory"} className="product-img circle-img" />
            </div>
            <div className="product-text">
              <p className="product-name">MCM</p>
              <p className="product-desc">
                {displayAccName}
              </p>
              <div className="button-group">
                <button className="outline-btn"onClick={() => setSelectedImage(displayAccImage)}>
                  제품 보기
                  </button>
                <button className="solid-btn"
                onClick={() => {
                    sendEventLog("PURCHASE_CLICK", finalProductId);
                    window.open(finalPurchaseUrl, "_blank");
                  }}>
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

      {selectedImage && (
        <div className="image-modal-overlay" onClick={() => setSelectedImage(null)} data-html2canvas-ignore="true">
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <img src={selectedImage} alt="Enlarged Product" />
            <button className="close-modal-btn" onClick={() => setSelectedImage(null)}>✕</button>
          </div>
        </div>
      )}

    </div>
  );
}
