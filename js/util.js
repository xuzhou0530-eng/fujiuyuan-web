/**
 * 通用工具函数
 */
function formatDate(year, month, day) {
  return year + '年' + String(month).padStart(2, '0') + '月' + String(day).padStart(2, '0') + '日';
}

function formatTime(hour, minute) {
  return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
}

function getNowDateStr() {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
}

function saveHistory(inputInfo, baziData, aiResult) {
  var history = JSON.parse(localStorage.getItem('bazi_history') || 'null') || [];
  history.unshift({
    id: Date.now(),
    date: getNowDateStr(),
    input: inputInfo,
    bazi: baziData,
    result: aiResult
  });
  if (history.length > 20) history.pop();
  localStorage.setItem('bazi_history', JSON.stringify(history));
  return history;
}

function getHistory() {
  return JSON.parse(localStorage.getItem('bazi_history') || 'null') || [];
}
