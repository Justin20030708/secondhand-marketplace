const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const BODY_SIZE_LIMIT = "15mb";
const DB_PATH = (() => {
  if (process.env.DB_PATH) {
    return process.env.DB_PATH;
  }

  if (process.env.RENDER && process.env.RENDER_DISK_MOUNT_PATH) {
    return path.join(process.env.RENDER_DISK_MOUNT_PATH, "secondhand-marketplace.sqlite");
  }

  return path.join(__dirname, "data", "secondhand-marketplace.sqlite");
})();
const CATEGORIES = ["電子產品", "書籍", "家具", "服飾", "其他"];
const STATUSES = ["可購買", "已售出"];
const sellerProfiles = new Map();

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new sqlite3.Database(DB_PATH);

function sendSuccess(res, message, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

function sendFail(res, message, statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    message
  });
}

function parseProductId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function validateProductInput(body) {
  const requiredFields = ["title", "description", "price", "category", "image", "seller"];

  for (const field of requiredFields) {
    if (!body[field] || String(body[field]).trim() === "") {
      return `${field} 為必填欄位`;
    }
  }

  const price = Number(body.price);
  if (!Number.isFinite(price) || price <= 0) {
    return "price 必須是大於 0 的數字";
  }

  if (!CATEGORIES.includes(body.category)) {
    return `category 僅接受：${CATEGORIES.join("、")}`;
  }

  if (body.status && !STATUSES.includes(body.status)) {
    return `status 僅接受：${STATUSES.join("、")}`;
  }

  return null;
}

function normalizeSellerProfileInput(body) {
  const nickname = String(body.nickname || "").trim();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim();

  if (!nickname) {
    return { error: "nickname 為必填欄位" };
  }

  return {
    data: {
      nickname,
      phone,
      email
    }
  };
}

function normalizeFavoriteInput(input) {
  const nickname = String(input.nickname || "").trim();
  const productId = Number.parseInt(String(input.productId || input.product_id || ""), 10);

  if (!nickname) {
    return { error: "nickname 為必填欄位" };
  }

  if (Number.isNaN(productId)) {
    return { error: "productId 為必填欄位" };
  }

  return {
    data: {
      nickname,
      productId
    }
  };
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
}

async function initDatabase() {
  await run("PRAGMA foreign_keys = ON");

  await run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      price INTEGER NOT NULL CHECK (price > 0),
      category TEXT NOT NULL,
      image TEXT NOT NULL,
      status TEXT NOT NULL,
      seller TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS product_clicks (
      product_id INTEGER PRIMARY KEY,
      click_count INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS favorites (
      nickname TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (nickname, product_id),
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  await run(`
    INSERT INTO product_clicks (product_id, click_count)
    SELECT p.id, 0
    FROM products p
    LEFT JOIN product_clicks pc ON pc.product_id = p.id
    WHERE pc.product_id IS NULL
  `);
}

app.use(cors());
app.use(express.json({ limit: BODY_SIZE_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_SIZE_LIMIT }));
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/api/products", (req, res) => {
  const category = String(req.query.category || "").trim();
  const sort = String(req.query.sort || "default").trim();
  const search = String(req.query.search || "").trim();
  const whereParts = [];
  const params = [];

  if (category && category !== "全部") {
    whereParts.push("category = ?");
    params.push(category);
  }

  if (search) {
    whereParts.push("(title LIKE ? COLLATE NOCASE OR description LIKE ? COLLATE NOCASE)");
    params.push(`%${search}%`, `%${search}%`);
  }

  let orderBy = "id ASC";
  if (sort === "price-asc") {
    orderBy = "price ASC, id ASC";
  } else if (sort === "price-desc") {
    orderBy = "price DESC, id ASC";
  }

  const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  all(
    `
    SELECT id, title, description, price, category, image, status, seller
    FROM products
    ${whereClause}
    ORDER BY ${orderBy}
    `,
    params
  )
    .then((rows) => sendSuccess(res, "取得商品清單成功", rows))
    .catch(() => sendFail(res, "資料庫讀取失敗", 500));
});

app.get("/api/products/hot", (req, res) => {
  const limitRaw = Number.parseInt(String(req.query.limit || "5"), 10);
  const limit = Number.isNaN(limitRaw) ? 5 : Math.max(1, Math.min(limitRaw, 20));

  all(
    `
    SELECT
      p.id,
      p.title,
      p.description,
      p.price,
      p.category,
      p.image,
      p.status,
      p.seller,
      COALESCE(pc.click_count, 0) AS clickCount
    FROM products p
    LEFT JOIN product_clicks pc ON pc.product_id = p.id
    WHERE COALESCE(pc.click_count, 0) > 0
    ORDER BY clickCount DESC, p.id ASC
    LIMIT ?
    `,
    [limit]
  )
    .then((rows) => sendSuccess(res, "取得熱門商品成功", rows))
    .catch(() => sendFail(res, "資料庫讀取失敗", 500));
});

app.post("/api/products/:id/click", (req, res) => {
  const productId = parseProductId(req.params.id);
  if (productId === null) {
    return sendFail(res, "商品編號格式錯誤", 400);
  }

  get("SELECT id FROM products WHERE id = ?", [productId])
    .then((productRow) => {
      if (!productRow) {
        return sendFail(res, "找不到此商品", 404);
      }

      return run(
        `
        INSERT INTO product_clicks (product_id, click_count)
        VALUES (?, 1)
        ON CONFLICT(product_id)
        DO UPDATE SET click_count = click_count + 1
        `,
        [productId]
      ).then(() =>
        get("SELECT click_count AS clickCount FROM product_clicks WHERE product_id = ?", [productId])
          .then((countRow) =>
            sendSuccess(res, "商品點擊記錄成功", {
              id: productId,
              clickCount: countRow?.clickCount || 0
            })
          )
      );
    })
    .catch(() => sendFail(res, "資料庫寫入失敗", 500));
});

app.get("/api/products/:id", (req, res) => {
  const productId = parseProductId(req.params.id);
  if (productId === null) {
    return sendFail(res, "商品編號格式錯誤", 400);
  }

  get(
    `
    SELECT id, title, description, price, category, image, status, seller
    FROM products
    WHERE id = ?
    `,
    [productId]
  )
    .then((product) => {
      if (!product) {
        return sendFail(res, "找不到此商品", 404);
      }

      return sendSuccess(res, "取得商品成功", product);
    })
    .catch(() => sendFail(res, "資料庫讀取失敗", 500));
});

app.get("/api/sellers/profile", (req, res) => {
  const nickname = String(req.query.nickname || "").trim();
  if (!nickname) {
    return sendFail(res, "nickname 查詢參數為必填", 400);
  }

  const profile = sellerProfiles.get(nickname);
  if (!profile) {
    return sendFail(res, "找不到此賣家資訊", 404);
  }

  return sendSuccess(res, "取得賣家資訊成功", profile);
});

app.post("/api/sellers/profile", (req, res) => {
  const normalized = normalizeSellerProfileInput(req.body);
  if (normalized.error) {
    return sendFail(res, normalized.error, 400);
  }

  const profile = normalized.data;
  sellerProfiles.set(profile.nickname, profile);
  return sendSuccess(res, "儲存賣家資訊成功", profile, 201);
});

app.get("/api/favorites", (req, res) => {
  const nickname = String(req.query.nickname || "").trim();
  if (!nickname) {
    return sendFail(res, "nickname 查詢參數為必填", 400);
  }

  all(
    `
    SELECT
      p.id,
      p.title,
      p.description,
      p.price,
      p.category,
      p.image,
      p.status,
      p.seller
    FROM favorites f
    INNER JOIN products p ON p.id = f.product_id
    WHERE f.nickname = ?
    ORDER BY f.created_at DESC, p.id DESC
    `,
    [nickname]
  )
    .then((rows) => sendSuccess(res, "取得收藏清單成功", rows))
    .catch(() => sendFail(res, "資料庫讀取失敗", 500));
});

app.post("/api/favorites", (req, res) => {
  const normalized = normalizeFavoriteInput(req.body);
  if (normalized.error) {
    return sendFail(res, normalized.error, 400);
  }

  const { nickname, productId } = normalized.data;

  get("SELECT id FROM products WHERE id = ?", [productId])
    .then((productRow) => {
      if (!productRow) {
        return sendFail(res, "找不到此商品", 404);
      }

      return run(
        `
        INSERT INTO favorites (nickname, product_id)
        VALUES (?, ?)
        ON CONFLICT(nickname, product_id) DO NOTHING
        `,
        [nickname, productId]
      ).then((insertResult) => {
        const message = insertResult.changes > 0 ? "加入收藏成功" : "商品已在收藏清單中";
        return sendSuccess(res, message, { nickname, productId });
      });
    })
    .catch(() => sendFail(res, "資料庫寫入失敗", 500));
});

app.delete("/api/favorites", (req, res) => {
  const requestBody = req.body || {};

  const normalized = normalizeFavoriteInput({
    nickname: requestBody.nickname || req.query.nickname,
    productId: requestBody.productId || req.query.productId || req.query.product_id
  });

  if (normalized.error) {
    return sendFail(res, normalized.error, 400);
  }

  const { nickname, productId } = normalized.data;

  run("DELETE FROM favorites WHERE nickname = ? AND product_id = ?", [nickname, productId])
    .then((deleteResult) => {
      if (deleteResult.changes === 0) {
        return sendFail(res, "收藏清單中找不到此商品", 404);
      }

      return sendSuccess(res, "取消收藏成功", { nickname, productId });
    })
    .catch(() => sendFail(res, "資料庫寫入失敗", 500));
});

app.post("/api/products", (req, res) => {
  const validationError = validateProductInput(req.body);
  if (validationError) {
    return sendFail(res, validationError, 400);
  }

  const payload = {
    title: String(req.body.title).trim(),
    description: String(req.body.description).trim(),
    price: Number(req.body.price),
    category: req.body.category,
    image: String(req.body.image).trim(),
    status: req.body.status || "可購買",
    seller: String(req.body.seller).trim()
  };

  run(
    `
    INSERT INTO products (title, description, price, category, image, status, seller)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.title,
      payload.description,
      payload.price,
      payload.category,
      payload.image,
      payload.status,
      payload.seller
    ]
  )
    .then((insertResult) => {
      const productId = insertResult.lastID;
      return run(
        `
        INSERT INTO product_clicks (product_id, click_count)
        VALUES (?, 0)
        ON CONFLICT(product_id) DO NOTHING
        `,
        [productId]
      ).then(() =>
        get(
          `
          SELECT id, title, description, price, category, image, status, seller
          FROM products
          WHERE id = ?
          `,
          [productId]
        )
      );
    })
    .then((newProduct) => sendSuccess(res, "新增商品成功", newProduct, 201))
    .catch(() => sendFail(res, "資料庫寫入失敗", 500));
});

app.patch("/api/products/:id/status", (req, res) => {
  const productId = parseProductId(req.params.id);
  if (productId === null) {
    return sendFail(res, "商品編號格式錯誤", 400);
  }

  const { status } = req.body;
  if (!STATUSES.includes(status)) {
    return sendFail(res, `status 僅接受：${STATUSES.join("、")}`, 400);
  }

  get("SELECT id FROM products WHERE id = ?", [productId])
    .then((productRow) => {
      if (!productRow) {
        return sendFail(res, "找不到此商品", 404);
      }

      return run("UPDATE products SET status = ? WHERE id = ?", [status, productId]).then(() =>
        get(
          `
          SELECT id, title, description, price, category, image, status, seller
          FROM products
          WHERE id = ?
          `,
          [productId]
        ).then((updatedProduct) => sendSuccess(res, "更新商品狀態成功", updatedProduct))
      );
    })
    .catch(() => sendFail(res, "資料庫寫入失敗", 500));
});

app.delete("/api/products/:id", (req, res) => {
  const productId = parseProductId(req.params.id);
  if (productId === null) {
    return sendFail(res, "商品編號格式錯誤", 400);
  }

  get(
    `
    SELECT id, title, description, price, category, image, status, seller
    FROM products
    WHERE id = ?
    `,
    [productId]
  )
    .then((productRow) => {
      if (!productRow) {
        return sendFail(res, "找不到此商品", 404);
      }

      return run("DELETE FROM product_clicks WHERE product_id = ?", [productId])
        .then(() => run("DELETE FROM products WHERE id = ?", [productId]))
        .then(() => sendSuccess(res, "刪除商品成功", productRow));
    })
    .catch(() => sendFail(res, "資料庫寫入失敗", 500));
});

app.use((err, req, res, next) => {
  if (err && err.type === "entity.too.large") {
    return sendFail(res, `上傳內容過大，請將圖片壓縮到 ${BODY_SIZE_LIMIT} 以內再試`, 413);
  }

  return next(err);
});

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`SQLite path: ${DB_PATH}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });
