var fs = require("fs");
var html = fs.readFileSync("/Users/mac/Desktop/fujiuyuan-web/index.html", "utf8");

// 1. Update startAnalysis fallback chain
var oldChain = '  // 调用 API（走 Vercel 代理，失败则仅出本地结果）\n  callDeepSeekWithRetry(baziData, inputInfo, 2).then(function(raw) {\n    showFullResult(raw, inputInfo, baziData);\n  }).catch(function(err) {\n    console.log(\'API unavailable, showing local results only.\');\n    showLocalOnlyResult(inputInfo, baziData);\n  });';

var newChain = '  // 调用 API（先直连 DeepSeek，失败走 Vercel 代理，再失败仅本地结果）\n  tryDirectDeepSeek(baziData, inputInfo).then(function(raw) {\n    showFullResult(raw, inputInfo, baziData);\n  }).catch(function(err) {\n    console.log(\'Direct API failed, trying Vercel proxy...\');\n    callDeepSeekWithRetry(baziData, inputInfo, 2).then(function(raw) {\n      showFullResult(raw, inputInfo, baziData);\n    }).catch(function(err2) {\n      console.log(\'API unavailable, showing local results only.\');\n      showLocalOnlyResult(inputInfo, baziData);\n    });\n  });';

if (html.includes(oldChain)) {
  html = html.replace(oldChain, newChain);
  console.log("Step 1: chain updated");
} else {
  console.log("Step 1: chain NOT FOUND - checking...");
  var idx = html.indexOf("callDeepSeekWithRetry(baziData, inputInfo, 2)");
  console.log("Found callDeepSeekWithRetry at:", idx);
}

// 2. Add tryDirectDeepSeek after showLocalOnlyResult
var marker = "APP.currentResult = { raw: null, inputInfo: inputInfo, baziData: baziData, localOnly: true };";
var idx2 = html.indexOf(marker);
if (idx2 === -1) { console.log("marker not found"); process.exit(1); }

var afterMarker = html.indexOf("\n", idx2);
afterMarker = html.indexOf("}", afterMarker);
afterMarker = html.indexOf("\n", afterMarker);

var newFn = '\n\t// 直连 DeepSeek API（国内用户主要通路）\n\tfunction tryDirectDeepSeek(baziData, inputInfo) {\n\t  var prompt = buildPrompt(baziData, inputInfo);\n\t  return fetch("https://api.deepseek.com/v1/chat/completions", {\n\t    method: "POST",\n\t    headers: {\n\t      "Content-Type": "application/json",\n\t      "Authorization": "Bearer sk-3b01e2de8cd142f8b6697aa197ab64a8"\n\t    },\n\t    body: JSON.stringify({\n\t      model: "deepseek-chat",\n\t      messages: [\n\t        { role: "system", content: "你是一位友善的传统文化研究者，用简洁清晰的大白话交流。输出格式严格按用户要求的卡片式结构，每项一行，不写长篇大论。严格遵守合规要求。" },\n\t        { role: "user", content: prompt }\n\t      ],\n\t      temperature: 0.7,\n\t      max_tokens: 4096,\n\t      stream: false\n\t    })\n\t  }).then(function(res) {\n\t    if (!res.ok) throw new Error("API error: " + res.status);\n\t    return res.json();\n\t  }).then(function(data) {\n\t    return data.choices[0].message.content;\n\t  });\n\t}\n';

html = html.substring(0, afterMarker) + newFn + html.substring(afterMarker);
fs.writeFileSync("/Users/mac/Desktop/fujiuyuan-web/index.html", html);
console.log("Done");
