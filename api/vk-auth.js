const https = require('https');

module.exports = async (req, res) => {
    // === ВАШИ ДАННЫЕ ===
    const APP_ID = '54397933'; 
    // Лучше хранить это в process.env.VK_CLIENT_SECRET
    const APP_SECRET = '4Vp29hWzqpcBcBgOUYD3'; 
    
    // Старый хардкод оставляем только как запасной вариант
    const FALLBACK_REDIRECT_URI = 'https://neko-casino.vercel.app/'; 
    // =============================

    // Получаем redirect_uri от клиента
    const { code, code_verifier, device_id, redirect_uri } = req.query;

    if (!code) {
        return res.status(400).json({ error: 'No code provided' });
    }

    try {
        // Используем присланный URI или запасной
        const finalRedirectUri = redirect_uri || FALLBACK_REDIRECT_URI;

        const params = new URLSearchParams();
        params.append('client_id', APP_ID);
        params.append('client_secret', APP_SECRET);
        params.append('redirect_uri', finalRedirectUri); // Важно! Должен совпадать байт-в-байт
        params.append('code', code);
        
        if (code_verifier) params.append('code_verifier', code_verifier);
        if (device_id) params.append('device_id', device_id);

        const tokenUrl = `https://oauth.vk.com/access_token?${params.toString()}`;

        const data = await new Promise((resolve, reject) => {
            https.get(tokenUrl, (resp) => {
                let chunks = '';
                resp.on('data', (chunk) => chunks += chunk);
                resp.on('end', () => {
                    try { resolve(JSON.parse(chunks)); } catch (e) { reject(e); }
                });
            }).on('error', reject);
        });

        if (data.error) {
            console.error('VK API Error:', data);
            // Логируем для отладки, какой URI мы отправляли
            console.log('Used Redirect URI:', finalRedirectUri);
            return res.status(400).json({ error: data.error_description || data.error_msg || 'VK Auth Error' });
        }

        return res.status(200).json({ 
            vk_id: data.user_id,
            access_token: data.access_token 
        });

    } catch (error) {
        console.error("Server Error:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};