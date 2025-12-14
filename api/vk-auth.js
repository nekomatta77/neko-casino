const https = require('https');

module.exports = async (req, res) => {
  try {
    const APP_ID = process.env.VK_CLIENT_ID;
    
    // 1. Проверяем настройки сервера
    if (!APP_ID) {
      return res.status(500).json({ error: 'Server Error: VK_CLIENT_ID not set in Vercel Env Vars' });
    }

    let { code, code_verifier, device_id, redirect_uri } = req.query;

    if (!code || !code_verifier || !device_id || !redirect_uri) {
      return res.status(400).json({ error: 'Missing required params (code, verifier, device_id, redirect_uri)' });
    }

    // ВАЖНО: Redirect URI должен точь-в-точь совпадать с тем, что указан в настройках приложения VK.
    // Часто браузер шлет без слеша, а в VK настроен со слешем.
    // Если в VK настроено "https://neko-casino.vercel.app/", а приходит без него - будет ошибка.
    // Попробуйте раскомментировать строку ниже, если ошибка сохранится:
    // if (!redirect_uri.endsWith('/')) redirect_uri += '/';

    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', APP_ID);
    params.append('code', code);
    params.append('code_verifier', code_verifier);
    params.append('redirect_uri', redirect_uri);
    params.append('device_id', device_id); // VK ID требует это в теле или заголовке, лучше и там и там
    if (req.query.state) params.append('state', req.query.state);

    const postData = params.toString();

    const options = {
      hostname: 'id.vk.com', // Используем новый домен VK ID
      path: '/oauth2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'NekoCasino/1.0 (NodeJS)', // ВАЖНО: VK может блокировать запросы без User-Agent
        'X-Device-Id': device_id,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log(`[VK Auth] Sending request to VK... ClientID: ${APP_ID}, RedirectURI: ${redirect_uri}`);

    const raw = await new Promise((resolve, reject) => {
      const reqVk = https.request(options, resp => {
        let d = '';
        resp.on('data', c => d += c);
        resp.on('end', () => resolve(d));
      });
      
      reqVk.on('error', (err) => {
        console.error("[VK Auth] Network Error:", err);
        reject(err);
      });
      
      reqVk.write(postData);
      reqVk.end();
    });

    // Пытаемся распарсить ответ
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error('[VK Auth] Non-JSON response:', raw);
      // Возвращаем клиенту "сырой" ответ, чтобы понять, что за HTML пришел
      return res.status(502).json({ 
        error: 'VK returned invalid JSON', 
        details: 'Likely HTML error page. See raw_response.',
        raw_response_preview: raw.substring(0, 1000) // Берем первые 1000 символов
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
    console.error('[VK Auth] Internal Error:', e);
    return res.status(500).json({ error: e.message });
  }
};