# 고속도로 휴게소 큐레이션 서비스 (Highway Rest Area Curation)

> **"단순한 경로 안내를 넘어, 휴게소의 맛집과 편의시설 정보를 한눈에!"** > Kakao Maps API와 생성형 AI를 활용한 운전자 맞춤형 휴게소 정보 제공 서비스

<br>

## 프로젝트 기간 & 개요
- **진행 기간**: 2025.12.16 ~ 2025.16.23 (1주일)
- **프로젝트 유형**: 팀 프로젝트 (5인)
- **기획 배경**:
  - 자동차 여행 및 고속도로 이용객 증가
  - 기존 내비게이션은 경로상 휴게소의 맛집/편의시설 정보를 미리 파악하기 어려움
  - 운전 중 검색의 위험을 줄이고, 즐거운 여행을 돕는 큐레이션 서비스의 필요성 대두

<br>

## 🛠️ 기술 스택 (Tech Stack)

| 구분 | 기술 |
| :-- | :-- |
| **Backend** | Python, Flask |
| **Frontend** | HTML5, CSS3 (Tailwind), JavaScript, Jinja2 Template |
| **Database** | MariaDB |
| **API & AI** | Kakao Maps API, Kakao Mobility API, Google Gemini AI API, 공공데이터포털 API |
| **Collaboration** | Git, GitHub |

<br>

## 주요 기능 (Key Features)

1. **실시간 경로 탐색 및 시각화**
   - 출발지/도착지 입력을 통한 최적 경로 산출
   - Kakao Maps API를 활용하여 지도 위에 경로 및 경유 휴게소 마커(Pin) 표시

2. **휴게소 정보 큐레이션**
   - 경로 상에 위치한 휴게소 리스트 자동 추출
   - 휴게소별 대표 맛집 메뉴, 편의시설(주유소, 전기차 충전소, 약국, 수유실 등) 정보 제공

3. **AI 기반 정보 요약 (Gemini)**
   - 생성형 AI(Gemini)를 활용하여 사용자에게 휴게소 특징 및 추천 정보를 요약 제공
   - 조회된 AI 정보를 DB에 캐싱(`AI_INFO_CACHE`)하여 응답 속도 최적화

4. **사용자 편의 기능**
   - 직관적인 UI/UX (카드 형태의 휴게소 리스트)
   - 카카오맵 외부 링크 연동으로 상세 길찾기 연결

<br>

## 시스템 아키텍처 (System Architecture)

![System Architecture]([<img width="637" height="457" alt="20260112_142010" src="https://github.com/user-attachments/assets/fbb974c4-dcd7-4110-a579-12fcd7026fd6" />])
*사용자가 브라우저에 접속하면 Flask 서버가 Kakao API와 DB(MariaDB)를 조회하여, 경로와 휴게소 정보를 Jinja2 템플릿과 JS를 통해 렌더링합니다.*

### 디렉토리 구조 (Directory Structure)
```bash
1218_REST_AREA-MAIN
├── static/
│   ├── main.js       # Kakao 지도 렌더링, 경로 요청, 비동기 처리
│   └── style.css     # 전체 UI 스타일링, 레이아웃 정의
├── templates/
│   └── index.html    # 메인 화면 구조 (Jinja2)
├── app.py            # Flask 메인 서버, 라우팅, API 연동 로직
└── db.py             # MariaDB 연결 관리 및 데이터 쿼리 처리
```

### ERD (Database Schema)

- **ROUTE**: 출발지, 도착지, 경로 데이터(Polyline) 저장
- **REST_AREA**: 휴게소 이름, 주소, 좌표(위/경도), 노선 정보
- **AI_INFO_CACHE**: 휴게소별 AI 요약 정보 캐싱 (불필요한 API 호출 방지)

<br>

### 팀원 및 역할 (Team Members)

| 이름 | 역할 | 담당 업무 |
| :--- | :--- | :--- |
| **박민우** | **PM** | 일정 관리, 리소스 배분, 커뮤니케이션 총괄, 최종 발표 |
| **신민서** | **PL / Backend** | 기술 아키텍처 설계, 핵심 백엔드 로직 개발 리드 |
| **류건우** | **AI / API** | Gemini AI 연동, 외부 API Key 관리 및 로직 최적화 |
| **이유진** | **UI/UX / Frontend** | UI 디자인, 프론트엔드 구현 및 사용자 경험 개선 |
| **권민지** | **DB / Deploy** | MariaDB 스키마 설계, 데이터베이스 관리, 배포 환경 구축 |

<img width="508" height="386" alt="20260112_142119" src="https://github.com/user-attachments/assets/1b261a2d-9d62-4dd8-8bb2-09445486fd6a" />

트러블 슈팅 & 향후 계획 (Future Plans)
AI 응답 속도 개선: 초기 로딩 지연 문제를 해결하기 위해 AI 응답 결과를 DB에 캐싱하는 구조 도입

향후 계획:

실시간 혼잡도 및 주차 정보 연동

사용자 취향(한식/일식 등)에 따른 맞춤형 휴게소 추천 필터링

카카오내비 앱으로 경로 전송 기능 추가
