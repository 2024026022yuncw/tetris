# Product Requirements Document (PRD)
## Web Tetris with Supabase Leaderboard & Feedback

- **Project**: supabase-tetris
- **Repository**: https://github.com/2024026022yuncw/tetris.git
- **Deployment target**: Vercel (static web app)
- **Backend**: Supabase (Postgres + REST)
- **Last updated**: 2026-11-09

---

## 1. Overview

클래식 테트리스를 웹 브라우저에서 플레이할 수 있는 단일 페이지 애플리케이션. 플레이어는 게임 종료 시 닉네임과 함께 점수를 Supabase에 저장하고, 전역 리더보드를 확인할 수 있다. 또한 사용자들은 게임/서비스에 대한 피드백을 자유롭게 남길 수 있다.

### 1.1 Goals
- 브라우저에서 바로 플레이 가능한 테트리스 (설치 불필요).
- Vercel 정적 배포로 운영 비용 0에 가깝게 유지.
- Supabase로 점수·피드백을 실시간 저장·조회.
- BGM과 효과음으로 플레이 경험을 강화.

### 1.2 Non-Goals
- 사용자 회원가입/로그인 (닉네임만 입력).
- 멀티플레이어·대전 모드.
- 모바일 터치 컨트롤 (선택: 키보드 중심, 모바일은 베스트 에포트).
- **고스트 블록(그림자) 표시 — 요구사항에 따라 제외.**

---

## 2. Target Users & User Stories

### 2.1 Personas
- **Casual Player**: 가볍게 한 판 즐기고 랭킹 보고 싶은 사용자.
- **Score Chaser**: 상위 랭킹을 노리는 사용자.
- **Feedback Giver**: 버그나 개선 아이디어를 남기고 싶은 사용자.

### 2.2 User Stories
1. 사용자로서, 페이지에 들어오면 즉시 테트리스를 시작할 수 있다.
2. 사용자로서, 키보드로 블록을 좌/우/아래 이동, 회전, 하드드랍 할 수 있다.
3. 사용자로서, 게임 오버 시 닉네임을 입력하여 점수를 저장할 수 있다.
4. 사용자로서, Top 10 리더보드를 언제든 확인할 수 있다.
5. 사용자로서, 배경 음악과 효과음을 들을 수 있고 음소거 할 수 있다.
6. 사용자로서, 이름과 메시지로 피드백을 작성하고 다른 사용자의 피드백도 볼 수 있다.

---

## 3. Functional Requirements

### 3.1 Tetris Gameplay
| ID | Requirement |
|----|-------------|
| G-1 | 10 × 20 보드. 상단 2줄은 스폰 영역(렌더링 시 숨김 또는 표시). |
| G-2 | 7가지 테트로미노(I, O, T, S, Z, J, L) 지원. 7-bag 랜덤. |
| G-3 | 회전은 SRS(Super Rotation System) 기본, 월킥 포함. |
| G-4 | 다음 블록(Next) 미리보기 1개. |
| G-5 | 고스트 블록(그림자) **미표시**. |
| G-6 | 라인 삭제: 1/2/3/4줄 동시 삭제 지원. |
| G-7 | 소프트 드랍(↓), 하드 드랍(Space) 지원. |
| G-8 | 홀드(Hold) 기능 — 선택적, v1에서는 구현 생략. |
| G-9 | 일시정지(P). |
| G-10 | 게임 오버: 새 블록이 스폰 위치에서 즉시 충돌할 때. |

### 3.2 Scoring & Level
- Single = 100, Double = 300, Triple = 500, Tetris = 800. (레벨 배수 적용)
- 라인 10개 삭제 시 레벨 +1. 최대 레벨 20.
- 레벨에 따라 중력 속도 증가 (Classic NES 기반 테이블 근사).
- 하드 드랍 추가 점수: 드랍 칸 수 × 2.
- 소프트 드랍 추가 점수: 드랍 칸 수 × 1.

### 3.3 Controls
| Key | Action |
|-----|--------|
| ← / → | 좌우 이동 |
| ↓ | 소프트 드랍 |
| ↑ / X | 시계방향 회전 |
| Z | 반시계 회전 |
| Space | 하드 드랍 |
| P | 일시정지 / 재개 |
| M | 음소거 토글 |
| R | 게임 오버 상태에서 재시작 |

### 3.4 Audio
- **BGM**: 페이지 입장 후 "Start" 또는 사용자 상호작용 시 재생 시작 (브라우저 autoplay 정책 대응). 반복 재생. 음소거 가능.
- **SFX**: move / rotate / lock / line-clear (1-3줄) / tetris(4줄) / game-over.
- 구현 방식: **Web Audio API로 합성** (외부 오디오 파일 의존성 제거, 저작권 이슈 회피, 저용량).

### 3.5 Supabase Integration

#### 3.5.1 Scores
- 테이블: `scores`
  - `id` bigserial PK
  - `nickname` text (1-16자, 공백 제거)
  - `score` integer (>= 0)
  - `lines` integer
  - `level` integer
  - `created_at` timestamptz default now()
- 쓰기: 게임 오버 후 닉네임 입력 시 1건 insert.
- 읽기: `score desc, created_at asc` 정렬, Top 10.

#### 3.5.2 Feedback
- 테이블: `feedback`
  - `id` bigserial PK
  - `name` text (1-20자, 비어있으면 "Anonymous")
  - `message` text (1-500자, 필수)
  - `created_at` timestamptz default now()
- 쓰기: 폼 제출 시 insert.
- 읽기: 최신 20개, `created_at desc`.

#### 3.5.3 RLS 정책
- Anon role로 insert / select 모두 허용. (익명 기여 모델)
- update / delete는 허용하지 않음.

### 3.6 UI Sections
1. **Game Pane**: 보드 Canvas + Next 미리보기 + 점수/라인/레벨.
2. **Controls / Buttons**: Start, Pause, Mute.
3. **Leaderboard**: Top 10 목록 (실시간 refresh 버튼 포함).
4. **Feedback Form + Feedback List**: 작성 폼 + 최근 피드백.
5. **Footer**: 리포지토리 링크.

---

## 4. Non-Functional Requirements

- **성능**: 60fps 렌더링 (requestAnimationFrame). 모바일에서도 30fps 이상.
- **접근성**: 키보드 포커스 처리. ARIA label 주요 버튼에.
- **반응형**: 데스크톱 우선 (1280×720+). 모바일은 뷰포트 fit.
- **보안**: Supabase anon key만 사용. RLS로 쓰기 제한. 서비스 롤 키 절대 노출 금지.
- **스팸 방지(간이)**: 피드백 submit에 클라이언트 쿨다운 10초.
- **로컬 동작**: Supabase 환경변수 미설정 시에도 게임은 플레이 가능 (리더보드/피드백은 경고 메시지 표시).

---

## 5. Architecture

### 5.1 Stack
- Vanilla HTML/CSS/JS (ES modules) — 번들러/프레임워크 없음.
- `@supabase/supabase-js@2` (ESM CDN import).
- Canvas 2D API로 보드/블록 렌더링.
- Web Audio API로 BGM/SFX 합성.

### 5.2 Files
```
/
├── index.html              # 메인 페이지
├── styles.css              # 전체 스타일
├── js/
│   ├── main.js             # 엔트리, UI 바인딩
│   ├── tetris.js           # 게임 로직
│   ├── audio.js            # BGM / SFX
│   └── supabase.js         # 클라이언트 + score/feedback API
├── config.js               # Supabase URL / anon key (환경에서 주입 or 직접 작성)
├── supabase/schema.sql     # 테이블/정책 DDL
├── vercel.json             # 정적 빌드 라우팅
├── .gitignore
├── .env.example
├── README.md
└── PRD.md
```

### 5.3 Env Vars (Vercel)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

빌드 시점에 `config.js`로 주입하거나, `index.html`의 `<meta>` 태그에 넣는 방식 중 **정적 사이트 특성상 `config.js`를 직접 커밋**하는 게 가장 단순함. anon key는 공개 전제이므로 노출 OK (RLS로 보호).

---

## 6. Data Model (SQL)

```sql
create table if not exists public.scores (
  id         bigserial primary key,
  nickname   text not null check (char_length(nickname) between 1 and 16),
  score      integer not null check (score >= 0),
  lines      integer not null default 0,
  level      integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists scores_score_desc on public.scores (score desc, created_at asc);

create table if not exists public.feedback (
  id         bigserial primary key,
  name       text not null default 'Anonymous' check (char_length(name) between 1 and 20),
  message    text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_desc on public.feedback (created_at desc);

alter table public.scores   enable row level security;
alter table public.feedback enable row level security;

create policy "anon can read scores"    on public.scores   for select to anon using (true);
create policy "anon can insert scores"  on public.scores   for insert to anon with check (true);

create policy "anon can read feedback"   on public.feedback for select to anon using (true);
create policy "anon can insert feedback" on public.feedback for insert to anon with check (true);
```

---

## 7. Milestones

1. **M1 — Repo & PRD** ✅ (이 문서)
2. **M2 — Playable Tetris**: 보드, 블록, 회전, 라인 삭제, 점수, 레벨, 게임오버 (오프라인).
3. **M3 — Audio**: BGM/SFX, 음소거.
4. **M4 — Supabase**: 스키마 적용, 점수 저장/리더보드, 피드백 작성/목록.
5. **M5 — Deploy**: Vercel 연결, 환경변수 설정, 라이브 URL 확보.

---

## 8. Acceptance Criteria

- [ ] 페이지 로딩 후 Start 버튼 한 번으로 게임이 시작된다.
- [ ] 7종 블록이 등장하며 SRS 회전·월킥이 정상 동작한다.
- [ ] 라인 1~4줄 삭제 시 올바른 점수가 가산된다.
- [ ] 레벨 상승에 따라 낙하 속도가 빨라진다.
- [ ] BGM이 재생되고 M키로 음소거 가능하다.
- [ ] 게임 오버 시 닉네임 입력 → Supabase `scores`에 레코드 insert.
- [ ] 리더보드 섹션에 Top 10이 보이고 새로고침 버튼으로 갱신된다.
- [ ] 피드백 폼으로 submit 시 `feedback`에 insert되고 하단 목록 최상단에 표시된다.
- [ ] Supabase 설정이 비어있어도 게임 자체는 플레이 가능하다.
- [ ] Vercel 배포본에서 모든 기능이 동작한다.

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Autoplay 정책으로 BGM이 안 재생됨 | 최초 사용자 입력(Start 클릭/키 입력) 시점에 AudioContext resume. |
| RLS 미설정으로 anon 쓰기 불가 | `schema.sql`에서 명시적으로 anon insert 정책 생성. |
| anon key 노출 우려 | anon key는 공개 전제. service_role key는 커밋 금지(.gitignore). |
| Supabase 무료 티어 한도 | 점수 저장은 수백 bytes/건, 피드백도 소량 — 문제 없음. |
| 피드백 스팸 | v1: 클라이언트 쿨다운 10초. 추후 PostgREST pre-request 함수로 rate limit. |

---

## 10. Out of Scope (Future Work)
- OAuth 로그인, 아바타.
- 홀드(Hold) 기능.
- 모바일 터치 컨트롤 (스와이프/버튼).
- WebSocket 기반 리더보드 실시간 push.
- 관리자용 피드백 신고/삭제.
