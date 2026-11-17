# CampusFind Lite – Campus Lost & Found Portal

"Lost Something? Find It Here."

CampusFind Lite is a simple web portal where college students can report lost items and found items, browse all reports, search by name, filter by type and category, view details, and delete entries.

## Tech Stack

- HTML, CSS, Vanilla JavaScript (frontend)
- Node.js native `http` module (backend)
- JSON file storage (`backend/items.json`)
- Uploaded images stored in `backend/uploads/`

## Folder Structure

```
CampusFind-Lite/
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── backend/
│   ├── server.js
│   ├── items.json
│   └── uploads/
├── package.json
└── README.md
```

## How to Run

1. Install Node.js (version 14 or newer) from https://nodejs.org
2. Open the `CampusFind-Lite` folder in VS Code.
3. Open the terminal in VS Code (`Ctrl + ~`).
4. Run the server:

```bash
npm start
```

5. Open your browser and go to: http://localhost:3000

No `npm install` is needed because the project uses no external packages.

## API Endpoints

| Method | Route            | Description                     |
|--------|------------------|---------------------------------|
| GET    | /api/items       | Get all items                   |
| POST   | /api/items       | Add a new item (with image)     |
| DELETE | /api/items/:id   | Delete an item by id            |
| GET    | /api/stats       | Get total, lost and found count |

## Image Rules

- Allowed types: JPG, PNG, GIF, WEBP
- Maximum size: 2 MB

## Features

- Homepage with navbar and hero section
- Search by item name
- Report Lost and Report Found forms
- Image upload with preview
- Cards showing image, name, Lost/Found badge, category, location, date and description
- Filter by type and category
- Item details view and delete
- Live Lost / Found / Total counts
- Success notifications