// Sample data for the library website
const sampleBooks = [
    {
        id: 1,
        title: "The Great Gatsby",
        author: "F. Scott Fitzgerald",
        genre: "Fiction",
        year: 1925,
        price: 12.99,
        rating: 4.8,
        reviews: 1250,
        description: "A classic American novel set in the Jazz Age, following the mysterious Jay Gatsby and his obsession with the beautiful Daisy Buchanan.",
        cover: "BookCovers/TGG.jpeg",
        featured: true,
        trending: true
    },
    {
        id: 2,
        title: "1984",
        author: "George Orwell",
        genre: "Dystopian Fiction",
        year: 1949,
        price: 14.99,
        rating: 4.9,
        reviews: 2100,
        description: "A dystopian social science fiction novel about totalitarian control and surveillance in a world where independent thinking is a crime.",
        cover: "BookCovers/1984.jpeg",
        featured: true,
        trending: true
    },
    {
        id: 3,
        title: "To Kill a Mockingbird",
        author: "Harper Lee",
        genre: "Fiction",
        year: 1960,
        price: 13.99,
        rating: 4.7,
        reviews: 1800,
        description: "A gripping tale of racial injustice and childhood innocence in the American South during the 1930s.",
        cover: "BookCovers/TKAM.jpeg",
        featured: true,
        trending: true
    },
    {
        id: 4,
        title: "Pride and Prejudice",
        author: "Jane Austen",
        genre: "Romance",
        year: 1813,
        price: 11.99,
        rating: 4.6,
        reviews: 1650,
        description: "A romantic novel of manners that critiques the British landed gentry of the early 19th century.",
        cover: "BookCovers/P&P.jpeg",
        featured: false,
        trending: true
    },
    {
        id: 5,
        title: "The Catcher in the Rye",
        author: "J.D. Salinger",
        genre: "Fiction",
        year: 1951,
        price: 12.99,
        rating: 4.5,
        reviews: 1400,
        description: "A coming-of-age story about teenage rebellion and alienation in post-World War II America.",
        cover: "BookCovers/TCINTR.jpeg",
        featured: false,
        trending: true
    },
    {
        id: 6,
        title: "Lord of the Flies",
        author: "William Golding",
        genre: "Fiction",
        year: 1954,
        price: 13.99,
        rating: 4.4,
        reviews: 1200,
        description: "A story about a group of British boys stranded on an uninhabited island and their disastrous attempt to govern themselves.",
        cover: "BookCovers/LOTF.jpeg",
        featured: false,
        trending: false
    },
    {
        id: 7,
        title: "The Hobbit",
        author: "J.R.R. Tolkien",
        genre: "Fantasy",
        year: 1937,
        price: 15.99,
        rating: 4.8,
        reviews: 2200,
        description: "A fantasy novel about a hobbit who goes on an unexpected journey to help a group of dwarves reclaim their homeland.",
        cover: "BookCovers/TH.jpeg",
        featured: false,
        trending: true
    },
    {
        id: 8,
        title: "Harry Potter and the Philosopher's Stone",
        author: "J.K. Rowling",
        genre: "Fantasy",
        year: 1997,
        price: 16.99,
        rating: 4.9,
        reviews: 3500,
        description: "The first book in the Harry Potter series, following a young wizard's first year at Hogwarts School of Witchcraft and Wizardry.",
        cover: "BookCovers/HPPS.jpeg",
        featured: false,
        trending: true
    },
    {
        id: 9,
        title: "The Chronicles of Narnia",
        author: "C.S. Lewis",
        genre: "Fantasy",
        year: 1950,
        price: 14.99,
        rating: 4.7,
        reviews: 1800,
        description: "A series of fantasy novels about children who discover the magical world of Narnia.",
        cover: "BookCovers/TCON.jpeg",
        featured: false,
        trending: false
    },
    {
        id: 10,
        title: "The Alchemist",
        author: "Paulo Coelho",
        genre: "Philosophy",
        year: 1988,
        price: 12.99,
        rating: 4.3,
        reviews: 1100,
        description: "A philosophical novel about a young Andalusian shepherd who travels from his homeland in Spain to the Egyptian desert in search of treasure.",
        cover: "BookCovers/TA.jpeg",
        featured: false,
        trending: false
    },
    {
        id: 11,
        title: "The Da Vinci Code",
        author: "Dan Brown",
        genre: "Mystery",
        year: 2003,
        price: 13.99,
        rating: 4.2,
        reviews: 1900,
        description: "A mystery thriller novel about a symbologist who becomes involved in a conspiracy involving the Catholic Church.",
        cover: "BookCovers/TDVC.jpeg",
        featured: false,
        trending: false
    },
    {
        id: 12,
        title: "The Kite Runner",
        author: "Khaled Hosseini",
        genre: "Fiction",
        year: 2003,
        price: 14.99,
        rating: 4.6,
        reviews: 1600,
        description: "A story about the unlikely friendship between a wealthy boy and the son of his father's servant in Afghanistan.",
        cover: "BookCovers/TKR.jpeg",
        featured: false,
        trending: false
    }
];

const sampleUsers = [
    {
        id: 1,
        username: "admin",
        email: "admin@libraryhub.com",
        // Passwords are not stored in frontend sample users for security.
        // Authentication is performed against the backend API.
        role: "admin",
        name: "Admin User"
    },
    {
        id: 2,
        username: "author1",
        email: "author@example.com",
        // Passwords are not stored in frontend sample users for security.
        // Authentication is performed against the backend API.
        role: "author",
        name: "John Author"
    },
    {
        id: 3,
        username: "reader1",
        email: "reader@example.com",
        role: "reader",
        name: "Jane Reader"
    }
];

const sampleReviews = [
    {
        id: 1,
        bookId: 1,
        userId: 3,
        rating: 5,
        comment: "An absolute masterpiece! Fitzgerald's writing is beautiful and the story is timeless.",
        date: "2024-01-15"
    },
    {
        id: 2,
        bookId: 1,
        userId: 2,
        rating: 4,
        comment: "Great classic, though some parts felt a bit slow. Overall a great read.",
        date: "2024-01-10"
    },
    {
        id: 3,
        bookId: 2,
        userId: 3,
        rating: 5,
        comment: "Chilling and prophetic. This book is more relevant today than ever.",
        date: "2024-01-20"
    }
];

const sampleMessages = [
    {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        message: "I'm having trouble finding a specific book. Can you help?",
        date: "2024-01-25",
        status: "unread"
    },
    {
        id: 2,
        name: "Jane Smith",
        email: "jane@example.com",
        message: "Great website! I love the book recommendations.",
        date: "2024-01-24",
        status: "read"
    }
];

// Local storage keys
const STORAGE_KEYS = {
    BOOKS: 'libraryhub_books',
    USERS: 'libraryhub_users',
    CURRENT_USER: 'libraryhub_current_user',
    CART: 'libraryhub_cart',
    WISHLIST: 'libraryhub_wishlist',
    REVIEWS: 'libraryhub_reviews',
    MESSAGES: 'libraryhub_messages'
};

// Book cover mapping for migration
const bookCoverMap = {
    "The Great Gatsby": "BookCovers/TGG.jpeg",
    "1984": "BookCovers/1984.jpeg",
    "To Kill a Mockingbird": "BookCovers/TKAM.jpeg",
    "Pride and Prejudice": "BookCovers/P&P.jpeg",
    "The Catcher in the Rye": "BookCovers/TCINTR.jpeg",
    "Lord of the Flies": "BookCovers/LOTF.jpeg",
    "The Hobbit": "BookCovers/TH.jpeg",
    "Harry Potter and the Philosopher's Stone": "BookCovers/HPPS.jpeg",
    "The Chronicles of Narnia": "BookCovers/TCON.jpeg",
    "The Alchemist": "BookCovers/TA.jpeg",
    "The Da Vinci Code": "BookCovers/TDVC.jpeg",
    "The Kite Runner": "BookCovers/TKR.jpeg"
};

// Initialize data in localStorage if not exists
function initializeData() {
    if (!localStorage.getItem(STORAGE_KEYS.BOOKS)) {
        localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(sampleBooks));
    }
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(sampleUsers));
    }
    if (!localStorage.getItem(STORAGE_KEYS.REVIEWS)) {
        localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(sampleReviews));
    }
    if (!localStorage.getItem(STORAGE_KEYS.MESSAGES)) {
        localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(sampleMessages));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CART)) {
        localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.WISHLIST)) {
        localStorage.setItem(STORAGE_KEYS.WISHLIST, JSON.stringify([]));
    }
}

function getBooks() {
    const books = JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKS) || '[]');
    // Migrate book covers to use local images
    let needsUpdate = false;
    const migratedBooks = books.map(book => {
        // If book has a placeholder URL or old cover, update it
        if (bookCoverMap[book.title] &&
            (book.cover?.includes('placeholder') || !book.cover?.startsWith('BookCovers/'))) {
            needsUpdate = true;
            return { ...book, cover: bookCoverMap[book.title] };
        }
        return book;
    });
    
    if (needsUpdate) {
        saveBooks(migratedBooks);
        return migratedBooks;
    }
    
    return books;
}

function getUsers() {
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    // Migrate existing users to include authorApproved and signupDate fields
    let needsUpdate = false;
    const migratedUsers = users.map(user => {
        let migratedUser = { ...user };
        
        if (user.role === 'author' && user.authorApproved === undefined) {
            needsUpdate = true;
            // Auto-approve existing authors for backward compatibility
            migratedUser = {
                ...migratedUser,
                authorApproved: true,
                authorApprovalStatus: 'approved'
            };
        }
        if (user.authorApproved === undefined) {
            needsUpdate = true;
            migratedUser = {
                ...migratedUser,
                authorApproved: true,
                authorApprovalStatus: 'approved'
            };
        }
        if (user.signupDate === undefined) {
            needsUpdate = true;
            // Set a default signup date for existing users (use current date)
            migratedUser = {
                ...migratedUser,
                signupDate: new Date().toISOString()
            };
        }
        
        return migratedUser;
    });
    
    if (needsUpdate) {
        saveUsers(migratedUsers);
        return migratedUsers;
    }
    
    return users;
}

function getCurrentUser() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_USER) || 'null');
}

// User-specific cart and wishlist functions
function getUserCart(userId) {
    const allCarts = JSON.parse(localStorage.getItem('libraryhub_user_carts') || '{}');
    return allCarts[userId] || [];
}

function saveUserCart(userId, cart) {
    const allCarts = JSON.parse(localStorage.getItem('libraryhub_user_carts') || '{}');
    allCarts[userId] = cart;
    localStorage.setItem('libraryhub_user_carts', JSON.stringify(allCarts));
}

function getUserWishlist(userId) {
    const allWishlists = JSON.parse(localStorage.getItem('libraryhub_user_wishlists') || '{}');
    return allWishlists[userId] || [];
}

function saveUserWishlist(userId, wishlist) {
    const allWishlists = JSON.parse(localStorage.getItem('libraryhub_user_wishlists') || '{}');
    allWishlists[userId] = wishlist;
    localStorage.setItem('libraryhub_user_wishlists', JSON.stringify(allWishlists));
}

function getReviews() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.REVIEWS) || '[]');
}

function getMessages() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '[]');
}

function saveBooks(books) {
    localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(books));
}

function saveUsers(users) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

function saveCurrentUser(user) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
}

function saveReviews(reviews) {
    localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(reviews));
}

function saveMessages(messages) {
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
}

// Initialize data when the script loads
initializeData();
