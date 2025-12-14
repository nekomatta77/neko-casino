const https = require('https');

module.exports = async (req, res) => {
  // Настройки CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const APP_ID = process.env.VK_CLIENT_ID;
    const APP_SECRET = process.env.VK_CLIENT_SECRET; // <-- Читаем секретный ключ
    
    // 1. Проверяем наличие ключей
    if (!APP_ID || !APP_SECRET) {
      console.error("Server Error: VK_CLIENT_ID or VK_CLIENT_SECRET missing");
      return res.status(500).json({ 
        error: 'Server Config Error', 
        details: 'VK_CLIENT_ID or VK_CLIENT_SECRET is not set in Vercel Env Vars' 
      });
    }

    const { code, code_verifier, device_id, redirect_uri, state } = req.query;

    if (!code || !code_verifier || !device_id || !redirect_uri) {
      return res.status(400).json({ 
        error: 'Missing required params', 
        details: 'Check code, code_verifier, device_id, redirect_uri' 
      });
    }

    // 2. Формируем данные для запроса
    const postDataParams = new URLSearchParams();
    postDataParams.append('grant_type', 'authorization_code');
    postDataParams.append('client_id', APP_ID);
    postDataParams.append('client_secret', APP_SECRET); // <-- ОБЯЗАТЕЛЬНО добавляем секрет
    postDataParams.append('code', code);
    postDataParams.append('code_verifier', code_verifier);
    postDataParams.append('redirect_uri', redirect_uri);
    postDataParams.append('device_id', device_id);
    if (state) postDataParams.append('state', state);

    const postData = postDataParams.toString();

    const options = {
      hostname: 'oauth.vk.com',
      path: '/access_token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'NekoCasino/1.0',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log(`[VK Auth] Sending to oauth.vk.com... AppID: ${APP_ID}`);

    const { statusCode, raw } = await new Promise((resolve, reject) => {
      const r = https.request(options, resp => {
        let d = '';
        resp.on('data', c => d += c);
        resp.on('end', () => resolve({ statusCode: resp.statusCode, raw: d }));
      });
      r.on('error', err => reject(err));
      r.write(postData);
      r.end();
    });

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error(`[VK Auth] Non-JSON response (${statusCode}):`, raw);
      return res.status(502).json({ 
        error: 'VK returned invalid JSON', 
        raw_response_preview: raw.substring(0, 500) 
      });
    }

    if (data.error) {
      console.error('[VK Auth] API Error:', data);
      // Возвращаем ошибку клиенту
      return res.status(400).json(data);
    }

    // Успех
    return res.status(200).json({
      vk_id: data.user_id,
      access_token: data.access_token,
      email: data.email,
      expires_in: data.expires_in
    });

  } catch (e) {
    console.error("[VK Auth] Internal Error:", e);
    return res.status(500).json({ error: e.message });
  }
};