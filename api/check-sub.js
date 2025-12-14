// api/check-sub.js
const https = require('https');

module.exports = async (req, res) => {
    // 1. ВСТАВЬТЕ СЮДА ВАШИ ДАННЫЕ
    const BOT_TOKEN = '7682660424:AAG...'; // Токен бота от @BotFather
    const CHANNEL_ID = '@CashCat_Official'; // Юзернейм канала с @

    const { tg_id } = req.query;

    if (!tg_id) {
        return res.status(400).json({ error: 'No Telegram ID provided' });
    }

    try {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${tg_id}`;

        // Делаем запрос к Telegram
        const data = await new Promise((resolve, reject) => {
            https.get(url, (resp) => {
                let chunks = '';
                resp.on('data', (chunk) => chunks += chunk);
                resp.on('end', () => {
                    try {
                        resolve(JSON.parse(chunks));
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });

        if (!data.ok) {
            console.error('Telegram API Error:', data.description);
            // Если бот не админ или канал не найден
            return res.status(500).json({ error: data.description || 'Telegram API Error' });
        }

        const status = data.result.status;
        // Статусы, которые считаются "подпиской"
        const isMember = ['creator', 'administrator', 'member', 'restricted'].includes(status);

        return res.status(200).json({ is_member: isMember, status: status });

    } catch (error) {
        console.error('Server Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};