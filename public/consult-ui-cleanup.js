(function(root){
  'use strict';
  function cleanText(value){
    return String(value==null?'':value).replace(/\r/g,'').replace(/^\s*\[?말풍선\]?\s*$/gim,'').replace(/^\s*(?:AI|A\.?I\.?|assistant|인공지능|천운\s*AI)\s*[:：-]\s*/gim,'').replace(/^\s*(?:답변|응답|상담사)\s*\d*\s*[:：-]\s*/gim,'').replace(/^\s*```(?:markdown|text)?\s*$/gim,'').replace(/^\s*```\s*$/gim,'').trim();
  }
  function escapeHtml(value){return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');}
  root.cleanConsultText=cleanText;
  root.parseBubs=function(txt){return String(txt||'').split(/\[말풍선\]/).map(cleanText).filter(function(p){return p.length>10;});};
  root.renderBubs=function(bubs,targetId){
    var wrap=document.createElement('div'); wrap.className='card bubs-wrap'; wrap.innerHTML='<div class="card-title">상담 결과</div>';
    (bubs||[]).map(cleanText).filter(Boolean).forEach(function(b,i){var div=document.createElement('div'); div.className='bub'; div.style.paddingTop='20px'; div.innerHTML='<span class="bub-num">상담 내용 '+(i+1)+'</span>'+escapeHtml(b).replace(/\n/g,'<br>')+'<button class="bub-copy">복사</button>'; div.querySelector('.bub-copy').onclick=function(){navigator.clipboard.writeText(b).then(function(){if(root.snack)root.snack('복사됨 ✓');});}; wrap.appendChild(div);});
    var copyAll=document.createElement('button'); copyAll.className='copy-all-btn'; copyAll.textContent='전체 복사'; copyAll.onclick=function(){navigator.clipboard.writeText((bubs||[]).map(cleanText).filter(Boolean).join('\n\n')).then(function(){if(root.snack)root.snack('전체 복사됨 ✓');});}; wrap.appendChild(copyAll); document.getElementById(targetId).innerHTML=''; document.getElementById(targetId).appendChild(wrap);
  };
})(typeof window!=='undefined'?window:globalThis);
