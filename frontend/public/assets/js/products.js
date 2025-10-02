// JavaScript para Catálogo de Productos - RF06
class ProductManager {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 12;
        this.currentFilters = {
            categoria: '',
            busqueda: '',
            orden: ''
        };
        this.userRole = '';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadUserInfo();
        this.loadCategories();
        this.loadProducts();
    }

    setupEventListeners() {
        // Búsqueda
        const searchInput = document.getElementById('searchInput');
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.currentFilters.busqueda = e.target.value;
                this.currentPage = 1;
                this.loadProducts();
            }, 500);
        });

        // Filtros
        document.getElementById('categoryFilter').addEventListener('change', (e) => {
            this.currentFilters.categoria = e.target.value;
            this.currentPage = 1;
            this.loadProducts();
        });

        document.getElementById('sortOrder').addEventListener('change', (e) => {
            this.currentFilters.orden = e.target.value;
            this.currentPage = 1;
            this.loadProducts();
        });

        // Botones de administrador
        const newProductBtn = document.getElementById('newProductBtn');
        if (newProductBtn) {
            newProductBtn.addEventListener('click', () => this.showProductForm());
        }

        // Modales
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal('productModal');
        });

        document.getElementById('closeFormModal').addEventListener('click', () => {
            this.closeModal('productFormModal');
        });

        document.getElementById('cancelForm').addEventListener('click', () => {
            this.closeModal('productFormModal');
        });

        // Formulario de producto
        document.getElementById('productForm').addEventListener('submit', (e) => {
            this.handleProductSubmit(e);
        });

        // Cerrar modales con click fuera
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }

    async loadUserInfo() {
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            if (!user) {
                window.location.href = 'login.html';
                return;
            }

            this.userRole = user.rol;
            
            // Actualizar interfaz según rol
            this.updateUIForRole(user);
            
        } catch (error) {
            console.error('Error al cargar información del usuario:', error);
        }
    }

    updateUIForRole(user) {
        const roleBadge = document.getElementById('roleBadge');
        const pricingNote = document.getElementById('pricingNote');
        const adminActions = document.getElementById('adminActions');

        // Badge de rol
        roleBadge.className = `role-badge ${user.rol}`;
        roleBadge.textContent = user.rol.charAt(0).toUpperCase() + user.rol.slice(1);

        // Nota de precios
        let noteText = '';
        switch(user.rol) {
            case 'cliente':
                noteText = 'Los precios mostrados son precios de cliente final';
                break;
            case 'proveedor':
                noteText = 'Los precios mostrados son precios preferenciales para proveedores';
                break;
            case 'administrador':
                noteText = 'Como administrador, ves los precios de cliente. Puedes gestionar productos';
                adminActions.style.display = 'flex';
                break;
        }
        pricingNote.textContent = noteText;
    }

    async loadCategories() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/products/categorias/lista', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Error al cargar categorías');
            }

            const categorias = await response.json();
            this.populateCategoryFilter(categorias);
            
        } catch (error) {
            console.error('Error al cargar categorías:', error);
            this.showError('Error al cargar categorías');
        }
    }

    populateCategoryFilter(categorias) {
        const categoryFilter = document.getElementById('categoryFilter');
        const categorySelect = document.getElementById('categoria_id');
        
        // Limpiar opciones existentes (excepto la primera)
        categoryFilter.innerHTML = '<option value="">Todas las categorías</option>';
        if (categorySelect) {
            categorySelect.innerHTML = '<option value="">Seleccionar categoría</option>';
        }

        categorias.forEach(categoria => {
            // Filtro de categorías
            const option = document.createElement('option');
            option.value = categoria.id;
            option.textContent = `${categoria.nombre} (${categoria.total_productos})`;
            categoryFilter.appendChild(option);

            // Select del formulario
            if (categorySelect) {
                const formOption = document.createElement('option');
                formOption.value = categoria.id;
                formOption.textContent = categoria.nombre;
                categorySelect.appendChild(formOption);
            }
        });
    }

    async loadProducts() {
        try {
            this.showLoading(true);
            
            const token = localStorage.getItem('token');
            const params = new URLSearchParams({
                pagina: this.currentPage,
                limite: this.itemsPerPage,
                ...this.currentFilters
            });

            // Filtrar parámetros vacíos
            for (const [key, value] of [...params.entries()]) {
                if (!value) {
                    params.delete(key);
                }
            }

            const response = await fetch(`/api/products/lista?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Error al cargar productos');
            }

            const data = await response.json();
            this.renderProducts(data.productos);
            this.renderPagination(data.pagination);
            
        } catch (error) {
            console.error('Error al cargar productos:', error);
            this.showError('Error al cargar productos');
        } finally {
            this.showLoading(false);
        }
    }

    renderProducts(productos) {
        const grid = document.getElementById('productsGrid');
        const noProducts = document.getElementById('noProducts');

        if (!productos || productos.length === 0) {
            grid.innerHTML = '';
            noProducts.style.display = 'block';
            return;
        }

        noProducts.style.display = 'none';
        
        grid.innerHTML = productos.map(producto => this.createProductCard(producto)).join('');

        // Agregar event listeners a las tarjetas
        grid.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', () => {
                const productId = card.dataset.productId;
                this.showProductDetail(productId);
            });
        });
    }

    createProductCard(producto) {
        const stockLevel = this.getStockLevel(producto.stock_actual, producto.stock_minimo);
        const imageUrl = producto.imagen_principal 
            ? `/uploads/productos/${producto.imagen_principal}` 
            : null;

        return `
            <div class="product-card" data-product-id="${producto.id}">
                <div class="product-image">
                    ${imageUrl ? 
                        `<img src="${imageUrl}" alt="${producto.nombre}" onerror="this.parentElement.innerHTML='<div class=\\'placeholder\\'><i class=\\'fas fa-box\\'></i></div>'">` :
                        '<div class="placeholder"><i class="fas fa-box"></i></div>'
                    }
                    <div class="product-badge">${producto.codigo}</div>
                </div>
                <div class="product-info">
                    <div class="product-category">${producto.categoria_nombre}</div>
                    <h3 class="product-name">${producto.nombre}</h3>
                    <div class="product-code">SKU: ${producto.codigo}</div>
                    <div class="product-description">${producto.descripcion || 'Sin descripción'}</div>
                    <div class="product-footer">
                        <div class="product-price">
                            $${this.formatPrice(producto.precio_usuario)}
                            <span class="product-unit">/${producto.unidad_medida}</span>
                        </div>
                        <div class="product-stock">
                            <div class="stock-indicator ${stockLevel}"></div>
                            Stock: ${producto.stock_actual}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getStockLevel(current, minimum) {
        if (current <= minimum) return 'low';
        if (current <= minimum * 2) return 'medium';
        return 'high';
    }

    formatPrice(price) {
        return new Intl.NumberFormat('es-CO', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(price);
    }

    async showProductDetail(productId) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/products/${productId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Error al cargar detalles del producto');
            }

            const producto = await response.json();
            this.renderProductDetail(producto);
            this.showModal('productModal');
            
        } catch (error) {
            console.error('Error al cargar detalles:', error);
            this.showError('Error al cargar detalles del producto');
        }
    }

    renderProductDetail(producto) {
        // Información básica
        document.getElementById('modalProductName').textContent = producto.nombre;
        document.getElementById('productCode').textContent = producto.codigo;
        document.getElementById('productPrice').textContent = `$${this.formatPrice(producto.precio_usuario)}`;
        document.getElementById('priceType').textContent = `(${this.getPriceTypeText()})`;
        document.getElementById('productDescription').textContent = producto.descripcion || 'Sin descripción';
        document.getElementById('productCategory').textContent = producto.categoria_nombre;
        document.getElementById('productUnit').textContent = producto.unidad_medida;
        document.getElementById('productStock').textContent = `${producto.stock_actual} disponibles`;

        // Imagen principal
        const mainImage = document.getElementById('mainProductImage');
        if (producto.imagen_principal) {
            mainImage.src = `/uploads/productos/${producto.imagen_principal}`;
            mainImage.alt = producto.nombre;
        } else {
            mainImage.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiNGOUZBRkIiLz48cGF0aCBkPSJNMjAwIDEyMEM4OC41IDEyMCAyMCAxNzkuNiAyMCAyNDBTODguNSAzNjAgMjAwIDM2MFMzODAgMzAwLjQgMzgwIDI0MFMzMTEuNSAxMjAgMjAwIDEyMFoiIGZpbGw9IiNFNUU3RUIiLz48L3N2Zz4=';
        }

        // Especificaciones
        this.renderSpecifications(producto.especificaciones || []);

        // Productos relacionados
        this.renderRelatedProducts(producto.relacionados || []);
    }

    getPriceTypeText() {
        switch(this.userRole) {
            case 'proveedor': return 'Precio Proveedor';
            case 'administrador': return 'Precio Cliente';
            default: return 'Precio Cliente';
        }
    }

    renderSpecifications(especificaciones) {
        const specsList = document.getElementById('specsList');
        const specificationsSection = document.getElementById('productSpecifications');

        if (!especificaciones || especificaciones.length === 0) {
            specificationsSection.style.display = 'none';
            return;
        }

        specificationsSection.style.display = 'block';
        specsList.innerHTML = especificaciones.map(spec => `
            <div class="spec-item">
                <span class="spec-name">${spec.nombre}</span>
                <span class="spec-value">${spec.valor} ${spec.unidad || ''}</span>
            </div>
        `).join('');
    }

    renderRelatedProducts(relacionados) {
        const relatedSection = document.getElementById('relatedProducts');
        const relatedGrid = document.getElementById('relatedGrid');

        if (!relacionados || relacionados.length === 0) {
            relatedSection.style.display = 'none';
            return;
        }

        relatedSection.style.display = 'block';
        relatedGrid.innerHTML = relacionados.map(producto => `
            <div class="related-item" data-product-id="${producto.id}">
                ${producto.imagen_principal ? 
                    `<img src="/uploads/productos/${producto.imagen_principal}" alt="${producto.nombre}">` :
                    '<div style="width:60px;height:60px;background:#f1f5f9;border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:8px;"><i class="fas fa-box" style="color:#6b7280;"></i></div>'
                }
                <div class="name">${producto.nombre}</div>
                <div class="price">$${this.formatPrice(producto.precio_usuario)}</div>
            </div>
        `).join('');

        // Event listeners para productos relacionados
        relatedGrid.querySelectorAll('.related-item').forEach(item => {
            item.addEventListener('click', () => {
                const productId = item.dataset.productId;
                this.showProductDetail(productId);
            });
        });
    }

    renderPagination(pagination) {
        const paginationContainer = document.getElementById('pagination');
        
        if (!pagination || pagination.total_paginas <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        const { pagina, total_paginas, total } = pagination;
        let paginationHTML = '';

        // Botón anterior
        paginationHTML += `
            <button class="pagination-btn" ${pagina <= 1 ? 'disabled' : ''} onclick="productManager.goToPage(${pagina - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;

        // Páginas
        const startPage = Math.max(1, pagina - 2);
        const endPage = Math.min(total_paginas, pagina + 2);

        if (startPage > 1) {
            paginationHTML += `<button class="pagination-btn" onclick="productManager.goToPage(1)">1</button>`;
            if (startPage > 2) {
                paginationHTML += `<span class="pagination-info">...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="pagination-btn ${i === pagina ? 'active' : ''}" onclick="productManager.goToPage(${i})">
                    ${i}
                </button>
            `;
        }

        if (endPage < total_paginas) {
            if (endPage < total_paginas - 1) {
                paginationHTML += `<span class="pagination-info">...</span>`;
            }
            paginationHTML += `<button class="pagination-btn" onclick="productManager.goToPage(${total_paginas})">${total_paginas}</button>`;
        }

        // Botón siguiente
        paginationHTML += `
            <button class="pagination-btn" ${pagina >= total_paginas ? 'disabled' : ''} onclick="productManager.goToPage(${pagina + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;

        // Información
        paginationHTML += `
            <div class="pagination-info">
                Mostrando ${(pagina - 1) * this.itemsPerPage + 1}-${Math.min(pagina * this.itemsPerPage, total)} de ${total} productos
            </div>
        `;

        paginationContainer.innerHTML = paginationHTML;
    }

    goToPage(page) {
        this.currentPage = page;
        this.loadProducts();
        
        // Scroll hacia arriba
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    showProductForm(producto = null) {
        const modal = document.getElementById('productFormModal');
        const title = document.getElementById('formModalTitle');
        const form = document.getElementById('productForm');

        title.textContent = producto ? 'Editar Producto' : 'Nuevo Producto';
        
        if (producto) {
            // Llenar formulario con datos del producto
            this.fillProductForm(producto);
        } else {
            form.reset();
            document.getElementById('productId').value = '';
        }

        this.showModal('productFormModal');
    }

    fillProductForm(producto) {
        document.getElementById('productId').value = producto.id;
        document.getElementById('codigo').value = producto.codigo;
        document.getElementById('nombre').value = producto.nombre;
        document.getElementById('descripcion').value = producto.descripcion || '';
        document.getElementById('categoria_id').value = producto.categoria_id;
        document.getElementById('unidad_medida').value = producto.unidad_medida;
        document.getElementById('stock_actual').value = producto.stock_actual;
        document.getElementById('stock_minimo').value = producto.stock_minimo;
        document.getElementById('precio_cliente').value = producto.precio_cliente;
        document.getElementById('precio_proveedor').value = producto.precio_proveedor;
    }

    async handleProductSubmit(e) {
        e.preventDefault();
        
        try {
            const formData = new FormData(e.target);
            const productId = formData.get('productId');
            const token = localStorage.getItem('token');

            const url = productId ? `/api/products/${productId}` : '/api/products';
            const method = productId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Error al guardar producto');
            }

            this.showSuccess(productId ? 'Producto actualizado exitosamente' : 'Producto creado exitosamente');
            this.closeModal('productFormModal');
            this.loadProducts();
            
        } catch (error) {
            console.error('Error al guardar producto:', error);
            this.showError(error.message);
        }
    }

    showModal(modalId) {
        document.getElementById(modalId).style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        const grid = document.getElementById('productsGrid');
        
        if (show) {
            loading.style.display = 'block';
            grid.style.opacity = '0.5';
        } else {
            loading.style.display = 'none';
            grid.style.opacity = '1';
        }
    }

    showError(message) {
        // Crear y mostrar notificación de error
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
            <button onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    showSuccess(message) {
        // Crear y mostrar notificación de éxito
        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
            <button onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }
}

// Inicializar cuando la página esté cargada
let productManager;
document.addEventListener('DOMContentLoaded', () => {
    productManager = new ProductManager();
});

// Verificar autenticación
checkAuth();