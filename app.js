const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Имя пользователя
const user = tg.initDataUnsafe?.user;
if (user) document.getElementById('user-name').innerText = user.first_name;

// Данные товаров
const products = [
    { id: 1, name: 'Футболка с логотипом', price: 1500 },
    { id: 2, name: 'Кружка "Я из Telegram"', price: 800 },
    { id: 3, name: 'Цифровой гайд', price: 500 },
];

// Состояние корзины (объект: { productId: quantity })
let cart = {};

// Элементы DOM
const productList = document.getElementById('product-list');
const cartCount = document.getElementById('cart-count');
const cartModal = document.getElementById('cart-modal');
const cartItemsContainer = document.getElementById('cart-items');

// 1. Отрисовка товаров
function renderProducts() {
    productList.innerHTML = '';
    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="product-info">
                <h3>${product.name}</h3>
                <p>${product.price} ₽</p>
            </div>
            <button class="buy-btn" data-id="${product.id}">В корзину</button>
        `;
        productList.appendChild(card);
    });
}

// 2. Логика корзины
function updateCartUI() {
    const totalItems = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
    cartCount.innerText = totalItems;

    // Управление главной кнопкой Telegram (MainButton)
    if (totalItems > 0) {
        tg.MainButton.setText(`Оформить заказ на ${calculateTotal()} ₽`);
        tg.MainButton.show();
    } else {
        tg.MainButton.hide();
    }

    // Отрисовка элементов внутри модального окна
    cartItemsContainer.innerHTML = '';
    Object.keys(cart).forEach(id => {
        const product = products.find(p => p.id == id);
        const qty = cart[id];
        const item = document.createElement('div');
        item.className = 'cart-item';
        item.innerHTML = `
            <div class="cart-item-info">
                <h4>${product.name}</h4>
            </div>
            <div class="cart-item-price">${product.price * qty} ₽</div>
            <div class="action-btns">
                <button class="minus" onclick="changeQty(${id}, -1)">-</button>
                <span style="padding: 10px;">${qty}</span>
                <button onclick="changeQty(${id}, 1)">+</button>
            </div>
        `;
        cartItemsContainer.appendChild(item);
    });
}

function calculateTotal() {
    return Object.keys(cart).reduce((total, id) => {
        const product = products.find(p => p.id == id);
        return total + (product.price * cart[id]);
    }, 0);
}

// Глобальные функции для кнопок в модальном окне
window.changeQty = (id, delta) => {
    if (!cart[id]) return;
    cart[id] += delta;
    if (cart[id] <= 0) delete cart[id];
    
    tg.HapticFeedback.impactOccurred('light'); // Вибрация
    updateCartUI();
};

// 3. Обработчики событий
productList.addEventListener('click', (e) => {
    if (e.target.classList.contains('buy-btn')) {
        const id = e.target.dataset.id;
        cart[id] = (cart[id] || 0) + 1;
        
        tg.HapticFeedback.notificationOccurred('success'); // Вибрация успеха
        updateCartUI();
    }
});

document.getElementById('cart-icon').addEventListener('click', () => {
    tg.HapticFeedback.impactOccurred('medium');
    cartModal.classList.remove('hidden');
});

document.getElementById('close-cart').addEventListener('click', () => {
    cartModal.classList.add('hidden');
});

// 4. Обработка нажатия на главную кнопку (MainButton)
tg.MainButton.onClick(() => {
    tg.HapticFeedback.impactOccurred('heavy');
    // Пока просто показываем попап. На следующем этапе мы отправим это на сервер.
    tg.showPopup({
        title: 'Заказ оформлен!',
        message: `Сумма заказа: ${calculateTotal()} ₽.\n(Здесь мы позже добавим форму с именем и телефоном)`,
        buttons: [{ type: 'ok' }]
    });
});

// Инициализация
renderProducts();
updateCartUI();
