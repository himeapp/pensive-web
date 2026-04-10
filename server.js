require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

app.post('/api/parse', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured on server' });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 1000,
        messages: [
          {
            role: 'system',
            content:
              '당신은 한국어 의식의 흐름 텍스트에서 주요 관념을 구조화하는 도우미입니다.\n' +
              '상위 카테고리(부모)와 구체적인 생각들(자식)을 추출하세요.\n' +
              '규칙:\n' +
              '1. catName은 한글 3~10자의 핵심 주제어\n' +
              '2. 비슷한 내용의 생각은 하나의 카테고리로 묶기\n' +
              '3. 카테고리 1~6개, thoughts는 원문에서 가져오기\n' +
              '4. 한 덩어리가 길면(쉼표·마침표 없이 이어진 경우) 의미나 호흡 단위로 나눠 thoughts에 여러 문자열로 넣기\n' +
              '5. 반드시 아래 JSON만 출력 (마크다운/설명 금지):\n' +
              '{"groups":[{"catName":"카테고리명","thoughts":["생각1","생각2"]}]}',
          },
          { role: 'user', content: text },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || 'OpenAI error' });
    }

    const data = await response.json();
    let content = (data.choices?.[0]?.message?.content || '').trim();
    const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/m);
    if (fence) content = fence[1].trim();

    let parsed;
    try { parsed = JSON.parse(content); } catch { return res.status(502).json({ error: 'Invalid AI response' }); }

    const groups = (parsed.groups || [])
      .filter(g => g && typeof g.catName === 'string' && g.catName.trim())
      .map(g => ({
        catName: g.catName.trim(),
        thoughts: Array.isArray(g.thoughts)
          ? g.thoughts.filter(t => typeof t === 'string' && t.trim()).map(t => t.trim())
          : [],
      }));

    res.json({ groups });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Mind Cleanse server: http://localhost:${PORT}`));
