/**
 * DeepSeek V4 API 调用模块（Web版）
 * 通过 Vercel Serverless Function 代理调用，API Key 存储在服务端环境变量
 */
function buildPrompt(baziData, inputInfo) {
  const { year, month, day, hour, minute, city, gender } = inputInfo;

  var localBazi = '';
  if (baziData && baziData.pillars) {
    const p = baziData.pillars;
    localBazi = '年柱' + p.year + ' 月柱' + p.month + ' 日柱' + p.day + ' 时柱' + p.hour;
    if (baziData.wangShuai) {
      const ws = baziData.wangShuai;
      localBazi += '\n旺衰判定：' + ws.bodyLevel + '（' + ws.pattern + '），喜用神：' + ws.yongShen + '，忌神：' + ws.jiShen;
    }
    if (baziData.crystal && baziData.crystal.mainCrystal) {
      localBazi += '\n饰品主推：' + baziData.crystal.mainCrystal.map(function(c) { return c.element + '→' + c.list.join('、'); }).join('，');
    }
  }

  return '你是一位传统文化研究者。请根据以下出生信息重新精确排盘并分析。\n\n' +
    '【出生信息】\n' +
    '公历：' + year + '年' + month + '月' + day + '日 ' + hour + '点' + minute + '分\n' +
    '城市：' + city + '（用于确定真太阳时）\n' +
    '性别：' + gender + '\n' +
    '本地推算参考：' + localBazi + '\n\n' +
    '---\n\n' +
    '请严格按照以下格式输出，每项一行，简洁明了，不用长篇大论：\n\n' +
    '【八字排盘】\n' +
    '年柱：×× | 月柱：×× | 日柱：×× | 时柱：××\n\n' +
    '【五行统计】\n' +
    '金：×个 | 木：×个 | 水：×个 | 火：×个 | 土：×个\n\n' +
    '【日主分析】\n' +
    '日主：×（×）| 强弱：身强/身弱 | 喜用神：×、× | 忌神：×、×\n\n' +
    '【性格特点】\n' +
    '（用2-3句大白话概括，不超过80字）\n\n' +
    '【事业财运】\n' +
    '（用2-3句大白话概括，不超过80字）\n\n' +
    '【健康提醒】\n' +
    '（用2-3句大白话，提具体部位如"注意肠胃消化""容易睡眠不好"，不超过80字）\n\n' +
    '【2026-2027 流年提醒】\n' +
    '（3-4条简短提醒，每条一行，用 · 开头）\n\n' +
    '【珠宝饰品推荐】\n' +
    '请按以下表格格式输出，每行一个推荐品（涵盖黄金首饰、水晶、玉石、木质文玩等多品类）：\n' +
    '推荐：×× | 五行：× | 品类：黄金/水晶/玉石/木饰 | 佩戴：左手/右手 | 功效：一句话说明（用合规词：舒缓情绪/提升气场/穿搭参考/心理放松）\n' +
    '至少推荐6款，品类不限水晶，鼓励推荐金饰、玉石、木饰等非水晶品类\n\n' +
    '【禁忌提醒】\n' +
    '（1-2句说明不建议佩戴的品类及原因，不超过50字）\n\n' +
    '---\n\n' +
    '【严格合规要求——必须遵守】：\n' +
    '1. 全文开头必须加："本内容为传统民俗文化参考，仅供饰品穿搭、心理舒缓参考，不具备科学决策、治病、改变命运的作用。"\n' +
    '2. 全文禁止出现：辟邪、化煞、改运、转运、算命、占卜、作法、驱鬼、消灾、化解、招财、挡灾、开光、护身符、保平安\n' +
    '3. 功效描述一律用：舒缓情绪、提升气场、穿搭参考、民俗文化、心理放松、增强自信、调节心情、改善睡眠、提升专注力、激发灵感\n' +
    '4. 语气轻松温暖，像朋友聊天';
}

function callDeepSeek(baziData, inputInfo) {
  var prompt = buildPrompt(baziData, inputInfo);

  return fetch('/api/deepseek', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一位友善的传统文化研究者，用简洁清晰的大白话交流。输出格式严格按用户要求的卡片式结构，每项一行，不写长篇大论。严格遵守合规要求。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4096,
      stream: false
    })
  }).then(function(res) {
    if (!res.ok) throw new Error('API error: ' + res.status);
    return res.json();
  }).then(function(data) {
    return data.choices[0].message.content;
  });
}

function callDeepSeekWithRetry(baziData, inputInfo, retries) {
  retries = retries || 2;
  var attempt = 0;
  function tryCall() {
    return callDeepSeek(baziData, inputInfo).catch(function(err) {
      attempt++;
      if (attempt <= retries) {
        console.log('Retry ' + attempt + '...');
        return tryCall();
      }
      throw err;
    });
  }
  return tryCall();
}

// Browser global: callDeepSeek / callDeepSeekWithRetry / buildPrompt are available globally
