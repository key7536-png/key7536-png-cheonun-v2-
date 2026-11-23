// ════════════════════════════════
// ⚡ 질문바로 탭 — 스레드·인스타 댓글/DM을 그대로 붙여넣으면
// 생년월일·성별·시간·질문을 뽑아서 사주+자미두수+타로를 한 번에 엮어 답변한다.
// 생년월일이 없으면 답변하지 않는다(기존 상담 원칙 유지) — 대신 생년월일 요청 문구를 만들어 준다.
// 파싱 함수는 브라우저/노드 공용(tests/quick-parse.test.js), UI 함수는 index.html의 전역 함수(calcSaju, ai 등)를 쓴다.
// ════════════════════════════════
(function (root) {
  'use strict';

  const BRANCH_HOURS = ['자시','축시','인시','묘시','진시','사시','오시','미시','신시','유시','술시','해시'];

  const TOPIC_RULES = [
    ['재회운 ⭐', /재회|헤어진|헤어졌|전남친|전여친|전애인|이별|다시\s*만나|다시\s*연락|돌아올/],
    ['궁합', /궁합|잘\s*맞/],
    ['결혼운/결혼시기', /결혼|시집|장가|배우자/],
    ['속마음 확인', /속마음|마음이\s*있|저를\s*어떻게|날\s*어떻게|좋아하는지|관심\s*있/],
    ['짝사랑/고백', /짝사랑|고백/],
    ['연애운', /연애|썸|남친|여친|남자친구|여자친구|인연|솔로|만남/],
    ['이직/취업', /이직|취업|취직|퇴사|면접/],
    ['합격운', /합격|시험|수능|공무원|자격증|입시/],
    ['재물/돈버는시기', /돈|재물|재테크|주식|코인|빚|대출|수입|금전/],
    ['직업/사업운', /사업|창업|가게|직장|직업|일이|승진/],
    ['건강운', /건강|아프|병원|수술/],
    ['이사시기', /이사|집\s*옮|매매|전세/],
    ['가족관계', /가족|부모|엄마|아빠|시댁|자식|아이|형제/],
  ];

  function pad2(n) { return String(n).padStart(2, '0'); }

  function expandYear(y, now) {
    if (y >= 100) return y;
    return y <= now.getFullYear() % 100 ? 2000 + y : 1900 + y;
  }

  function validDate(y, m, d, now) {
    if (y < 1900 || y > now.getFullYear() || m < 1 || m > 12 || d < 1 || d > 31) return false;
    const dt = new Date(y, m - 1, d);
    return dt.getMonth() === m - 1 && dt <= now;
  }

  // 텍스트에서 날짜를 등장 순서대로 모두 찾는다. 찾은 자리는 공백으로 지워 시간 파싱과 겹치지 않게 한다.
  function extractDates(text, now) {
    let masked = text;
    const found = [];
    const patterns = [
      /((?:19|20)?\d{2})\s*(?:년|[.\/\-])\s*(\d{1,2})\s*(?:월|[.\/\-])\s*(\d{1,2})\s*일?/g,
      /(?<!\d)((?:19|20)\d{2})(\d{2})(\d{2})(?!\d)/g,
      /(?<!\d)(\d{2})(\d{2})(\d{2})(?!\d)/g,
    ];
    for (const re of patterns) {
      masked = masked.replace(re, (all, ys, ms, ds, offset) => {
        const y = expandYear(Number(ys), now), m = Number(ms), d = Number(ds);
        if (!validDate(y, m, d, now)) return all;
        found.push({ index: offset, date: y + '-' + pad2(m) + '-' + pad2(d) });
        return ' '.repeat(all.length);
      });
    }
    found.sort((a, b) => a.index - b.index);
    return { dates: found.map(f => f.date), masked };
  }

  // 앱의 시 구분(자시 23:30~01:29 …)과 같은 경계로 변환
  function clockToBranch(h, m) {
    const t = h * 60 + (m || 0);
    return BRANCH_HOURS[Math.floor(((t + 30) % 1440) / 120)];
  }

  function extractHour(masked) {
    if (/시간\s*(?:은|는)?\s*(?:모름|몰라|모르)/.test(masked)) return { hour: '', note: '시간 모름' };
    const branch = masked.match(/(?<![가-힣])([자축인묘진사오미신유술해])시(?=$|[\s,.)~에생쯤경즈])/);
    if (branch) return { hour: branch[1] + '시', note: '' };

    const clock = masked.match(/(오전|오후|새벽|아침|낮|저녁|밤|am|pm)?\s*(\d{1,2})\s*(?:시(?!간)|:)\s*(?:(\d{1,2})\s*분?|(반))?/i);
    if (!clock) return { hour: '', note: '' };
    const period = (clock[1] || '').toLowerCase();
    let h = Number(clock[2]);
    const m = clock[4] ? 30 : Number(clock[3] || 0);
    if (h > 24 || m > 59) return { hour: '', note: '' };
    if (/오후|저녁|pm/.test(period) && h < 12) h += 12;
    else if (period === '밤') h = h === 12 ? 0 : (h < 5 ? h : h + 12);
    else if (/오전|새벽|아침|am/.test(period) && h === 12) h = 0;
    else if (period === '낮' && h < 7) h += 12;
    if (h === 24) h = 0;
    const note = !period && h >= 1 && h <= 11 ? '오전/오후 표기가 없어 ' + h + '시(오전)로 봤어요' : '';
    // 밤 23:30~23:59는 다음 날 일주로 보는 '밤 자시'(사주랩 만세력과 같은 기준)
    if (h * 60 + m >= 23 * 60 + 30) return { hour: '야자시', note: note || '밤 11시 30분 이후라 다음 날 일주(밤 자시)로 봤어요', clock: [h, m] };
    return { hour: clockToBranch(h, m), note, clock: [h, m] };
  }

  function extractGender(text) {
    // "남자친구/전남친" 같은 상대 호칭이 본인 성별로 잡히지 않게 먼저 지운다.
    const t = text.replace(/전?\s*(?:남자|여자)\s*친구|전?(?:남|여)친|남사친|여사친|남편|아내|와이프|남자\s*(?:쪽|분|가|를|한테|는|이)|여자\s*(?:쪽|분|가|를|한테|는|이)/g, ' ');
    if (/여자|여성|女|(?<![가-힣])여(?![가-힣])|(?<![가-힣])\d*\s*녀(?![가-힣])/.test(t)) return '여성';
    if (/남자|남성|男|(?<![가-힣])남(?![가-힣])/.test(t)) return '남성';
    return '';
  }

  function extractTopic(text) {
    for (const [topic, re] of TOPIC_RULES) if (re.test(text)) return topic;
    return '종합운';
  }

  function parseQuickText(text, now) {
    now = now || new Date();
    const src = String(text || '').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
    const { dates, masked } = extractDates(src, now);
    const hourInfo = extractHour(masked);
    // 서머타임(1948~51·1955~60·1987~88)·UTC+8:30(1954~61) 시기는 시계 시각과 시진 경계가 다르므로 출생일 기준으로 다시 맞춘다.
    if (hourInfo.clock && dates[0] && root.CheonunTime) {
      try {
        const dp = dates[0].split('-').map(Number);
        const r = root.CheonunTime.resolveBirthMoment(dp[0], dp[1], dp[2], pad2(hourInfo.clock[0]) + ':' + pad2(hourInfo.clock[1]));
        const sameDay = r.lmt.d === dp[2];
        const fixed = r.lateZi ? (sameDay ? '야자시' : '자시') : r.branch;
        if (fixed !== hourInfo.hour) { hourInfo.hour = fixed; hourInfo.note = (hourInfo.note ? hourInfo.note + ' · ' : '') + (r.note || '출생 당시 표준시 기준으로 시진을 맞췄어요'); }
      } catch (e) {}
    }
    const gender = extractGender(src);
    return {
      birth: dates[0] || '',
      partnerBirth: dates[1] || '',
      calendar: /음력/.test(src) && !/양력/.test(src) ? '음력' : '양력',
      isLeap: /윤달|윤\s*\d+\s*월/.test(src),
      gender: gender || '여성',
      genderGuessed: !gender,
      hour: hourInfo.hour,
      hourNote: hourInfo.note,
      topic: extractTopic(src),
      question: src.trim(),
    };
  }

  // ════════════════════════════════
  // ⚡ 3단계 순차 출력 — 선진님의 실제 당근/스레드 응대 순서를 그대로 옮긴다.
  //  1단계: 공감 + 사주 일간·대운 + 타로 3개월 정체/주의점 + 후기 유도 멘트 → 바로 1차 발송
  //  2단계: 타로 카드별 구체 흐름 + 마음가짐/조언 보충
  //  3단계: 후기를 받은 뒤 자미두수 명궁·부처궁 + 구체적 시기 + 배우자상 + 마무리 인사
  // 프롬프트 조립은 브라우저/노드 공용(tests/quick-stage.test.js).
  // ════════════════════════════════
  const QUICK_STAGE_SPREAD = ['현재 상황', '숨은 흐름', '3개월 안 결과'];

  const QUICK_STAGES = [
    { n: 1, title: '1단계 — 1차 발송 (후기 전)', maxTokens: 1600, target: '공백 포함 330~450자' },
    { n: 2, title: '2단계 — 타로 보충 (1차에 이어서)', maxTokens: 2400, target: '공백 포함 420~650자' },
    { n: 3, title: '3단계 — 후기 후 2차 결론', maxTokens: 3000, target: '공백 포함 550~900자' },
  ];

  const QUICK_STAGE_FIRST_CLOSING = '그러나 좋은 시기는 반드시 옵니다. 그게 언제일지 시기를 알고 싶으시죠? 후기를 남겨주시면 정확한 시기와 인연까지 알려드릴게요^^';
  const QUICK_STAGE_LAST_CLOSING = '좋은 기운을 전하게 되어 저 또한 기쁜 마음입니다. 늘 행복하세요^^';

  function buildQuickStagePrompts(ctx) {
    ctx = ctx || {};
    const name = (ctx.nick || '').trim();
    const call = name ? name + '님' : '님';
    const cards = ctx.cards || [];
    const cardLines = cards.map((c, i) => `${c.pos || QUICK_STAGE_SPREAD[i]}: ${c.label} — ${c.meaning || '일반 의미로 해석'}`).join('\n');
    const today = ctx.today instanceof Date ? ctx.today : new Date();
    const monthsAhead = [1, 2, 3].map(k => (today.getMonth() + k) % 12 + 1 + '월').join('·');
    const labelRule = name
      ? `호칭은 "${call}".`
      : '닉네임이 없으니 이름 호칭 없이 자연스럽게 쓸 것("님" 한 글자만 단독으로 쓰지 말 것).';

    const dataBlock = `━━━ 계산 완료된 자료 (임의 재계산·임의 별자리·임의 카드 금지) ━━━
성별: ${ctx.gender || '여성'} / 상담 주제: ${ctx.topic || '종합운'}
사주: ${ctx.pillarsText || ''} | 일간 ${ctx.ilgan || ''} | 현재 대운 ${ctx.curDaeun || ''}(${ctx.curDaeunAge || ''}세~) | 올해(${ctx.thisYear || today.getFullYear()}) 세운 ${ctx.seunThis || ''} / 내년(${ctx.nextYear || today.getFullYear() + 1}) 세운 ${ctx.seunNext || ''} | 현재 ${ctx.age || ''}세
${ctx.zPrompt ? ctx.zPrompt : '자미두수: 태어난 시간을 몰라 생략 — 자미두수 이야기는 하지 말 것.'}
${ctx.partnerBirth ? '상대방 생년월일(글에 적혀 있음): ' + ctx.partnerBirth : ''}
타로 3장(이번 질문으로 뽑은 카드, 라이더-웨이트 키워드):
${cardLines}`;

    const bodies = {
      1: `━━━ 이번에 쓸 것: 1단계 (지금 바로 1차 발송하는 글) ━━━
① 질문에 대한 공감 한 줄 — 고객이 쓴 말을 한 번 받아주며 시작
② 사주로 본 핵심 — 일간(日干)의 기질 한 줄 + 지금 대운의 흐름 1~2줄, "쉽게 말하면"으로 풀어서
③ 타로로 본 지금~가까운 3개월 — 뽑힌 카드 이름을 자연스럽게 언급하며, 지금 왜 답답하고 정체되어 있는지 + 무엇을 조심하면 되는지
④ 마지막 한 줄은 반드시 이 선진님 실제 멘트 흐름 그대로:
   "${QUICK_STAGE_FIRST_CLOSING}"

━━━ 1단계 절대 금지 ━━━
• 구체적인 시기(몇 월·몇 살·올해 말·내년 봄) 절대 금지 — 시기는 후기를 받은 뒤 3단계에서 말한다.
• 배우자·인연의 결론(만날지, 언제, 어떤 사람인지) 금지.
• 자미두수·명궁·부처궁 이야기 금지(3단계에서).
• "좋아질 겁니다"처럼 시기를 단정하는 말 금지 — 정체와 주의점까지만.
• 후기 유도 외의 다른 부탁(추가 결제·전화·오픈채팅) 금지.`,
      2: `━━━ 이번에 쓸 것: 2단계 (1차 답장에 이어 보내는 타로 보충) ━━━
① 뽑힌 카드 3장을 하나씩 — 각 카드가 지금 이 사람의 마음·상황에서 무엇을 보여주는지 (카드 이름 그대로)
② 세 장이 만드는 흐름 — 3개월 안에 마음이 어떻게 움직이는지, 지금 마음가짐에서 놓치고 있는 것 한 가지
③ 지금 바로 할 수 있는 구체적인 행동 1~2가지 (연락·정리·표현 방식 등 실제로 할 수 있는 것)
④ 마지막은 짧은 격려 한 줄

━━━ 2단계 절대 금지 ━━━
• 구체적인 시기(몇 월)와 배우자 결론은 아직 금지 — 3단계로 남긴다.
• 1단계에서 이미 쓴 문장을 그대로 반복하지 말 것(고객이 두 번 읽는다).
• 자미두수 해석 금지 — 여기서는 타로만.
• 후기 유도 멘트를 또 넣지 말 것.`,
      3: `━━━ 이번에 쓸 것: 3단계 (후기를 남긴 고객에게 보내는 2차 답장) ━━━
① 후기를 남겨준 데 대한 짧은 감사 한 줄
② 자미두수 — 명궁(命宮) 주성으로 타고난 성향·인연의 결을, 부처궁(夫妻宮)으로 배우자·인연의 모양을 짚기 (아래 자미두수 자료의 근거만 사용)
③ 구체적인 시기 — "○월쯤"처럼 몇 월인지 분명하게, 왜 그 달인지 대운·세운 흐름과 함께
④ 배우자상 / 상대의 특징 — 어떤 사람인지, 어디서 어떻게 만나게 되는지, 어떤 점을 조심하면 좋은지
⑤ 지금 할 일 한 가지
⑥ 마지막은 반드시 이 인사 그대로:
   "${QUICK_STAGE_LAST_CLOSING}"

━━━ 3단계 규칙 ━━━
• 자미두수 자료가 없으면(태어난 시간 모름) 자미두수·배우자 궁 이야기를 지어내지 말고 사주 대운·세운으로만 시기와 인연을 말할 것.
• 시기는 반드시 오늘 이후(${monthsAhead} 또는 그 뒤 1년 안)에서 말할 것.
• 1·2단계 문장을 반복하지 말고 이어 읽히게 쓸 것.
• 3단계만 읽어도 결론이 분명해야 한다.`,
    };

    return QUICK_STAGES.map(stage => {
      const n = stage.n;
      const prompt = `당신은 30년 경력 명리학·자미두수·타로 통합 상담사 천운입니다.
한 사람의 상담 답장을 3단계로 나눠 쓰고 있고, 이번에 쓸 것은 그중 ${n}단계 하나뿐입니다.
선진(상담사)이 이 글을 그대로 복사해서 고객에게 보냅니다. 1·2단계는 지금 고객이 바로 읽는 글이고, 3단계는 고객이 후기를 남긴 뒤에 보내는 2차 답장입니다.
이 단계 하나만 읽어도 자연스럽게 완결된 글이어야 하고, 앞 단계의 문장을 그대로 반복하지 마세요.

━━━ 질문 원문 ━━━
${ctx.question || ''}

${dataBlock}

${bodies[n]}

━━━ 공통 규칙 ━━━
• ${stage.target} 안에서 쓸 것. 문단은 4~7개, 문단마다 1~3문장, 문단 사이 빈 줄.
• 한자 절대 금지. [말풍선] 같은 태그·제목·번호·마크다운(**, #) 쓰지 말 것.
• 오늘은 ${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일. 시기는 반드시 오늘 이후로 말하고, 타로의 "가까운 3개월"은 ${monthsAhead}이다.
• ${labelRule}
• 공개된 글이 될 수 있으니 생년월일·나이·태어난 시간 같은 개인정보를 답변에 다시 적지 말 것.
• "~나타냅니다" "~의미합니다" "~시사합니다" "종합적으로" 같은 보고서 말투 금지. 밤하늘·파도·씨앗 같은 일반 비유 금지.
${ctx.honestRules || ''}`;
      return { n, title: stage.title, target: stage.target, maxTokens: stage.maxTokens, prompt };
    });
  }

  const api = { parseQuickText, clockToBranch, extractDates, buildQuickStagePrompts, QUICK_STAGES, QUICK_STAGE_SPREAD, QUICK_STAGE_FIRST_CLOSING, QUICK_STAGE_LAST_CLOSING };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CheonunQuick = api;
})(typeof window !== 'undefined' ? window : globalThis);


// ── 이하 브라우저 UI 전용 ──
if (typeof window !== 'undefined') {
  const QUICK_SPREAD = CheonunQuick.QUICK_STAGE_SPREAD;
  const Q3_KEY = 'cheonun_quick_3step';
  let quickFormat = 'thread';
  let quick3Step = true;   // 3단계 순차 출력 기본 ON
  let quickInfo = null;
  let quickStageCtx = null;
  let quickStagePrompts = null;

  function _q3Enabled() {
    // 스레드 댓글용(500자)은 한 번에 짧게 나가는 게 편하므로 3단계를 쓰지 않는다.
    return quick3Step && quickFormat !== 'thread';
  }

  function _syncQuick3StepUI() {
    const box = document.getElementById('q3Step');
    const note = document.getElementById('q3StepNote');
    if (box) box.disabled = quickFormat === 'thread';
    if (note) {
      note.style.display = quickFormat === 'thread' ? 'block' : 'none';
      note.textContent = '🧵 스레드 댓글 모드는 500자 안으로 한 번에 나갑니다 — 3단계는 인스타·당근(DM) 모드에서 씁니다.';
    }
  }

  window.setQuick3Step = function (on) {
    quick3Step = !!on;
    try { localStorage.setItem(Q3_KEY, quick3Step ? '1' : '0'); } catch (e) {}
  };

  // 저장된 설정 복원 (스크립트는 본문 끝에서 불리므로 입력칸이 이미 있다)
  try {
    const saved = localStorage.getItem(Q3_KEY);
    if (saved === '0') quick3Step = false;
  } catch (e) {}
  (function _initQuick3StepUI() {
    const box = document.getElementById('q3Step');
    if (box) box.checked = quick3Step;
    _syncQuick3StepUI();
  })();

  function _qEsc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  window.setQuickFormat = function (el, fmt) {
    quickFormat = fmt;
    document.querySelectorAll('#quickFormatChips .sp-btn').forEach(b => b.classList.remove('on'));
    el.classList.add('on');
    _syncQuick3StepUI();
  };

  // 정규식으로 생년월일을 못 찾았을 때만 AI에게 추출을 맡긴다(예: "구오년 삼월 십이일").
  async function _aiExtract(text) {
    const prompt = `아래는 SNS 댓글/DM입니다. 글쓴이 본인의 생년월일 정보를 JSON 한 줄로만 추출하세요. 설명 금지.
형식: {"birth":"YYYY-MM-DD 또는 빈문자열","calendar":"양력|음력","gender":"여성|남성|","hour":"자시~해시 중 하나 또는 빈문자열"}
글에 생년월일(연·월·일 모두)이 명확히 없으면 birth는 반드시 빈 문자열. 추측 금지.

글: ${text}`;
    try {
      const raw = await ai(prompt, 512);
      const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(json.birth || '')) return null;
      return json;
    } catch (e) { return null; }
  }

  function _drawQuickCards() {
    const shuffled = shuffleDeck(TAROT_78);
    return shuffled.slice(0, 3).map(c => _rand() < 0.5 ? c + '(역방향)' : c);
  }

  function _renderQuickInfo(info) {
    const hourOpts = ['', '야자시', '자시','축시','인시','묘시','진시','사시','오시','미시','신시','유시','술시','해시']
      .map(h => `<option value="${h}"${h === info.hour ? ' selected' : ''}>${h === '야자시' ? '밤 자시(23:30~)' : (h || '모름')}</option>`).join('');
    const topics = ['재회운 ⭐','연애운','속마음 확인','짝사랑/고백','결혼운/결혼시기','궁합','재물/돈버는시기','직업/사업운','이직/취업','건강운','가족관계','이사시기','합격운','종합운']
      .map(t => `<option${t === info.topic ? ' selected' : ''}>${t}</option>`).join('');
    const notes = [];
    if (info.genderGuessed) notes.push('성별이 글에 없어 여성으로 뒀어요');
    if (info.hourNote) notes.push(info.hourNote);
    if (info.fromAI) notes.push('생년월일을 AI가 읽어냈어요 — 꼭 확인');
    document.getElementById('quickInfo').innerHTML = `
      <div class="card">
        <div class="card-title">🔎 읽어낸 정보 (틀리면 고치고 다시 답변)</div>
        ${notes.length ? `<p style="font-size:.74rem;color:var(--gold2);margin-bottom:10px">⚠️ ${notes.map(_qEsc).join(' · ')}</p>` : ''}
        <div class="row2">
          <div class="field"><label>생년월일</label><input id="qBirth" type="date" value="${info.birth}"></div>
          <div class="field"><label>양/음력</label><select id="qLunar"><option${info.calendar === '양력' ? ' selected' : ''}>양력</option><option${info.calendar === '음력' ? ' selected' : ''}>음력</option></select></div>
        </div>
        <div class="row2">
          <div class="field"><label>성별</label><select id="qGender"><option${info.gender === '여성' ? ' selected' : ''}>여성</option><option${info.gender === '남성' ? ' selected' : ''}>남성</option></select></div>
          <div class="field"><label>태어난 시간</label><select id="qHour">${hourOpts}</select></div>
        </div>
        <div class="field"><label>주제</label><select id="qTopic">${topics}</select></div>
        <label style="display:flex;align-items:center;gap:6px;color:var(--muted);font-size:.75rem;margin-bottom:10px"><input id="qLeap" type="checkbox" style="width:auto"${info.isLeap ? ' checked' : ''}> 음력 윤달</label>
        ${info.partnerBirth ? `<p style="font-size:.74rem;color:var(--purple2);margin-bottom:10px">💜 상대방 생년월일도 보여요: ${info.partnerBirth}</p>` : ''}
        <div style="display:flex;gap:7px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="quickRegenerate()">🔄 이 정보로 다시 답변 (카드 새로 뽑기)</button>
          <button class="btn btn-ghost btn-sm" onclick="quickToConsulting()">📜 상담 탭에서 자세히 보기</button>
        </div>
      </div>`;
  }

  function _readQuickForm() {
    return Object.assign({}, quickInfo, {
      birth: document.getElementById('qBirth').value,
      calendar: document.getElementById('qLunar').value,
      gender: document.getElementById('qGender').value,
      hour: document.getElementById('qHour').value,
      topic: document.getElementById('qTopic').value,
      isLeap: document.getElementById('qLeap').checked,
    });
  }

  function _buildQuickPrompt(info, saju, zPrompt, cards, nick) {
    const name = nick || '';
    const call = name ? name + '님' : '님';
    const cardLines = cards.map((c, i) => `${QUICK_SPREAD[i]}: ${c} — ${_tarotMeaningFor(c) || '일반 의미로 해석'}`).join('\n');
    const thread = quickFormat === 'thread';
    const today = new Date();
    const monthsAhead = [1, 2, 3].map(k => (today.getMonth() + k) % 12 + 1 + '월').join('·');
    const lengthRule = thread
      ? '• 전체 공백 포함 400~450자. 절대 480자 넘기지 말 것(스레드 댓글 500자 제한).\n• 4~6개의 짧은 문단, 문단마다 1~2문장, 문단 사이 빈 줄.'
      : '• 전체 공백 포함 900~1300자. 6~8개의 문단, 문단마다 2~3문장, 문단 사이 빈 줄.';

    return `당신은 30년 경력 명리학·자미두수·타로 통합 상담사 천운입니다.
${thread ? '스레드(Threads)' : '인스타그램 DM'}에 올라온 아래 질문에 바로 답글을 답니다.
사주(타고난 흐름)·자미두수(타고난 기질)·타로(가까운 3개월)를 한 답변 안에 자연스럽게 엮어서, 질문에 대한 결론을 분명히 주세요.

━━━ 질문 원문 ━━━
${info.question}

━━━ 계산 완료된 자료 (임의 재계산·임의 별자리·임의 카드 금지) ━━━
성별: ${info.gender} / 상담 주제: ${info.topic}
사주: ${saju.pillarsText} | 일간 ${saju.ilgan} | 현재 대운 ${saju.curDaeun}(${saju.curDaeunAge}세~) | 올해(${saju.thisYear}) 세운 ${saju.seun2026} / 내년(${saju.nextYear}) 세운 ${saju.seun2027} | 현재 ${saju.age}세
${zPrompt ? zPrompt : '자미두수: 태어난 시간을 몰라 생략 — 자미두수 이야기는 하지 말 것.'}
${info.partnerBirth ? '상대방 생년월일(글에 적혀 있음): ' + info.partnerBirth : ''}
타로 3장(이번 질문으로 뽑은 카드, 라이더-웨이트 키워드):
${cardLines}

━━━ 답변 구성 ━━━
1) 질문에 대한 짧은 공감 한 줄
2) 사주로 본 핵심 — 일간·대운·세운 중 하나를 짚고 바로 쉬운 말로 풀기
${zPrompt ? '3) 자미두수로 본 타고난 성향 한 줄 (명궁 주성 근거)\n4)' : '3)'} 타로로 본 가까운 3개월 흐름 — 카드 이름을 자연스럽게 언급
${zPrompt ? '5)' : '4)'} 결론 + 구체적인 시기("○월쯤") + 지금 할 일 한 가지
마지막) 따뜻한 한 줄 응원

━━━ 규칙 ━━━
${lengthRule}
• 오늘은 ${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일. 시기는 반드시 오늘 이후로 말하고, 타로의 "가까운 3개월"은 ${monthsAhead}이다. 이미 지난 달을 앞으로 올 시기처럼 말하지 말 것.
• ${name ? `호칭은 "${call}".` : '닉네임이 없으니 이름 호칭 없이 자연스럽게 쓸 것("님" 한 글자만 단독으로 쓰지 말 것).'} 한자 절대 금지. [말풍선] 같은 태그·제목·번호·마크다운(**, #) 쓰지 말 것.
• 공개 댓글이 될 수 있으니 생년월일·나이·태어난 시간 같은 개인정보를 답변에 다시 적지 말 것.
• 전문용어는 한 문단에 1개까지만, 쓰면 바로 "쉽게 말하면~"으로 풀 것.
• "~나타냅니다" "~의미합니다" "~시사합니다" "종합적으로" 같은 보고서 말투 금지. 밤하늘·파도·씨앗 같은 일반 비유 금지.
• 사주와 타로가 서로 다르게 나오면 숨기지 말고 "타고난 흐름은 ~인데 가까운 3개월은 ~" 식으로 둘 다 말할 것.
${HONEST_STYLE_RULES}`;
  }

  function _stageShell(stage) {
    return `<div class="card qstage" id="qStage${stage.n}" style="border-color:${stage.n === 1 ? 'var(--gold)' : 'var(--border)'}">
      <div class="card-title">${stage.n === 1 ? '✦' : '·'} ${_qEsc(stage.title)}</div>
      <div class="qstage-body">
        <div class="loading" style="padding:14px"><div class="dot-spin"><span></span><span></span><span></span></div>${stage.n === 1 ? '1단계 먼저 쓰는 중...' : stage.n + '단계 대기 중 — 앞 단계가 끝나면 바로 이어서 씁니다'}</div>
      </div>
    </div>`;
  }

  function _stageLoading(n) {
    return `<div class="loading" style="padding:14px"><div class="dot-spin"><span></span><span></span><span></span></div>${n}단계 쓰는 중...</div>`;
  }

  window.copyQuickStage = function (btn) {
    const card = btn.closest('.qstage');
    const el = card && card.querySelector('.why-bub');
    if (!el) return;
    navigator.clipboard.writeText(el.innerText).then(() => snack('복사됨 ✓'));
  };

  window.retryQuickStage = async function (btn, n) {
    if (!quickStageCtx || !quickStagePrompts) return;
    const stage = quickStagePrompts[Number(n) - 1];
    const card = document.getElementById('qStage' + n);
    if (!stage || !card) return;
    btn.disabled = true;
    const body = card.querySelector('.qstage-body');
    body.innerHTML = _stageLoading(stage.n);
    await _fillQuickStage(stage, body);
  };

  // 1단계가 끝나는 즉시 첫 번째 카드로 보여 주고, 나머지는 이어서 채운다.
  async function _runQuickStages(info, saju, zPrompt, cards, nick, out) {
    const promptCtx = {
      question: info.question,
      gender: info.gender,
      topic: info.topic,
      age: saju.age,
      thisYear: saju.thisYear,
      nextYear: saju.nextYear,
      pillarsText: saju.pillarsText,
      ilgan: saju.ilgan,
      curDaeun: saju.curDaeun,
      curDaeunAge: saju.curDaeunAge,
      seunThis: saju.seun2026,
      seunNext: saju.seun2027,
      zPrompt,
      partnerBirth: info.partnerBirth,
      nick,
      cards: cards.map((c, i) => ({ pos: QUICK_SPREAD[i], label: c, meaning: _tarotMeaningFor(c) })),
      honestRules: HONEST_STYLE_RULES,
      today: new Date(),
    };
    const stages = CheonunQuick.buildQuickStagePrompts(promptCtx);
    quickStageCtx = promptCtx;
    quickStagePrompts = stages;
    out.innerHTML = `
      <div class="card" style="padding:11px 14px">
        <div style="font-size:.72rem;color:var(--muted);line-height:1.7">
          사주 ${_qEsc(saju.pillarsText)}${zPrompt ? ' · 자미두수 포함' : ' · 자미두수 생략(시간 모름)'}<br>
          타로 ${cards.map((c, i) => QUICK_SPREAD[i] + ' ' + _qEsc(c)).join(' / ')}
        </div>
      </div>` + stages.map(_stageShell).join('');

    for (const stage of stages) {
      const body = document.querySelector('#qStage' + stage.n + ' .qstage-body');
      if (!body) continue;
      if (stage.n > 1) body.innerHTML = _stageLoading(stage.n);
      await _fillQuickStage(stage, body);
    }
  }

  async function _fillQuickStage(stage, body) {
    const t0 = Date.now();
    try {
      const raw = await ai(stage.prompt, stage.maxTokens);
      const answer = raw.replace(/\[말풍선\]/g, '').replace(/\*\*/g, '').trim();
      const sec = ((Date.now() - t0) / 1000).toFixed(1);
      body.innerHTML = `
        <div class="why-bub" style="white-space:pre-wrap;line-height:1.75;font-size:.85rem">${_qEsc(answer)}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px">
          <span style="font-size:.72rem;color:var(--muted)">${answer.length}자 · ${sec}초</span>
          <button class="copy-all-btn" style="width:auto;margin:0;padding:8px 14px" onclick="copyQuickStage(this)">📋 복사</button>
        </div>`;
    } catch (e) {
      body.innerHTML = `<div style="color:var(--red);font-size:.8rem;line-height:1.7">${stage.n}단계 오류: ${_qEsc(e.message)}</div>
        <button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="retryQuickStage(this,${stage.n})">🔄 ${stage.n}단계만 다시</button>`;
    }
  }

  async function _runQuick(info) {
    const nick = document.getElementById('qNick').value.trim();
    const btn = document.getElementById('quickBtn');
    const out = document.getElementById('quickResult');
    btn.disabled = true; btn.textContent = '사주·자미두수·타로 보는 중...';
    out.innerHTML = `<div class="card"><div class="loading"><div class="dot-spin"><span></span><span></span><span></span></div>천운이 답변을 쓰는 중입니다...</div></div>`;
    try {
      const saju = calcSaju(info.birth, info.hour, info.gender, info.calendar, info.isLeap);
      if (!saju) throw new Error('생년월일을 계산할 수 없어요. 날짜를 확인해 주세요.');
      let zPrompt = '';
      if (info.hour && window.CheonunZiwei) {
        try { zPrompt = CheonunZiwei.toPrompt(CheonunZiwei.calculate(info)); }
        catch (e) { console.warn('자미두수 계산 실패:', e.message); }
      }
      const cards = _drawQuickCards();

      if (_q3Enabled()) {
        btn.textContent = '1단계부터 순서대로 쓰는 중...';
        await _runQuickStages(info, saju, zPrompt, cards, nick, out);
        btn.disabled = false; btn.textContent = '⚡ 바로 답변 받기';
        return;
      }

      const raw = await ai(_buildQuickPrompt(info, saju, zPrompt, cards, nick), quickFormat === 'thread' ? 4096 : 8192);
      const answer = raw.replace(/\[말풍선\]/g, '').replace(/\*\*/g, '').trim();
      const len = answer.length;
      const over = quickFormat === 'thread' && len > 500;
      out.innerHTML = `
        <div class="card">
          <div class="card-title">✦ 바로 답변 ${quickFormat === 'thread' ? '(스레드 댓글용)' : '(인스타·당근 DM용)'}</div>
          <div style="font-size:.72rem;color:var(--muted);margin-bottom:10px;line-height:1.7">
            사주 ${_qEsc(saju.pillarsText)}${zPrompt ? ' · 자미두수 포함' : ' · 자미두수 생략(시간 모름)'}<br>
            타로 ${cards.map((c, i) => QUICK_SPREAD[i] + ' ' + _qEsc(c)).join(' / ')}
          </div>
          <div class="why-bub" id="quickAnswer" style="white-space:pre-wrap;line-height:1.75;font-size:.85rem">${_qEsc(answer)}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px">
            <span style="font-size:.72rem;color:${over ? 'var(--red)' : 'var(--muted)'}">${len}자${over ? ' — 스레드 500자 초과, 다시 답변을 눌러 주세요' : ''}</span>
            <button class="copy-all-btn" style="width:auto;margin:0;padding:8px 14px" onclick="navigator.clipboard.writeText(document.getElementById('quickAnswer').innerText).then(()=>snack('복사됨 ✓'))">📋 답변 복사</button>
          </div>
        </div>`;
    } catch (e) {
      out.innerHTML = `<div class="card" style="color:var(--red)">오류: ${_qEsc(e.message)}</div>`;
    }
    btn.disabled = false; btn.textContent = '⚡ 바로 답변 받기';
  }

  function _showNeedBirth() {
    document.getElementById('quickInfo').innerHTML = '';
    const ask = '생년월일(양력/음력)이랑 태어난 시간 알려주시면 사주·자미두수·타로로 같이 봐드릴게요! 시간은 모르시면 생년월일만 주셔도 괜찮아요 🙂';
    document.getElementById('quickResult').innerHTML = `
      <div class="card">
        <div class="card-title">📅 생년월일이 없어서 답변하지 않았어요</div>
        <p style="font-size:.78rem;color:var(--muted);margin-bottom:10px;line-height:1.7">글 안에서 연·월·일을 모두 찾지 못했어요. 아래 문구로 생년월일을 먼저 받아 주세요.</p>
        <div class="why-bub" id="quickAsk" style="font-size:.84rem;line-height:1.7">${ask}</div>
        <button class="copy-all-btn" onclick="navigator.clipboard.writeText(document.getElementById('quickAsk').innerText).then(()=>snack('복사됨 ✓'))">📋 요청 문구 복사</button>
      </div>`;
  }

  window.quickAnswer = async function () {
    const text = document.getElementById('quickText').value.trim();
    if (!text) { snack('댓글이나 DM 내용을 붙여넣어 주세요.'); return; }
    const info = CheonunQuick.parseQuickText(text);
    if (!info.birth) {
      const btn = document.getElementById('quickBtn');
      btn.disabled = true; btn.textContent = '생년월일 찾는 중...';
      const ex = await _aiExtract(text);
      btn.disabled = false; btn.textContent = '⚡ 바로 답변 받기';
      if (!ex) { quickInfo = null; _showNeedBirth(); return; }
      info.birth = ex.birth;
      info.fromAI = true;
      if (ex.calendar === '음력') info.calendar = '음력';
      if (ex.gender === '여성' || ex.gender === '남성') { info.gender = ex.gender; info.genderGuessed = false; }
      if (!info.hour && /^[자축인묘진사오미신유술해]시$/.test(ex.hour || '')) info.hour = ex.hour;
    }
    quickInfo = info;
    _renderQuickInfo(info);
    await _runQuick(info);
  };

  window.quickRegenerate = async function () {
    if (!quickInfo) return;
    const info = _readQuickForm();
    if (!info.birth) { snack('생년월일을 입력해주세요.'); return; }
    quickInfo = info;
    await _runQuick(info);
  };

  // 더 길게 상담해야 할 때 — 읽어낸 정보를 상담 탭 입력칸에 채워 넘긴다.
  window.quickToConsulting = function () {
    const info = _readQuickForm();
    document.getElementById('cName').value = document.getElementById('qNick').value.trim();
    document.getElementById('cGender').value = info.gender;
    document.getElementById('cLunar').value = info.calendar;
    document.getElementById('cLeap').checked = info.isLeap;
    toggleSajuLeap();
    document.getElementById('cBirth').value = info.birth;
    document.getElementById('cHour').value = info.hour;
    document.getElementById('cTopic').value = info.topic;
    document.getElementById('cQ').value = info.question;
    go('consulting');
    window.scrollTo(0, 0);
    snack('상담 탭에 정보를 채웠어요 ✓');
  };
}
