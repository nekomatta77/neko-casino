const https = require('https');

module.exports = async (req, res) => {
  try {
    const APP_ID = process.env.VK_CLIENT_ID;
    
    // 1. Проверка наличия ID приложения
    if (!APP_ID) {
      console.error("CRITICAL: VK_CLIENT_ID is missing in env vars!");
      return res.status(500).json({ error: 'Server misconfiguration: VK_CLIENT_ID missing' });
    }

    const { code, code_verifier, device_id, redirect_uri } = req.query;

    if (!code || !code_verifier || !device_id || !redirect_uri) {
      return res.status(400).json({ error: 'Missing params' });
    }

    const postData = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: APP_ID,
      redirect_uri,
      code,
      code_verifier,
      state: req.query.state || '' // На всякий случай передаем state, если он есть
    }).toString();

    const options = {
      hostname: 'id.vk.com',
      path: '/oauth2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'X-Device-Id': device_id,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log(`Sending to VK: client_id=${APP_ID}, redirect_uri=${redirect_uri}`);

    const raw = await new Promise((resolve, reject) => {
      const r = https.request(options, resp => {
        let d = '';
        resp.on('data', c => d += c);
        resp.on('end', () => resolve(d));
      });
      r.on('error', reject);
      r.write(postData);
      r.end();
    });

    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      // 2. Если VK вернул HTML, логируем его и возвращаем клиенту для отладки
      console.error('VK RAW ERROR RESPONSE:', raw);
      return res.status(502).json({ 
        error: 'VK returned invalid JSON (likely HTML error page)', 
        raw_response_preview: raw.substring(0, 500) // Первые 500 символов ответа
      });
    }

    if (data.error) {
      console.error('VK API Error:', data);
      return res.status(400).json(data);
    }

    return res.status(200).json({
      vk_id: data.user_id,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in
    });

  } catch (e) {
    console.error("Internal Error:", e);
    return res.status(500).json({ error: e.message });
  }
};