use crate::models::{ProductDto, ProductUnitDto};
use rusqlite::{params, Connection, Transaction};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&app_data_dir).map_err(|error| error.to_string())?;
    Ok(app_data_dir.join("pos.db"))
}

pub fn open_database(app: &AppHandle) -> Result<Connection, String> {
    let path = database_path(app)?;
    let conn = Connection::open(path).map_err(|error| error.to_string())?;
    conn.pragma_update(None, "foreign_keys", "ON")
        .map_err(|error| error.to_string())?;
    Ok(conn)
}

pub fn run_migrations(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin', 'kasir')),
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          description TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS units (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          symbol TEXT UNIQUE NOT NULL,
          description TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          sku TEXT UNIQUE,
          category_id TEXT,
          base_unit_id TEXT NOT NULL,
          stock_base REAL DEFAULT 0,
          minimum_stock REAL DEFAULT 0,
          purchase_price_base REAL DEFAULT 0,
          default_selling_price_base REAL DEFAULT 0,
          image_path TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (category_id) REFERENCES categories(id),
          FOREIGN KEY (base_unit_id) REFERENCES units(id)
        );

        CREATE TABLE IF NOT EXISTS product_units (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL,
          unit_id TEXT NOT NULL,
          conversion_to_base REAL NOT NULL,
          selling_price REAL NOT NULL,
          barcode TEXT UNIQUE,
          is_base_unit INTEGER DEFAULT 0,
          is_default INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (product_id) REFERENCES products(id),
          FOREIGN KEY (unit_id) REFERENCES units(id)
        );

        CREATE TABLE IF NOT EXISTS sales (
          id TEXT PRIMARY KEY,
          invoice_number TEXT UNIQUE NOT NULL,
          cashier_id TEXT NOT NULL,
          customer_name TEXT,
          total_gross REAL NOT NULL,
          discount REAL DEFAULT 0,
          total_net REAL NOT NULL,
          payment_method TEXT NOT NULL,
          paid_amount REAL NOT NULL,
          change_amount REAL NOT NULL,
          status TEXT DEFAULT 'COMPLETED',
          cancel_reason TEXT,
          cancelled_at TEXT,
          cancelled_by TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (cashier_id) REFERENCES users(id),
          FOREIGN KEY (cancelled_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS sale_items (
          id TEXT PRIMARY KEY,
          sale_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          product_unit_id TEXT NOT NULL,
          product_name_snapshot TEXT NOT NULL,
          unit_name_snapshot TEXT NOT NULL,
          qty REAL NOT NULL,
          conversion_to_base REAL NOT NULL,
          qty_base REAL NOT NULL,
          price REAL NOT NULL,
          purchase_price_base_snapshot REAL,
          subtotal REAL NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (sale_id) REFERENCES sales(id),
          FOREIGN KEY (product_id) REFERENCES products(id),
          FOREIGN KEY (product_unit_id) REFERENCES product_units(id)
        );

        CREATE TABLE IF NOT EXISTS stock_movements (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL,
          type TEXT NOT NULL,
          qty REAL NOT NULL,
          unit_id TEXT,
          conversion_to_base REAL,
          qty_base REAL NOT NULL,
          stock_before REAL NOT NULL,
          stock_after REAL NOT NULL,
          note TEXT,
          reference_type TEXT,
          reference_id TEXT,
          created_by TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (product_id) REFERENCES products(id),
          FOREIGN KEY (unit_id) REFERENCES units(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        );
        ",
    )
    .map_err(|error| error.to_string())?;

    ensure_column(conn, "products", "image_path", "TEXT")?;
    ensure_column(conn, "sale_items", "purchase_price_base_snapshot", "REAL")?;
    ensure_column(conn, "sales", "cashier_name_snapshot", "TEXT")?;

    Ok(())
}

fn ensure_column(
    conn: &Connection,
    table: &str,
    column: &str,
    definition: &str,
) -> Result<(), String> {
    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info({table})"))
        .map_err(|error| error.to_string())?;
    let columns = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    if columns.iter().any(|item| item == column) {
        return Ok(());
    }

    conn.execute(
        &format!("ALTER TABLE {table} ADD COLUMN {column} {definition}"),
        [],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn run_seed(conn: &Connection) -> Result<(), String> {
    seed_default_units(conn)?;
    repair_base_unit_prices(conn)?;
    Ok(())
}

fn repair_base_unit_prices(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "UPDATE product_units
         SET selling_price = (
           SELECT default_selling_price_base FROM products WHERE products.id = product_units.product_id
         ), updated_at = datetime('now')
         WHERE is_base_unit = 1",
        [],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn seed_default_units(conn: &Connection) -> Result<(), String> {
    let existing_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM units", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    if existing_count > 0 {
        return Ok(());
    }

    let defaults = [
        ("unit-pcs", "Pieces", "pcs"),
        ("unit-dus", "Dus", "dus"),
        ("unit-pack", "Pack", "pack"),
        ("unit-sak", "Sak", "sak"),
        ("unit-kg", "Kilogram", "kg"),
        ("unit-gram", "Gram", "gram"),
        ("unit-liter", "Liter", "liter"),
        ("unit-meter", "Meter", "meter"),
        ("unit-roll", "Roll", "roll"),
        ("unit-batang", "Batang", "batang"),
        ("unit-lembar", "Lembar", "lembar"),
        ("unit-ikat", "Ikat", "ikat"),
        ("unit-karung", "Karung", "karung"),
    ];

    for (id, name, symbol) in defaults {
        conn.execute(
            "INSERT OR IGNORE INTO units (id, name, symbol, description, created_at, updated_at)
             VALUES (?1, ?2, ?3, NULL, datetime('now'), datetime('now'))",
            params![id, name, symbol],
        )
        .map_err(|error| error.to_string())?;
    }

    Ok(())
}

pub fn upsert_setting(tx: &Transaction<'_>, key: &str, value: &str) -> Result<(), String> {
    tx.execute(
        "INSERT INTO settings (key, value, updated_at)
         VALUES (?1, ?2, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
        params![key, value],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn setting(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    Ok(conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .ok())
}

pub fn list_products(conn: &Connection) -> Result<Vec<ProductDto>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.name, p.sku, p.category_id, c.name, p.base_unit_id, bu.symbol,
                    p.stock_base, p.minimum_stock, p.purchase_price_base,
                    p.default_selling_price_base, p.is_active, p.image_path
             FROM products p
             LEFT JOIN categories c ON c.id = p.category_id
             JOIN units bu ON bu.id = p.base_unit_id
             ORDER BY p.name",
        )
        .map_err(|error| error.to_string())?;

    let product_rows = stmt
        .query_map([], |row| {
            Ok(ProductDto {
                id: row.get(0)?,
                name: row.get(1)?,
                sku: row.get(2)?,
                category_id: row.get(3)?,
                category_name: row.get(4)?,
                base_unit_id: row.get(5)?,
                base_unit_name: row.get(6)?,
                stock_base: row.get(7)?,
                minimum_stock: row.get(8)?,
                purchase_price_base: row.get(9)?,
                default_selling_price_base: row.get(10)?,
                is_active: row.get::<_, i64>(11)? == 1,
                image_path: row.get(12)?,
                units: Vec::new(),
            })
        })
        .map_err(|error| error.to_string())?;

    let mut products = product_rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    for product in &mut products {
        product.units = list_product_units(conn, &product.id)?;
    }

    Ok(products)
}

pub fn get_product(conn: &Connection, product_id: &str) -> Result<ProductDto, String> {
    let mut product = conn
        .query_row(
            "SELECT p.id, p.name, p.sku, p.category_id, c.name, p.base_unit_id, bu.symbol,
                    p.stock_base, p.minimum_stock, p.purchase_price_base,
                    p.default_selling_price_base, p.is_active, p.image_path
             FROM products p
             LEFT JOIN categories c ON c.id = p.category_id
             JOIN units bu ON bu.id = p.base_unit_id
             WHERE p.id = ?1",
            params![product_id],
            |row| {
                Ok(ProductDto {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    sku: row.get(2)?,
                    category_id: row.get(3)?,
                    category_name: row.get(4)?,
                    base_unit_id: row.get(5)?,
                    base_unit_name: row.get(6)?,
                    stock_base: row.get(7)?,
                    minimum_stock: row.get(8)?,
                    purchase_price_base: row.get(9)?,
                    default_selling_price_base: row.get(10)?,
                    is_active: row.get::<_, i64>(11)? == 1,
                    image_path: row.get(12)?,
                    units: Vec::new(),
                })
            },
        )
        .map_err(|error| error.to_string())?;

    product.units = list_product_units(conn, product_id)?;
    Ok(product)
}

fn list_product_units(conn: &Connection, product_id: &str) -> Result<Vec<ProductUnitDto>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT pu.id, pu.product_id, pu.unit_id, u.symbol, pu.conversion_to_base,
                    pu.selling_price, pu.barcode, pu.is_base_unit, pu.is_default
             FROM product_units pu
             JOIN units u ON u.id = pu.unit_id
             WHERE pu.product_id = ?1
             ORDER BY pu.is_default DESC, pu.is_base_unit DESC, u.symbol",
        )
        .map_err(|error| error.to_string())?;

    let rows = stmt
        .query_map(params![product_id], |row| {
            Ok(ProductUnitDto {
                id: row.get(0)?,
                product_id: row.get(1)?,
                unit_id: row.get(2)?,
                unit_name: row.get(3)?,
                conversion_to_base: row.get(4)?,
                selling_price: row.get(5)?,
                barcode: row.get(6)?,
                is_base_unit: row.get::<_, i64>(7)? == 1,
                is_default: row.get::<_, i64>(8)? == 1,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}
