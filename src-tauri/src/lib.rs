mod db;
mod models;
mod printer;

use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use db::{open_database, run_migrations, run_seed};
use models::{
    CancelSaleInput, CategoryDto, CompleteSaleInput, CompleteSetupInput, DeleteByIdInput,
    DeleteProductResultDto, LoginInput, PrinterDto, ProductDto, ResetUserPasswordInput, SaleDto,
    SaleItemDto, SaveCategoryInput, SaveProductInput, SaveProductUnitInput, SaveStoreSettingsInput,
    SaveUnitInput, SaveUserInput, SetUserActiveInput, SetupStatusDto, StockAdjustmentInput,
    StockInInput, StockMovementDto, StoreSettingsDto, UnitDto, UserAccountDto, UserDto,
};
use rusqlite::{params, Connection};
use std::fs;
use std::path::{Component, Path, PathBuf};
use tauri::AppHandle;
use tauri::Manager;

type CommandResult<T> = Result<T, String>;
const BACKUP_MAGIC: &[u8] = b"POSTOKO_BACKUP_V1\n";

#[tauri::command]
fn get_setup_status(app: AppHandle) -> CommandResult<SetupStatusDto> {
    let conn = open_database(&app)?;
    run_migrations(&conn)?;

    let store_name: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'store_name' AND TRIM(COALESCE(value, '')) <> ''",
            [],
            |row| row.get(0),
        )
        .ok();

    let admin_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM users WHERE role = 'admin'",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    Ok(SetupStatusDto {
        is_setup_complete: store_name.is_some() && admin_count > 0,
        database_path: db::database_path(&app)?.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn complete_initial_setup(app: AppHandle, input: CompleteSetupInput) -> CommandResult<UserDto> {
    let mut conn = open_database(&app)?;
    run_migrations(&conn)?;

    if input.store_name.trim().is_empty()
        || input.admin_name.trim().is_empty()
        || input.username.trim().is_empty()
        || input.password.len() < 4
    {
        return Err("Data setup belum lengkap.".to_string());
    }

    let tx = conn.transaction().map_err(|error| error.to_string())?;
    db::upsert_setting(&tx, "store_name", input.store_name.trim())?;
    db::upsert_setting(&tx, "store_address", input.store_address.trim())?;
    db::upsert_setting(&tx, "store_phone", input.store_phone.trim())?;
    db::upsert_setting(&tx, "receipt_footer", "Terima kasih")?;
    db::upsert_setting(&tx, "receipt_paper_size", "80mm")?;
    db::upsert_setting(&tx, "currency", "IDR")?;
    db::upsert_setting(&tx, "receipt_logo_path", "")?;

    let user_id = uuid::Uuid::new_v4().to_string();
    let password_hash =
        bcrypt::hash(input.password, bcrypt::DEFAULT_COST).map_err(|error| error.to_string())?;

    tx.execute(
        "INSERT INTO users (id, name, username, password_hash, role, is_active, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 'admin', 1, datetime('now'), datetime('now'))",
        params![user_id, input.admin_name.trim(), input.username.trim(), password_hash],
    )
    .map_err(|error| error.to_string())?;
    tx.commit().map_err(|error| error.to_string())?;

    Ok(UserDto {
        id: user_id,
        name: input.admin_name,
        username: input.username,
        role: "admin".to_string(),
    })
}

#[tauri::command]
fn login(app: AppHandle, input: LoginInput) -> CommandResult<UserDto> {
    let conn = open_database(&app)?;
    run_migrations(&conn)?;

    let user = conn
        .query_row(
            "SELECT id, name, username, role, password_hash FROM users WHERE username = ?1 AND is_active = 1",
            params![input.username.trim()],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                ))
            },
        )
        .map_err(|_| "Username atau password tidak valid.".to_string())?;

    let password_ok = bcrypt::verify(input.password, &user.4).map_err(|error| error.to_string())?;
    if !password_ok {
        return Err("Username atau password tidak valid.".to_string());
    }

    Ok(UserDto {
        id: user.0,
        name: user.1,
        username: user.2,
        role: user.3,
    })
}

#[tauri::command]
fn get_user_session(app: AppHandle, user_id: String) -> CommandResult<UserDto> {
    let conn = open_database(&app)?;
    run_migrations(&conn)?;

    conn.query_row(
        "SELECT id, name, username, role FROM users WHERE id = ?1 AND is_active = 1",
        params![user_id],
        |row| {
            Ok(UserDto {
                id: row.get(0)?,
                name: row.get(1)?,
                username: row.get(2)?,
                role: row.get(3)?,
            })
        },
    )
    .map_err(|_| "Sesi login tidak valid atau akun sudah dinonaktifkan.".to_string())
}

#[tauri::command]
fn list_users(app: AppHandle) -> CommandResult<Vec<UserAccountDto>> {
    let conn = open_database(&app)?;
    run_migrations(&conn)?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, username, role, is_active, created_at, updated_at
             FROM users
             ORDER BY is_active DESC, role ASC, name ASC",
        )
        .map_err(|error| error.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(UserAccountDto {
                id: row.get(0)?,
                name: row.get(1)?,
                username: row.get(2)?,
                role: row.get(3)?,
                is_active: row.get::<_, i64>(4)? == 1,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_user(app: AppHandle, input: SaveUserInput) -> CommandResult<UserAccountDto> {
    let conn = open_database(&app)?;
    run_migrations(&conn)?;

    validate_user_role(&input.role)?;
    let name = input.name.trim();
    let username = input.username.trim();
    if name.is_empty() || username.is_empty() {
        return Err("Nama dan username wajib diisi.".to_string());
    }

    let password = normalize_optional(input.password.clone());
    if input.id.is_none() && password.as_deref().unwrap_or_default().len() < 6 {
        return Err("Password akun baru minimal 6 karakter.".to_string());
    }
    if let Some(value) = password.as_deref() {
        if value.len() < 6 {
            return Err("Password minimal 6 karakter.".to_string());
        }
    }

    let user_id = input
        .id
        .clone()
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let existing = input
        .id
        .as_deref()
        .map(|id| load_user_guard_fields(&conn, id))
        .transpose()?;

    if let Some((existing_role, existing_active)) = &existing {
        if input.current_user_id == user_id && (*existing_role != input.role || !input.is_active) {
            return Err("Akun yang sedang login tidak boleh mengubah role atau menonaktifkan dirinya sendiri.".to_string());
        }
        if existing_role == "admin" && *existing_active {
            let active_admin_count = active_admin_count(&conn)?;
            if active_admin_count <= 1 && (input.role != "admin" || !input.is_active) {
                return Err(
                    "Admin aktif terakhir tidak boleh dinonaktifkan atau diubah menjadi kasir."
                        .to_string(),
                );
            }
        }
    }

    if existing.is_none() {
        let password_hash = bcrypt::hash(
            password.as_deref().unwrap_or_default(),
            bcrypt::DEFAULT_COST,
        )
        .map_err(|error| error.to_string())?;
        conn.execute(
            "INSERT INTO users (id, name, username, password_hash, role, is_active, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'), datetime('now'))",
            params![
                &user_id,
                name,
                username,
                password_hash,
                &input.role,
                bool_to_i64(input.is_active),
            ],
        )
        .map_err(map_sql_error)?;
    } else if let Some(value) = password.as_deref() {
        let password_hash =
            bcrypt::hash(value, bcrypt::DEFAULT_COST).map_err(|error| error.to_string())?;
        conn.execute(
            "UPDATE users
             SET name = ?1, username = ?2, password_hash = ?3, role = ?4, is_active = ?5, updated_at = datetime('now')
             WHERE id = ?6",
            params![
                name,
                username,
                password_hash,
                &input.role,
                bool_to_i64(input.is_active),
                &user_id,
            ],
        )
        .map_err(map_sql_error)?;
    } else {
        conn.execute(
            "UPDATE users
             SET name = ?1, username = ?2, role = ?3, is_active = ?4, updated_at = datetime('now')
             WHERE id = ?5",
            params![
                name,
                username,
                &input.role,
                bool_to_i64(input.is_active),
                &user_id,
            ],
        )
        .map_err(map_sql_error)?;
    }

    load_user_account(&conn, &user_id)
}

#[tauri::command]
fn set_user_active(app: AppHandle, input: SetUserActiveInput) -> CommandResult<UserAccountDto> {
    let conn = open_database(&app)?;
    run_migrations(&conn)?;

    if input.current_user_id == input.id && !input.is_active {
        return Err(
            "Akun yang sedang login tidak boleh menonaktifkan dirinya sendiri.".to_string(),
        );
    }

    let (role, is_active) = load_user_guard_fields(&conn, &input.id)?;
    if role == "admin" && is_active && !input.is_active && active_admin_count(&conn)? <= 1 {
        return Err("Admin aktif terakhir tidak boleh dinonaktifkan.".to_string());
    }

    conn.execute(
        "UPDATE users SET is_active = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![bool_to_i64(input.is_active), &input.id],
    )
    .map_err(map_sql_error)?;

    load_user_account(&conn, &input.id)
}

#[tauri::command]
fn reset_user_password(
    app: AppHandle,
    input: ResetUserPasswordInput,
) -> CommandResult<UserAccountDto> {
    let conn = open_database(&app)?;
    run_migrations(&conn)?;

    if input.password.len() < 6 {
        return Err("Password minimal 6 karakter.".to_string());
    }
    let password_hash =
        bcrypt::hash(input.password, bcrypt::DEFAULT_COST).map_err(|error| error.to_string())?;
    conn.execute(
        "UPDATE users SET password_hash = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![password_hash, &input.id],
    )
    .map_err(map_sql_error)?;

    load_user_account(&conn, &input.id)
}

#[tauri::command]
fn get_store_settings(app: AppHandle) -> CommandResult<StoreSettingsDto> {
    let conn = open_database(&app)?;
    run_migrations(&conn)?;

    load_store_settings(&conn)
}

#[tauri::command]
fn save_store_settings(
    app: AppHandle,
    input: SaveStoreSettingsInput,
) -> CommandResult<StoreSettingsDto> {
    let mut conn = open_database(&app)?;
    run_migrations(&conn)?;

    if input.store_name.trim().is_empty() {
        return Err("Nama toko wajib diisi.".to_string());
    }
    if input.receipt_paper_size != "58mm" && input.receipt_paper_size != "80mm" {
        return Err("Ukuran kertas harus 58mm atau 80mm.".to_string());
    }

    let receipt_logo_path = resolve_receipt_logo_path(&app, &input)?;

    let tx = conn.transaction().map_err(|error| error.to_string())?;
    db::upsert_setting(&tx, "store_name", input.store_name.trim())?;
    db::upsert_setting(&tx, "store_address", input.store_address.trim())?;
    db::upsert_setting(&tx, "store_phone", input.store_phone.trim())?;
    db::upsert_setting(&tx, "receipt_footer", input.receipt_footer.trim())?;
    db::upsert_setting(&tx, "receipt_paper_size", &input.receipt_paper_size)?;
    db::upsert_setting(&tx, "currency", input.currency.trim())?;
    db::upsert_setting(
        &tx,
        "printer_name",
        input.printer_name.as_deref().unwrap_or("").trim(),
    )?;
    db::upsert_setting(
        &tx,
        "receipt_logo_path",
        receipt_logo_path.as_deref().unwrap_or(""),
    )?;
    tx.commit().map_err(|error| error.to_string())?;

    load_store_settings(&conn)
}

#[tauri::command]
fn list_printers() -> CommandResult<Vec<PrinterDto>> {
    printer::list_windows_printers().map(|printers| {
        printers
            .into_iter()
            .map(|name| PrinterDto { name })
            .collect()
    })
}

#[tauri::command]
fn test_print(app: AppHandle) -> CommandResult<()> {
    let conn = open_database(&app)?;
    run_migrations(&conn)?;
    let settings = load_store_settings(&conn)?;
    let printer_name = settings
        .printer_name
        .as_deref()
        .ok_or_else(|| "Pilih printer thermal di Pengaturan terlebih dahulu.".to_string())?;
    let bytes = printer::build_test_receipt(&settings);
    printer::print_raw(printer_name, "POS TOKO Test Print", &bytes)
}

#[tauri::command]
fn print_receipt(app: AppHandle, sale: SaleDto) -> CommandResult<()> {
    let conn = open_database(&app)?;
    run_migrations(&conn)?;
    let settings = load_store_settings(&conn)?;
    let printer_name = settings
        .printer_name
        .as_deref()
        .ok_or_else(|| "Pilih printer thermal di Pengaturan terlebih dahulu.".to_string())?;
    let bytes = printer::build_receipt(&settings, &sale);
    printer::print_raw(
        printer_name,
        &format!("POS TOKO {}", sale.invoice_number),
        &bytes,
    )
}

fn load_store_settings(conn: &rusqlite::Connection) -> CommandResult<StoreSettingsDto> {
    let printer_name = db::setting(conn, "printer_name")?.and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    });

    Ok(StoreSettingsDto {
        store_name: db::setting(conn, "store_name")?.unwrap_or_else(|| "POS TOKO".to_string()),
        store_address: db::setting(conn, "store_address")?.unwrap_or_default(),
        store_phone: db::setting(conn, "store_phone")?.unwrap_or_default(),
        receipt_footer: db::setting(conn, "receipt_footer")?
            .unwrap_or_else(|| "Terima kasih".to_string()),
        receipt_paper_size: db::setting(conn, "receipt_paper_size")?
            .unwrap_or_else(|| "80mm".to_string()),
        currency: db::setting(conn, "currency")?.unwrap_or_else(|| "IDR".to_string()),
        printer_name,
        receipt_logo_path: db::setting(conn, "receipt_logo_path")?
            .and_then(|value| normalize_optional(Some(value))),
    })
}

fn validate_user_role(role: &str) -> CommandResult<()> {
    if role == "admin" || role == "kasir" {
        Ok(())
    } else {
        Err("Role user harus admin atau kasir.".to_string())
    }
}

fn active_admin_count(conn: &Connection) -> CommandResult<i64> {
    conn.query_row(
        "SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = 1",
        [],
        |row| row.get(0),
    )
    .map_err(|error| error.to_string())
}

fn load_user_guard_fields(conn: &Connection, id: &str) -> CommandResult<(String, bool)> {
    conn.query_row(
        "SELECT role, is_active FROM users WHERE id = ?1",
        params![id],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)? == 1)),
    )
    .map_err(|_| "Akun pengguna tidak ditemukan.".to_string())
}

fn load_user_account(conn: &Connection, id: &str) -> CommandResult<UserAccountDto> {
    conn.query_row(
        "SELECT id, name, username, role, is_active, created_at, updated_at FROM users WHERE id = ?1",
        params![id],
        |row| {
            Ok(UserAccountDto {
                id: row.get(0)?,
                name: row.get(1)?,
                username: row.get(2)?,
                role: row.get(3)?,
                is_active: row.get::<_, i64>(4)? == 1,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    )
    .map_err(|_| "Akun pengguna tidak ditemukan.".to_string())
}

#[tauri::command]
fn list_categories(app: AppHandle) -> CommandResult<Vec<CategoryDto>> {
    let conn = open_database(&app)?;
    run_migrations(&conn)?;

    let mut stmt = conn
        .prepare("SELECT id, name, description FROM categories ORDER BY name")
        .map_err(|error| error.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(CategoryDto {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_category(app: AppHandle, input: SaveCategoryInput) -> CommandResult<CategoryDto> {
    let conn = open_database(&app)?;
    run_migrations(&conn)?;
    let name = input.name.trim();
    if name.is_empty() {
        return Err("Nama kategori wajib diisi.".to_string());
    }

    let id = input.id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let description = normalize_optional(input.description);
    conn.execute(
        "INSERT INTO categories (id, name, description, created_at, updated_at)
         VALUES (?1, ?2, ?3, datetime('now'), datetime('now'))
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description, updated_at = datetime('now')",
        params![&id, name, &description],
    )
    .map_err(map_sql_error)?;

    Ok(CategoryDto {
        id,
        name: name.to_string(),
        description,
    })
}

#[tauri::command]
fn delete_category(app: AppHandle, input: DeleteByIdInput) -> CommandResult<()> {
    let conn = open_database(&app)?;
    run_migrations(&conn)?;
    let used_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM products WHERE category_id = ?1",
            params![input.id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if used_count > 0 {
        return Err("Kategori sudah dipakai produk dan tidak dapat dihapus.".to_string());
    }

    conn.execute("DELETE FROM categories WHERE id = ?1", params![input.id])
        .map_err(map_sql_error)?;
    Ok(())
}

#[tauri::command]
fn list_units(app: AppHandle) -> CommandResult<Vec<UnitDto>> {
    let conn = open_database(&app)?;
    run_migrations(&conn)?;

    let mut stmt = conn
        .prepare("SELECT id, name, symbol, description FROM units ORDER BY symbol")
        .map_err(|error| error.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(UnitDto {
                id: row.get(0)?,
                name: row.get(1)?,
                symbol: row.get(2)?,
                description: row.get(3)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_unit(app: AppHandle, input: SaveUnitInput) -> CommandResult<UnitDto> {
    let conn = open_database(&app)?;
    run_migrations(&conn)?;
    let name = input.name.trim();
    let symbol = input.symbol.trim();
    if name.is_empty() || symbol.is_empty() {
        return Err("Nama dan symbol satuan wajib diisi.".to_string());
    }

    let id = input.id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let description = normalize_optional(input.description);
    conn.execute(
        "INSERT INTO units (id, name, symbol, description, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now'), datetime('now'))
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, symbol = excluded.symbol, description = excluded.description, updated_at = datetime('now')",
        params![&id, name, symbol, &description],
    )
    .map_err(map_sql_error)?;

    Ok(UnitDto {
        id,
        name: name.to_string(),
        symbol: symbol.to_string(),
        description,
    })
}

#[tauri::command]
fn delete_unit(app: AppHandle, input: DeleteByIdInput) -> CommandResult<()> {
    let conn = open_database(&app)?;
    run_migrations(&conn)?;
    let used_count: i64 = conn
        .query_row(
            "SELECT
               (SELECT COUNT(*) FROM products WHERE base_unit_id = ?1) +
               (SELECT COUNT(*) FROM product_units WHERE unit_id = ?1) +
               (SELECT COUNT(*) FROM stock_movements WHERE unit_id = ?1)",
            params![input.id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if used_count > 0 {
        return Err("Satuan sudah dipakai produk dan tidak dapat dihapus.".to_string());
    }

    conn.execute("DELETE FROM units WHERE id = ?1", params![input.id])
        .map_err(map_sql_error)?;
    Ok(())
}

#[tauri::command]
fn list_products(app: AppHandle) -> CommandResult<Vec<ProductDto>> {
    let conn = open_database(&app)?;
    run_migrations(&conn)?;
    db::list_products(&conn)
}

fn generate_sku(tx: &rusqlite::Transaction<'_>) -> CommandResult<String> {
    let max_num: Option<i64> = tx
        .query_row(
            "SELECT MAX(CAST(SUBSTR(sku, 5) AS INTEGER)) FROM products WHERE sku LIKE 'PRD-%'",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    let next = max_num.unwrap_or(0) + 1;
    Ok(format!("PRD-{next:04}"))
}

#[tauri::command]
fn save_product(app: AppHandle, input: SaveProductInput) -> CommandResult<ProductDto> {
    let mut conn = open_database(&app)?;
    run_migrations(&conn)?;
    validate_product_input(&input)?;

    let product_id = input
        .id
        .clone()
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let image_path = resolve_product_image_path(&app, &product_id, &input)?;
    let tx = conn.transaction().map_err(|error| error.to_string())?;
    let sku = normalize_optional(input.sku.clone()).or_else(|| generate_sku(&tx).ok());
    let category_id = normalize_optional(input.category_id.clone());

    tx.execute(
        "INSERT INTO products (
            id, name, sku, category_id, base_unit_id, stock_base, minimum_stock,
            purchase_price_base, default_selling_price_base, image_path, is_active, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, datetime('now'), datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            sku = excluded.sku,
            category_id = excluded.category_id,
            base_unit_id = excluded.base_unit_id,
            stock_base = excluded.stock_base,
            minimum_stock = excluded.minimum_stock,
            purchase_price_base = excluded.purchase_price_base,
            default_selling_price_base = excluded.default_selling_price_base,
            image_path = excluded.image_path,
            is_active = excluded.is_active,
            updated_at = datetime('now')",
        params![
            &product_id,
            input.name.trim(),
            sku,
            category_id,
            &input.base_unit_id,
            input.stock_base,
            input.minimum_stock,
            input.purchase_price_base,
            input.default_selling_price_base,
            image_path,
            bool_to_i64(input.is_active),
        ],
    )
    .map_err(map_sql_error)?;

    let units = normalized_product_units(&input);

    let incoming_ids: Vec<String> = units.iter().filter_map(|unit| unit.id.clone()).collect();

    let existing_ids: Vec<String> = {
        let mut stmt = tx
            .prepare("SELECT id FROM product_units WHERE product_id = ?1")
            .map_err(|error| error.to_string())?;
        let rows = stmt
            .query_map(params![product_id], |row| row.get::<_, String>(0))
            .map_err(|error| error.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?
    };

    for existing_id in &existing_ids {
        if incoming_ids.contains(existing_id) {
            continue;
        }
        let usage_count: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM sale_items WHERE product_unit_id = ?1",
                params![existing_id],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?;
        if usage_count > 0 {
            return Err(
                "Satuan jual tidak dapat dihapus karena sudah dipakai dalam transaksi.".to_string(),
            );
        }
        tx.execute(
            "DELETE FROM product_units WHERE id = ?1",
            params![existing_id],
        )
        .map_err(map_sql_error)?;
    }

    for unit in units {
        let unit_id = unit.id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        tx.execute(
            "INSERT INTO product_units (
                id, product_id, unit_id, conversion_to_base, selling_price, barcode,
                is_base_unit, is_default, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'), datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
                unit_id = excluded.unit_id,
                conversion_to_base = excluded.conversion_to_base,
                selling_price = excluded.selling_price,
                barcode = excluded.barcode,
                is_base_unit = excluded.is_base_unit,
                is_default = excluded.is_default,
                updated_at = datetime('now')",
            params![
                &unit_id,
                &product_id,
                &unit.unit_id,
                unit.conversion_to_base,
                unit.selling_price,
                normalize_optional(unit.barcode),
                bool_to_i64(unit.is_base_unit),
                bool_to_i64(unit.is_default),
            ],
        )
        .map_err(map_sql_error)?;
    }

    tx.commit().map_err(|error| error.to_string())?;
    db::get_product(&conn, &product_id)
}

#[tauri::command]
fn delete_product(app: AppHandle, input: DeleteByIdInput) -> CommandResult<DeleteProductResultDto> {
    let mut conn = open_database(&app)?;
    run_migrations(&conn)?;
    let product_name: String = conn
        .query_row(
            "SELECT name FROM products WHERE id = ?1",
            params![&input.id],
            |row| row.get(0),
        )
        .map_err(|_| "Produk tidak ditemukan.".to_string())?;
    let used_count: i64 = conn
        .query_row(
            "SELECT
               (SELECT COUNT(*) FROM sale_items WHERE product_id = ?1) +
               (SELECT COUNT(*) FROM stock_movements WHERE product_id = ?1)",
            params![&input.id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    if used_count > 0 {
        conn.execute(
            "UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ?1",
            params![&input.id],
        )
        .map_err(map_sql_error)?;
        return Ok(DeleteProductResultDto {
            action: "deactivated".to_string(),
            message: format!(
                "Produk \"{product_name}\" sudah memiliki riwayat transaksi/stok, jadi tidak dihapus permanen dan hanya dinonaktifkan."
            ),
        });
    }

    let tx = conn.transaction().map_err(|error| error.to_string())?;
    tx.execute(
        "DELETE FROM product_units WHERE product_id = ?1",
        params![&input.id],
    )
    .map_err(map_sql_error)?;
    tx.execute("DELETE FROM products WHERE id = ?1", params![&input.id])
        .map_err(map_sql_error)?;
    tx.commit().map_err(|error| error.to_string())?;
    Ok(DeleteProductResultDto {
        action: "deleted".to_string(),
        message: format!(
            "Produk \"{product_name}\" berhasil dihapus permanen karena belum memiliki riwayat transaksi/stok."
        ),
    })
}

#[tauri::command]
fn add_stock(app: AppHandle, input: StockInInput) -> CommandResult<ProductDto> {
    let mut conn = open_database(&app)?;
    run_migrations(&conn)?;

    if input.product_id.trim().is_empty() || input.product_unit_id.trim().is_empty() {
        return Err("Produk dan satuan wajib dipilih.".to_string());
    }
    if input.qty <= 0.0 {
        return Err("Qty stok masuk harus lebih dari 0.".to_string());
    }

    let tx = conn.transaction().map_err(|error| error.to_string())?;
    let stock_before: f64 = tx
        .query_row(
            "SELECT stock_base FROM products WHERE id = ?1",
            params![&input.product_id],
            |row| row.get(0),
        )
        .map_err(|_| "Produk tidak ditemukan.".to_string())?;

    let (unit_id, conversion_to_base): (String, f64) = tx
        .query_row(
            "SELECT unit_id, conversion_to_base FROM product_units WHERE id = ?1 AND product_id = ?2",
            params![&input.product_unit_id, &input.product_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Satuan produk tidak valid.".to_string())?;

    let qty_base = input.qty * conversion_to_base;
    let stock_after = stock_before + qty_base;
    tx.execute(
        "UPDATE products SET stock_base = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![stock_after, &input.product_id],
    )
    .map_err(map_sql_error)?;

    let movement_id = uuid::Uuid::new_v4().to_string();
    tx.execute(
        "INSERT INTO stock_movements (
            id, product_id, type, qty, unit_id, conversion_to_base, qty_base,
            stock_before, stock_after, note, reference_type, reference_id, created_by, created_at
         ) VALUES (?1, ?2, 'IN', ?3, ?4, ?5, ?6, ?7, ?8, ?9, NULL, NULL, ?10, datetime('now'))",
        params![
            movement_id,
            &input.product_id,
            input.qty,
            unit_id,
            conversion_to_base,
            qty_base,
            stock_before,
            stock_after,
            normalize_optional(input.note),
            normalize_optional(input.created_by),
        ],
    )
    .map_err(map_sql_error)?;
    tx.commit().map_err(|error| error.to_string())?;

    db::get_product(&conn, &input.product_id)
}

#[tauri::command]
fn adjust_stock(app: AppHandle, input: StockAdjustmentInput) -> CommandResult<ProductDto> {
    let mut conn = open_database(&app)?;
    run_migrations(&conn)?;

    if input.product_id.trim().is_empty() {
        return Err("Produk wajib dipilih.".to_string());
    }
    if input.physical_stock_base < 0.0 {
        return Err("Stok fisik tidak boleh negatif.".to_string());
    }
    if input.note.trim().is_empty() {
        return Err("Alasan penyesuaian wajib diisi.".to_string());
    }

    let tx = conn.transaction().map_err(|error| error.to_string())?;
    let stock_before: f64 = tx
        .query_row(
            "SELECT stock_base FROM products WHERE id = ?1",
            params![&input.product_id],
            |row| row.get(0),
        )
        .map_err(|_| "Produk tidak ditemukan.".to_string())?;

    let stock_after = input.physical_stock_base;
    let qty_base = stock_after - stock_before;
    tx.execute(
        "UPDATE products SET stock_base = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![stock_after, &input.product_id],
    )
    .map_err(map_sql_error)?;

    let movement_id = uuid::Uuid::new_v4().to_string();
    tx.execute(
        "INSERT INTO stock_movements (
            id, product_id, type, qty, unit_id, conversion_to_base, qty_base,
            stock_before, stock_after, note, reference_type, reference_id, created_by, created_at
         ) VALUES (?1, ?2, 'ADJUSTMENT', ?3, NULL, NULL, ?3, ?4, ?5, ?6, NULL, NULL, ?7, datetime('now'))",
        params![
            movement_id,
            &input.product_id,
            qty_base,
            stock_before,
            stock_after,
            input.note.trim(),
            normalize_optional(input.created_by),
        ],
    )
    .map_err(map_sql_error)?;
    tx.commit().map_err(|error| error.to_string())?;

    db::get_product(&conn, &input.product_id)
}

#[tauri::command]
fn list_stock_movements(app: AppHandle) -> CommandResult<Vec<StockMovementDto>> {
    let conn = open_database(&app)?;
    run_migrations(&conn)?;

    let mut stmt = conn
        .prepare(
            "SELECT sm.id, sm.product_id, p.name, sm.type, sm.qty, sm.unit_id, u.symbol,
                    sm.conversion_to_base, sm.qty_base, sm.stock_before, sm.stock_after,
                    sm.note, sm.reference_type, sm.reference_id, sm.created_by, sm.created_at
             FROM stock_movements sm
             JOIN products p ON p.id = sm.product_id
             LEFT JOIN units u ON u.id = sm.unit_id
              ORDER BY sm.created_at DESC",
        )
        .map_err(|error| error.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(StockMovementDto {
                id: row.get(0)?,
                product_id: row.get(1)?,
                product_name: row.get(2)?,
                movement_type: row.get(3)?,
                qty: row.get(4)?,
                unit_id: row.get(5)?,
                unit_name: row.get(6)?,
                conversion_to_base: row.get(7)?,
                qty_base: row.get(8)?,
                stock_before: row.get(9)?,
                stock_after: row.get(10)?,
                note: row.get(11)?,
                reference_type: row.get(12)?,
                reference_id: row.get(13)?,
                created_by: row.get(14)?,
                created_at: row.get(15)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn validate_product_input(input: &SaveProductInput) -> CommandResult<()> {
    if input.name.trim().is_empty() {
        return Err("Nama produk wajib diisi.".to_string());
    }
    if input.base_unit_id.trim().is_empty() {
        return Err("Satuan dasar wajib dipilih.".to_string());
    }
    if input.stock_base < 0.0
        || input.minimum_stock < 0.0
        || input.purchase_price_base < 0.0
        || input.default_selling_price_base < 0.0
    {
        return Err("Stok dan harga tidak boleh negatif.".to_string());
    }
    for unit in &input.units {
        if unit.unit_id.trim().is_empty() {
            return Err("Satuan jual wajib dipilih.".to_string());
        }
        if unit.conversion_to_base <= 0.0 {
            return Err("Konversi satuan harus lebih dari 0.".to_string());
        }
        if unit.selling_price < 0.0 {
            return Err("Harga jual tidak boleh negatif.".to_string());
        }
    }
    Ok(())
}

fn normalized_product_units(input: &SaveProductInput) -> Vec<SaveProductUnitInput> {
    let mut units: Vec<SaveProductUnitInput> = input
        .units
        .iter()
        .map(|unit| SaveProductUnitInput {
            id: unit.id.clone(),
            unit_id: unit.unit_id.clone(),
            conversion_to_base: unit.conversion_to_base,
            selling_price: unit.selling_price,
            barcode: unit.barcode.clone(),
            is_base_unit: unit.unit_id == input.base_unit_id,
            is_default: unit.is_default,
        })
        .collect();

    if !units.iter().any(|unit| unit.unit_id == input.base_unit_id) {
        units.insert(
            0,
            SaveProductUnitInput {
                id: None,
                unit_id: input.base_unit_id.clone(),
                conversion_to_base: 1.0,
                selling_price: input.default_selling_price_base,
                barcode: None,
                is_base_unit: true,
                is_default: true,
            },
        );
    }

    let mut default_seen = false;
    for unit in &mut units {
        if unit.is_base_unit {
            unit.conversion_to_base = 1.0;
            unit.selling_price = input.default_selling_price_base;
        }
        if unit.is_default && !default_seen {
            default_seen = true;
        } else {
            unit.is_default = false;
        }
    }

    if !default_seen {
        if let Some(base_unit) = units.iter_mut().find(|unit| unit.is_base_unit) {
            base_unit.is_default = true;
        }
    }

    units
}

#[tauri::command]
fn complete_sale(app: AppHandle, input: CompleteSaleInput) -> CommandResult<SaleDto> {
    let mut conn = open_database(&app)?;
    run_migrations(&conn)?;

    if input.cashier_id.trim().is_empty() || input.cashier_name.trim().is_empty() {
        return Err("Kasir tidak valid.".to_string());
    }
    if input.items.is_empty() {
        return Err("Keranjang masih kosong.".to_string());
    }
    if input.discount < 0.0 || input.paid_amount < 0.0 {
        return Err("Nominal pembayaran tidak valid.".to_string());
    }

    let tx = conn.transaction().map_err(|error| error.to_string())?;
    let sale_id = uuid::Uuid::new_v4().to_string();
    let invoice_number = next_invoice_number(&tx)?;
    let created_at: String = tx
        .query_row("SELECT datetime('now')", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    let customer_name = normalize_optional(input.customer_name.clone());
    let mut sale_items = Vec::new();
    let mut total_gross = 0.0;

    tx.execute(
        "INSERT INTO sales (
            id, invoice_number, cashier_id, customer_name, total_gross, discount,
            total_net, payment_method, paid_amount, change_amount, status,
            cashier_name_snapshot, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, 0, 0, 0, ?5, ?6, 0, 'COMPLETED', ?7, datetime('now'), datetime('now'))",
        params![
            &sale_id,
            &invoice_number,
            &input.cashier_id,
            &customer_name,
            &input.payment_method,
            input.paid_amount,
            &input.cashier_name,
        ],
    )
    .map_err(map_sql_error)?;

    for item in input.items {
        if item.qty <= 0.0 {
            return Err("Qty item harus lebih dari 0.".to_string());
        }

        let product = tx
            .query_row(
                "SELECT p.name, p.stock_base, p.purchase_price_base, pu.unit_id, u.symbol,
                        pu.conversion_to_base, pu.selling_price
                 FROM products p
                 JOIN product_units pu ON pu.product_id = p.id
                 JOIN units u ON u.id = pu.unit_id
                 WHERE p.id = ?1 AND pu.id = ?2 AND p.is_active = 1",
                params![&item.product_id, &item.product_unit_id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, f64>(1)?,
                        row.get::<_, f64>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, f64>(5)?,
                        row.get::<_, f64>(6)?,
                    ))
                },
            )
            .map_err(|_| "Produk atau satuan tidak valid.".to_string())?;

        let product_name = product.0;
        let stock_before = product.1;
        let purchase_price_base = product.2;
        let unit_id = product.3;
        let unit_name = product.4;
        let conversion_to_base = product.5;
        let price = product.6;

        if price <= 0.0 {
            return Err(format!(
                "Harga jual untuk {product_name} / {unit_name} belum diatur."
            ));
        }

        let qty_base = item.qty * conversion_to_base;
        if qty_base > stock_before {
            return Err(format!(
                "Stok tidak cukup untuk {product_name}. Stok tersedia: {stock_before} {unit_name}."
            ));
        }

        let subtotal = item.qty * price;
        let stock_after = stock_before - qty_base;
        total_gross += subtotal;

        tx.execute(
            "UPDATE products SET stock_base = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![stock_after, &item.product_id],
        )
        .map_err(map_sql_error)?;

        let sale_item_id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO sale_items (
                id, sale_id, product_id, product_unit_id, product_name_snapshot,
                unit_name_snapshot, qty, conversion_to_base, qty_base, price,
                purchase_price_base_snapshot, subtotal, created_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, datetime('now'))",
            params![
                &sale_item_id,
                &sale_id,
                &item.product_id,
                &item.product_unit_id,
                &product_name,
                &unit_name,
                item.qty,
                conversion_to_base,
                qty_base,
                price,
                purchase_price_base,
                subtotal,
            ],
        )
        .map_err(map_sql_error)?;

        let movement_id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO stock_movements (
                id, product_id, type, qty, unit_id, conversion_to_base, qty_base,
                stock_before, stock_after, note, reference_type, reference_id, created_by, created_at
             ) VALUES (?1, ?2, 'SALE', ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'SALE', ?10, ?11, datetime('now'))",
            params![
                movement_id,
                &item.product_id,
                item.qty,
                unit_id,
                conversion_to_base,
                qty_base,
                stock_before,
                stock_after,
                format!("Penjualan {invoice_number}"),
                &sale_id,
                &input.cashier_id,
            ],
        )
        .map_err(map_sql_error)?;

        sale_items.push(SaleItemDto {
            id: sale_item_id,
            product_name_snapshot: product_name,
            unit_name_snapshot: unit_name,
            qty: item.qty,
            conversion_to_base,
            qty_base,
            price,
            purchase_price_snapshot: Some(purchase_price_base),
            subtotal,
        });
    }

    let total_net = (total_gross - input.discount).max(0.0);
    if input.paid_amount < total_net {
        return Err("Nominal bayar kurang dari total transaksi.".to_string());
    }
    let change_amount = input.paid_amount - total_net;

    tx.execute(
        "UPDATE sales
         SET total_gross = ?1, discount = ?2, total_net = ?3, paid_amount = ?4,
             change_amount = ?5, updated_at = datetime('now')
         WHERE id = ?6",
        params![
            total_gross,
            input.discount,
            total_net,
            input.paid_amount,
            change_amount,
            &sale_id,
        ],
    )
    .map_err(map_sql_error)?;

    tx.commit().map_err(|error| error.to_string())?;

    Ok(SaleDto {
        id: sale_id,
        invoice_number,
        cashier_name: input.cashier_name,
        customer_name,
        total_gross,
        discount: input.discount,
        total_net,
        payment_method: input.payment_method,
        paid_amount: input.paid_amount,
        change_amount,
        status: "COMPLETED".to_string(),
        created_at,
        items: sale_items,
    })
}

#[tauri::command]
fn list_sales(app: AppHandle) -> CommandResult<Vec<SaleDto>> {
    let conn = open_database(&app)?;
    run_migrations(&conn)?;

    let mut stmt = conn
        .prepare(
            "SELECT s.id, s.invoice_number,
                    COALESCE(NULLIF(TRIM(s.cashier_name_snapshot), ''), u.name, s.cashier_id) AS cashier_name,
                    s.customer_name, s.total_gross, s.discount,
                    s.total_net, s.payment_method, s.paid_amount, s.change_amount, s.status, s.created_at
             FROM sales s
             LEFT JOIN users u ON u.id = s.cashier_id
             ORDER BY s.created_at DESC",
        )
        .map_err(|error| error.to_string())?;

    let sale_rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, f64>(4)?,
                row.get::<_, f64>(5)?,
                row.get::<_, f64>(6)?,
                row.get::<_, String>(7)?,
                row.get::<_, f64>(8)?,
                row.get::<_, f64>(9)?,
                row.get::<_, String>(10)?,
                row.get::<_, String>(11)?,
            ))
        })
        .map_err(|error| error.to_string())?;

    let mut sales: Vec<SaleDto> = Vec::new();
    for sale_row in sale_rows {
        let row = sale_row.map_err(|error| error.to_string())?;
        let sale_id = row.0.clone();

        let mut item_stmt = conn
            .prepare(
                "SELECT id, product_name_snapshot, unit_name_snapshot, qty, conversion_to_base,
                        qty_base, price, purchase_price_base_snapshot, subtotal
                 FROM sale_items
                 WHERE sale_id = ?1
                 ORDER BY created_at ASC",
            )
            .map_err(|error| error.to_string())?;

        let item_rows = item_stmt
            .query_map(params![&sale_id], |row| {
                Ok(SaleItemDto {
                    id: row.get(0)?,
                    product_name_snapshot: row.get(1)?,
                    unit_name_snapshot: row.get(2)?,
                    qty: row.get(3)?,
                    conversion_to_base: row.get(4)?,
                    qty_base: row.get(5)?,
                    price: row.get(6)?,
                    purchase_price_snapshot: row.get(7)?,
                    subtotal: row.get(8)?,
                })
            })
            .map_err(|error| error.to_string())?;

        let items = item_rows
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        sales.push(SaleDto {
            id: row.0,
            invoice_number: row.1,
            cashier_name: row.2,
            customer_name: row.3,
            total_gross: row.4,
            discount: row.5,
            total_net: row.6,
            payment_method: row.7,
            paid_amount: row.8,
            change_amount: row.9,
            status: row.10,
            created_at: row.11,
            items,
        });
    }

    Ok(sales)
}

#[tauri::command]
fn cancel_sale(app: AppHandle, input: CancelSaleInput) -> CommandResult<()> {
    let mut conn = open_database(&app)?;
    run_migrations(&conn)?;

    if input.cancel_reason.trim().is_empty() {
        return Err("Alasan pembatalan wajib diisi.".to_string());
    }

    let tx = conn.transaction().map_err(|error| error.to_string())?;

    let status: String = tx
        .query_row(
            "SELECT status FROM sales WHERE id = ?1",
            params![&input.id],
            |row| row.get(0),
        )
        .map_err(|_| "Transaksi tidak ditemukan.".to_string())?;

    if status != "COMPLETED" {
        return Err("Transaksi sudah dibatalkan.".to_string());
    }

    tx.execute(
        "UPDATE sales
         SET status = 'CANCELLED', cancel_reason = ?1, cancelled_at = datetime('now'),
             cancelled_by = ?2, updated_at = datetime('now')
         WHERE id = ?3",
        params![input.cancel_reason.trim(), &input.cancelled_by, &input.id],
    )
    .map_err(map_sql_error)?;

    let items: Vec<(String, f64, String, String, String, f64)> = {
        let mut stmt = tx
            .prepare(
                "SELECT si.product_id, si.qty_base, si.product_name_snapshot, si.unit_name_snapshot,
                        si.product_unit_id, si.qty
                 FROM sale_items si
                 WHERE si.sale_id = ?1",
            )
            .map_err(|error| error.to_string())?;

        let item_rows = stmt
            .query_map(params![&input.id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, f64>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, f64>(5)?,
                ))
            })
            .map_err(|error| error.to_string())?;

        item_rows
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?
    };

    for (product_id, qty_base, product_name, unit_name, _product_unit_id, qty) in &items {
        let stock_before: f64 = tx
            .query_row(
                "SELECT stock_base FROM products WHERE id = ?1",
                params![product_id],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?;

        let stock_after = stock_before + qty_base;
        tx.execute(
            "UPDATE products SET stock_base = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![stock_after, product_id],
        )
        .map_err(map_sql_error)?;

        let movement_id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO stock_movements (
                id, product_id, type, qty, unit_id, conversion_to_base, qty_base,
                stock_before, stock_after, note, reference_type, reference_id, created_by, created_at
             ) VALUES (?1, ?2, 'SALE_CANCEL', ?3, NULL, NULL, ?3, ?4, ?5, ?6, 'SALE_CANCEL', ?7, ?8, datetime('now'))",
            params![
                movement_id,
                product_id,
                qty_base,
                stock_before,
                stock_after,
                format!("Pembatalan - {product_name} {qty} {unit_name}"),
                &input.id,
                &input.cancelled_by,
            ],
        )
        .map_err(map_sql_error)?;
    }

    tx.commit().map_err(|error| error.to_string())?;
    Ok(())
}

fn next_invoice_number(tx: &rusqlite::Transaction<'_>) -> CommandResult<String> {
    let date: String = tx
        .query_row("SELECT strftime('%Y%m%d', 'now')", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    let prefix = format!("INV-{date}-");
    let count: i64 = tx
        .query_row(
            "SELECT COUNT(*) FROM sales WHERE invoice_number LIKE ?1",
            params![format!("{prefix}%")],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    Ok(format!("{prefix}{:04}", count + 1))
}

fn normalize_optional(value: Option<String>) -> Option<String> {
    value.and_then(|item| {
        let trimmed = item.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn resolve_product_image_path(
    app: &AppHandle,
    product_id: &str,
    input: &SaveProductInput,
) -> CommandResult<Option<String>> {
    if input.remove_image.unwrap_or(false) {
        return Ok(None);
    }

    let Some(data_url) = normalize_optional(input.image_data_url.clone()) else {
        return Ok(normalize_optional(input.image_path.clone()));
    };

    let (header, encoded) = data_url
        .split_once(',')
        .ok_or_else(|| "Format foto produk tidak valid.".to_string())?;
    if !header.starts_with("data:image/") || !header.contains(";base64") {
        return Err("Foto produk harus berupa gambar JPG, PNG, atau WebP.".to_string());
    }

    let ext = image_extension(header, input.image_file_name.as_deref(), "Foto produk")?;
    let bytes = BASE64_STANDARD
        .decode(encoded)
        .map_err(|_| "Foto produk gagal dibaca.".to_string())?;
    if bytes.len() > 5 * 1024 * 1024 {
        return Err("Ukuran foto produk maksimal 5 MB.".to_string());
    }

    let image_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("product-images");
    fs::create_dir_all(&image_dir).map_err(|error| error.to_string())?;

    let file_path = image_dir.join(format!("{product_id}.{ext}"));
    fs::write(&file_path, bytes).map_err(|error| error.to_string())?;
    Ok(Some(file_path.to_string_lossy().to_string()))
}

fn resolve_receipt_logo_path(
    app: &AppHandle,
    input: &SaveStoreSettingsInput,
) -> CommandResult<Option<String>> {
    if input.remove_receipt_logo.unwrap_or(false) {
        return Ok(None);
    }

    let Some(data_url) = normalize_optional(input.receipt_logo_data_url.clone()) else {
        return Ok(normalize_optional(input.receipt_logo_path.clone()));
    };

    let (header, encoded) = data_url
        .split_once(',')
        .ok_or_else(|| "Format logo struk tidak valid.".to_string())?;
    if !header.starts_with("data:image/") || !header.contains(";base64") {
        return Err("Logo struk harus berupa gambar JPG, PNG, atau WebP.".to_string());
    }

    let ext = image_extension(
        header,
        input.receipt_logo_file_name.as_deref(),
        "Logo struk",
    )?;
    let bytes = BASE64_STANDARD
        .decode(encoded)
        .map_err(|_| "Logo struk gagal dibaca.".to_string())?;
    if bytes.len() > 2 * 1024 * 1024 {
        return Err("Ukuran logo struk maksimal 2 MB.".to_string());
    }

    let asset_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("store-assets");
    fs::create_dir_all(&asset_dir).map_err(|error| error.to_string())?;

    let file_path = asset_dir.join(format!("receipt-logo.{ext}"));
    fs::write(&file_path, bytes).map_err(|error| error.to_string())?;
    Ok(Some(file_path.to_string_lossy().to_string()))
}

fn image_extension(
    header: &str,
    file_name: Option<&str>,
    label: &str,
) -> CommandResult<&'static str> {
    let lower_name = file_name.unwrap_or_default().to_lowercase();
    if lower_name.ends_with(".jpg") || lower_name.ends_with(".jpeg") {
        return Ok("jpg");
    }
    if lower_name.ends_with(".png") {
        return Ok("png");
    }
    if lower_name.ends_with(".webp") {
        return Ok("webp");
    }

    if header.starts_with("data:image/jpeg") || header.starts_with("data:image/jpg") {
        Ok("jpg")
    } else if header.starts_with("data:image/png") {
        Ok("png")
    } else if header.starts_with("data:image/webp") {
        Ok("webp")
    } else {
        Err(format!("{label} harus JPG, PNG, atau WebP."))
    }
}

fn bool_to_i64(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

#[tauri::command]
fn save_text_file(path: String, content: String) -> CommandResult<()> {
    fs::write(&path, content).map_err(|error| format!("Gagal menyimpan file: {error}"))
}

#[tauri::command]
fn backup_database(app: AppHandle, target_path: String) -> CommandResult<String> {
    create_backup_package(&app, Path::new(&target_path))
}

#[tauri::command]
fn restore_database(app: AppHandle, backup_path: String) -> CommandResult<String> {
    let source_path = db::database_path(&app)?;
    let backup_path = PathBuf::from(backup_path);

    if is_backup_package(&backup_path)? {
        return restore_backup_package(&app, &backup_path, &source_path);
    }

    validate_database_file(&backup_path)?;

    let backups_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("backups");
    fs::create_dir_all(&backups_dir).map_err(|error| error.to_string())?;

    let now = chrono_now();
    let auto_backup_path = backups_dir.join(format!("auto-backup-{now}.postoko-backup"));
    create_backup_package(&app, &auto_backup_path)?;

    fs::copy(&backup_path, &source_path)
        .map_err(|error| format!("Gagal restore database: {error}"))?;

    Ok(auto_backup_path.to_string_lossy().to_string())
}

fn create_backup_package(app: &AppHandle, target_path: &Path) -> CommandResult<String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let database_path = db::database_path(app)?;
    let mut entries = vec![BackupEntry {
        path: "pos.db".to_string(),
        data: fs::read(&database_path)
            .map_err(|error| format!("Database gagal dibaca untuk backup: {error}"))?,
    }];

    collect_backup_dir(&app_data_dir, "product-images", &mut entries)?;
    collect_backup_dir(&app_data_dir, "store-assets", &mut entries)?;
    write_backup_package(target_path, &entries)?;
    Ok(target_path.to_string_lossy().to_string())
}

fn collect_backup_dir(
    app_data_dir: &Path,
    dir_name: &str,
    entries: &mut Vec<BackupEntry>,
) -> CommandResult<()> {
    let dir = app_data_dir.join(dir_name);
    if !dir.exists() {
        return Ok(());
    }
    collect_backup_dir_inner(&dir, dir_name, entries)
}

fn collect_backup_dir_inner(
    dir: &Path,
    prefix: &str,
    entries: &mut Vec<BackupEntry>,
) -> CommandResult<()> {
    for item in fs::read_dir(dir).map_err(|error| format!("Folder aset gagal dibaca: {error}"))? {
        let item = item.map_err(|error| error.to_string())?;
        let path = item.path();
        let name = item.file_name().to_string_lossy().to_string();
        let entry_path = format!("{prefix}/{name}");
        if path.is_dir() {
            collect_backup_dir_inner(&path, &entry_path, entries)?;
        } else if path.is_file() {
            entries.push(BackupEntry {
                path: entry_path,
                data: fs::read(&path)
                    .map_err(|error| format!("Aset gagal dibaca untuk backup: {error}"))?,
            });
        }
    }
    Ok(())
}

fn write_backup_package(target_path: &Path, entries: &[BackupEntry]) -> CommandResult<()> {
    let mut out = Vec::new();
    out.extend_from_slice(BACKUP_MAGIC);
    out.extend_from_slice(&(entries.len() as u32).to_le_bytes());

    for entry in entries {
        let path_bytes = entry.path.as_bytes();
        out.extend_from_slice(&(path_bytes.len() as u32).to_le_bytes());
        out.extend_from_slice(&(entry.data.len() as u64).to_le_bytes());
        out.extend_from_slice(path_bytes);
        out.extend_from_slice(&entry.data);
    }

    fs::write(target_path, out).map_err(|error| format!("Gagal menyimpan backup: {error}"))
}

fn restore_backup_package(
    app: &AppHandle,
    backup_path: &Path,
    database_path: &Path,
) -> CommandResult<String> {
    let entries = read_backup_package(backup_path)?;
    let database_entry = entries
        .iter()
        .find(|entry| entry.path == "pos.db")
        .ok_or_else(|| "File backup tidak berisi database POS TOKO.".to_string())?;
    validate_database_bytes(app, &database_entry.data)?;

    let backups_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("backups");
    fs::create_dir_all(&backups_dir).map_err(|error| error.to_string())?;

    let now = chrono_now();
    let auto_backup_path = backups_dir.join(format!("auto-backup-{now}.postoko-backup"));
    create_backup_package(app, &auto_backup_path)?;

    fs::write(database_path, &database_entry.data)
        .map_err(|error| format!("Gagal restore database: {error}"))?;
    restore_backup_dir(app, &entries, "product-images")?;
    restore_backup_dir(app, &entries, "store-assets")?;

    Ok(auto_backup_path.to_string_lossy().to_string())
}

fn restore_backup_dir(
    app: &AppHandle,
    entries: &[BackupEntry],
    dir_name: &str,
) -> CommandResult<()> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let target_dir = app_data_dir.join(dir_name);
    if target_dir.exists() {
        fs::remove_dir_all(&target_dir)
            .map_err(|error| format!("Folder aset lama gagal dihapus: {error}"))?;
    }

    let prefix = format!("{dir_name}/");
    for entry in entries
        .iter()
        .filter(|entry| entry.path.starts_with(&prefix))
    {
        let relative = &entry.path[prefix.len()..];
        if !is_safe_relative_path(relative) {
            return Err("File backup berisi path aset yang tidak aman.".to_string());
        }
        let target_path = target_dir.join(relative);
        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::write(target_path, &entry.data)
            .map_err(|error| format!("Aset backup gagal direstore: {error}"))?;
    }
    Ok(())
}

fn is_backup_package(path: &Path) -> CommandResult<bool> {
    let data = fs::read(path).map_err(|error| format!("File backup gagal dibaca: {error}"))?;
    Ok(data.starts_with(BACKUP_MAGIC))
}

fn read_backup_package(path: &Path) -> CommandResult<Vec<BackupEntry>> {
    let data = fs::read(path).map_err(|error| format!("File backup gagal dibaca: {error}"))?;
    if !data.starts_with(BACKUP_MAGIC) {
        return Err("File backup bukan paket POS TOKO.".to_string());
    }

    let mut offset = BACKUP_MAGIC.len();
    let count = read_u32(&data, &mut offset)? as usize;
    let mut entries = Vec::with_capacity(count);
    for _ in 0..count {
        let path_len = read_u32(&data, &mut offset)? as usize;
        let data_len = read_u64(&data, &mut offset)? as usize;
        if offset + path_len > data.len() {
            return Err("File backup rusak.".to_string());
        }
        let entry_path = String::from_utf8(data[offset..offset + path_len].to_vec())
            .map_err(|_| "File backup berisi path tidak valid.".to_string())?;
        offset += path_len;
        if !is_allowed_backup_path(&entry_path) || offset + data_len > data.len() {
            return Err("File backup rusak atau berisi path tidak valid.".to_string());
        }
        entries.push(BackupEntry {
            path: entry_path,
            data: data[offset..offset + data_len].to_vec(),
        });
        offset += data_len;
    }
    Ok(entries)
}

fn read_u32(data: &[u8], offset: &mut usize) -> CommandResult<u32> {
    if *offset + 4 > data.len() {
        return Err("File backup rusak.".to_string());
    }
    let value = u32::from_le_bytes(
        data[*offset..*offset + 4]
            .try_into()
            .map_err(|_| "File backup rusak.".to_string())?,
    );
    *offset += 4;
    Ok(value)
}

fn read_u64(data: &[u8], offset: &mut usize) -> CommandResult<u64> {
    if *offset + 8 > data.len() {
        return Err("File backup rusak.".to_string());
    }
    let value = u64::from_le_bytes(
        data[*offset..*offset + 8]
            .try_into()
            .map_err(|_| "File backup rusak.".to_string())?,
    );
    *offset += 8;
    Ok(value)
}

fn validate_database_file(path: &Path) -> CommandResult<()> {
    let conn = Connection::open(path)
        .map_err(|_| "File backup tidak valid (bukan database SQLite).".to_string())?;
    conn.query_row("SELECT COUNT(*) FROM users", [], |_| Ok(()))
        .map_err(|_| "File backup bukan database POS TOKO atau rusak.".to_string())?;
    Ok(())
}

fn validate_database_bytes(app: &AppHandle, data: &[u8]) -> CommandResult<()> {
    let temp_path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("backups")
        .join(format!("validate-{}.db", chrono_now()));
    if let Some(parent) = temp_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(&temp_path, data)
        .map_err(|error| format!("Database backup gagal divalidasi: {error}"))?;
    let result = validate_database_file(&temp_path);
    let _ = fs::remove_file(&temp_path);
    result
}

fn is_allowed_backup_path(path: &str) -> bool {
    path == "pos.db"
        || (path.starts_with("product-images/") && is_safe_relative_path(&path[15..]))
        || (path.starts_with("store-assets/") && is_safe_relative_path(&path[13..]))
}

fn is_safe_relative_path(path: &str) -> bool {
    if path.trim().is_empty() {
        return false;
    }
    Path::new(path)
        .components()
        .all(|component| matches!(component, Component::Normal(_)))
}

struct BackupEntry {
    path: String,
    data: Vec<u8>,
}

#[tauri::command]
fn reset_operational_data(app: AppHandle) -> CommandResult<String> {
    let mut conn = open_database(&app)?;
    run_migrations(&conn)?;

    let backups_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("backups");
    fs::create_dir_all(&backups_dir).map_err(|error| error.to_string())?;

    let now = chrono_now();
    let auto_backup_path =
        backups_dir.join(format!("auto-backup-before-reset-{now}.postoko-backup"));
    create_backup_package(&app, &auto_backup_path)?;

    let tx = conn.transaction().map_err(|error| error.to_string())?;
    tx.execute_batch(
        "
        DELETE FROM sale_items;
        DELETE FROM sales;
        DELETE FROM stock_movements;
        DELETE FROM product_units;
        DELETE FROM products;
        DELETE FROM categories;
        DELETE FROM units;
        ",
    )
    .map_err(|error| format!("Gagal menghapus data operasional: {error}"))?;
    tx.commit().map_err(|error| error.to_string())?;

    let product_images_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("product-images");
    if product_images_dir.exists() {
        fs::remove_dir_all(&product_images_dir).map_err(|error| {
            format!("Data berhasil direset, tetapi folder foto produk gagal dihapus: {error}")
        })?;
    }

    Ok(auto_backup_path.to_string_lossy().to_string())
}

fn chrono_now() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs();
    let days_since_epoch = secs / 86400;
    let time_of_day = secs % 86400;
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;

    let mut y = 1970i64;
    let mut d = days_since_epoch as i64;
    loop {
        let days_in_year = if is_leap(y) { 366 } else { 365 };
        if d < days_in_year {
            break;
        }
        d -= days_in_year;
        y += 1;
    }
    let month_days = if is_leap(y) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    let mut m = 0usize;
    while m < 12 && d >= month_days[m] as i64 {
        d -= month_days[m] as i64;
        m += 1;
    }
    format!(
        "{:04}{:02}{:02}-{:02}{:02}{:02}",
        y,
        m + 1,
        d + 1,
        hours,
        minutes,
        seconds,
    )
}

fn is_leap(year: i64) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

fn map_sql_error(error: rusqlite::Error) -> String {
    let message = error.to_string();
    if message.contains("UNIQUE constraint failed: users.username") {
        "Username sudah digunakan.".to_string()
    } else if message.contains("UNIQUE constraint failed: categories.name") {
        "Nama kategori sudah digunakan.".to_string()
    } else if message.contains("UNIQUE constraint failed: units.symbol") {
        "Symbol satuan sudah digunakan.".to_string()
    } else if message.contains("UNIQUE constraint failed: products.sku") {
        "SKU produk sudah digunakan.".to_string()
    } else if message.contains("UNIQUE constraint failed: product_units.barcode") {
        "Barcode satuan produk sudah digunakan.".to_string()
    } else if message.contains("FOREIGN KEY constraint failed") {
        "Data referensi tidak valid.".to_string()
    } else {
        message
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            match open_database(app.handle()) {
                Ok(conn) => {
                    if let Err(error) = run_migrations(&conn) {
                        eprintln!("failed to run POS TOKO migrations: {error}");
                    }
                    if let Err(error) = run_seed(&conn) {
                        eprintln!("failed to run POS TOKO seed: {error}");
                    }
                }
                Err(error) => eprintln!("failed to open POS TOKO database: {error}"),
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_setup_status,
            complete_initial_setup,
            login,
            get_user_session,
            list_users,
            save_user,
            set_user_active,
            reset_user_password,
            get_store_settings,
            save_store_settings,
            list_printers,
            test_print,
            print_receipt,
            list_categories,
            save_category,
            delete_category,
            list_units,
            save_unit,
            delete_unit,
            list_products,
            save_product,
            delete_product,
            add_stock,
            adjust_stock,
            list_stock_movements,
            complete_sale,
            list_sales,
            cancel_sale,
            save_text_file,
            backup_database,
            restore_database,
            reset_operational_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running POS TOKO");
}
