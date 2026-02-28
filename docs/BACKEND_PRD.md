# RTM_V2 Backend — Product Requirements Document

## Overview
Add a backend to RTM_V2 to support a **Library** feature — persistent book/chapter management with reading progress tracking for a single admin user.

---

## Tech Stack
- **Runtime**: Node.js + Express + TypeScript
- **Database**: MongoDB + Mongoose
- **Auth**: Hardcoded admin credentials (env vars) + JWT
- **Architecture**: Routes → Controllers → Services → DAL (Data Access Layer)

---

## Data Models

### Book
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Auto |
| `title` | String | Required |
| `author` | String | Optional |
| `cover` | String | Base64 image OR auto-generated color+title image |
| `lastReadChapter` | ObjectId \| null | Ref to Chapter — last chapter user was reading |
| `lastReadPosition` | Object | `{ paragraphIndex: number, wordIndex: number }` |
| `chapterCount` | Number | Denormalized count for quick display |
| `createdAt` | Date | Auto (timestamps) |
| `updatedAt` | Date | Auto (timestamps) |

### Chapter
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Auto |
| `book` | ObjectId | Ref to Book, required |
| `chapterNumber` | Number | Auto-increment per book (prev + 1) |
| `title` | String | Optional (defaults to "Chapter {n}") |
| `content` | String | The full chapter text — required |
| `createdAt` | Date | Auto (timestamps) |
| `updatedAt` | Date | Auto (timestamps) |

---

## Authentication

### Single Admin User
- Username + password stored in `.env` (`ADMIN_USERNAME`, `ADMIN_PASSWORD`)
- On login → return JWT token (expires in 7 days)
- All API routes (except `/api/auth/login`) require valid JWT in `Authorization: Bearer <token>`
- Frontend stores token in localStorage

### Endpoints
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/login` | Login → returns JWT |
| GET | `/api/auth/me` | Validate token, return user info |

---

## API Endpoints

### Books
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/books` | List all books (id, title, author, cover, chapterCount, lastReadChapter) |
| GET | `/api/books/:id` | Get book detail + load last read chapter content |
| POST | `/api/books` | Create book (title, author?, cover?) |
| PUT | `/api/books/:id` | Update book (title, author, cover) |
| DELETE | `/api/books/:id` | Delete book + all its chapters |

### Chapters
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/books/:bookId/chapters` | List chapters for a book (id, number, title — no content) |
| GET | `/api/chapters/:id` | Get chapter with full content |
| POST | `/api/books/:bookId/chapters` | Add chapter (content required, title optional, number auto) |
| PUT | `/api/chapters/:id` | Update chapter (content, title) |
| DELETE | `/api/chapters/:id` | Delete chapter, re-number remaining |

### Reading Progress
| Method | Route | Description |
|--------|-------|-------------|
| PUT | `/api/books/:id/progress` | Save reading position `{ chapterId, paragraphIndex, wordIndex }` |

---

## Backend Project Structure

```
backend/
├── src/
│   ├── server.ts              # Express app entry point
│   ├── config/
│   │   └── db.ts              # MongoDB connection
│   ├── middleware/
│   │   └── auth.ts            # JWT verification middleware
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── book.routes.ts
│   │   └── chapter.routes.ts
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── book.controller.ts
│   │   └── chapter.controller.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── book.service.ts
│   │   └── chapter.service.ts
│   ├── dal/
│   │   ├── book.dal.ts
│   │   └── chapter.dal.ts
│   └── models/
│       ├── book.model.ts
│       └── chapter.model.ts
├── .env                       # ADMIN_USERNAME, ADMIN_PASSWORD, JWT_SECRET, MONGO_URI, PORT
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Frontend Changes

### New: Login Page
- Simple centered card with username + password fields
- On success → store JWT in localStorage, redirect to reader
- On app load → check token validity, redirect to login if expired

### New: Library Drawer (Right Side)
- **Book ComboBox**: Dropdown of all books, last-read book highlighted/selected
- **Chapter ComboBox**: Dropdown of chapters for selected book, last-read chapter highlighted
- **Prev/Next Chapter buttons**: Navigate chapters (same style as playback controls)
- **Add New Chapter button**: Opens quick-add dialog
- **Edit Current Chapter button**: Opens edit dialog for current chapter content
- **Add New Book button**: Opens add-book dialog

### New: Add Book Dialog
- Fields: Title (required), Author (optional)
- Cover: Upload image or auto-generate (colored rectangle + title text → base64)
- On save → POST `/api/books`, then switch to that book

### New: Add/Edit Chapter Dialog
- **Add mode**: Large text area (content), optional title field
- **"Add & Next" button**: Save current chapter and immediately open a blank form for next chapter (supports fast bulk-adding of 50+ chapters)
- **"Save & Close" button**: Save and close dialog
- **Edit mode**: Same form, pre-filled with existing content
- Chapter number auto-assigned (previous + 1)

### Modified: App Flow
- On book select → load last-read chapter content into the TTS reader
- On chapter navigate (prev/next/pick) → save current progress, load new chapter
- Reading progress auto-saved periodically (every paragraph change) via PUT `/api/books/:id/progress`
- Text input in left drawer becomes **read-only display** when reading from library (or hidden)

---

## Dev Setup
- Backend runs separately: `cd backend && npm run dev` (e.g., port 3001)
- Frontend Vite proxies `/api` to backend (vite.config.ts proxy)
- Separate terminals for frontend and backend

---

## Implementation Order
1. Scaffold backend (Express + TS + Mongoose setup)
2. MongoDB models (Book, Chapter)
3. Auth (login endpoint + JWT middleware)
4. Book CRUD endpoints (routes → controller → service → DAL)
5. Chapter CRUD endpoints
6. Reading progress endpoint
7. Frontend: API service layer + auth context
8. Frontend: Login page
9. Frontend: Library drawer + dialogs
10. Frontend: Wire everything to TTS reader
