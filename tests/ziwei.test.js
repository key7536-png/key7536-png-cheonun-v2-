const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = {
  iztro: require('iztro'),
  console
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'public', 'ziwei.js'), 'utf8'),
  context,
  { filename: 'ziwei.js' }
);

const chart = context.CheonunZiwei.calculate({
  birth: '1969-9-12',
  hour: '묘시',
  gender: '여성',
  calendar: '양력',
  targetDate: '2026-8-24'
});

assert.equal(chart.solarDate, '1969-9-12');
assert.equal(chart.soulPalace, '오');
assert.equal(chart.bodyPalace, '자');
assert.equal(chart.fiveElementsClass, '토오국');
assert.equal(chart.palaces.length, 12);

const soul = chart.palaces.find((palace) => palace.name === '명궁');
const wealth = chart.palaces.find((palace) => palace.name === '재백');
assert.ok(soul.majorStars.some((star) => star.name === '자미'));
assert.ok(wealth.majorStars.some((star) => star.name === '무곡' && star.mutagen === '화록'));
assert.equal(chart.current.decadalPalace, '노복');
assert.equal(chart.current.yearlyPalace, '명궁');

assert.throws(
  () => context.CheonunZiwei.calculate({ birth: '1969-9-12', hour: '', gender: '여성', calendar: '양력' }),
  /태어난 시간이 필요/
);

const prompt = context.CheonunZiwei.toPrompt(chart);
assert.match(prompt, /명궁:오/);
assert.match(prompt, /무곡\(화록\)/);
assert.match(prompt, /현재 대한:노복/);

const lunarChart = context.CheonunZiwei.calculate({
  birth: '1969-8-1',
  hour: '묘시',
  gender: '여성',
  calendar: '음력',
  isLeap: false,
  targetDate: '2026-8-24'
});
assert.equal(lunarChart.solarDate, chart.solarDate);
assert.equal(lunarChart.soulPalace, chart.soulPalace);
assert.equal(lunarChart.bodyPalace, chart.bodyPalace);

// 실제 고객 회귀값: 음력 1969-08-05 평달, 남성, 묘시
const maleLunarChart = context.CheonunZiwei.calculate({
  birth: '1969-8-5', hour: '묘시', gender: '남성', calendar: '음력', isLeap: false, targetDate: '2026-8-24'
});
assert.equal(maleLunarChart.solarDate, '1969-9-16');
assert.equal(maleLunarChart.soulPalace, '오');
assert.equal(maleLunarChart.bodyPalace, '자');
assert.equal(maleLunarChart.fiveElementsClass, '토오국');
assert.equal(maleLunarChart.soulStar, '파군');
assert.equal(maleLunarChart.bodyStar, '천동');
assert.equal(maleLunarChart.current.decadalPalace, '질액');

console.log('ziwei tests passed');
