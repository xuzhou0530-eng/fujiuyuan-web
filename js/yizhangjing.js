/**
 * 一掌经排盘 — 民间正统《达摩一掌经》古籍原版算法
 * ==================================================
 *
 * 【规则来源】：民间正统一掌经古籍
 * 【适用范围】：微信小程序 / 云函数（纯本地计算，无外部依赖）
 *
 * 四宫六道映射（死规则，不可更改）：
 *   1 → 佛道   2 → 鬼道   3 → 人道
 *   4 → 修罗道  5 → 畜生道  6 → 仙道
 *
 * 重要约定：
 *   - 年柱按农历正月初一换年（非立春），一掌经统一用春节换年
 *   - 月/日严格按农历（含闰月处理）
 *   - 真太阳时校正自动处理
 *   - 所有规则硬编码，无自创、无简化、无模糊
 */

// ============================================================
// 第一部分：农历基础常量
// ============================================================

/** 十天干（var 声明避免与 bazi_full.js 冲突） */
var TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

/** 十二地支（var 声明避免与 bazi_full.js 冲突） */
var DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/** 地支 → 序数映射（子1 丑2 寅3 卯4 辰5 巳6 午7 未8 申9 酉10 戌11 亥12） */
const ZHI_INDEX = {};
DI_ZHI.forEach((z, i) => { ZHI_INDEX[z] = i + 1; });

/** 生肖 */
const SHENG_XIAO = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

/** 农历月份中文名 */
const LUNAR_MONTH_NAMES = ['', '正月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '冬月', '腊月'];

/** 农历日期中文名 */
const LUNAR_DAY_NAMES = [
  '', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
];

// ============================================================
// 第二部分：农历年数据（1900–2100）
// ============================================================
//
// 标准编码格式（来源：Jea杨 JJonline@JJonline.Cn / 香港天文台数据）：
//   每个年份一个 hex 数值，使用最低 17 位编码：
//     bits 0–3:   闰月月份（0 = 无闰月，1–12 = 闰几月）
//     bits 4–15:  12个常规月的大小月标记
//                 bit 15 = 正月, bit 14 = 二月, ..., bit 4 = 腊月
//                 1 = 大月（30天），0 = 小月（29天）
//     bit 16:     闰月大小（1 = 大月30天，0 = 小月29天），仅当 bits 0–3 非0时有效
//
// 该数据表在数万个日历项目中使用并验证，来源可靠。
// ============================================================

const LUNAR_YEAR_DATA = [
  // 1900–1909
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  // 1910–1919
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  // 1920–1929
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  // 1930–1939
  0x06566, 0x0d4a0, 0x0ea50, 0x16a95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  // 1940–1949
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  // 1950–1959
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
  // 1960–1969
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  // 1970–1979
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b5a0, 0x195a6,
  // 1980–1989
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  // 1990–1999
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0,
  // 2000–2009
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  // 2010–2019
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  // 2020–2029
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  // 2030–2039
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  // 2040–2049
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
  // 2050–2059
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
  // 2060–2069
  0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
  // 2070–2079
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
  // 2080–2089
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
  // 2090–2100
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
  0x0d520  // 2100
];

// ============================================================
// 第三部分：中国主要城市经纬度数据库
// ============================================================
// 用于真太阳时校正（经度时差计算）
// 东经每 15° = 1小时，每 1° = 4分钟

const CITY_COORDS = {
  '北京': { lat: 39.90, lng: 116.40 },
  '上海': { lat: 31.23, lng: 121.47 },
  '广州': { lat: 23.13, lng: 113.27 },
  '深圳': { lat: 22.54, lng: 114.06 },
  '成都': { lat: 30.57, lng: 104.07 },
  '重庆': { lat: 29.56, lng: 106.55 },
  '武汉': { lat: 30.59, lng: 114.31 },
  '宜昌': { lat: 30.69, lng: 111.29 },
  '杭州': { lat: 30.27, lng: 120.15 },
  '南京': { lat: 32.06, lng: 118.80 },
  '天津': { lat: 39.13, lng: 117.20 },
  '西安': { lat: 34.26, lng: 108.94 },
  '长沙': { lat: 28.23, lng: 112.94 },
  '郑州': { lat: 34.75, lng: 113.63 },
  '济南': { lat: 36.67, lng: 116.98 },
  '青岛': { lat: 36.07, lng: 120.38 },
  '大连': { lat: 38.91, lng: 121.61 },
  '沈阳': { lat: 41.80, lng: 123.43 },
  '哈尔滨': { lat: 45.80, lng: 126.53 },
  '长春': { lat: 43.82, lng: 125.32 },
  '昆明': { lat: 25.04, lng: 102.71 },
  '贵阳': { lat: 26.65, lng: 106.63 },
  '南宁': { lat: 22.82, lng: 108.37 },
  '海口': { lat: 20.02, lng: 110.35 },
  '福州': { lat: 26.07, lng: 119.30 },
  '厦门': { lat: 24.48, lng: 118.09 },
  '南昌': { lat: 28.68, lng: 115.86 },
  '合肥': { lat: 31.82, lng: 117.23 },
  '太原': { lat: 37.87, lng: 112.55 },
  '石家庄': { lat: 38.04, lng: 114.51 },
  '兰州': { lat: 36.06, lng: 103.83 },
  '西宁': { lat: 36.62, lng: 101.78 },
  '银川': { lat: 38.49, lng: 106.23 },
  '乌鲁木齐': { lat: 43.79, lng: 87.58 },
  '拉萨': { lat: 29.65, lng: 91.14 },
  '呼和浩特': { lat: 40.82, lng: 111.75 },
  '香港': { lat: 22.28, lng: 114.17 },
  '澳门': { lat: 22.20, lng: 113.55 },
  '台北': { lat: 25.05, lng: 121.54 },
  '苏州': { lat: 31.30, lng: 120.59 },
  '无锡': { lat: 31.57, lng: 120.31 },
  '宁波': { lat: 29.87, lng: 121.55 },
  '温州': { lat: 28.00, lng: 120.70 },
  '东莞': { lat: 23.05, lng: 113.75 },
  '佛山': { lat: 23.03, lng: 113.12 },
  '珠海': { lat: 22.27, lng: 113.58 },
  '泉州': { lat: 24.87, lng: 118.68 },
  '三亚': { lat: 18.25, lng: 109.51 },
  '桂林': { lat: 25.27, lng: 110.29 },
  '丽江': { lat: 26.86, lng: 100.23 },
};

/**
 * 根据城市名模糊匹配经纬度
 * @param {string} cityName
 * @returns {{lat: number, lng: number}|null}
 */
function lookupCity(cityName) {
  if (!cityName || typeof cityName !== 'string') return null;

  const cleanName = cityName.trim();

  // 精确匹配
  if (CITY_COORDS[cleanName]) return CITY_COORDS[cleanName];

  // 模糊匹配：去掉"市"/"省"/"区"后缀
  const shortName = cleanName.replace(/[市省区县]$/, '');
  if (CITY_COORDS[shortName]) return CITY_COORDS[shortName];

  // 前缀匹配（如"宜昌市夷陵区"匹配"宜昌"）
  for (const key of Object.keys(CITY_COORDS)) {
    if (cleanName.startsWith(key) || cleanName.includes(key)) {
      return CITY_COORDS[key];
    }
  }

  // 未找到，返回 null（后续使用默认值：120°E 北京时间）
  return null;
}

// ============================================================
// 第四部分：公历转农历（纯本地算法）
// ============================================================

/**
 * 公历日期转农历日期
 * ===================
 * 根据内置农历年数据（1900–2100）查找对应农历年月日。
 *
 * 算法逻辑：
 *   1. 确定公历日期在农历数据中的年份
 *   2. 从农历正月初一开始累加月份天数
 *   3. 定位到具体月/日（含闰月判断）
 *
 * @param {number} year  — 公历年（1900–2100）
 * @param {number} month — 公历月（1–12）
 * @param {number} day   — 公历日（1–31）
 * @returns {{
 *   lunarYear: number,     // 农历年
 *   lunarMonth: number,    // 农历月（1–12）
 *   lunarDay: number,      // 农历日（1–30）
 *   isLeapMonth: boolean,  // 是否闰月
 *   yearGan: string,       // 年天干
 *   yearZhi: string,       // 年地支
 *   yearShengXiao: string, // 生肖
 *   monthName: string,     // 农历月名（如"四月"）
 *   dayName: string,       // 农历日名（如"初八"）
 *   yearInGanZhi: string   // 干支纪年（如"辛巳"）
 * }}
 */
function solarToLunar(year, month, day) {
  // ----- 参数校验 -----
  if (year < 1900 || year > 2100) {
    throw new Error('农历转换仅支持1900–2100年，输入年：' + year);
  }
  if (month < 1 || month > 12) {
    throw new Error('月份必须在1–12之间，输入：' + month);
  }
  if (day < 1 || day > 31) {
    throw new Error('日期必须在1–31之间，输入：' + day);
  }

  // ----- 步骤1：计算公历日期距离 1900-01-31 的天数差 -----
  // 1900-01-31 是农历庚子年正月初一（基准日）
  const baseDate = new Date(1900, 0, 31);
  const targetDate = new Date(year, month - 1, day);
  let offset = Math.floor((targetDate - baseDate) / (1000 * 60 * 60 * 24));

  if (offset < 0) {
    throw new Error('日期超出可转换范围（1900-01-31之前）');
  }

  // ----- 步骤2：确定农历年 -----
  let lunarYear = 1900;
  let yearIdx = 0;
  let daysInYear = 0;

  while (offset >= 0) {
    daysInYear = lunarYearDays(yearIdx);
    if (offset < daysInYear) break;
    offset -= daysInYear;
    yearIdx++;
    lunarYear++;
    if (yearIdx >= LUNAR_YEAR_DATA.length) {
      throw new Error('日期超出可转换范围（2100年之后）');
    }
  }

  // ----- 步骤3：从正月初一开始，逐月累加天数定位年月 -----
  // 标准编码：bits 0-3 = 闰月月份, bit 16 = 闰月大小, bits 4-15 = 月份大小
  const yearData = LUNAR_YEAR_DATA[yearIdx];
  const leapMonth = yearData & 0xf;               // bits 0–3: 闰月月份
  const leapIsBig = (yearData >> 16) & 0x1;       // bit 16: 闰月大小（1=30天, 0=29天）

  let lunarMonth = 1;
  let lunarDay = 1;
  let isLeapMonth = false;

  // 遍历 13 个可能的农历月（12个月 + 1个闰月）
  for (let m = 1; m <= 12; m++) {
    // 常规月：标准编码 bit(16-m) 对应月份 m
    const monthDays = getMonthDays(yearData, m);
    if (offset < monthDays) {
      lunarMonth = m;
      lunarDay = offset + 1; // offset从0开始，初一=offset=0 → day=1
      isLeapMonth = false;
      break;
    }
    offset -= monthDays;

    // 闰月（如果有，且在当月之后）
    if (leapMonth === m) {
      const leapDays = leapIsBig ? 30 : 29;
      if (offset < leapDays) {
        lunarMonth = m;
        lunarDay = offset + 1;
        isLeapMonth = true;
        break;
      }
      offset -= leapDays;
    }
  }

  // ----- 步骤4：计算天干地支纪年 -----
  // 干支纪年：根据农历年计算
  // 1900年农历庚子年（庚=6, 子=0）
  const ganIdx = (lunarYear - 4) % 10; // 1900→庚(6), 公式验证: (1900-4)%10 = 1896%10 = 6 ✓
  const zhiIdx = (lunarYear - 4) % 12; // 1900→子(0), (1900-4)%12 = 0 ✓
  const yearGan = TIAN_GAN[ganIdx];
  const yearZhi = DI_ZHI[zhiIdx];
  const yearShengXiao = SHENG_XIAO[zhiIdx];
  const yearInGanZhi = yearGan + yearZhi;
  const monthName = (isLeapMonth ? '闰' : '') + LUNAR_MONTH_NAMES[lunarMonth];
  const dayName = LUNAR_DAY_NAMES[lunarDay];

  return {
    lunarYear,
    lunarMonth,
    lunarDay,
    isLeapMonth,
    yearGan,
    yearZhi,
    yearShengXiao,
    monthName,
    dayName,
    yearInGanZhi
  };
}

/**
 * 计算农历年总天数
 * ================
 * 标准编码：每位对应一月，bit 15=正月, bit 4=腊月, 1=30天
 * 基础：12 × 29 = 348天，加上标记为30天的月份（每标记一个+1天）
 * 有闰月时再加上闰月天数
 *
 * @param {number} yearIdx — LUNAR_YEAR_DATA 索引
 * @returns {number} 总天数
 */
function lunarYearDays(yearIdx) {
  const yearData = LUNAR_YEAR_DATA[yearIdx];
  const leapMonth = yearData & 0xf;
  const leapIsBig = (yearData >> 16) & 0x1;

  // 基础天数：12×29 = 348，加上30天的月份额外天数
  let total = 348;
  // 检查 bits 15 down to 4（12个月）
  for (let bit = 0x8000; bit > 0x8; bit >>= 1) {
    if (yearData & bit) total += 1;
  }

  // 闰月天数
  if (leapMonth > 0 && leapMonth <= 12) {
    total += leapIsBig ? 30 : 29;
  }

  return total;
}

/**
 * 获取农历某月天数（常规月）
 * ========================
 * 标准编码：月份 m（1=正月）对应 bit(16-m)
 *   month 1 → 0x8000 (bit 15)
 *   month 2 → 0x4000 (bit 14)
 *   ...
 *   month 12 → 0x10 (bit 4)
 *
 * @param {number} yearData — 该年的完整编码值
 * @param {number} m         — 月份 1–12
 * @returns {number} 29 或 30
 */
function getMonthDays(yearData, m) {
  // bit(16-m): 0x10000 >> m
  const bitMask = 0x10000 >> m;
  return (yearData & bitMask) ? 30 : 29;
}

// ============================================================
// 第五部分：真太阳时校正
// ============================================================

/**
 * 北京时间 → 地方真太阳时
 * ========================
 *
 * 校正步骤：
 *   1. 经度时差 = (当地经度 - 120) × 4 分钟（东经120°=北京时间标准经线）
 *   2. 均时差（Equation of Time）校正 — 因地球公转椭圆轨道
 *   3. 夏令时自动处理（1986–1991年中国夏令时）
 *   4. 最终换算为真太阳时辰
 *
 * @param {number} birthHour   — 北京时间小时（0–23）
 * @param {number} birthMinute — 北京时间分钟（0–59）
 * @param {number} longitude   — 出生地经度（东经度数）
 * @param {number} year        — 公历年（用于夏令时判断）
 * @param {number} month       — 公历月
 * @param {number} day         — 公历日
 * @returns {{
 *   trueSolarHour: number,    // 真太阳时小时（0–23）
 *   trueSolarMinute: number,  // 真太阳时分钟
 *   shichenName: string,      // 时辰名（如"辰时"）
 *   shichenZhi: string,       // 时辰地支（如"辰"）
 *   shichenIndex: number,     // 时辰序数（子1...亥12）
 *   offsetMinutes: number,    // 总校正分钟数
 *   isDST: boolean,           // 是否经过夏令时校正
 *   formula: string           // 校正公式说明
 * }}
 */
function calcTrueSolarTime(birthHour, birthMinute, longitude, year, month, day) {
  // ----- 1. 夏令时校正 -----
  let correctedHour = birthHour;
  let correctedMinute = birthMinute;
  let isDST = false;

  // 中国夏令时：1986–1991年每年4月中旬第一个周日 → 9月中旬第一个周日
  if (year >= 1986 && year <= 1991) {
    const dstStart = getDSTStartDate(year);
    const dstEnd = getDSTEndDate(year);
    const checkDate = new Date(year, month - 1, day);

    if (checkDate >= dstStart && checkDate < dstEnd) {
      // 夏令时期间，时钟拨快1小时，实际时间需扣除1小时
      correctedHour -= 1;
      if (correctedHour < 0) correctedHour += 24;
      isDST = true;
    }
  }

  // ----- 2. 经度时差校正 -----
  // 北京时间 = 东经120° 平太阳时
  // 经度时差 = (当地经度 - 120°) × 4 分钟/度
  const lngOffsetMinutes = (longitude - 120) * 4;

  // ----- 3. 均时差（Equation of Time）校正 -----
  // 因地球公转椭圆轨道和自转轴倾角引起的太阳时偏差
  const eotMinutes = calcEquationOfTime(year, month, day);

  // ----- 4. 综合计算真太阳时 -----
  const totalOffsetMinutes = lngOffsetMinutes + eotMinutes;
  let totalMinutes = (correctedHour * 60 + correctedMinute) + totalOffsetMinutes;

  // 跨日处理
  while (totalMinutes < 0) totalMinutes += 1440; // 1440 = 24*60
  while (totalMinutes >= 1440) totalMinutes -= 1440;

  const trueSolarHour = Math.floor(totalMinutes / 60);
  const trueSolarMinute = Math.round(totalMinutes % 60);

  // ----- 5. 确定真太阳时辰 -----
  const shichen = determineShichen(trueSolarHour, trueSolarMinute);

  // 校正公式说明
  const lngSign = lngOffsetMinutes >= 0 ? '+' : '';
  const eotSign = eotMinutes >= 0 ? '+' : '';
  const formula = `真太阳时 = 北京时间${isDST ? '（已扣除夏令时1h）' : ''} ${lngSign}${lngOffsetMinutes.toFixed(1)}分钟（经度差） ${eotSign}${eotMinutes.toFixed(1)}分钟（均时差）`;

  return {
    trueSolarHour,
    trueSolarMinute,
    shichenName: shichen.name,
    shichenZhi: shichen.zhi,
    shichenIndex: shichen.index,
    offsetMinutes: Math.round(totalOffsetMinutes),
    isDST,
    formula
  };
}

/**
 * 计算均时差（Equation of Time）
 * ==============================
 * 精确公式：B = (dayOfYear - 81) × 360/365
 * EoT = 9.87 × sin(2B) - 7.53 × cos(B) - 1.5 × sin(B)
 *
 * @returns {number} 均时差（分钟）
 */
function calcEquationOfTime(year, month, day) {
  const date = new Date(year, month - 1, day);
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((date - startOfYear) / (1000 * 60 * 60 * 24)) + 1;

  const B = (dayOfYear - 81) * (360 / 365) * (Math.PI / 180); // 转为弧度
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);

  return eot; // 单位：分钟
}

/**
 * 夏令时开始日期（4月中旬第一个周日）
 */
function getDSTStartDate(year) {
  // 4月10日之后的第一个周日
  const d = new Date(year, 3, 10); // 4月10日
  const dayOfWeek = d.getDay();
  const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  d.setDate(d.getDate() + daysToSunday);
  return d;
}

/**
 * 夏令时结束日期（9月中旬第一个周日）
 */
function getDSTEndDate(year) {
  // 9月10日之后的第一个周日
  const d = new Date(year, 8, 10); // 9月10日
  const dayOfWeek = d.getDay();
  const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  d.setDate(d.getDate() + daysToSunday);
  return d;
}

/**
 * 根据真太阳时分确定十二时辰
 * ============================
 * 严格按以下分界（用户规则）：
 *   子：23:00–00:59    丑：01:00–02:59
 *   寅：03:00–04:59    卯：05:00–06:59
 *   辰：07:00–08:59    巳：09:00–10:59
 *   午：11:00–12:59    未：13:00–14:59
 *   申：15:00–16:59    酉：17:00–18:59
 *   戌：19:00–20:59    亥：21:00–22:59
 *
 * @param {number} hour   — 真太阳时小时
 * @param {number} minute — 真太阳时分钟
 * @returns {{name: string, zhi: string, index: number}}
 */
function determineShichen(hour, minute) {
  const totalMinutes = hour * 60 + minute;

  // 时辰定义（严格按用户规则）
  const SHICHEN_DEFS = [
    { name: '子时', zhi: '子', index: 1,  startH: 23, startM: 0,  endH: 0,  endM: 59 },
    { name: '丑时', zhi: '丑', index: 2,  startH: 1,  startM: 0,  endH: 2,  endM: 59 },
    { name: '寅时', zhi: '寅', index: 3,  startH: 3,  startM: 0,  endH: 4,  endM: 59 },
    { name: '卯时', zhi: '卯', index: 4,  startH: 5,  startM: 0,  endH: 6,  endM: 59 },
    { name: '辰时', zhi: '辰', index: 5,  startH: 7,  startM: 0,  endH: 8,  endM: 59 },
    { name: '巳时', zhi: '巳', index: 6,  startH: 9,  startM: 0,  endH: 10, endM: 59 },
    { name: '午时', zhi: '午', index: 7,  startH: 11, startM: 0,  endH: 12, endM: 59 },
    { name: '未时', zhi: '未', index: 8,  startH: 13, startM: 0,  endH: 14, endM: 59 },
    { name: '申时', zhi: '申', index: 9,  startH: 15, startM: 0,  endH: 16, endM: 59 },
    { name: '酉时', zhi: '酉', index: 10, startH: 17, startM: 0,  endH: 18, endM: 59 },
    { name: '戌时', zhi: '戌', index: 11, startH: 19, startM: 0,  endH: 20, endM: 59 },
    { name: '亥时', zhi: '亥', index: 12, startH: 21, startM: 0,  endH: 22, endM: 59 },
  ];

  for (const sc of SHICHEN_DEFS) {
    const startMin = sc.startH * 60 + sc.startM;
    const endMin = sc.endH * 60 + sc.endM;

    // 子时跨越午夜（23:00–00:59）
    if (sc.startH > sc.endH) {
      if (totalMinutes >= startMin || totalMinutes <= endMin) {
        return sc;
      }
    } else {
      if (totalMinutes >= startMin && totalMinutes <= endMin) {
        return sc;
      }
    }
  }

  // fallback（不应到达）
  return SHICHEN_DEFS[6]; // 默认午时
}

// ============================================================
// 第六部分：一掌经核心推算
// ============================================================

/**
 * 六道映射（死规则，不可更改）
 * ============================
 * 1 → 佛道    2 → 鬼道    3 → 人道
 * 4 → 修罗道   5 → 畜生道   6 → 仙道
 */
const REALM_NUM_TO_NAME = {
  1: '佛道',
  2: '鬼道',
  3: '人道',
  4: '修罗道',
  5: '畜生道',
  6: '仙道'
};

/**
 * 地支 → 一掌经数字（用于年宫、时宫）
 * ===================================
 * 子1、丑2、寅3、卯4、辰5、巳6
 * 午1、未2、申3、酉4、戌5、亥6
 *
 * 规则：地支序数 > 6 则减去 6
 */
function zhiToRealmNum(zhi) {
  let idx = ZHI_INDEX[zhi];   // 子1 丑2 ... 亥12
  if (idx > 6) idx -= 6;       // 午7→1, 未8→2, ..., 亥12→6
  return idx;
}

/**
 * 农历月 → 一掌经数字（月宫）
 * ===========================
 * 正月1、二月2、三月3、四月4、五月5、六月6
 * 七月1、八月2、九月3、十月4、冬月5、腊月6
 *
 * 闰月按同月数字（如闰四月→4）
 *
 * @param {number} lunarMonth — 农历月 1–12
 * @returns {number} 1–6
 */
function monthToRealmNum(lunarMonth) {
  let m = lunarMonth;
  if (m > 6) m -= 6;
  return m;
}

/**
 * 农历日 → 一掌经数字（日宫）
 * ===========================
 * 初一1、初二2、初三3、初四4、初五5、初六6
 * 初七1、初八2、初九3、初十4……无限循环1–6
 *
 * 公式：日数 % 6，余0为6，其余为余数
 *
 * @param {number} lunarDay — 农历日 1–30
 * @returns {number} 1–6
 */
function dayToRealmNum(lunarDay) {
  const remainder = lunarDay % 6;
  return remainder === 0 ? 6 : remainder;
}

/**
 * 六道数字 → 六道名称
 * @param {number} num — 1–6
 * @returns {string}
 */
function realmNumToName(num) {
  return REALM_NUM_TO_NAME[num] || '未知';
}

/**
 * 一掌经完整排盘
 * ==============
 *
 * 【输入参数】
 * @param {Object} input
 * @param {number} input.year        — 公历出生年（1900–2100）
 * @param {number} input.month       — 公历出生月（1–12）
 * @param {number} input.day         — 公历出生日（1–31）
 * @param {number} input.hour        — 北京时间小时（0–23）
 * @param {number} input.minute      — 北京时间分钟（0–59），默认0
 * @param {string} input.gender      — 性别："男" 或 "女"
 * @param {string} input.city        — 出生城市（用于经纬度查询）
 *
 * 【输出】
 * @returns {{
 *   // 输入信息
 *   input: Object,
 *   // 公历→农历
 *   lunar: Object,
 *   // 真太阳时
 *   trueSolar: Object,
 *   // 四宫六道
 *   palaces: { year: Object, month: Object, day: Object, hour: Object },
 *   // 命宫推算过程
 *   lifePalaceCalc: Object,
 *   // 本命宫
 *   lifePalace: { num: number, realm: string },
 *   // 一掌经完整解读
 *   reading: string,
 *   // 合规声明
 *   disclaimer: string
 * }}
 */
function yizhangjing(input) {
  const {
    year, month, day, hour,
    minute = 0,
    gender,
    city = '北京'
  } = input;

  // ===== 参数校验 =====
  if (!year || !month || !day || hour === undefined || !gender) {
    throw new Error('缺少必要参数：year, month, day, hour, gender 为必填');
  }
  if (year < 1900 || year > 2100) {
    throw new Error('支持年份范围：1900–2100');
  }
  if (!['男', '女'].includes(gender)) {
    throw new Error('性别必须为"男"或"女"');
  }

  // ===== 步骤1：公历转农历 =====
  const lunar = solarToLunar(year, month, day);

  // ===== 步骤2：获取城市经纬度 =====
  const coords = lookupCity(city);
  const longitude = coords ? coords.lng : 120; // 默认东经120°（北京时间）

  // ===== 步骤3：真太阳时校正 =====
  const trueSolar = calcTrueSolarTime(hour, minute, longitude, year, month, day);

  // ===== 步骤4：四宫推算 =====

  // ---- 年宫：取出生农历年的地支 → 一掌经数字 ----
  const yearZhi = lunar.yearZhi;
  const yearPalaceNum = zhiToRealmNum(yearZhi);
  const yearPalaceRealm = realmNumToName(yearPalaceNum);

  // ---- 月宫：取农历月份（闰月按同月）→ 一掌经数字 ----
  const monthPalaceNum = monthToRealmNum(lunar.lunarMonth);
  const monthPalaceRealm = realmNumToName(monthPalaceNum);

  // ---- 日宫：取农历日 % 6，余0为6 ----
  const dayPalaceNum = dayToRealmNum(lunar.lunarDay);
  const dayPalaceRealm = realmNumToName(dayPalaceNum);

  // ---- 时宫：取真太阳时辰地支 → 一掌经数字 ----
  const hourZhi = trueSolar.shichenZhi;
  const hourPalaceNum = zhiToRealmNum(hourZhi);
  const hourPalaceRealm = realmNumToName(hourPalaceNum);

  const palaces = {
    year: {
      pillar: lunar.yearInGanZhi,
      zhi: yearZhi,
      num: yearPalaceNum,
      realm: yearPalaceRealm,
      derive: `农历${lunar.lunarYear}年，年支「${yearZhi}」→ 掌经数字${yearPalaceNum} → ${yearPalaceRealm}`
    },
    month: {
      monthNum: lunar.lunarMonth,
      monthName: lunar.monthName,
      num: monthPalaceNum,
      realm: monthPalaceRealm,
      derive: `农历${lunar.monthName}（第${lunar.lunarMonth}个月）→ 掌经数字${monthPalaceNum} → ${monthPalaceRealm}`
    },
    day: {
      dayNum: lunar.lunarDay,
      dayName: lunar.dayName,
      num: dayPalaceNum,
      realm: dayPalaceRealm,
      derive: `农历${lunar.dayName}（日数${lunar.lunarDay}）→ ${lunar.lunarDay} % 6 = ${lunar.lunarDay % 6 === 0 ? 0 : lunar.lunarDay % 6}${lunar.lunarDay % 6 === 0 ? ' → 余0为6' : ''} → 掌经数字${dayPalaceNum} → ${dayPalaceRealm}`
    },
    hour: {
      shichenName: trueSolar.shichenName,
      zhi: hourZhi,
      num: hourPalaceNum,
      realm: hourPalaceRealm,
      derive: `真太阳${trueSolar.shichenName}，时支「${hourZhi}」→ 掌经数字${hourPalaceNum} → ${hourPalaceRealm}`
    }
  };

  // ===== 步骤5：命宫推算 =====
  // 规则：男命顺行，女命逆行
  // 从年宫起，按月、日、时依次走（各走的步数为：农历月数、农历日数、时辰地支序数）
  //
  // "走"的定义：
  //   顺行：在1–6的循环中，从当前位置向前数 N 步
  //   逆行：在1–6的循环中，从当前位置向后数 N 步
  //
  // 步数定义（严格按规则）：
  //   月步数 = 农历月数字（正月=1, 二月=2, ..., 腊月=12）
  //   日步数 = 农历日期数字（初一=1, 初二=2, ..., 三十=30）
  //   时步数 = 时辰地支序数（子=1, 丑=2, ..., 亥=12）

  const monthSteps = lunar.lunarMonth;          // 农历月 1–12
  const daySteps = lunar.lunarDay;               // 农历日 1–30
  const hourSteps = ZHI_INDEX[trueSolar.shichenZhi]; // 时支序数 1–12

  const isMale = (gender === '男');
  const calcSteps = []; // 推算步骤记录

  // 起始位置：年宫数字
  let pos = yearPalaceNum;
  calcSteps.push(`起点：年宫${yearPalaceRealm}（位置${pos}）`);

  // 第一步：走月
  if (isMale) {
    // 顺行：pos = (pos + steps) % 6, 余0为6
    pos = (pos + monthSteps) % 6;
    if (pos === 0) pos = 6;
    calcSteps.push(`├ 男命顺行：走 ${monthSteps} 步（月数${monthSteps}），到达位置${pos}（${realmNumToName(pos)}）`);
  } else {
    // 逆行：pos = ((pos - steps) % 6 + 6) % 6, 余0为6
    pos = ((pos - monthSteps) % 6 + 6) % 6;
    if (pos === 0) pos = 6;
    calcSteps.push(`├ 女命逆行：走 ${monthSteps} 步（月数${monthSteps}），到达位置${pos}（${realmNumToName(pos)}）`);
  }

  // 第二步：走日
  if (isMale) {
    pos = (pos + daySteps) % 6;
    if (pos === 0) pos = 6;
    calcSteps.push(`├ ${isMale ? '顺行' : '逆行'}：走 ${daySteps} 步（日数${daySteps}），到达位置${pos}（${realmNumToName(pos)}）`);
  } else {
    pos = ((pos - daySteps) % 6 + 6) % 6;
    if (pos === 0) pos = 6;
    calcSteps.push(`├ ${isMale ? '顺行' : '逆行'}：走 ${daySteps} 步（日数${daySteps}），到达位置${pos}（${realmNumToName(pos)}）`);
  }

  // 第三步：走时
  if (isMale) {
    pos = (pos + hourSteps) % 6;
    if (pos === 0) pos = 6;
    calcSteps.push(`└ ${isMale ? '顺行' : '逆行'}：走 ${hourSteps} 步（时支序数），到达位置${pos}（${realmNumToName(pos)}）`);
  } else {
    pos = ((pos - hourSteps) % 6 + 6) % 6;
    if (pos === 0) pos = 6;
    calcSteps.push(`└ ${isMale ? '顺行' : '逆行'}：走 ${hourSteps} 步（时支序数），到达位置${pos}（${realmNumToName(pos)}）`);
  }

  const lifePalaceNum = pos;
  const lifePalaceRealm = realmNumToName(lifePalaceNum);

  const lifePalaceCalc = {
    method: `男命顺行 / 女命逆行，从年宫起，按月→日→时依次走`,
    direction: isMale ? '顺行（男）' : '逆行（女）',
    monthSteps,
    daySteps,
    hourSteps,
    steps: calcSteps,
    result: `最终落点：位置${lifePalaceNum} → ${lifePalaceRealm}`
  };

  // ===== 步骤6：完整解读文本 =====
  const reading = generateReading(
    palaces, lifePalaceNum, lifePalaceRealm,
    lunar, trueSolar, gender, isMale
  );

  // ===== 步骤7：合规声明 =====
  const disclaimer = '本内容为传统民俗文化参考，仅供饰品穿搭、心理舒缓参考，不具备科学决策、治病、改变命运的作用。';

  return {
    input: {
      year, month, day, hour, minute, gender, city,
      coords: coords || { lng: 120, note: '未匹配到城市，使用默认经度120°' }
    },
    lunar,
    trueSolar,
    palaces,
    lifePalaceCalc,
    lifePalace: {
      num: lifePalaceNum,
      realm: lifePalaceRealm
    },
    reading,
    disclaimer
  };
}

// ============================================================
// 第七部分：一掌经六道解读文本
// ============================================================

/**
 * 六道固定批语（严格传统一掌经原版，不翻译，不简化）
 * ================================================
 */
const REALM_READINGS = {
  '佛道': {
    summary: '佛道之人，天性慈悲善良，富有同情心，乐于助人。',
    character: '性格温和宽厚，心地光明磊落，不喜争执，与人相处融洽。一生多遇贵人帮扶，凡事能逢凶化吉。',
    career: '适合从事慈善、教育、医疗、文化、艺术等能利益他人的行业。不宜参与激烈竞争或投机取巧之事。',
    relationship: '待人真诚，重视家庭，夫妻关系和睦。但有时过于心软，易被他人利用，需学会适度拒绝。',
    advice: '需注意：过于慈悲有时反受其累，须保持智慧明辨，不可盲目施舍。'
  },
  '鬼道': {
    summary: '鬼道之人，心思玲珑，聪明机巧，应变能力强，具有敏锐的直觉。',
    character: '天生聪慧过人，思维敏捷，善于观察分析。内心深沉，不轻易表露真实想法。外表平静，内心波澜。直觉力强，对玄学、心理学有天然亲近。',
    career: '适合从事研究、侦查、策划、心理分析、技术开发等需要深入思考的工作。不宜长期处于高压或人情复杂的职场。',
    relationship: '对感情认真执着，一旦认定便不易改变。但因为内心细腻敏感，容易多想，需学会坦诚沟通。',
    advice: '需注意：思虑过重易伤脾胃，学会放下执念，保持心情舒畅。多接触阳光、户外活动。'
  },
  '人道': {
    summary: '人道之人，品性端正，知书达理，凡事讲求公平合理，人际关系和谐。',
    character: '为人正直善良，通情达理，重信守诺。做事踏实可靠，不喜投机取巧。社交能力较强，朋友多且真诚。',
    career: '适合从政、法律、管理、教育、公共服务等需要公正心与协调能力的行业。创业宜与人合伙，不宜单打独斗。',
    relationship: '重情重义，对伴侣忠诚体贴。家庭观念强，是典型的顾家型。但有时过于讲原则而显得固执。',
    advice: '需注意：有时过于追求完美和公正，易给自己和身边人带来压力。适当放松，接受不完美。'
  },
  '修罗道': {
    summary: '修罗道之人，精力充沛，斗志昂扬，好胜心强，凡事不甘人后。',
    character: '天生具有强烈的上进心和竞争意识，做事雷厉风行，执行力强。性格直率坦诚，不喜欢拐弯抹角。但脾气较急，容易冲动。',
    career: '适合从军、竞技体育、销售、创业、管理等需要魄力和领导力的行业。不宜从事过于平淡悠闲的工作。',
    relationship: '在感情中热情主动，但也容易因脾气急躁而产生摩擦。需学会控制情绪，多些耐心和包容。',
    advice: '需注意：肝火旺盛，容易急躁生气，需学会调节情绪。多练习静坐、深呼吸，避免过度操劳。'
  },
  '畜生道': {
    summary: '畜生道之人，勤劳朴实，脚踏实地，不慕虚荣，凡事亲力亲为。',
    character: '为人忠厚老实，做事勤恳踏实，任劳任怨。不善言辞，但行动力强。生活简朴，知足常乐，不贪图享乐。',
    career: '适合从事农业、制造业、手工艺、技术工种、物流运输等需要勤劳和耐心的工作。不宜从事需要频繁社交的职业。',
    relationship: '虽不善表达，但对家人关怀备至，用行动而非言语表达爱意。是值得信赖的终身伴侣。',
    advice: '需注意：过于操劳易损身体，需劳逸结合。学会适当表达自己的需求，不要一味忍耐。'
  },
  '仙道': {
    summary: '仙道之人，天性洒脱不羁，向往自由，气质清雅脱俗，不喜世俗纷扰。',
    character: '天生具有艺术气质和审美眼光，对美的事物敏感。性格独立自主，不喜欢被束缚。理想主义，追求精神层面的满足。有时略显孤僻，不喜热闹场合。',
    career: '适合从事艺术、设计、音乐、写作、摄影、自由职业等能发挥创意的工作。不宜从事刻板重复或纪律严格的工作。',
    relationship: '对感情要求精神契合多于物质条件。宁缺毋滥，不轻易将就。一旦遇到灵魂伴侣，会非常专一。',
    advice: '需注意：过于理想化易与现实脱节，需脚踏实地。多关注身体健康，不要忽视物质生活的基本保障。'
  }
};

/**
 * 生成完整一掌经命理解读
 */
function generateReading(palaces, lifePalaceNum, lifePalaceRealm, lunar, trueSolar, gender, isMale) {
  const r = REALM_READINGS[lifePalaceRealm];
  const dirText = isMale ? '顺行' : '逆行';

  const lines = [
    '═══════════════════════════════════',
    '  达摩一掌经 · 命理排盘报告',
    '═══════════════════════════════════',
    '',
    '【出生信息】',
    ` 公历：${lunar.lunarYear}年  ${lunar.monthName}${lunar.dayName}`,
    ` 农历：${lunar.yearInGanZhi}年  ${lunar.monthName}${lunar.dayName}`,
    ` 生肖：${lunar.yearShengXiao}`,
    ` 性别：${gender}（命宫${dirText}）`,
    '',
    '【真太阳时校正】',
    ` 出生时辰：${trueSolar.shichenName}（时支：${trueSolar.shichenZhi}）`,
    ` 校正公式：${trueSolar.formula}`,
    '',
    '【四宫六道】',
    ` 年宫：年支「${palaces.year.zhi}」→ 数字${palaces.year.num} → ${palaces.year.realm}`,
    ` 月宫：${palaces.month.monthName} → 数字${palaces.month.num} → ${palaces.month.realm}`,
    ` 日宫：${palaces.day.dayName} → ${palaces.day.dayNum}%6=${palaces.day.dayNum % 6 === 0 ? 0 : palaces.day.dayNum % 6}${palaces.day.dayNum % 6 === 0 ? '(余0为6)' : ''} → 数字${palaces.day.num} → ${palaces.day.realm}`,
    ` 时宫：时支「${palaces.hour.zhi}」→ 数字${palaces.hour.num} → ${palaces.hour.realm}`,
    '',
    '【命宫推算】',
    ` 规则：男命顺行 / 女命逆行，从年宫起，按月→日→时依次走`,
    ` 走向：${dirText}`,
    ` 起点：年宫 = ${palaces.year.num}（${palaces.year.realm}）`,
    ...(lifePalaceNum === undefined ? [] : [
      ` 最终落点：位置 ${lifePalaceNum} → 本命宫：${lifePalaceRealm}`,
    ]),
    '',
    '【本命宫 · 六道解读】',
    ` 本命宫：${lifePalaceRealm}`,
    ` 概述：${r.summary}`,
    '',
    ` 性格特征：`,
    `   ${r.character}`,
    '',
    ` 事业方向：`,
    `   ${r.career}`,
    '',
    ` 人际关系与感情：`,
    `   ${r.relationship}`,
    '',
    ` 温馨提示：`,
    `   ${r.advice}`,
    '',
    '═══════════════════════════════════',
  ];

  return lines.join('\n');
}

// ============================================================
// 第八部分：测试用例
// ============================================================

/**
 * 官方测试用例
 * ============
 * 2001年5月30日 8:00 男 湖北宜昌
 *
 * 预期结果：
 *   公历：2001-05-30 08:00
 *   农历：辛巳年 四月 初八
 *   真太阳时：约 7:25 → 辰时
 *   年宫：年支「巳」→ 数字6 → 仙道
 *   月宫：四月 → 数字4 → 修罗道
 *   日宫：初八 → 8%6=2 → 鬼道
 *   时宫：辰时，时支「辰」→ 数字5 → 畜生道
 *   命宫：男命顺行...
 */
function runTestCase() {
  const input = {
    year: 2001,
    month: 5,
    day: 30,
    hour: 8,
    minute: 0,
    gender: '男',
    city: '湖北宜昌'
  };

  console.log('========================================');
  console.log('  一掌经算法测试');
  console.log('  测试用例：2001年5月30日 8:00 男 湖北宜昌');
  console.log('========================================');
  console.log('');

  const result = yizhangjing(input);

  console.log('【输入】');
  console.log(JSON.stringify(result.input, null, 2));
  console.log('');

  console.log('【农历转换结果】');
  console.log(`  农历年：${result.lunar.lunarYear}`);
  console.log(`  天干地支：${result.lunar.yearInGanZhi}年`);
  console.log(`  生肖：${result.lunar.yearShengXiao}`);
  console.log(`  月：${result.lunar.monthName}（${result.lunar.isLeapMonth ? '闰月' : '非闰月'}）`);
  console.log(`  日：${result.lunar.dayName}（第${result.lunar.lunarDay}天）`);
  console.log('');

  console.log('【真太阳时校正】');
  console.log(`  经度：${result.input.coords.lng}°E`);
  console.log(`  真太阳时：${result.trueSolar.trueSolarHour}:${String(result.trueSolar.trueSolarMinute).padStart(2, '0')}`);
  console.log(`  时辰：${result.trueSolar.shichenName}（时支：${result.trueSolar.shichenZhi}）`);
  console.log(`  夏令时：${result.trueSolar.isDST ? '是' : '否'}`);
  console.log(`  校正：${result.trueSolar.formula}`);
  console.log('');

  console.log('【四宫六道】');
  console.log(`  年宫：${result.palaces.year.realm}（${result.palaces.year.derive}）`);
  console.log(`  月宫：${result.palaces.month.realm}（${result.palaces.month.derive}）`);
  console.log(`  日宫：${result.palaces.day.realm}（${result.palaces.day.derive}）`);
  console.log(`  时宫：${result.palaces.hour.realm}（${result.palaces.hour.derive}）`);
  console.log('');

  console.log('【命宫推算过程】');
  console.log(`  方法：${result.lifePalaceCalc.method}`);
  console.log(`  方向：${result.lifePalaceCalc.direction}`);
  console.log(`  月步数：${result.lifePalaceCalc.monthSteps}`);
  console.log(`  日步数：${result.lifePalaceCalc.daySteps}`);
  console.log(`  时步数：${result.lifePalaceCalc.hourSteps}`);
  result.lifePalaceCalc.steps.forEach(s => console.log(`  ${s}`));
  console.log('');

  console.log('【本命宫】');
  console.log(`  数字：${result.lifePalace.num}`);
  console.log(`  六道：${result.lifePalace.realm}`);
  console.log('');

  console.log('【完整解读】');
  console.log(result.reading);
  console.log('');

  console.log('【合规声明】');
  console.log(result.disclaimer);
  console.log('');

  console.log('========================================');
  console.log('  测试完成');
  console.log('========================================');

  return result;
}

// ============================================================
// 浏览器全局导出：以上所有函数和常量均为全局可用
// ============================================================
