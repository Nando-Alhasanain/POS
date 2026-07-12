use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupStatusDto {
    pub is_setup_complete: bool,
    pub database_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteSetupInput {
    pub store_name: String,
    pub store_address: String,
    pub store_phone: String,
    pub admin_name: String,
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginInput {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserDto {
    pub id: String,
    pub name: String,
    pub username: String,
    pub role: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserAccountDto {
    pub id: String,
    pub name: String,
    pub username: String,
    pub role: String,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveUserInput {
    pub id: Option<String>,
    pub name: String,
    pub username: String,
    pub role: String,
    pub password: Option<String>,
    pub is_active: bool,
    pub current_user_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetUserActiveInput {
    pub id: String,
    pub is_active: bool,
    pub current_user_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResetUserPasswordInput {
    pub id: String,
    pub password: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreSettingsDto {
    pub store_name: String,
    pub store_address: String,
    pub store_phone: String,
    pub receipt_footer: String,
    pub receipt_paper_size: String,
    pub currency: String,
    pub printer_name: Option<String>,
    pub receipt_logo_path: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveStoreSettingsInput {
    pub store_name: String,
    pub store_address: String,
    pub store_phone: String,
    pub receipt_footer: String,
    pub receipt_paper_size: String,
    pub currency: String,
    pub printer_name: Option<String>,
    pub receipt_logo_path: Option<String>,
    pub receipt_logo_data_url: Option<String>,
    pub receipt_logo_file_name: Option<String>,
    pub remove_receipt_logo: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrinterDto {
    pub name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryDto {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCategoryInput {
    pub id: Option<String>,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteByIdInput {
    pub id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnitDto {
    pub id: String,
    pub name: String,
    pub symbol: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveUnitInput {
    pub id: Option<String>,
    pub name: String,
    pub symbol: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductUnitDto {
    pub id: String,
    pub product_id: String,
    pub unit_id: String,
    pub unit_name: String,
    pub conversion_to_base: f64,
    pub selling_price: f64,
    pub barcode: Option<String>,
    pub is_base_unit: bool,
    pub is_default: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveProductUnitInput {
    pub id: Option<String>,
    pub unit_id: String,
    pub conversion_to_base: f64,
    pub selling_price: f64,
    pub barcode: Option<String>,
    pub is_base_unit: bool,
    pub is_default: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductDto {
    pub id: String,
    pub name: String,
    pub sku: Option<String>,
    pub category_id: Option<String>,
    pub category_name: Option<String>,
    pub base_unit_id: String,
    pub base_unit_name: String,
    pub stock_base: f64,
    pub minimum_stock: f64,
    pub purchase_price_base: f64,
    pub default_selling_price_base: f64,
    pub is_active: bool,
    pub image_path: Option<String>,
    pub units: Vec<ProductUnitDto>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteProductResultDto {
    pub action: String,
    pub message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveProductInput {
    pub id: Option<String>,
    pub name: String,
    pub sku: Option<String>,
    pub category_id: Option<String>,
    pub base_unit_id: String,
    pub stock_base: f64,
    pub minimum_stock: f64,
    pub purchase_price_base: f64,
    pub default_selling_price_base: f64,
    pub is_active: bool,
    pub image_path: Option<String>,
    pub image_data_url: Option<String>,
    pub image_file_name: Option<String>,
    pub remove_image: Option<bool>,
    pub units: Vec<SaveProductUnitInput>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StockInInput {
    pub product_id: String,
    pub product_unit_id: String,
    pub qty: f64,
    pub note: Option<String>,
    pub created_by: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StockAdjustmentInput {
    pub product_id: String,
    pub physical_stock_base: f64,
    pub note: String,
    pub created_by: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StockMovementDto {
    pub id: String,
    pub product_id: String,
    pub product_name: String,
    pub movement_type: String,
    pub qty: f64,
    pub unit_id: Option<String>,
    pub unit_name: Option<String>,
    pub conversion_to_base: Option<f64>,
    pub qty_base: f64,
    pub stock_before: f64,
    pub stock_after: f64,
    pub note: Option<String>,
    pub reference_type: Option<String>,
    pub reference_id: Option<String>,
    pub created_by: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteSaleItemInput {
    pub product_id: String,
    pub product_unit_id: String,
    pub qty: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteSaleInput {
    pub cashier_id: String,
    pub cashier_name: String,
    pub customer_name: Option<String>,
    pub payment_method: String,
    pub paid_amount: f64,
    pub discount: f64,
    pub items: Vec<CompleteSaleItemInput>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaleItemDto {
    pub id: String,
    pub product_name_snapshot: String,
    pub unit_name_snapshot: String,
    pub qty: f64,
    pub conversion_to_base: f64,
    pub qty_base: f64,
    pub price: f64,
    pub purchase_price_snapshot: Option<f64>,
    pub subtotal: f64,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaleDto {
    pub id: String,
    pub invoice_number: String,
    pub cashier_name: String,
    pub customer_name: Option<String>,
    pub total_gross: f64,
    pub discount: f64,
    pub total_net: f64,
    pub payment_method: String,
    pub paid_amount: f64,
    pub change_amount: f64,
    pub status: String,
    pub created_at: String,
    pub items: Vec<SaleItemDto>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelSaleInput {
    pub id: String,
    pub cancel_reason: String,
    pub cancelled_by: String,
}
