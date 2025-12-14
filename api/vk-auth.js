// api/vk-auth.js
const https = require('https');

module.exports = async (req, res) => {
    // === ВАШИ ДАННЫЕ ИЗ VK ID CONSOLE ===
    const APP_ID = '54397933'; // Ваш ID приложения
    const APP_SECRET = 'XurdOXYo2QSx1482Rjm1'; // !!! ЕСЛИ МЕНЯЛИ КЛЮЧ В VK, ВСТАВЬТЕ НОВЫЙ СЮДА !!!
    const REDIRECT_URI = 'https://neko-casino.vercel.app'; // БЕЗ слэша в конце
    // =============================

    const { code, code_verifier, device_id } = req.query;

    if (!code) {
        return res.status(400).json({ error: 'No code provided' });
    }

    try {
        // Формируем параметры запроса
        const params = new URLSearchParams();
        params.append('client_id', APP_ID);
        params.append('client_secret', APP_SECRET);
        params.append('redirect_uri', REDIRECT_URI);
        params.append('code', code);
        
        // Добавляем PKCE параметры
        if (code_verifier) params.append('code_verifier', code_verifier);
        if (device_id) params.append('device_id', device_id);

        const tokenUrl = `https://oauth.vk.com/access_token?${params.toString()}`;
        console.log("VK Auth Request:", tokenUrl); // Лог для отладки

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
            console.error('VK API Error:', JSON.stringify(data));
            return res.status(400).json({ 
                error: data.error_description || data.error_msg || 'VK Auth Error',
                details: data
            });
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