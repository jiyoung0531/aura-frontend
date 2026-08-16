// src/pages/LandingPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import './LandingPage.css';

export default function LandingPage({ id }) {
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    // 백엔드 API가 완성 시 사용
    /*
    const fetchUserData = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/landing/${id}`);
        const data = await response.json();
        setUserData(data);
      } catch (error) {
        console.error("데이터 로딩 실패:", error);
      }
    };
    if (id) fetchUserData();
    */

    // UI 구현을 위한 더미데이터
    setUserData({
      bagName: "MCM Stark Backpack",
      auraColors: ["#FFA1C5", "#707ABB", "#838383"],
      mood: "Street Energy",
      styling: "Silver Key Ring",
      forgedAt: "MCM Cheongdam House",
      date: "2026. 07. 28",
      videoUrl: "", // 임시 비디오 경로
    });
  }, [id]);

  if (!userData) {
    return <div className="loading-screen">데이터를 불러오는 중입니다...</div>;
  }

  return (
    <div className="landing-container">
      {/* 1. 상단 로고 */}
      <header className="header-logo">
        <img src="/aura-logo.svg" alt="MCM AURA Logo" className="mcm-svg-logo" />
        <p>FORGED BY YOUR AURA</p>
      </header>

      {/* 2. 체험 영상 영역 */}
      <section className="video-section">
        <div className="video-placeholder">
          체험 영상
        </div>
        <button className="primary-btn">
            <img src="/download.svg" alt="download icon" className="btn-icon" />
            영상 저장
        </button>
      </section>

      {/* 3. AURA 카드 결과 영역 */}
      <section className="aura-card">
        <h3>FORGED BY YOUR AURA</h3>
        
        <div className="info-grid">
          <span className="info-label">Bag</span>
          <span className="info-value">{userData.bagName}</span>

          <span className="info-label">Aura Code</span>
          <div className="aura-colors">
            {userData.auraColors.map((color, index) => (
              <span key={index} className="color-item">
                <span className="color-dot" style={{ backgroundColor: color }}></span>
                <span className="color-text">{color}</span>
              </span>
            ))}
          </div>

          <span className="info-label">Mood</span>
          <span className="info-value">{userData.mood}</span>

          <span className="info-label">Styling</span>
          <span className="info-value">{userData.styling}</span>

          <span className="info-label">Forged At</span>
          <span className="info-value">{userData.forgedAt}</span>

          <span className="info-label">Date</span>
          <span className="info-value">{userData.date}</span>
        </div>

        <button className="secondary-btn">
            <img src="/download.svg" alt="download icon" className="btn-icon" />
            이미지로 저장</button>
      </section>

      <hr className="divider" />

      {/* 4. 제품 정보 영역 */}
      <section className="product-info-section">
        <div className="product-card">
          <div className="product-image-placeholder"></div>
          <div className="product-text">
            <h4>ABOUT BAG</h4>
            <p className="product-name">{userData.bagName}</p>
            <p className="product-desc">Aura의 추천 아이템 입니다.</p>
            <div className="button-group">
              <button className="outline-btn">제품 보기</button>
              <button className="solid-btn">
                <img src="/purchase.svg" alt="purchase" className="btn-icon" />
                구매하기</button>
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
              <p className="product-desc">{userData.styling}</p>
              <div className="button-group">
                <button className="outline-btn">제품 보기</button>
                <button className="solid-btn">
                  <img src="/purchase.svg" alt="purchase" className="btn-icon" />
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
          <p>MCM Official Store에서<br/>더 많은 제품을 만나보세요.</p>
          <button className="store-btn"
          onClick={() => window.open('https://kr.mcmworldwide.com/', '_blank')}
          >스토어 연결 ➔</button>
        </div>
        <div className="store-bg-image"></div>
      </footer>

      <div className="footer-logo-bar">
        <img src="/mcm-logo.svg" alt="MCM Logo" className="footer-logo" />
      </div>
    </div>
  );
}