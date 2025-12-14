// api/vk-auth.js
const https = require('https');

module.exports = async (req, res) => {
    // === ВАШИ ДАННЫЕ ИЗ VK DEV ===
    const APP_ID = '54397933';       // Вставьте ID приложения
    const APP_SECRET = 'XurdOXYo2QSx1482Rjm1'; // Вставьте Защищенный ключ
    const REDIRECT_URI = 'https://neko-casino.vercel.app/'; // ВАШ ДОМЕН СО СЛЕШЕМ В КОНЦЕ
    // =============================

    const { code } = req.query;

    if (!code) {
        return res.status(400).json({ error: 'No code provided' });
    }

    try {
        // 1. Обмениваем код на токен доступа
        const tokenUrl = `https://oauth.vk.com/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&redirect_uri=${REDIRECT_URI}&code=${code}`;

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
            return res.status(400).json({ error: data.error_description || 'VK Auth Error' });
        }

        // 2. Возвращаем VK ID пользователя на фронтенд
        return res.status(200).json({ 
            vk_id: data.user_id,
            access_token: data.access_token // (Опционально, если нужно для API)
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};