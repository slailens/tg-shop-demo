const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Вставьте сюда ваш URL из Google Apps Script (который заканчивается на /exec)
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbyFkEqdfhLkz44_ntWgH4Sd1aZznUM0avkwv2IcRg70YyIEwWN8qHD2AeV12gOw5ogV2g/exec";

const user = tg.initDataUnsafe?.user;
if (user) document.getElementById('user-name').innerText = user.first_name;

const products = [
    { id: 1, name: 'Футболка с логотипом', price: 1500 },
    { id: 2, name: 'Кружка "Я из Telegram"', price: 800 },
    { id: 3, name: 'Цифровой гайд', price: 500 },
];

let cart = {};

// DOM
const productList = document.getElementById('product-list');
const cartCount = document.getElementById('cart-count');
const cartModal = document.getElementById('cart-modal');
const cartItemsContainer = document.getElementById('cart-items');
const checkoutModal = document.getElementById('checkout-modal');

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

function updateCartUI() {
    const totalItems = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
    cartCount.innerText = totalItems;

    if (totalItems > 0) {
        tg.MainButton.setText(`Оформить заказ на ${calculateTotal()} ₽`);
        tg.MainButton.show();
    } else {
        tg.MainButton.hide();
    }

    cartItemsContainer.innerHTML = '';
    Object.keys(cart).forEach(id => {
        const product = products.find(p => p.id == id);
        const qty = cart[id];
        const item = document.createElement('div');
        item.className = 'cart-item';
        item.innerHTML = `
            <div class="cart-item-info"><h4>${product.name}</h4></div>
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

window.changeQty = (id, delta) => {
    if (!cart[id]) return;
    cart[id] += delta;
    if (cart[id] <= 0) delete cart[id];
    tg.HapticFeedback.impactOccurred('light');
    updateCartUI();
};

productList.addEventListener('click', (e) => {
    if (e.target.classList.contains('buy-btn')) {
        const id = e.target.dataset.id;
        cart[id] = (cart[id] || 0) + 1;
        tg.HapticFeedback.notificationOccurred('success');
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

// Главная кнопка теперь открывает форму оформления
tg.MainButton.onClick(() => {
    tg.HapticFeedback.impactOccurred('heavy');
    cartModal.classList.add('hidden'); // Закрываем корзину, если открыта
    checkoutModal.classList.remove('hidden'); // Открываем форму
});

// Закрытие формы
document.getElementById('close-checkout').addEventListener('click', () => {
    checkoutModal.classList.add('hidden');
});

// ОТПРАВКА ЗАКАЗА НА СЕРВЕР
document.getElementById('order-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const name = document.getElementById('client-name').value;
    const phone = document.getElementById('client-phone').value;
    
    // Собираем массив товаров для отправки
    const itemsToSend = Object.keys(cart).map(id => {
        const p = products.find(prod => prod.id == id);
        return { name: p.name, price: p.price, qty: cart[id] };
    });

    const orderData = {
        name: name,
        phone: phone,
        total: calculateTotal(),
        items: itemsToSend
    };

    // Показываем загрузку
    tg.MainButton.showProgress();
    
    // Отправляем данные в Google Apps Script
    fetch(BACKEND_URL, {
        method: 'POST',
        body: JSON.stringify(orderData)
    })
    .then(response => response.json())
    .then(data => {
        tg.MainButton.hideProgress();
        if (data.status === 'success') {
            tg.HapticFeedback.notificationOccurred('success');
            tg.showPopup({
                title: 'Успешно!',
                message: 'Ваш заказ принят. Мы свяжемся с вами.',
                buttons: [{ type: 'ok' }]
            }, () => {
                // Очищаем корзину после успешного заказа
                cart = {};
                updateCartUI();
                checkoutModal.classList.add('hidden');
                document.getElementById('order-form').reset();
            });
        } else {
            throw new Error('Ошибка сервера');
        }
    })
    .catch(error => {
        tg.MainButton.hideProgress();
        tg.HapticFeedback.notificationOccurred('error');
        tg.showAlert('Произошла ошибка при отправке. Попробуйте позже.');
    });
});

renderProducts();
updateCartUI();
