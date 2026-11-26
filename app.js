const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const BACKEND_URL = "https://script.google.com/macros/s/AKfycbyFkEqdfhLkz44_ntWgH4Sd1aZznUM0avkwv2IcRg70YyIEwWN8qHD2AeV12gOw5ogV2g/exec";

const user = tg.initDataUnsafe?.user;
if (user) document.getElementById('user-name').innerText = user.first_name;

// --- БАЗА ДАННЫХ ---
const categories = [
    { id: 'clothing', name: '👕 Одежда' },
    { id: 'accessories', name: '☕ Аксессуары' },
    { id: 'digital', name: '💻 Цифровые товары' }
];

// Ссылки на картинки взяты с Unsplash (бесплатные фото)
const products = [
    { id: 1, category: 'clothing', name: 'Футболка "Hello World"', price: 1500, image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=150&h=150&fit=crop' },
    { id: 2, category: 'clothing', name: 'Худи Developer', price: 3500, image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=150&h=150&fit=crop' },
    { id: 3, category: 'clothing', name: 'Кепка Telegram', price: 1200, image: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=150&h=150&fit=crop' },
    { id: 4, category: 'clothing', name: 'Носки с кодом', price: 500, image: 'https://images.unsplash.com/photo-1582966772680-860e372bb558?w=150&h=150&fit=crop' },
    
    { id: 5, category: 'accessories', name: 'Кружка "Я из TG"', price: 800, image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=150&h=150&fit=crop' },
    { id: 6, category: 'accessories', name: 'Блокнот для идей', price: 900, image: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=150&h=150&fit=crop' },
    { id: 7, category: 'accessories', name: 'Шоппер', price: 1100, image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=150&h=150&fit=crop' },
    { id: 8, category: 'accessories', name: 'Стикерпак', price: 300, image: 'https://images.unsplash.com/photo-1572375992501-4b0892d50c69?w=150&h=150&fit=crop' },
    
    { id: 9, category: 'digital', name: 'Гайд по Mini Apps', price: 2500, image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=150&h=150&fit=crop' },
    { id: 10, category: 'digital', name: 'Пресеты для фото', price: 1000, image: 'https://images.unsplash.com/photo-1554048612-b6a482bc67e5?w=150&h=150&fit=crop' },
    { id: 11, category: 'digital', name: 'Шаблон Notion', price: 700, image: 'https://images.unsplash.com/photo-1507721999472-8ed4421c4af2?w=150&h=150&fit=crop' },
    { id: 12, category: 'digital', name: 'Иконки для сайта', price: 1500, image: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=150&h=150&fit=crop' }
];

let cart = {};
let isCheckoutActive = false;

// DOM Элементы
const categoryListView = document.getElementById('categories-view');
const productListView = document.getElementById('products-view');
const categoryListContainer = document.getElementById('category-list');
const productList = document.getElementById('product-list');
const pageTitle = document.getElementById('page-title');

const cartCount = document.getElementById('cart-count');
const cartModal = document.getElementById('cart-modal');
const cartItemsContainer = document.getElementById('cart-items');
const checkoutModal = document.getElementById('checkout-modal');
const orderForm = document.getElementById('order-form');

// --- ЛОГИКА ОТРИСОВКИ ---

function renderCategories() {
    categoryListContainer.innerHTML = '';
    categories.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'category-card';
        card.innerText = cat.name;
        card.onclick = () => {
            tg.HapticFeedback.impactOccurred('light');
            showProducts(cat.id, cat.name);
        };
        categoryListContainer.appendChild(card);
    });
}

function showProducts(categoryId, categoryName) {
    categoryListView.classList.add('hidden');
    productListView.classList.remove('hidden');
    pageTitle.innerText = categoryName; // Меняем заголовок вверху

    productList.innerHTML = '';
    const filteredProducts = products.filter(p => p.category === categoryId);

    filteredProducts.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${product.image}" alt="${product.name}" class="product-img">
            <div class="product-info">
                <h3>${product.name}</h3>
                <p>${product.price} ₽</p>
            </div>
            <button class="buy-btn" data-id="${product.id}">+</button>
        `;
        productList.appendChild(card);
    });
}

document.getElementById('back-to-categories').onclick = () => {
    tg.HapticFeedback.impactOccurred('light');
    productListView.classList.add('hidden');
    categoryListView.classList.remove('hidden');
    pageTitle.innerText = 'Категории'; // Возвращаем заголовок
};

// --- ЛОГИКА КОРЗИНЫ ---

function initApp() {
    if (tg.CloudStorage) {
        tg.CloudStorage.getItem('tg_shop_cart', (err, value) => {
            if (!err && value) {
                try { cart = JSON.parse(value); } catch(e) {}
            } else {
                cart = JSON.parse(localStorage.getItem('tg_shop_cart')) || {};
            }
            renderCategories();
            updateCartUI();
        });
    } else {
        cart = JSON.parse(localStorage.getItem('tg_shop_cart')) || {};
        renderCategories();
        updateCartUI();
    }
}

function updateCartUI() {
    if (tg.CloudStorage) tg.CloudStorage.setItem('tg_shop_cart', JSON.stringify(cart));
    localStorage.setItem('tg_shop_cart', JSON.stringify(cart));

    const totalItems = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
    cartCount.innerText = totalItems;

    if (totalItems > 0) {
        if (isCheckoutActive) {
            tg.MainButton.setText("Подтвердить заказ");
        } else {
            tg.MainButton.setText(`Оформить заказ на ${calculateTotal()} ₽`);
        }
        tg.MainButton.show();
    } else {
        tg.MainButton.hide();
        if (isCheckoutActive) closeCheckout();
    }

    cartItemsContainer.innerHTML = '';
    Object.keys(cart).forEach(id => {
        const product = products.find(p => p.id == id);
        if (!product) return;
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
        if (!product) return total;
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

// Делегирование событий для динамически создаваемых кнопок "+"
productList.addEventListener('click', (e) => {
    if (e.target.classList.contains('buy-btn')) {
        const id = e.target.dataset.id;
        cart[id] = (cart[id] || 0) + 1;
        tg.HapticFeedback.notificationOccurred('success');
        updateCartUI();
    }
});

// --- ИНТЕРФЕЙС КОРЗИНЫ И ОФОРМЛЕНИЯ ---

document.getElementById('cart-icon').addEventListener('click', () => {
    tg.HapticFeedback.impactOccurred('medium');
    cartModal.classList.remove('hidden');
});

document.getElementById('close-cart').addEventListener('click', () => {
    cartModal.classList.add('hidden');
});

function openCheckout() {
    isCheckoutActive = true;
    cartModal.classList.add('hidden');
    checkoutModal.classList.remove('hidden');
    updateCartUI();
}

function closeCheckout() {
    isCheckoutActive = false;
    checkoutModal.classList.add('hidden');
    updateCartUI();
}

document.getElementById('close-checkout').addEventListener('click', () => {
    closeCheckout();
});

tg.MainButton.onClick(() => {
    tg.HapticFeedback.impactOccurred('heavy');
    if (isCheckoutActive) {
        if (orderForm.reportValidity()) submitOrder();
    } else {
        openCheckout();
    }
});

// --- ОТПРАВКА ЗАКАЗА ---
function submitOrder() {
    const name = document.getElementById('client-name').value;
    const phone = document.getElementById('client-phone').value;
    
    const itemsToSend = Object.keys(cart).map(id => {
        const p = products.find(prod => prod.id == id);
        if (!p) return null;
        return { name: p.name, price: p.price, qty: cart[id] };
    }).filter(item => item !== null);

    const orderData = {
        name: name,
        phone: phone,
        total: calculateTotal(),
        items: itemsToSend,
        tg_user_id: user ? user.id : null
    };

    tg.MainButton.showProgress();
    
    fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(orderData)
    })
    .then(() => {
        tg.MainButton.hideProgress();
        tg.HapticFeedback.notificationOccurred('success');
        tg.showPopup({
            title: 'Успешно!',
            message: 'Ваш заказ принят. Мы свяжемся с вами.',
            buttons: [{ type: 'ok' }]
        }, () => {
            cart = {};
            orderForm.reset();
            closeCheckout();
            updateCartUI();
            // Возвращаем пользователя на главный экран после заказа
            productListView.classList.add('hidden');
            categoryListView.classList.remove('hidden');
            pageTitle.innerText = 'Категории';
        });
    })
    .catch(error => {
        tg.MainButton.hideProgress();
        tg.HapticFeedback.notificationOccurred('error');
        tg.showAlert('Ошибка сети. Проверьте интернет-соединение.');
    });
}

// Запуск
initApp();
