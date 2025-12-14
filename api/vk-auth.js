const https = require('https');

module.exports = async (req, res) => {
  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const APP_ID = process.env.VK_CLIENT_ID;
    
    // Проверка конфигурации
    if (!APP_ID) {
      console.error("Server Error: VK_CLIENT_ID is missing");
      return res.status(500).json({ error: 'Server Config Error: VK_CLIENT_ID missing' });
    }

    const { code, code_verifier, device_id, redirect_uri } = req.query;

    if (!code || !code_verifier || !device_id || !redirect_uri) {
      return res.status(400).json({ error: 'Missing params', received: req.query });
    }

    const postDataParams = new URLSearchParams();
    postDataParams.append('grant_type', 'authorization_code');
    postDataParams.append('client_id', APP_ID);
    postDataParams.append('code', code);
    postDataParams.append('code_verifier', code_verifier);
    postDataParams.append('redirect_uri', redirect_uri);
    postDataParams.append('device_id', device_id);

    // Добавляем state, если он пришел
    if (req.query.state) {
        postDataParams.append('state', req.query.state);
    }

    const postData = postDataParams.toString();

    const options = {
      hostname: 'id.vk.com',
      path: '/oauth2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'NekoCasino/1.0', // Обязательно для VK
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log(`[VK Auth] Sending to VK... AppID: ${APP_ID}, URI: ${redirect_uri}`);

    const { statusCode, raw } = await new Promise((resolve, reject) => {
      const r = https.request(options, resp => {
        let d = '';
        resp.on('data', c => d += c);
        resp.on('end', () => resolve({ statusCode: resp.statusCode, raw: d }));
      });
      r.on('error', reject);
      r.write(postData);
      r.end();
    });

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error(`[VK Auth] Non-JSON response (${statusCode}):`, raw);
      // Возвращаем текст ошибки клиенту, чтобы увидеть его в Network
      return res.status(502).json({ 
        error: 'VK returned invalid JSON',
        raw_response_preview: raw.substring(0, 500) // Покажем начало HTML
      });
    }

    if (data.error) {
      console.error('[VK Auth] API Error:', data);
      return res.status(400).json(data);
    }

    return res.status(200).json({
      vk_id: data.user_id,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in
    });

  } catch (e) {
    console.error("[VK Auth] Internal Error:", e);
    return res.status(500).json({ error: e.message });
  }
};