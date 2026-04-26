// 漢字チャレンジGO - 問題データ (ベース)
const QUESTIONS = {};
function _pq(s) {
  return s.split(",").map(function (e) {
    var p = e.split("|");
    return { kanji: p[0], yomi: p[1] };
  });
}
function _add(level, s) {
  if (!QUESTIONS[level]) QUESTIONS[level] = [];
  QUESTIONS[level] = QUESTIONS[level].concat(_pq(s));
}
