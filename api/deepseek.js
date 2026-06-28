/**
 * Vercel Serverless Function — DeepSeek API 代理
 *
 * 前端调用 /api/deepseek，此函数转发到 DeepSeek API
 * API Key 存储在 Vercel 环境变量 DEEPSEEK_API_KEY 中
 *
 * 部署后在 Vercel Dashboard → Settings → Environment Variables 添加 DEEPSEEK_API_KEY
 */

export default async function handler(req, res) {
  // 仅允许 POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (process.env.DEEPSEEK_API_KEY || '')
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
