/* 천운 정밀 사주 엔진 v3 (2026-11-08 재검증판)
 * lunar-javascript 1.7.7 + 한국 음력표 + 한국 표준시 이력
 * 2026-11-08 사주랩 만세력 대조에서 찾은 차이를 고친 판:
 *  1) 대운수: lunar-javascript의 시작 나이(허세, +1) 대신 한국 만세력 방식 반올림(절입까지 일수 / 3) 사용
 *  2) 절기(입춘·월 바뀜) 비교: lunar-javascript는 중국 표준시(UTC+8) 기준이라 한국 시각을 그대로 넣으면 1시간 어긋남 → UTC+8로 바꿔서 비교
 *  3) 일주·시주: 한국 경도(동경 127.5도) 기준 지방시(UTC+8:30)로 계산, 밤 11시 이후(야자시)는 다음 날 일주
 *  4) 1948~1961년 서머타임·UTC+8:30 표준시, 1987~1988년 서머타임을 시각 입력에 반영
 * 시진만 아는 경우: 그 시진의 가운데(지방시 기준, 예: 오시 12:00 지방시)로 계산한다.
 */
(function(root){
  'use strict';
  if(!root.Solar) return;
  var ENGINE_VERSION = 'lunar-javascript 1.7.7 · 한국 표준시 보정 v3';
  var BRANCHES = ['자시','축시','인시','묘시','진시','사시','오시','미시','신시','유시','술시','해시'];
  var STEM_MAP = {'甲':'갑','乙':'을','丙':'병','丁':'정','戊':'무','己':'기','庚':'경','辛':'신','壬':'임','癸':'계'};
  var BRANCH_MAP = {'子':'자','丑':'축','寅':'인','卯':'묘','辰':'진','巳':'사','午':'오','未':'미','申':'신','酉':'유','戌':'술','亥':'해'};
  var LMT_OFFSET = 510; // 동경 127.5도 = UTC+8:30 (한국 만세력 관례: 표준시 -30분)
  var CST_OFFSET = 480; // lunar-javascript 절기표 기준 UTC+8
  function koPillar(v){return String(v||'').split('').map(function(ch){return STEM_MAP[ch]||BRANCH_MAP[ch]||ch;}).join('');}
  function pad(n){return (n<10?'0':'')+n;}
  function parseYmd(value){
    var p=String(value||'').split(/[-.\/]/).map(Number);
    if(p.length!==3 || p.some(function(n){return !Number.isFinite(n);})) throw new Error('생년월일 형식을 확인해 주세요.');
    return p;
  }

  // 서울 벽시계 시각 → UTC 기준 분(분 단위 epoch). 서머타임·UTC+8:30 시기를 브라우저 시간대 자료(Asia/Seoul)로 반영.
  var _fmt=null;
  function seoulOffsetAt(utcMs){
    try{
      if(!_fmt) _fmt=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
      var o={}; _fmt.formatToParts(new Date(utcMs)).forEach(function(x){o[x.type]=x.value;});
      var wall=Date.UTC(+o.year,+o.month-1,+o.day,+o.hour%24,+o.minute);
      return Math.round((wall-utcMs)/60000);
    }catch(e){ return 540; }
  }
  function seoulWallToUtc(y,m,d,h,mi){
    var wall=Date.UTC(y,m-1,d,h,mi);
    var off=540;
    for(var i=0;i<3;i++){ off=seoulOffsetAt(wall-off*60000); }
    return {utc:wall-off*60000, offset:off};
  }

  // 시간 입력 해석: '오시' 같은 시진, '야자시'(밤 23:30~24:00), 'HH:MM' 시계 시각 모두 받는다.
  // 반환: {utc, lmt:{y,m,d,h,mi}, branch, note, offset}
  function resolveBirthMoment(y,m,d,hourStr){
    var hs=String(hourStr||'').trim();
    var clock=hs.match(/^(\d{1,2}):(\d{2})$/);
    var utc, note='', offset=null, lateZi=false;
    if(clock){
      var r=seoulWallToUtc(y,m,d,+clock[1],+clock[2]); utc=r.utc; offset=r.offset;
      if(offset!==540) note='출생 당시 한국 시각 기준 UTC+'+Math.floor(offset/60)+(offset%60?':'+pad(offset%60):'')+(offset>=570?' (서머타임 포함)':'')+' 반영';
    } else {
      var idx = hs==='야자시' ? 0 : BRANCHES.indexOf(hs);
      lateZi = hs==='야자시';
      if(idx<0){ // 시간 모름: 정오(지방시) 기준, 시주 없음
        utc=Date.UTC(y,m-1,d,12,0)-LMT_OFFSET*60000;
      } else {
        // 시진 가운데 = 지방시 짝수 시각(자 00:00, 축 02:00 …). 야자시는 입력 날짜의 밤 23:30(지방시) → 다음 날 자시.
        var lmtMin = lateZi ? (23*60+30) : idx*120;
        utc=Date.UTC(y,m-1,d,0,0)+lmtMin*60000-LMT_OFFSET*60000;
        if(idx===0 && !lateZi) utc=Date.UTC(y,m-1,d,0,30)-LMT_OFFSET*60000; // 이른 자시: 지방시 00:30(입력 날짜 그대로)
      }
    }
    var l=new Date(utc+LMT_OFFSET*60000);
    var lmt={y:l.getUTCFullYear(),m:l.getUTCMonth()+1,d:l.getUTCDate(),h:l.getUTCHours(),mi:l.getUTCMinutes()};
    var minutes=lmt.h*60+lmt.mi;
    var bIdx=Math.floor(((minutes+60)%1440)/120);
    return {utc:utc, lmt:lmt, branchIndex:bIdx, branch:BRANCHES[bIdx], lateZi: minutes>=23*60, note:note, offset:offset, known: !!clock || BRANCHES.indexOf(hs)>=0 || lateZi};
  }

  function solarFromUtc(utc, offsetMin){
    var t=new Date(utc+offsetMin*60000);
    return root.Solar.fromYmdHms(t.getUTCFullYear(),t.getUTCMonth()+1,t.getUTCDate(),t.getUTCHours(),t.getUTCMinutes(),0);
  }

  function calcSajuPrecise(birthStr,hourStr,gender,calendar,isLeap){
    if(!birthStr) return null;
    var solarBirth = birthStr;
    if(calendar==='음력'){
      if(!root.KoreanLunar) throw new Error('한국 음력 변환표를 불러오지 못했습니다.');
      var lp=parseYmd(birthStr);
      solarBirth=root.KoreanLunar.lunarToSolar(lp[0],lp[1],lp[2],!!isLeap);
    }
    var p=parseYmd(solarBirth), y=p[0], m=p[1], d=p[2];
    var mo=resolveBirthMoment(y,m,d,hourStr);
    var hasHour=mo.known;

    // 연주·월주·대운: 절기 순간 비교라 실제 순간을 UTC+8로 바꿔 넣는다.
    var cstSolar=solarFromUtc(mo.utc,CST_OFFSET);
    var eCst=cstSolar.getLunar().getEightChar();
    // 일주·시주: 한국 지방시(UTC+8:30), 밤 11시 이후는 다음 날 일주(sect 1)
    var lmtSolar=solarFromUtc(mo.utc,LMT_OFFSET);
    var eLmt=lmtSolar.getLunar().getEightChar();
    if(eLmt.setSect) eLmt.setSect(1);

    var yp=koPillar(eCst.getYear()), mp=koPillar(eCst.getMonth());
    var dp=koPillar(eLmt.getDay());
    var hp=hasHour?koPillar(eLmt.getTime()):'미상';
    var ilgan=STEM_MAP[eLmt.getDayGan()]||eLmt.getDayGan();

    var genderCode=gender==='남성'?1:0;
    var yun=eCst.getYun(genderCode);
    // 한국 만세력 대운수: 절입까지 걸린 날 / 3 을 반올림 (예: 9년 11개월 → 10)
    var daeunSu=Math.round(yun.getStartYear()+yun.getStartMonth()/12+(yun.getStartDay?yun.getStartDay():0)/360);
    if(daeunSu<1) daeunSu=1;
    var rawDaYun=yun.getDaYun().filter(function(dw){return dw.getGanZhi && dw.getGanZhi();});
    var daeunList=rawDaYun.slice(0,10).map(function(dw,i){
      var sa=daeunSu+i*10;
      return {pillar:koPillar(dw.getGanZhi()),startAge:sa,endAge:sa+9,startYear:y+sa-1,endYear:y+sa+8};
    });

    var now=new Date(Date.now()+9*3600000);
    var currentYear=now.getUTCFullYear(), nextYear=currentYear+1;
    var nominalAge=currentYear-y+1; // 세는나이 (사주랩 만세력과 같은 기준)
    var fullAge=Math.max(0,currentYear-y-((now.getUTCMonth()+1<m||(now.getUTCMonth()+1===m&&now.getUTCDate()<d))?1:0));
    var current=daeunList.find(function(dw){return nominalAge>=dw.startAge && nominalAge<=dw.endAge;}) || null;
    function yearPillarOn(yy,mm,dd){ return koPillar(root.Solar.fromYmdHms(yy,mm,dd,12,0,0).getLunar().getEightChar().getYear()); }
    var seunNow=yearPillarOn(currentYear,now.getUTCMonth()+1,now.getUTCDate());
    var seunNext=yearPillarOn(nextYear,6,1);
    var lunarObj=root.KoreanLunar?root.KoreanLunar.solarToLunar(y,m,d):null;
    var lunarBirth=lunarObj?(lunarObj.year+'년 '+(lunarObj.isLeap?'윤':'')+lunarObj.month+'월 '+lunarObj.day+'일'):'';
    return {
      year:y,month:m,day:d,inputBirth:birthStr,inputCalendar:calendar||'양력',inputLeap:!!isLeap,solarBirth:solarBirth,
      inputHour:hourStr||'',hourBranch:hasHour?mo.branch:'',lateZi:mo.lateZi,timeNote:mo.note,
      yp:yp,mp:mp,dp:dp,hp:hp,ilgan:ilgan,
      daeunStart:daeunSu,daeunSu:daeunSu,
      curDaeun:current?current.pillar:'대운 전',curDaeunAge:current?current.startAge:daeunSu,
      curDaeunEndAge:current?current.endAge:null,daeunList:daeunList,
      seun2026:seunNow,seun2027:seunNext,thisYear:currentYear,nextYear:nextYear,
      age:nominalAge,nominalAge:nominalAge,fullAge:fullAge,ageBasis:'세는나이',
      lunarBirth:lunarBirth,isForward:!!(typeof yun.isForward==='function'?yun.isForward():yun.isForward),
      engineVersion:ENGINE_VERSION,calendarVersion:'한국 음력표(KARI 기준)',
      timePolicy:'한국 경도 보정(표준시 -30분)·야자시 다음 날 일주·서머타임 반영, 시진만 알면 시진 가운데 기준',
      pillarsText:'년주 '+yp+' / 월주 '+mp+' / 일주 '+dp+' / 시주 '+hp
    };
  }
  root.calcSaju=calcSajuPrecise;
  root.CheonunTime={resolveBirthMoment:resolveBirthMoment,seoulWallToUtc:seoulWallToUtc,BRANCHES:BRANCHES,LMT_OFFSET:LMT_OFFSET};
})(typeof window!=='undefined'?window:globalThis);
