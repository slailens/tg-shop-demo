const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();
tg.setHeaderColor('#4A72FF');
tg.setBackgroundColor('#E9ECEF');
tg.MainButton.setParams({ color: '#4A72FF', text_color: '#ffffff' });

const BACKEND_URL = "https://script.google.com/macros/s/AKfycbxZ-cpm1TbzoGfbXSWOgXuYfyloZJRJsLH_SfGLVqQZIRI5pavr9iMkP6vh3HAMX7ioeQ/exec";
const ADMIN_ID = 767941221; 

let isAdmin = false, categories = [], products = [], cart = {}, favorites = [], activePromo = null, currentProductForCart = null;
let isCheckoutActive = false;

const user = tg.initDataUnsafe?.user;
if (user) {
    document.getElementById('user-name') && (document.getElementById('user-name').innerText = user.first_name);
    if (user.id === ADMIN_ID) {
        isAdmin = true;
        document.getElementById('admin-btn').classList.remove('hidden');
    }
    // Регистрация пользователя для рассылки
    fetch(BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: "register_user", tg_id: user.id, first_name: user.first_name, username: user.username }) }).catch(()=>{});
}

// Элементы
const catView = document.getElementById('categories-view');
const prodView = document.getElementById('products-view');
const favView = document.getElementById('favorites-view');
const detailView = document.getElementById('product-details-view');
const pageTitle = document.getElementById('page-title');
const searchContainer = document.getElementById('search-container');

// --- НАВИГАЦИЯ ---
function hideAllViews() {
    catView.classList.add('hidden'); prodView.classList.add('hidden'); favView.classList.add('hidden'); detailView.classList.add('hidden');
    searchContainer.classList.add('hidden');
    tg.BackButton.hide();
}

function showCategories() {
    hideAllViews(); catView.classList.remove('hidden');
    pageTitle.innerText = 'Категории'; searchContainer.classList.remove('hidden');
    renderCategories();
}

// --- ЗАГРУЗКА И ОТРИСОВКА ---
async function fetchData() {
    document.getElementById('category-list').innerHTML = '<p>Загрузка...</p>';
    try {
        const res = await fetch(BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: "get_data" }) });
        const data = await res.json();
        if(data.status === 'success') {
            categories = data.categories; products = data.products;
            if(data.settings && data.settings.banner_url) {
                const b = document.getElementById('banner-img');
                b.src = data.settings.banner_url; b.classList.remove('hidden');
            }
            renderCategories();
        }
    } catch (e) { tg.showAlert('Ошибка загрузки'); }
}

function renderCategories() {
    const list = document.getElementById('category-list');
    list.innerHTML = '';
    categories.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'category-card'; card.innerText = cat.name;
        card.onclick = () => { tg.HapticFeedback.impactOccurred('light'); showProducts(cat.id, cat.name); };
        list.appendChild(card);
    });
}

function showProducts(categoryId, categoryName) {
    hideAllViews(); prodView.classList.remove('hidden');
    pageTitle.innerText = categoryName; tg.BackButton.show();
    
    const list = document.getElementById('product-list');
    list.innerHTML = '';
    let filtered = products.filter(p => p.category === categoryId);
    renderProductCards(filtered, list);
}

function renderProductCards(arr, container) {
    container.innerHTML = ''; // <--- ВОТ ЭТА СТРОКА ОЧИЩАЕТ ЭКРАН ОТ СТАРЫХ КАРТОЧЕК
    if(arr.length === 0) { 
        container.innerHTML = '<p style="text-align:center; color:#777;">Ничего не найдено</p>'; 
        return; 
    }
    arr.forEach(product => {
        let priceHtml = product.discount > 0 
            ? `<div class="price-block"><span class="new-price">${Math.round(product.price * (1 - product.discount/100))} ₽</span> <span class="old-price">${product.price} ₽</span> <span class="discount-badge">-${product.discount}%</span></div>`
            : `<div class="price-block"><span class="new-price">${product.price} ₽</span></div>`;

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${product.image}" class="product-img">
            <div class="product-info"><h3>${product.name}</h3>${priceHtml}</div>
            <button class="buy-btn">+</button>
        `;
        // Клик по карточке открывает детали
        card.onclick = (e) => {
            if(e.target.classList.contains('buy-btn')) { addToCart(product.id); } 
            else { showProductDetails(product); }
        };
        container.appendChild(card);
    });
}

function showProductDetails(product) {
    hideAllViews(); detailView.classList.remove('hidden');
    pageTitle.innerText = 'Товар'; tg.BackButton.show();
    
    document.getElementById('detail-img').src = product.image;
    document.getElementById('detail-name').innerText = product.name;
    document.getElementById('detail-desc').innerText = product.description || 'Описание отсутствует.';
    
    let finalPrice = product.discount > 0 ? Math.round(product.price * (1 - product.discount/100)) : product.price;
    document.getElementById('detail-price').innerHTML = product.discount > 0 
        ? `<span style="color:#27AE60">${finalPrice} ₽</span> <span style="font-size:14px; color:#999; text-decoration:line-through;">${product.price} ₽</span>`
        : `${product.price} ₽`;

    currentProductForCart = product.id;
        updateFavIcon(product.id);
    
    // Загрузка отзывов
    const revList = document.getElementById('reviews-list');
    revList.innerHTML = '<p style="font-size:12px; color:#999;">Загрузка отзывов...</p>';
    fetch(BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: "get_reviews", product_id: product.id }) })
    .then(r => r.json()).then(d => {
        revList.innerHTML = '';
        if(d.reviews && d.reviews.length > 0) {
            d.reviews.forEach(r => {
                revList.innerHTML += `<div class="review-item"><div class="review-user">${r.user} <span style="color:gold">${'⭐'.repeat(r.rating)}</span></div><div class="review-text">${r.text}</div></div>`;
            });
        } else {
            revList.innerHTML = '<p style="font-size:13px; color:#777;">Пока нет отзывов.</p>';
        }
    });
}

document.getElementById('btn-add-to-cart-detail').onclick = () => { addToCart(currentProductForCart); };
document.getElementById('back-from-details').onclick = () => { showCategories(); }; // Упрощенно, возвращает в начало
document.getElementById('back-to-categories').onclick = () => { showCategories(); };
document.getElementById('back-from-fav').onclick = () => { showCategories(); };
tg.BackButton.onClick(() => { showCategories(); });

// --- ПОИСК ---
document.getElementById('search-input').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    if(q.length > 0) {
        // Скрываем другие экраны, но НЕ ТРОГАЕМ поисковую строку
        catView.classList.add('hidden'); 
        favView.classList.add('hidden'); 
        detailView.classList.add('hidden'); 
        prodView.classList.remove('hidden'); 
        
        pageTitle.innerText = 'Поиск'; 
        tg.BackButton.show();
        
        const filtered = products.filter(p => p.name.toLowerCase().includes(q));
        renderProductCards(filtered, document.getElementById('product-list'));
    } else {
        showCategories();
    }
});

// --- КОРЗИНА И ПРОМОКОДЫ ---
function addToCart(id) {
    cart[id] = (cart[id] || 0) + 1;
    tg.HapticFeedback.notificationOccurred('success');
    updateCartUI();
    tg.showAlert('Товар добавлен в корзину');
}

function calculateTotal() {
    let total = Object.keys(cart).reduce((sum, id) => {
        const p = products.find(prod => prod.id == id);
        if(!p) return sum;
        const finalPrice = p.discount > 0 ? Math.round(p.price * (1 - p.discount/100)) : p.price;
        return sum + (finalPrice * cart[id]);
    }, 0);
    if(activePromo) total = Math.round(total * (1 - activePromo / 100));
    return total;
}

function updateCartUI() {
    if (tg.CloudStorage) tg.CloudStorage.setItem('tg_shop_cart', JSON.stringify(cart));
    localStorage.setItem('tg_shop_cart', JSON.stringify(cart));
    
    const totalItems = Object.values(cart).reduce((s, q) => s + q, 0);
    document.getElementById('cart-count').innerText = totalItems;
    const totalPrice = calculateTotal();

    if (totalItems > 0) {
        document.getElementById('cart-total-block').classList.remove('hidden');
        document.getElementById('cart-total-price').innerText = totalPrice + ' ₽';
        tg.MainButton.setText(isCheckoutActive ? "Подтвердить заказ" : `Оформить на ${totalPrice} ₽`);
        tg.MainButton.show();
    } else {
        document.getElementById('cart-total-block').classList.add('hidden');
        tg.MainButton.hide();
        if (isCheckoutActive) closeCheckout();
    }

    const container = document.getElementById('cart-items');
    container.innerHTML = '';
    Object.keys(cart).forEach(id => {
        const p = products.find(prod => prod.id == id);
        if(!p) return;
        const finalPrice = p.discount > 0 ? Math.round(p.price * (1 - p.discount/100)) : p.price;
        container.innerHTML += `
            <div class="cart-item">
                <div><h4>${p.name}</h4><div style="color:#27AE60;font-weight:bold;">${finalPrice * cart[id]} ₽</div></div>
                <div class="action-btns">
                    <button onclick="window.changeQty('${id}', -1)">−</button>
                    <span>${cart[id]}</span>
                    <button onclick="window.changeQty('${id}', 1)">+</button>
                </div>
            </div>`;
    });
}

window.changeQty = (id, delta) => {
    if (!cart[id]) return;
    cart[id] += delta;
    if (cart[id] <= 0) delete cart[id];
    tg.HapticFeedback.impactOccurred('light');
    updateCartUI();
};

document.getElementById('apply-promo-btn').onclick = async () => {
    const code = document.getElementById('promo-input').value.trim();
    if(!code) return;
    const res = await fetch(BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: "check_promo", code }) });
    const data = await res.json();
    if(data.status === 'success') {
        activePromo = data.discount;
        tg.showAlert(`Промокод применен! Скидка ${activePromo}%`);
        updateCartUI();
    } else {
        tg.showAlert('Неверный промокод');
    }
};

document.getElementById('cart-icon').onclick = () => { document.getElementById('cart-modal').classList.remove('hidden'); };
document.getElementById('close-cart').onclick = () => { document.getElementById('cart-modal').classList.add('hidden'); };
document.getElementById('close-checkout').onclick = () => { closeCheckout(); };

function openCheckout() { isCheckoutActive = true; document.getElementById('cart-modal').classList.add('hidden'); document.getElementById('checkout-modal').classList.remove('hidden'); updateCartUI(); }
function closeCheckout() { isCheckoutActive = false; document.getElementById('checkout-modal').classList.add('hidden'); updateCartUI(); }

tg.MainButton.onClick(() => {
    tg.HapticFeedback.impactOccurred('heavy');
    if (isCheckoutActive) { if (document.getElementById('order-form').reportValidity()) submitOrder(); } 
    else { openCheckout(); }
});

async function submitOrder() {
    const name = document.getElementById('client-name').value;
    const phone = document.getElementById('client-phone').value;
    const itemsToSend = Object.keys(cart).map(id => {
        const p = products.find(prod => prod.id == id);
        const finalPrice = p.discount > 0 ? Math.round(p.price * (1 - p.discount/100)) : p.price;
        return { name: p.name, price: finalPrice, qty: cart[id] };
    });

    tg.MainButton.showProgress();
    try {
        await fetch(BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: "create_order", name, phone, total: calculateTotal(), items: itemsToSend, tg_user_id: user.id }) });
        tg.MainButton.hideProgress(); tg.HapticFeedback.notificationOccurred('success');
        tg.showPopup({ title: 'Успешно!', message: 'Ваш заказ принят.', buttons: [{ type: 'ok' }] }, () => {
            cart = {}; activePromo = null; document.getElementById('order-form').reset(); document.getElementById('promo-input').value = '';
            closeCheckout(); updateCartUI(); showCategories();
        });
    } catch (e) { tg.MainButton.hideProgress(); tg.showAlert('Ошибка при отправке.'); }
}

// --- ИЗБРАННОЕ ---
document.getElementById('fav-btn').onclick = () => {
    hideAllViews(); favView.classList.remove('hidden'); pageTitle.innerText = 'Избранное'; tg.BackButton.show();
    const favProds = products.filter(p => favorites.includes(p.id));
    renderProductCards(favProds, document.getElementById('fav-list'));
};

// --- АДМИНКА ---
if (isAdmin) {
    document.getElementById('admin-btn').onclick = () => { document.getElementById('admin-modal').classList.remove('hidden'); loadAdminData(); };
    document.getElementById('close-admin').onclick = () => { document.getElementById('admin-modal').classList.add('hidden'); };

    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));
            tab.classList.add('active'); document.getElementById(tab.dataset.tab).classList.remove('hidden');
        };
    });

    async function loadAdminData() {
        fetch(BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: "get_orders" }) })
        .then(r => r.json()).then(data => {
            if (data.status === 'success') {
                const list = document.getElementById('admin-orders-list'); list.innerHTML = '';
                let rev = 0;
                data.orders.forEach(o => {
                    if(o.status !== 'Отменен') rev += Number(o.total);
                    list.innerHTML += `
                        <div class="order-admin-card">
                            <h4>${o.name} <span style="font-size:10px;color:#999;">${o.date}</span></h4>
                            <p>📞 ${o.phone} | 💰 <b>${o.total} ₽</b></p>
                            <select onchange="window.upStat(${o.rowIndex}, this.value)">
                                <option value="Новый" ${o.status === 'Новый' ? 'selected' : ''}>Новый</option>
                                <option value="В работе" ${o.status === 'В работе' ? 'selected' : ''}>В работе</option>
                                <option value="Выполнен" ${o.status === 'Выполнен' ? 'selected' : ''}>Выполнен</option>
                                <option value="Отменен" ${o.status === 'Отменен' ? 'selected' : ''}>Отменен</option>
                            </select>
                        </div>`;
                });
                document.getElementById('admin-total-revenue').innerText = rev + ' ₽';
                document.getElementById('admin-total-orders').innerText = data.orders.length;
            }
        });

        // Товары
        const pl = document.getElementById('admin-products-list'); pl.innerHTML = '';
        products.forEach(p => {
            pl.innerHTML += `
                <div class="admin-prod-card">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${p.image}" style="width:40px;height:40px;border-radius:4px;object-fit:cover;">
                        <div><h5 style="font-size:14px;margin-bottom:2px;">${p.name}</h5><p style="font-size:12px;color:#27AE60;font-weight:bold;">${p.price} ₽</p></div>
                    </div>
                    <div><button class="edit-btn" onclick="window.editProd('${p.id}')">✏️</button> <button class="del-btn" onclick="window.delProd('${p.id}')">Удалить</button></div>
                </div>`;
        });

        // Категории
        const cl = document.getElementById('admin-categories-list'); cl.innerHTML = '';
        categories.forEach(c => {
            cl.innerHTML += `<div class="admin-cat-card" style="display:flex;justify-content:space-between;padding:10px;background:#fff;border-radius:8px;margin-bottom:5px;"><div>${c.name}</div><button class="del-btn" onclick="window.delCat('${c.id}')">Удалить</button></div>`;
        });
        
        // Селект категорий
        const sel = document.getElementById('new-prod-cat'); sel.innerHTML = '';
        categories.forEach(c => { sel.innerHTML += `<option value="${c.id}">${c.name}</option>`; });
    }

    window.upStat = async (row, stat) => { await fetch(BACKEND_URL, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({action:"update_order_status", rowIndex:row, status:stat})}); loadAdminData(); };
    window.delProd = async (id) => { if(!confirm('Удалить?')) return; await fetch(BACKEND_URL, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({action:"delete_product", id})}); await fetchData(); loadAdminData(); };
    window.delCat = async (id) => { if(!confirm('Удалить?')) return; await fetch(BACKEND_URL, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({action:"delete_category", id})}); await fetchData(); loadAdminData(); };
    
    window.editProd = (id) => {
        const p = products.find(x => x.id == id); if(!p) return;
        document.getElementById('edit-prod-id').value = p.id;
        document.getElementById('new-prod-name').value = p.name;
        document.getElementById('new-prod-desc').value = p.description || '';
        document.getElementById('new-prod-price').value = p.price;
        document.getElementById('new-prod-discount').value = p.discount || 0;
        document.getElementById('new-prod-img').value = p.image;
        document.getElementById('new-prod-cat').value = p.category;
        document.getElementById('admin-save-btn').innerText = "Обновить"; document.getElementById('admin-save-btn').style.background = "#4A72FF";
        document.getElementById('admin-add-product-form').classList.remove('hidden');
        document.getElementById('tab-products').scrollIntoView({behavior:'smooth'});
    };

    document.getElementById('btn-show-add-product').onclick = () => {
        document.getElementById('admin-add-product-form').reset();
        document.getElementById('edit-prod-id').value = "";
        document.getElementById('admin-save-btn').innerText = "Сохранить"; document.getElementById('admin-save-btn').style.background = "#27AE60";
        document.getElementById('admin-add-product-form').classList.toggle('hidden');
    };

    document.getElementById('admin-add-product-form').onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-prod-id').value;
        const data = {
            action: id ? "update_product" : "add_product", id: id,
            name: document.getElementById('new-prod-name').value,
            description: document.getElementById('new-prod-desc').value,
            price: document.getElementById('new-prod-price').value,
            discount: document.getElementById('new-prod-discount').value || 0,
            image: document.getElementById('new-prod-img').value,
            category: document.getElementById('new-prod-cat').value
        };
        await fetch(BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(data) });
        e.target.reset(); document.getElementById('edit-prod-id').value = ""; e.target.classList.add('hidden');
        await fetchData(); loadAdminData();
    };

    document.getElementById('admin-add-category-form').onsubmit = async (e) => {
        e.preventDefault();
        await fetch(BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: "add_category", name: document.getElementById('new-cat-name').value }) });
        e.target.reset(); await fetchData(); loadAdminData();
    };

    document.getElementById('btn-send-broadcast').onclick = async () => {
        const text = document.getElementById('broadcast-text').value;
        if(!text) return;
        tg.MainButton.showProgress();
        const res = await fetch(BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: "broadcast", message: text }) });
        const data = await res.json();
        tg.MainButton.hideProgress();
        if(data.status === 'success') { tg.showAlert(`Отправлено: ${data.count} пользователям`); document.getElementById('broadcast-text').value = ''; }
        else { tg.showAlert('Ошибка'); }
    };
}

// --- ЛОГИКА ИЗБРАННОГО ---
function loadFavorites() {
    const saved = localStorage.getItem('tg_shop_favs');
    if (saved) favorites = JSON.parse(saved);
    updateFavCount();
}

function updateFavCount() {
    const badge = document.getElementById('fav-count');
    if (favorites.length > 0) {
        badge.innerText = favorites.length;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

window.toggleFavorite = (id) => {
    const stringId = id.toString();
    const index = favorites.map(String).indexOf(stringId); // Проверяем как строки
    if (index > -1) {
        favorites.splice(index, 1); // Удаляем
    } else {
        favorites.push(stringId); // Добавляем
    }
    localStorage.setItem('tg_shop_favs', JSON.stringify(favorites));
    tg.HapticFeedback.impactOccurred('light');
    updateFavIcon(id);
    updateFavCount();
};

function updateFavIcon(id) {
    const btn = document.getElementById('btn-fav-detail');
    if (favorites.includes(id)) {
        btn.innerText = '❤️';
        btn.style.background = '#ffeded';
    } else {
        btn.innerText = '🤍';
        btn.style.background = 'var(--bg-color)';
    }
}

// Привязка кнопки сердечка в карточке
document.getElementById('btn-fav-detail').onclick = () => {
    toggleFavorite(currentProductForCart);
};

// Обновленный обработчик кнопки Избранное в шапке
document.getElementById('fav-btn').onclick = () => {
    hideAllViews(); 
    favView.classList.remove('hidden'); 
    pageTitle.innerText = 'Избранное'; 
    tg.BackButton.show();
    const favProds = products.filter(p => favorites.includes(p.id));
    renderProductCards(favProds, document.getElementById('fav-list'));
};

// Вызов загрузки избранного при старте
loadFavorites();
// Запуск
fetchData(); updateCartUI();
