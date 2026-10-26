(function(root){
  'use strict';
  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
  function clean(v){return String(v==null?'':v).replace(/^\s*(?:AI|A\.?I\.?|assistant|인공지능|천운\s*AI)\s*[:：-]\s*/gim,'').replace(/^\s*(?:답변|응답|상담사)\s*\d*\s*[:：-]\s*/gim,'').replace(/^\s*\[?말풍선\]?\s*$/gim,'').trim();}
  function textOf(id){var el=document.getElementById(id);if(!el)return '';var c=el.cloneNode(true);c.querySelectorAll('button,.copy-all-btn,.bub-copy,.pdf-download-btn').forEach(function(x){x.remove();});return clean(c.innerText||c.textContent||'');}
  function info(){return root.cheOnunConsultInfo||{};}
  function makeDoc(){
    var i=info(),name=i.name||(document.getElementById('cName')||{}).value||'내담자', mode=i.mode||'saju';
    var saju=textOf('sajuTableWrap'), tarot=textOf('drawnCards'), result=textOf('consultResult'), chat='';
    var chatBox=document.getElementById('chatBox');
    if(chatBox){var chatClone=chatBox.cloneNode(true);chatClone.querySelectorAll('button').forEach(function(x){x.remove();});chat=Array.from(chatClone.querySelectorAll('.msg')).map(function(m){var label=m.classList.contains('me')?'질문':'답변';return label+'\n'+clean(m.innerText||m.textContent||'');}).filter(function(x){return x.length>4;}).join('\n\n');}
    var q=(document.getElementById('cQ')||{}).value||'';
    var topic=(document.getElementById('cTopic')||{}).value||'';
    var sections='';
    if(saju)sections+='<section class="pdf-card"><h2>사주 명식과 계산 근거</h2><p>'+esc(saju).replace(/\n/g,'<br>')+'</p></section>';
    if(tarot)sections+='<section class="pdf-card"><h2>타로 카드</h2><p>'+esc(tarot).replace(/\n/g,'<br>')+'</p></section>';
    if(result)sections+='<section class="pdf-card"><h2>상담 결과</h2><p>'+esc(result).replace(/\n/g,'<br>')+'</p></section>';
    if(q)sections+='<section class="pdf-card"><h2>상담 시작 질문</h2><p>'+esc(q).replace(/\n/g,'<br>')+'</p></section>';
    if(chat)sections+='<section class="pdf-card"><h2>후속 상담 기록</h2><p>'+esc(chat).replace(/\n/g,'<br>')+'</p></section>';
    var wrap=document.createElement('div');wrap.className='consult-pdf-doc';
    wrap.innerHTML='<style>.consult-pdf-doc{width:180mm;background:#fff;color:#292433;font-family:Arial,Malgun Gothic,sans-serif;font-size:10.5pt;line-height:1.75;padding:8mm}.pdf-cover{min-height:245mm;display:flex;flex-direction:column;justify-content:center;padding:14mm;position:relative;overflow:hidden;background:radial-gradient(circle at 82% 16%,#6650a8 0,#302254 20%,transparent 42%),linear-gradient(145deg,#090d25,#17133a 55%,#3a241c);border:1px solid #9b7740;color:#fff}.pdf-cover:before{content:"";position:absolute;width:120mm;height:120mm;right:-35mm;top:-30mm;border:1px solid #e0b85a66;border-radius:50%;box-shadow:0 0 0 18mm #e0b85a12,0 0 0 36mm #e0b85a08}.pdf-cover:after{content:"命 盤 · 五行 · 星曜 · 카드";position:absolute;right:10mm;bottom:12mm;color:#e0b85a88;font-size:9pt;letter-spacing:.12em;transform:rotate(-18deg)}.eyebrow{color:#f1c867;letter-spacing:.14em;font-size:10pt;font-weight:700;position:relative;z-index:1}.art{height:44mm;margin:9mm 0 2mm;position:relative;z-index:1}.pdf-cover h1{font-size:25pt;line-height:1.25;color:#fff8e8;margin:4mm 0}.pdf-name{font-size:16pt;color:#f1c867;font-weight:700;position:relative;z-index:1}.pdf-meta{margin-top:20mm;color:#d5c9b8;font-size:9pt;position:relative;z-index:1}.pdf-card{break-inside:avoid;margin:0 0 8mm;padding:6mm;background:#fffdf8;border:1px solid #e4d6bd;border-radius:5mm}.pdf-card h2{color:#55387b;background:#f1eafe;border-left:4px solid #8564c5;padding:3mm 4mm;margin:0 0 5mm;font-size:15pt}.pdf-card p{margin:0;white-space:normal;text-align:justify}.page-break{break-before:page}.note{font-size:8.5pt;color:#80778b;border-top:1px solid #e7dfef;padding-top:3mm;margin-top:8mm}</style><div class="pdf-cover"><div class="eyebrow">CHEONUN · SAJU & TAROT CONSULTATION</div><div class="art"><svg viewBox="0 0 720 180" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g2" x1="0" x2="1"><stop offset="0" stop-color="#f0c35c"/><stop offset="1" stop-color="#fff1b0"/></linearGradient></defs><circle cx="90" cy="90" r="58" fill="none" stroke="url(#g2)" stroke-width="2"/><circle cx="90" cy="90" r="31" fill="none" stroke="#e7bd5b"/><path d="M90 34v112M34 90h112M50 50l80 80M130 50 50 130" stroke="#e7bd5b" opacity=".5"/><circle cx="90" cy="90" r="7" fill="#f6d878"/><g fill="#f2c65f"><circle cx="220" cy="90" r="5"/><circle cx="280" cy="90" r="5"/><circle cx="340" cy="90" r="5"/><circle cx="400" cy="90" r="5"/><circle cx="460" cy="90" r="5"/></g><g fill="#d9c7a4" font-size="12"><text x="220" y="130">木</text><text x="280" y="130">火</text><text x="340" y="130">土</text><text x="400" y="130">金</text><text x="460" y="130">水</text></g></svg></div><h1>사주 · 타로<br>상담 리포트</h1><div class="pdf-name">'+esc(name)+'님</div><div class="pdf-meta">상담 분야: '+esc(topic|| (mode==='tarot'?'타로 상담':'사주 상담'))+'<br>천운 상담연구소</div></div><div class="page-break"></div>'+sections+'<div class="note">계산 결과와 카드 정보에 근거한 상담 참고자료입니다. 미래를 단정하지 않고 현재의 흐름과 선택을 함께 살펴봅니다.</div>';
    return wrap;
  }
  root.addConsultPdfButton=function(){
    var host=document.getElementById('consultResult');if(!host||host.querySelector('.pdf-download-btn'))return;
    var b=document.createElement('button');b.className='btn btn-ghost pdf-download-btn';b.style.marginTop='10px';b.textContent='📕 사주·타로 상담 PDF 다운로드';b.onclick=root.downloadConsultPdf;host.appendChild(b);
  };
  root.downloadConsultPdf=async function(){
    try{if(typeof root.html2pdf!=='function'){window.print();return;}var doc=makeDoc();document.body.appendChild(doc);var i=info(),name=i.name||(document.getElementById('cName')||{}).value||'내담자';var kind=i.mode==='tarot'?'타로':'사주';var opt={margin:[6,6,8,6],filename:name+'-'+kind+'-상담리포트.pdf',image:{type:'jpeg',quality:.96},html2canvas:{scale:2,useCORS:true,backgroundColor:'#fff',logging:false},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},pagebreak:{mode:['css','legacy']}};await root.html2pdf().set(opt).from(doc).save();doc.remove();}catch(e){if(root.snack)root.snack('PDF 생성 중 오류가 발생했습니다. 다시 눌러 주세요.');}
  };
})(typeof window!=='undefined'?window:globalThis);

