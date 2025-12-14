const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAuthzFailure } = require('../middleware/logger');

// GET /api/books  (for explore page)
router.get("/", async (req, res) => {
  try {
    const { q, genre, author, sort } = req.query;
    let sql = "SELECT * FROM books WHERE 1=1";
    const params = [];

    if (q) {
      sql += " AND (title LIKE ? OR author LIKE ? OR genre LIKE ?)";
      const like = "%" + q + "%";
      params.push(like, like, like);
    }

    if (genre) {
      sql += " AND genre = ?";
      params.push(genre);
    }

    if (author) {
      sql += " AND author LIKE ?";
      params.push("%" + author + "%");
    }

    if (sort === "title") {
      sql += " ORDER BY title ASC";
    } else if (sort === "author") {
      sql += " ORDER BY author ASC";
    } else if (sort === "year") {
      sql += " ORDER BY year DESC";
    } else if (sort === "price-low") {
      sql += " ORDER BY price ASC";
    } else if (sort === "price-high") {
      sql += " ORDER BY price DESC";
    } else if (sort === "rating") {
      sql += " ORDER BY rating DESC";
    } else {
      sql += " ORDER BY id DESC";
    }

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Get books error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/books/:id (for book-detail page)
router.get("/:id", async (req, res) => {
  try {
    const bookId = req.params.id;
    const [rows] = await db.query("SELECT * FROM books WHERE id = ?", [bookId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Book not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Get book error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/books (author / admin only – for now we won't check token)
// Require authentication and author/admin role
router.post("/", authenticateToken, requireRole(['author', 'admin']), async (req, res, next) => {
  try {
    const { title, author, genre, year, price, description, cover } = req.body;

    if (!title || !author || !genre || !year || !price || !description || !cover) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const addedBy = req.user && req.user.id ? req.user.id : null;

    const [result] = await db.query(
      `INSERT INTO books
       (title, author, genre, year, price, description, cover, rating, reviews_cnt, featured, trending, added_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?)`,
      [title, author, genre, year, price, description, cover, addedBy]
    );

    const [rows] = await db.query("SELECT * FROM books WHERE id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Create book error:", err);
    next(err);
  }
});

// PUT /api/books/:id — update a book (only owner or admin)
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const bookId = req.params.id;
    const [rows] = await db.query('SELECT * FROM books WHERE id = ?', [bookId]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Book not found' });
    const book = rows[0];

    // Owner or admin only
    if (book.added_by !== req.user.id && req.user.role !== 'admin') {
      logAuthzFailure({ userId: req.user.id, username: '-', ip: req.ip, action: 'update-book', resource: `book:${bookId}` });
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { title, author, genre, year, price, description, cover } = req.body;
    await db.query(
      `UPDATE books SET title = ?, author = ?, genre = ?, year = ?, price = ?, description = ?, cover = ? WHERE id = ?`,
      [title, author, genre, year, price, description, cover, bookId]
    );

    const [updated] = await db.query('SELECT * FROM books WHERE id = ?', [bookId]);
    res.json(updated[0]);
  } catch (err) {
    console.error('Update book error:', err);
    next(err);
  }
});

// DELETE /api/books/:id — delete a book (only owner or admin)
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const bookId = req.params.id;
    const [rows] = await db.query('SELECT * FROM books WHERE id = ?', [bookId]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Book not found' });
    const book = rows[0];

    if (book.added_by !== req.user.id && req.user.role !== 'admin') {
      logAuthzFailure({ userId: req.user.id, username: '-', ip: req.ip, action: 'delete-book', resource: `book:${bookId}` });
      return res.status(403).json({ error: 'Forbidden' });
    }

    await db.query('DELETE FROM books WHERE id = ?', [bookId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete book error:', err);
    next(err);
  }
});

module.exports = router;
