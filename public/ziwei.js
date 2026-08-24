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
    const chart = isLunar
      ? root.iztro.astro.byLunar(birth, hourIndex, gender, !!options.isLeap, true, 'ko-KR')
      : root.iztro.astro.bySolar(birth, hourIndex, gender, true, 'ko-KR');

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
      lunarDate: chart.lunarDate,
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
