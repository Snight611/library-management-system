const express = require("express");
const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());
 // In-memory storage
let books = [];
let borrowers = [];
let borrowedBooks = [];
let nextBookId = 1;
let nextBorrowerId = 1;
let nextBorrowId = 1;

// Root route
app.get("/", (req, res) => {
  res.send(
    "Library Management System is live! Features: Books, Search, Categories, Borrowing",
  );
});

// BOOKS ENDPOINTS

// GET /books - List all books with search and filters
app.get("/books", (req, res) => {
  let filteredBooks = books;

  // Search functionality
  if (req.query.q) {
    const searchTerm = req.query.q.toLowerCase();
    filteredBooks = filteredBooks.filter(
      (book) =>
        book.title.toLowerCase().includes(searchTerm) ||
        book.author.toLowerCase().includes(searchTerm) ||
        book.isbn.includes(searchTerm),
    );
  }

  // Filter by category
  if (req.query.category) {
    filteredBooks = filteredBooks.filter(
      (book) =>
        book.category &&
        book.category.toLowerCase() === req.query.category.toLowerCase(),
    );
  }

  // Filter by availability
  if (req.query.available) {
    const isAvailable = req.query.available === "true";
    filteredBooks = filteredBooks.filter((book) =>
      isAvailable ? book.availableCopies > 0 : book.availableCopies === 0,
    );
  }

  res.json({ books: filteredBooks, total: filteredBooks.length });
});

// GET /books/:id - Get single book
app.get("/books/:id", (req, res) => {
  const book = books.find((b) => b.id === parseInt(req.params.id));
  if (!book) {
    return res.status(404).json({ message: "Book not found" });
  }
  res.json({ book });
});

// POST /books - Add new book
app.post("/books", (req, res) => {
  const { title, author, isbn, copies, category, description } = req.body;

  if (!title || !author || !isbn || !copies) {
    return res
      .status(400)
      .json({ message: "Title, author, ISBN, and copies are required" });
  }

  const newBook = {
    id: nextBookId++,
    title,
    author,
    isbn,
    copies: parseInt(copies),
    availableCopies: parseInt(copies),
    category: category || "General",
    description: description || "",
    dateAdded: new Date().toISOString(),
  };

  books.push(newBook);
  res.status(201).json({ message: "Book added successfully", book: newBook });
});

// PUT /books/:id - Update book
app.put("/books/:id", (req, res) => {
  const bookIndex = books.findIndex((b) => b.id === parseInt(req.params.id));
  if (bookIndex === -1) {
    return res.status(404).json({ message: "Book not found" });
  }

  const { title, author, isbn, copies, category, description } = req.body;
  const book = books[bookIndex];

  if (title) book.title = title;
  if (author) book.author = author;
  if (isbn) book.isbn = isbn;
  if (copies) {
    const borrowedCount = book.copies - book.availableCopies;
    book.copies = parseInt(copies);
    book.availableCopies = Math.max(0, book.copies - borrowedCount);
  }
  if (category) book.category = category;
  if (description !== undefined) book.description = description;

  books[bookIndex] = book;
  res.json({ message: "Book updated successfully", book });
});

// DELETE /books/:id - Delete book
app.delete("/books/:id", (req, res) => {
  const bookIndex = books.findIndex((b) => b.id === parseInt(req.params.id));
  if (bookIndex === -1) {
    return res.status(404).json({ message: "Book not found" });
  }

  const book = books[bookIndex];
  if (book.availableCopies < book.copies) {
    return res
      .status(400)
      .json({ message: "Cannot delete book with borrowed copies" });
  }

  books.splice(bookIndex, 1);
  res.json({ message: "Book deleted successfully" });
});

// SEARCH AND CATEGORIES

// GET /books/search - Advanced search
app.get("/books/search", (req, res) => {
  const { q, category, author, available } = req.query;
  let results = books;

  if (q) {
    const searchTerm = q.toLowerCase();
    results = results.filter(
      (book) =>
        book.title.toLowerCase().includes(searchTerm) ||
        book.author.toLowerCase().includes(searchTerm) ||
        book.isbn.includes(searchTerm) ||
        book.description.toLowerCase().includes(searchTerm),
    );
  }

  if (category) {
    results = results.filter(
      (book) => book.category.toLowerCase() === category.toLowerCase(),
    );
  }

  if (author) {
    results = results.filter((book) =>
      book.author.toLowerCase().includes(author.toLowerCase()),
    );
  }

  if (available !== undefined) {
    const isAvailable = available === "true";
    results = results.filter((book) =>
      isAvailable ? book.availableCopies > 0 : book.availableCopies === 0,
    );
  }

  res.json({ results, total: results.length });
});

// GET /categories - List all categories
app.get("/categories", (req, res) => {
  const categories = [...new Set(books.map((book) => book.category))];
  res.json({ categories });
});

// BORROWERS ENDPOINTS

// GET /borrowers - List all borrowers
app.get("/borrowers", (req, res) => {
  res.json({ borrowers, total: borrowers.length });
});

// POST /borrowers - Register new borrower
app.post("/borrowers", (req, res) => {
  const { name, email, phone } = req.body;

  if (!name || !email) {
    return res.status(400).json({ message: "Name and email are required" });
  }

  const existingBorrower = borrowers.find((b) => b.email === email);
  if (existingBorrower) {
    return res
      .status(400)
      .json({ message: "Borrower with this email already exists" });
  }

  const newBorrower = {
    id: nextBorrowerId++,
    name,
    email,
    phone: phone || "",
    registrationDate: new Date().toISOString(),
    activeLoans: 0,
  };

  borrowers.push(newBorrower);
  res
    .status(201)
    .json({
      message: "Borrower registered successfully",
      borrower: newBorrower,
    });
});

// BORROWING SYSTEM

// POST /borrow - Borrow a book
app.post("/borrow", (req, res) => {
  const { bookId, borrowerId, daysToReturn = 14 } = req.body;

  if (!bookId || !borrowerId) {
    return res
      .status(400)
      .json({ message: "Book ID and Borrower ID are required" });
  }

  const book = books.find((b) => b.id === parseInt(bookId));
  const borrower = borrowers.find((b) => b.id === parseInt(borrowerId));

  if (!book) {
    return res.status(404).json({ message: "Book not found" });
  }

  if (!borrower) {
    return res.status(404).json({ message: "Borrower not found" });
  }

  if (book.availableCopies <= 0) {
    return res
      .status(400)
      .json({ message: "No copies available for borrowing" });
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + parseInt(daysToReturn));

  const borrowRecord = {
    id: nextBorrowId++,
    bookId: book.id,
    borrowerId: borrower.id,
    bookTitle: book.title,
    borrowerName: borrower.name,
    borrowDate: new Date().toISOString(),
    dueDate: dueDate.toISOString(),
    returned: false,
  };

  borrowedBooks.push(borrowRecord);
  book.availableCopies--;
  borrower.activeLoans++;

  res.status(201).json({ message: "Book borrowed successfully", borrowRecord });
});

// POST /return - Return a book
app.post("/return", (req, res) => {
  const { borrowId } = req.body;

  if (!borrowId) {
    return res.status(400).json({ message: "Borrow ID is required" });
  }

  const borrowIndex = borrowedBooks.findIndex(
    (b) => b.id === parseInt(borrowId) && !b.returned,
  );
  if (borrowIndex === -1) {
    return res.status(404).json({ message: "Active borrow record not found" });
  }

  const borrowRecord = borrowedBooks[borrowIndex];
  const book = books.find((b) => b.id === borrowRecord.bookId);
  const borrower = borrowers.find((b) => b.id === borrowRecord.borrowerId);

  borrowRecord.returned = true;
  borrowRecord.returnDate = new Date().toISOString();

  if (book) book.availableCopies++;
  if (borrower) borrower.activeLoans = Math.max(0, borrower.activeLoans - 1);

  res.json({ message: "Book returned successfully", borrowRecord });
});

// GET /borrowed - List all borrowed books
app.get("/borrowed", (req, res) => {
  const activeLoans = borrowedBooks.filter((b) => !b.returned);
  res.json({ borrowedBooks: activeLoans, total: activeLoans.length });
});

// GET /borrowed/overdue - Check overdue books
app.get("/borrowed/overdue", (req, res) => {
  const now = new Date();
  const overdueBooks = borrowedBooks.filter(
    (b) => !b.returned && new Date(b.dueDate) < now,
  );
  res.json({ overdueBooks, total: overdueBooks.length });
});
const path = require("path");
app.use(express.static(path.join(__dirname, ".")));

// Start server
app.listen(port, "0.0.0.0", () => {
  console.log(`Library server running at http://localhost:${port}`);
});
