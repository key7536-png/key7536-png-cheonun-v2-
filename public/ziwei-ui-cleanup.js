(function(root){
  'use strict';
  function clean(v){return String(v==null?'':v).replace(/^\s*(?:AI|A\.?I\.?|assistant|인공지능|천운\s*AI)\s*[:：-]\s*/gim,'').replace(/^\s*(?:답변|응답|상담사)\s*\d*\s*[:：-]\s*/gim,'').replace(/^\s*\[말풍선\]\s*$/gim,'').replace(/^\s*```(?:markdown|text)?\s*$/gim,'').replace(/^\s*```\s*$/gim,'').trim();}
  root.renderZiweiReport=function(name,text){
    var cleanText=clean(text);
    var sections=cleanText.split(/^##\s*/m).map(function(x){return clean(x);}).filter(function(x){return x.length>5;});
    var chart=root.ziweiChart||null;
    var meta=chart?'<div class="zw-report-meta"><div><b>계산 엔진</b>'+escapeHtml(chart.engineVersion||'iztro 2.6.0')+'</div><div><b>현재 기준</b>'+escapeHtml(chart.current.targetSolarDate||'')+' · 허세 '+escapeHtml(chart.current.nominalAge||'')+'세</div><div><b>현재 흐름</b>'+escapeHtml(chart.current.decadalPalace||'')+' 대한 · '+escapeHtml(chart.current.yearlyPalace||'')+' 유년명궁</div></div>':'';
    var html='<div class="card"><div class="card-title" style="display:flex;justify-content:space-between;align-items:center">⭐ '+escapeHtml(name)+'님 평생 종합 풀이<button class="copy" style="float:none;font-size:.78rem;color:var(--gold2)" onclick="copyZiweiReport(this)">전체 복사</button><button class="copy" style="float:none;font-size:.78rem;color:var(--gold2);margin-left:8px" onclick="downloadZiweiPdf()">PDF 다운로드</button></div>'+meta;
    sections.forEach(function(sec){var lines=sec.split('\n');var title=lines.shift().trim();var body=clean(lines.join('\n')).replace(/\*\*/g,'');var overall=/^0\./.test(title);var evidence=overall&&chart?'<div class="zw-evidence">근거 데이터 · 명궁 '+escapeHtml(chart.soulPalace)+' · 신궁 '+escapeHtml(chart.bodyPalace)+' · 오행국 '+escapeHtml(chart.fiveElementsClass)+' · 현재 대한 '+escapeHtml(chart.current.decadalStemBranch)+'</div>':'';html+='<div class="'+(overall?'zw-overall':'bubble')+'"><button class="copy" onclick="copyBubble(this)">복사</button><h3 style="display:block;color:var(--gold2);margin:0 0 6px;font-size:.9rem">'+escapeHtml(title)+'</h3>'+escapeHtml(body).replace(/\n{2,}/g,'<br><br>').replace(/\n/g,'<br>')+evidence+'</div>';});
    html+='</div>'; return html;
  };
  var oldStart=root.startZiwei;
  if(oldStart){ root.startZiwei=function(){ return oldStart.apply(this,arguments); }; }
})(typeof window!=='undefined'?window:globalThis);
