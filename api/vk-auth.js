const https = require('https');

module.exports = async (req, res) => {
  // CORS настройки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const APP_ID = process.env.VK_CLIENT_ID;
    
    if (!APP_ID) {
      console.error("Server Error: VK_CLIENT_ID missing");
      return res.status(500).json({ error: 'Server Config Error: VK_CLIENT_ID not set' });
    }

    const { code, code_verifier, device_id, redirect_uri, state } = req.query;

    // Проверка обязательных параметров
    if (!code || !code_verifier || !device_id || !redirect_uri) {
      return res.status(400).json({ 
        error: 'Missing required params', 
        details: 'Check code, code_verifier, device_id, redirect_uri' 
      });
    }

    // Параметры для VK
    const postDataParams = new URLSearchParams();
    postDataParams.append('grant_type', 'authorization_code');
    postDataParams.append('client_id', APP_ID);
    postDataParams.append('code', code);
    postDataParams.append('code_verifier', code_verifier);
    postDataParams.append('redirect_uri', redirect_uri);
    postDataParams.append('device_id', device_id);
    if (state) postDataParams.append('state', state);

    // === ВАЖНО: Если у вас есть CLIENT_SECRET, его нужно добавить сюда.
    // Но для PKCE (публичный клиент) он обычно не нужен.
    // Если VK вернет ошибку "invalid_client", возможно, придется добавить secret.
    // if (process.env.VK_CLIENT_SECRET) {
    //    postDataParams.append('client_secret', process.env.VK_CLIENT_SECRET);
    // }

    const postData = postDataParams.toString();

    // === ИСПРАВЛЕНИЕ: Используем правильный хост и путь ===
    const options = {
      hostname: 'oauth.vk.com', // БЫЛО: id.vk.com (ошибка 404)
      path: '/access_token',    // БЫЛО: /oauth2/token
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'NekoCasino/1.0',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log(`[VK Auth] Sending to oauth.vk.com... AppID: ${APP_ID}, RedirectURI: ${redirect_uri}`);

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
      return res.status(400).json(data);
    }

    // Успешный ответ от oauth.vk.com содержит user_id и access_token
    return res.status(200).json({
      vk_id: data.user_id,
      access_token: data.access_token,
      email: data.email, // VK иногда возвращает email, если запрошен scope
      expires_in: data.expires_in
    });

  } catch (e) {
    console.error("[VK Auth] Internal Error:", e);
    return res.status(500).json({ error: e.message });
  }
};