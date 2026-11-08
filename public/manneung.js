// 🧞 만능이 질문답변 창
// 고객을 고르고 질문만 넣으면 바로 답한다. 계산 자료(사주 원국·십성·대운·세운·신살, 자미두수 명반)는 앱 엔진이 만들고,
// 사주랩 1300줄 데이터를 붙여 넣으면 그 자료를 우선 근거로 쓴다. 답변 문장은 /api/ai(Gemini 프록시)로 만든다.
(function () {
  'use strict';
  var KEY = 'cheonun.clients.v1';
  // 사주랩 자료실 5번 '만능 질문답변기 gpts' 공식 주소 (2026-11-08 확인)
  var GPT_URL = 'https://chatgpt.com/g/g-693357ce305c8191b397c43d47f4af64-karaban-manneung-jilmundabbyeongi';
  // 실제 만능이 답변(2026-11-08 상상님 건, 5,931자·26문단) 패턴을 기준으로 한 분량
  var LEN = { short: ['카카오톡용 요약본', '공백 포함 900~1,300자, 문단 5~7개. 같은 순서를 짧게 줄이고 연도별 세운은 한 문단으로 묶을 것'], mid: ['상담 답변', '공백 포함 2,500~3,200자, 문단 12~16개'], long: ['만능이 기본(사주랩 추가답변·고객 발송용)', '공백 포함 4,500~6,000자, 문단 22~26개, 문단마다 170~300자'] };
  var KO = {'甲':'갑','乙':'을','丙':'병','丁':'정','戊':'무','己':'기','庚':'경','辛':'신','壬':'임','癸':'계','子':'자','丑':'축','寅':'인','卯':'묘','辰':'진','巳':'사','午':'오','未':'미','申':'신','酉':'유','戌':'술','亥':'해'};
  var WONJIN = ['자미','축오','인유','묘신','진해','사술'];
  var SAMJAE = { '신':'인묘진','자':'인묘진','진':'인묘진','해':'사오미','묘':'사오미','미':'사오미','인':'신유술','오':'신유술','술':'신유술','사':'해자축','유':'해자축','축':'해자축' };
  var JJ_MAIN = {자:'계',축:'기',인:'갑',묘:'을',진:'무',사:'병',오:'정',미:'기',신:'경',유:'신',술:'무',해:'임'};
  var EL_NAME = {'목':'나무','화':'불','토':'흙','금':'금','수':'물'};
  function yearGz(Y) { var e = window.Solar.fromYmdHms(Y, 6, 15, 12, 0, 0).getLunar().getEightChar().getYear(); return e.split('').map(function (c) { return KO[c] || c; }).join(''); }
  function gods(day, gz) { var D = window.CheonunDeepSaju; return D.tenGod(day, gz[0]) + '/' + D.tenGod(day, JJ_MAIN[gz[1]]); }
  function wonjin(a, b) { return WONJIN.indexOf(a + b) >= 0 || WONJIN.indexOf(b + a) >= 0; }
  var PRESETS = ['올해·내년 재물운과 돈이 들어오는 시기', '잘 맞는 직업·적성, 이직해도 될지', '연애·결혼운과 인연이 오는 시기', '재회 가능성과 다가가는 방법', '건강에서 조심할 부분', '다음 대운은 어떤지'];
  var lenKey = 'long', history = [], lastCtx = null, sending = false;
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function clients() { try { var r = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(r) ? r : []; } catch (e) { return []; } }

  function fillClients() {
    var list = clients();
    el('mClient').innerHTML = '<option value="">고객을 선택하세요 (또는 아래에 직접 입력)</option>' + list.map(function (r, i) {
      return '<option value="' + i + '">' + esc(r.name) + ' · ' + esc(r.birth || '생년월일 없음') + (r.calendar === '음력' ? ' 음력' : '') + '</option>';
    }).join('');
  }
  window.mnLoadClient = function () {
    var v = el('mClient').value; if (v === '') return;
    var r = clients()[Number(v)]; if (!r) return;
    el('mName').value = r.name || '';
    if (r.gender === '여성' || r.gender === '남성') el('mGender').value = r.gender;
    el('mCalendar').value = r.calendar || '양력';
    el('mBirth').value = r.birth || '';
    el('mHour').value = r.birthHour || '';
    el('mLeap').checked = !!r.leap;
    if (!el('mQuestion').value.trim() && r.question) el('mQuestion').value = r.question;
    el('mHint').textContent = r.name + '님 정보를 불러왔어요. 질문을 확인하고 답변 받기를 누르세요.';
    history = []; el('mResult').innerHTML = '';
  };

  function info() {
    return { name: el('mName').value.trim() || '의뢰자', gender: el('mGender').value, calendar: el('mCalendar').value, birth: el('mBirth').value.trim().replace(/\./g, '-'), hour: el('mHour').value, isLeap: el('mLeap').checked, withZiwei: !!(el('mZiwei') && el('mZiwei').checked) };
  }

  // 앱 엔진으로 확정 자료 만들기
  function appFacts(p) {
    var lines = [];
    if (!p.birth) return '';
    var s = window.calcSaju(p.birth, p.hour, p.gender, p.calendar, p.isLeap);
    if (!s) return '';
    var D = window.CheonunDeepSaju, day = s.dp[0];
    lines.push('[' + p.name + '님 확인용 정보 — 나이·대운·세운은 이 값과 똑같이 쓸 것]');
    lines.push('입력: ' + p.calendar + ' ' + p.birth + (p.isLeap ? ' 윤달' : '') + ' / 태어난 시간 ' + (p.hour || '모름(시주 없음)') + (p.calendar === '음력' ? ' → 양력 ' + s.solarBirth : ''));
    lines.push(s.pillarsText + ' / 일간 ' + s.ilgan);
    lines.push('- ' + s.thisYear + '년 나이: ' + s.age + '세(세는나이)');
    var cur = s.daeunList.find(function (d) { return d.pillar === s.curDaeun; });
    var nxt = cur ? s.daeunList[s.daeunList.indexOf(cur) + 1] : s.daeunList[0];
    if (cur) lines.push('- 현재 대운(10년간의 운세 흐름): ' + cur.startAge + '세부터 ' + cur.endAge + '세까지 ' + cur.pillar + ' 대운, ' + gods(day, cur.pillar) + (wonjin(cur.pillar[1], s.dp[1]) ? ', 일지와 원진' : ''));
    if (nxt) lines.push('- 다음 대운: ' + nxt.startAge + '세부터 ' + nxt.pillar + ' 대운, ' + gods(day, nxt.pillar) + ' (전환 시점은 ' + nxt.startYear + '년 전후, 실제 교운 월일은 미확인)' + (wonjin(nxt.pillar[1], s.dp[1]) ? ', 일지와 원진' : ''));
    lines.push('- 대운 전체(세는나이): ' + s.daeunList.map(function (d) { return d.startAge + '~' + d.endAge + '세 ' + d.pillar + '(' + gods(day, d.pillar) + ')'; }).join(', '));
    var se = [];
    for (var k = 0; k < 5; k++) {
      var Y = s.thisYear + k, gz = yearGz(Y), f = D.luckFacts(s, gz, Y + '년 세운');
      var wj = [['일지', s.dp[1]], ['월지', s.mp[1]], ['년지', s.yp[1]]].filter(function (x) { return wonjin(gz[1], x[1]); }).map(function (x) { return x[0] + ' ' + x[1] + '와 원진'; });
      se.push(Y + '년(' + (Y - s.year + 1) + '세) ' + gz + ' ' + f.stemGod + '/' + f.branchGod + (f.relations.length ? ' — ' + f.relations.join(', ') : '') + (wj.length ? ', ' + wj.join(', ') : '') + (f.sinsal.length ? ' / 신살: ' + f.sinsal.join(', ') : ''));
    }
    lines.push('- 세운: ' + se.join(' / '));
    var sj = SAMJAE[s.yp[1]], sjYears = [];
    for (var Y2 = s.thisYear - 2; Y2 <= s.thisYear + 12; Y2++) { if (sj.indexOf(yearGz(Y2)[1]) >= 0) sjYears.push(Y2); }
    var nowIn = sj.indexOf(s.seun2026[1]) >= 0;
    var nextBlock = sjYears.filter(function (y) { return y > s.thisYear; }).slice(0, 3);
    lines.push('- 삼재: ' + s.thisYear + '년 현재 ' + (nowIn ? '삼재에 해당(' + sjYears.filter(function (y) { return Math.abs(y - s.thisYear) <= 2; }).join('·') + '년)' : '해당 없음') + ', 다음 삼재 ' + (nextBlock.length ? nextBlock[0] + '년부터 ' + nextBlock[nextBlock.length - 1] + '년까지' : '없음') + ' (띠 기준 ' + s.yp[1] + ')');
    var wjIn = [];
    [['년지', s.yp[1]], ['월지', s.mp[1]], ['일지', s.dp[1]], ['시지', s.hp && s.hp !== '미상' ? s.hp[1] : '']].forEach(function (a, i, arr) { arr.slice(i + 1).forEach(function (b) { if (a[1] && b[1] && wonjin(a[1], b[1])) wjIn.push(a[0] + '-' + b[0] + ' 원진'); }); });
    if (wjIn.length) lines.push('- 원국 원진: ' + wjIn.join(', '));
    lines.push('[원국 상세]');
    try { lines.push(D.analyze(s).text); } catch (e) {}
    if (p.withZiwei && p.hour && window.CheonunZiwei) {
      try { lines.push('\n[자미두수 보조 자료]\n' + window.CheonunZiwei.toPrompt(window.CheonunZiwei.calculate({ birth: p.birth, hour: p.hour, gender: p.gender, calendar: p.calendar, isLeap: p.isLeap }))); } catch (e) {}
    }
    return lines.join('\n');
  }

  // 실제 카라반 만능이 답변(2026-11-08 상상님 건, 5,931자·26문단)의 순서와 문체를 그대로 따르도록 만든 지시문
  function buildPrompt(p, facts, labData, question, followup) {
    var L = LEN[lenKey], today = new Date(), n = p.name;
    var conv = history.slice(-6).map(function (h) { return (h.role === 'user' ? '질문: ' : '이전 답변: ') + h.content; }).join('\n\n');
    var order = followup
      ? '• 이전 답변과 겹치지 않게 새 질문에만 답한다. 첫 문장부터 질문의 결론을 말하고, 근거와 시기, 주의할 점, 마무리 순으로 같은 문체로 쓴다. 분량은 1,000~2,000자.\n'
      : '• 첫 문장은 반드시 "의뢰자님의 사주를 좀 더 세심히 살펴보았습니다."로 시작하고, 바로 이어 "' + n + '님께서 가장 궁금해하시는 (질문 주제)부터 말씀드리면,"으로 결론을 말한다.\n' +
        '• 문단 순서(질문에 맞게 비중만 조절하고 순서는 지킨다):\n' +
        '  1) 질문에 대한 결론과 핵심 성향.\n' +
        '  2) 중심 기운(일간)을 자연물에 비유해 성격을 푼다(예: 을목은 부드럽지만 생명력이 강한 풀이나 꽃). 월지가 더하는 성향까지.\n' +
        '  3~5) 질문과 관련된 십성 구조(식신·상관, 재성, 관성, 인성 등)를 하나씩 뜻을 풀고, 직업이나 상황에 맞는 구체적인 예(직종·방식)를 여러 개 든다. 귀인·신살은 있는 것만 한두 개.\n' +
        '  6) 맞지 않는 환경·방식과 그 이유.\n' +
        '  7~8) "' + n + '님 사주에서 아쉬운 부분도 솔직히 말씀드리겠습니다."로 시작해 오행 개수를 우리말로(나무 두 개, 불 세 개…) 말하고, 부족한 기운의 의미와 마음·인간관계에서 조심할 점.\n' +
        '  9~12) "이제 ' + n + '님께서 ~ 대운(10년간의 운세 흐름)을 살펴보겠습니다." 현재 나이와 현재 대운(몇 세부터 몇 세까지, 간지, 십성 두 개의 뜻), 원국과의 충·형·원진, 그 시기에 득이 된 점.\n' +
        '  13~16) 다음 대운: 몇 세부터, 전환 시점(연도 전후), 십성 두 개의 뜻, 기회와 부담, 원국과의 충·형. "반드시 ~는 아닙니다"로 단정을 피한다.\n' +
        '  17~21) 세운을 한 해에 한 문단씩 올해(' + today.getFullYear() + '년)부터 ' + (today.getFullYear() + 4) + '년까지 다섯 해 모두 쓴다(올해도 빼지 않는다): "' + (today.getFullYear() + 1) + '년은 (나이)세로 ○○년이며 (천간 십성)과 (지지 십성)이 들어옵니다." 형식, 그해 원국과의 충·형·원진과 현실적인 조언.\n' +
        '  22) 건강: 오행 균형을 생활 습관으로만 말하고 특정 질환은 확정할 수 없다고 밝힌다.\n' +
        '  23) 삼재: 올해 해당 여부와 다음 삼재 연도, "삼재라고 해서 반드시 사고나 손실이 생기는 것은 아니지만"으로 균형.\n' +
        '  24) 가장 큰 장점과 가장 주의해야 할 부분.\n' +
        '  25) "앞으로의 흐름을 종합하면"으로 지난 시기와 다음 시기를 비교.\n' +
        '  26) "' + n + '님께 가장 중요한 것은"으로 시작해 올해·내년·다음 대운 전후를 어떻게 보낼지 현실적으로 정리하고 "~중요한 부분이겠습니다."처럼 차분하게 끝낸다. 추가 질문 유도나 인사말은 넣지 않는다.\n';
    return '당신은 카라반 만능 질문답변기와 같은 방식으로 쓰는 사주 상담사입니다. 고객에게 보낼 보충 답변을 아래 규칙 그대로 씁니다.\n\n' +
      '━━━ 고객 질문 ━━━\n' + question + '\n\n' +
      (followup ? '' : '사주를 봤을때, 부족한 점이나, 좋은점 또 사주를 봤을때 객관적으로 안좋은 내용도 솔직하게 앞으로 주의해야 할 점 자세히 알려주세요.\n\n') +
      '━━━ 고객 ━━━\n이름 ' + n + ' / 성별 ' + p.gender + ' / 오늘 ' + today.getFullYear() + '년 ' + (today.getMonth() + 1) + '월 ' + today.getDate() + '일\n\n' +
      (facts ? facts + '\n\n' : '') +
      (labData ? '━━━ 사주랩 원본 데이터(1300줄) — 원국·용신·신살·형충회합은 이 자료를 우선 ━━━\n' + labData + '\n\n' : '') +
      (conv ? '━━━ 지금까지 나눈 질문과 답변 ━━━\n' + conv + '\n\n' : '') +
      '━━━ 작성 규칙 ━━━\n' + order +
      '• 분량: ' + L[1] + '. 같은 말을 반복하지 않는다.\n' +
      '• "올려주신", "업로드", "제공된", "데이터", "자료", "파일", "표", "기준으로 보면" 같은 자료 언급 표현은 쓰지 않는다. 상담사가 직접 사주를 살펴본 글처럼 쓴다.\n' +
      '• 고객이 물어본 내용에 가장 먼저, 가장 충분히 답한다. 질문이 여러 개면 하나도 빠뜨리지 않는다.\n' +
      '• 나이와 대운(10년간의 운세 흐름), 세운, 삼재는 위 확인용 정보와 똑같이 쓴다. 정보에 없는 간지·십성·신살을 지어내지 않는다. 시기는 오늘 이후만 앞으로의 일로 말한다.\n' +
      '• 제목·소제목·번호·글머리표·마크다운(**, #)·표 없이 빈 줄로만 문단을 나눈 서술형 글로 쓴다. 한자는 쓰지 않는다. 십성·신살·충 같은 용어는 그 문장 안에서 바로 뜻을 푼다.\n' +
      '• 문체는 차분하고 정중한 존댓말(~습니다, ~입니다)이며 호칭은 "' + n + '님". "~일 수 있습니다", "~로 이해하시면 됩니다", "반드시 ~는 아닙니다"처럼 가능성과 한계를 함께 말한다. 겁주는 표현, 단정, 의료·법률·투자 단정, "AI" 언급, 이모지는 쓰지 않는다.\n' +
      (p.withZiwei ? '• 자미두수는 성향을 더할 때 한두 문장만 보조로 쓰고, 사주 대운 나이와 자미두수 대한 나이를 섞지 않는다.\n' : '• 자미두수는 언급하지 않는다(사주로만 답한다).\n');
  }

  function callAi(prompt, maxTokens) {
    var ctrl = new AbortController(); var t = setTimeout(function () { ctrl.abort(); }, 120000);
    return fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt, maxTokens: maxTokens }), signal: ctrl.signal })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || '답변 요청 실패'); if (!d.text) throw new Error('빈 답변이 왔어요. 다시 눌러 주세요.'); return d.text; }); })
      .finally(function () { clearTimeout(t); });
  }
  function clean(t) { return String(t || '').replace(/\[말풍선\]/g, '').replace(/\*\*/g, '').replace(/^#+\s*/gm, '').trim(); }

  function render() {
    var html = '<div class="card"><div class="card-title" style="display:flex;justify-content:space-between;align-items:center">🧞 ' + esc(lastCtx ? lastCtx.name : '') + '님 만능이 답변<span><button class="btn ghost" style="padding:6px 12px;font-size:.78rem" onclick="mnSaveToClient()">고객 기록에 저장</button></span></div>';
    for (var i = 0; i < history.length; i++) {
      var h = history[i];
      if (h.role === 'user') html += '<div class="mn-q-bubble">❓ ' + esc(h.content) + '</div>';
      else html += '<div class="mn-answer" id="mAns' + i + '">' + esc(h.content) + '</div><div class="mn-meta"><span>' + h.content.length.toLocaleString() + '자</span><button class="btn ghost" style="padding:6px 12px;font-size:.78rem" onclick="mnCopy(' + i + ')">📋 복사</button></div>';
    }
    html += '<div class="field" style="margin-top:16px"><label>이어서 질문하기</label><textarea id="mFollow" placeholder="추가 질문을 입력하세요. (Ctrl+Enter 전송)"></textarea></div><button class="btn" id="mFollowBtn" onclick="mnFollow()">이어서 답변 받기</button></div>';
    el('mResult').innerHTML = html;
    var f = el('mFollow'); if (f) f.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); window.mnFollow(); } });
  }
  window.mnCopy = function (i) { navigator.clipboard.writeText(history[i].content).then(function () { el('mHint').textContent = '답변을 복사했어요.'; }); };

  function run(question, followup) {
    if (sending) return;
    var p = info();
    if (!question) { el('mError').textContent = '질문을 입력해 주세요.'; return; }
    var labData = el('mData').value.trim();
    var facts = '';
    try { facts = appFacts(p); } catch (e) { el('mError').textContent = '생년월일을 확인해 주세요: ' + e.message; return; }
    if (!facts && !labData) { el('mError').textContent = '고객 생년월일을 넣거나 사주랩 데이터를 붙여 넣어 주세요.'; return; }
    el('mError').textContent = ''; sending = true;
    var btn = followup ? el('mFollowBtn') : el('mGo'); var old = btn.textContent; btn.disabled = true; btn.textContent = '답변 쓰는 중… (30초~1분)';
    lastCtx = p;
    var prompt = buildPrompt(p, facts, labData, question, followup);
    callAi(prompt, lenKey === 'long' ? 16384 : 8192).then(function (text) {
      history.push({ role: 'user', content: question }); history.push({ role: 'assistant', content: clean(text) });
      render(); el('mResult').scrollIntoView({ behavior: 'smooth' });
    }).catch(function (e) { el('mError').textContent = e.name === 'AbortError' ? '응답이 늦어요. 다시 눌러 주세요.' : e.message; })
      .finally(function () { sending = false; btn.disabled = false; btn.textContent = old; });
  }
  window.mnAsk = function () { history = []; run(el('mQuestion').value.trim(), false); };
  window.mnFollow = function () { var f = el('mFollow'); run(f ? f.value.trim() : '', true); };

  window.mnSaveToClient = function () {
    var p = lastCtx; if (!p || !history.length) return;
    var list = clients(); var r = list.find(function (x) { return x.name === p.name && x.birth === p.birth; });
    var now = new Date().toISOString();
    if (!r) { r = { id: 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7), createdAt: now, name: p.name, gender: p.gender, calendar: p.calendar, birth: p.birth, birthHour: p.hour, leap: p.isLeap, status: '진행 중', contactMethod: '기타', duration: '50', topics: [], reason: history[0].content.slice(0, 120), consent: true }; list.push(r); }
    r.manneung = (r.manneung || []).concat([{ at: now, qa: history.slice() }]);
    r.memo = ((r.memo || '') + '\n[만능이 ' + now.slice(0, 10) + '] ' + history[0].content.slice(0, 60)).trim();
    r.updatedAt = now;
    localStorage.setItem(KEY, JSON.stringify(list));
    fillClients(); el('mHint').textContent = p.name + '님 고객 기록에 질문과 답변을 저장했어요.';
  };

  window.mnOpenGpt = function () {
    var p = info(), q = el('mQuestion').value.trim(), labData = el('mData').value.trim();
    var facts = ''; try { facts = appFacts(p); } catch (e) {}
    var text = (labData ? labData : facts) + '\n\n[고객 질문]\n' + (q || '(질문을 적어 주세요)') + '\n\n고객 이름: ' + p.name + ' / 성별: ' + p.gender;
    navigator.clipboard.writeText(text).then(function () {
      el('mHint').textContent = (labData ? '사주랩 데이터' : '앱 계산 자료') + '와 질문을 복사했어요. 열린 ChatGPT 만능이 입력칸에 Ctrl+V로 붙여 넣고 보내세요.';
    }).catch(function () { el('mHint').textContent = '복사가 막혔어요. 자료를 직접 복사해 주세요.'; });
    window.open(GPT_URL, '_blank');
  };

  document.addEventListener('DOMContentLoaded', function () {
    fillClients();
    el('mPresets').innerHTML = PRESETS.map(function (t) { return '<span class="mn-chip" data-q="' + esc(t) + '">+ ' + esc(t) + '</span>'; }).join('');
    el('mPresets').addEventListener('click', function (e) { var c = e.target.closest('[data-q]'); if (!c) return; var q = el('mQuestion'); q.value = (q.value.trim() ? q.value.trim() + '\n' : '') + c.dataset.q; q.focus(); });
    el('mLen').addEventListener('click', function (e) { var c = e.target.closest('[data-len]'); if (!c) return; lenKey = c.dataset.len; Array.prototype.forEach.call(el('mLen').children, function (x) { x.classList.toggle('on', x === c); }); });
    el('mQuestion').addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); window.mnAsk(); } });
    var qs = new URLSearchParams(location.search).get('client');
    if (qs) { var i = clients().findIndex(function (r) { return r.id === qs; }); if (i >= 0) { el('mClient').value = String(i); window.mnLoadClient(); } }
  });
})();
