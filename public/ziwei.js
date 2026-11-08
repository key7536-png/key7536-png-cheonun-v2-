(function (root) {
  'use strict';

  const HOUR_INDEX = {
    '자시': 0, '축시': 1, '인시': 2, '묘시': 3,
    '진시': 4, '사시': 5, '오시': 6, '미시': 7,
    '신시': 8, '유시': 9, '술시': 10, '해시': 11
  };

  const MUTAGEN_LABEL = { '록': '화록', '권': '화권', '과': '화과', '기': '화기' };

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function normalizeGender(gender) {
    return gender === '남성' || gender === '남' ? '男' : '女';
  }

  function normalizeDate(date) {
    return String(date || '').replace(/-/g, '-').replace(/^0+/, '');
  }

  // 화면·상담 문구용 한국 음력 표기 (예: 1969년 8월 1일 / 2017년 윤5월 1일)
  function koreanLunarText(solarDate) {
    if (!root.KoreanLunar || !solarDate) return '';
    try {
      const p = String(solarDate).split(/[-.]/).map(Number);
      const l = root.KoreanLunar.solarToLunar(p[0], p[1], p[2]);
      return l.year + '년 ' + (l.isLeap ? '윤' : '') + l.month + '월 ' + l.day + '일';
    } catch (e) { return ''; }
  }

  function calculate(options) {
    if (!root.iztro || !root.iztro.astro) {
      throw new Error('자미두수 계산 모듈을 불러오지 못했습니다.');
    }

    const birth = normalizeDate(options.birth);
    const hourIndex = HOUR_INDEX[options.hour];
    if (!birth) throw new Error('생년월일을 입력해주세요.');
    if (hourIndex === undefined) throw new Error('자미두수는 태어난 시간이 필요합니다.');

    const gender = normalizeGender(options.gender);
    const isLunar = options.calendar === '음력';
    // 음력 입력: 자미두수는 내담자가 아는 '음력 월·일'로 별을 배치하는 것이 한국 관례이므로 byLunar를 기본으로 쓴다.
    // 먼저 한국 음력표로 실제로 있는 날짜인지 확인하고(없는 날짜면 이유를 알려 줌),
    // 중국 달력에는 없는 날(예: 한국에만 있는 30일·윤달)이면 실제 양력 생일로 계산한다.
    let chart;
    if (isLunar) {
      let koreanSolar = null;
      if (root.KoreanLunar) {
        const p = birth.split('-');
        koreanSolar = root.KoreanLunar.lunarToSolar(+p[0], +p[1], +p[2], !!options.isLeap);
      }
      try {
        chart = root.iztro.astro.byLunar(birth, hourIndex, gender, !!options.isLeap, true, 'ko-KR');
      } catch (e) {
        if (!koreanSolar) throw e;
        chart = null;
      }
      // 중국 달력 기준으로 바꾼 양력이 실제 생일과 하루 넘게 다르면(윤달이 다른 해 등) 달 자체가 어긋난 것이므로 실제 양력으로 계산
      const dayGap = function (a, b) {
        const x = String(a).split(/[-.]/).map(Number), y = String(b).split(/[-.]/).map(Number);
        return Math.abs(Date.UTC(x[0], x[1] - 1, x[2]) - Date.UTC(y[0], y[1] - 1, y[2])) / 86400000;
      };
      if (koreanSolar && (!chart || !chart.palaces || chart.palaces.length !== 12 || dayGap(chart.solarDate, koreanSolar) > 1)) {
        chart = root.iztro.astro.bySolar(koreanSolar, hourIndex, gender, true, 'ko-KR');
      }
    } else {
      chart = root.iztro.astro.bySolar(birth, hourIndex, gender, true, 'ko-KR');
    }

    const targetDate = options.targetDate || new Date();
    const horoscope = chart.horoscope(targetDate);
    const palaces = chart.palaces.map(function (palace) {
      return {
        index: palace.index,
        name: palace.name,
        stemBranch: palace.heavenlyStem + palace.earthlyBranch,
        branch: palace.earthlyBranch,
        isBodyPalace: palace.isBodyPalace,
        majorStars: palace.majorStars.map(function (star) {
          return {
            name: star.name,
            brightness: star.brightness || '',
            mutagen: star.mutagen ? MUTAGEN_LABEL[star.mutagen] || star.mutagen : ''
          };
        }),
        minorStars: palace.minorStars.slice(0, 5).map(function (star) { return star.name; }),
        decadalRange: palace.decadal && palace.decadal.range ? palace.decadal.range.join('~') : ''
      };
    });

    const currentDecadalPalace = palaces.find(function (palace) { return palace.index === horoscope.decadal.index; });
    const currentYearPalace = palaces.find(function (palace) { return palace.index === horoscope.yearly.index; });

    return {
      raw: chart,
      solarDate: chart.solarDate,
      lunarDate: koreanLunarText(chart.solarDate) || chart.lunarDate,
      chineseDate: chart.chineseDate,
      time: chart.time,
      soulPalace: chart.earthlyBranchOfSoulPalace,
      bodyPalace: chart.earthlyBranchOfBodyPalace,
      soulStar: chart.soul,
      bodyStar: chart.body,
      fiveElementsClass: chart.fiveElementsClass,
      palaces: palaces,
      current: {
        targetSolarDate: horoscope.solarDate,
        nominalAge: horoscope.age.nominalAge,
        decadalPalace: currentDecadalPalace ? currentDecadalPalace.name : '',
        decadalStemBranch: horoscope.decadal.heavenlyStem + horoscope.decadal.earthlyBranch,
        decadalMutagens: horoscope.decadal.mutagen || [],
        yearlyPalace: currentYearPalace ? currentYearPalace.name : '',
        yearlyStemBranch: horoscope.yearly.heavenlyStem + horoscope.yearly.earthlyBranch,
        yearlyMutagens: horoscope.yearly.mutagen || []
      }
    };
  }

  function starText(palace) {
    if (!palace.majorStars.length) return '주성 없음';
    return palace.majorStars.map(function (star) {
      return star.name + (star.mutagen ? '(' + star.mutagen + ')' : '');
    }).join(' · ');
  }

  function toPrompt(chart) {
    const palaceLines = chart.palaces.map(function (palace) {
      const body = palace.isBodyPalace ? ' / 신궁' : '';
      const minor = palace.minorStars.length ? ' / 보조성:' + palace.minorStars.join('·') : '';
      return '- ' + palace.name + '(' + palace.stemBranch + body + '): ' + starText(palace) + minor;
    }).join('\n');

    return [
      '자미두수 명반 (계산 완료, 임의 재계산 금지):',
      '양력 ' + chart.solarDate + ' / 음력 ' + chart.lunarDate + ' / ' + chart.time,
      '명궁:' + chart.soulPalace + ' / 신궁:' + chart.bodyPalace + ' / 오행국:' + chart.fiveElementsClass,
      '명주:' + chart.soulStar + ' / 신주:' + chart.bodyStar,
      palaceLines,
      '현재 대한:' + chart.current.decadalPalace + '(' + chart.current.decadalStemBranch + ', 허세 ' + chart.current.nominalAge + '세)',
      '현재 유년명궁:' + chart.current.yearlyPalace + '(' + chart.current.yearlyStemBranch + ')',
      '유년 사화 별 순서[록·권·과·기]: ' + chart.current.yearlyMutagens.join('·')
    ].join('\n');
  }

  function render(chart, name) {
    const rows = chart.palaces.map(function (palace) {
      return '<div class="zw-palace' + (palace.name === '명궁' ? ' soul' : '') + '">' +
        '<div class="zw-palace-head"><b>' + palace.name + '</b><span>' + palace.stemBranch + (palace.isBodyPalace ? ' · 신궁' : '') + '</span></div>' +
        '<div class="zw-stars">' + starText(palace) + '</div>' +
        (palace.decadalRange ? '<div class="zw-decade">대한 ' + palace.decadalRange + '세</div>' : '') +
        '</div>';
    }).join('');

    return '<div class="card zw-card">' +
      '<div class="card-title">⭐ ' + escapeHtml(name || '내담자') + '님 자미두수 명반</div>' +
      '<div class="zw-summary">' +
        '<span>양력 ' + chart.solarDate + '</span><span>음력 ' + chart.lunarDate + '</span>' +
        '<span>명궁 ' + chart.soulPalace + '</span><span>신궁 ' + chart.bodyPalace + '</span>' +
        '<span>' + chart.fiveElementsClass + '</span>' +
      '</div>' +
      '<div class="zw-current">현재 대한 <b>' + chart.current.decadalPalace + '</b> · 유년명궁 <b>' + chart.current.yearlyPalace + '</b></div>' +
      '<div class="zw-grid">' + rows + '</div>' +
      '<p class="zw-note">전통 삼합파 기반 학습·상담 보조 명반입니다. 출생시간이 불확실하면 궁과 별 배치가 달라질 수 있습니다.</p>' +
    '</div>';
  }

  root.CheonunZiwei = {
    calculate: calculate,
    toPrompt: toPrompt,
    render: render,
    hourIndex: function (hour) { return HOUR_INDEX[hour]; }
  };
})(typeof window !== 'undefined' ? window : globalThis);


/* 천운 업그레이드: iztro 계산 결과의 근거 필드를 누락 없이 노출 */
(function(root){
  'use strict';
  var api = root.CheonunZiwei;
  if(!api || !api.calculate) return;
  var legacyCalculate = api.calculate;
  function starLine(star){
    if(!star) return '';
    var bits = [star.name];
    if(star.brightness) bits.push('밝기 ' + star.brightness);
    if(star.mutagen) bits.push(star.mutagen);
    return bits.join(' ');
  }
  function enrich(chart){
    chart.engineVersion = 'iztro 2.6.0';
    chart.calendarVersion = '한국 음력표(KARI 기준)';
    chart.timePolicy = '12지 시진 입력, 분 단위 출생시각 미입력';
    if(chart.raw && chart.raw.palaces){
      chart.palaces = chart.raw.palaces.map(function(p){
        return {
          index:p.index,
          name:p.name,
          stemBranch:p.heavenlyStem + p.earthlyBranch,
          branch:p.earthlyBranch,
          isBodyPalace:!!p.isBodyPalace,
          majorStars:(p.majorStars||[]).map(function(s){return {name:s.name,brightness:s.brightness||'',mutagen:s.mutagen ? ({'록':'화록','권':'화권','과':'화과','기':'화기'}[s.mutagen]||s.mutagen) : ''};}),
          minorStars:(p.minorStars||[]).map(function(s){return s.name;}).filter(Boolean),
          adjectiveStars:(p.adjectiveStars||[]).map(function(s){return s.name;}).filter(Boolean),
          changsheng12:p.changsheng12||'',
          boshi12:p.boshi12||'',
          jiangqian12:p.jiangqian12||'',
          suiqian12:p.suiqian12||'',
          ages:Array.isArray(p.ages)?p.ages.slice():[],
          decadalRange:p.decadal && p.decadal.range ? p.decadal.range.join('~') : ''
        };
      });
    }
    return chart;
  }
  api.calculate = function(options){ return enrich(legacyCalculate(options)); };
  api.toPrompt = function(chart){
    var palaceLines = chart.palaces.map(function(p){
      var body = p.isBodyPalace ? ' / 신궁' : '';
      var major = p.majorStars.length ? p.majorStars.map(starLine).join(' · ') : '주성 없음';
      var minor = p.minorStars.length ? ' / 보조성:' + p.minorStars.join('·') : '';
      var adj = p.adjectiveStars.length ? ' / 부가성:' + p.adjectiveStars.join('·') : '';
      var cycles = [p.changsheng12 && '12운성:'+p.changsheng12, p.boshi12 && '박사12신:'+p.boshi12, p.jiangqian12 && '장전12신:'+p.jiangqian12, p.suiqian12 && '세전12신:'+p.suiqian12].filter(Boolean).join(' / ');
      return '- ' + p.name + '(' + p.stemBranch + body + ', 대한 ' + (p.decadalRange||'미상') + '세): ' + major + minor + adj + (cycles ? ' / ' + cycles : '');
    }).join('\n');
    return [
      '자미두수 명반 (iztro 2.6.0 계산 완료, 임의 재계산 금지):',
      '양력 ' + chart.solarDate + ' / 음력 ' + chart.lunarDate + ' / ' + chart.time,
      '계산 기준: ' + chart.calendarVersion + ' / ' + chart.timePolicy,
      '명궁:' + chart.soulPalace + ' / 신궁:' + chart.bodyPalace + ' / 오행국:' + chart.fiveElementsClass,
      '명주:' + chart.soulStar + ' / 신주:' + chart.bodyStar,
      palaceLines,
      '현재 대한:' + chart.current.decadalPalace + '(' + chart.current.decadalStemBranch + ', 허세 ' + chart.current.nominalAge + '세)',
      '현재 유년명궁:' + chart.current.yearlyPalace + '(' + chart.current.yearlyStemBranch + ')',
      '현재 대한 사화 별 순서[록·권·과·기]: ' + (chart.current.decadalMutagens||[]).join('·'),
      '현재 유년 사화 별 순서[록·권·과·기]: ' + (chart.current.yearlyMutagens||[]).join('·')
    ].join('\n');
  };
  api.render = function(chart, name){
    function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
    function stars(p){
      var major = p.majorStars.length ? p.majorStars.map(starLine).join(' · ') : '주성 없음';
      var minor = p.minorStars.length ? '<div style="margin-top:5px;color:#b99af8">보조성 · '+esc(p.minorStars.join(' · '))+'</div>' : '';
      var adj = p.adjectiveStars.length ? '<div style="margin-top:4px;color:#8d869e">부가성 · '+esc(p.adjectiveStars.join(' · '))+'</div>' : '';
      return '<div class="zw-stars">'+esc(major)+'</div>'+minor+adj;
    }
    var rows = chart.palaces.map(function(p){
      return '<div class="zw-palace'+(p.name==='명궁'?' soul':'')+'" data-palace="'+esc(p.name)+'">'+
        '<div class="zw-palace-head"><b>'+esc(p.name)+'</b><span>'+esc(p.stemBranch)+(p.isBodyPalace?' · 신궁':'')+'</span></div>'+
        stars(p)+(p.decadalRange?'<div class="zw-decade">대한 '+esc(p.decadalRange)+'세</div>':'')+
        '<div style="margin-top:5px;color:#817b8e;font-size:.62rem">'+esc([p.changsheng12&&('12운성 '+p.changsheng12),p.boshi12&&('박사12신 '+p.boshi12)].filter(Boolean).join(' · '))+'</div></div>';
    }).join('');
    var starCount = chart.palaces.reduce(function(n,p){return n+p.majorStars.length+p.minorStars.length+p.adjectiveStars.length;},0);
    return '<div class="card zw-card">'+
      '<div class="card-title">⭐ '+esc(name||'내담자')+'님 자미두수 명반</div>'+ 
      '<div class="zw-summary"><span>양력 '+esc(chart.solarDate)+'</span><span>음력 '+esc(chart.lunarDate)+'</span><span>명궁 '+esc(chart.soulPalace)+'</span><span>신궁 '+esc(chart.bodyPalace)+'</span><span>'+esc(chart.fiveElementsClass)+'</span></div>'+ 
      '<div class="zw-current">현재 대한 <b>'+esc(chart.current.decadalPalace)+'</b> · 유년명궁 <b>'+esc(chart.current.yearlyPalace)+'</b></div>'+ 
      '<div class="zw-data-strip"><b>계산 기준</b> '+esc(chart.engineVersion)+' · '+esc(chart.calendarVersion)+' · 근거 성요 '+starCount+'개 · '+esc(chart.timePolicy)+'</div>'+ 
      '<div class="zw-grid">'+rows+'</div>'+ 
      '<p class="zw-note">명반 계산과 해석을 분리했습니다. 아래 풀이의 사실 근거는 이 명반의 궁·별·밝기·사화·대한 범위이며, 출생시간이 달라지면 결과도 달라집니다.</p>'+ 
      '</div>';
  };
})(typeof window!=='undefined'?window:globalThis);


/* 천운 정확도 패치 v3 (2026-11-08 재검증)
 * 1) 양력으로 넣어도 한국 음력(KARI)으로 바꿔 명반을 세운다. 예전에는 iztro가 중국 음력으로 바꿔 계산해서,
 *    한국·중국 음력이 하루 다른 날(1900~2049년 중 약 3.6%)은 양력 입력과 음력 입력의 명반이 서로 달랐다.
 * 2) 시간: 사주 엔진과 같은 규칙(한국 경도 보정 -30분, 서머타임, 밤 11시 이후는 다음 날 자시)으로 맞춘다.
 * 3) 밝기 표기 [+3] 등을 묘·왕·득·리·평·불·함으로 바꿔 해석 근거가 흔들리지 않게 한다.
 * 4) 사주 대운과 자미두수 대한의 나이 구간이 다른 이유를 프롬프트에 고정해 '두 결과가 안 맞는다'는 혼선을 막는다.
 */
(function(root){
  'use strict';
  var api=root.CheonunZiwei;
  if(!api || !api.calculate) return;
  var BR=['자시','축시','인시','묘시','진시','사시','오시','미시','신시','유시','술시','해시'];
  var BRIGHT={'[+3]':'묘','[+2]':'왕','[+1]':'득','[0]':'리','[-1]':'평','[-2]':'불','[-3]':'함'};
  var MUT={'록':'화록','권':'화권','과':'화과','기':'화기'};
  var LMT=510;
  function pad(n){return (n<10?'0':'')+n;}
  var _fmt=null;
  function offsetAt(utcMs){
    try{ if(!_fmt) _fmt=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
      var o={}; _fmt.formatToParts(new Date(utcMs)).forEach(function(x){o[x.type]=x.value;});
      return Math.round((Date.UTC(+o.year,+o.month-1,+o.day,+o.hour%24,+o.minute)-utcMs)/60000);
    }catch(e){return 540;}
  }
  function wallToUtc(y,m,d,h,mi){var w=Date.UTC(y,m-1,d,h,mi),off=540;for(var i=0;i<3;i++)off=offsetAt(w-off*60000);return {utc:w-off*60000,offset:off};}
  // 시간 입력 → {date:'Y-M-D'(자미두수에 쓸 날짜), index(0~11), note}
  function moment(y,m,d,hourStr){
    if(root.CheonunTime && root.CheonunTime.resolveBirthMoment){
      var r=root.CheonunTime.resolveBirthMoment(y,m,d,hourStr);
      var t=new Date(Date.UTC(r.lmt.y,r.lmt.m-1,r.lmt.d)+(r.lateZi?86400000:0));
      return {y:t.getUTCFullYear(),m:t.getUTCMonth()+1,d:t.getUTCDate(),index:r.branchIndex,known:r.known,note:r.note,lateZi:r.lateZi};
    }
    var hs=String(hourStr||'').trim(), c=hs.match(/^(\d{1,2}):(\d{2})$/), utc, note='', late=hs==='야자시';
    if(c){var w=wallToUtc(y,m,d,+c[1],+c[2]);utc=w.utc;if(w.offset!==540)note='출생 당시 한국 시각 UTC+'+Math.floor(w.offset/60)+(w.offset%60?':'+pad(w.offset%60):'')+' 반영';}
    else{var idx=late?0:BR.indexOf(hs);if(idx<0)return {y:y,m:m,d:d,index:-1,known:false,note:''};utc=Date.UTC(y,m-1,d,0,0)+(late?(23*60+30):(idx===0?30:idx*120))*60000-LMT*60000;}
    var l=new Date(utc+LMT*60000),min=l.getUTCHours()*60+l.getUTCMinutes(),lz=min>=23*60;
    var t2=new Date(Date.UTC(l.getUTCFullYear(),l.getUTCMonth(),l.getUTCDate())+(lz?86400000:0));
    return {y:t2.getUTCFullYear(),m:t2.getUTCMonth()+1,d:t2.getUTCDate(),index:Math.floor(((min+60)%1440)/120),known:true,note:note,lateZi:lz};
  }
  function bright(b){return BRIGHT[b]||b||'';}
  function starObj(s){return {name:s.name,brightness:bright(s.brightness),mutagen:s.mutagen?(MUT[s.mutagen]||s.mutagen):''};}

  function calculate(options){
    if(!root.iztro||!root.iztro.astro) throw new Error('자미두수 계산 모듈을 불러오지 못했습니다.');
    if(!root.KoreanLunar){ // 한국 음력표가 없는 환경(단독 테스트 등): 예전 방식으로 계산하고 밝기만 한글로
      var lc=legacyCalc(options);
      lc.palaces.forEach(function(pl){pl.majorStars.forEach(function(s){s.brightness=bright(s.brightness);});});
      lc.warning='한국 음력표 없이 계산됨'; return lc;
    }
    var birth=String(options.birth||'').trim();
    if(!birth) throw new Error('생년월일을 입력해주세요.');
    var hourStr=options.hour;
    if(!hourStr) throw new Error('자미두수는 태어난 시간이 필요합니다.');
    var p=birth.split(/[-.\/]/).map(Number);
    var solar = options.calendar==='음력' ? root.KoreanLunar.lunarToSolar(p[0],p[1],p[2],!!options.isLeap) : p.join('-');
    var sp=solar.split('-').map(Number);
    if(sp.length!==3||sp.some(function(n){return !Number.isFinite(n);})) throw new Error('생년월일 형식을 확인해 주세요.');
    solar=sp.join('-');
    var mo=moment(sp[0],sp[1],sp[2],hourStr);
    if(!mo.known||mo.index<0) throw new Error('자미두수는 태어난 시간이 필요합니다.');
    var gender=(options.gender==='남성'||options.gender==='남')?'男':'女';
    var k=root.KoreanLunar.solarToLunar(mo.y,mo.m,mo.d);
    // 윤달은 전통 관례(iztro fixLeap과 같음): 15일까지는 그 달, 16일부터는 다음 달로 본다.
    var ly=k.year, lm=k.month, ld=k.day, warn='';
    if(k.isLeap && ld>15){ lm+=1; if(lm>12){lm=12;warn='윤12월 16일 이후 출생: 다음 해 1월로 볼지 전문가 확인 필요';} }
    var chart, basis='한국 음력 '+k.year+'년 '+(k.isLeap?'윤':'')+k.month+'월 '+k.day+'일', yearShift=0;
    try{
      chart=root.iztro.astro.byLunar(ly+'-'+lm+'-'+ld, mo.index, gender, false, true, 'ko-KR');
    }catch(e){
      // 한국 음력에는 30일이 있는데 중국 달력에는 29일까지인 달: 별 배치는 해의 간지·월·일·시만 쓰므로
      // 간지가 같은 60년 전후 해에서 같은 월 30일로 명반을 세우고, 현재 운을 볼 날짜도 같은 만큼 옮겨 나이를 맞춘다.
      [-60,60,-120,120].some(function(dy){
        try{ chart=root.iztro.astro.byLunar((ly+dy)+'-'+lm+'-'+ld, mo.index, gender, false, true, 'ko-KR'); yearShift=dy; return true; }catch(e2){ return false; }
      });
      if(!chart){
        chart=root.iztro.astro.bySolar(mo.y+'-'+mo.m+'-'+mo.d, mo.index, gender, true, 'ko-KR');
        warn='한국 음력 날짜('+basis+')가 계산 모듈 달력에 없어 양력 기준으로 계산했습니다. 별 배치를 전문가가 한 번 더 확인해 주세요.';
      }
    }
    var target=options.targetDate?new Date(options.targetDate):new Date();
    if(yearShift) target=new Date(target.getFullYear()+yearShift, target.getMonth(), target.getDate());
    var horoscope=chart.horoscope(target);
    var palaces=chart.palaces.map(function(pl){
      return {index:pl.index,name:pl.name,stemBranch:pl.heavenlyStem+pl.earthlyBranch,branch:pl.earthlyBranch,isBodyPalace:!!pl.isBodyPalace,
        majorStars:(pl.majorStars||[]).map(starObj),
        minorStars:(pl.minorStars||[]).map(function(s){return s.name+(s.mutagen?'('+(MUT[s.mutagen]||s.mutagen)+')':'');}).filter(Boolean),
        adjectiveStars:(pl.adjectiveStars||[]).map(function(s){return s.name;}).filter(Boolean),
        changsheng12:pl.changsheng12||'',boshi12:pl.boshi12||'',jiangqian12:pl.jiangqian12||'',suiqian12:pl.suiqian12||'',
        ages:Array.isArray(pl.ages)?pl.ages.slice():[],decadalRange:pl.decadal&&pl.decadal.range?pl.decadal.range.join('~'):''};
    });
    var dec=palaces.find(function(x){return x.index===horoscope.decadal.index;});
    var yr=palaces.find(function(x){return x.index===horoscope.yearly.index;});
    var firstDecade=palaces.map(function(x){return x.decadalRange;}).filter(Boolean).map(function(r){return +r.split('~')[0];}).sort(function(a,b){return a-b;})[0];
    var targetText=options.targetDate?new Date(options.targetDate):new Date();
    targetText=targetText.getFullYear()+'-'+(targetText.getMonth()+1)+'-'+targetText.getDate();
    return {
      raw:chart, solarDate:solar, yearShift:yearShift, lunarDate:k.year+'년 '+(k.isLeap?'윤':'')+k.month+'월 '+k.day+'일'+(mo.lateZi?' (밤 자시 → 다음 날 기준)':''),
      chineseDate:chart.chineseDate, time:BR[mo.index]+(mo.lateZi?'(밤 자시)':''), soulPalace:chart.earthlyBranchOfSoulPalace, bodyPalace:chart.earthlyBranchOfBodyPalace,
      soulStar:chart.soul, bodyStar:chart.body, fiveElementsClass:chart.fiveElementsClass, palaces:palaces,
      firstDecadeAge:firstDecade,
      engineVersion:'iztro 2.6.0 · 한국 음력 보정 v3', calendarVersion:'한국 음력표(KARI 기준) — 양력 입력도 한국 음력으로 환산',
      timePolicy:'한국 경도 보정(표준시 -30분)·서머타임 반영, 밤 11시 이후는 다음 날 자시', calcBasis:basis+' '+BR[mo.index]+(lm!==k.month?' (윤달 16일 이후라 '+lm+'월로 배치)':''),
      timeNote:mo.note||'', warning:warn,
      current:{targetSolarDate:targetText,nominalAge:horoscope.age.nominalAge,
        decadalPalace:dec?dec.name:'',decadalStemBranch:horoscope.decadal.heavenlyStem+horoscope.decadal.earthlyBranch,decadalMutagens:horoscope.decadal.mutagen||[],
        yearlyPalace:yr?yr.name:'',yearlyStemBranch:horoscope.yearly.heavenlyStem+horoscope.yearly.earthlyBranch,yearlyMutagens:horoscope.yearly.mutagen||[]}
    };
  }
  var oldPrompt=api.toPrompt, oldRender=api.render, legacyCalc=api.calculate;
  api.calculate=calculate;
  api.toPrompt=function(chart){
    var base=oldPrompt(chart);
    return base+'\n'+[
      '계산 근거 날짜: '+(chart.calcBasis||'')+(chart.timeNote?' / '+chart.timeNote:''),
      chart.warning?'⚠️ '+chart.warning:'',
      '밝기 순서(높음→낮음): 묘 > 왕 > 득 > 리 > 평 > 불 > 함. 명반에 적힌 밝기만 쓸 것.',
      '자미두수 대한은 오행국('+chart.fiveElementsClass+') 기준 '+(chart.firstDecadeAge||'')+'세부터 10년 단위(세는나이)라 사주 대운(대운수 기준)과 나이 구간이 다르다. 두 체계의 나이·구간을 섞거나 같다고 말하지 말고, 자미두수 시기는 반드시 위 대한 범위로만 말할 것.',
      '자미두수의 해(띠·사화)는 음력 설 기준이고 사주의 해는 입춘 기준이라, 설과 입춘 사이 출생자는 두 체계의 해 간지가 다를 수 있다. 이 경우 둘 중 하나가 틀린 것이 아님.'
    ].filter(Boolean).join('\n');
  };
  api.render=function(chart,name){
    var html=oldRender(chart,name);
    var extra='<div class="zw-data-strip"><b>계산 근거</b> '+String(chart.calcBasis||'').replace(/</g,'&lt;')+(chart.timeNote?' · '+chart.timeNote:'')+'</div>'+
      (chart.warning?'<div class="zw-data-strip" style="color:#e57373"><b>확인 필요</b> '+String(chart.warning).replace(/</g,'&lt;')+'</div>':'');
    return html.replace('<div class="zw-grid">',extra+'<div class="zw-grid">');
  };
  api.hourIndex=function(hour){return hour==='야자시'?0:BR.indexOf(hour);};
  api.moment=moment;

  // 시간 선택칸: '밤 자시(23:30~24:00, 다음 날)' 추가 + 출생일에 맞춘 시계 시각 표시(서머타임·UTC+8:30 시기 자동 반영)
  function labelFor(dateStr,idx,late){
    var p=String(dateStr||'').split(/[-.\/]/).map(Number), y=p[0]||2000,m=p[1]||6,d=p[2]||15;
    var noon=wallToUtc(y,m,d,12,0).offset, shift=noon-LMT; // 지방시 → 출생일 벽시계
    function f(min){min=((min%1440)+1440)%1440;return pad(Math.floor(min/60))+':'+pad(min%60);}
    if(late) return shift>=60 ? '밤 자시 (이 날짜는 서머타임이라 해당 없음)' : '밤 자시 ('+f(23*60+shift)+'~23:59, 다음 날 일주)';
    if(idx===0) return '자시 ('+f(Math.max(0,shift-60))+'~'+f(60+shift-1)+')';
    var s=idx*120-60+shift; return BR[idx]+' ('+f(s)+'~'+f(s+119)+')';
  }
  var PAIRS={cHour:'cBirth',callHour:'callBirth',rHour:'rBirth',zHour:'zBirth',pHour:'pBirth',birthHour:'birth'};
  function upgradeSelect(sel){
    if(!sel||sel.dataset.cheonunHour) return; sel.dataset.cheonunHour='1';
    // value 속성이 없는 <option>자시</option>은 글자를 바꾸면 값도 바뀌므로 먼저 값을 고정한다.
    Array.prototype.forEach.call(sel.options,function(o){ if(o.getAttribute('value')===null){ var t=o.text.trim().split(' ')[0]; o.setAttribute('value', BR.indexOf(t)>=0?t:(t==='시간을'||t==='모름'?'':o.text.trim())); } });
    var zi=Array.prototype.find.call(sel.options,function(o){return o.value==='자시';});
    if(zi && !Array.prototype.some.call(sel.options,function(o){return o.value==='야자시';})){
      var late=document.createElement('option'); late.value='야자시'; late.text='밤 자시'; sel.insertBefore(late,zi);
    }
    var birth=document.getElementById(PAIRS[sel.id]);
    function relabel(){
      var ds=birth&&birth.value; var cal=document.getElementById(sel.id==='zHour'?'zCalendar':sel.id==='cHour'?'cLunar':'');
      if(ds && cal && cal.value==='음력' && root.KoreanLunar){ try{var q=ds.split(/[-.\/]/).map(Number);ds=root.KoreanLunar.lunarToSolar(q[0],q[1],q[2],false);}catch(e){} }
      Array.prototype.forEach.call(sel.options,function(o){var i=BR.indexOf(o.value); if(o.value==='야자시') o.text=labelFor(ds,0,true); else if(i>=0) o.text=labelFor(ds,i,false);});
    }
    relabel(); if(birth){birth.addEventListener('change',relabel);birth.addEventListener('input',relabel);}
  }
  function upgradeAll(){ Object.keys(PAIRS).forEach(function(id){upgradeSelect(document.getElementById(id));}); }
  if(typeof document!=='undefined'){
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',upgradeAll); else upgradeAll();
    root.CheonunUpgradeHourSelects=upgradeAll;
  }
})(typeof window!=='undefined'?window:globalThis);
