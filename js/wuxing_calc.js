/**
 * 五行能量/个数 双模块统计算法
 * ================================
 * 对齐市面主流专业排盘APP（如问真、论八字、八字排盘宝等）
 *
 * 模块1：五行能量(含藏干) — 月令旺衰加权算法（柱状图主展示）
 * 模块2：五行个数(不含藏干) — 纯字面计数，仅天干+地支本气
 *
 * 测试用例：辛巳 癸巳 癸巳 丙辰，巳月
 *   模块1预期：金≈12% 木≈3% 水≈10% 火≈51% 土≈24% 同党≈27% 异党≈73%
 *   模块2预期：金≈13% 木≈0% 水≈25% 火≈49% 土≈13%
 */

// ============================================================
// SECTION 0：常量表
// ============================================================

/** 天干→五行 */
var GAN_WX = {
  '甲':'木','乙':'木','丙':'火','丁':'火',
  '戊':'土','己':'土','庚':'金','辛':'金',
  '壬':'水','癸':'水'
};

/** 地支→本气五行 */
var ZHI_WX = {
  '子':'水','丑':'土','寅':'木','卯':'木',
  '辰':'土','巳':'火','午':'火','未':'土',
  '申':'金','酉':'金','戌':'土','亥':'水'
};

/** 五行生克：我生、我克、生我、克我 */
var WX_REL = {
  '金': { sheng:'水', ke:'木', beiSheng:'土', beiKe:'火' },
  '木': { sheng:'火', ke:'土', beiSheng:'水', beiKe:'金' },
  '水': { sheng:'木', ke:'火', beiSheng:'金', beiKe:'土' },
  '火': { sheng:'土', ke:'金', beiSheng:'木', beiKe:'水' },
  '土': { sheng:'金', ke:'水', beiSheng:'火', beiKe:'木' }
};

/**
 * 十二地支完整藏干表（不可删减任何藏干）
 * 标注：(本)=本气1分 (余)=长生余气0.3分 (墓)=墓库杂气0.1分
 * 对齐主流APP通用藏干分值体系
 */
var HIDDEN_STEM_TABLE = {
  '子': [{ stem:'癸', type:'ben',  score:1.0 }],
  '丑': [{ stem:'己', type:'ben',  score:1.0 },
         { stem:'辛', type:'yu',   score:0.3 },
         { stem:'癸', type:'mu',   score:0.1 }],
  '寅': [{ stem:'甲', type:'ben',  score:1.0 },
         { stem:'丙', type:'yu',   score:0.3 },
         { stem:'戊', type:'mu',   score:0.1 }],
  '卯': [{ stem:'乙', type:'ben',  score:1.0 }],
  '辰': [{ stem:'戊', type:'ben',  score:1.0 },
         { stem:'乙', type:'mu',   score:0.1 },
         { stem:'癸', type:'mu',   score:0.1 }],
  '巳': [{ stem:'丙', type:'ben',  score:1.0 },
         { stem:'庚', type:'yu',   score:0.3 },
         { stem:'戊', type:'mu',   score:0.1 }],
  '午': [{ stem:'丁', type:'ben',  score:1.0 },
         { stem:'己', type:'yu',   score:0.3 }],
  '未': [{ stem:'己', type:'ben',  score:1.0 },
         { stem:'乙', type:'mu',   score:0.1 },
         { stem:'丁', type:'mu',   score:0.1 }],
  '申': [{ stem:'庚', type:'ben',  score:1.0 },
         { stem:'壬', type:'yu',   score:0.3 },
         { stem:'戊', type:'mu',   score:0.1 }],
  '酉': [{ stem:'辛', type:'ben',  score:1.0 }],
  '戌': [{ stem:'戊', type:'ben',  score:1.0 },
         { stem:'辛', type:'mu',   score:0.1 },
         { stem:'丁', type:'mu',   score:0.1 }],
  '亥': [{ stem:'壬', type:'ben',  score:1.0 },
         { stem:'甲', type:'yu',   score:0.3 }]
};

/**
 * 月令旺衰倍率表
 * ================
 * 旺×2.0 | 相×1.5 | 休×1.0 | 囚×0.6 | 死×0.4
 *
 * 四季判定规则（以月支为纲）：
 *   寅卯月(春木令)：木旺 火相 水休 金囚 土死
 *   巳午月(夏火令)：火旺 土相 木休 水囚 金死
 *   申酉月(秋金令)：金旺 水相 土休 火囚 木死
 *   亥子月(冬水令)：水旺 木相 金休 土囚 火死
 *   辰戌丑未月(四季土令)：土旺 金相 火休 木囚 水死
 */
var MONTH_RATE_TABLE = {
  // 春季木令（寅、卯月）
  '寅': { '木':2.0, '火':1.5, '水':1.0, '金':0.6, '土':0.4 },
  '卯': { '木':2.0, '火':1.5, '水':1.0, '金':0.6, '土':0.4 },
  // 夏季火令（巳、午月）
  '巳': { '火':2.0, '土':1.5, '木':1.0, '水':0.6, '金':0.4 },
  '午': { '火':2.0, '土':1.5, '木':1.0, '水':0.6, '金':0.4 },
  // 秋季金令（申、酉月）
  '申': { '金':2.0, '水':1.5, '土':1.0, '火':0.6, '木':0.4 },
  '酉': { '金':2.0, '水':1.5, '土':1.0, '火':0.6, '木':0.4 },
  // 冬季水令（亥、子月）
  '亥': { '水':2.0, '木':1.5, '金':1.0, '土':0.6, '火':0.4 },
  '子': { '水':2.0, '木':1.5, '金':1.0, '土':0.6, '火':0.4 },
  // 四季土令（辰、戌、丑、未月）
  '辰': { '土':2.0, '金':1.5, '火':1.0, '木':0.6, '水':0.4 },
  '戌': { '土':2.0, '金':1.5, '火':1.0, '木':0.6, '水':0.4 },
  '丑': { '土':2.0, '金':1.5, '火':1.0, '木':0.6, '水':0.4 },
  '未': { '土':2.0, '金':1.5, '火':1.0, '木':0.6, '水':0.4 }
};

/** 旺相休囚死标签映射（按倍率反查） */
var RATE_LABEL = {
  2.0: '旺',
  1.5: '相',
  1.0: '休',
  0.6: '囚',
  0.4: '死'
};

/** 五行展示顺序 */
var WX_ORDER = ['金', '木', '水', '火', '土'];

/** pinyin映射（CSS类名兼容微信WXSS编译器） */
var PINYIN_MAP = { '金':'jin', '木':'mu', '水':'shui', '火':'huo', '土':'tu' };

/** 旺相休囚死 pinyin映射（微信WXSS不支持中文CSS选择器） */
var RATE_PINYIN = { '旺':'wang', '相':'xiang', '休':'xiu', '囚':'qiu', '死':'si' };

// ============================================================
// SECTION 1：模块1 — 五行能量(含藏干) 月令加权算法
// ============================================================

/**
 * 计算五行能量(含藏干) — 主流APP核心加权算法
 * ==============================================
 *
 * 完整计算步骤（不可颠倒）：
 * 1. 遍历4柱天干，累加天干原始分（每干1分）
 * 2. 遍历4个地支，拆分本气/余气/墓气，累加全部藏干原始分
 * 3. 按出生月令匹配五行旺衰倍率，每个五行总分单独乘以对应倍率
 * 4. 求和五项加权总分，换算百分比，总和强制100%，保留整数
 * 5. 输出同党/异党占比
 * 6. 生成旺相休囚死文字标签
 *
 * @param {object} baziData — paiBaziFull() 的输出结果
 * @returns {object} 结构化五行能量数据（含详细计算日志）
 */
function calcWuxingEnergy(baziData) {
  var pillars = baziData.pillars;
  var monthZhi = pillars.month[1];  // 月支，用于判定旺衰倍率

  // 提取四柱天干
  var yearGan  = pillars.year[0];
  var monthGan = pillars.month[0];
  var dayGan   = pillars.day[0];
  var hourGan  = pillars.hour[0];
  var allGans  = [yearGan, monthGan, dayGan, hourGan];

  // 提取四柱地支
  var yearZhi  = pillars.year[1];
  var monthZhi2 = pillars.month[1];
  var dayZhi   = pillars.day[1];
  var hourZhi  = pillars.hour[1];
  var allZhis  = [yearZhi, monthZhi2, dayZhi, hourZhi];

  // 日主信息
  var dayWx = GAN_WX[dayGan];
  var rel = WX_REL[dayWx];
  var yinWx = rel.beiSheng;  // 印星五行（生我者）

  // ==========================================================
  // 步骤1：天干原始分（每干固定1分）
  // ==========================================================
  var rawScores = { '金':0, '木':0, '水':0, '火':0, '土':0 };
  var ganDetail = [];  // 天干明细

  for (var i = 0; i < allGans.length; i++) {
    var g = allGans[i];
    var wx = GAN_WX[g];
    rawScores[wx] += 1.0;
    ganDetail.push({ stem: g, wuxing: wx, score: 1.0, position: ['年干','月干','日干','时干'][i] });
  }

  // ==========================================================
  // 步骤2：地支藏干原始分（本气1分、余气0.3分、墓气0.1分）
  // ==========================================================
  var zhiDetail = [];  // 地支藏干明细

  for (var j = 0; j < allZhis.length; j++) {
    var z = allZhis[j];
    var hiddenList = HIDDEN_STEM_TABLE[z] || [];
    var posName = ['年支','月支','日支','时支'][j];

    for (var k = 0; k < hiddenList.length; k++) {
      var h = hiddenList[k];
      var wx = GAN_WX[h.stem];
      rawScores[wx] += h.score;

      var typeLabel = h.type === 'ben' ? '本气' : (h.type === 'yu' ? '余气(长生)' : '墓气(杂气)');

      zhiDetail.push({
        zhi: z,
        stem: h.stem,
        wuxing: wx,
        score: h.score,
        type: h.type,
        typeLabel: typeLabel,
        position: posName
      });
    }
  }

  // ==========================================================
  // 步骤3：月令旺衰倍率加权
  // ==========================================================
  var rates = MONTH_RATE_TABLE[monthZhi];
  if (!rates) {
    // fallback：默认休(×1.0)
    rates = { '金':1.0, '木':1.0, '水':1.0, '火':1.0, '土':1.0 };
  }

  var weightedScores = {};
  var weightedDetail = [];  // 加权明细
  var totalRaw = 0;
  var totalWeighted = 0;

  for (var w = 0; w < WX_ORDER.length; w++) {
    var wx = WX_ORDER[w];
    var raw = rawScores[wx];
    var rate = rates[wx];
    var weighted = raw * rate;

    weightedScores[wx] = weighted;
    totalRaw += raw;
    totalWeighted += weighted;

    weightedDetail.push({
      wuxing: wx,
      rawScore: raw,
      rate: rate,
      rateLabel: RATE_LABEL[rate] || '—',
      weightedScore: weighted
    });
  }

  // ==========================================================
  // 步骤4：换算百分比（仅最终展示时取整，中途不四舍五入）
  // ==========================================================
  var percentages = {};
  var displayBars = [];

  // 处理 totalWeighted 为 0 的极端情况
  var divisor = totalWeighted > 0 ? totalWeighted : 1;

  for (var p = 0; p < WX_ORDER.length; p++) {
    var wx = WX_ORDER[p];
    var pct = Math.round((weightedScores[wx] / divisor) * 100);
    percentages[wx] = pct;

    displayBars.push({
      name: PINYIN_MAP[wx],
      label: wx,
      percent: pct,
      rawScore: weightedDetail[p].rawScore,
      weightedScore: weightedDetail[p].weightedScore,
      rate: weightedDetail[p].rate,
      rateLabel: weightedDetail[p].rateLabel,
      rateClass: RATE_PINYIN[weightedDetail[p].rateLabel] || 'xiu'
    });
  }

  // 强制总和=100%（调整最大值）
  var pctSum = 0;
  for (var s = 0; s < WX_ORDER.length; s++) {
    pctSum += percentages[WX_ORDER[s]];
  }
  if (pctSum !== 100 && divisor > 0) {
    // 将差值加到百分比最大的五行上
    var maxWx = WX_ORDER[0];
    for (var m = 1; m < WX_ORDER.length; m++) {
      if (percentages[WX_ORDER[m]] > percentages[maxWx]) {
        maxWx = WX_ORDER[m];
      }
    }
    percentages[maxWx] += (100 - pctSum);
    // 同步修正 displayBars
    for (var d = 0; d < displayBars.length; d++) {
      if (displayBars[d].label === maxWx) {
        displayBars[d].percent = percentages[maxWx];
      }
    }
  }

  // ==========================================================
  // 步骤5：同党/异党占比
  // 同党 = 日主五行 + 印星五行（生我）
  // 异党 = 财 + 官杀 + 食伤
  // ==========================================================
  var sameWx = [dayWx, yinWx];  // 同党五行列表
  var samePct = 0;
  var diffPct = 0;

  for (var t = 0; t < WX_ORDER.length; t++) {
    var wx = WX_ORDER[t];
    if (sameWx.indexOf(wx) >= 0) {
      samePct += percentages[wx];
    } else {
      diffPct += percentages[wx];
    }
  }

  // ==========================================================
  // 步骤6：生成旺相休囚死文字标签
  // ==========================================================
  var wxTags = {};
  for (var u = 0; u < WX_ORDER.length; u++) {
    var wx2 = WX_ORDER[u];
    wxTags[wx2] = RATE_LABEL[rates[wx2]] || '休';
  }

  // 组装计算日志（方便人工核对调试）
  var calcLog = [];
  calcLog.push('===== 五行能量(含藏干) 计算日志 =====');
  calcLog.push('');
  calcLog.push('【输入八字】' + pillars.year + ' ' + pillars.month + ' ' + pillars.day + ' ' + pillars.hour);
  calcLog.push('【月令】' + monthZhi + '月（' + (MONTH_RATE_TABLE[monthZhi] ? JSON.stringify(MONTH_RATE_TABLE[monthZhi]) : '未知') + '）');
  calcLog.push('【日主】' + dayGan + '(' + dayWx + ')，印星=' + yinWx);
  calcLog.push('');
  calcLog.push('--- 步骤1：天干原始分 ---');
  for (var gd = 0; gd < ganDetail.length; gd++) {
    var gdi = ganDetail[gd];
    calcLog.push('  ' + gdi.position + ' ' + gdi.stem + '(' + gdi.wuxing + ') = ' + gdi.score.toFixed(1));
  }
  calcLog.push('');
  calcLog.push('--- 步骤2：地支藏干原始分 ---');
  for (var zd = 0; zd < zhiDetail.length; zd++) {
    var zdi = zhiDetail[zd];
    calcLog.push('  ' + zdi.position + ' ' + zdi.zhi + '中' + zdi.stem + '(' + zdi.wuxing + ') [' + zdi.typeLabel + '] = ' + zdi.score.toFixed(1));
  }
  calcLog.push('');
  calcLog.push('--- 步骤3：原始总分汇总 ---');
  for (var wd = 0; wd < weightedDetail.length; wd++) {
    var wdi = weightedDetail[wd];
    calcLog.push('  ' + wdi.wuxing + ' 原始总分: ' + wdi.rawScore.toFixed(2));
  }
  calcLog.push('  原始总分合计: ' + totalRaw.toFixed(2));
  calcLog.push('');
  calcLog.push('--- 步骤4：月令加权（月支=' + monthZhi + '） ---');
  for (var wd2 = 0; wd2 < weightedDetail.length; wd2++) {
    var wdi2 = weightedDetail[wd2];
    calcLog.push('  ' + wdi2.wuxing + ': ' + wdi2.rawScore.toFixed(2) + ' × ' + wdi2.rate + '（' + wdi2.rateLabel + '） = ' + wdi2.weightedScore.toFixed(2));
  }
  calcLog.push('  加权总分: ' + totalWeighted.toFixed(2));
  calcLog.push('');
  calcLog.push('--- 步骤5：百分比换算 ---');
  for (var wx3 = 0; wx3 < WX_ORDER.length; wx3++) {
    var wxn = WX_ORDER[wx3];
    calcLog.push('  ' + wxn + ': ' + weightedScores[wxn].toFixed(2) + ' / ' + totalWeighted.toFixed(2) + ' = ' + percentages[wxn] + '%');
  }
  calcLog.push('  同党(' + sameWx.join('+') + '): ' + samePct + '%');
  calcLog.push('  异党: ' + diffPct + '%');
  calcLog.push('');
  calcLog.push('--- 步骤6：旺相休囚死标签 ---');
  for (var wx4 = 0; wx4 < WX_ORDER.length; wx4++) {
    var wxn2 = WX_ORDER[wx4];
    calcLog.push('  ' + wxn2 + ': ' + wxTags[wxn2]);
  }
  calcLog.push('');
  calcLog.push('===== 计算完成 =====');

  // 控制台输出完整日志
  console.log(calcLog.join('\n'));

  return {
    // 展示数据
    bars: displayBars,           // 柱状图用 [{name,label,percent,rawScore,weightedScore,rate,rateLabel}]
    percentages: percentages,    // {金:12, 木:3, ...}
    samePercent: samePct,        // 同党占比
    diffPercent: diffPct,        // 异党占比
    sameWuxing: sameWx,          // 同党五行列表
    tags: wxTags,               // 旺相休囚死标签 {金:'死', ...}

    // 原始数据（调试用）
    rawScores: rawScores,
    weightedScores: weightedScores,
    rates: rates,
    monthZhi: monthZhi,
    totalRaw: totalRaw,
    totalWeighted: totalWeighted,

    // 计算日志
    calcLog: calcLog
  };
}

// ============================================================
// SECTION 2：模块2 — 五行个数(不含藏干) 简易统计
// ============================================================

/**
 * 计算五行个数(不含藏干) — 纯字面计数
 * ======================================
 * 规则：
 * 1. 天干每个五行计1个
 * 2. 每个地支只取本气五行计1个
 * 3. 仅展示个数+简单百分比，无月令加权
 * 4. 忽略所有余气、杂气、暗藏
 *
 * @param {object} baziData — paiBaziFull() 的输出结果
 * @returns {object} 结构化五行个数数据
 */
function calcWuxingCount(baziData) {
  var pillars = baziData.pillars;

  // 提取天干
  var allGans = [
    pillars.year[0],
    pillars.month[0],
    pillars.day[0],
    pillars.hour[0]
  ];

  // 提取地支
  var allZhis = [
    pillars.year[1],
    pillars.month[1],
    pillars.day[1],
    pillars.hour[1]
  ];

  // 统计
  var counts = { '金':0, '木':0, '水':0, '火':0, '土':0 };
  var detail = [];

  // 天干计数
  for (var i = 0; i < allGans.length; i++) {
    var g = allGans[i];
    var wx = GAN_WX[g];
    counts[wx] += 1;
    detail.push({
      source: ['年干','月干','日干','时干'][i],
      stem: g,
      wuxing: wx,
      count: 1,
      type: '天干'
    });
  }

  // 地支本气计数（仅本气，忽略所有藏干）
  for (var j = 0; j < allZhis.length; j++) {
    var z = allZhis[j];
    var wx = ZHI_WX[z];
    counts[wx] += 1;
    detail.push({
      source: ['年支','月支','日支','时支'][j],
      stem: z,
      wuxing: wx,
      count: 1,
      type: '地支本气'
    });
  }

  // 月令倍率（旺相休囚死标签，与柱状图一起用）
  var monthZhi = pillars.month[1];
  var rates = MONTH_RATE_TABLE[monthZhi] || { '金':1.0, '木':1.0, '水':1.0, '火':1.0, '土':1.0 };

  // 计算总数和百分比
  var totalCount = 0;
  for (var k = 0; k < WX_ORDER.length; k++) {
    totalCount += counts[WX_ORDER[k]];
  }

  var displayBars = [];
  var percentages = {};
  var pctSum = 0;
  var maxWx = WX_ORDER[0];

  for (var p = 0; p < WX_ORDER.length; p++) {
    var wx = WX_ORDER[p];
    var pct = totalCount > 0 ? Math.round((counts[wx] / totalCount) * 100) : 0;
    percentages[wx] = pct;
    pctSum += pct;

    if (pct > (percentages[maxWx] || 0)) {
      maxWx = wx;
    }

    displayBars.push({
      name: PINYIN_MAP[wx],
      label: wx,
      count: counts[wx],
      percent: pct,
      rateLabel: RATE_LABEL[rates[wx]] || '休',
      rateClass: RATE_PINYIN[RATE_LABEL[rates[wx]] || '休'] || 'xiu'
    });
  }

  // 强制总和=100%
  if (pctSum !== 100 && totalCount > 0) {
    percentages[maxWx] += (100 - pctSum);
    for (var d = 0; d < displayBars.length; d++) {
      if (displayBars[d].label === maxWx) {
        displayBars[d].percent = percentages[maxWx];
      }
    }
  }

  // ==========================================================
  // 同党/异党（基于个数百分比，逻辑同模块1）
  // ==========================================================
  var dayWx = GAN_WX[pillars.day[0]];
  var rel = WX_REL[dayWx];
  var yinWx = rel.beiSheng;
  var sameWx = [dayWx, yinWx];
  var samePct = 0;
  var diffPct = 0;

  for (var t = 0; t < WX_ORDER.length; t++) {
    var wx = WX_ORDER[t];
    if (sameWx.indexOf(wx) >= 0) {
      samePct += percentages[wx];
    } else {
      diffPct += percentages[wx];
    }
  }

  // 旺相休囚死标签（复用上面已定义的 monthZhi / rates）
  var wxTags = {};
  for (var u = 0; u < WX_ORDER.length; u++) {
    var wx2 = WX_ORDER[u];
    wxTags[wx2] = RATE_LABEL[rates[wx2]] || '休';
  }

  // 计算日志
  var calcLog = [];
  calcLog.push('===== 五行个数(不含藏干) 计算日志 =====');
  calcLog.push('');
  calcLog.push('【输入八字】' + pillars.year + ' ' + pillars.month + ' ' + pillars.day + ' ' + pillars.hour);
  calcLog.push('【日主】' + pillars.day[0] + '(' + dayWx + ')，印星=' + yinWx);
  calcLog.push('');
  calcLog.push('--- 逐项计数 ---');
  for (var di = 0; di < detail.length; di++) {
    var di2 = detail[di];
    calcLog.push('  ' + di2.source + ' ' + di2.stem + ' → ' + di2.wuxing + ' +1');
  }
  calcLog.push('');
  calcLog.push('--- 汇总 ---');
  for (var ci = 0; ci < WX_ORDER.length; ci++) {
    var wx3 = WX_ORDER[ci];
    calcLog.push('  ' + wx3 + ': ' + counts[wx3] + '个 = ' + percentages[wx3] + '%（' + wxTags[wx3] + '）');
  }
  calcLog.push('  总计: ' + totalCount + '个');
  calcLog.push('  同党(' + sameWx.join('+') + '): ' + samePct + '%');
  calcLog.push('  异党: ' + diffPct + '%');
  calcLog.push('');
  calcLog.push('===== 计算完成 =====');

  console.log(calcLog.join('\n'));

  return {
    bars: displayBars,         // [{name, label, count, percent}]
    percentages: percentages,  // {金:13, 木:0, ...}
    counts: counts,            // {金:1, 木:0, ...}
    totalCount: totalCount,
    samePercent: samePct,      // 同党占比（个数口径）
    diffPercent: diffPct,      // 异党占比（个数口径）
    sameWuxing: sameWx,        // 同党五行列表
    tags: wxTags,              // 旺相休囚死标签
    detail: detail,
    calcLog: calcLog
  };
}

// ============================================================
// SECTION 3：自测试
// ============================================================

/**
 * 自测试：验证标准测试盘输出
 * 八字：辛巳 癸巳 癸巳 丙辰，巳月
 */
function selftest() {
  // 构造模拟 baziData（与 paiBaziFull 输出格式一致）
  var mockBaziData = {
    pillars: {
      year: '辛巳',
      month: '癸巳',
      day: '癸巳',
      hour: '丙辰'
    },
    riZhu: '癸',
    riZhuWuxing: '水'
  };

  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║  五行统计算法 自测试                  ║');
  console.log('║  测试盘：辛巳 癸巳 癸巳 丙辰 (巳月)   ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  // --- 模块1测试 ---
  console.log('>>> 模块1：五行能量(含藏干) 月令加权算法 <<<');
  var energy = calcWuxingEnergy(mockBaziData);

  console.log('');
  console.log('【模块1 最终结果】');
  for (var i = 0; i < energy.bars.length; i++) {
    var b = energy.bars[i];
    console.log('  ' + b.label + ': ' + b.percent + '% (原始' + b.rawScore.toFixed(2) + ' × ' + b.rate + '[' + b.rateLabel + '] = 加权' + b.weightedScore.toFixed(2) + ')');
  }
  console.log('  同党(' + energy.sameWuxing.join('+') + '): ' + energy.samePercent + '%');
  console.log('  异党: ' + energy.diffPercent + '%');
  console.log('  旺衰标签: ' + JSON.stringify(energy.tags));

  // 对比预期
  console.log('');
  console.log('【对比预期】');
  var expected = { '金':12, '木':3, '水':10, '火':51, '土':24 };
  var allClose = true;
  for (var e = 0; e < WX_ORDER.length; e++) {
    var wx = WX_ORDER[e];
    var actual = energy.percentages[wx];
    var exp = expected[wx];
    var diff = Math.abs(actual - exp);
    var status = diff <= 5 ? '✓ 贴近' : '✗ 偏差较大(' + diff + '%)';
    if (diff > 5) allClose = false;
    console.log('  ' + wx + ': 实际' + actual + '% vs 预期' + exp + '% — ' + status);
  }
  console.log('  同党: 实际' + energy.samePercent + '% vs 预期~27%');
  console.log('  异党: 实际' + energy.diffPercent + '% vs 预期~73%');

  // --- 模块2测试 ---
  console.log('');
  console.log('>>> 模块2：五行个数(不含藏干) 简易统计 <<<');
  var count = calcWuxingCount(mockBaziData);

  console.log('');
  console.log('【模块2 最终结果】');
  for (var j = 0; j < count.bars.length; j++) {
    var c = count.bars[j];
    console.log('  ' + c.label + ': ' + c.count + '个 = ' + c.percent + '%');
  }
  console.log('  总计: ' + count.totalCount + '个');

  console.log('');
  console.log('【对比预期】');
  var expected2 = { '金':13, '木':0, '水':25, '火':49, '土':13 };
  for (var e2 = 0; e2 < WX_ORDER.length; e2++) {
    var wx2 = WX_ORDER[e2];
    var actual2 = count.percentages[wx2];
    var exp2 = expected2[wx2];
    var diff2 = Math.abs(actual2 - exp2);
    var status2 = diff2 <= 3 ? '✓ 贴近' : '偏差' + diff2 + '%';
    console.log('  ' + wx2 + ': 实际' + actual2 + '% vs 预期' + exp2 + '% — ' + status2);
  }

  console.log('');
  if (allClose) {
    console.log('===== 自测试通过 ✓ =====');
  } else {
    console.log('===== 自测试完成（部分数值有偏差，需人工核对） =====');
  }

  return { energy: energy, count: count };
}

// 浏览器全局导出：以上所有函数和常量均为全局可用
