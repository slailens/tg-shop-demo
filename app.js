const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Настройки внешнего вида
tg.setHeaderColor('#4A72FF'); // Синяя шапка для контраста с иконками
tg.setBackgroundColor('#E9ECEF');
tg.MainButton.setParams({ color: '#4A72FF', text_color: '#ffffff' });

// Ваша новая ссылка на Google Script
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbxZ-cpm1TbzoGfbXSWOgXuYfyloZJRJsLH_SfGLVqQZIRI5pavr9iMkP6vh3HAMX7ioeQ/exec";

// Ваш Telegram ID (для доступа к админке)
const ADMIN_ID = 767941221; 

let isAdmin = false;
const user = tg.initDataUnsafe?.user;
if (user) {
    document.getElementById('user-name').innerText = user.first_name;
    if (user.id === ADMIN_ID) {
        isAdmin = true;
        document.getElementById('admin-btn').classList.remove('hidden');
    }
}

// Глобальные переменные состояния
let categories = []; 
let products = []; 
let cart = {};
let isCheckoutActive = false;

// DOM Элементы
const categoryListContainer = document.getElementById('category-list');
const productList = document.getElementById('product-list');
const pageTitle = document.getElementById('page-title');
const categoryListView = document.getElementById('categories-view');
const productListView = document.getElementById('products-view');

// --- ЗАГРУЗКА ДАННЫХ ---
async function fetchData() {
    categoryListContainer.innerHTML = '<p style="text-align:center; width:100%;">Загрузка...</p>';
    try {
        // Загружаем категории
        const resCat = await fetch(BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: "get_categories" }) });
        const dataCat = await resCat.json();
        if(dataCat.status === 'success') categories = dataCat.categories;

        // Загружаем товары
        const resProd = await fetch(BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: "get_products" }) });
        const dataProd = await resProd.json();
        if(dataProd.status === 'success') products = dataProd.products;

        renderCategories(); 
    } catch (e) {
        tg.showAlert('Ошибка загрузки данных: ' + e.message);
    }
}

function renderCategories() {
    categoryListContainer.innerHTML = '';
    if(categories.length === 0) {
        categoryListContainer.innerHTML = '<p style="text-align:center; width:100%;">Категорий пока нет</p>';
        return;
    }
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
        let priceHtml = '';
        // Если есть скидка, показываем старую цену зачеркнутой, новую зеленым и бейджик
        if (product.discount > 0) {
            let oldPrice = product.price;
            let newPrice = Math.round(oldPrice * (1 - product.discount / 100));
            priceHtml = `
                <div class="price-block">
                    <span class="new-price">${newPrice} ₽</span>
                    <span class="old-price">${oldPrice} ₽</span>
                    <span class="discount-badge">-${product.discount}%</span>
                </div>`;
        } else {
            priceHtml = `<div class="price-block"><span class="new-price">${product.price} ₽</span></div>`;
        }

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${product.image}" alt="${product.name}" class="product-img">
            <div class="product-info">
                <h3>${product.name}</h3>
                ${priceHtml}
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

// --- ЛОГИКА КОРЗИНЫ ---
function updateCartUI() {
    // Сохраняем в облако Telegram и локально
    if (tg.CloudStorage) tg.CloudStorage.setItem('tg_shop_cart', JSON.stringify(cart));
    localStorage.setItem('tg_shop_cart', JSON.stringify(cart));

    const totalItems = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
    document.getElementById('cart-count').innerText = totalItems;
    const totalPrice = calculateTotal();

    if (totalItems > 0) {
        document.getElementById('cart-total-block').classList.remove('hidden');
        document.getElementById('cart-total-price').innerText = totalPrice + ' ₽';
        tg.MainButton.setText(isCheckoutActive ? "Подтвердить заказ" : `Оформить заказ на ${totalPrice} ₽`);
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
        // Считаем цену с учетом скидки для отображения в корзине
        const finalPrice = product.discount > 0 ? Math.round(product.price * (1 - product.discount / 100)) : product.price;
        
        const item = document.createElement('div');
        item.className = 'cart-item';
        item.innerHTML = `
            <div class="cart-item-info">
                <h4>${product.name}</h4>
                <div class="cart-item-price">${finalPrice * qty} ₽</div>
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
        if(!product) return total;
        // Считаем итоговую сумму с учетом скидки
        const finalPrice = product.discount > 0 ? Math.round(product.price * (1 - product.discount / 100)) : product.price;
        return total + (finalPrice * cart[id]);
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
document.getElementById('close-cart').onclick = () => document.getElementById('cart-modal').classList.add('hidden');

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
document.getElementById('close-checkout').onclick = closeCheckout;

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
    
    // Формируем массив товаров с уже примененными скидками
    const itemsToSend = Object.keys(cart).map(id => {
        const p = products.find(prod => prod.id == id);
        const finalPrice = p.discount > 0 ? Math.round(p.price * (1 - p.discount / 100)) : p.price;
        return { name: p.name, price: finalPrice, qty: cart[id] };
    });

    tg.MainButton.showProgress();
    try {
        await fetch(BACKEND_URL, {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "create_order", name, phone, total: calculateTotal(), items: itemsToSend, tg_user_id: user.id })
        });
        tg.MainButton.hideProgress();
        tg.HapticFeedback.notificationOccurred('success');
        tg.showPopup({ title: 'Успешно!', message: 'Ваш заказ принят.', buttons: [{ type: 'ok' }] }, () => {
            cart = {}; document.getElementById('order-form').reset();
            closeCheckout(); updateCartUI();
            productListView.classList.add('hidden'); categoryListView.classList.remove('hidden');
            pageTitle.innerText = 'Категории';
        });
    } catch (e) {
        tg.MainButton.hideProgress(); tg.showAlert('Ошибка при отправке.');
    }
}

// ==========================================
// --- ЛОГИКА АДМИН-ПАНЕЛИ ---
// ==========================================
if (isAdmin) {
    document.getElementById('admin-btn').onclick = () => {
        tg.HapticFeedback.impactOccurred('medium');
        document.getElementById('admin-modal').classList.remove('hidden');
        loadAdminData();
    };
    document.getElementById('close-admin').onclick = () => document.getElementById('admin-modal').classList.add('hidden');

    // Переключение табов
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.remove('hidden');
        };
    });

    async function loadAdminData() {
        // Заказы
        try {
            const res = await fetch(BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: "get_orders" }) });
            const data = await res.json();
            if (data.status === 'success') renderAdminOrders(data.orders);
        } catch(e) {}
        
        renderAdminProducts();
        renderAdminCategories();
        updateCategorySelect();
    }

    function renderAdminOrders(orders) {
        const list = document.getElementById('admin-orders-list');
        list.innerHTML = '';
        let totalRevenue = 0;
        
        if (orders.length === 0) list.innerHTML = '<p style="text-align:center; color: #7F8C8D;">Заказов пока нет</p>';
        
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
                        <h5>${prod.name} ${prod.discount > 0 ? `<span style="color:red; font-size:10px;">(-${prod.discount}%)</span>` : ''}</h5>
                        <p>${prod.price} ₽</p>
                    </div>
                </div>
                <div style="display:flex; gap: 5px;">
                    <button class="edit-btn" onclick="editProduct('${prod.id}')" style="background: #E9ECEF; border: 1px solid #ccc; border-radius: 6px; padding: 8px; cursor: pointer;">✏️</button>
                    <button class="del-btn" onclick="deleteProduct('${prod.id}')">Удалить</button>
                </div>
            `;
            list.appendChild(card);
        });
    }

    function renderAdminCategories() {
        const list = document.getElementById('admin-categories-list');
        list.innerHTML = '';
        categories.forEach(cat => {
            const card = document.createElement('div');
            card.className = 'admin-cat-card';
            card.innerHTML = `
                <div class="admin-prod-info"><h5>${cat.name}</h5></div>
                <button class="del-btn" onclick="deleteCategory('${cat.id}')">Удалить</button>
            `;
            list.appendChild(card);
        });
    }

    function updateCategorySelect() {
        const select = document.getElementById('new-prod-cat');
        select.innerHTML = '';
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id; 
            opt.innerText = cat.name;
            select.appendChild(opt);
        });
    }

    // Глобальные функции админки
    window.updateOrderStatus = async (rowIndex, status) => {
        tg.HapticFeedback.impactOccurred('light');
        await fetch(BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: "update_order_status", rowIndex, status }) });
        loadAdminData();
    };

    window.deleteProduct = async (id) => {
        if (!confirm("Удалить этот товар?")) return;
        await fetch(BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: "delete_product", id }) });
        await fetchData(); 
        renderAdminProducts();
    };

    window.deleteCategory = async (id) => {
        // Проверка, есть ли товары в категории
        const hasProducts = products.some(p => p.category === id);
        if (hasProducts) {
            tg.showAlert("Нельзя удалить категорию, пока в ней есть товары! Сначала удалите или перенесите товары.");
            return;
        }
        if (!confirm("Удалить эту категорию?")) return;
        await fetch(BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: "delete_category", id }) });
        await fetchData(); 
        renderAdminCategories(); 
        updateCategorySelect();
    };

    window.editProduct = (id) => {
        const prod = products.find(p => p.id == id);
        if (!prod) return;

        tg.HapticFeedback.impactOccurred('light');
        
        // Заполняем форму данными товара
        document.getElementById('edit-prod-id').value = prod.id;
        document.getElementById('new-prod-name').value = prod.name;
        document.getElementById('new-prod-price').value = prod.price;
        document.getElementById('new-prod-discount').value = prod.discount || 0;
        document.getElementById('new-prod-img').value = prod.image;
        document.getElementById('new-prod-cat').value = prod.category;

        // Меняем кнопку и показываем форму
        document.getElementById('admin-save-btn').innerText = "Обновить товар";
        document.getElementById('admin-save-btn').style.background = "#4A72FF";
        document.getElementById('admin-add-product-form').classList.remove('hidden');
        
        // Скроллим наверх к форме
        document.querySelector('#tab-products').scrollIntoView({ behavior: 'smooth' });
    };

    // Кнопка "+ Добавить товар" (сбрасываем форму в режим создания)
    document.getElementById('btn-show-add-product').onclick = () => {
        const form = document.getElementById('admin-add-product-form');
        form.reset();
        document.getElementById('edit-prod-id').value = ""; // Очищаем ID
        document.getElementById('admin-save-btn').innerText = "Сохранить";
        document.getElementById('admin-save-btn').style.background = "#27AE60";
        form.classList.toggle('hidden');
    };

    // Отправка формы товара (и создание, и обновление)
    document.getElementById('admin-add-product-form').onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-prod-id').value;
        const name = document.getElementById('new-prod-name').value;
        const price = document.getElementById('new-prod-price').value;
        const discount = document.getElementById('new-prod-discount').value || 0;
        const image = document.getElementById('new-prod-img').value;
        const category = document.getElementById('new-prod-cat').value;

        tg.HapticFeedback.notificationOccurred('success');
        
        // Если есть ID — обновляем, если нет — создаем
        const actionType = id ? "update_product" : "add_product";
        
        await fetch(BACKEND_URL, { 
            method: 'POST', 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
            body: JSON.stringify({ action: actionType, id, name, price, discount, image, category }) 
        });
        
        e.target.reset(); 
        document.getElementById('edit-prod-id').value = "";
        e.target.classList.add('hidden');
        await fetchData(); 
        renderAdminProducts();
    };

    // Отправка формы категории
    document.getElementById('admin-add-category-form').onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-cat-name').value;
        tg.HapticFeedback.notificationOccurred('success');
        await fetch(BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: "add_category", name }) });
        e.target.reset();
        await fetchData(); 
        renderAdminCategories(); 
        updateCategorySelect();
    };
}

// --- ЗАПУСК ПРИЛОЖЕНИЯ ---
fetchData();
updateCartUI();

try {
    if (tg.CloudStorage) {
        tg.CloudStorage.getItem('tg_shop_cart', (err, value) => {
            if (!err && value) { try { cart = JSON.parse(value); updateCartUI(); } catch(e) {} }
        });
    } else {
        const localCart = localStorage.getItem('tg_shop_cart');
        if (localCart) { cart = JSON.parse(localCart); updateCartUI(); }
    }
} catch (e) {}
