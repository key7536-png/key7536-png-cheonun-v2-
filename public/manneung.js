// 🧞 만능이 질문답변 창
// 고객을 고르고 질문만 넣으면 바로 답한다. 계산 자료(사주 원국·십성·대운·세운·신살, 자미두수 명반)는 앱 엔진이 만들고,
// 사주랩 1300줄 데이터를 붙여 넣으면 그 자료를 우선 근거로 쓴다. 답변 문장은 /api/ai(Gemini 프록시)로 만든다.
(function () {
  'use strict';
  var KEY = 'cheonun.clients.v1';
  var GPT_URL = 'https://chatgpt.com/g/g-693357ce305c8191b397c43d47f4af64-karaban-manneung-jilmundabbyeongi-1300jul-deiteo-ggog-neoheojuseyo';
  var LEN = { short: ['카카오톡으로 보낼 짧은 답변', '공백 포함 500~700자, 문단 3~4개'], mid: ['상담 답변', '공백 포함 1,300~1,800자, 문단 5~7개'], long: ['사주랩 추가답변(고객 발송용)', '공백 포함 3,500~4,500자, 문단 10~13개'] };
  var PRESETS = ['올해·내년 재물운과 돈이 들어오는 시기', '잘 맞는 직업·적성, 이직해도 될지', '연애·결혼운과 인연이 오는 시기', '재회 가능성과 다가가는 방법', '건강에서 조심할 부분', '다음 대운은 어떤지'];
  var lenKey = 'mid', history = [], lastCtx = null, sending = false;
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
    return { name: el('mName').value.trim() || '의뢰자', gender: el('mGender').value, calendar: el('mCalendar').value, birth: el('mBirth').value.trim().replace(/\./g, '-'), hour: el('mHour').value, isLeap: el('mLeap').checked };
  }

  // 앱 엔진으로 확정 자료 만들기
  function appFacts(p) {
    var lines = [];
    if (!p.birth) return '';
    var s = window.calcSaju(p.birth, p.hour, p.gender, p.calendar, p.isLeap);
    if (!s) return '';
    lines.push('[사주 확정 자료 — 앱 계산, 사주랩 만세력 기준과 같은 규칙]');
    lines.push('입력: ' + p.calendar + ' ' + p.birth + (p.isLeap ? ' 윤달' : '') + ' / 태어난 시간 ' + (p.hour || '모름') + (p.calendar === '음력' ? ' → 양력 ' + s.solarBirth : ''));
    lines.push(s.pillarsText + ' / 일간 ' + s.ilgan);
    lines.push('대운(세는나이): ' + s.daeunList.map(function (d) { return d.startAge + '~' + d.endAge + '세 ' + d.pillar; }).join(', '));
    lines.push('현재 ' + s.age + '세(세는나이), 현재 대운 ' + s.curDaeun + ' / ' + s.thisYear + '년 세운 ' + s.seun2026 + ' / ' + s.nextYear + '년 세운 ' + s.seun2027);
    if (window.CheonunDeepSaju) { try { lines.push(window.CheonunDeepSaju.analyze(s).text); } catch (e) {} }
    if (p.hour && window.CheonunZiwei) {
      try { lines.push('\n[자미두수 보조 자료]\n' + window.CheonunZiwei.toPrompt(window.CheonunZiwei.calculate({ birth: p.birth, hour: p.hour, gender: p.gender, calendar: p.calendar, isLeap: p.isLeap }))); } catch (e) {}
    }
    return lines.join('\n');
  }

  function buildPrompt(p, facts, labData, question, followup) {
    var L = LEN[lenKey], today = new Date();
    var conv = history.slice(-6).map(function (h) { return (h.role === 'user' ? '질문: ' : '이전 답변: ') + h.content; }).join('\n\n');
    return '당신은 여명당의 사주 상담가입니다. 아래 자료만 근거로, 고객 질문에 질문별로 정확하고 구체적으로 답하는 "만능 질문답변"을 씁니다.\n\n' +
      '━━━ 고객 ━━━\n이름 ' + p.name + ' / 성별 ' + p.gender + '\n오늘: ' + today.getFullYear() + '년 ' + (today.getMonth() + 1) + '월 ' + today.getDate() + '일\n\n' +
      (labData ? '━━━ 사주랩 원본 데이터 (가장 우선하는 근거) ━━━\n' + labData + '\n\n' : '') +
      (facts ? '━━━ 앱 계산 자료 ━━━\n' + facts + '\n\n' : '') +
      (conv ? '━━━ 지금까지 나눈 질문과 답변 ━━━\n' + conv + '\n\n' : '') +
      '━━━ ' + (followup ? '이어서 받은 질문' : '고객 질문') + ' ━━━\n' + question + '\n\n' +
      '━━━ 쓰는 방법 ━━━\n' +
      '• 용도: ' + L[0] + '. 분량: ' + L[1] + '. 같은 말 반복으로 분량을 채우지 말 것.\n' +
      '• ' + (followup ? '이전 답변과 겹치지 않게 새 질문에만 답할 것.' : '첫 문장은 "' + p.name + '님의 사주를 좀 더 세심히 살펴보았습니다."처럼 자연스럽게 시작하고 바로 본론으로 갈 것.') + '\n' +
      '• 질문이 여러 개면 하나도 빠뜨리지 말고 질문 순서대로 답할 것. 질문마다 결론을 먼저 말하고 근거(일간·십성·대운·세운·합충·신살·자미두수 궁과 별 중 자료에 있는 것)를 쉬운 말로 풀 것.\n' +
      '• 시기는 자료에 있는 대운·세운·월운 범위 안에서 "2027년 상반기", "○월쯤"처럼 구체적으로, 오늘 이후만 앞으로의 일로 말할 것.\n' +
      '• 자료에 없는 간지·십성·신살·대운·별을 지어내지 말 것. 사주 대운 나이와 자미두수 대한 나이는 계산 방식이 달라 다를 수 있으니 섞지 말 것.\n' +
      '• 좋은 점과 조심할 점을 솔직하게 말하되 겁주지 말고, 조심할 점에는 현실적인 대처를 붙일 것. "무조건", "반드시 일어난다" 같은 단정, 의료·법률·투자 단정 금지.\n' +
      '• 존댓말 서술형(~습니다 중심, ~지요·~거든요 조금). 마크다운 기호(**, #, 표, 글머리표), 한자, [말풍선] 같은 태그, "AI" 언급 금지. 전문용어는 바로 쉬운 말로 풀 것.\n' +
      '• 마지막 문단은 질문에 대한 핵심 정리와 지금 할 수 있는 행동 한 가지로 마무리할 것.';
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
