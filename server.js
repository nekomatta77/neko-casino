require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();

// Разрешаем запросы (пока отовсюду, потом настроим только твой сайт)
app.use(cors({ origin: '*' }));
app.use(express.json());

// --- ПОДКЛЮЧЕНИЕ К FIREBASE ---
// Мы берем ключи не из файла, а из "секретной переменной" на сервере Render
// Это защищает тебя от взлома
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// --- ПРОВЕРКА РАБОТЫ ---
app.get('/', (req, res) => {
  res.send('Backend казино работает! 🚀');
});

// --- ЭНДПОИНТ СТАВКИ (Заготовка) ---
app.post('/api/spin', async (req, res) => {
    const { userId, betAmount } = req.body;
    
    // Тут позже напишем логику списания денег и рандома
    // Пока просто вернем ответ
    res.json({
        result: Math.random() > 0.5 ? 'WIN' : 'LOSE',
        message: 'Ставка обработана на сервере'
    });
});

// --- ЗАПУСК ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
