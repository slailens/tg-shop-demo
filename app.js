const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();
tg.setHeaderColor('#E9ECEF');
tg.setBackgroundColor('#E9ECEF');
tg.MainButton.setParams({ color: '#4A72FF', text_color: '#ffffff' });

const BACKEND_URL = "https://script.google.com/macros/s/AKfycbxZ-cpm1TbzoGfbXSWOgXuYfyloZJRJsLH_SfGLVqQZIRI5pavr9iMkP6vh3HAMX7ioeQ/exec";

// --- НАСТРОЙКИ АДМИНА ---
const ADMIN_ID = 767941221; // <--- ВСТАВЬТЕ СЮДА ВАШ ID ИЗ @userinfobot
let isAdmin = false;

const user = tg.initDataUnsafe?.user;
if (user) {
    document.getElementById('user-name').innerText = user.first_name;
    if (user.id === ADMIN_ID) {
        isAdmin = true;
        document.getElementById('admin-btn').classList.remove('hidden');
    }
}

const categories = [
    { id: 'clothing', name: '👕 Одежда' },
    { id: 'accessories', name: '☕ Аксессуары' },
    { id: 'digital', name: '💻 Цифровые' }
];

let products = []; // Теперь пустой массив, заполнится из базы
let cart = {};
let isCheckoutActive = false;

// ... (Ссылки на DOM элементы, как в прошлом коде)
const categoryListContainer = document.getElementById('category-list');
const productList = document.getElementById('product-list');
const pageTitle = document.getElementById('page-title');
const categoryListView = document.getElementById('categories-view');
const productListView = document.getElementById('products-view');

// --- ЗАГРУЗКА ДАННЫХ ИЗ GOOGLE SHEETS ---
async function fetchProducts() {
    categoryListContainer.innerHTML = '<p style="text-align:center; width:100%;">Загрузка...</p>';
    try {
        const res = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "get_products" })
        });
        const data = await res.json();
        if (data.status === 'success') {
            products = data.products;
            renderCategories(); // Отрисовываем категории только после загрузки товаров
        }
    } catch (e) {
        alert("Ошибка загрузки товаров");
    }
}

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
    pageTitle.innerText = categoryName;

    productList.innerHTML = '';
    const filteredProducts = products.filter(p => p.category === categoryId);

    if (filteredProducts.length === 0) {
        productList.innerHTML = '<p style="text-align:center; color: #7F8C8D;">В этой категории пока нет товаров.</p>';
        return;
    }

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
    pageTitle.innerText = 'Категории';
};

// --- КОРЗИНА (без изменений) ---
function updateCartUI() {
    if (tg.CloudStorage) tg.CloudStorage.setItem('tg_shop_cart', JSON.stringify(cart));
    localStorage.setItem('tg_shop_cart', JSON.stringify(cart));

    const totalItems = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
    document.getElementById('cart-count').innerText = totalItems;
    const totalPrice = calculateTotal();

    if (totalItems > 0) {
        document.getElementById('cart-total-block').classList.remove('hidden');
        document.getElementById('cart-total-price').innerText = totalPrice + ' ₽';
        if (isCheckoutActive) {
            tg.MainButton.setText("Подтвердить заказ");
        } else {
            tg.MainButton.setText(`Оформить заказ на ${totalPrice} ₽`);
        }
        tg.MainButton.show();
    } else {
        document.getElementById('cart-total-block').classList.add('hidden');
        tg.MainButton.hide();
        if (isCheckoutActive) closeCheckout();
    }

    const cartItemsContainer = document.getElementById('cart-items');
    cartItemsContainer.innerHTML = '';
    Object.keys(cart).forEach(id => {
        const product = products.find(p => p.id == id);
        if (!product) return;
        const qty = cart[id];
        const item = document.createElement('div');
        item.className = 'cart-item';
        item.innerHTML = `
            <div class="cart-item-info">
                <h4>${product.name}</h4>
                <div class="cart-item-price">${product.price * qty} ₽</div>
            </div>
            <div class="action-btns">
                <button class="minus" onclick="changeQty('${id}', -1)">−</button>
                <span>${qty}</span>
                <button onclick="changeQty('${id}', 1)">+</button>
            </div>
        `;
        cartItemsContainer.appendChild(item);
    });
}

function calculateTotal() {
    return Object.keys(cart).reduce((total, id) => {
        const product = products.find(p => p.id == id);
        return product ? total + (product.price * cart[id]) : total;
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
    document.getElementById('cart-modal').classList.remove('hidden');
});

document.getElementById('close-cart').addEventListener('click', () => {
    document.getElementById('cart-modal').classList.add('hidden');
});

function openCheckout() {
    isCheckoutActive = true;
    document.getElementById('cart-modal').classList.add('hidden');
    document.getElementById('checkout-modal').classList.remove('hidden');
    updateCartUI();
}

function closeCheckout() {
    isCheckoutActive = false;
    document.getElementById('checkout-modal').classList.add('hidden');
    updateCartUI();
}

document.getElementById('close-checkout').addEventListener('click', () => closeCheckout());

tg.MainButton.onClick(() => {
    tg.HapticFeedback.impactOccurred('heavy');
    if (isCheckoutActive) {
        if (document.getElementById('order-form').reportValidity()) submitOrder();
    } else {
        openCheckout();
    }
});

async function submitOrder() {
    const name = document.getElementById('client-name').value;
    const phone = document.getElementById('client-phone').value;
    const itemsToSend = Object.keys(cart).map(id => {
        const p = products.find(prod => prod.id == id);
        return { name: p.name, price: p.price, qty: cart[id] };
    });

    tg.MainButton.showProgress();
    
    try {
        await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "create_order", name, phone, total: calculateTotal(), items: itemsToSend, tg_user_id: user.id })
        });
        
        tg.MainButton.hideProgress();
        tg.HapticFeedback.notificationOccurred('success');
        tg.showPopup({ title: 'Успешно!', message: 'Ваш заказ принят.', buttons: [{ type: 'ok' }] }, () => {
            cart = {};
            document.getElementById('order-form').reset();
            closeCheckout();
            updateCartUI();
            productListView.classList.add('hidden');
            categoryListView.classList.remove('hidden');
            pageTitle.innerText = 'Категории';
        });
    } catch (e) {
        tg.MainButton.hideProgress();
        tg.showAlert('Ошибка при отправке заказа.');
    }
}

// ==========================================
// --- ЛОГИКА АДМИН-ПАНЕЛИ ---
// ==========================================
if (isAdmin) {
    const adminBtn = document.getElementById('admin-btn');
    const adminModal = document.getElementById('admin-modal');
    
    adminBtn.onclick = () => {
        tg.HapticFeedback.impactOccurred('medium');
        adminModal.classList.remove('hidden');
        loadAdminData();
    };

    document.getElementById('close-admin').onclick = () => {
        adminModal.classList.add('hidden');
    };

    // Переключение табов
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.remove('hidden');
        };
    });

    // Загрузка данных для админки
    async function loadAdminData() {
        // Заказы
        try {
            const res = await fetch(BACKEND_URL, {
                method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: "get_orders" })
            });
            const data = await res.json();
            if (data.status === 'success') {
                renderAdminOrders(data.orders);
            }
        } catch(e) {}

        // Товары
        renderAdminProducts();
    }

    function renderAdminOrders(orders) {
        const list = document.getElementById('admin-orders-list');
        list.innerHTML = '';
        let totalRevenue = 0;

        if (orders.length === 0) {
            list.innerHTML = '<p style="text-align:center; color: #7F8C8D;">Заказов пока нет</p>';
        }

        orders.forEach(order => {
            if (order.status !== 'Отменен') totalRevenue += Number(order.total);
            
            const card = document.createElement('div');
            card.className = 'order-admin-card';
            
            let itemsArr = [];
            try { itemsArr = JSON.parse(order.items); } catch(e){}
            let itemsHtml = itemsArr.map(i => `${i.name} (${i.qty}шт)`).join(', ');

            card.innerHTML = `
                <h4>${order.name} <span style="font-weight:normal; font-size:12px; color:#999;">${order.date}</span></h4>
                <p>📞 ${order.phone} | 💰 <b>${order.total} ₽</b></p>
                <p style="font-size: 12px;">📦 ${itemsHtml}</p>
                <select onchange="updateOrderStatus(${order.rowIndex}, this.value)">
                    <option value="Новый" ${order.status === 'Новый' ? 'selected' : ''}>Новый</option>
                    <option value="В работе" ${order.status === 'В работе' ? 'selected' : ''}>В работе</option>
                    <option value="Выполнен" ${order.status === 'Выполнен' ? 'selected' : ''}>Выполнен</option>
                    <option value="Отменен" ${order.status === 'Отменен' ? 'selected' : ''}>Отменен</option>
                </select>
            `;
            list.appendChild(card);
        });

        document.getElementById('admin-total-revenue').innerText = totalRevenue + ' ₽';
        document.getElementById('admin-total-orders').innerText = orders.length;
    }

    function renderAdminProducts() {
        const list = document.getElementById('admin-products-list');
        list.innerHTML = '';
        products.forEach(prod => {
            const card = document.createElement('div');
            card.className = 'admin-prod-card';
            card.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${prod.image}">
                    <div class="admin-prod-info">
                        <h5>${prod.name}</h5>
                        <p>${prod.price} ₽</p>
                    </div>
                </div>
                <button class="del-btn" onclick="deleteProduct('${prod.id}')">Удалить</button>
            `;
            list.appendChild(card);
        });
    }

    // Глобальные функции для админки
    window.updateOrderStatus = async (rowIndex, status) => {
        tg.HapticFeedback.impactOccurred('light');
        await fetch(BACKEND_URL, {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "update_order_status", rowIndex, status })
        });
        loadAdminData(); // Обновляем данные
    };

    window.deleteProduct = async (id) => {
        if (!confirm("Удалить этот товар?")) return;
        tg.HapticFeedback.impactOccurred('medium');
        await fetch(BACKEND_URL, {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "delete_product", id })
        });
        await fetchProducts(); // Обновляем список товаров
        renderAdminProducts();
    };

    // Форма добавления товара
    document.getElementById('btn-show-add-product').onclick = () => {
        document.getElementById('admin-add-product-form').classList.toggle('hidden');
    };

    document.getElementById('admin-add-product-form').onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-prod-name').value;
        const price = document.getElementById('new-prod-price').value;
        const image = document.getElementById('new-prod-img').value;
        const category = document.getElementById('new-prod-cat').value;

        tg.HapticFeedback.notificationOccurred('success');
        await fetch(BACKEND_URL, {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "add_product", name, price, image, category })
        });

        e.target.reset();
        e.target.classList.add('hidden');
        await fetchProducts(); // Обновляем список
        renderAdminProducts();
    };
}

// --- ЗАПУСК ---
fetchProducts();
updateCartUI();

try {
    if (tg.CloudStorage) {
        tg.CloudStorage.getItem('tg_shop_cart', (err, value) => {
            if (!err && value) {
                try { cart = JSON.parse(value); updateCartUI(); } catch(e) {}
            }
        });
    } else {
        const localCart = localStorage.getItem('tg_shop_cart');
        if (localCart) { cart = JSON.parse(localCart); updateCartUI(); }
    }
} catch (e) {}
