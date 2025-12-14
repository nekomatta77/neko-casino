// api/vk-auth.js
const https = require('https');

module.exports = async (req, res) => {
    // === ВАШИ ДАННЫЕ ИЗ VK DEV ===
    const APP_ID = '54397933'; // Ваш ID (строка или число)
    const APP_SECRET = 'XurdOXYo2QSx1482Rjm1'; // !!! ВЕРНИТЕ СЮДА ВАШ СЕКРЕТНЫЙ КЛЮЧ !!!
    const REDIRECT_URI = 'https://neko-casino.vercel.app/'; 
    // =============================

    const { code, code_verifier, device_id } = req.query;

    if (!code) {
        return res.status(400).json({ error: 'No code provided' });
    }

    try {
        // Формируем запрос к VK с поддержкой PKCE (VK ID)
        let tokenUrl = `https://oauth.vk.com/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&redirect_uri=${REDIRECT_URI}&code=${code}`;
        
        // Если пришли параметры PKCE (от нового профиля), добавляем их
        if (code_verifier) tokenUrl += `&code_verifier=${code_verifier}`;
        if (device_id) tokenUrl += `&device_id=${device_id}`;

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
            return res.status(400).json({ error: data.error_description || data.error || 'VK Auth Error' });
        }

        return res.status(200).json({ 
            vk_id: data.user_id,
            access_token: data.access_token 
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};