// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Получаем имя пользователя
const user = tg.initDataUnsafe?.user;
if (user) {
    document.getElementById('user-name').innerText = user.first_name;
}

// Тестовые данные товаров (в реальном проекте — загрузка с сервера)
const products = [
    { id: 1, name: 'Футболка с логотипом', price: 1500 },
    { id: 2, name: 'Кружка "Я из Telegram"', price: 800 },
    { id: 3, name: 'Цифровой гайд', price: 500 },
];

// Отрисовка карточек товаров
const productList = document.getElementById('product-list');

products.forEach(product => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
        <div class="product-info">
            <h3>${product.name}</h3>
            <p>${product.price} ₽</p>
        </div>
        <button class="buy-btn" data-id="${product.id}">Купить</button>
    `;
    productList.appendChild(card);
});

// Обработка нажатия на кнопку "Купить"
productList.addEventListener('click', (event) => {
    if (event.target.classList.contains('buy-btn')) {
        const productId = event.target.dataset.id;
        const product = products.find(p => p.id == productId);
        // Показываем всплывающее уведомление внутри Telegram
        tg.showPopup({
            title: 'Покупка',
            message: `Вы выбрали: ${product.name} за ${product.price} ₽. Здесь будет оплата.`,
            buttons: [{ type: 'ok' }]
        });
    }
});