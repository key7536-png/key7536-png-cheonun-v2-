/* 천운 정밀 사주 엔진: lunar-javascript 1.7.7 + 한국 음력표 */
(function(root){
  'use strict';
  if(!root.Solar) return;
  var HOUR_CENTER = {
    '자시':[0,30], '축시':[2,30], '인시':[4,30], '묘시':[6,30],
    '진시':[8,30], '사시':[10,30], '오시':[12,30], '미시':[14,30],
    '신시':[16,30], '유시':[18,30], '술시':[20,30], '해시':[22,30]
  };
  var ENGINE_VERSION = 'lunar-javascript 1.7.7';
  var STEM_MAP = {'甲':'갑','乙':'을','丙':'병','丁':'정','戊':'무','己':'기','庚':'경','辛':'신','壬':'임','癸':'계'};
  var BRANCH_MAP = {'子':'자','丑':'축','寅':'인','卯':'묘','辰':'진','巳':'사','午':'오','未':'미','申':'신','酉':'유','戌':'술','亥':'해'};
  function koPillar(v){return String(v||'').split('').map(function(ch){return STEM_MAP[ch]||BRANCH_MAP[ch]||ch;}).join('');}
  function daysInMonth(y,m){ return new Date(Date.UTC(y,m,0)).getUTCDate(); }
  function fullAge(y,m,d,now){
    var a = now.getFullYear()-y;
    var before = (now.getMonth()+1<m) || (now.getMonth()+1===m && now.getDate()<d);
    return Math.max(0,a-(before?1:0));
  }
  function parseSolar(value){
    var p=String(value||'').split('-').map(Number);
    if(p.length!==3 || p.some(function(n){return !Number.isFinite(n);})){ throw new Error('생년월일 형식을 확인해 주세요.'); }
    return p;
  }
  function toKoreanLunarText(lunar){
    try{return lunar.getYear()+'년 '+lunar.getMonth()+'월 '+lunar.getDay()+'일';}catch(e){return '';}
  }
  function makePillarInfo(e){
    return {yp:koPillar(e.getYear()),mp:koPillar(e.getMonth()),dp:koPillar(e.getDay()),hp:koPillar(e.getTime()),ilgan:STEM_MAP[e.getDayGan()]||e.getDayGan()};
  }
  function calcSajuPrecise(birthStr,hourStr,gender,calendar,isLeap){
    if(!birthStr) return null;
    var solarBirth = birthStr;
    if(calendar==='음력'){
      if(!root.KoreanLunar) throw new Error('한국 음력 변환표를 불러오지 못했습니다.');
      var lp=String(birthStr).split('-').map(Number);
      solarBirth=root.KoreanLunar.lunarToSolar(lp[0],lp[1],lp[2],!!isLeap);
    }
    var p=parseSolar(solarBirth), y=p[0], m=p[1], d=p[2];
    var hm=HOUR_CENTER[hourStr]||[12,0];
    var solar=root.Solar.fromYmdHms(y,m,d,hm[0],hm[1],0);
    var lunar=solar.getLunar();
    var e=lunar.getEightChar();
    var pillars=makePillarInfo(e);
    var genderCode=gender==='남성'?1:0;
    var yun=e.getYun(genderCode);
    var rawDaYun=yun.getDaYun();
    var daeunList=rawDaYun.filter(function(dw){return dw.getGanZhi && dw.getGanZhi();}).map(function(dw){
      return {pillar:koPillar(dw.getGanZhi()),startAge:dw.getStartAge(),endAge:dw.getEndAge(),startYear:dw.getStartYear(),endYear:dw.getEndYear()};
    });
    var now=new Date(), currentYear=now.getFullYear(), nextYear=currentYear+1;
    var nominalAge=currentYear-y+1;
    var current=daeunList.find(function(dw){return nominalAge>=dw.startAge && nominalAge<=dw.endAge;}) || daeunList[daeunList.length-1] || null;
    function yearPillar(yy){
      var mm=Math.min(now.getMonth()+1,12), dd=Math.min(now.getDate(),daysInMonth(yy,mm));
      return koPillar(root.Solar.fromYmdHms(yy,mm,dd,12,0,0).getLunar().getEightChar().getYear());
    }
    return {
      year:y,month:m,day:d,inputBirth:birthStr,inputCalendar:calendar||'양력',inputLeap:!!isLeap,solarBirth:solarBirth,
      yp:pillars.yp,mp:pillars.mp,dp:pillars.dp,hp:pillars.hp,ilgan:pillars.ilgan,
      daeunStart:daeunList.length?daeunList[0].startAge:null,
      curDaeun:current?current.pillar:'',curDaeunAge:current?current.startAge:null,
      curDaeunEndAge:current?current.endAge:null,daeunList:daeunList,
      seun2026:yearPillar(currentYear),seun2027:yearPillar(nextYear),thisYear:currentYear,nextYear:nextYear,
      age:fullAge(y,m,d,now),fullAge:fullAge(y,m,d,now),nominalAge:nominalAge,
      lunarBirth:toKoreanLunarText(lunar),isForward:!!(typeof yun.isForward==='function'?yun.isForward():yun.isForward),
      engineVersion:ENGINE_VERSION,calendarVersion:'한국 음력표(KARI 기준)',timePolicy:'12지 시진 중앙시각(분 단위 출생시각 미입력)',
      pillarsText:'년주 '+pillars.yp+' / 월주 '+pillars.mp+' / 일주 '+pillars.dp+' / 시주 '+pillars.hp
    };
  }
  root.calcSaju=calcSajuPrecise;
})(typeof window!=='undefined'?window:globalThis);
