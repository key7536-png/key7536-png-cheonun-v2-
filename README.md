# ✦ 천운 상담도구 v2 — Vercel + Supabase

> GitHub Pages → Vercel + Supabase 이전 버전  
> API 키 서버사이드 보호 + 고객 데이터 클라우드 동기화

---

## 📁 파일 구조

```
cheonun-vercel/
├── api/
│   └── ai.js          ← Vercel Serverless Function (Gemini API 프록시)
├── public/
│   └── index.html     ← 메인 앱 (Supabase 연동)
├── vercel.json        ← Vercel 라우팅 설정
├── package.json
└── README.md
```

---

## 🚀 배포 순서

### 1단계 — Vercel 배포

```bash
# Vercel CLI 설치 (없으면)
npm i -g vercel

# 프로젝트 폴더에서
cd cheonun-vercel
vercel

# 첫 배포 시 질문들:
# Set up and deploy? → Y
# Which scope? → 본인 계정 선택
# Link to existing project? → N
# What's your project's name? → cheonun-consulting (또는 원하는 이름)
# In which directory is your code? → ./
```

### 2단계 — Vercel 환경변수 설정 (API 키 등록)

Vercel 대시보드 → 프로젝트 → Settings → Environment Variables

```
GEMINI_KEY_1   = AQ.Ab8RN...   (무료 키 1번)
GEMINI_KEY_2   = AQ.Cd9KM...   (무료 키 2번)
...최대 GEMINI_KEY_30까지...
GEMINI_PAID_KEY = AQ.유료키...  (유료 키, 선택)
```

> ⚠️ 환경변수 추가 후 반드시 **Redeploy** 해야 적용됩니다.

### 3단계 — Supabase 설정 (고객 데이터 클라우드)

1. [supabase.com](https://supabase.com) → 무료 프로젝트 생성
2. SQL Editor에서 아래 실행:

```sql
CREATE TABLE IF NOT EXISTS cheonun_clients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  gender text,
  birth text,
  hour text,
  topic text,
  question text,
  saved_at text,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE cheonun_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON cheonun_clients FOR ALL USING (true);
```

3. Settings → API → **Project URL** 과 **anon public key** 복사
4. 앱 접속 후 상단 ⚙ 아이콘 → URL/Key 입력 → 연결 저장

---

## 💡 로컬 개발

```bash
# vercel dev (로컬 서버 + 환경변수 자동 로드)
vercel dev

# 브라우저: http://localhost:3000
```

환경변수는 `.env.local` 파일에도 설정 가능:
```
GEMINI_KEY_1=AQ.Ab8RN...
GEMINI_KEY_2=AQ.Cd9KM...
```

---

## 🔄 GitHub 연동 자동 배포 (선택)

```bash
# GitHub 저장소 생성 후
git init
git add .
git commit -m "천운 상담도구 v2 — Vercel+Supabase"
git remote add origin https://github.com/key7536-png/cheonun-v2.git
git push -u origin main

# Vercel 대시보드 → Import Git Repository → 연결
# main 브랜치 push 시 자동 배포됩니다
```

---

## ⚡ 기존 버전과 차이점

| 항목 | GitHub Pages (구버전) | Vercel (신버전) |
|------|----------------------|-----------------|
| API 키 | HTML 파일 안에 내장 | 서버 환경변수로 보호 |
| 고객 저장 | 기기 localStorage만 | Supabase 클라우드 동기화 |
| 기기 간 동기화 | ❌ | ✅ (Supabase) |
| AI 모델 | Gemini 직접 호출 | Vercel 프록시 경유 |
| 배포 | GitHub Pages | Vercel (자동 HTTPS) |

---

## ⭐ 자미두수 독립 카테고리

기존 사주·타로 상담 로직을 변경하지 않고 `/ziwei.html`에 독립 화면으로 추가되어 있습니다.

- 양력·음력(윤달 포함) 입력
- 출생 시각 필수 검증
- 명궁·신궁·오행국·12궁·14주요성·생년 사화 계산
- 현재 대한·유년 계산
- 계산된 명반만 사용하는 Gemini 상담 프롬프트

자미두수 계산은 MIT 라이선스의 `iztro` 2.6.0을 사용하며, 브라우저용 고정 버전을 `public/vendor`에 포함합니다. 계산 회귀 테스트는 다음 명령으로 실행합니다.

```bash
npm test
```

---

## 📁 고객관리 · 상담 전 질문지

`/clients.html`은 기존 상담 로직과 분리된 로컬 고객관리 화면입니다.

- 고객 기본정보와 상담 전 질문지를 현재 컴퓨터 브라우저에 저장
- 이름·연락처·상담주제 검색, 수정 및 삭제
- JSON 백업 파일을 외장메모리에 저장하고 다른 컴퓨터에서 복원
- 고객관리 기록은 AI 상담 API로 전송하지 않음
- 저장된 고객별로 `/saju-analysis.html`의 사주 기본분석 양식을 연결
- 원국·오행·십성·합충형파해·용희기신·대운·세운·영역별 해석·상담 근거 기록
- 사주 기본분석도 같은 고객 백업 JSON에 포함
- 고객관리 기록을 기존 상담·전화상담·자미두수 입력 화면에서 불러오기
- 기존 내담자 저장소와 고객관리 저장소는 유지하되 화면에서 중복 없이 연결

---

### 사주 양력·음력 정확성

- 양력 입력은 기존 절기·일주 계산 결과를 그대로 유지합니다.
- 음력 입력은 `iztro` 2.6.0으로 양력 변환한 뒤 동일한 사주 엔진에 전달합니다.
- 평달·윤달을 구분하며 변환 실패 시 양력으로 임의 계산하지 않습니다.
- 상담·사주+타로·전화상담·후속 대화가 한 번 계산한 명식을 동일하게 사용합니다.

---

### 자미두수 고객 불러오기·Gemini 안정성

- 고객 선택은 배열 위치로 연결하여 이전 백업에 중복 ID가 있어도 선택한 고객을 정확히 불러옵니다.
- 고객 백업 복원 시 중복 ID를 자동 정리합니다.
- 자미두수 후속 질문은 최근 6개 대화와 최대 1,024 출력 토큰만 사용해 할당량 소비를 줄입니다.
- Gemini 키는 성공한 키를 계속 사용하며, 인증 실패 키는 건너뛰고 다음 정상 키를 시도합니다.
- Gemini 키는 URL에 노출하지 않고 Google 공식 `x-goog-api-key` 헤더로 전송합니다.

---

## 📞 문의

카카오채널: pf.kakao.com/_TTxmxhX  
쇼핑몰: 자개빛.shop
