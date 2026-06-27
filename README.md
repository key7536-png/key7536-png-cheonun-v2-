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
...최대 GEMINI_KEY_10까지...
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

## 📞 문의

카카오채널: pf.kakao.com/_TTxmxhX  
쇼핑몰: 자개빛.shop
