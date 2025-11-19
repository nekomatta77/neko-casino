/*
 * Краткое описание апгрейда:
 * 1. Исправлена ошибка, из-за которой контент не загружался.
 * 2. Вместо проверки `!answerContentDiv.innerHTML` (которая не срабатывала из-за
 * HTML-комментария), теперь используется класс `content-loaded`.
 * 3. Контент загружается только один раз при первом клике на вопрос,
 * а класс `content-loaded` предотвращает повторную загрузку.
 */

let faqContent = null; // Кеш для данных FAQ

/**
 * Загружает (если еще не загружен) и возвращает контент FAQ.
 */
async function getFaqContent() {
    if (faqContent) {
        return faqContent; // Возвращаем из кеша
    }
    
    try {
        const response = await fetch('./faq-content.json'); // Путь к новому файлу
        if (!response.ok) {
            throw new Error('Could not fetch faq-content.json');
        }
        faqContent = await response.json();
        return faqContent;
    } catch (error) {
        console.error("Ошибка при загрузке FAQ контента:", error);
        return null; // Возвращаем null в случае ошибки
    }
}


/**
 * Инициализирует логику аккордеона (вкладок) для страницы FAQ.
 */
export async function initFAQ() {
    // Находим контейнер, чтобы убедиться, что мы на нужной странице
    const faqContainer = document.getElementById('faq-page');
    if (!faqContainer) return; 

    // 1. Загружаем контент при инициализации
    await getFaqContent();

    // 2. Получаем все элементы (вопрос + ответ)
    const faqItems = faqContainer.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        // Находим кнопку-вопрос внутри элемента
        const question = item.querySelector('.faq-question');
        
        if (question) {
            question.addEventListener('click', async () => {
                
                // --- ИСПРАВЛЕННАЯ ЛОГИКА ЗАГРУЗКИ КОНТЕНТА ---
                const answerContentDiv = item.querySelector('.faq-answer-content');
                const key = item.getAttribute('data-key');

                // ИСПРАВЛЕНИЕ: Проверяем, не был ли контент уже загружен
                if (!item.classList.contains('content-loaded') && key && faqContent) {
                    const contentData = faqContent[key];
                    if (contentData && contentData.content) {
                        answerContentDiv.innerHTML = contentData.content;
                    } else {
                        answerContentDiv.innerHTML = "<p>Ошибка: Контент не найден.</p>";
                    }
                    // Помечаем, что контент загружен
                    item.classList.add('content-loaded');
                }
                // --- КОНЕЦ ИСПРАВЛЕНИЯ ---

                // При клике просто переключаем класс 'active'
                // CSS обработает анимацию max-height и поворот иконки
                item.classList.toggle('active');
            });
        }
    });
}
