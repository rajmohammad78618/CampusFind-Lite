// CampusFind Lite - Backend Server (Node.js native HTTP module only)

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ---------- Configuration ----------
const PORT = 3000;
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const DATA_FILE = path.join(__dirname, "items.json");

const MAX_BODY_SIZE = 3 * 1024 * 1024; // 3 MB max request body (image is base64 in JSON)
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB max image file

// Allowed image types: MIME type -> file extension
const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp"
};

const ALLOWED_CATEGORIES = [
  "Electronics",
  "Wallet & Bags",
  "Keys",
  "Books & Stationery",
  "Clothing",
  "ID Cards",
  "Accessories",
  "Other"
];

// Make sure folders/files exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, "[]", "utf8");
}

// ---------- Helper functions ----------

// Read all items from items.json
function readItems() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw || "[]");
  } catch (error) {
    console.error("Error reading items.json:", error.message);
    return [];
  }
}

// Save all items to items.json
function writeItems(items) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), "utf8");
}

// Send a JSON response
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

// Send an error as JSON
function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { success: false, error: message });
}

// Read the full request body as a string, with a size limit
function readBody(req, maxSize) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxSize) {
        reject(new Error("PAYLOAD_TOO_LARGE"));
        req.destroy();
        return;
      }
      body += chunk.toString("utf8");
    });

    req.on("end", () => resolve(body));
    req.on("error", (err) => reject(err));
  });
}

// Get a MIME type for static files
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml"
  };
  return types[ext] || "application/octet-stream";
}

// Serve a file from a given folder, preventing path traversal
function serveFile(res, baseDir, requestPath) {
  // Remove leading slash and decode
  const safePath = path.normalize(decodeURIComponent(requestPath)).replace(/^(\.\.[\/\\])+/, "");
  const fullPath = path.join(baseDir, safePath);

  // Make sure the final path is still inside the base folder
  if (!fullPath.startsWith(baseDir)) {
    return sendError(res, 403, "Forbidden");
  }

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      return sendError(res, 404, "File not found");
    }
    res.writeHead(200, { "Content-Type": getContentType(fullPath) });
    fs.createReadStream(fullPath).pipe(res);
  });
}

// Validate a single item's text fields. Returns an error string or null.
function validateItemFields(data) {
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const type = data.type;
  const category = data.category;
  const location = typeof data.location === "string" ? data.location.trim() : "";
  const date = typeof data.date === "string" ? data.date.trim() : "";
  const description = typeof data.description === "string" ? data.description.trim() : "";

  if (name.length < 2 || name.length > 80) {
    return "Item name must be between 2 and 80 characters.";
  }
  if (type !== "lost" && type !== "found") {
    return "Type must be either 'lost' or 'found'.";
  }
  if (!ALLOWED_CATEGORIES.includes(category)) {
    return "Please select a valid category.";
  }
  if (location.length < 2 || location.length > 100) {
    return "Location must be between 2 and 100 characters.";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) {
    return "Please provide a valid date.";
  }
  if (description.length < 5 || description.length > 500) {
    return "Description must be between 5 and 500 characters.";
  }
  return null;
}

// ---------- API handlers ----------

// GET /api/items - returns all items (newest first)
function handleGetItems(req, res) {
  const items = readItems();
  const sorted = items.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  sendJson(res, 200, { success: true, items: sorted });
}

// GET /api/stats - returns counts
function handleGetStats(req, res) {
  const items = readItems();
  const lost = items.filter((item) => item.type === "lost").length;
  const found = items.filter((item) => item.type === "found").length;
  sendJson(res, 200, {
    success: true,
    stats: { total: items.length, lost: lost, found: found }
  });
}

// POST /api/items - create a new item (with optional base64 image)
async function handlePostItem(req, res) {
  let rawBody;
  try {
    rawBody = await readBody(req, MAX_BODY_SIZE);
  } catch (error) {
    if (error.message === "PAYLOAD_TOO_LARGE") {
      return sendError(res, 413, "Request is too large. Max allowed is about 2 MB image.");
    }
    return sendError(res, 400, "Could not read request body.");
  }

  let data;
  try {
    data = JSON.parse(rawBody);
  } catch (error) {
    return sendError(res, 400, "Invalid JSON data.");
  }

  // Validate text fields
  const validationError = validateItemFields(data);
  if (validationError) {
    return sendError(res, 400, validationError);
  }

  // Handle image (optional but recommended)
  let imageUrl = "";
  if (data.image) {
    // Expected format: "data:image/png;base64,AAAA..."
    const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(data.image);
    if (!match) {
      return sendError(res, 400, "Invalid image format.");
    }

    const mimeType = match[1].toLowerCase();
    const extension = ALLOWED_IMAGE_TYPES[mimeType];
    if (!extension) {
      return sendError(res, 400, "Only JPG, PNG, GIF and WEBP images are allowed.");
    }

    const imageBuffer = Buffer.from(match[2], "base64");
    if (imageBuffer.length === 0) {
      return sendError(res, 400, "Image data is empty.");
    }
    if (imageBuffer.length > MAX_IMAGE_SIZE) {
      return sendError(res, 413, "Image is too large. Maximum size is 2 MB.");
    }

    // Create a safe random file name
    const fileName = crypto.randomBytes(12).toString("hex") + extension;
    try {
      fs.writeFileSync(path.join(UPLOADS_DIR, fileName), imageBuffer);
    } catch (error) {
      console.error("Image save error:", error.message);
      return sendError(res, 500, "Could not save the image.");
    }
    imageUrl = "/uploads/" + fileName;
  }

  // Build the new item
  const newItem = {
    id: crypto.randomBytes(8).toString("hex"),
    name: data.name.trim(),
    type: data.type,
    category: data.category,
    location: data.location.trim(),
    date: data.date.trim(),
    description: data.description.trim(),
    image: imageUrl,
    createdAt: new Date().toISOString()
  };

  const items = readItems();
  items.push(newItem);

  try {
    writeItems(items);
  } catch (error) {
    console.error("Save error:", error.message);
    return sendError(res, 500, "Could not save the item.");
  }

  sendJson(res, 201, { success: true, message: "Item added successfully.", item: newItem });
}

// DELETE /api/items/:id - delete an item and its image
function handleDeleteItem(req, res, itemId) {
  const items = readItems();
  const index = items.findIndex((item) => item.id === itemId);

  if (index === -1) {
    return sendError(res, 404, "Item not found.");
  }

  const removed = items.splice(index, 1)[0];

  try {
    writeItems(items);
  } catch (error) {
    console.error("Delete save error:", error.message);
    return sendError(res, 500, "Could not delete the item.");
  }

  // Remove the image file too (ignore errors if missing)
  if (removed.image) {
    const imagePath = path.join(UPLOADS_DIR, path.basename(removed.image));
    fs.unlink(imagePath, () => {});
  }

  sendJson(res, 200, { success: true, message: "Item deleted successfully." });
}

// ---------- Main request router ----------

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  try {
    // API routes
    if (pathname === "/api/items" && method === "GET") {
      return handleGetItems(req, res);
    }
    if (pathname === "/api/items" && method === "POST") {
      return await handlePostItem(req, res);
    }
    if (pathname.startsWith("/api/items/") && method === "DELETE") {
      const itemId = pathname.replace("/api/items/", "");
      return handleDeleteItem(req, res, itemId);
    }
    if (pathname === "/api/stats" && method === "GET") {
      return handleGetStats(req, res);
    }

    // Uploaded images
    if (pathname.startsWith("/uploads/") && method === "GET") {
      return serveFile(res, UPLOADS_DIR, pathname.replace("/uploads/", ""));
    }

    // Frontend static files
    if (method === "GET") {
      const requested = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
      return serveFile(res, FRONTEND_DIR, requested);
    }

    // Anything else
    sendError(res, 404, "Route not found.");
  } catch (error) {
    console.error("Server error:", error);
    sendError(res, 500, "Internal server error.");
  }
});

server.listen(PORT, () => {
  console.log("CampusFind Lite is running.");
  console.log(`Open in browser: http://localhost:${PORT}`);
});