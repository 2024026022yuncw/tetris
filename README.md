# Supabase Tetris

웹 기반 테트리스. 점수는 Supabase에 저장되고, 사용자는 피드백을 남길 수 있습니다. BGM과 효과음은 Web Audio API로 합성됩니다.

- Repo: https://github.com/2024026022yuncw/tetris
- Deployment: Vercel (정적 사이트)
- Backend: Supabase (Postgres + REST)

요구사항·설계는 [`PRD.md`](./PRD.md) 참고.

---

## Quick start (local)

1. 저장소를 받습니다.
   ```bash
   git clone https://github.com/2024026022yuncw/tetris.git
   cd tetris
   ```
2. Supabase 프로젝트를 만들고 [`supabase/schema.sql`](./supabase/schema.sql)을 SQL Editor에서 실행합니다.
3. [`config.js`](./config.js) 에 프로젝트 URL과 anon key를 넣습니다.
   ```js
   export const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
   export const SUPABASE_ANON_KEY = "ey...your-anon-key...";
   ```
4. 아무 정적 서버로 실행합니다. 예:
   ```bash
   # Python
   python -m http.server 5173
   # 또는 Node
   npx serve .
   ```
5. 브라우저로 `http://localhost:5173` 접속.

> ⚠️ `file://` 로는 ES 모듈 import가 제한됩니다. 반드시 HTTP 서버로 열어주세요.

---

## Deploy to Vercel

1. 이 저장소를 GitHub에 푸시합니다.
2. [vercel.com](https://vercel.com) 에서 **New Project → Import** 로 저장소를 연결합니다.
3. 빌드 설정은 그대로 두면 됩니다 (정적 사이트 자동 감지).
4. `config.js` 값은 **코드에 포함된 상태로 커밋**되어 있으므로 Vercel 환경변수 설정은 필요 없습니다.
   - Supabase anon key는 공개가 전제이며, 데이터 접근은 Row-Level Security (RLS) 로 제어합니다.
5. Deploy 완료 후 할당된 URL로 접속.

---

## Supabase schema

[`supabase/schema.sql`](./supabase/schema.sql) 전체를 Supabase SQL Editor 에 붙여넣어 실행하세요. 테이블 2개와 anon 정책이 생성됩니다.

- `scores(nickname, score, lines, level, created_at)` — Top 10 리더보드
- `feedback(name, message, created_at)` — 사용자 피드백

RLS 는 활성화된 상태로, `anon` 역할이 **SELECT / INSERT** 만 가능합니다 (UPDATE / DELETE 불가).

---

## Controls

| Key | Action |
|-----|--------|
| ← → | Move |
| ↓ | Soft drop |
| ↑ / X | Rotate clockwise |
| Z | Rotate counter-clockwise |
| Space | Hard drop |
| P | Pause / Resume |
| M | Mute / Unmute |
| Enter | Start |
| R | Restart (after game over) |

---

## Project structure

```
.
├── index.html
├── styles.css
├── config.js                # Supabase URL / anon key (fill in before deploy)
├── js/
│   ├── main.js              # UI bindings
│   ├── tetris.js            # Game engine (SRS, 7-bag, scoring)
│   ├── audio.js             # BGM + SFX synthesis (Web Audio API)
│   └── supabase.js          # scores + feedback API wrapper
├── supabase/
│   └── schema.sql
├── vercel.json
├── PRD.md
└── README.md
```

---

## Notes

- 고스트/그림자 블록은 **의도적으로 제거**되어 있습니다. (요구사항)
- Supabase 설정이 비어 있어도 게임은 플레이 가능합니다. 리더보드/피드백 영역만 비활성화됩니다.
- BGM은 외부 오디오 파일을 사용하지 않고 Web Audio API로 합성합니다 (저작권 안전, 배포 용량 최소화).
