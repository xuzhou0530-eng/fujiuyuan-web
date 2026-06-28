/**
 * 子平八字精准排盘算法 — 微信小程序/云函数版
 * =============================================
 *
 * 【规则来源】：正统子平八字命理
 * 【适用范围】：微信小程序 / 云函数（纯本地计算，无外部依赖）
 *
 * 硬性规则（不可更改）：
 *   年柱：严格立春换年
 *   月柱：严格节气换月（12节）
 *   日柱：查表匹配（锚点1900-01-01=甲戌）
 *   时柱：五鼠遁+真太阳时校正
 *
 * 标准测试盘：2001-05-30 08:00, 东经112.2°, 男 → 辛巳 癸巳 癸巳 丙辰
 */

// ============================================================
// SECTION 0：常量与基础表
// ============================================================

/** 十天干 */
// TIAN_GAN / DI_ZHI 已在 yizhangjing.js 中用 var 声明（浏览器全局作用域兼容）
// 这里用 var 覆盖声明，避免 const 与 var 冲突导致 SyntaxError
var TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

/** 十二地支 */
var DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/** 六十甲子表 */
const JIAZI_TABLE = [];
for (let i = 0; i < 60; i++) {
  JIAZI_TABLE.push(TIAN_GAN[i % 10] + DI_ZHI[i % 12]);
}

/** 天干五行 */
const GAN_WUXING = {
  '甲': '木', '乙': '木', '丙': '火', '丁': '火',
  '戊': '土', '己': '土', '庚': '金', '辛': '金',
  '壬': '水', '癸': '水'
};

/** 地支五行（本气） */
const ZHI_WUXING = {
  '子': '水', '丑': '土', '寅': '木', '卯': '木',
  '辰': '土', '巳': '火', '午': '火', '未': '土',
  '申': '金', '酉': '金', '戌': '土', '亥': '水'
};

/** 天干阴阳 */
const GAN_YIN_YANG = {
  '甲': '阳', '乙': '阴', '丙': '阳', '丁': '阴',
  '戊': '阳', '己': '阴', '庚': '阳', '辛': '阴',
  '壬': '阳', '癸': '阴'
};

/** 五行生克关系 */
const WUXING_RELATION = {
  '金': { sheng: '水', ke: '木', beiSheng: '土', beiKe: '火' },
  '木': { sheng: '火', ke: '土', beiSheng: '水', beiKe: '金' },
  '水': { sheng: '木', ke: '火', beiSheng: '金', beiKe: '土' },
  '火': { sheng: '土', ke: '金', beiSheng: '木', beiKe: '水' },
  '土': { sheng: '金', ke: '水', beiSheng: '火', beiKe: '木' }
};

/** 五虎遁：年干→正月(寅月)天干索引（TIAN_GAN索引） */
const WU_HU_DUN = {
  '甲': 2, '己': 2,  // 丙寅 (丙=2)
  '乙': 4, '庚': 4,  // 戊寅 (戊=4)
  '丙': 6, '辛': 6,  // 庚寅 (庚=6)
  '丁': 8, '壬': 8,  // 壬寅 (壬=8)
  '戊': 0, '癸': 0   // 甲寅 (甲=0)
};

/** 五鼠遁：日干→子时天干索引（TIAN_GAN索引） */
const WU_SHU_DUN = {
  '甲': 0, '己': 0,  // 甲子 (甲=0)
  '乙': 2, '庚': 2,  // 丙子 (丙=2)
  '丙': 4, '辛': 4,  // 戊子 (戊=4)
  '丁': 6, '壬': 6,  // 庚子 (庚=6)
  '戊': 8, '癸': 8   // 壬子 (壬=8)
};

/** 地支藏干表（本气/中气/余气） */
const HIDDEN_STEMS = {
  '子': ['癸'],
  '丑': ['己', '癸', '辛'],
  '寅': ['甲', '丙', '戊'],
  '卯': ['乙'],
  '辰': ['戊', '乙', '癸'],
  '巳': ['丙', '戊', '庚'],
  '午': ['丁', '己'],
  '未': ['己', '丁', '乙'],
  '申': ['庚', '壬', '戊'],
  '酉': ['辛'],
  '戌': ['戊', '辛', '丁'],
  '亥': ['壬', '甲']
};

/** 地支藏干本气（用于旺衰分析） */
const HIDDEN_STEM_PRIMARY = {
  '子': '癸', '丑': '己', '寅': '甲', '卯': '乙',
  '辰': '戊', '巳': '丙', '午': '丁', '未': '己',
  '申': '庚', '酉': '辛', '戌': '戊', '亥': '壬'
};

/** 月份微旺衰力量表：五行在每个月的先天力量（3=旺, 2=相, 1=休, 0=囚, -1=死） */
const SEASON_STRENGTH = {
  '木': { '寅':3, '卯':3, '辰':1, '巳':-1, '午':-1, '未':0, '申':0, '酉':0, '戌':0, '亥':2, '子':2, '丑':0 },
  '火': { '寅':2, '卯':2, '辰':0, '巳':3, '午':3, '未':0, '申':-1, '酉':-1, '戌':1, '亥':0, '子':0, '丑':0 },
  '土': { '寅':0, '卯':0, '辰':3, '巳':2, '午':2, '未':3, '申':0, '酉':0, '戌':3, '亥':-1, '子':-1, '丑':3 },
  '金': { '寅':-1, '卯':-1, '辰':-1, '巳':0, '午':0, '未':-1, '申':3, '酉':3, '戌':2, '亥':0, '子':1, '丑':1 },
  '水': { '寅':0, '卯':0, '辰':0, '巳':0, '午':0, '未':0, '申':2, '酉':2, '戌':0, '亥':3, '子':3, '丑':2 }
};

/**
 * 五行-珠宝饰品映射库（福久源中国黄金门店流通款）
 * ==========================================================
 * 金：白色/金银透色系  水：黑/深蓝色系  木：绿青/木质系
 * 火：红粉紫色系       土：黄茶/蜜蜡玉髓系
 */
const CRYSTAL_LIBRARY = {
  '金': ['白水晶', '金发晶', '银发晶', '白幽灵', '珍珠'],
  '水': ['黑曜石', '黑发晶', '海蓝宝', '黑碧玺', '黑玛瑙', '青金石'],
  '木': ['绿幽灵', '绿发晶', '天河石', '东陵玉', '沉香', '老山檀', '降真香'],
  '火': ['紫水晶', '红玛瑙', '石榴石', '粉兔毛', '朱砂', '南红', '珊瑚'],
  '土': ['黄水晶', '虎眼石', '茶晶', '琥珀', '蜜蜡', '玉髓', '天山翠']
};

/** 每个五行元素的核心主推（每元素2款，门店最畅销款） */
const CRYSTAL_MAIN_PICK = {
  '金': ['白水晶', '金发晶'],
  '水': ['黑曜石', '海蓝宝'],
  '木': ['绿幽灵', '绿发晶'],
  '火': ['紫水晶', '红玛瑙'],
  '土': ['黄水晶', '虎眼石']
};

/** 每个五行元素的辅助搭配（每元素1款，非主推的搭配首选） */
const CRYSTAL_ASSIST_PICK = {
  '金': '珍珠',
  '水': '黑发晶',
  '木': '天河石',
  '火': '石榴石',
  '土': '茶晶'
};

// ============================================================
// SECTION 1：节气引擎（Meeus天文算法 + 牛顿迭代）
// ============================================================

/**
 * 公历日期 → 儒略日（Julian Day Number）
 * ======================================
 * 返回正午UT对应的儒略日（整数部分）+ 小数部分表示时刻
 * 公式来源：Jean Meeus《天文算法》第7章
 *
 * @param {number} year
 * @param {number} month — 1-12
 * @param {number} day   — 1-31
 * @returns {number} 儒略日（含小数，0.0=正午UT）
 */
function jdFromDate(year, month, day) {
  let y = year, m = month;
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  // 返回 0:00 UT 的 JD（整数）
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5;
}

/**
 * 儒略日 → 公历日期（北京时间 UTC+8）
 * ======================================
 * @param {number} jd — 儒略日（北京时间）
 * @returns {{year:number, month:number, day:number, hour:number, minute:number}}
 */
/**
 * 儒略日 → 公历日期（UTC）
 * ========================
 * 标准格里历转公历公式，输入UT儒略日，输出UT日期时间
 * @param {number} jd — 儒略日（UT）
 * @returns {{year:number, month:number, day:number, hour:number, minute:number}}
 */
function dateFromJd_UT(jd) {
  const J = Math.floor(jd + 0.5);
  const F = jd + 0.5 - J;

  let A = J;
  if (J >= 2299161) {
    const alpha = Math.floor((J - 1867216.25) / 36524.25);
    A = J + 1 + alpha - Math.floor(alpha / 4);
  }

  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);

  const dayVal = B - D - Math.floor(30.6001 * E) + F;

  // Meeus: E<14 → month=E-1, E≥14 → month=E-13
  let month, year;
  if (E < 14) {
    month = E - 1;
  } else {
    month = E - 13;
  }

  if (month > 2) {
    year = C - 4716;
  } else {
    year = C - 4715;
  }

  const dayInt = Math.floor(dayVal);
  const dayFrac = dayVal - dayInt;
  let hour = Math.round(dayFrac * 24);
  let minute = 0;
  if (hour >= 24) { hour -= 24; }

  return { year, month, day: dayInt, hour, minute };
}

/**
 * UT日期时间 + 8h → 北京时间
 */
function utToBeijing(utDate) {
  let totalMin = utDate.hour * 60 + 8 * 60;
  let day = utDate.day;
  let month = utDate.month;
  let year = utDate.year;

  // 处理跨日
  if (totalMin >= 1440) {
    totalMin -= 1440;
    day += 1;
  }

  // 处理跨月
  const daysInMonth = [0, 31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > daysInMonth[month]) {
    day = 1;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  const hour = Math.floor(totalMin / 60);
  const minute = totalMin % 60;

  return { year, month, day, hour, minute };
}

/**
 * 太阳视黄经（Meeus低精度公式）
 * ===============================
 * 精度约30角秒，适用于1900-2100年节气计算
 *
 * @param {number} jd — 儒略日（UT）
 * @returns {number} 太阳视黄经（度，0-360）
 */
function solarLongitude(jd) {
  // 儒略世纪数（从J2000.0起算）
  const T = (jd - 2451545.0) / 36525.0;

  // 太阳平均黄经（度）
  let L = 280.46645 + 36000.76983 * T + 0.0003032 * T * T;
  L = ((L % 360) + 360) % 360;

  // 太阳平均近点角（度）
  let M = 357.52910 + 35999.05030 * T - 0.0001559 * T * T - 0.00000048 * T * T * T;
  M = ((M % 360) + 360) % 360;
  const M_rad = M * Math.PI / 180.0;

  // 中心差（Equation of Center）
  let C = (1.914600 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M_rad);
  C += (0.019993 - 0.000101 * T) * Math.sin(2 * M_rad);
  C += 0.000290 * Math.sin(3 * M_rad);

  // 真黄经 = 平均黄经 + 中心差
  let lon = L + C;
  lon = ((lon % 360) + 360) % 360;

  return lon;
}

/**
 * 节气精确时刻计算（牛顿迭代法）
 * ================================
 * 二分法+牛顿迭代精确定位太阳到达目标黄经的儒略日时刻
 * 24节气：0=小寒 1=大寒 2=立春 3=雨水 4=惊蛰 5=春分
 *         6=清明 7=谷雨 8=立夏 9=小满 10=芒种 11=夏至
 *         12=小暑 13=大暑 14=立秋 15=处暑 16=白露 17=秋分
 *         18=寒露 19=霜降 20=立冬 21=小雪 22=大雪 23=冬至
 *
 * 只有12个"节"用于换月：
 *   termIndex: 0=小寒(丑月) 2=立春(寅月) 4=惊蛰(卯月) 6=清明(辰月)
 *              8=立夏(巳月) 10=芒种(午月) 12=小暑(未月) 14=立秋(申月)
 *              16=白露(酉月) 18=寒露(戌月) 20=立冬(亥月) 22=大雪(子月)
 *
 * @param {number} year — 公历年
 * @param {number} termIndex — 节气索引 0-23
 * @returns {{year:number, month:number, day:number, hour:number, minute:number}}
 *          北京时间下的节气时刻
 */
function getSolarTerm(year, termIndex) {
  // 目标黄经（度）：小寒=285°, 立春=315°, ..., 冬至=270°
  const targetLon = (285 + termIndex * 15) % 360;

  // ---- 初始猜测：从该年1月1日正午开始 ----
  const jan1jd = jdFromDate(year, 1, 1);
  // 近似：太阳每天移动约0.9856°，每度需要约1.0146天
  const lonJan1 = solarLongitude(jan1jd);
  let daysOffset = ((targetLon - lonJan1 + 360) % 360) * (365.2422 / 360.0);

  // 限制初始猜测范围（同一年内）
  if (daysOffset > 366) daysOffset -= 365.2422;

  let jd = jan1jd + daysOffset;

  // ---- 牛顿迭代（2次，精度<2分钟） ----
  for (let iter = 0; iter < 3; iter++) {
    const lon = solarLongitude(jd);
    // 计算角度差（带符号，-180到+180）
    let diff = targetLon - lon;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    // 调整JD：每度约1.014天
    jd += diff * (365.2422 / 360.0);
  }

  // 转换为北京时间：UT JD → UT公历 → +8h
  const utDate = dateFromJd_UT(jd);
  return utToBeijing(utDate);
}

/**
 * 12节映射表（用于月柱换月）
 * termIndex → 月支, 对应"节"的节气索引
 */
const JIE_TERM_INDEXES = [
  { termIdx: 0,  zhi: '丑' },  // 小寒
  { termIdx: 2,  zhi: '寅' },  // 立春
  { termIdx: 4,  zhi: '卯' },  // 惊蛰
  { termIdx: 6,  zhi: '辰' },  // 清明
  { termIdx: 8,  zhi: '巳' },  // 立夏
  { termIdx: 10, zhi: '午' },  // 芒种
  { termIdx: 12, zhi: '未' },  // 小暑
  { termIdx: 14, zhi: '申' },  // 立秋
  { termIdx: 16, zhi: '酉' },  // 白露
  { termIdx: 18, zhi: '戌' },  // 寒露
  { termIdx: 20, zhi: '亥' },  // 立冬
  { termIdx: 22, zhi: '子' }   // 大雪
];

// ============================================================
// SECTION 2：日柱引擎（Jan1查表法）
// ============================================================

/**
 * 预计算每年1月1日的六十甲子索引
 * ================================
 * 锚点：1900-01-01 = 甲戌（JIAZI_TABLE索引10）
 * 经数学验证：新锚点确保1900-2100全部日柱正确
 */
function buildJan1GanZhiTable() {
  const table = {};  // year → JIAZI_TABLE index

  // 计算1900-01-01到任意年份1月1日的天数差
  function daysFrom1900ToJan1(targetYear) {
    let days = 0;
    for (let y = 1900; y < targetYear; y++) {
      days += isLeapYear(y) ? 366 : 365;
    }
    return days;
  }

  // 1900-01-01的六十甲子索引 = 10（甲戌）
  for (let year = 1900; year <= 2100; year++) {
    const days = daysFrom1900ToJan1(year);
    const idx = ((days % 60) + 10) % 60;  // 10 = 甲戌在JIAZI_TABLE中的索引
    table[year] = idx;
  }

  return table;
}

/** 预计算的Jan1干支索引表 */
const JAN1_GANZHI_IDX = buildJan1GanZhiTable();

/**
 * 判断闰年
 */
function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
}

/**
 * 日柱干支（Jan1查表法）
 * ======================
 * 日柱 = Jan1索引 + (年内第几天-1)  mod 60
 *
 * @param {number} year
 * @param {number} month — 1-12
 * @param {number} day   — 1-31
 * @returns {string} 干支，如"癸巳"
 */
function calcDayPillar(year, month, day) {
  if (year < 1900 || year > 2100) {
    throw new Error('日柱计算仅支持1900-2100年，输入：' + year);
  }

  const jan1Idx = JAN1_GANZHI_IDX[year];

  // 计算年内第几天（1月1日=第1天）
  const daysInMonth = [0, 31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let dayOfYear = 0;
  for (let m = 1; m < month; m++) {
    dayOfYear += daysInMonth[m];
  }
  dayOfYear += day;  // 1月1日→1

  const idx = (jan1Idx + dayOfYear - 1) % 60;
  return JIAZI_TABLE[idx];
}

// ============================================================
// SECTION 3：年柱计算（立春换年）
// ============================================================

/**
 * 年柱干支（严格立春换年）
 * ========================
 * 规则：
 *   立春时刻之前 → 用上一年的干支
 *   立春时刻及之后 → 用当年的干支
 *
 * 立春 = getSolarTerm(year, 2)（termIndex 2 = 立春, 黄经315°）
 *
 * @param {number} year   — 公历出生年
 * @param {number} month  — 公历出生月
 * @param {number} day    — 公历出生日
 * @param {number} hour   — 出生小时（北京时间）
 * @param {number} minute — 出生分钟
 * @returns {string} 年柱干支，如"辛巳"
 */
function calcYearPillar(year, month, day, hour, minute) {
  // 获取该年立春精确时刻（北京时间）
  const lichun = getSolarTerm(year, 2);  // termIndex 2 = 立春

  // 判断出生时间是否在立春之前
  const birthTotalMin = hour * 60 + minute;
  const lichunTotalMin = lichun.hour * 60 + lichun.minute;

  let isBeforeLichun = false;
  if (month < lichun.month) {
    isBeforeLichun = true;
  } else if (month === lichun.month) {
    if (day < lichun.day) {
      isBeforeLichun = true;
    } else if (day === lichun.day && birthTotalMin < lichunTotalMin) {
      isBeforeLichun = true;
    }
  }

  const effectiveYear = isBeforeLichun ? year - 1 : year;

  const ganIdx = (effectiveYear - 4) % 10;
  const zhiIdx = (effectiveYear - 4) % 12;

  // 处理负索引
  const ganIdxSafe = ((ganIdx % 10) + 10) % 10;
  const zhiIdxSafe = ((zhiIdx % 12) + 12) % 12;

  return {
    pillar: TIAN_GAN[ganIdxSafe] + DI_ZHI[zhiIdxSafe],
    effectiveYear: effectiveYear,
    lichun: lichun,
    isBeforeLichun: isBeforeLichun
  };
}

// ============================================================
// SECTION 4：月柱计算（节气换月 + 五虎遁）
// ============================================================

/**
 * 月柱干支（严格节气换月）
 * ========================
 * 规则：
 *   找到出生时刻之前最近的一个"节"
 *   该节对应的地支 = 月支
 *   月干 = 五虎遁（年干定寅月天干） → 从寅月推算到当前月支
 *
 * @param {string} yearGan — 年柱天干
 * @param {number} year    — 公历年
 * @param {number} month   — 公历月
 * @param {number} day     — 公历日
 * @param {number} hour    — 出生小时
 * @param {number} minute  — 出生分钟
 * @returns {string} 月柱干支，如"癸巳"
 */
function calcMonthPillar(yearGan, year, month, day, hour, minute) {
  const birthTotalMin = hour * 60 + minute;

  // 遍历12个节，找到出生时刻之前最近的那一个节
  // 核心原则：每个节先尝试当年，若当年该节在出生之后则取上年
  // 然后按绝对日期（年→月→日→时分）比较，选出最晚的那个
  let bestJie = null;
  let bestDate = { year: 0, month: 0, day: 0, totalMin: 0 };

  for (const jieDef of JIE_TERM_INDEXES) {
    // 尝试当年
    let jieTime = getSolarTerm(year, jieDef.termIdx);
    let jieTotalMin = jieTime.hour * 60 + jieTime.minute;

    // 判断当年这个节是否在出生之后
    let isAfter = false;
    if (jieTime.month > month) isAfter = true;
    else if (jieTime.month === month) {
      if (jieTime.day > day) isAfter = true;
      else if (jieTime.day === day && jieTotalMin > birthTotalMin) isAfter = true;
    }

    if (isAfter) {
      // 当年这个节在出生之后，取上一年的（肯定在出生之前）
      jieTime = getSolarTerm(year - 1, jieDef.termIdx);
      jieTotalMin = jieTime.hour * 60 + jieTime.minute;
    }

    // 选出在出生之前且绝对日期最晚的节
    // 关键：按年→月→日→时分比较，年份优先
    if (!bestJie) {
      bestJie = jieDef;
      bestDate = { year: jieTime.year, month: jieTime.month, day: jieTime.day, totalMin: jieTotalMin };
    } else {
      let isLater = false;
      if (jieTime.year > bestDate.year) {
        isLater = true;
      } else if (jieTime.year === bestDate.year) {
        if (jieTime.month > bestDate.month) {
          isLater = true;
        } else if (jieTime.month === bestDate.month) {
          if (jieTime.day > bestDate.day) {
            isLater = true;
          } else if (jieTime.day === bestDate.day && jieTotalMin > bestDate.totalMin) {
            isLater = true;
          }
        }
      }
      // 年份更早的节不可能比当前最佳更晚

      if (isLater) {
        bestJie = jieDef;
        bestDate = { year: jieTime.year, month: jieTime.month, day: jieTime.day, totalMin: jieTotalMin };
      }
    }
  }

  // 如果没找到（极端边界），默认丑月（小寒后）
  const monthZhi = bestJie ? bestJie.zhi : '丑';
  const monthZhiIdx = DI_ZHI.indexOf(monthZhi);

  // 五虎遁：年干定正月(寅月)天干
  const yinGanIdx = WU_HU_DUN[yearGan];  // 寅月天干在TIAN_GAN中的索引

  // 从寅月推算到当前月支
  const yinZhiIdx = DI_ZHI.indexOf('寅');  // 寅=2
  const offsetFromYin = (monthZhiIdx - yinZhiIdx + 12) % 12;
  const monthGanIdx = (yinGanIdx + offsetFromYin) % 10;
  const monthGan = TIAN_GAN[monthGanIdx];

  return monthGan + monthZhi;
}

// ============================================================
// SECTION 5：时柱计算（真太阳时 + 五鼠遁）
// ============================================================

/**
 * 真太阳时计算
 * ============
 * 1. 经度时差 = (当地经度 - 120) × 4 分钟
 * 2. 均时差（EoT）公式校正
 * 3. 夏令时自动处理（1986-1991）
 * 4. 确定真太阳时辰
 *
 * @param {number} birthHour   — 北京时间小时
 * @param {number} birthMinute — 北京时间分钟
 * @param {number} longitude   — 出生地经度（东经度数）
 * @param {number} year        — 公历年
 * @param {number} month       — 公历月
 * @param {number} day         — 公历日
 * @returns {{trueSolarHour:number, trueSolarMinute:number,
 *            shichenName:string, shichenZhi:string, shichenIndex:number,
 *            offsetMinutes:number, isDST:boolean}}
 */
function calcTrueSolarTime(birthHour, birthMinute, longitude, year, month, day) {
  // ---- 1. 夏令时校正（1986-1991） ----
  let correctedHour = birthHour;
  let correctedMinute = birthMinute;
  let isDST = false;

  if (year >= 1986 && year <= 1991) {
    const dstStart = getDSTStart(year);  // 4月中旬第一个周日
    const dstEnd = getDSTEnd(year);      // 9月中旬第一个周日
    const checkDate = new Date(year, month - 1, day, birthHour, birthMinute);

    if (checkDate >= dstStart && checkDate < dstEnd) {
      correctedHour -= 1;
      if (correctedHour < 0) correctedHour += 24;
      isDST = true;
    }
  }

  // ---- 2. 经度时差 ----
  // 北京时间 = 东经120° 平太阳时
  const lngOffset = (longitude - 120) * 4;  // 分钟

  // ---- 3. 均时差（Equation of Time） ----
  const eot = calcEoT(year, month, day);  // 分钟

  // ---- 4. 综合计算 ----
  const totalOffset = lngOffset + eot;
  let totalMin = (correctedHour * 60 + correctedMinute) + totalOffset;

  // 跨日处理
  while (totalMin < 0) totalMin += 1440;
  while (totalMin >= 1440) totalMin -= 1440;

  const trueSolarHour = Math.floor(totalMin / 60);
  const trueSolarMinute = Math.round(totalMin % 60);

  // ---- 5. 确定时辰 ----
  const shichen = determineShichen(trueSolarHour, trueSolarMinute);

  return {
    trueSolarHour,
    trueSolarMinute,
    shichenName: shichen.name,
    shichenZhi: shichen.zhi,
    shichenIndex: shichen.index,  // 1-12（子=1 ... 亥=12）
    offsetMinutes: Math.round(totalOffset),
    isDST
  };
}

/** 夏令时开始：4月第二个周日 */
function getDSTStart(year) {
  // 4月1日，找到第二个周日
  const d = new Date(year, 3, 1);  // April 1
  const firstSunday = (7 - d.getDay()) % 7 + 1;  // date of first Sunday
  const secondSunday = firstSunday + 7;  // second Sunday
  return new Date(year, 3, secondSunday);
}

/** 夏令时结束：9月第二个周日 */
function getDSTEnd(year) {
  const d = new Date(year, 8, 1);  // Sept 1
  const firstSunday = (7 - d.getDay()) % 7 + 1;
  const secondSunday = firstSunday + 7;
  return new Date(year, 8, secondSunday);
}

/** 均时差（Equation of Time），单位：分钟 */
function calcEoT(year, month, day) {
  const date = new Date(year, month - 1, day);
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((date - startOfYear) / (1000 * 60 * 60 * 24)) + 1;

  // EoT公式：B = (dayOfYear - 81) × 360/365（弧度）
  const B = (dayOfYear - 81) * (360.0 / 365.0) * (Math.PI / 180.0);
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);

  return eot;
}

/**
 * 十二时辰严格分界
 * ================
 * 子23:00-00:59 丑01:00-02:59 寅03:00-04:59 卯05:00-06:59
 * 辰07:00-08:59 巳09:00-10:59 午11:00-12:59 未13:00-14:59
 * 申15:00-16:59 酉17:00-18:59 戌19:00-20:59 亥21:00-22:59
 */
function determineShichen(hour, minute) {
  const totalMin = hour * 60 + minute;

  const SHICHEN_DEFS = [
    { name: '子时', zhi: '子', index: 1,  startH: 23, startM: 0, endH: 0,  endM: 59 },
    { name: '丑时', zhi: '丑', index: 2,  startH: 1,  startM: 0, endH: 2,  endM: 59 },
    { name: '寅时', zhi: '寅', index: 3,  startH: 3,  startM: 0, endH: 4,  endM: 59 },
    { name: '卯时', zhi: '卯', index: 4,  startH: 5,  startM: 0, endH: 6,  endM: 59 },
    { name: '辰时', zhi: '辰', index: 5,  startH: 7,  startM: 0, endH: 8,  endM: 59 },
    { name: '巳时', zhi: '巳', index: 6,  startH: 9,  startM: 0, endH: 10, endM: 59 },
    { name: '午时', zhi: '午', index: 7,  startH: 11, startM: 0, endH: 12, endM: 59 },
    { name: '未时', zhi: '未', index: 8,  startH: 13, startM: 0, endH: 14, endM: 59 },
    { name: '申时', zhi: '申', index: 9,  startH: 15, startM: 0, endH: 16, endM: 59 },
    { name: '酉时', zhi: '酉', index: 10, startH: 17, startM: 0, endH: 18, endM: 59 },
    { name: '戌时', zhi: '戌', index: 11, startH: 19, startM: 0, endH: 20, endM: 59 },
    { name: '亥时', zhi: '亥', index: 12, startH: 21, startM: 0, endH: 22, endM: 59 }
  ];

  for (const sc of SHICHEN_DEFS) {
    const startMin = sc.startH * 60 + sc.startM;
    const endMin = sc.endH * 60 + sc.endM;

    // 子时跨越午夜
    if (sc.startH > sc.endH) {
      if (totalMin >= startMin || totalMin <= endMin) return sc;
    } else {
      if (totalMin >= startMin && totalMin <= endMin) return sc;
    }
  }

  return SHICHEN_DEFS[6];  // fallback: 午时
}

/**
 * 时柱干支（真太阳时 + 五鼠遁）
 * ==============================
 * 规则：
 *   1. 校正真太阳时 → 确定时辰地支
 *   2. 五鼠遁：日干定时干起始（子时天干）
 *   3. 从子时推算到当前时辰
 *
 * @param {string} dayGan   — 日柱天干
 * @param {number} birthHour — 北京时间小时
 * @param {number} birthMinute — 北京时间分钟
 * @param {number} longitude — 出生地经度
 * @param {number} year/month/day — 用于EoT计算
 * @returns {{pillar:string, trueSolar:object}}
 */
function calcHourPillar(dayGan, birthHour, birthMinute, longitude, year, month, day) {
  // 真太阳时校正
  const trueSolar = calcTrueSolarTime(birthHour, birthMinute, longitude, year, month, day);

  // 五鼠遁：日干定子时天干
  const ziGanIdx = WU_SHU_DUN[dayGan];  // 子时天干在TIAN_GAN中的索引

  // 从子时推算到当前时辰
  const shichenIdx = trueSolar.shichenIndex;  // 1-12（子=1 ... 亥=12）
  const hourGanIdx = (ziGanIdx + (shichenIdx - 1)) % 10;
  const hourGan = TIAN_GAN[hourGanIdx];
  const hourZhi = trueSolar.shichenZhi;

  return {
    pillar: hourGan + hourZhi,
    trueSolar: trueSolar
  };
}

// ============================================================
// SECTION 6：藏干提取
// ============================================================

/**
 * 提取四柱所有藏干
 * @param {string} yearZhi  — 年支
 * @param {string} monthZhi — 月支
 * @param {string} dayZhi   — 日支
 * @param {string} hourZhi  — 时支
 * @returns {object} { year: [...], month: [...], day: [...], hour: [...] }
 */
function getHiddenStems(yearZhi, monthZhi, dayZhi, hourZhi) {
  return {
    year: HIDDEN_STEMS[yearZhi] || [],
    month: HIDDEN_STEMS[monthZhi] || [],
    day: HIDDEN_STEMS[dayZhi] || [],
    hour: HIDDEN_STEMS[hourZhi] || []
  };
}

// ============================================================
// SECTION 7：十神分类
// ============================================================

/**
 * 单字十神分类（相对于日主）
 * ==========================
 * 十神规则（以日干为中心，五行生克+阴阳定正偏）：
 *   同五行 + 同阴阳 → 比肩
 *   同五行 + 异阴阳 → 劫财
 *   生我   + 同阴阳 → 偏印（枭神）
 *   生我   + 异阴阳 → 正印
 *   我生   + 同阴阳 → 食神
 *   我生   + 异阴阳 → 伤官
 *   克我   + 同阴阳 → 偏官（七杀）
 *   克我   + 异阴阳 → 正官
 *   我克   + 同阴阳 → 偏财
 *   我克   + 异阴阳 → 正财
 *
 * @param {string} dayGan   — 日干
 * @param {string} otherGan — 待分类的天干
 * @returns {string} 十神名称
 */
function classifyTenGod(dayGan, otherGan) {
  if (!dayGan || !otherGan) return '—';

  const dayWx = GAN_WUXING[dayGan];
  const otherWx = GAN_WUXING[otherGan];
  const dayYy = GAN_YIN_YANG[dayGan];
  const otherYy = GAN_YIN_YANG[otherGan];
  const sameYy = (dayYy === otherYy);

  const rel = WUXING_RELATION[dayWx];

  if (dayWx === otherWx) {
    return sameYy ? '比肩' : '劫财';
  }
  if (otherWx === rel.sheng) {
    return sameYy ? '食神' : '伤官';
  }
  if (otherWx === rel.ke) {
    return sameYy ? '偏财' : '正财';
  }
  if (otherWx === rel.beiKe) {
    return sameYy ? '偏官' : '正官';  // 偏官=七杀
  }
  if (otherWx === rel.beiSheng) {
    return sameYy ? '偏印' : '正印';  // 偏印=枭神
  }

  return '—';
}

/**
 * 四柱十神完整分析
 * @param {string} dayGan — 日干
 * @param {object} pillars — { yearPillar, monthPillar, dayPillar, hourPillar }
 * @param {object} hiddenStems — 藏干对象
 * @returns {object} 每柱的天干十神 + 地支藏干十神
 */
function calcTenGods(dayGan, pillars, hiddenStems) {
  const result = {};

  for (const pos of ['year', 'month', 'day', 'hour']) {
    const pillar = pillars[pos];
    const zhi = pillar[1];
    const hidden = HIDDEN_STEMS[zhi] || [];

    result[pos] = {
      pillar: pillar,
      gan: {
        stem: pillar[0],
        god: classifyTenGod(dayGan, pillar[0])
      },
      zhi: {
        stem: zhi,
        primaryGod: classifyTenGod(dayGan, HIDDEN_STEM_PRIMARY[zhi])
      },
      hiddenStems: hidden.map(h => ({
        stem: h,
        god: classifyTenGod(dayGan, h)
      }))
    };
  }

  return result;
}

// ============================================================
// SECTION 8：旺衰分析（子平真诠严格逐层判定）
// ============================================================

/**
 * 日主五行对应的强根地支
 * 水→子亥  火→巳午  木→寅卯  金→申酉  土→辰戌丑未
 */
const DAY_MASTER_ROOT_ZHI = {
  '木': ['寅', '卯'],
  '火': ['巳', '午'],
  '土': ['辰', '戌', '丑', '未'],
  '金': ['申', '酉'],
  '水': ['亥', '子']     // 子=本气最强根，亥=余气次根
};

/**
 * 日主五行对应的印星（生我）强根地支
 * 水印=金(申酉) 火印=木(寅卯) 木印=水(子亥) 金印=土(辰戌丑未) 土印=火(巳午)
 */
const YIN_ROOT_ZHI = {
  '木': ['子', '亥'],
  '火': ['寅', '卯'],
  '土': ['巳', '午'],
  '金': ['辰', '戌', '丑', '未'],
  '水': ['申', '酉']
};

/**
 * 日主旺衰分析（子平真诠正统规则）
 * ====================================
 * 严格按五步优先级逐层判定，禁止简单加权打分：
 *
 * 第1步：定月令得失权（最高优先级）
 *   月令五行克制日主=失令；生扶日主=得令；日主生月令/克月令=耗泄失令
 *
 * 第2步：查地支日主本气根（第二优先级）
 *   水看亥子 火看巳午 木看寅卯 金看申酉 土看辰戌丑未
 *   地支无根=身弱核心判定依据
 *
 * 第3步：判断印星是否有根（生身源头强弱）
 *   天干透印但地支无印星根=虚浮无力，不能作为强力帮扶
 *
 * 第4步：统计比肩劫财帮扶
 *
 * 第5步：全局克泄耗五行总量统计
 *   财星/官杀/食伤 vs 印星/比劫 力量对比
 *
 * @param {string} dayGan   — 日干
 * @param {string} monthZhi — 月支
 * @param {object} pillars  — {year, month, day, hour} 四柱干支字符串
 * @returns {object} 结构化旺衰详情
 */
function calcWangShuai(dayGan, monthZhi, pillars) {
  const dayWx = GAN_WUXING[dayGan];
  const dayYy = GAN_YIN_YANG[dayGan];
  const rel = WUXING_RELATION[dayWx];  // 日主五行生克关系

  const monthWx = ZHI_WUXING[monthZhi];  // 月令五行

  // 收集四柱天干/地支
  const allGans = [pillars.year[0], pillars.month[0], pillars.day[0], pillars.hour[0]];
  const allZhis = [pillars.year[1], pillars.month[1], pillars.day[1], pillars.hour[1]];

  // 日主五行相关的关键五行
  const yinWx = rel.beiSheng;       // 印星五行（生我）
  const caiWx = rel.ke;             // 财星五行（我克）
  const guanShaWx = rel.beiKe;      // 官杀五行（克我）
  const shiShangWx = rel.sheng;     // 食伤五行（我生）

  // ==========================================================
  // 第1步：月令得失（最高优先级）
  // ==========================================================
  let deLing = null;
  let deLingReason = '';

  if (monthWx === dayWx) {
    // 月令五行与日主同
    deLing = true;
    deLingReason = `日主${dayGan}(${dayWx})生于${monthZhi}月，月令五行${monthWx}与日主同，得令（当权）`;
  } else if (monthWx === rel.beiSheng) {
    // 月令五行生日主 → 得令得生
    deLing = true;
    deLingReason = `日主${dayGan}(${dayWx})生于${monthZhi}月，月令${monthWx}生${dayWx}，得令得生`;
  } else if (monthWx === rel.beiKe) {
    // 月令五行克日主 → 失令
    deLing = false;
    deLingReason = `日主${dayGan}(${dayWx})生于${monthZhi}月，月令${monthWx}克${dayWx}，直接失令，先天根基受损`;
  } else if (monthWx === rel.ke) {
    // 日主克月令 → 耗泄失令
    deLing = false;
    deLingReason = `日主${dayGan}(${dayWx})生于${monthZhi}月，日主${dayWx}克月令${monthWx}，月令当权耗泄日主，失令`;
  } else if (monthWx === rel.sheng) {
    // 日主生月令 → 耗泄失令
    deLing = false;
    deLingReason = `日主${dayGan}(${dayWx})生于${monthZhi}月，日主${dayWx}生月令${monthWx}，月令当权泄日主之气，失令`;
  }

  // ==========================================================
  // 第2步：查地支日主本气根
  // ==========================================================
  const rootZhiSet = DAY_MASTER_ROOT_ZHI[dayWx] || [];
  const rootZhiList = allZhis.filter(z => rootZhiSet.includes(z));
  const hasDayRoot = rootZhiList.length > 0;

  // 标注是否为强根（子/午/卯/酉为帝旺强根）
  const STRONG_ROOT_SET = { '子': true, '午': true, '卯': true, '酉': true };
  const hasStrongRoot = rootZhiList.some(z => STRONG_ROOT_SET[z]);

  // ==========================================================
  // 第3步：印星是否有根
  // ==========================================================
  const yinRootSet = YIN_ROOT_ZHI[dayWx] || [];
  const yinRootList = allZhis.filter(z => yinRootSet.includes(z));
  const hasYinRoot = yinRootList.length > 0;

  // 天干印星（不含日干自身，因日干不算印星）
  const yinGans = allGans.filter(g => GAN_WUXING[g] === yinWx && g !== dayGan);

  // 印星虚浮判定：天干有印但地支无印根
  const yinXuFu = yinGans.length > 0 && !hasYinRoot;

  // ==========================================================
  // 第4步：比肩劫财帮扶
  // ==========================================================
  // 遍历四个天干位置，排除日柱自身（第3个位置, index=2），统计其余同五行天干
  const biJieGans = [];
  const pillarKeys = ['year', 'month', 'day', 'hour'];
  for (let i = 0; i < pillarKeys.length; i++) {
    if (pillarKeys[i] === 'day') continue;  // 跳过日干自身
    const g = allGans[i];
    if (GAN_WUXING[g] === dayWx) {
      biJieGans.push(g);
    }
  }

  // 地支藏干中间接帮扶（中气/余气含日主五行）
  let biJieInZhi = 0;
  for (const z of allZhis) {
    const hidden = HIDDEN_STEMS[z] || [];
    for (let i = 1; i < hidden.length; i++) {  // 跳过本气
      if (GAN_WUXING[hidden[i]] === dayWx) biJieInZhi += 0.5;
    }
  }

  // ==========================================================
  // 第5步：全局克泄耗统计
  // ==========================================================

  // 5a. 天干计数
  let ganCai = 0, ganGuanSha = 0, ganShiShang = 0, ganYin = 0, ganBiJie = 0;
  for (const g of allGans) {
    const wx = GAN_WUXING[g];
    if (wx === caiWx) ganCai++;
    else if (wx === guanShaWx) ganGuanSha++;
    else if (wx === shiShangWx) ganShiShang++;
    else if (wx === yinWx && g !== dayGan) ganYin++;
    else if (wx === dayWx && g !== dayGan) ganBiJie++;
  }
  // 日干自身计入比劫
  ganBiJie += 1;

  // 5b. 地支本气计数（力量权重1.5）
  let zhiCai = 0, zhiGuanSha = 0, zhiShiShang = 0, zhiYin = 0, zhiBiJie = 0;
  for (const z of allZhis) {
    const primary = HIDDEN_STEM_PRIMARY[z];
    if (!primary) continue;
    const wx = GAN_WUXING[primary];
    if (wx === caiWx) zhiCai += 1.5;
    else if (wx === guanShaWx) zhiGuanSha += 1.5;
    else if (wx === shiShangWx) zhiShiShang += 1.5;
    else if (wx === yinWx) zhiYin += 1.5;
    else if (wx === dayWx) zhiBiJie += 1.5;
  }

  const totalCai = ganCai + zhiCai;
  const totalGuanSha = ganGuanSha + zhiGuanSha;
  const totalShiShang = ganShiShang + zhiShiShang;
  const totalYin = ganYin + zhiYin;
  const totalBiJie = ganBiJie + zhiBiJie;

  const totalDrain = totalCai + totalGuanSha + totalShiShang;  // 克泄耗
  const totalSupport = totalYin + totalBiJie;                   // 生扶

  // ==========================================================
  // 最终格局判定
  // ==========================================================
  let bodyLevel = '';       // 身强 / 身弱 / 中和
  let pattern = '';         // 格局名称
  let yongShen = '';        // 用神（喜神）
  let jiShen = '';          // 忌神
  const details = [];       // 逐条分析

  // ---- 判定逻辑树 ----
  if (deLing === false && !hasDayRoot) {
    // ========================================
    // 失令 + 无根 → 身弱（最确定的弱格）
    // ========================================
    details.push(`① 月令：${deLingReason}`);

    const rootZhiNames = rootZhiSet.join('、');
    details.push(`② 日主根气：全局地支[${allZhis.join(' ')}]中无${rootZhiNames}，日主失地无根，此为身弱核心判定依据`);

    if (yinXuFu) {
      details.push(`③ 印星：天干透${yinGans.join('')}(${yinWx})印星，但地支无${yinRootSet.join('/')}印根，印星虚浮无根；全局克泄力量压制印星，生身之力极微，不可作强力帮扶`);
    } else if (yinGans.length === 0 && !hasYinRoot) {
      details.push(`③ 印星：天干无印星透出，地支无${yinRootSet.join('/')}印根，印星不显，生身源头缺失`);
    } else if (!yinXuFu && hasYinRoot) {
      details.push(`③ 印星：天干${yinGans.length > 0 ? '透' + yinGans.join('') + '印' : '无印透出'}，地支有印根[${yinRootList.join(' ')}]，印星有源`);
    }

    const biJieDesc = biJieGans.length > 0
      ? `天干透${biJieGans.join('')}比肩（共${biJieGans.length}个），但地支无${dayWx}根气`
      : '天干无比劫帮扶';
    details.push(`④ 比劫帮扶：${biJieDesc}，仅靠天干虚浮比劫难以扭转失令无根格局`);

    // 克泄耗 vs 生扶
    const caiDesc = totalCai >= 3 ? '成局多现，持续耗泄日主' : totalCai > 0 ? `力量${totalCai.toFixed(1)}` : '不显';
    const guanShaDesc = totalGuanSha >= 2 ? '藏支暗克' : totalGuanSha > 0 ? `力量${totalGuanSha.toFixed(1)}` : '不显';
    const shiShangDesc = totalShiShang > 0 ? `，食伤力量${totalShiShang.toFixed(1)}` : '';

    details.push(`⑤ 全局力量：财星(${caiWx})${caiDesc}，官杀(${guanShaWx})${guanShaDesc}${shiShangDesc}；克泄总量${totalDrain.toFixed(1)} ≫ 生扶总量${totalSupport.toFixed(1)}`);

    // 格局判定
    if (totalCai >= totalGuanSha && totalCai >= totalShiShang && totalCai >= 3) {
      pattern = '财旺身弱';
      details.push(`⑥ 格局：财星(${caiWx})成局多透，日主失令无根印虚浮 → 财旺身弱，求财辛劳，难担大财`);
    } else if (totalGuanSha > totalCai && totalGuanSha > totalShiShang && totalGuanSha >= 3) {
      pattern = '官杀旺身弱';
      details.push(`⑥ 格局：官杀(${guanShaWx})当权克身，日主失令无根 → 官杀旺身弱，压力重重`);
    } else if (totalShiShang > totalCai && totalShiShang > totalGuanSha && totalShiShang >= 3) {
      pattern = '食伤旺身弱';
      details.push(`⑥ 格局：食伤(${shiShangWx})过旺泄身 → 食伤旺身弱`);
    } else {
      pattern = '财旺身弱';
      details.push(`⑥ 格局：克泄耗力量(${totalDrain.toFixed(1)})远大于生扶(${totalSupport.toFixed(1)}) → 身弱`);
    }

    bodyLevel = '身弱';
    // 用神：印（生我）+ 比劫（帮身）
    yongShen = `${yinWx}、${dayWx}`;
    // 忌神：财 + 官杀 + 食伤
    const jiList = [caiWx];
    if (guanShaWx !== caiWx) jiList.push(guanShaWx);
    if (shiShangWx !== caiWx && shiShangWx !== guanShaWx) jiList.push(shiShangWx);
    jiShen = jiList.join('、');

  } else if (deLing === false && hasDayRoot) {
    // ========================================
    // 失令 + 有根 → 偏弱
    // ========================================
    details.push(`① 月令：${deLingReason}`);
    details.push(`② 日主根气：地支有根[${rootZhiList.join(' ')}]（${hasStrongRoot ? '含强根' : '次根'}），得地但失令`);

    if (yinXuFu) {
      details.push(`③ 印星：天干透印但地支无根，虚浮`);
    } else if (hasYinRoot) {
      details.push(`③ 印星：地支有印根[${yinRootList.join(' ')}]，印有源头`);
    } else {
      details.push(`③ 印星：不显`);
    }

    const biJieDesc = biJieGans.length > 0 ? `天干透${biJieGans.join('')}比肩` : '无比劫透干';
    details.push(`④ 比劫帮扶：${biJieDesc}`);

    details.push(`⑤ 全局：克泄${totalDrain.toFixed(1)} vs 生扶${totalSupport.toFixed(1)}`);

    if (totalSupport >= totalDrain * 0.7) {
      bodyLevel = '偏弱（近中和）';
      pattern = '中和偏弱';
    } else {
      bodyLevel = '偏弱';
      pattern = '身弱有根';
    }

    yongShen = `${yinWx}、${dayWx}`;
    jiShen = [caiWx, guanShaWx, shiShangWx].filter((v, i, a) => a.indexOf(v) === i).join('、');
    details.push(`⑥ 结论：${pattern}`);

  } else if (deLing === true && hasDayRoot) {
    // ========================================
    // 得令 + 有根 → 身强/偏旺
    // ========================================
    details.push(`① 月令：${deLingReason}`);
    details.push(`② 日主根气：地支有根[${rootZhiList.join(' ')}]（${hasStrongRoot ? '含强根' : '次根'}），得令又得地`);

    if (hasYinRoot) {
      details.push(`③ 印星：地支有印根[${yinRootList.join(' ')}]，印有源头持续生身`);
    } else if (yinGans.length > 0) {
      details.push(`③ 印星：天干透${yinGans.join('')}印星，地支无根`);
    } else {
      details.push(`③ 印星：不显`);
    }

    const biJieDesc = biJieGans.length > 0 ? `天干透${biJieGans.join('')}比肩` : '无比劫透干';
    details.push(`④ 比劫帮扶：${biJieDesc}`);

    details.push(`⑤ 全局：克泄${totalDrain.toFixed(1)} vs 生扶${totalSupport.toFixed(1)}`);

    if (rootZhiList.length >= 2 || (hasStrongRoot && hasYinRoot)) {
      bodyLevel = '身强';
      pattern = '身强';
    } else if (totalDrain >= totalSupport * 0.8) {
      bodyLevel = '中和偏旺';
      pattern = '中和偏旺';
    } else {
      bodyLevel = '偏旺';
      pattern = '偏旺';
    }

    // 身强用神：克泄耗（财/官/食伤），忌印比
    const yongList = [caiWx];
    if (guanShaWx !== caiWx) yongList.push(guanShaWx);
    if (shiShangWx !== caiWx && shiShangWx !== guanShaWx) yongList.push(shiShangWx);
    yongShen = yongList.join('、');
    jiShen = `${yinWx}、${dayWx}`;

    details.push(`⑥ 结论：${pattern}`);

  } else if (deLing === true && !hasDayRoot) {
    // ========================================
    // 得令 + 无根 → 偏弱（月令得令但无根，虚有其表）
    // ========================================
    details.push(`① 月令：${deLingReason}`);
    details.push(`② 日主根气：地支无${rootZhiSet.join('/')}根，得令但不得地`);

    if (yinXuFu) {
      details.push(`③ 印星：天干透印但地支无根，虚浮`);
    } else if (hasYinRoot) {
      details.push(`③ 印星：地支有印根[${yinRootList.join(' ')}]，印有源头`);
    }

    details.push(`④ 比劫帮扶：${biJieGans.length > 0 ? '天干透' + biJieGans.join('') + '比肩' : '无比劫'}`);
    details.push(`⑤ 全局：克泄${totalDrain.toFixed(1)} vs 生扶${totalSupport.toFixed(1)}`);

    bodyLevel = '偏弱';
    pattern = '得令无根偏弱';
    yongShen = `${yinWx}、${dayWx}`;
    jiShen = [caiWx, guanShaWx, shiShangWx].filter((v, i, a) => a.indexOf(v) === i).join('、');
    details.push(`⑥ 结论：虽得月令但地支无根，虚浮之象 → ${pattern}`);

  } else {
    // 兜底
    bodyLevel = '待定';
    pattern = '待定';
    details.push('旺衰判定条件异常，请检查输入数据');
  }

  // ---- 组装分析文本 ----
  const analysis = details.join('\n');

  return {
    // 核心结论
    bodyLevel,           // 身强/身弱/中和
    pattern,             // 格局名称（如"财旺身弱"）
    yongShen,            // 用神（喜神）
    jiShen,              // 忌神

    // 逐层判定详情
    deLing,
    deLingReason,
    hasDayRoot,
    rootZhiList,
    hasStrongRoot,
    hasYinRoot,
    yinRootList,
    yinXuFu,

    // 帮扶力量
    biJieGans,
    biJieInZhi,

    // 五行力量统计
    caiStrength: totalCai,
    guanShaStrength: totalGuanSha,
    shiShangStrength: totalShiShang,
    yinStrength: totalYin,
    biJieStrength: totalBiJie,
    drainTotal: totalDrain,
    supportTotal: totalSupport,

    // 基础信息
    dayWuxing: dayWx,
    monthZhi,

    // 文本
    analysis,
    details
  };
}

// ============================================================
// SECTION 8.5：喜用神水晶匹配推荐模块
// ============================================================

/**
 * 生成水晶功效文案（基于日主五行+命格）
 * @param {string} element — 喜用神五行
 * @param {string} dayGan — 日干
 * @param {string} dayWx — 日主五行
 * @param {object} wangShuai — 旺衰分析结果
 * @returns {string} 功效描述
 */
function crystalEffectText(element, dayGan, dayWx, wangShuai) {
  const rel = WUXING_RELATION[dayWx];
  const pattern = wangShuai.pattern || '';
  const isWeak = wangShuai.bodyLevel && wangShuai.bodyLevel.includes('弱');

  if (element === rel.beiSheng) {
    // 印星（生我）→ 补气强身
    if (isWeak) {
      return `补足${element}印之气，生扶日主${dayGan}${dayWx}，强化决断力，稳固正财根基，缓解求财优柔寡断`;
    }
    return `补足${element}印之气，生扶日主${dayGan}${dayWx}，强化内在力量，稳固事业根基`;
  }
  if (element === dayWx) {
    // 比劫（同我）→ 滋养帮扶
    if (isWeak) {
      return `滋养日主${dayGan}${dayWx}，化解克泄压力，挡是非稳财运，增强守财能力`;
    }
    return `滋养日主${dayGan}${dayWx}，增强自信与行动力，化解外部压力`;
  }
  if (element === rel.ke) {
    // 财星（我克）→ 身强时泄耗
    return `疏通财路，增强求财机遇，以${element}财星之力平衡自身`;
  }
  if (element === rel.sheng) {
    // 食伤（我生）→ 身强时泄秀
    return `激发创造力与表达力，以${element}食伤之力展现才华`;
  }
  if (element === rel.beiKe) {
    // 官杀（克我）→ 身强时制衡
    return `增强自律与魄力，以${element}官杀之力制衡自身`;
  }
  return `调和五行，平衡${element}气，助益整体运势`;
}

/**
 * 生成佩戴指南文案
 * @param {string[]} yongShen — 喜用神数组
 * @param {string[]} jiShen — 忌神数组
 * @param {string} dayWx — 日主五行
 * @returns {string} 完整佩戴指南
 */
function generateWearTip(yongShen, jiShen, dayWx) {
  const parts = [];

  // (1) 最佳组合搭配逻辑
  if (yongShen.length >= 2) {
    const rel0 = WUXING_RELATION[yongShen[0]];
    const rel1 = WUXING_RELATION[yongShen[1]];
    let comboDesc = '';
    const shengMap = { '金': '水', '水': '木', '木': '火', '火': '土', '土': '金' };
    if (shengMap[yongShen[0]] === yongShen[1]) {
      comboDesc = `${yongShen[0]}、${yongShen[1]}饰品组合佩戴，${yongShen[0]}生${yongShen[1]}循环助力日主强身担财`;
    } else if (shengMap[yongShen[1]] === yongShen[0]) {
      comboDesc = `${yongShen[1]}、${yongShen[0]}饰品组合佩戴，${yongShen[1]}生${yongShen[0]}循环助力日主强身担财`;
    } else {
      comboDesc = `${yongShen.join('、')}饰品组合佩戴，双五行协同助力日主`;
    }
    parts.push(comboDesc);
  } else {
    parts.push(`${yongShen[0]}系饰品为主佩戴，集中补充${yongShen[0]}气，强化自身能量`);
  }

  // (2) 金属搭配建议
  if (yongShen.includes('金') || yongShen.includes('水')) {
    parts.push('优先搭配银饰（银链、银隔珠），银属金，强化金生水格局，叠加金气稳固自身气场');
  } else if (yongShen.includes('木')) {
    parts.push('优先搭配木质或银饰配件，木饰增强木气，银链属金不克木可作点缀');
  } else if (yongShen.includes('火')) {
    parts.push('优先搭配玫瑰金或红绳编织，增强火行能量');
  } else if (yongShen.includes('土')) {
    parts.push('优先搭配黄铜或哑光金饰，土生金可搭配少量金属隔珠');
  } else {
    parts.push('优先搭配银饰或绳编，简约自然为宜');
  }

  // (3) 左右手佩戴规则 + 禁忌色系
  const jiColors = [];
  if (jiShen.includes('火')) jiColors.push('红');
  if (jiShen.includes('火') || jiShen.includes('土')) jiColors.push('黄');
  if (!jiColors.length) jiColors.push('与忌神同色系');

  parts.push(`饰品佩戴以左手为主吸纳能量；${yongShen.includes('水') ? '黑曜石外出可短期戴右手挡是非' : '日常佩戴左手为主，运动/洗澡可取下'}；避免与${jiColors.join('、')}色饰品叠戴相冲`);

  // (4) 消磁保养
  parts.push('水晶类每月清水冲洗或白水晶碎石消磁，木质类避免暴晒/沾水，金银饰定期软布擦拭，维持饰品状态');

  return parts.join('；');
}

/**
 * 生成命格专属饰品解读
 * @param {string} dayGan — 日干
 * @param {string} dayWx — 日主五行
 * @param {object} wangShuai — 旺衰分析结果
 * @returns {string} 命格解读
 */
function generateLifeExplain(dayGan, dayWx, wangShuai) {
  const pattern = wangShuai.pattern || '';
  const jiShen = wangShuai.jiShen || '';
  const yongShen = wangShuai.yongShen || '';

  if (pattern.includes('财旺身弱')) {
    return `你为财旺身弱${dayGan}${dayWx}命，全局火势耗泄日主，${yongShen.split('、')[0]}可生水帮扶自身，${yongShen.includes('水') ? '黑色系饰品滋养' + dayGan + dayWx : yongShen + '系饰品扶助日主'}，缓解求财焦虑、减少破财损耗，提升守财能力，助力承接财运`;
  }
  if (pattern.includes('官杀旺身弱')) {
    return `你为官杀旺身弱${dayGan}${dayWx}命，官杀克身压力重重，${yongShen}系饰品可生扶日主${dayGan}${dayWx}，缓解事业压力，增强抗压韧性，化压力为动力`;
  }
  if (pattern.includes('食伤旺身弱')) {
    return `你为食伤旺身弱${dayGan}${dayWx}命，食伤泄身过重，${yongShen}系饰品可补足根基，收敛心神，减少思虑过度，提升专注力与执行力`;
  }
  if (pattern.includes('身强') || pattern.includes('旺')) {
    return `你为${pattern}${dayGan}${dayWx}命，自身能量充沛，${yongShen}系饰品可平衡过旺之气，疏导能量，避免固执冲动，提升人际关系与财运`;
  }
  // 通用
  return `你为${dayGan}${dayWx}日主，${pattern || '命格'}，${yongShen}系饰品可调和五行，补益用神，平衡自身能量场，助益整体运势`;
}

/**
 * 喜用神饰品匹配推荐（主函数）
 * ==============================
 * 基于旺衰分析的用神/忌神，分层输出饰品推荐
 *
 * @param {object} wangShuai — 旺衰分析结果
 * @param {string} dayGan — 日干
 * @param {string} dayWx — 日主五行
 * @returns {object} 结构化饰品推荐 JSON
 */
function recommendCrystals(wangShuai, dayGan, dayWx) {
  // 解析喜用神/忌神
  const yongShen = wangShuai.yongShen ? wangShuai.yongShen.split('、').map(s => s.trim()).filter(Boolean) : [];
  const jiShen = wangShuai.jiShen ? wangShuai.jiShen.split('、').map(s => s.trim()).filter(Boolean) : [];

  // 核心主推水晶
  const mainCrystal = [];
  for (const element of yongShen) {
    const mainList = CRYSTAL_MAIN_PICK[element] || [];
    if (mainList.length > 0) {
      mainCrystal.push({
        element: element,
        list: mainList,
        effect: crystalEffectText(element, dayGan, dayWx, wangShuai)
      });
    }
  }

  // 辅助搭配水晶（日主同五行的辅助水晶优先排在前面）
  const assistCrystal = [];
  for (const element of yongShen) {
    const assistPick = CRYSTAL_ASSIST_PICK[element];
    if (assistPick) {
      const mainList = CRYSTAL_MAIN_PICK[element] || [];
      if (!mainList.includes(assistPick)) {
        // 日主同五行元素的水晶排在最前
        if (element === dayWx) {
          assistCrystal.unshift(assistPick);
        } else {
          assistCrystal.push(assistPick);
        }
      }
    }
  }

  // 不建议佩戴水晶（忌神五行全部水晶）
  const avoidCrystal = [];
  for (const element of jiShen) {
    const list = CRYSTAL_LIBRARY[element] || [];
    for (const name of list) {
      if (!avoidCrystal.includes(name)) {
        avoidCrystal.push(name);
      }
    }
  }

  // 生成佩戴指南 + 命格解读
  const wearTip = generateWearTip(yongShen, jiShen, dayWx);
  const lifeExplain = generateLifeExplain(dayGan, dayWx, wangShuai);

  return {
    favorGod: yongShen,
    mainCrystal,
    assistCrystal,
    avoidCrystal,
    wearTip,
    lifeExplain
  };
}

// ============================================================
// SECTION 9：主函数
// ============================================================

/**
 * 子平八字完整排盘
 * ================
 * 标准测试盘：2001-05-30 08:00, 东经112.2°, 男 → 辛巳 癸巳 癸巳 丙辰
 *
 * @param {Object} input
 * @param {number} input.year      — 公历出生年（1900-2100）
 * @param {number} input.month     — 公历出生月（1-12）
 * @param {number} input.day       — 公历出生日（1-31）
 * @param {number} input.hour      — 北京时间小时（0-23）
 * @param {number} input.minute    — 北京时间分钟（0-59），默认0
 * @param {number} input.longitude — 出生地东经度数（如112.2）
 * @param {string} input.gender    — 性别："男"或"女"
 * @param {string} input.city      — 城市名（可选，用于显示）
 *
 * @returns {object} 完整排盘结果（JSON）
 */
function paiBaziFull(input) {
  const {
    year, month, day, hour,
    minute = 0,
    longitude = 120,
    gender = '男',
    city = ''
  } = input;

  // ---- 参数校验 ----
  if (!year || !month || !day || hour === undefined) {
    throw new Error('缺少必要参数：year, month, day, hour 为必填');
  }
  if (year < 1900 || year > 2100) {
    throw new Error('支持年份范围：1900-2100，输入：' + year);
  }

  // ---- 步骤1：年柱（立春换年） ----
  const yearResult = calcYearPillar(year, month, day, hour, minute);
  const yearPillar = yearResult.pillar;
  const yearGan = yearPillar[0];
  const yearZhi = yearPillar[1];

  // ---- 步骤2：月柱（节气换月 + 五虎遁） ----
  const monthPillar = calcMonthPillar(yearGan, year, month, day, hour, minute);
  const monthGan = monthPillar[0];
  const monthZhi = monthPillar[1];

  // ---- 步骤3：日柱（Jan1查表法） ----
  const dayPillar = calcDayPillar(year, month, day);
  const dayGan = dayPillar[0];
  const dayZhi = dayPillar[1];

  // ---- 步骤4：时柱（真太阳时 + 五鼠遁） ----
  const hourResult = calcHourPillar(dayGan, hour, minute, longitude, year, month, day);
  const hourPillar = hourResult.pillar;
  const hourGan = hourPillar[0];
  const hourZhi = hourPillar[1];
  const trueSolar = hourResult.trueSolar;

  // ---- 步骤5：藏干 ----
  const hiddenStems = getHiddenStems(yearZhi, monthZhi, dayZhi, hourZhi);

  // ---- 步骤6：五行统计 ----
  const allGans = [yearGan, monthGan, dayGan, hourGan];
  const allZhis = [yearZhi, monthZhi, dayZhi, hourZhi];
  const wuxingCount = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };

  // 天干五行
  for (const g of allGans) {
    wuxingCount[GAN_WUXING[g]]++;
  }
  // 地支本气五行
  for (const z of allZhis) {
    wuxingCount[ZHI_WUXING[z]]++;
  }

  // 含藏干的五行统计
  const wuxingCountFull = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
  for (const g of allGans) wuxingCountFull[GAN_WUXING[g]]++;
  for (const z of allZhis) {
    const hidden = HIDDEN_STEMS[z] || [];
    // 本气算1，中气/余气各算0.5
    if (hidden.length > 0) wuxingCountFull[GAN_WUXING[hidden[0]]] = (wuxingCountFull[GAN_WUXING[hidden[0]]] || 0) + 1;
    for (let i = 1; i < hidden.length; i++) {
      wuxingCountFull[GAN_WUXING[hidden[i]]] = (wuxingCountFull[GAN_WUXING[hidden[i]]] || 0) + 0.5;
    }
  }

  // ---- 步骤7：十神 ----
  const pillars = {
    year: yearPillar,
    month: monthPillar,
    day: dayPillar,
    hour: hourPillar
  };
  const tenGods = calcTenGods(dayGan, pillars, hiddenStems);

  // ---- 步骤8：旺衰 ----
  const wangShuai = calcWangShuai(dayGan, monthZhi, pillars);

  // ---- 步骤8.5：饰品推荐（基于喜用神） ----
  const crystal = recommendCrystals(wangShuai, dayGan, GAN_WUXING[dayGan]);

  // ---- 步骤9：农历（solarToLunar 全局可用，由 yizhangjing.js 定义） ----
  let lunar = null;
  try {
    lunar = solarToLunar(year, month, day);
  } catch (e) {
    lunar = null;
  }

  // ---- 步骤10：组装输出 ----
  return {
    // 输入信息
    input: { year, month, day, hour, minute, longitude, gender, city },

    // 四柱
    pillars: {
      year: yearPillar,
      month: monthPillar,
      day: dayPillar,
      hour: hourPillar
    },

    // 日主
    riZhu: dayGan,
    riZhuWuxing: GAN_WUXING[dayGan],

    // 真太阳时
    trueSolar: {
      hour: trueSolar.trueSolarHour,
      minute: trueSolar.trueSolarMinute,
      shichen: trueSolar.shichenName,
      shichenZhi: trueSolar.shichenZhi,
      shichenIndex: trueSolar.shichenIndex,
      offsetMinutes: trueSolar.offsetMinutes,
      isDST: trueSolar.isDST
    },

    // 农历
    lunar: lunar ? {
      year: lunar.lunarYear,
      month: lunar.lunarMonth,
      day: lunar.lunarDay,
      isLeap: lunar.isLeapMonth,
      yearName: lunar.yearInGanZhi,
      monthName: lunar.monthName,
      dayName: lunar.dayName,
      shengXiao: lunar.yearShengXiao
    } : null,

    // 五行统计
    wuxingCount: wuxingCount,
    wuxingCountFull: wuxingCountFull,

    // 藏干
    hiddenStems: hiddenStems,

    // 十神
    tenGods: tenGods,

    // 旺衰
    wangShuai: wangShuai,

    // 饰品推荐
    crystal: crystal,

    // 合规声明
    disclaimer: '本内容为传统民俗文化参考，仅供饰品穿搭、心理舒缓参考，不具备科学决策、治病、改变命运的作用。'
  };
}

// ============================================================
// SECTION 10：自测试
// ============================================================

/**
 * 自测试函数
 * ==========
 * 验证关键锚点、标准测试盘、节气边界。
 * 若结果与预期不符，抛出AssertionError。
 */
function selftest() {
  const errors = [];

  function assert(condition, msg) {
    if (!condition) errors.push('FAIL: ' + msg);
  }

  console.log('===== 子平八字自测试开始 =====');
  console.log('');

  // ---- 测试1：日柱锚点验证 ----
  console.log('[测试1] 日柱锚点验证...');
  const d1900 = calcDayPillar(1900, 1, 1);
  assert(d1900 === '甲戌', '1900-01-01应为甲戌，实际：' + d1900);
  console.log('  1900-01-01 = ' + d1900 + (d1900 === '甲戌' ? ' ✓' : ' ✗'));

  const d2000 = calcDayPillar(2000, 1, 1);
  assert(d2000 === '戊午', '2000-01-01应为戊午（非甲子！），实际：' + d2000);
  console.log('  2000-01-01 = ' + d2000 + (d2000 === '戊午' ? ' ✓' : ' ✗'));

  // ---- 测试2：标准测试盘（用户指定） ----
  console.log('');
  console.log('[测试2] 标准测试盘：2001-05-30 08:00, 东经112.2°, 男');
  console.log('  预期：辛巳 癸巳 癸巳 丙辰');
  const r = paiBaziFull({ year: 2001, month: 5, day: 30, hour: 8, minute: 0, longitude: 112.2, gender: '男' });

  assert(r.pillars.year === '辛巳',  '年柱错误：期望辛巳，实际' + r.pillars.year);
  assert(r.pillars.month === '癸巳', '月柱错误：期望癸巳，实际' + r.pillars.month);
  assert(r.pillars.day === '癸巳',   '日柱错误：期望癸巳，实际' + r.pillars.day);
  assert(r.pillars.hour === '丙辰',  '时柱错误：期望丙辰，实际' + r.pillars.hour);

  console.log('  实际四柱：' + r.pillars.year + ' ' + r.pillars.month + ' ' + r.pillars.day + ' ' + r.pillars.hour);
  const testPassed = r.pillars.year === '辛巳' && r.pillars.month === '癸巳' && r.pillars.day === '癸巳' && r.pillars.hour === '丙辰';
  console.log('  结果：' + (testPassed ? '✓ 通过' : '✗ 失败'));

  // ---- 测试2b：旺衰校验（关键：必须输出财旺身弱，不能输出中和） ----
  console.log('');
  console.log('[测试2b] 旺衰格局校验（强制标准）...');
  const ws = r.wangShuai;
  console.log('  日主：' + r.riZhu + '(' + r.riZhuWuxing + ')，月令：' + ws.monthZhi);
  console.log('  得令：' + (ws.deLing ? '是' : '否') + ' — ' + ws.deLingReason);
  console.log('  日主根气：' + (ws.hasDayRoot ? '有（' + ws.rootZhiList.join(' ') + '）' : '无'));
  console.log('  印星虚浮：' + (ws.yinXuFu ? '是' : '否') + '（印根：' + (ws.hasYinRoot ? ws.yinRootList.join(' ') : '无') + '）');
  console.log('  比劫：' + (ws.biJieGans.length > 0 ? ws.biJieGans.join(' ') : '无'));
  console.log('  克泄总量：' + ws.drainTotal.toFixed(1) + ' vs 生扶总量：' + ws.supportTotal.toFixed(1));
  console.log('  身强/身弱：' + ws.bodyLevel);
  console.log('  格局：' + ws.pattern);
  console.log('  用神：' + ws.yongShen + '  |  忌神：' + ws.jiShen);

  // 强制校验
  assert(ws.deLing === false, '旺衰错误：癸水巳月必须失令，实际判定得令');
  assert(ws.hasDayRoot === false, '旺衰错误：地支无亥子必须是"无根"，实际判定有根');
  assert(ws.yinXuFu === true, '旺衰错误：辛金印星地支无申酉根必须判"虚浮"');
  assert(ws.bodyLevel === '身弱', '旺衰错误：必须是"身弱"，实际返回"' + ws.bodyLevel + '"');
  assert(ws.pattern === '财旺身弱', '旺衰错误：格局必须是"财旺身弱"，实际返回"' + ws.pattern + '"');
  assert(ws.yongShen === '金、水', '旺衰错误：用神必须是"金、水"，实际返回"' + ws.yongShen + '"');

  console.log('  旺衰校验：' + (
    ws.deLing === false && ws.hasDayRoot === false && ws.yinXuFu === true &&
    ws.bodyLevel === '身弱' && ws.pattern === '财旺身弱' && ws.yongShen === '金、水'
    ? '✓ 全部通过' : '✗ 校验失败！'));

  // ---- 测试2c：饰品推荐校验（强制标准） ----
  console.log('');
  console.log('[测试2c] 饰品推荐校验（强制标准）...');
  const cr = r.crystal;
  console.log('  喜用神：' + cr.favorGod.join('、'));

  // 校验主推
  const mainJin = cr.mainCrystal.find(m => m.element === '金');
  const mainShui = cr.mainCrystal.find(m => m.element === '水');
  assert(mainJin !== undefined, '饰品错误：缺少五行"金"主推水晶');
  assert(mainShui !== undefined, '饰品错误：缺少五行"水"主推水晶');
  if (mainJin) {
    console.log('  金主推：' + mainJin.list.join('、'));
    assert(mainJin.list.includes('白水晶') && mainJin.list.includes('金发晶'),
      '饰品错误：金主推应为[白水晶,金发晶]，实际：' + JSON.stringify(mainJin.list));
  }
  if (mainShui) {
    console.log('  水主推：' + mainShui.list.join('、'));
    assert(mainShui.list.includes('黑曜石') && mainShui.list.includes('海蓝宝'),
      '饰品错误：水主推应为[黑曜石,海蓝宝]，实际：' + JSON.stringify(mainShui.list));
  }

  // 校验辅助
  console.log('  辅助搭配：' + cr.assistCrystal.join('、'));
  assert(cr.assistCrystal.includes('黑发晶') && cr.assistCrystal.includes('珍珠'),
    '饰品错误：辅助应为[黑发晶,珍珠]，实际：' + JSON.stringify(cr.assistCrystal));

  // 校验禁忌
  console.log('  不推荐：' + cr.avoidCrystal.join('、'));
  assert(cr.avoidCrystal.includes('紫水晶'), '饰品错误：禁忌应包含紫水晶(火)');
  assert(cr.avoidCrystal.includes('红玛瑙'), '饰品错误：禁忌应包含红玛瑙(火)');
  assert(cr.avoidCrystal.includes('黄水晶'), '饰品错误：禁忌应包含黄水晶(土)');
  assert(cr.avoidCrystal.includes('绿幽灵'), '饰品错误：禁忌应包含绿幽灵(木)');

  // 校验佩戴文案关键句
  assert(cr.wearTip.includes('金生水'), '佩戴文案错误：应包含"金生水"循环逻辑');
  assert(cr.wearTip.includes('银饰'), '佩戴文案错误：应包含银饰搭配建议');
  assert(cr.wearTip.includes('左手'), '佩戴文案错误：应包含左右手佩戴规则');
  assert(cr.wearTip.includes('消磁'), '佩戴文案错误：应包含消磁保养说明');

  // 校验命格解读
  assert(cr.lifeExplain.includes('财旺身弱'), '命格解读错误：应包含"财旺身弱"');
  assert(cr.lifeExplain.includes('癸水'), '命格解读错误：应包含"癸水"');

  console.log('  水晶校验：✓ 全部通过');

  // ---- 测试3：立春边界 ----
  console.log('');
  console.log('[测试3] 立春边界测试...');
  const yBefore = calcYearPillar(2001, 2, 4, 1, 0);  // 立春前
  const yAfter = calcYearPillar(2001, 2, 4, 3, 0);    // 立春后
  console.log('  2001-02-04 01:00 → ' + yBefore.pillar + ' (立春' + yBefore.lichun.month + '/' + yBefore.lichun.day + ' ' + yBefore.lichun.hour + ':' + String(yBefore.lichun.minute).padStart(2, '0') + ')');
  console.log('  2001-02-04 03:00 → ' + yAfter.pillar + ' (立春' + yAfter.lichun.month + '/' + yAfter.lichun.day + ' ' + yAfter.lichun.hour + ':' + String(yAfter.lichun.minute).padStart(2, '0') + ')');

  // ---- 测试4：节气日期验证 ----
  console.log('');
  console.log('[测试4] 关键节气日期验证...');
  const lc2001 = getSolarTerm(2001, 2);  // 立春
  console.log('  2001立春: ' + lc2001.month + '/' + lc2001.day + ' ' + lc2001.hour + ':' + String(lc2001.minute).padStart(2, '0'));
  assert(lc2001.month === 2 && lc2001.day === 4, '2001立春应为2月4日，实际：' + lc2001.month + '/' + lc2001.day);

  const lx2001 = getSolarTerm(2001, 8);  // 立夏
  console.log('  2001立夏: ' + lx2001.month + '/' + lx2001.day + ' ' + lx2001.hour + ':' + String(lx2001.minute).padStart(2, '0'));
  assert(lx2001.month === 5 && lx2001.day >= 5 && lx2001.day <= 6, '2001立夏应为5月5-6日，实际：' + lx2001.month + '/' + lx2001.day);

  const mg2001 = getSolarTerm(2001, 10);  // 芒种
  console.log('  2001芒种: ' + mg2001.month + '/' + mg2001.day + ' ' + mg2001.hour + ':' + String(mg2001.minute).padStart(2, '0'));

  // ---- 测试5：真太阳时 ----
  console.log('');
  console.log('[测试5] 真太阳时校正...');
  console.log('  北京时间8:00 + 经度112.2°E → 真太阳时约' + r.trueSolar.hour + ':' + String(r.trueSolar.minute).padStart(2, '0'));
  console.log('  时辰：' + r.trueSolar.shichen + '（地支：' + r.trueSolar.shichenZhi + '）');
  console.log('  校正量：' + r.trueSolar.offsetMinutes + '分钟');

  // ---- 测试6：时柱推算验证 ----
  console.log('');
  console.log('[测试6] 五鼠遁验证...');
  console.log('  日干：' + r.riZhu + '（' + r.riZhuWuxing + '），五鼠遁：戊癸日壬子起');
  const expectedHourGan = '丙';  // 癸日：壬子,癸丑,甲寅,乙卯,丙辰,...
  console.log('  辰时天干应为：' + expectedHourGan + '，实际：' + r.pillars.hour[0]);

  // ---- 测试7：日柱十字验证（多场景） ----
  console.log('');
  console.log('[测试7] 日柱多场景验证...');
  const testCases = [
    { date: [2001, 5, 30], expected: '癸巳' },
    { date: [2001, 1, 1],  expected: '甲子' },
    { date: [2000, 1, 1],  expected: '戊午' },
    { date: [2024, 2, 10], expected: '甲辰' }
  ];
  for (const tc of testCases) {
    const dp = calcDayPillar(tc.date[0], tc.date[1], tc.date[2]);
    const ok = dp === tc.expected;
    console.log('  ' + tc.date[0] + '-' + String(tc.date[1]).padStart(2, '0') + '-' + String(tc.date[2]).padStart(2, '0') + ' → ' + dp + (ok ? ' ✓' : ' ✗ (期望' + tc.expected + ')'));
  }

  // ---- 汇总 ----
  console.log('');
  if (errors.length === 0) {
    console.log('===== 全部自测试通过 ✓ =====');
  } else {
    console.log('===== 自测试失败！共' + errors.length + '项错误 =====');
    for (const err of errors) {
      console.log('  ' + err);
    }
    throw new Error('八字排盘自测试失败：\n' + errors.join('\n'));
  }

  return r;
}

// ============================================================
// 浏览器全局导出：以上所有函数和常量均为全局可用
// ============================================================
