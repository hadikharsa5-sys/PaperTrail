const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticateToken } = require('../middleware/auth');

// GET /api/wishlist - Get user's wishlist
router.get("/", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const [rows] = await db.query(
      `SELECT w.id, w.book_id, w.added_at,
              b.title, b.author, b.price, b.cover, b.genre, b.year
       FROM wishlist_items w
       JOIN books b ON w.book_id = b.id
       WHERE w.user_id = ?
       ORDER BY w.added_at DESC`,
      [userId]
    );
    
    res.json(rows);
  } catch (err) {
    console.error('Get wishlist error:', err);
    next(err);
  }
});

// POST /api/wishlist - Add item to wishlist
router.post("/", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { bookId } = req.body;
    
    if (!bookId) {
      return res.status(400).json({ error: 'Book ID is required' });
    }
    
    // Validate book exists
    const [bookRows] = await db.query('SELECT id FROM books WHERE id = ?', [bookId]);
    if (!bookRows || bookRows.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    // Check if already in wishlist
    const [existing] = await db.query(
      'SELECT id FROM wishlist_items WHERE user_id = ? AND book_id = ?',
      [userId, bookId]
    );
    
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'Book already in wishlist' });
    }
    
    // Add to wishlist
    await db.query(
      'INSERT INTO wishlist_items (user_id, book_id) VALUES (?, ?)',
      [userId, bookId]
    );
    
    // Return updated wishlist
    const [wishlistRows] = await db.query(
      `SELECT w.id, w.book_id, w.added_at,
              b.title, b.author, b.price, b.cover, b.genre, b.year
       FROM wishlist_items w
       JOIN books b ON w.book_id = b.id
       WHERE w.user_id = ?
       ORDER BY w.added_at DESC`,
      [userId]
    );
    
    res.json(wishlistRows);
  } catch (err) {
    console.error('Add to wishlist error:', err);
    next(err);
  }
});

// DELETE /api/wishlist/:itemId - Remove item from wishlist
router.delete("/:itemId", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const itemId = req.params.itemId;
    
    // Verify item belongs to user
    const [itemRows] = await db.query(
      'SELECT id FROM wishlist_items WHERE id = ? AND user_id = ?',
      [itemId, userId]
    );
    
    if (!itemRows || itemRows.length === 0) {
      return res.status(404).json({ error: 'Wishlist item not found' });
    }
    
    await db.query(
      'DELETE FROM wishlist_items WHERE id = ? AND user_id = ?',
      [itemId, userId]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Remove from wishlist error:', err);
    next(err);
  }
});

// DELETE /api/wishlist/book/:bookId - Remove by book ID (alternative endpoint)
router.delete("/book/:bookId", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const bookId = req.params.bookId;
    
    await db.query(
      'DELETE FROM wishlist_items WHERE user_id = ? AND book_id = ?',
      [userId, bookId]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Remove from wishlist by book ID error:', err);
    next(err);
  }
});

module.exports = router;
