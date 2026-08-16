import React from 'react';
import './QrResultScreen.css'; // CSS 파일 연결

export default function QrResultScreen({ qrImageUrl, onReset }) {
  return (
    <div className="qr-screen-wrapper">
      <div className="qr-content">
        {/* 상단 로고 */}
        <img src="/aura-logo.svg" alt="AURA Logo" className="qr-top-logo" />

        {/*  타이틀 */}
        <h2 className="qr-title">Your Aura Is Ready</h2>
        <p className="qr-subtitle">당신의 아우라가 완성되었습니다.</p>

        {/*  QR 코드 박스  */}
        <div className="qr-box">
          {qrImageUrl ? (
            <img src={qrImageUrl} alt="Aura QR Code" className="qr-image" />
          ) : (
            <div className="qr-placeholder">QR 로딩 중...</div>
          )}
        </div>

        <p className="qr-guide">
          QR을 스캔하여<br />아우라 카드를 받아보세요.
        </p>
      </div>

      <div className="qr-footer">
        <button className="qr-home-btn" onClick={onReset}>
          <img src="/home.svg" alt="Home" className="home-icon" />
        </button>
        
        <div className="qr-footer-text">
          <p>Thank you for visiting MCM</p>
          <img src="/mcm-logo.svg" alt="MCM Logo" className="qr-mcm-logo" />
        </div>
      </div>
    </div>
  );
}