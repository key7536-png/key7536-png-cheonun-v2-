// ════════════════════════════════
// 내담자 자동 저장 공용 로직 — 상담 탭 · ⚡질문바로 탭 · 📁고객관리 화면
// 고객 정보를 입력하고 상담을 시작하는 순간, 또는 질문바로 답변을 만드는 순간
// 같은 고객이 이미 있으면 새로 만들지 않고 그 기록만 갱신한다(중복 방지).
// 브라우저/노드 공용 (tests/auto-save-client.test.js) — 서버로 보내는 코드는 없다.
// ════════════════════════════════
(function (root) {
  'use strict';

  const CONSULT_KEY = 'cheonun_clients_v1';        // 상담 탭 내담자 목록 (Supabase cheonun_clients 캐시)
  const MANAGED_KEY = 'cheonun.clients.v1';        // 고객관리 화면(clients.html) 기록
  const CONSULT_LIMIT = 50;                        // 상담 탭 목록 최대 개수 (기존 saveClient와 동일)

  // 상담 탭 주제 → 고객관리 화면의 상담 주제 체크박스 값
  const TOPIC_MAP = {
    '직업/사업운': '직업/사업', '이직/취업': '직업/사업', '직업/사업': '직업/사업',
    '재물/돈버는시기': '재물', '재물': '재물',
    '연애운': '연애/결혼', '재회운 ⭐': '연애/결혼', '재회운': '연애/결혼',
    '속마음 확인': '연애/결혼', '짝사랑/고백': '연애/결혼', '결혼운/결혼시기': '연애/결혼',
    '궁합': '연애/결혼', '연애/결혼': '연애/결혼',
    '가족관계': '가족', '가족': '가족',
    '인간관계': '인간관계',
    '이사시기': '이동/변화', '이동/변화': '이동/변화',
    '건강운': '종합운', '합격운': '종합운', '종합운': '종합운',
  };

  function mapTopic(topic) {
    const t = String(topic == null ? '' : topic).trim();
    return TOPIC_MAP[t] || '종합운';
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function dateYmd(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  // 생년월일이 있으면 95.03.12, 없으면 오늘 날짜
  function birthLabel(birth, now) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birth == null ? '' : birth).trim());
    if (m) return m[1].slice(2) + '.' + m[2] + '.' + m[3];
    return dateYmd(now || new Date()).slice(2).replace(/-/g, '.');
  }

  function defaultName(prefix, birth, now) {
    return (prefix || '상담 고객') + ' (' + birthLabel(birth, now) + ')';
  }

  // 이름이 비어 있으면 "질문바로 고객 (95.03.12)"처럼 알아보기 쉬운 이름을 붙인다.
  function buildRecord(input, opts) {
    input = input || {};
    opts = opts || {};
    const now = opts.now instanceof Date ? opts.now : new Date();
    const birth = String(input.birth == null ? '' : input.birth).trim();
    const name = String(input.name == null ? '' : input.name).trim() || defaultName(opts.defaultName, birth, now);
    const topic = String(input.topic == null ? '' : input.topic).trim() || '종합운';
    return {
      name: name,
      birth: birth,
      hour: String(input.hour == null ? '' : input.hour).trim(),
      gender: String(input.gender == null ? '' : input.gender).trim(),
      calendar: input.calendar === '음력' ? '음력' : '양력',
      leap: !!input.leap,
      topic: topic,
      question: String(input.question == null ? '' : input.question).trim(),
      source: opts.source || 'consult',
      savedAt: dateYmd(now),
      updatedAt: now.toISOString(),
      autoId: 'auto_' + name + '_' + birth,
    };
  }

  // 같은 고객인가 — 자동 저장 식별값이 같거나, 이름과 생년월일이 모두 같으면 같은 사람으로 본다.
  function sameRecord(c, rec) {
    if (!c || !rec) return false;
    if (rec.autoId && (c.autoId === rec.autoId || c.id === rec.autoId)) return true;
    if (!c.name || c.name !== rec.name) return false;
    return String(c.birth || '') === String(rec.birth || '');
  }

  // ── 상담 탭 내담자 목록 (cheonun_clients_v1) ──
  function consultItem(rec) {
    return {
      name: rec.name,
      gender: rec.gender,
      birth: rec.birth,
      hour: rec.hour,
      calendar: rec.calendar,
      leap: rec.leap,
      topic: rec.topic,
      q: rec.question,
      savedAt: rec.savedAt,
      updatedAt: rec.updatedAt,
      autoId: rec.autoId,
      autoSaved: true,
      managed: false, // 고객관리 화면에서 읽어온 읽기 전용 표시를 끌어오지 않는다(상담 탭에서 직접 지울 수 있게)
    };
  }

  function upsertConsultList(list, rec) {
    const out = Array.isArray(list) ? list.slice() : [];
    const i = out.findIndex(function (c) { return sameRecord(c, rec); });
    if (i >= 0) {
      const old = out[i] || {};
      const merged = Object.assign({}, old, consultItem(rec));
      // 이번에 비어 있는 입력으로 기존 정보를 지우지 않는다
      merged.hour = rec.hour || old.hour || '';
      merged.gender = rec.gender || old.gender || '';
      merged.q = rec.question || old.q || '';
      merged.topic = rec.topic || old.topic || '종합운';
      merged.managed = false;
      out[i] = merged;
      return { list: out, index: i, existed: old, created: false, record: merged };
    }
    const item = consultItem(rec);
    out.unshift(item);
    const trimmed = out.slice(0, CONSULT_LIMIT);
    return { list: trimmed, index: 0, existed: null, created: true, record: trimmed[0] };
  }

  // ── 고객관리 화면 기록 (cheonun.clients.v1) ──
  function newManagedId(nowIso) {
    return 'c_' + String(nowIso || '').replace(/[^0-9]/g, '').slice(0, 14) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function upsertManagedList(list, rec, meta) {
    meta = meta || {};
    const out = Array.isArray(list) ? list.slice() : [];
    const i = out.findIndex(function (c) { return sameRecord(c, rec); });
    const old = i >= 0 ? Object.assign({}, out[i]) : null;
    const base = old || {
      id: newManagedId(rec.updatedAt),
      createdAt: rec.updatedAt,
      contact: '',
      contactMethod: '기타',
      duration: '',
      status: '접수',
      goal: '',
      background: '',
      counterpart: '',
      previous: '',
      consent: false, // 자동 저장은 동의 체크를 대신하지 않는다 — 고객관리 화면에서 직접 확인
      memo: '',
    };

    const topics = Array.isArray(base.topics) ? base.topics.slice() : [];
    const mapped = mapTopic(rec.topic);
    if (rec.topic && topics.indexOf(mapped) < 0) topics.push(mapped);

    const merged = Object.assign(base, {
      name: rec.name,
      birth: rec.birth,
      birthHour: rec.hour || base.birthHour || '',
      gender: rec.gender || base.gender || '',
      calendar: rec.calendar || base.calendar || '양력',
      leap: !!rec.leap,
      topics: topics,
      question: rec.question || base.question || '',
      reason: base.reason || rec.question || (mapped + ' 상담'),
      updatedAt: rec.updatedAt,
      autoSaved: true,
      autoSource: rec.source,
      autoId: rec.autoId,
    });
    if (typeof meta.lastAnswer === 'string' && meta.lastAnswer) {
      merged.lastAnswer = meta.lastAnswer.slice(0, 2000);
    }

    if (i >= 0) out[i] = merged; else out.push(merged);
    return { list: out, index: i >= 0 ? i : out.length - 1, created: i < 0, existed: old, record: merged };
  }

  const api = {
    CONSULT_KEY: CONSULT_KEY,
    MANAGED_KEY: MANAGED_KEY,
    mapTopic: mapTopic,
    defaultName: defaultName,
    buildRecord: buildRecord,
    sameRecord: sameRecord,
    upsertConsultList: upsertConsultList,
    upsertManagedList: upsertManagedList,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CheonunClients = api;
})(typeof window !== 'undefined' ? window : globalThis);
