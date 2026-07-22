// netlify/functions/efp-vision.js
// Proxies Anthropic vision API calls server-side to avoid mobile Safari CORS blocks.

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };
  }

  let apiKey, imageBase64, mediaType;
  try {
    ({ apiKey, imageBase64, mediaType } = JSON.parse(event.body || '{}'));
  } catch (e) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!apiKey || !imageBase64) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Missing apiKey or imageBase64' }) };
  }

  const payload = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType || 'image/png', data: imageBase64 }
        },
        {
          type: 'text',
          text: `Extract football club recruitment info from this screenshot. Return ONLY a JSON object (no markdown, no explanation):
{
  "club": "club name or null",
  "positions": ["array of positions — ONLY from: GK RB CB LB CDM CM CAM RW LW SS ST"],
  "age_min": null_or_number,
  "age_max": null_or_number,
  "budget_min": null_or_number_in_euros,
  "budget_max": null_or_number_in_euros,
  "deal_type": "Permanent|Loan|Loan with Option|Loan with Obligation|Flexible|null",
  "preferred_foot": "Either|Right|Left",
  "nationality": "any passport/nationality requirements or null",
  "contact": "contact name and role or null",
  "priority": "Urgent|High|Medium|Low",
  "notes": "any other relevant details or null"
}
Map position names: striker→ST, winger→RW or LW, defensive midfielder/6→CDM, central midfielder/8→CM, attacking midfielder/10→CAM, right back→RB, left back→LB, centre back→CB, goalkeeper→GK, second striker→SS.
For budgets, extract numbers only (e.g. "€3M"→3000000, "1.5M"→1500000, "600k"→600000).`
        }
      ]
    }]
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
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: e.message })
    };
  }
};
