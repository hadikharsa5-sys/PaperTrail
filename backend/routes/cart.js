const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticateToken } = require('../middleware/auth');

// GET /api/cart - Get user's cart
router.get("/", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const [rows] = await db.query(
      `SELECT c.id, c.book_id, c.quantity, c.added_at, 
              b.title, b.author, b.price, b.cover
       FROM cart_items c
       JOIN books b ON c.book_id = b.id
       WHERE c.user_id = ?
       ORDER BY c.added_at DESC`,
      [userId]
    );
    
    res.json(rows);
  } catch (err) {
    console.error('Get cart error:', err);
    next(err);
  }
});

// POST /api/cart - Add item to cart
router.post("/", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { bookId, quantity = 1 } = req.body;
    
    if (!bookId) {
      return res.status(400).json({ error: 'Book ID is required' });
    }
    
    // Validate book exists
    const [bookRows] = await db.query('SELECT id FROM books WHERE id = ?', [bookId]);
    if (!bookRows || bookRows.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    // Check if item already in cart
    const [existing] = await db.query(
      'SELECT id, quantity FROM cart_items WHERE user_id = ? AND book_id = ?',
      [userId, bookId]
    );
    
    if (existing && existing.length > 0) {
      // Update quantity
      const newQuantity = existing[0].quantity + quantity;
      await db.query(
        'UPDATE cart_items SET quantity = ? WHERE id = ?',
        [newQuantity, existing[0].id]
      );
    } else {
      // Add new item
      await db.query(
        'INSERT INTO cart_items (user_id, book_id, quantity) VALUES (?, ?, ?)',
        [userId, bookId, quantity]
      );
    }
    
    // Return updated cart
    const [cartRows] = await db.query(
      `SELECT c.id, c.book_id, c.quantity, c.added_at, 
              b.title, b.author, b.price, b.cover
       FROM cart_items c
       JOIN books b ON c.book_id = b.id
       WHERE c.user_id = ?
       ORDER BY c.added_at DESC`,
      [userId]
    );
    
    res.json(cartRows);
  } catch (err) {
    console.error('Add to cart error:', err);
    next(err);
  }
});

// PUT /api/cart/:itemId - Update cart item quantity
router.put("/:itemId", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const itemId = req.params.itemId;
    const { quantity } = req.body;
    
    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be at least 1' });
    }
    
    // Verify item belongs to user
    const [itemRows] = await db.query(
      'SELECT id FROM cart_items WHERE id = ? AND user_id = ?',
      [itemId, userId]
    );
    
    if (!itemRows || itemRows.length === 0) {
      return res.status(404).json({ error: 'Cart item not found' });
    }
    
    await db.query(
      'UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?',
      [quantity, itemId, userId]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Update cart error:', err);
    next(err);
  }
});

// DELETE /api/cart/:itemId - Remove item from cart
router.delete("/:itemId", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const itemId = req.params.itemId;
    
    // Verify item belongs to user
    const [itemRows] = await db.query(
      'SELECT id FROM cart_items WHERE id = ? AND user_id = ?',
      [itemId, userId]
    );
    
    if (!itemRows || itemRows.length === 0) {
      return res.status(404).json({ error: 'Cart item not found' });
    }
    
    await db.query(
      'DELETE FROM cart_items WHERE id = ? AND user_id = ?',
      [itemId, userId]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Remove from cart error:', err);
    next(err);
  }
});

// DELETE /api/cart - Clear entire cart
router.delete("/", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    await db.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Clear cart error:', err);
    next(err);
  }
});

module.exports = router;
