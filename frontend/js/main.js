// Main JavaScript functionality for PaperTrail

// Global variables
const API_BASE = "https://papertrail-jdcp.onrender.com";
let currentSlide = 0;
let booksPerPage = 8;
let currentPage = 1;
let currentView = 'grid';
let currentFilters = { genre: '', year: '', author: '', priceRange: '', sortBy: 'title' };
let searchSuggestionTimeout = null;
// Keep CSRF token in a safe in-memory variable (not localStorage/sessionStorage)
let CSRF_TOKEN = null;

// Simple helper to escape text for safe insertion into HTML
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Fetch CSRF token, then check backend for authenticated user, then init app
    fetch(`${API_BASE}/api/csrf-token`, { credentials: 'include' })
        .then(async (res) => {
            if (res.ok) {
                const d = await res.json();
                CSRF_TOKEN = d.csrfToken;
            } else {
                CSRF_TOKEN = null;
            }
        }).catch(err => {
            console.warn('CSRF fetch failed', err);
            CSRF_TOKEN = null;
        }).finally(async () => {
            try {
                let res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
                if (res.status === 401) {
                    // try to refresh
                    const refreshHeaders = {};
                    if (CSRF_TOKEN) {
                        refreshHeaders['X-CSRF-Token'] = CSRF_TOKEN;
                    } else {
                        console.warn('CSRF token missing when attempting refresh');
                    }
                    const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, { method: 'POST', credentials: 'include', headers: refreshHeaders });
                    if (refreshRes.ok) {
                        res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
                    }
                }
                if (res.ok) {
                    const user = await res.json();
                    saveCurrentUser(user);
                } else {
                    saveCurrentUser(null);
                }
            } catch (err) {
                console.warn('Auth check failed', err);
                saveCurrentUser(null);
            } finally {
                initializeApp();
            }
        });
    initializeDarkMode();
});

function initializeApp() {
    initializeNavigation();
    initializeSearchSuggestions('searchInput', 'searchSuggestions', searchBooks);
    initializeHeaderSearch();
    // Attach event listeners for buttons that were moved out of inline handlers
    const headerSearchBtn = document.getElementById('headerSearchBtn');
    if (headerSearchBtn) headerSearchBtn.addEventListener('click', searchBooksHeader);
    const heroSearchBtn = document.getElementById('heroSearchBtn');
    if (heroSearchBtn) heroSearchBtn.addEventListener('click', searchBooks);
    
    if (document.getElementById('featuredCarousel')) {
        initializeCarousel();
        loadTrendingBooks();
        // Carousel controls (attached here to avoid inline onclicks)
        const prevBtn = document.getElementById('carouselPrev');
        const nextBtn = document.getElementById('carouselNext');
        if (prevBtn) prevBtn.addEventListener('click', () => changeSlide(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => changeSlide(1));
    }
    if (document.getElementById('booksContainer')) initializeExplorePage();
    if (document.getElementById('bookDetail')) initializeBookDetail();
    if (document.getElementById('addBookForm')) initializeAddBookPage();
    if (document.getElementById('loginForm')) initializeLoginPage();
    if (document.getElementById('contactForm')) initializeContactPage();
    if (document.getElementById('adminDashboard')) initializeAdminDashboard();
    if (document.getElementById('cartItems')) loadCart();
    if (document.getElementById('wishlistItems')) loadWishlist();
    if (document.getElementById('userProfile')) initializeUserProfile();
    
    updateCartCount();
    updateWishlistCount();
}

// Dark Mode Functionality
function initializeDarkMode() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') document.body.classList.add('dark-mode');
    
    const navRight = document.querySelector('.nav-right');
    const searchContainer = document.querySelector('.nav-search-container');
    if (navRight && searchContainer && !document.querySelector('.theme-toggle')) {
        const themeToggle = document.createElement('button');
        themeToggle.className = 'theme-toggle';
        themeToggle.addEventListener('click', toggleDarkMode);
        const icon = document.createElement('i');
        icon.className = `fas ${savedTheme === 'dark' ? 'fa-sun' : 'fa-moon'}`;
        icon.setAttribute('aria-hidden', 'true');
        const span = document.createElement('span');
        span.textContent = savedTheme === 'dark' ? 'Light' : 'Dark';
        themeToggle.appendChild(icon);
        themeToggle.appendChild(span);
        searchContainer.parentNode.insertBefore(themeToggle, searchContainer.nextSibling);
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    const toggleBtn = document.querySelector('.theme-toggle');
    if (toggleBtn) {
        const icon = toggleBtn.querySelector('i');
        const text = toggleBtn.querySelector('span');
        icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        text.textContent = isDark ? 'Light' : 'Dark';
    }
}

// Navigation functionality
function initializeNavigation() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => navMenu.classList.toggle('active'));
    }
    updateNavigation();
}

function updateNavigation() {
    const currentUser = getCurrentUser();
    const loginBtn = document.querySelector('.login-btn');
    const profileMenu = document.getElementById('profileMenu');
    const profileLink = profileMenu ? profileMenu.querySelector('.profile-link') : null;
    
    if (currentUser) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (profileLink) profileLink.classList.toggle('active', window.location.pathname.endsWith('profile.html'));
        if (profileMenu) profileMenu.style.display = 'block';
        currentUser.role === 'admin' ? showAdminLink() : hideAdminLink();
    } else {
        if (loginBtn) {
            loginBtn.textContent = 'Login/Signup';
            loginBtn.href = 'login.html';
            loginBtn.style.display = 'inline-block';
        }
        if (profileMenu) profileMenu.style.display = 'none';
        hideAdminLink();
    }
}

function showAdminLink() {
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu && !document.querySelector('.admin-link')) {
        const adminItem = document.createElement('li');
        adminItem.className = 'nav-item';
        adminItem.innerHTML = '<a href="admin.html" class="nav-link admin-link">Admin</a>';
        const profileMenu = document.getElementById('profileMenu');
        navMenu.insertBefore(adminItem, profileMenu || null);
    }
}

function hideAdminLink() {
    const adminLink = document.querySelector('.admin-link');
    if (adminLink && adminLink.parentElement) adminLink.parentElement.remove();
}

function logout() {
    document.querySelectorAll('.alert').forEach(alert => alert.remove());
    // Call backend logout to clear cookie
    const logoutHeaders = {};
    if (CSRF_TOKEN) {
        logoutHeaders['X-CSRF-Token'] = CSRF_TOKEN;
    } else {
        console.warn('CSRF token missing when attempting logout');
    }
    fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include', headers: logoutHeaders })
        .then(() => {
            saveCurrentUser(null);
            updateNavigation();
            updateCartCount();
            updateWishlistCount();
            showAlert('Logged out successfully', 'success');
            setTimeout(() => window.location.href = 'index.html', 1000);
        }).catch(err => {
            console.error('Logout error', err);
            saveCurrentUser(null);
            updateNavigation();
            showAlert('Logged out locally', 'info');
            setTimeout(() => window.location.href = 'index.html', 1000);
        });
}

// Carousel functionality
function initializeCarousel() {
    loadFeaturedCarousel();
    setInterval(() => changeSlide(1), 5000);
}

function loadFeaturedCarousel() {
    const carousel = document.getElementById('featuredCarousel');
    if (!carousel) return;
    
    const featuredBooks = getBooks().filter(book => book.featured).slice(0, 3);
    if (featuredBooks.length === 0) {
        carousel.innerHTML = '<div class="carousel-item active"><p>No featured books available</p></div>';
        return;
    }
    
    carousel.innerHTML = featuredBooks.map((book, index) => `
        <div class="carousel-item ${index === 0 ? 'active' : ''}" onclick="viewBookDetail(${book.id})" style="cursor: pointer;">
            <img src="${escapeHtml(book.cover)}" alt="${escapeHtml(book.title)}" loading="lazy" width="400" height="500">
            <div class="carousel-content">
                <h3>${escapeHtml(book.title)}</h3>
                <p>${escapeHtml(book.author)}</p>
                <div class="rating">
                    ${generateStars(book.rating)}
                    <span>${book.rating.toFixed(1)}</span>
                </div>
                <p class="carousel-description">${escapeHtml(book.description).substring(0, 150)}...</p>
                <div class="carousel-actions">
                    <button class="btn btn-primary" onclick="event.stopPropagation(); addToCart(${book.id})">
                        <i class="fas fa-cart-plus"></i> Add to Cart
                    </button>
                    <button class="btn btn-outline" onclick="event.stopPropagation(); addToWishlist(${book.id})">
                        <i class="fas fa-heart"></i> Wishlist
                    </button>
                </div>
            </div>
        </div>
    `).join('');
    
    currentSlide = 0;
}

function changeSlide(direction) {
    const carousel = document.getElementById('featuredCarousel');
    if (!carousel) return;
    const items = carousel.querySelectorAll('.carousel-item');
    if (items.length === 0) return;
    
    items[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + direction + items.length) % items.length;
    items[currentSlide].classList.add('active');
}

// Search functionality
function findBook(query) {
    const normalizedQuery = query.toLowerCase();
    return getBooks().find(book => 
        book.title.toLowerCase().includes(normalizedQuery) ||
        book.author.toLowerCase().includes(normalizedQuery) ||
        book.genre.toLowerCase().includes(normalizedQuery)
    );
}

function searchBooks() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    hideSearchSuggestions('searchSuggestions');
    const query = searchInput.value.trim();
    if (!query) {
        showAlert('Please enter a search term', 'info');
        return;
    }
    
    const foundBook = findBook(query);
    if (foundBook) {
        window.location.href = `book-detail.html?id=${foundBook.id}`;
    } else {
        showAlert(`Book not found: "${query}"`, 'error');
    }
}

function initializeSearchSuggestions(inputId, containerId, searchCallback) {
    const searchInput = document.getElementById(inputId);
    const suggestionContainer = document.getElementById(containerId);
    if (!searchInput || !suggestionContainer) return;

    const handleInput = (query) => updateSearchSuggestions(query, suggestionContainer);

    searchInput.addEventListener('input', function() {
        clearTimeout(searchSuggestionTimeout);
        searchSuggestionTimeout = setTimeout(() => handleInput(this.value.trim()), 150);
    });

    searchInput.addEventListener('focus', function() {
        if (suggestionContainer.children.length > 0) suggestionContainer.classList.add('visible');
    });

    searchInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            const firstSuggestion = suggestionContainer.querySelector('.suggestion-item:not(.empty)');
            if (suggestionContainer.classList.contains('visible') && firstSuggestion) {
                event.preventDefault();
                firstSuggestion.click();
            } else if (searchCallback) {
                event.preventDefault();
                searchCallback();
            }
        } else if (event.key === 'Escape') {
            hideSearchSuggestions(containerId);
        }
    });

    suggestionContainer.addEventListener('click', function(event) {
        const item = event.target.closest('.suggestion-item');
        if (!item || item.classList.contains('empty')) return;

        const bookId = item.dataset.id;
        const title = item.dataset.title;
        if (title) searchInput.value = title;
        hideSearchSuggestions(containerId);
        if (bookId) window.location.href = `book-detail.html?id=${bookId}`;
    });

    document.addEventListener('click', function(event) {
        if (!suggestionContainer.contains(event.target) && event.target !== searchInput) {
            hideSearchSuggestions(containerId);
        }
    });
}

function updateSearchSuggestions(query, container) {
    if (!container) return;
    if (!query) {
        container.innerHTML = '';
        container.classList.remove('visible');
        return;
    }

    const matches = getBooks().filter(book => {
        const normalizedQuery = query.toLowerCase();
        return book.title.toLowerCase().includes(normalizedQuery) ||
               book.author.toLowerCase().includes(normalizedQuery) ||
               book.genre.toLowerCase().includes(normalizedQuery);
    }).slice(0, 6);

    if (matches.length === 0) {
        container.innerHTML = '<div class="suggestion-item empty">No matches found</div>';
        container.classList.add('visible');
        return;
    }

    container.innerHTML = matches.map(book => `
        <div class="suggestion-item" data-id="${book.id}" data-title="${escapeHtml(book.title)}">
            <span class="suggestion-text">${highlightMatch(escapeHtml(book.title), query)}</span>
            <span class="suggestion-meta">by ${highlightMatch(escapeHtml(book.author), query)} | ${highlightMatch(escapeHtml(book.genre), query)}</span>
        </div>
    `).join('');
    container.classList.add('visible');
}

function hideSearchSuggestions(containerId) {
    const container = document.getElementById(containerId);
    if (container) container.classList.remove('visible');
}

function initializeHeaderSearch() {
    initializeSearchSuggestions('headerSearchInput', 'headerSearchSuggestions', searchBooksHeader);
}

function searchBooksHeader() {
    const searchInput = document.getElementById('headerSearchInput');
    if (!searchInput) return;
    
    hideSearchSuggestions('headerSearchSuggestions');
    const query = searchInput.value.trim();
    if (!query) {
        showAlert('Please enter a search term', 'info');
        return;
    }
    
    const foundBook = findBook(query);
    if (foundBook) {
        window.location.href = `book-detail.html?id=${foundBook.id}`;
    } else {
        sessionStorage.setItem('searchQuery', query);
        window.location.href = 'explore.html';
    }
}

function highlightMatch(text, query) {
    if (!text || !query) return text;
    const regex = new RegExp(`(${escapeRegExp(query)})`, 'ig');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Load trending books on homepage
function loadTrendingBooks() {
    const container = document.getElementById('trendingBooks');
    if (!container) return;
    const trendingBooks = getBooks().filter(book => book.trending).slice(0, 6);
    container.innerHTML = trendingBooks.map(book => createBookCard(book)).join('');
}

// Create book card HTML
function createBookCard(book) {
    return `
        <div class="book-card" onclick="viewBookDetail(${book.id})">
            <img src="${escapeHtml(book.cover)}" alt="${escapeHtml(book.title)}" loading="lazy" width="300" height="400">
            <div class="book-info">
                <h3>${escapeHtml(book.title)}</h3>
                <p>by ${escapeHtml(book.author)}</p>
                <div class="book-price">$${book.price.toFixed(2)}</div>
                <div class="book-rating">
                    ${generateStars(book.rating)}
                    <span>${book.rating} (${book.reviews} reviews)</span>
                </div>
                <div class="book-actions">
                    <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); addToCart(${book.id})">
                        <i class="fas fa-cart-plus"></i> Add to Cart
                    </button>
                    <button class="btn btn-outline btn-small" onclick="event.stopPropagation(); addToWishlist(${book.id})">
                        <i class="fas fa-heart"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function generateStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    let stars = '';
    for (let i = 0; i < fullStars; i++) stars += '<i class="fas fa-star"></i>';
    if (hasHalfStar) stars += '<i class="fas fa-star-half-alt"></i>';
    for (let i = 0; i < 5 - Math.ceil(rating); i++) stars += '<i class="far fa-star"></i>';
    return stars;
}

// Cart functionality
function addToCart(bookId) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        showLoginModal('cart', bookId);
        return;
    }
    
    const cart = getUserCart(currentUser.id);
    const book = getBooks().find(b => b.id === bookId);
    if (!book) {
        showAlert('Book not found', 'error');
        return;
    }
    
    const existingItem = cart.find(item => item.bookId === bookId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ bookId: bookId, quantity: 1, addedAt: new Date().toISOString() });
    }
    
    saveUserCart(currentUser.id, cart);
    updateCartCount();
    showAlert(`${book.title} added to cart`, 'success');
}

function removeFromCart(bookId) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const cart = getUserCart(currentUser.id);
    saveUserCart(currentUser.id, cart.filter(item => item.bookId !== bookId));
    updateCartCount();
    if (window.location.pathname.includes('cart.html')) loadCart();
}

function updateCartCount() {
    const currentUser = getCurrentUser();
    const cartCountElements = document.querySelectorAll('.cart-count');
    
    if (!currentUser) {
        cartCountElements.forEach(element => {
            element.textContent = 0;
            element.style.display = 'none';
        });
        return;
    }
    
    const totalItems = getUserCart(currentUser.id).reduce((sum, item) => sum + item.quantity, 0);
    cartCountElements.forEach(element => {
        element.textContent = totalItems;
        element.style.display = totalItems > 0 ? 'inline' : 'none';
    });
}

// Wishlist functionality
function addToWishlist(bookId) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        showLoginModal('wishlist', bookId);
        return;
    }
    
    const wishlist = getUserWishlist(currentUser.id);
    const book = getBooks().find(b => b.id === bookId);
    if (!book) {
        showAlert('Book not found', 'error');
        return;
    }
    
    if (wishlist.includes(bookId)) {
        showAlert('Book already in wishlist', 'info');
        return;
    }
    
    wishlist.push(bookId);
    saveUserWishlist(currentUser.id, wishlist);
    updateWishlistCount();
    showAlert(`${book.title} added to wishlist`, 'success');
}

function removeFromWishlist(bookId) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        showAlert('Please login to manage your wishlist', 'error');
        return;
    }
    
    const wishlist = getUserWishlist(currentUser.id);
    const updatedWishlist = wishlist.filter(id => id !== bookId);
    saveUserWishlist(currentUser.id, updatedWishlist);
    updateWishlistCount();
    showAlert('Book removed from wishlist', 'success');
    
    // Reload wishlist if on wishlist page
    if (window.location.pathname.includes('wishlist.html') || document.getElementById('wishlistItems')) {
        loadWishlist();
    }
}

function updateWishlistCount() {
    const currentUser = getCurrentUser();
    const wishlistCountElements = document.querySelectorAll('.wishlist-count');
    
    if (!currentUser) {
        wishlistCountElements.forEach(element => {
            element.textContent = 0;
            element.style.display = 'none';
        });
        return;
    }
    
    const count = getUserWishlist(currentUser.id).length;
    wishlistCountElements.forEach(element => {
        element.textContent = count;
        element.style.display = count > 0 ? 'inline' : 'none';
    });
}

// Book detail functionality
function viewBookDetail(bookId) {
    window.location.href = `book-detail.html?id=${bookId}`;
}

function initializeBookDetail() {
    const urlParams = new URLSearchParams(window.location.search);
    const bookId = parseInt(urlParams.get('id'));
    
    if (!bookId) {
        showAlert('Book not found', 'error');
        window.location.href = 'explore.html';
        return;
    }
    
    const book = getBooks().find(b => b.id === bookId);
    if (!book) {
        showAlert('Book not found', 'error');
        window.location.href = 'explore.html';
        return;
    }
    
    loadBookDetail(book);
    loadBookReviews(bookId);
    loadRelatedBooks(book);
}

function loadBookDetail(book) {
    const container = document.getElementById('bookDetail');
    if (!container) return;
    
    container.innerHTML = `
        <img src="${escapeHtml(book.cover)}" alt="${escapeHtml(book.title)}" loading="lazy" width="300" height="400">
        <div class="book-detail-info">
            <h1>${escapeHtml(book.title)}</h1>
            <p class="author">by ${escapeHtml(book.author)}</p>
            <div class="book-rating">
                ${generateStars(book.rating)}
                <span>${book.rating} (${book.reviews} reviews)</span>
            </div>
            <p class="description">${escapeHtml(book.description)}</p>
            <div class="book-detail-actions">
                <button class="btn btn-primary" onclick="addToCart(${book.id})">
                    <i class="fas fa-cart-plus"></i> Add to Cart - $${book.price}
                </button>
                <button class="btn btn-outline" onclick="addToWishlist(${book.id})">
                    <i class="fas fa-heart"></i> Add to Wishlist
                </button>
            </div>
        </div>
    `;
}

function loadBookReviews(bookId) {
    const reviews = getReviews().filter(review => review.bookId === bookId);
    const container = document.getElementById('reviewsSection');
    if (!container) return;
    
    const currentUser = getCurrentUser();
    const userHasReviewed = currentUser && reviews.some(r => r.userId === currentUser.id);
    
    let reviewsHTML = '';
    
    if (reviews.length === 0) {
        reviewsHTML = '<p>No reviews yet. Be the first to review this book!</p>';
    } else {
        reviewsHTML = reviews.map(review => {
            const user = getUsers().find(u => u.id === review.userId);
            const userName = user ? (user.name || user.username) : `User ${review.userId}`;
            return `
                <div class="review-item">
                    <div class="review-header">
                        <span class="review-author">${escapeHtml(userName)}</span>
                        <div class="review-rating">${generateStars(review.rating)}</div>
                    </div>
                    <p class="review-text">${escapeHtml(review.comment)}</p>
                    <small>${new Date(review.date).toLocaleDateString()}</small>
                </div>
            `;
        }).join('');
    }
    
    // Add review button
    if (currentUser) {
        if (userHasReviewed) {
            reviewsHTML = `
                <div style="margin-bottom: 20px;">
                    <button class="btn btn-outline" onclick="showAddReviewModal(${bookId})">
                        <i class="fas fa-edit"></i> Edit Your Review
                    </button>
                </div>
                ${reviewsHTML}
            `;
        } else {
            reviewsHTML = `
                <div style="margin-bottom: 20px;">
                    <button class="btn btn-primary" onclick="showAddReviewModal(${bookId})">
                        <i class="fas fa-star"></i> Add Your Review
                    </button>
                </div>
                ${reviewsHTML}
            `;
        }
    } else {
        reviewsHTML = `
            <div style="margin-bottom: 20px;">
                <button class="btn btn-primary" onclick="showLoginModal('review', ${bookId})">
                    <i class="fas fa-star"></i> Login to Add Review
                </button>
            </div>
            ${reviewsHTML}
        `;
    }
    
    container.innerHTML = reviewsHTML;
}

function loadRelatedBooks(book) {
    const relatedBooks = getBooks()
        .filter(b => b.id !== book.id && b.genre === book.genre)
        .slice(0, 4);
    
    const container = document.getElementById('relatedBooks');
    if (!container) return;
    
    container.innerHTML = relatedBooks.length === 0 
        ? '<p>No related books found.</p>'
        : `<h3>Related Books</h3>
           <div class="books-grid">
               ${relatedBooks.map(book => createBookCard(book)).join('')}
           </div>`;
}

// Explore page functionality
function initializeExplorePage() {
    // Ensure initial view state is set correctly
    const container = document.getElementById('booksContainer');
    if (container) {
        if (currentView === 'list') {
            container.classList.remove('books-grid');
            container.classList.add('books-list');
        } else {
            container.classList.remove('books-list');
            container.classList.add('books-grid');
        }
    }
    loadBooks();
    setupFilters();
    setupViewToggle();
    initializeExploreSearchSuggestions();
}

function searchBooksExplore() {
    const searchInput = document.getElementById('exploreSearchInput');
    if (!searchInput) return;
    
    hideSearchSuggestions('exploreSearchSuggestions');
    const query = searchInput.value.trim();
    if (!query) {
        sessionStorage.removeItem('searchQuery');
        currentPage = 1;
        loadBooks();
        return;
    }
    
    sessionStorage.setItem('searchQuery', query);
    currentPage = 1;
    loadBooks();
}

function initializeExploreSearchSuggestions() {
    initializeSearchSuggestions('exploreSearchInput', 'exploreSearchSuggestions', searchBooksExplore);
}

function loadBooks() {
    const container = document.getElementById('booksContainer');
    if (!container) return;
    
    let books = getBooks();
    
    const searchQuery = sessionStorage.getItem('searchQuery');
    if (searchQuery) {
        books = books.filter(book => {
            const query = searchQuery.toLowerCase();
            return book.title.toLowerCase().includes(query) ||
                   book.author.toLowerCase().includes(query) ||
                   book.genre.toLowerCase().includes(query);
        });
        sessionStorage.removeItem('searchQuery');
    }
    
    books = applyFilters(books);
    books = applySorting(books);
    
    if (!window.filteredBooks || currentPage === 1) window.filteredBooks = books;
    
    const startIndex = (currentPage - 1) * booksPerPage;
    const endIndex = startIndex + booksPerPage;
    const booksToShow = window.filteredBooks.slice(startIndex, endIndex);
    
    // Update container class based on current view
    if (currentView === 'list') {
        container.classList.remove('books-grid');
        container.classList.add('books-list');
    } else {
        container.classList.remove('books-list');
        container.classList.add('books-grid');
    }
    
    const createBookHTML = currentView === 'grid' ? createBookCard : createBookListItem;
    const booksHTML = booksToShow.map(book => createBookHTML(book)).join('');
    
    if (currentPage === 1) {
        container.innerHTML = booksHTML;
    } else {
        container.innerHTML += booksHTML;
    }
    
    updateLoadMoreButton(window.filteredBooks.length, endIndex);
}

function createBookListItem(book) {
    return `
        <div class="book-list-item" onclick="viewBookDetail(${book.id})">
            <img src="${book.cover}" alt="${book.title}" loading="lazy" width="300" height="400">
            <div class="book-list-content">
                <div class="book-list-info">
                    <h3>${book.title}</h3>
                    <p>by ${book.author}</p>
                    <p>${book.genre} • ${book.year}</p>
                    <div class="book-price">$${book.price.toFixed(2)}</div>
                    <div class="book-rating">
                        ${generateStars(book.rating)}
                        <span>${book.rating} (${book.reviews} reviews)</span>
                    </div>
                </div>
                <div class="book-list-actions">
                    <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); addToCart(${book.id})">
                        <i class="fas fa-cart-plus"></i> Add to Cart
                    </button>
                    <button class="btn btn-outline btn-small" onclick="event.stopPropagation(); addToWishlist(${book.id})">
                        <i class="fas fa-heart"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function setupFilters() {
    const filterConfig = [
        { id: 'genreFilter', key: 'genre', event: 'change' },
        { id: 'yearFilter', key: 'year', event: 'change' },
        { id: 'authorFilter', key: 'author', event: 'input' },
        { id: 'priceFilter', key: 'priceRange', event: 'change' },
        { id: 'sortFilter', key: 'sortBy', event: 'change' }
    ];
    
    filterConfig.forEach(config => {
        const filter = document.getElementById(config.id);
        if (filter) {
            filter.addEventListener(config.event, function() {
                currentFilters[config.key] = this.value;
                currentPage = 1;
                window.filteredBooks = null;
                loadBooks();
            });
        }
    });
}

function applyFilters(books) {
    let filteredBooks = [...books];
    
    if (currentFilters.genre) filteredBooks = filteredBooks.filter(book => book.genre === currentFilters.genre);
    if (currentFilters.year) filteredBooks = filteredBooks.filter(book => book.year.toString() === currentFilters.year);
    if (currentFilters.author) {
        filteredBooks = filteredBooks.filter(book => 
            book.author.toLowerCase().includes(currentFilters.author.toLowerCase())
        );
    }
    if (currentFilters.priceRange) {
        const [min, max] = currentFilters.priceRange.split('-').map(Number);
        filteredBooks = filteredBooks.filter(book => max ? book.price >= min && book.price <= max : book.price >= min);
    }
    
    return filteredBooks;
}

function applySorting(books) {
    const sortedBooks = [...books];
    const sortOptions = {
        'title': (a, b) => a.title.localeCompare(b.title),
        'author': (a, b) => a.author.localeCompare(b.author),
        'year': (a, b) => b.year - a.year,
        'price-low': (a, b) => a.price - b.price,
        'price-high': (a, b) => b.price - a.price,
        'rating': (a, b) => b.rating - a.rating
    };
    
    return sortOptions[currentFilters.sortBy] 
        ? sortedBooks.sort(sortOptions[currentFilters.sortBy])
        : sortedBooks;
}

function setupViewToggle() {
    const gridBtn = document.getElementById('gridView');
    const listBtn = document.getElementById('listView');
    
    if (gridBtn) {
        gridBtn.addEventListener('click', function() {
            currentView = 'grid';
            currentPage = 1;
            window.filteredBooks = null;
            gridBtn.classList.add('active');
            if (listBtn) listBtn.classList.remove('active');
            loadBooks();
        });
    }
    
    if (listBtn) {
        listBtn.addEventListener('click', function() {
            currentView = 'list';
            currentPage = 1;
            window.filteredBooks = null;
            listBtn.classList.add('active');
            if (gridBtn) gridBtn.classList.remove('active');
            loadBooks();
        });
    }
}

function loadMoreBooks() {
    currentPage++;
    loadBooks();
}

function updateLoadMoreButton(totalBooks, currentEndIndex) {
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (!loadMoreBtn) return;
    loadMoreBtn.style.display = currentEndIndex >= totalBooks ? 'none' : 'block';
}

// Utility functions
function showAlert(message, type = 'info') {
    document.querySelectorAll('.alert').forEach(alert => alert.remove());
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    const container = document.querySelector('.container') || document.body;
    container.insertBefore(alert, container.firstChild);
    
    setTimeout(() => alert.remove(), 5000);
}

function isValidUrl(value) {
    if (!value) return false;
    try {
        new URL(value);
        return true;
    } catch (e) {
        return false;
    }
}


function initializeAddBookPage() {
    const currentUser = getCurrentUser();
    console.log('initializeAddBookPage, currentUser =', currentUser);

    const loginRequired = document.getElementById('loginRequired');
    const addBookSection = document.getElementById('addBookSection');
    const myBooksSection = document.getElementById('myBooksSection');
    const form = document.getElementById('addBookForm');

    if (!currentUser || (currentUser.role !== 'author' && currentUser.role !== 'admin')) {
        if (loginRequired) {
            loginRequired.classList.remove('hidden');
            if (currentUser && currentUser.role !== 'author' && currentUser.role !== 'admin') {
                const msg = loginRequired.querySelector('.alert-info p');
                if (msg) {
                    msg.textContent = 'You need author privileges to add books to the library.';
                }
            }
        }
        return;
    }

    if (loginRequired) loginRequired.classList.add('hidden');
    if (addBookSection) addBookSection.classList.remove('hidden');
    if (myBooksSection) myBooksSection.classList.remove('hidden');

    if (form) {
        console.log('Attaching submit listener to addBookForm');
        form.addEventListener('submit', handleAddBook);
    }

    loadUserBooks();
}


function handleAddBook(e) {
    e.preventDefault();
    console.log("handleAddBook fired");

    const currentUser = getCurrentUser();
    if (!currentUser || (currentUser.role !== 'author' && currentUser.role !== 'admin')) {
        showAlert("You must be an author or admin to add books.", "error");
        return;
    }

    const form = e.target;
    const formData = new FormData(form);
    const editingBookId = form.dataset.editingId || null;
    const books = getBooks();

    const title = (formData.get('title') || "").trim();
    const author = (formData.get('author') || "").trim();
    const genre = formData.get('genre') || "";
    const yearStr = formData.get('year') || "";
    const priceStr = formData.get('price') || "";
    const description = (formData.get('description') || "").trim();
    const coverFile = formData.get("cover");

    if (!title || !author || !genre || !yearStr || !priceStr || !description) {
        showAlert("Please fill in all required fields.", "error");
        return;
    }

    const year = parseInt(yearStr, 10);
    if (isNaN(year) || year < 1800 || year > 2024) {
        showAlert("Year must be between 1800 and 2024.", "error");
        return;
    }

    const price = parseFloat(priceStr);
    if (isNaN(price) || price < 0) {
        showAlert("Price must be non-negative.", "error");
        return;
    }

    // FUNCTION TO FINISH SAVING THE BOOK ONCE COVER IS READY
    function saveBook(coverBase64) {
        let newId;
        if (editingBookId) {
            newId = parseInt(editingBookId, 10);
        } else {
            const maxId = books.length > 0
                ? Math.max(...books.map(b => b.id || 0))
                : 0;
            newId = maxId + 1;
        }

        const bookData = {
            id: newId,
            title,
            author,
            genre,
            year,
            price,
            description,
            cover: coverBase64,
            rating: 0,
            reviews: 0,
            featured: false,
            trending: false,
            addedBy: currentUser.id
        };

        if (editingBookId) {
            const index = books.findIndex(b => b.id === newId);
            if (index !== -1) {
                bookData.rating = books[index].rating || 0;
                bookData.reviews = books[index].reviews || 0;
                books[index] = bookData;
                showAlert("Book updated successfully!", "success");
            }
        } else {
            books.push(bookData);
            showAlert("Book added successfully!", "success");
        }

        saveBooks(books);
        console.log("Books saved:", books);

        form.reset();
        delete form.dataset.editingId;
        loadUserBooks();
    }

    // IF USER UPLOADED A FILE → READ IT
    if (coverFile && coverFile.size > 0) {
        const reader = new FileReader();
        reader.onload = function (e) {
            saveBook(e.target.result); // Base64 string
        };
        reader.readAsDataURL(coverFile);
    } else {
        // NO FILE — USE DEFAULT PLACEHOLDER
        saveBook("BookCovers/default-placeholder.jpeg");
    }
}




function loadUserBooks() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const userBooks = getBooks().filter(book => 
        (book.addedBy && book.addedBy === currentUser.id) || (book.author === currentUser.name)
    );
    
    const container = document.getElementById('myBooksList');
    if (!container) return;
    
    if (userBooks.length === 0) {
        container.innerHTML = '<p>You haven\'t added any books yet. Use the form above to add your first book!</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="books-grid">
            ${userBooks.map(book => `
                <div class="book-card">
                    <img src="${book.cover}" alt="${book.title}" loading="lazy" width="300" height="400" onclick="viewBookDetail(${book.id})">
                    <div class="book-info">
                        <h3 onclick="viewBookDetail(${book.id})" style="cursor: pointer;">${book.title}</h3>
                        <p>by ${book.author}</p>
                        <p>${book.genre} • ${book.year}</p>
                        <div class="book-price">$${book.price.toFixed(2)}</div>
                        <div class="book-rating">
                            ${generateStars(book.rating || 0)}
                            <span>${(book.rating || 0).toFixed(1)} (${book.reviews || 0} reviews)</span>
                        </div>
                        <div class="book-actions">
                            <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); editBook(${book.id})">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); deleteBook(${book.id})">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function editBook(bookId) {
    const book = getBooks().find(b => b.id === bookId);
    if (!book) {
        showAlert('Book not found', 'error');
        return;
    }
    
    const form = document.getElementById('addBookForm');
    document.getElementById('bookTitle').value = book.title;
    document.getElementById('bookAuthor').value = book.author;
    document.getElementById('bookGenre').value = book.genre;
    document.getElementById('bookYear').value = book.year;
    document.getElementById('bookPrice').value = book.price;
    document.getElementById('bookDescription').value = book.description;
    document.getElementById('bookCover').value = book.cover || '';
    
    form.dataset.editingId = bookId;
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Book';
    form.scrollIntoView({ behavior: 'smooth' });
    showAlert('Book data loaded for editing. Update the form and submit to save changes.', 'info');
}

function deleteBook(bookId) {
    if (!confirm('Are you sure you want to delete this book?')) return;
    
    const books = getBooks();
    saveBooks(books.filter(b => b.id !== bookId));
    showAlert('Book deleted successfully', 'success');
    loadUserBooks();
}

// Login Page Functionality
function initializeLoginPage() {
    const loginForm = document.getElementById('loginFormElement');
    const signupForm = document.getElementById('signupFormElement');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
        
        // Clear errors on input
        const fields = signupForm.querySelectorAll('input, select');
        fields.forEach(field => {
            field.addEventListener('input', function() {
                if (this.style.borderColor === 'rgb(231, 76, 60)' || this.style.borderColor === '#e74c3c') {
                    this.style.borderColor = '';
                    const error = this.parentElement.querySelector('.field-error');
                    if (error) {
                        error.remove();
                    }
                }
            });
        });
    }
}

function handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const rawUsername = formData.get('username') || '';
    const rawPassword = formData.get('password') || '';

    const username = rawUsername.trim();
    const password = rawPassword;

    if (!username || !password) {
        showAlert('Please enter both username or email and password.', 'error');
        return;
    }

    // Call backend login endpoint
    const loginHeaders = { 'Content-Type': 'application/json' };
    if (CSRF_TOKEN) {
        loginHeaders['X-CSRF-Token'] = CSRF_TOKEN;
    } else {
        console.warn('CSRF token missing when attempting login');
    }
    fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: loginHeaders,
        credentials: 'include',
        body: JSON.stringify({ usernameOrEmail: username, password })
    }).then(async res => {
        const data = await res.json();
        if (!res.ok) {
            showAlert(data.error || 'Login failed', 'error');
            return;
        }
        // Save returned user data and update UI
        saveCurrentUser(data);
        showAlert('Login successful!', 'success');
        updateNavigation();
        updateCartCount();
        updateWishlistCount();
        setTimeout(function () { window.location.href = 'index.html'; }, 1000);
    }).catch(err => {
        console.error('Login fetch error', err);
        showAlert('Login failed (network error)', 'error');
    });
}


function getNextUserId() {
    const users = getUsers();
    const maxId = users.length > 0 ? Math.max(...users.map(user => user.id || 0)) : 0;
    return maxId + 1;
}

function getNextMessageId() {
    const messages = getMessages();
    const maxId = messages.length > 0 ? Math.max(...messages.map(msg => msg.id || 0)) : 0;
    return maxId + 1;
}

function getNextReviewId() {
    const reviews = getReviews();
    const maxId = reviews.length > 0 ? Math.max(...reviews.map(review => review.id || 0)) : 0;
    return maxId + 1;
}

function handleSignup(e) {
    e.preventDefault();
    
    // Clear previous error messages
    clearSignupErrors();
    
    const formData = new FormData(e.target);
    const name = formData.get('name')?.trim();
    const username = formData.get('username')?.trim();
    const email = formData.get('email')?.trim();
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');
    const role = formData.get('role');
    
    let hasErrors = false;
    
    // Validate name
    if (!name) {
        showFieldError('signupName', 'Full name is required');
        hasErrors = true;
    } else if (name.length < 2) {
        showFieldError('signupName', 'Full name must be at least 2 characters');
        hasErrors = true;
    }
    
    // Validate username
    if (!username) {
        showFieldError('signupUsername', 'Username is required');
        hasErrors = true;
    } else if (username.length < 3) {
        showFieldError('signupUsername', 'Username must be at least 3 characters');
        hasErrors = true;
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        showFieldError('signupUsername', 'Username can only contain letters, numbers, and underscores');
        hasErrors = true;
    } else {
        const users = getUsers();
        if (users.find(u => u.username === username)) {
            showFieldError('signupUsername', 'Username already exists');
            hasErrors = true;
        }
    }
    
    // Validate email
    if (!email) {
        showFieldError('signupEmail', 'Email is required');
        hasErrors = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showFieldError('signupEmail', 'Please enter a valid email address');
        hasErrors = true;
    } else {
        const users = getUsers();
        if (users.find(u => u.email === email)) {
            showFieldError('signupEmail', 'Email already exists');
            hasErrors = true;
        }
    }
    
    // Validate password
    if (!password) {
        showFieldError('signupPassword', 'Password is required');
        hasErrors = true;
    } else if (password.length < 6) {
        showFieldError('signupPassword', 'Password must be at least 6 characters');
        hasErrors = true;
    }
    
    // Validate confirm password
    if (!confirmPassword) {
        showFieldError('signupConfirmPassword', 'Please confirm your password');
        hasErrors = true;
    } else if (password && password !== confirmPassword) {
        showFieldError('signupConfirmPassword', 'Passwords do not match');
        hasErrors = true;
    }
    
    // Validate role
    if (!role) {
        showFieldError('signupRole', 'Please select an account type');
        hasErrors = true;
    }
    
    if (hasErrors) {
        return;
    }
    
    // Call backend register endpoint
    const registerHeaders = { 'Content-Type': 'application/json' };
    if (CSRF_TOKEN) {
        registerHeaders['X-CSRF-Token'] = CSRF_TOKEN;
    } else {
        console.warn('CSRF token missing when attempting registration');
    }
    fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: registerHeaders,
        credentials: 'include',
        body: JSON.stringify({ name, username, email, password, role })
    }).then(async res => {
        const data = await res.json();
        if (!res.ok) {
            showAlert(data.error || 'Registration failed', 'error');
            return;
        }

        if (role === 'author') {
            showAlert('Account created successfully! Your author account is pending admin approval. Please login.', 'info');
        } else {
            showAlert('Account created successfully! Please login.', 'success');
        }
        showLoginForm();
        e.target.reset();
    }).catch(err => {
        console.error('Register fetch error', err);
        showAlert('Registration failed (network error)', 'error');
    });
}

function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    
    // Remove existing error message
    const existingError = field.parentElement.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
    
    // Add error styling
    field.style.borderColor = '#e74c3c';
    
    // Add error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.style.color = '#e74c3c';
    errorDiv.style.fontSize = '0.875rem';
    errorDiv.style.marginTop = '5px';
    errorDiv.textContent = message;
    field.parentElement.appendChild(errorDiv);
}

function clearSignupErrors() {
    const form = document.getElementById('signupFormElement');
    if (!form) return;
    
    const fields = form.querySelectorAll('input, select');
    fields.forEach(field => {
        field.style.borderColor = '';
        const error = field.parentElement.querySelector('.field-error');
        if (error) {
            error.remove();
        }
    });
}

function showLoginForm() {
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('signupForm').classList.add('hidden');
}

function showSignupForm() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('signupForm').classList.remove('hidden');
}

function fillDemoLogin(username, password) {
    document.getElementById('loginUsername').value = username;
    document.getElementById('loginPassword').value = password;
}

// Contact Page Functionality
function initializeContactPage() {
    const form = document.getElementById('contactForm');
    if (form) form.addEventListener('submit', handleContactForm);
}

function handleContactForm(e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);

    const name = (formData.get('name') || '').trim();
    const email = (formData.get('email') || '').trim();
    const subject = (formData.get('subject') || '').trim() || 'General Inquiry';
    const message = (formData.get('message') || '').trim();

    const errors = [];

    if (!name || name.length < 2) {
        errors.push('Please enter your full name.');
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        errors.push('Please provide a valid email address.');
    }

    if (!message || message.length < 10) {
        errors.push('Message should be at least 10 characters.');
    }

    if (errors.length > 0) {
        showAlert(errors.join(' '), 'error');
        return;
    }

    const messageData = {
        id: getNextMessageId(),
        name,
        email,
        subject,
        message,
        date: new Date().toISOString(),
        status: 'unread'
    };

    const messages = getMessages();
    messages.push(messageData);
    saveMessages(messages);

    showAlert('Message sent successfully! We\'ll get back to you soon.', 'success');
    form.reset();
}


// Cart Page Functionality
function loadCart() {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
        document.getElementById('loginRequired').classList.remove('hidden');
        return;
    }
    
    document.getElementById('cartContent').classList.remove('hidden');
    
    const cart = getUserCart(currentUser.id);
    const books = getBooks();
    
    if (cart.length === 0) {
        document.getElementById('emptyCart').classList.remove('hidden');
        document.getElementById('cartContent').classList.add('hidden');
        return;
    }
    
    const cartItems = cart.map(item => {
        const book = books.find(b => b.id === item.bookId);
        return { ...item, book };
    }).filter(item => item.book);
    
    const container = document.getElementById('cartItems');
    container.innerHTML = cartItems.map(item => `
        <div class="cart-item">
            <img src="${item.book.cover}" alt="${item.book.title}" loading="lazy" width="150" height="200">
            <div class="cart-item-info">
                <h3>${item.book.title}</h3>
                <p>by ${item.book.author}</p>
                <p class="price">$${item.book.price}</p>
            </div>
            <div class="cart-item-controls">
                <button onclick="updateCartQuantity(${item.bookId}, ${item.quantity - 1})">-</button>
                <span>${item.quantity}</span>
                <button onclick="updateCartQuantity(${item.bookId}, ${item.quantity + 1})">+</button>
                <button class="btn btn-secondary btn-small" onclick="removeFromCart(${item.bookId})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    const total = cartItems.reduce((sum, item) => sum + (item.book.price * item.quantity), 0);
    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    
    document.getElementById('cartSummary').innerHTML = `
        <div class="cart-summary-content">
            <h3>Order Summary</h3>
            <div class="summary-row">
                <span>Items (${totalItems}):</span>
                <span>$${total.toFixed(2)}</span>
            </div>
            <div class="summary-row">
                <span>Shipping:</span>
                <span>Free</span>
            </div>
            <div class="summary-row total">
                <span>Total:</span>
                <span>$${total.toFixed(2)}</span>
            </div>
            <button class="btn btn-primary btn-full" onclick="checkout()">
                <i class="fas fa-credit-card"></i> Proceed to Checkout
            </button>
        </div>
    `;
}

function updateCartQuantity(bookId, newQuantity) {
    if (newQuantity <= 0) {
        removeFromCart(bookId);
        return;
    }
    
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const cart = getUserCart(currentUser.id);
    const item = cart.find(item => item.bookId === bookId);
    if (item) {
        item.quantity = newQuantity;
        saveUserCart(currentUser.id, cart);
        updateCartCount();
        loadCart();
    }
}

function checkout() {
    showAlert('Checkout functionality would be implemented with a payment system.', 'info');
}

// Wishlist Page Functionality
function createWishlistBookCard(book) {
    return `
        <div class="book-card" onclick="viewBookDetail(${book.id})">
            <img src="${book.cover}" alt="${book.title}" loading="lazy" width="300" height="400">
            <div class="book-info">
                <h3>${book.title}</h3>
                <p>by ${book.author}</p>
                <div class="book-price">$${book.price.toFixed(2)}</div>
                <div class="book-rating">
                    ${generateStars(book.rating)}
                    <span>${book.rating} (${book.reviews} reviews)</span>
                </div>
                <div class="book-actions">
                    <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); addToCart(${book.id})">
                        <i class="fas fa-cart-plus"></i> Add to Cart
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); removeFromWishlist(${book.id})">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
            </div>
        </div>
    `;
}

function loadWishlist() {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
        document.getElementById('loginRequired').classList.remove('hidden');
        return;
    }
    
    document.getElementById('wishlistContent').classList.remove('hidden');
    
    const wishlist = getUserWishlist(currentUser.id);
    const books = getBooks();
    
    if (wishlist.length === 0) {
        document.getElementById('emptyWishlist').classList.remove('hidden');
        document.getElementById('wishlistContent').classList.add('hidden');
        return;
    }
    
    const wishlistBooks = wishlist.map(bookId => books.find(b => b.id === bookId)).filter(book => book);
    
    const container = document.getElementById('wishlistItems');
    container.innerHTML = wishlistBooks.map(book => createWishlistBookCard(book)).join('');
    
    if (wishlistBooks.length > 0) loadRecommendedBooks(wishlistBooks);
}

function loadRecommendedBooks(wishlistBooks) {
    const allBooks = getBooks();
    const wishlistIds = wishlistBooks.map(b => b.id);
    const genres = [...new Set(wishlistBooks.map(b => b.genre))];
    
    let recommended = allBooks
        .filter(book => !wishlistIds.includes(book.id) && genres.includes(book.genre))
        .slice(0, 6);
    
    if (recommended.length < 6) {
        const popular = allBooks
            .filter(book => !wishlistIds.includes(book.id) && book.trending)
            .slice(0, 6 - recommended.length);
        recommended.push(...popular);
    }
    
    if (recommended.length < 6) {
        const additional = allBooks
            .filter(book => !wishlistIds.includes(book.id) && !recommended.find(r => r.id === book.id))
            .slice(0, 6 - recommended.length);
        recommended.push(...additional);
    }
    
    const existingSection = document.querySelector('.recommended-section');
    if (existingSection) existingSection.remove();
    
    if (recommended.length > 0 && wishlistBooks.length > 0) {
        const recommendedSection = document.createElement('div');
        recommendedSection.className = 'recommended-section';
        recommendedSection.innerHTML = `
            <h2>Recommended For You</h2>
            <p style="text-align: center; margin-bottom: 30px; color: var(--text-color); opacity: 0.8;">Based on your wishlist, you might also like:</p>
            <div class="books-grid">
                ${recommended.map(book => createBookCard(book)).join('')}
            </div>
        `;
        
        const container = document.getElementById('wishlistItems');
        if (container && container.parentNode) {
            container.parentNode.insertBefore(recommendedSection, container.nextSibling);
        }
    }
}

// Admin Dashboard Functionality
function initializeAdminDashboard() {
    const currentUser = getCurrentUser();
    
    if (!currentUser || currentUser.role !== 'admin') {
        document.getElementById('accessDenied').classList.remove('hidden');
        return;
    }
    
    loadAdminStats();
    loadAdminUsers();
    loadAdminBooks();
    loadAdminMessages();
    loadAdminReviews();
    loadPendingAuthors();
}

function showAdminSection(eventOrSection, maybeSection) {
    const isEventPassed = typeof eventOrSection !== 'string';
    const event = isEventPassed ? eventOrSection : null;
    const section = isEventPassed ? maybeSection : eventOrSection;
    
    if (!section) return;
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    
    document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
    const sectionElement = document.getElementById(`${section}Section`);
    if (sectionElement) sectionElement.classList.remove('hidden');
    
    document.querySelectorAll('.admin-nav a').forEach(a => a.classList.remove('active'));
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    } else {
        const link = document.querySelector(`.admin-nav a[data-section="${section}"]`);
        if (link) link.classList.add('active');
    }
}

function loadAdminStats() {
    const pendingAuthors = getUsers().filter(u => u.role === 'author' && !u.authorApproved).length;
    const stats = [
        { title: 'Total Books', value: getBooks().length, icon: 'fas fa-book' },
        { title: 'Total Users', value: getUsers().length, icon: 'fas fa-users' },
        { title: 'Pending Authors', value: pendingAuthors, icon: 'fas fa-user-clock', highlight: pendingAuthors > 0 },
        { title: 'Messages', value: getMessages().length, icon: 'fas fa-envelope' },
        { title: 'Reviews', value: getReviews().length, icon: 'fas fa-star' }
    ];
    
    const container = document.getElementById('adminStats');
    container.innerHTML = stats.map(stat => `
        <div class="stat-card ${stat.highlight ? 'stat-highlight' : ''}">
            <i class="${stat.icon}"></i>
            <h3>${stat.value}</h3>
            <p>${stat.title}</p>
        </div>
    `).join('');
}

// Generic admin table loader
function loadAdminTable(containerId, data, columns, emptyMessage) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (data.length === 0) {
        container.innerHTML = `<tr><td colspan="${columns.length + 1}" style="text-align: center;">${emptyMessage}</td></tr>`;
        return;
    }
    
    container.innerHTML = data.map(item => {
        const cells = columns.map(col => {
            if (typeof col.render === 'function') return col.render(item);
            return `<td>${item[col.key] || 'N/A'}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
    }).join('');
}

function loadAdminUsers() {
    const users = getUsers();
    loadAdminTable('usersTable', users, [
        { key: 'id' },
        { key: 'name' },
        { key: 'username' },
        { key: 'email' },
        { 
            key: 'role',
            render: (user) => {
                const role = (user.role || 'reader').toLowerCase();
                const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
                return `<td><span class="role-badge role-${role}">${roleLabel}</span></td>`;
            }
        },
        {
            key: 'actions',
            render: (user) => `
                <td>
                    <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); viewUserDetail(${user.id})" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); deleteAdminItem('user', ${user.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `
        }
    ], 'No users found');
    
    // Make table rows clickable
    const table = document.getElementById('usersTable');
    if (table) {
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            row.style.cursor = 'pointer';
            row.addEventListener('click', function(e) {
                if (!e.target.closest('button')) {
                    const idCell = row.querySelector('td:first-child');
                    if (idCell) {
                        const id = parseInt(idCell.textContent);
                        viewUserDetail(id);
                    }
                }
            });
        });
    }
}

function loadAdminBooks() {
    const books = getBooks();
    loadAdminTable('booksTable', books, [
        { key: 'id' },
        { key: 'title' },
        { key: 'author' },
        { key: 'genre' },
        { key: 'year' },
        { 
            key: 'price',
            render: (book) => `<td>$${(Number(book.price) || 0).toFixed(2)}</td>`
        },
        {
            key: 'rating',
            render: (book) => {
                const rating = Number(book.rating) || 0;
                const reviewsCount = Number(book.reviews) || 0;
                return `<td>${rating.toFixed(1)} (${reviewsCount} reviews)</td>`;
            }
        },
        {
            key: 'actions',
            render: (book) => `
                <td>
                    <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); viewBookDetailAdmin(${book.id})" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); deleteAdminItem('book', ${book.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `
        }
    ], 'No books found');
    
    // Make table rows clickable
    const table = document.getElementById('booksTable');
    if (table) {
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            row.style.cursor = 'pointer';
            row.addEventListener('click', function(e) {
                if (!e.target.closest('button')) {
                    const idCell = row.querySelector('td:first-child');
                    if (idCell) {
                        const id = parseInt(idCell.textContent);
                        viewBookDetailAdmin(id);
                    }
                }
            });
        });
    }
}

function loadAdminMessages() {
    const messages = getMessages();
    loadAdminTable('messagesTable', messages, [
        { key: 'id' },
        { key: 'name' },
        { key: 'email' },
        { key: 'subject' },
        {
            key: 'message',
            render: (msg) => {
                const text = msg.message || '';
                return `<td style="cursor: pointer;" onclick="viewMessageDetail(${msg.id})">${text.substring(0, 50)}${text.length > 50 ? '...' : ''}</td>`;
            }
        },
        {
            key: 'date',
            render: (msg) => `<td>${msg.date ? new Date(msg.date).toLocaleDateString() : 'N/A'}</td>`
        },
        {
            key: 'status',
            render: (msg) => {
                const status = (msg.status || 'unread').toLowerCase();
                const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
                return `<td><span class="status-badge status-${status}">${statusLabel}</span></td>`;
            }
        },
        {
            key: 'actions',
            render: (msg) => `
                <td>
                    <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); viewMessageDetail(${msg.id})" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); markMessageRead(${msg.id})" title="Mark as read">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); deleteAdminItem('message', ${msg.id})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `
        }
    ], 'No messages found');
    
    // Make table rows clickable
    const table = document.getElementById('messagesTable');
    if (table) {
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            row.style.cursor = 'pointer';
            row.addEventListener('click', function(e) {
                if (!e.target.closest('button') && !e.target.closest('td[onclick]')) {
                    const idCell = row.querySelector('td:first-child');
                    if (idCell) {
                        const id = parseInt(idCell.textContent);
                        viewMessageDetail(id);
                    }
                }
            });
        });
    }
}

function loadAdminReviews() {
    const reviews = getReviews();
    const books = getBooks();
    const users = getUsers();
    
    loadAdminTable('reviewsTable', reviews, [
        { key: 'id' },
        {
            key: 'book',
            render: (review) => {
                const book = books.find(b => b.id === review.bookId);
                return `<td>${book ? book.title : 'Unknown Book'}</td>`;
            }
        },
        {
            key: 'user',
            render: (review) => {
                const user = users.find(u => u.id === review.userId);
                return `<td>${user ? user.name || user.username : `User ${review.userId || 'N/A'}`}</td>`;
            }
        },
        {
            key: 'rating',
            render: (review) => `<td>${generateStars(review.rating || 0)}</td>`
        },
        {
            key: 'comment',
            render: (review) => {
                const text = review.comment || '';
                return `<td style="cursor: pointer;" onclick="viewReviewDetail(${review.id})">${text.substring(0, 50)}${text.length > 50 ? '...' : ''}</td>`;
            }
        },
        {
            key: 'date',
            render: (review) => `<td>${review.date ? new Date(review.date).toLocaleDateString() : 'N/A'}</td>`
        },
        {
            key: 'actions',
            render: (review) => `
                <td>
                    <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); viewReviewDetail(${review.id})" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); deleteAdminItem('review', ${review.id})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `
        }
    ], 'No reviews found');
    
    // Make table rows clickable
    const table = document.getElementById('reviewsTable');
    if (table) {
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            row.style.cursor = 'pointer';
            row.addEventListener('click', function(e) {
                if (!e.target.closest('button') && !e.target.closest('td[onclick]')) {
                    const idCell = row.querySelector('td:first-child');
                    if (idCell) {
                        const id = parseInt(idCell.textContent);
                        viewReviewDetail(id);
                    }
                }
            });
        });
    }
}

// Modal functions for viewing messages and reviews
function viewMessageDetail(messageId) {
    const messages = getMessages();
    const message = messages.find(m => m.id === messageId);
    if (!message) {
        showAlert('Message not found', 'error');
        return;
    }
    
    const modal = document.getElementById('adminModal');
    const modalBody = document.getElementById('adminModalBody');
    if (!modal || !modalBody) return;
    
    const status = (message.status || 'unread').toLowerCase();
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
    
    modalBody.innerHTML = `
        <h2>Message Details</h2>
        <div class="admin-modal-info">
            <div class="modal-info-row">
                <label>ID:</label>
                <span>${message.id}</span>
            </div>
            <div class="modal-info-row">
                <label>Name:</label>
                <span>${message.name || 'N/A'}</span>
            </div>
            <div class="modal-info-row">
                <label>Email:</label>
                <span><a href="mailto:${message.email}">${message.email || 'N/A'}</a></span>
            </div>
            <div class="modal-info-row">
                <label>Subject:</label>
                <span>${message.subject || 'General Inquiry'}</span>
            </div>
            <div class="modal-info-row">
                <label>Date:</label>
                <span>${message.date ? new Date(message.date).toLocaleString() : 'N/A'}</span>
            </div>
            <div class="modal-info-row">
                <label>Status:</label>
                <span class="status-badge status-${status}">${statusLabel}</span>
            </div>
            <div class="modal-info-row full-width">
                <label>Message:</label>
                <div class="modal-message-content">${(message.message || 'No message content').replace(/\n/g, '<br>')}</div>
            </div>
        </div>
        <div class="modal-actions">
            <button class="btn btn-primary" onclick="markMessageRead(${message.id}); closeAdminModal(); loadAdminMessages();">
                <i class="fas fa-check"></i> Mark as Read
            </button>
            <button class="btn btn-secondary" onclick="closeAdminModal()">
                <i class="fas fa-times"></i> Close
            </button>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

function viewReviewDetail(reviewId) {
    const reviews = getReviews();
    const books = getBooks();
    const users = getUsers();
    const review = reviews.find(r => r.id === reviewId);
    if (!review) {
        showAlert('Review not found', 'error');
        return;
    }
    
    const book = books.find(b => b.id === review.bookId);
    const user = users.find(u => u.id === review.userId);
    
    const modal = document.getElementById('adminModal');
    const modalBody = document.getElementById('adminModalBody');
    if (!modal || !modalBody) return;
    
    modalBody.innerHTML = `
        <h2>Review Details</h2>
        <div class="admin-modal-info">
            <div class="modal-info-row">
                <label>ID:</label>
                <span>${review.id}</span>
            </div>
            <div class="modal-info-row">
                <label>Book:</label>
                <span>${book ? book.title : 'Unknown Book'}</span>
            </div>
            <div class="modal-info-row">
                <label>Author:</label>
                <span>${book ? book.author : 'N/A'}</span>
            </div>
            <div class="modal-info-row">
                <label>User:</label>
                <span>${user ? (user.name || user.username) : `User ${review.userId || 'N/A'}`}</span>
            </div>
            <div class="modal-info-row">
                <label>Rating:</label>
                <span>${generateStars(review.rating || 0)} ${review.rating || 0}/5</span>
            </div>
            <div class="modal-info-row">
                <label>Date:</label>
                <span>${review.date ? new Date(review.date).toLocaleString() : 'N/A'}</span>
            </div>
            <div class="modal-info-row full-width">
                <label>Comment:</label>
                <div class="modal-message-content">${(review.comment || 'No comment').replace(/\n/g, '<br>')}</div>
            </div>
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeAdminModal()">
                <i class="fas fa-times"></i> Close
            </button>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

function viewUserDetail(userId) {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) {
        showAlert('User not found', 'error');
        return;
    }
    
    const modal = document.getElementById('adminModal');
    const modalBody = document.getElementById('adminModalBody');
    if (!modal || !modalBody) return;
    
    const role = (user.role || 'reader').toLowerCase();
    const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
    const approvalStatus = user.role === 'author' 
        ? (user.authorApproved ? '<span style="color: #28a745;">✓ Approved</span>' : '<span style="color: #ffc107;">⏳ Pending Approval</span>')
        : '';
    
    modalBody.innerHTML = `
        <h2>User Details</h2>
        <div class="admin-modal-info">
            <div class="modal-info-row">
                <label>ID:</label>
                <span>${user.id}</span>
            </div>
            <div class="modal-info-row editable-row">
                <label>Full Name:</label>
                <span class="editable-value" data-field="name" data-id="${user.id}" data-type="user">${user.name || 'N/A'}</span>
                <button class="btn btn-outline btn-small" onclick="editFieldInModal('name', ${user.id}, 'user')">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
            <div class="modal-info-row editable-row">
                <label>Username:</label>
                <span class="editable-value" data-field="username" data-id="${user.id}" data-type="user">${user.username || 'N/A'}</span>
                <button class="btn btn-outline btn-small" onclick="editFieldInModal('username', ${user.id}, 'user')">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
            <div class="modal-info-row editable-row">
                <label>Email:</label>
                <span class="editable-value" data-field="email" data-id="${user.id}" data-type="user">${user.email || 'N/A'}</span>
                <button class="btn btn-outline btn-small" onclick="editFieldInModal('email', ${user.id}, 'user')">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
            <div class="modal-info-row editable-row">
                <label>Role:</label>
                <span class="editable-value" data-field="role" data-id="${user.id}" data-type="user">
                    <span class="role-badge role-${role}">${roleLabel}</span>
                </span>
                <button class="btn btn-outline btn-small" onclick="editFieldInModal('role', ${user.id}, 'user')">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
            ${user.role === 'author' ? `
            <div class="modal-info-row">
                <label>Author Status:</label>
                <span>${approvalStatus}</span>
            </div>
            ` : ''}
            <div class="modal-info-row">
                <label>Signup Date:</label>
                <span>${user.signupDate ? new Date(user.signupDate).toLocaleString() : 'N/A'}</span>
            </div>
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeAdminModal()">
                <i class="fas fa-times"></i> Close
            </button>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

function viewBookDetailAdmin(bookId) {
    const books = getBooks();
    const book = books.find(b => b.id === bookId);
    if (!book) {
        showAlert('Book not found', 'error');
        return;
    }
    
    const modal = document.getElementById('adminModal');
    const modalBody = document.getElementById('adminModalBody');
    if (!modal || !modalBody) return;
    
    modalBody.innerHTML = `
        <h2>Book Details</h2>
        <div class="admin-modal-info">
            <div class="modal-info-row">
                <label>ID:</label>
                <span>${book.id}</span>
            </div>
            <div class="modal-info-row editable-row">
                <label>Title:</label>
                <span class="editable-value" data-field="title" data-id="${book.id}" data-type="book">${book.title || 'N/A'}</span>
                <button class="btn btn-outline btn-small" onclick="editFieldInModal('title', ${book.id}, 'book')">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
            <div class="modal-info-row editable-row">
                <label>Author:</label>
                <span class="editable-value" data-field="author" data-id="${book.id}" data-type="book">${book.author || 'N/A'}</span>
                <button class="btn btn-outline btn-small" onclick="editFieldInModal('author', ${book.id}, 'book')">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
            <div class="modal-info-row editable-row">
                <label>Genre:</label>
                <span class="editable-value" data-field="genre" data-id="${book.id}" data-type="book">${book.genre || 'N/A'}</span>
                <button class="btn btn-outline btn-small" onclick="editFieldInModal('genre', ${book.id}, 'book')">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
            <div class="modal-info-row editable-row">
                <label>Year:</label>
                <span class="editable-value" data-field="year" data-id="${book.id}" data-type="book">${book.year || 'N/A'}</span>
                <button class="btn btn-outline btn-small" onclick="editFieldInModal('year', ${book.id}, 'book')">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
            <div class="modal-info-row editable-row">
                <label>Price:</label>
                <span class="editable-value" data-field="price" data-id="${book.id}" data-type="book">$${(Number(book.price) || 0).toFixed(2)}</span>
                <button class="btn btn-outline btn-small" onclick="editFieldInModal('price', ${book.id}, 'book')">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
            <div class="modal-info-row">
                <label>Rating:</label>
                <span>${generateStars(book.rating || 0)} ${(Number(book.rating) || 0).toFixed(1)} (${book.reviews || 0} reviews)</span>
            </div>
            <div class="modal-info-row editable-row full-width">
                <label>Description:</label>
                <div class="editable-value" data-field="description" data-id="${book.id}" data-type="book" style="margin-top: 10px;">
                    ${(book.description || 'No description').replace(/\n/g, '<br>')}
                </div>
                <button class="btn btn-outline btn-small" onclick="editFieldInModal('description', ${book.id}, 'book')" style="margin-top: 10px;">
                    <i class="fas fa-edit"></i> Edit Description
                </button>
            </div>
            <div class="modal-info-row editable-row">
                <label>Cover URL:</label>
                <span class="editable-value" data-field="cover" data-id="${book.id}" data-type="book" style="word-break: break-all;">${book.cover || 'N/A'}</span>
                <button class="btn btn-outline btn-small" onclick="editFieldInModal('cover', ${book.id}, 'book')">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeAdminModal()">
                <i class="fas fa-times"></i> Close
            </button>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

function editFieldInModal(field, id, type) {
    let currentValue, fieldLabel, fieldType = 'text';
    
    if (type === 'user') {
        const users = getUsers();
        const user = users.find(u => u.id === id);
        if (!user) return;
        
        currentValue = user[field] || '';
        fieldLabel = field.charAt(0).toUpperCase() + field.slice(1);
        
        if (field === 'role') {
            fieldType = 'select';
        } else if (field === 'email') {
            fieldType = 'email';
        }
    } else if (type === 'book') {
        const books = getBooks();
        const book = books.find(b => b.id === id);
        if (!book) return;
        
        currentValue = book[field] || '';
        fieldLabel = field.charAt(0).toUpperCase() + field.slice(1);
        
        if (field === 'year' || field === 'price') {
            fieldType = 'number';
        } else if (field === 'description') {
            fieldType = 'textarea';
        } else if (field === 'genre') {
            fieldType = 'select';
        }
    }
    
    const span = document.querySelector(`.editable-value[data-field="${field}"][data-id="${id}"][data-type="${type}"]`);
    if (!span) return;
    
    let input;
    if (fieldType === 'textarea') {
        input = document.createElement('textarea');
        input.value = currentValue;
        input.rows = 5;
        input.style.width = '100%';
        input.style.padding = '8px';
        input.style.borderRadius = '5px';
        input.style.border = '1px solid #ddd';
    } else if (fieldType === 'select') {
        input = document.createElement('select');
        input.style.width = '100%';
        input.style.padding = '8px';
        input.style.borderRadius = '5px';
        input.style.border = '1px solid #ddd';
        
        if (field === 'role') {
            ['admin', 'author', 'reader'].forEach(role => {
                const option = document.createElement('option');
                option.value = role;
                option.textContent = role.charAt(0).toUpperCase() + role.slice(1);
                if (role === currentValue) option.selected = true;
                input.appendChild(option);
            });
        } else if (field === 'genre') {
            const genres = ['Fiction', 'Fantasy', 'Romance', 'Mystery', 'Dystopian Fiction', 'Philosophy', 'Science Fiction', 'Thriller', 'Biography', 'History', 'Self-Help', 'Other'];
            genres.forEach(genre => {
                const option = document.createElement('option');
                option.value = genre;
                option.textContent = genre;
                if (genre === currentValue) option.selected = true;
                input.appendChild(option);
            });
        }
    } else {
        input = document.createElement('input');
        input.type = fieldType;
        input.value = field === 'price' ? (currentValue || '').toString().replace('$', '') : currentValue;
        input.style.width = '100%';
        input.style.padding = '8px';
        input.style.borderRadius = '5px';
        input.style.border = '1px solid #ddd';
    }
    
    const oldContent = span.innerHTML;
    span.innerHTML = '';
    span.appendChild(input);
    input.focus();
    if (input.select) input.select();
    
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary btn-small';
    saveBtn.innerHTML = '<i class="fas fa-check"></i>';
    saveBtn.style.marginLeft = '5px';
    saveBtn.onclick = () => {
        let newValue = input.value.trim();
        
        if (field === 'price') {
            newValue = parseFloat(newValue) || 0;
        } else if (field === 'year') {
            newValue = parseInt(newValue) || 0;
        }
        
        if (type === 'user') {
            const users = getUsers();
            const userIndex = users.findIndex(u => u.id === id);
            if (userIndex !== -1) {
                if (field === 'role') {
                    const oldRole = users[userIndex].role;
                    users[userIndex].role = newValue.toLowerCase();
                    if (newValue.toLowerCase() === 'author' && oldRole !== 'author') {
                        users[userIndex].authorApproved = false;
                        users[userIndex].authorApprovalStatus = 'pending';
                    } else if (newValue.toLowerCase() !== 'author' && oldRole === 'author') {
                        users[userIndex].authorApproved = true;
                        users[userIndex].authorApprovalStatus = 'approved';
                    }
                } else {
                    users[userIndex][field] = newValue;
                }
                saveUsers(users);
                const currentUser = getCurrentUser();
                if (currentUser && currentUser.id === id) {
                    saveCurrentUser(users[userIndex]);
                }
                showAlert('User updated successfully', 'success');
                loadAdminUsers();
                loadAdminStats();
                loadPendingAuthors();
            }
        } else if (type === 'book') {
            const books = getBooks();
            const bookIndex = books.findIndex(b => b.id === id);
            if (bookIndex !== -1) {
                books[bookIndex][field] = newValue;
                saveBooks(books);
                showAlert('Book updated successfully', 'success');
                loadAdminBooks();
            }
        }
        
        // Refresh the modal to show updated values
        if (type === 'user') {
            viewUserDetail(id);
        } else {
            viewBookDetailAdmin(id);
        }
    };
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary btn-small';
    cancelBtn.innerHTML = '<i class="fas fa-times"></i>';
    cancelBtn.style.marginLeft = '5px';
    cancelBtn.onclick = () => {
        span.innerHTML = oldContent;
    };
    
    const buttonContainer = span.parentElement.querySelector('.btn-outline');
    if (buttonContainer) {
        buttonContainer.parentElement.insertBefore(saveBtn, buttonContainer);
        buttonContainer.parentElement.insertBefore(cancelBtn, saveBtn.nextSibling);
        buttonContainer.style.display = 'none';
    }
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && fieldType !== 'textarea') {
            saveBtn.click();
        } else if (e.key === 'Escape') {
            cancelBtn.click();
        }
    });
}

function closeAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Login Modal Functionality
function showLoginModal(action, bookId) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('loginModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'loginModal';
        modal.className = 'admin-modal hidden';
        modal.innerHTML = `
            <div class="admin-modal-content">
                <span class="admin-modal-close" onclick="closeLoginModal()">&times;</span>
                <div id="loginModalBody">
                    <!-- Content will be populated by JavaScript -->
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Close modal when clicking outside
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeLoginModal();
            }
        });
    }
    
    const modalBody = document.getElementById('loginModalBody');
    const actionText = action === 'cart' ? 'add items to your cart' : 'add items to your wishlist';
    
    modalBody.innerHTML = `
        <h2>Login Required</h2>
        <div class="admin-modal-info">
            <p style="color: var(--text-color); margin-bottom: 20px;">
                Please login to ${actionText}.
            </p>
            <form id="loginModalForm" onsubmit="handleLoginModal(event, '${action}', ${bookId})">
                <div class="form-group">
                    <label for="modalLoginUsername">Username or Email</label>
                    <input type="text" id="modalLoginUsername" name="username" required style="width: 100%; padding: 10px; border-radius: 5px; border: 1px solid var(--border-color); background: var(--bg-color); color: var(--text-color);">
                </div>
                <div class="form-group">
                    <label for="modalLoginPassword">Password</label>
                    <input type="password" id="modalLoginPassword" name="password" required style="width: 100%; padding: 10px; border-radius: 5px; border: 1px solid var(--border-color); background: var(--bg-color); color: var(--text-color);">
                </div>
                <div class="modal-actions">
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-sign-in-alt"></i> Login
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="closeLoginModal()">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </form>
            <div style="margin-top: 20px; text-align: center;">
                <p style="color: var(--text-color);">Don't have an account? <a href="login.html" style="color: #4a90e2;">Sign up here</a></p>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function handleLoginModal(e, action, bookId) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const username = formData.get('username');
    const password = formData.get('password');
    // Call backend login endpoint
    const modalLoginHeaders = { 'Content-Type': 'application/json' };
    if (CSRF_TOKEN) {
        modalLoginHeaders['X-CSRF-Token'] = CSRF_TOKEN;
    } else {
        console.warn('CSRF token missing when attempting modal login');
    }
    fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: modalLoginHeaders,
        credentials: 'include',
        body: JSON.stringify({ usernameOrEmail: username, password })
    }).then(async res => {
        const data = await res.json();
        if (!res.ok) {
            showAlert(data.error || 'Login failed', 'error');
            return;
        }
        saveCurrentUser(data);
        showAlert('Login successful!', 'success');
        updateNavigation();
        updateCartCount();
        updateWishlistCount();
        closeLoginModal();

        if (action === 'cart') addToCart(bookId);
        else if (action === 'wishlist') addToWishlist(bookId);
        else if (action === 'review') showAddReviewModal(bookId);
    }).catch(err => {
        console.error('LoginModal fetch error', err);
        showAlert('Login failed (network error)', 'error');
    });
}

// Review Modal Functionality
function showAddReviewModal(bookId) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        showLoginModal('review', bookId);
        return;
    }
    
    // Check if user already reviewed this book
    const reviews = getReviews();
    const existingReview = reviews.find(r => r.bookId === bookId && r.userId === currentUser.id);
    
    // Create modal if it doesn't exist
    let modal = document.getElementById('reviewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'reviewModal';
        modal.className = 'admin-modal hidden';
        modal.innerHTML = `
            <div class="admin-modal-content">
                <span class="admin-modal-close" onclick="closeReviewModal()">&times;</span>
                <div id="reviewModalBody">
                    <!-- Content will be populated by JavaScript -->
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Close modal when clicking outside
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeReviewModal();
            }
        });
    }
    
    const modalBody = document.getElementById('reviewModalBody');
    const book = getBooks().find(b => b.id === bookId);
    
    let ratingHTML = '';
    for (let i = 1; i <= 5; i++) {
        ratingHTML += `<i class="far fa-star review-star" data-rating="${i}" style="font-size: 2rem; color: #ffc107; cursor: pointer; margin-right: 5px;"></i>`;
    }
    
    modalBody.innerHTML = `
        <h2>${existingReview ? 'Edit Your Review' : 'Add Your Review'}</h2>
        <div class="admin-modal-info">
            <p style="color: var(--text-color); margin-bottom: 20px;">
                ${book ? `Reviewing: <strong>${book.title}</strong>` : ''}
            </p>
            <form id="reviewModalForm" onsubmit="handleAddReview(event, ${bookId}, ${existingReview ? existingReview.id : 'null'})">
                <div class="form-group">
                    <label>Rating *</label>
                    <div id="reviewStars" style="margin: 10px 0;">
                        ${ratingHTML}
                    </div>
                    <input type="hidden" id="reviewRating" name="rating" value="${existingReview ? existingReview.rating : '0'}" required>
                </div>
                <div class="form-group">
                    <label for="reviewComment">Your Review *</label>
                    <textarea id="reviewComment" name="comment" required rows="5" style="width: 100%; padding: 10px; border-radius: 5px; border: 1px solid var(--border-color); background: var(--bg-color); color: var(--text-color); resize: vertical;">${existingReview ? existingReview.comment : ''}</textarea>
                </div>
                <div class="modal-actions">
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-check"></i> ${existingReview ? 'Update Review' : 'Submit Review'}
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="closeReviewModal()">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </form>
        </div>
    `;
    
    // Set initial rating display
    if (existingReview) {
        highlightStars(existingReview.rating);
    }
    
    // Add star click handlers
    const stars = modalBody.querySelectorAll('.review-star');
    stars.forEach(star => {
        star.addEventListener('click', function() {
            const rating = parseInt(this.dataset.rating);
            document.getElementById('reviewRating').value = rating;
            highlightStars(rating);
        });
        star.addEventListener('mouseenter', function() {
            const rating = parseInt(this.dataset.rating);
            highlightStars(rating);
        });
    });
    
    const starsContainer = document.getElementById('reviewStars');
    starsContainer.addEventListener('mouseleave', function() {
        const currentRating = parseInt(document.getElementById('reviewRating').value) || 0;
        highlightStars(currentRating);
    });
    
    modal.classList.remove('hidden');
}

function highlightStars(rating) {
    const stars = document.querySelectorAll('.review-star');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.className = 'fas fa-star review-star';
            star.style.color = '#ffc107';
        } else {
            star.className = 'far fa-star review-star';
            star.style.color = '#ffc107';
        }
    });
}

function closeReviewModal() {
    const modal = document.getElementById('reviewModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function handleAddReview(e, bookId, reviewId) {
    e.preventDefault();
    
    const currentUser = getCurrentUser();
    if (!currentUser) {
        showAlert('Please login to add a review', 'error');
        return;
    }
    
    const formData = new FormData(e.target);
    const rating = parseFloat(formData.get('rating'));
    const comment = formData.get('comment').trim();
    
    if (!rating || rating < 1 || rating > 5) {
        showAlert('Please select a rating between 1 and 5 stars', 'error');
        return;
    }
    
    if (!comment) {
        showAlert('Please enter a review comment', 'error');
        return;
    }
    
    const reviews = getReviews();
    const books = getBooks();
    const book = books.find(b => b.id === bookId);
    
    if (!book) {
        showAlert('Book not found', 'error');
        return;
    }
    
    if (reviewId) {
        // Update existing review
        const reviewIndex = reviews.findIndex(r => r.id === reviewId);
        if (reviewIndex !== -1) {
            reviews[reviewIndex].rating = rating;
            reviews[reviewIndex].comment = comment;
            reviews[reviewIndex].date = new Date().toISOString();
        }
    } else {
        // Add new review
        const newReview = {
            id: getNextReviewId(),
            bookId: bookId,
            userId: currentUser.id,
            rating: rating,
            comment: comment,
            date: new Date().toISOString()
        };
        reviews.push(newReview);
        
        // Update book rating
        const bookReviews = reviews.filter(r => r.bookId === bookId);
        const avgRating = bookReviews.reduce((sum, r) => sum + r.rating, 0) / bookReviews.length;
        book.rating = avgRating;
        book.reviews = bookReviews.length;
        saveBooks(books);
    }
    
    saveReviews(reviews);
    closeReviewModal();
    showAlert(reviewId ? 'Review updated successfully!' : 'Review added successfully!', 'success');
    
    // Reload reviews
    loadBookReviews(bookId);
}

// Close modals on ESC key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const reviewModal = document.getElementById('reviewModal');
        if (reviewModal && !reviewModal.classList.contains('hidden')) {
            closeReviewModal();
            return;
        }
        const loginModal = document.getElementById('loginModal');
        if (loginModal && !loginModal.classList.contains('hidden')) {
            closeLoginModal();
            return;
        }
        const adminModal = document.getElementById('adminModal');
        if (adminModal && !adminModal.classList.contains('hidden')) {
            closeAdminModal();
        }
    }
});

// Close modal when clicking outside
document.addEventListener('click', function(e) {
    const adminModal = document.getElementById('adminModal');
    if (adminModal && !adminModal.classList.contains('hidden')) {
        const modalContent = adminModal.querySelector('.admin-modal-content');
        if (e.target === adminModal) {
            closeAdminModal();
        }
    }
});

// Generic admin delete function
function deleteAdminItem(type, id) {
    const confirmMessages = {
        'user': 'Are you sure you want to delete this user?',
        'book': 'Are you sure you want to delete this book?',
        'message': 'Are you sure you want to delete this message?',
        'review': 'Are you sure you want to delete this review?'
    };
    
    if (!confirm(confirmMessages[type] || 'Are you sure?')) return;
    
    const handlers = {
        'user': () => {
            const users = getUsers();
            saveUsers(users.filter(u => u.id !== id));
            loadAdminUsers();
        },
        'book': () => {
            const books = getBooks();
            saveBooks(books.filter(b => b.id !== id));
            loadAdminBooks();
        },
        'message': () => {
            const messages = getMessages();
            saveMessages(messages.filter(m => m.id !== id));
            loadAdminMessages();
        },
        'review': () => {
            const reviews = getReviews();
            saveReviews(reviews.filter(r => r.id !== id));
            loadAdminReviews();
        }
    };
    
    if (handlers[type]) {
        handlers[type]();
        showAlert(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully`, 'success');
        loadAdminStats();
    }
}

// Legacy function names for backward compatibility
function deleteUser(userId) { deleteAdminItem('user', userId); }
function deleteBookAdmin(bookId) { deleteAdminItem('book', bookId); }
function deleteMessage(messageId) { deleteAdminItem('message', messageId); }
function deleteReview(reviewId) { deleteAdminItem('review', reviewId); }

// Generic prompt-based editor
function promptEdit(fields, currentValues, validators = {}) {
    const edited = {};
    
    for (const field of fields) {
        const promptText = field.prompt || `${field.label}:`;
        const defaultValue = currentValues[field.key] || field.default || '';
        const value = prompt(promptText, defaultValue);
        
        if (value === null) return null;
        
        if (field.required && !value.trim()) {
            showAlert(`${field.label} cannot be empty`, 'error');
            return null;
        }
        
        if (validators[field.key]) {
            const validation = validators[field.key](value);
            if (validation !== true) {
                showAlert(validation, 'error');
                return null;
            }
        }
        
        if (field.transform) {
            edited[field.key] = field.transform(value);
        } else {
            edited[field.key] = value.trim();
        }
    }
    
    return edited;
}

function editUser(userId) {
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
        showAlert('User not found', 'error');
        return;
    }
    
    const user = users[userIndex];
    const fields = [
        { key: 'name', label: 'Full Name', prompt: 'Full Name:', required: true },
        { key: 'username', label: 'Username', prompt: 'Username:', required: true },
        { key: 'email', label: 'Email', prompt: 'Email:', required: true },
        { key: 'role', label: 'Role', prompt: 'Role (admin, author, reader):', default: user.role || 'reader' }
    ];
    
    const validators = {
        email: (val) => val.includes('@') || 'Please provide a valid email address',
        role: (val) => ['admin', 'author', 'reader'].includes(val.toLowerCase()) || 'Role must be admin, author, or reader'
    };
    
    const edited = promptEdit(fields, user, validators);
    if (!edited) return;
    
    edited.role = edited.role.toLowerCase();
    const oldRole = user.role;
    const newRole = edited.role;
    
    // Handle author approval status when role changes
    if (newRole === 'author' && oldRole !== 'author') {
        // User is being changed to author - set as pending approval
        edited.authorApproved = false;
        edited.authorApprovalStatus = 'pending';
    } else if (newRole !== 'author' && oldRole === 'author') {
        // User is being changed from author to another role - clear approval status
        edited.authorApproved = true;
        edited.authorApprovalStatus = 'approved';
    } else if (newRole === 'author' && oldRole === 'author') {
        // User remains as author - preserve approval status if it exists
        if (user.authorApproved === undefined) {
            edited.authorApproved = false;
            edited.authorApprovalStatus = 'pending';
        }
    } else {
        // For non-author roles, ensure approval status is set
        edited.authorApproved = true;
        edited.authorApprovalStatus = 'approved';
    }
    
    users[userIndex] = { ...user, ...edited };
    saveUsers(users);
    
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === userId) {
        saveCurrentUser(users[userIndex]);
        updateNavigation();
    }
    
    if (newRole === 'author' && oldRole !== 'author') {
        showAlert('User role changed to author. The account is now pending approval.', 'info');
    } else {
        showAlert('User updated successfully', 'success');
    }
    
    loadAdminUsers();
    loadPendingAuthors();
    loadAdminStats();
}

function editBookAdmin(bookId) {
    const books = getBooks();
    const bookIndex = books.findIndex(b => b.id === bookId);
    if (bookIndex === -1) {
        showAlert('Book not found', 'error');
        return;
    }
    
    const book = books[bookIndex];
    const fields = [
        { key: 'title', label: 'Title', prompt: 'Book Title:', required: true },
        { key: 'author', label: 'Author', prompt: 'Author:', required: true },
        { key: 'genre', label: 'Genre', prompt: 'Genre:', required: true },
        { key: 'year', label: 'Year', prompt: 'Publication Year:', transform: (v) => parseInt(v, 10) },
        { key: 'price', label: 'Price', prompt: 'Price:', transform: (v) => parseFloat(v) },
        { key: 'rating', label: 'Rating', prompt: 'Rating (0-5):', transform: (v) => parseFloat(v) },
        { key: 'description', label: 'Description', prompt: 'Description:' }
    ];
    
    const validators = {
        year: (val) => {
            const year = parseInt(val, 10);
            return (!Number.isNaN(year) && year > 0) || 'Please enter a valid year';
        },
        price: (val) => {
            const price = parseFloat(val);
            return (!Number.isNaN(price) && price >= 0) || 'Please enter a valid price';
        },
        rating: (val) => {
            const rating = parseFloat(val);
            return (!Number.isNaN(rating) && rating >= 0 && rating <= 5) || 'Rating must be between 0 and 5';
        }
    };
    
    const edited = promptEdit(fields, book, validators);
    if (!edited) return;
    
    books[bookIndex] = { ...book, ...edited };
    saveBooks(books);
    showAlert('Book updated successfully', 'success');
    loadAdminBooks();
    loadAdminStats();
}

function editMessageAdmin(messageId) {
    const messages = getMessages();
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) {
        showAlert('Message not found', 'error');
        return;
    }
    
    const message = messages[messageIndex];
    const fields = [
        { key: 'name', label: 'Name', prompt: 'Sender Name:', required: true },
        { key: 'email', label: 'Email', prompt: 'Sender Email:', required: true },
        { key: 'subject', label: 'Subject', prompt: 'Subject:', required: true },
        { key: 'message', label: 'Message', prompt: 'Message:', required: true },
        { key: 'status', label: 'Status', prompt: 'Status (read/unread):', default: 'unread' }
    ];
    
    const validators = {
        email: (val) => val.includes('@') || 'Please provide a valid email address',
        status: (val) => ['read', 'unread'].includes(val.toLowerCase()) || 'Status must be "read" or "unread"'
    };
    
    const edited = promptEdit(fields, message, validators);
    if (!edited) return;
    
    edited.status = edited.status.toLowerCase();
    messages[messageIndex] = { ...message, ...edited };
    saveMessages(messages);
    showAlert('Message updated successfully', 'success');
    loadAdminMessages();
    loadAdminStats();
}

function editReviewAdmin(reviewId) {
    const reviews = getReviews();
    const reviewIndex = reviews.findIndex(r => r.id === reviewId);
    if (reviewIndex === -1) {
        showAlert('Review not found', 'error');
        return;
    }
    
    const review = reviews[reviewIndex];
    const fields = [
        { key: 'rating', label: 'Rating', prompt: 'Rating (0-5):', transform: (v) => parseFloat(v) },
        { key: 'comment', label: 'Comment', prompt: 'Comment:', required: true }
    ];
    
    const validators = {
        rating: (val) => {
            const rating = parseFloat(val);
            return (!Number.isNaN(rating) && rating >= 0 && rating <= 5) || 'Rating must be between 0 and 5';
        }
    };
    
    const edited = promptEdit(fields, review, validators);
    if (!edited) return;
    
    reviews[reviewIndex] = { ...review, ...edited };
    saveReviews(reviews);
    showAlert('Review updated successfully', 'success');
    loadAdminReviews();
    loadAdminStats();
}

function markMessageRead(messageId) {
    const messages = getMessages();
    const message = messages.find(m => m.id === messageId);
    if (message) {
        message.status = 'read';
        saveMessages(messages);
        showAlert('Message marked as read', 'success');
        loadAdminMessages();
        loadAdminStats();
    }
}

// Author Approval Functionality
function loadPendingAuthors() {
    const pendingAuthors = getUsers().filter(u => u.role === 'author' && !u.authorApproved);
    const container = document.getElementById('pendingAuthorsTable');
    if (!container) return;
    
    if (pendingAuthors.length === 0) {
        container.innerHTML = '<tr><td colspan="6" class="no-pending-authors">No pending author approvals</td></tr>';
        return;
    }
    
    container.innerHTML = pendingAuthors.map(user => `
        <tr class="pending-author-row">
            <td class="author-approval-cell">${user.id}</td>
            <td class="author-approval-cell">${user.name || 'N/A'}</td>
            <td class="author-approval-cell">${user.username || 'N/A'}</td>
            <td class="author-approval-cell">${user.email || 'N/A'}</td>
            <td class="author-approval-cell">${user.signupDate ? new Date(user.signupDate).toLocaleDateString() : 'N/A'}</td>
            <td class="author-approval-actions">
                <button class="btn btn-primary btn-small" onclick="approveAuthor(${user.id})" title="Approve">
                    <i class="fas fa-check"></i> Approve
                </button>
                <button class="btn btn-secondary btn-small" onclick="rejectAuthor(${user.id})" title="Reject">
                    <i class="fas fa-times"></i> Reject
                </button>
            </td>
        </tr>
    `).join('');
}

function approveAuthor(userId) {
    if (!confirm('Are you sure you want to approve this author account?')) return;
    
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
        showAlert('User not found', 'error');
        return;
    }
    
    users[userIndex].authorApproved = true;
    users[userIndex].authorApprovalStatus = 'approved';
    saveUsers(users);
    
    // Update current user if they're logged in
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === userId) {
        currentUser.authorApproved = true;
        currentUser.authorApprovalStatus = 'approved';
        saveCurrentUser(currentUser);
    }
    
    showAlert('Author account approved successfully', 'success');
    loadPendingAuthors();
    loadAdminUsers();
    loadAdminStats();
}

function rejectAuthor(userId) {
    if (!confirm('Are you sure you want to reject this author account? The user will remain as a reader.')) return;
    
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
        showAlert('User not found', 'error');
        return;
    }
    
    users[userIndex].role = 'reader';
    users[userIndex].authorApproved = false;
    users[userIndex].authorApprovalStatus = 'rejected';
    saveUsers(users);
    
    // Update current user if they're logged in
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === userId) {
        currentUser.role = 'reader';
        currentUser.authorApproved = false;
        currentUser.authorApprovalStatus = 'rejected';
        saveCurrentUser(currentUser);
        updateNavigation();
    }
    
    showAlert('Author account rejected. User role changed to reader.', 'success');
    loadPendingAuthors();
    loadAdminUsers();
    loadAdminStats();
}

// User Profile Functionality
function initializeUserProfile() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }
    loadUserProfile(currentUser);
}

function loadUserProfile(user) {
    const container = document.getElementById('userProfile');
    if (!container) return;
    
    const role = (user.role || 'reader').charAt(0).toUpperCase() + (user.role || 'reader').slice(1);
    const approvalStatus = user.role === 'author' 
        ? (user.authorApproved ? '<span style="color: #28a745;">✓ Approved</span>' : '<span style="color: #ffc107;">⏳ Pending Approval</span>')
        : '';
    
    container.innerHTML = `
        <div class="profile-container">
            <div class="profile-header"><h2>User Profile</h2></div>
            <div class="profile-content">
                <div class="profile-section">
                    <h3>Personal Information</h3>
                    <div class="profile-info">
                        <div class="info-item"><label>Full Name:</label><span>${user.name || 'N/A'}</span></div>
                        <div class="info-item"><label>Username:</label><span>${user.username || 'N/A'}</span></div>
                        <div class="info-item"><label>Email:</label><span>${user.email || 'N/A'}</span></div>
                        <div class="info-item"><label>Account Type:</label><span class="role-badge role-${user.role || 'reader'}">${role}</span></div>
                        ${user.role === 'author' ? `<div class="info-item"><label>Author Status:</label>${approvalStatus}</div>` : ''}
                    </div>
                </div>
                <div class="profile-section">
                    <h3>Privacy & Security</h3>
                    <div class="profile-info">
                        <div class="info-item"><label>Your Email:</label><span>${user.email || 'N/A'}</span></div>
                        <div class="info-item">
                            <label>Your Password:</label>
                            <span>••••••••</span>
                            <button class="btn btn-outline btn-small" onclick="changePassword()">Change Password</button>
                        </div>
                    </div>
                </div>
                <div class="profile-actions">
                    <button class="btn btn-secondary" onclick="logout()">
                        <i class="fas fa-sign-out-alt"></i> Log Out
                    </button>
                </div>
            </div>
        </div>
    `;
}

function changePassword() {
    const newPassword = prompt('Enter new password (minimum 6 characters):');
    if (!newPassword || newPassword.length < 6) {
        showAlert('Password must be at least 6 characters long', 'error');
        return;
    }
    
    const currentUser = getCurrentUser();
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    
    if (userIndex !== -1) {
        users[userIndex].password = newPassword;
        saveUsers(users);
        currentUser.password = newPassword;
        saveCurrentUser(currentUser);
        showAlert('Password changed successfully', 'success');
    }
}
