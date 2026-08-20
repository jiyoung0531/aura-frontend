# AURA - Frontend

<div align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black">
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white">
  <img src="https://img.shields.io/badge/Three.js-WebGL-000000?style=for-the-badge&logo=three.js&logoColor=white">
  <br>
  <img src="https://img.shields.io/badge/MediaPipe-Hand_Tracking-FF6F00?style=for-the-badge&logo=google&logoColor=white">
  <img src="https://img.shields.io/badge/Google_Cloud-API_Integration-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white">
  <img src="https://img.shields.io/badge/html2canvas-Image_Capture-E34F26?style=for-the-badge&logo=html5&logoColor=white">
</div>

## 📖 프로젝트 소개

AURA 프론트엔드는 매장 아이패드에서 사용자의 웹캠 영상과 손 제스처를 활용해 AI 스타일 분석 결과를 시각화하는 인터랙티브 미러 애플리케이션입니다.

분석된 컬러 팔레트와 무드를 3D MCM 가방에 적용하고, 체험 종료 후 영상·QR 코드·디지털 Soul Tag를 모바일 랜딩 페이지로 연결합니다.

---

## ⚙️ 기술 스택

- **React 19 + Vite 8:** 컴포넌트 기반 UI와 개발·빌드 환경
- **React Router:** `/camera`, `/bag`, `/landing/:publicId` 화면 흐름
- **Three.js / React Three Fiber / Drei:** 3D 가방과 WebGL 렌더링
- **MediaPipe Hands:** 브라우저 손 랜드마크 및 제스처 추적
- **html2canvas:** Soul Tag 카드 이미지 캡처
- **Google Cloud Storage Signed URL:** 영상·썸네일 직접 업로드

---

## 🚀 실행 방법

```bash
npm install
npm run dev
```

`.env` 파일에서 백엔드 주소를 지정할 수 있습니다.

```env
VITE_API_BASE=https://your-backend.example.com/api
```

설정하지 않으면 기본 AURA 백엔드 주소를 사용합니다.

---

## 🧭 사용자 체험 흐름

1. 동의 화면에서 카메라 및 분석 이용에 동의
2. 익명 세션 생성 및 에셋 매니페스트 프리로드
3. 웹캠 이미지 캡처 후 AI 스타일·무드·컬러 분석
4. 결과 컬러를 파티클, Aura Orb, 3D 가방에 적용
5. 손 뻗기·주먹·회전·Press 제스처로 가방 조작
6. 액세서리 부착 후 완료
7. 체험 영상을 녹화하고 Signed URL로 GCS 업로드
8. QR 결과 화면을 통해 모바일 랜딩 페이지로 이동

---

## 🧠 웹캠 및 제스처 처리

- MediaPipe 손 랜드마크를 프레임 단위로 추적합니다.
- 손 크기와 손가락 끝점 거리를 함께 사용해 주먹 인식을 보정합니다.
- 손 위치는 가방 회전, Aura Orb 이동, Press 판정에 사용됩니다.
- 상호작용 이벤트는 버퍼링 후 `/sessions/{publicId}/interactions`로 전송합니다.
- 페이지 이탈 시 `sendBeacon`으로 남은 이벤트를 전송합니다.

---

## 🎥 영상 및 이미지 처리

- `useExperienceRecorder`가 웹캠·파티클·가방·UI 레이어를 합성해 영상을 녹화합니다.
- 완성 시점 캔버스를 썸네일로 캡처합니다.
- 영상과 썸네일은 백엔드가 발급한 Signed URL로 GCS에 직접 업로드합니다.
- 제작 제한 시간을 초과하면 실패 상태로 처리하고 모바일 랜딩에 실패 화면을 표시합니다.
- Soul Tag 카드는 `html2canvas`로 카드 영역만 캡처합니다.

---

## 🗂️ 주요 API 연동

| 기능 | 프론트 호출 |
| --- | --- |
| 세션 생성 | `POST /sessions` |
| 에셋 매니페스트 | `GET /assets/manifest` |
| AI 분석 | `POST /sessions/{publicId}/analysis` |
| 세션 상태 | `PATCH /sessions/{publicId}/status` |
| 상호작용 기록 | `POST /sessions/{publicId}/interactions` |
| 영상 업로드 URL | `POST /sessions/{publicId}/outputs/video-url` |
| 영상 업로드 완료 | `POST /sessions/{publicId}/outputs/video-complete` |
| 결과 확정 | `POST /sessions/{publicId}/outputs/finalize` |
| 모바일 랜딩 | `GET /landing/{publicId}` |

API 래퍼는 [`src/api/auraApi.js`](src/api/auraApi.js)에 있습니다.

---

## 💡 트러블슈팅

### `Failed to fetch`

- `VITE_API_BASE`가 `/api`까지 포함하는지 확인합니다.
- 백엔드 CORS에 현재 프론트 도메인과 로컬 포트가 허용되어야 합니다.
- API가 JSON 대신 HTML 오류 페이지를 반환하지 않는지 확인합니다.

### 패턴·에셋이 보이지 않는 경우

- `/assets/manifest` URL이 브라우저에서 직접 열리는지 확인합니다.
- CORS 및 이미지 로딩 오류를 확인합니다.
- 매니페스트 수신 직후 패턴을 프리로드해야 합니다.

### 영상이 검은 화면으로 저장되는 경우

- WebGL 렌더러에 `preserveDrawingBuffer: true`가 설정되어야 합니다.
- 캔버스와 비디오가 렌더링된 뒤 녹화를 시작해야 합니다.
- iPad 카메라 권한과 사용자 제스처 이후 미디어 제한을 확인합니다.

---

## 📦 빌드 및 린트

```bash
npm run build
npm run preview
npm run lint
```
