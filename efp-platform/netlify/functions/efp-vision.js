// netlify/functions/efp-vision.js
// Proxies Anthropic API calls server-side — supports both vision (image) and text-only modes.

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { apiKey, imageBase64, mediaType, textContent, customPrompt, mode } = body;

  if (!apiKey) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Missing apiKey' }) };
  if (!imageBase64 && !textContent) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Missing imageBase64 or textContent' }) };

  // Build content array
  const content = [];

  if (imageBase64) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: mediaType || 'image/png', data: imageBase64 }
    });
  }

  // Select prompt based on mode
  let prompt;
  if (customPrompt) {
    prompt = customPrompt;
  } else if (mode === 'bulk-extract') {
    const doc = textContent ? `DOCUMENT:\n${textContent}\n\n` : '';
    prompt = `${doc}Extract ALL players mentioned as available for transfer in this document/screenshot.
Return ONLY a JSON array (no markdown):
[{
  "name": "Full player name",
  "club": "Their current club (infer from context if not stated)",
  "availability": "Free to leave|Permanent preferred|Loan preferred|Open to offer",
  "deal_type": "Permanent|Loan|Flexible",
  "price_indication": "e.g. Free, €3M, TBD or null",
  "notes": "Any conditions, salary caps, loan-with-option details etc"
}]
Only include players explicitly mentioned as available. If the message is from a specific club, use that as the club.`;
  } else if (mode === 'player-research') {
    const player = textContent || '';
    prompt = `You are a professional football data analyst. Research this player and return a complete profile as JSON only (no markdown):
{
  "name": "Full name",
  "club": "Current club",
  "position": "MUST be one of: GK RB CB LB CDM CM CAM RW LW SS ST",
  "age": 25,
  "dob": "YYYY-MM-DD or null",
  "nationality": "Primary nationality",
  "height_cm": 183,
  "preferred_foot": "Right|Left|Both",
  "contract_expiry": "e.g. Jun 2027 or null",
  "market_value": "e.g. €5M or null",
  "market_value_eur": 5000000,
  "strengths": "2-3 sentence playing style / key attributes",
  "stats_summary": "Recent season key stats e.g. 12G 7A in 2. Bundesliga 25/26 or null",
  "transfer_history": "Brief — last 2 clubs and fees if known",
  "eu_passport": true
}
Player to research: ${player}
Use your training data. Return null for anything uncertain rather than guessing.`;
  } else {
    // Default: single-player club needs extraction (original mode)
    const doc = textContent ? `DOCUMENT:\n${textContent}\n\n` : '';
    prompt = `${doc}Extract football club recruitment info. Return ONLY JSON:
{"club":null,"positions":[],"age_min":null,"age_max":null,"budget_min":null,"budget_max":null,"deal_type":null,"preferred_foot":"Either","nationality":null,"contact":null,"priority":"Medium","notes":null}
Valid positions: GK RB CB LB CDM CM CAM RW LW SS ST. striker=ST, winger=RW/LW, def mid=CDM. Budgets as numbers: 3M=3000000, 600k=600000.`;
  }

  content.push({ type: 'text', text: prompt });

  const payload = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: mode === 'player-research' ? 600 : mode === 'bulk-extract' ? 1200 : 800,
    messages: [{ role: 'user', content }]
  };

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    return {
      statusCode: resp.status,
      headers: { ...cors, 'content-type': 'application/json' },
      body: JSON.stringify(data)
    };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
