use crate::models::{SaleDto, StoreSettingsDto};
use image::{imageops::FilterType, GenericImageView};
use std::ffi::c_void;
use std::fs;
use std::iter;
use std::ptr::{null, null_mut};
use windows_sys::Win32::Foundation::GetLastError;
use windows_sys::Win32::Graphics::Printing::{
    ClosePrinter, EndDocPrinter, EndPagePrinter, EnumPrintersW, OpenPrinterW, StartDocPrinterW,
    StartPagePrinter, WritePrinter, DOC_INFO_1W, PRINTER_ENUM_CONNECTIONS, PRINTER_ENUM_LOCAL,
    PRINTER_INFO_4W,
};

pub fn list_windows_printers() -> Result<Vec<String>, String> {
    let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
    let mut needed = 0u32;
    let mut returned = 0u32;

    unsafe {
        EnumPrintersW(flags, null(), 4, null_mut(), 0, &mut needed, &mut returned);
    }

    if needed == 0 {
        return Ok(Vec::new());
    }

    let mut buffer = vec![0u8; needed as usize];
    let ok = unsafe {
        EnumPrintersW(
            flags,
            null(),
            4,
            buffer.as_mut_ptr(),
            needed,
            &mut needed,
            &mut returned,
        )
    };

    if ok == 0 {
        return Err(format_windows_error("Gagal membaca daftar printer"));
    }

    let printers = unsafe {
        std::slice::from_raw_parts(buffer.as_ptr() as *const PRINTER_INFO_4W, returned as usize)
    };

    let mut names = printers
        .iter()
        .filter_map(|printer| unsafe { wide_ptr_to_string(printer.pPrinterName) })
        .collect::<Vec<_>>();
    names.sort();
    names.dedup();
    Ok(names)
}

pub fn print_raw(printer_name: &str, document_name: &str, bytes: &[u8]) -> Result<(), String> {
    if printer_name.trim().is_empty() {
        return Err("Pilih printer thermal di Pengaturan terlebih dahulu.".to_string());
    }

    let printer_name_w = to_wide(printer_name);
    let document_name_w = to_wide(document_name);
    let raw_w = to_wide("RAW");
    let mut printer = null_mut();

    let opened = unsafe { OpenPrinterW(printer_name_w.as_ptr(), &mut printer, null_mut()) };
    if opened == 0 || printer.is_null() {
        return Err(format_windows_error("Printer tidak bisa dibuka"));
    }

    let doc_info = DOC_INFO_1W {
        pDocName: document_name_w.as_ptr() as *mut u16,
        pOutputFile: null_mut(),
        pDatatype: raw_w.as_ptr() as *mut u16,
    };

    let result = unsafe {
        let doc_started = StartDocPrinterW(printer, 1, &doc_info as *const DOC_INFO_1W);
        if doc_started == 0 {
            ClosePrinter(printer);
            return Err(format_windows_error("Dokumen printer gagal dimulai"));
        }

        let page_started = StartPagePrinter(printer);
        if page_started == 0 {
            EndDocPrinter(printer);
            ClosePrinter(printer);
            return Err(format_windows_error("Halaman printer gagal dimulai"));
        }

        let mut written = 0u32;
        let write_ok = WritePrinter(
            printer,
            bytes.as_ptr() as *const c_void,
            bytes.len() as u32,
            &mut written,
        );

        EndPagePrinter(printer);
        EndDocPrinter(printer);
        ClosePrinter(printer);

        if write_ok == 0 || written != bytes.len() as u32 {
            Err(format_windows_error(
                "Data ESC/POS gagal dikirim ke printer",
            ))
        } else {
            Ok(())
        }
    };

    result
}

pub fn build_test_receipt(settings: &StoreSettingsDto) -> Vec<u8> {
    let width = paper_width(settings);
    let mut out = EscPos::new();
    out.init();
    out.align_center();
    out.logo(
        settings.receipt_logo_path.as_deref(),
        logo_width_pixels(settings),
    );
    out.bold(true);
    out.line("POS TOKO");
    out.bold(false);
    out.line("TEST PRINT ESC/POS");
    out.line(&settings.store_name);
    out.align_left();
    out.separator(width);
    out.line("Printer thermal USB siap digunakan.");
    out.line("Mode: Windows RAW / ESC-POS");
    out.separator(width);
    out.align_center();
    out.line("Terima kasih");
    out.feed(4);
    out.cut();
    out.into_bytes()
}

pub fn build_receipt(settings: &StoreSettingsDto, sale: &SaleDto) -> Vec<u8> {
    let width = paper_width(settings);
    let mut out = EscPos::new();
    out.init();
    out.align_center();
    out.logo(
        settings.receipt_logo_path.as_deref(),
        logo_width_pixels(settings),
    );
    out.bold(true);
    out.line(&settings.store_name);
    out.bold(false);
    if !settings.store_address.trim().is_empty() {
        out.wrapped_center(&settings.store_address, width);
    }
    if !settings.store_phone.trim().is_empty() {
        out.line(&format!("Telp: {}", settings.store_phone));
    }
    out.align_left();
    out.separator(width);
    out.line(&format!("Invoice : {}", sale.invoice_number));
    out.line(&format!("Tanggal : {}", sale.created_at));
    out.line(&format!("Kasir   : {}", sale.cashier_name));
    out.line(&format!(
        "Bayar   : {}",
        payment_method_label(&sale.payment_method)
    ));
    if let Some(customer) = &sale.customer_name {
        if !customer.trim().is_empty() {
            out.line(&format!("Customer: {customer}"));
        }
    }
    out.separator(width);

    for item in &sale.items {
        out.wrapped_left(&item.product_name_snapshot, width);
        let qty_price = format!(
            "{} {} x {}",
            format_number(item.qty),
            item.unit_name_snapshot,
            format_money(item.price),
        );
        out.two_columns(&qty_price, &format_money(item.subtotal), width);
    }

    out.separator(width);
    out.two_columns("Subtotal", &format_money(sale.total_gross), width);
    if sale.discount > 0.0 {
        out.two_columns("Diskon", &format_money(sale.discount), width);
    }
    out.bold(true);
    out.two_columns("TOTAL", &format_money(sale.total_net), width);
    out.bold(false);
    out.two_columns("Bayar", &format_money(sale.paid_amount), width);
    out.two_columns("Kembali", &format_money(sale.change_amount), width);
    out.separator(width);
    out.align_center();
    if !settings.receipt_footer.trim().is_empty() {
        out.wrapped_center(&settings.receipt_footer, width);
    }
    out.feed(4);
    out.cut();
    out.into_bytes()
}

fn paper_width(settings: &StoreSettingsDto) -> usize {
    if settings.receipt_paper_size == "58mm" {
        32
    } else {
        48
    }
}

fn logo_width_pixels(settings: &StoreSettingsDto) -> u32 {
    if settings.receipt_paper_size == "58mm" {
        180
    } else {
        240
    }
}

fn to_wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(iter::once(0)).collect()
}

unsafe fn wide_ptr_to_string(ptr: *const u16) -> Option<String> {
    if ptr.is_null() {
        return None;
    }

    let mut len = 0usize;
    while *ptr.add(len) != 0 {
        len += 1;
    }

    Some(String::from_utf16_lossy(std::slice::from_raw_parts(
        ptr, len,
    )))
}

fn format_windows_error(prefix: &str) -> String {
    let code = unsafe { GetLastError() };
    format!("{prefix}. Kode Windows: {code}")
}

fn format_money(value: f64) -> String {
    format!("Rp {}", format_integer(value.round() as i64))
}

fn format_integer(value: i64) -> String {
    let sign = if value < 0 { "-" } else { "" };
    let digits = value.abs().to_string();
    let mut out = String::new();
    for (idx, ch) in digits.chars().rev().enumerate() {
        if idx > 0 && idx % 3 == 0 {
            out.push('.');
        }
        out.push(ch);
    }
    let grouped = out.chars().rev().collect::<String>();
    format!("{sign}{grouped}")
}

fn format_number(value: f64) -> String {
    if (value.fract()).abs() < 0.000_001 {
        format!("{}", value.round() as i64)
    } else {
        let mut text = format!("{value:.3}");
        while text.contains('.') && text.ends_with('0') {
            text.pop();
        }
        if text.ends_with('.') {
            text.pop();
        }
        text
    }
}

fn take_chars(value: &str, max: usize) -> String {
    value.chars().take(max).collect()
}

fn char_count(value: &str) -> usize {
    value.chars().count()
}

fn payment_method_label(method: &str) -> &str {
    match method {
        "CASH" => "Tunai",
        "TRANSFER" => "Transfer",
        "QRIS" => "QRIS",
        "DEBIT" => "Debit",
        "CREDIT" => "Kredit",
        _ => method,
    }
}

fn wrap_text(value: &str, width: usize) -> Vec<String> {
    let mut lines = Vec::new();
    let mut current = String::new();

    for word in value.split_whitespace() {
        let current_len = char_count(&current);
        let word_len = char_count(word);
        if current.is_empty() {
            current.push_str(word);
        } else if current_len + 1 + word_len <= width {
            current.push(' ');
            current.push_str(word);
        } else {
            lines.push(current);
            current = word.to_string();
        }

        while char_count(&current) > width {
            let head = take_chars(&current, width);
            let tail = current.chars().skip(width).collect::<String>();
            lines.push(head);
            current = tail;
        }
    }

    if !current.is_empty() {
        lines.push(current);
    }

    if lines.is_empty() {
        lines.push(String::new());
    }

    lines
}

fn build_logo_raster(path: &str, max_width: u32) -> Option<Vec<u8>> {
    let bytes = fs::read(path).ok()?;
    let mut image = image::load_from_memory(&bytes).ok()?;
    let (width, height) = image.dimensions();
    if width == 0 || height == 0 {
        return None;
    }

    let max_height = (max_width / 2).max(72);
    let scale = (max_width as f64 / width as f64)
        .min(max_height as f64 / height as f64)
        .min(1.0);
    if scale < 1.0 {
        let target_width = ((width as f64 * scale).round() as u32).max(1);
        let target_height = ((height as f64 * scale).round() as u32).max(1);
        image = image.resize(target_width, target_height, FilterType::Lanczos3);
    }

    let gray = image.to_luma8();
    let width = gray.width();
    let height = gray.height();
    if width == 0 || height == 0 || height > u16::MAX as u32 {
        return None;
    }

    let bytes_per_row = ((width + 7) / 8) as u16;
    let mut out = Vec::with_capacity(8 + bytes_per_row as usize * height as usize);
    out.extend_from_slice(&[
        0x1d,
        0x76,
        0x30,
        0,
        (bytes_per_row & 0xff) as u8,
        (bytes_per_row >> 8) as u8,
        (height as u16 & 0xff) as u8,
        ((height as u16) >> 8) as u8,
    ]);

    for y in 0..height {
        for byte_x in 0..bytes_per_row as u32 {
            let mut packed = 0u8;
            for bit in 0..8 {
                let x = byte_x * 8 + bit;
                if x < width {
                    let luminance = gray.get_pixel(x, y)[0];
                    if luminance < 180 {
                        packed |= 0x80 >> bit;
                    }
                }
            }
            out.push(packed);
        }
    }

    Some(out)
}

struct EscPos {
    bytes: Vec<u8>,
}

impl EscPos {
    fn new() -> Self {
        Self { bytes: Vec::new() }
    }

    fn init(&mut self) {
        self.bytes.extend_from_slice(&[0x1b, 0x40]);
    }

    fn align_left(&mut self) {
        self.bytes.extend_from_slice(&[0x1b, 0x61, 0]);
    }

    fn align_center(&mut self) {
        self.bytes.extend_from_slice(&[0x1b, 0x61, 1]);
    }

    fn bold(&mut self, enabled: bool) {
        self.bytes
            .extend_from_slice(&[0x1b, 0x45, u8::from(enabled)]);
    }

    fn feed(&mut self, lines: u8) {
        self.bytes.extend_from_slice(&[0x1b, 0x64, lines]);
    }

    fn cut(&mut self) {
        self.bytes.extend_from_slice(&[0x1d, 0x56, 66, 0]);
    }

    fn logo(&mut self, path: Option<&str>, max_width: u32) {
        let Some(path) = path.filter(|value| !value.trim().is_empty()) else {
            return;
        };
        let Some(raster) = build_logo_raster(path, max_width) else {
            return;
        };

        self.align_center();
        self.bytes.extend_from_slice(&raster);
        self.feed(1);
    }

    fn line(&mut self, value: &str) {
        self.bytes.extend_from_slice(value.as_bytes());
        self.bytes.push(b'\n');
    }

    fn separator(&mut self, width: usize) {
        self.line(&"-".repeat(width));
    }

    fn wrapped_left(&mut self, value: &str, width: usize) {
        self.align_left();
        for line in wrap_text(value, width) {
            self.line(&line);
        }
    }

    fn wrapped_center(&mut self, value: &str, width: usize) {
        self.align_center();
        for line in wrap_text(value, width) {
            self.line(&line);
        }
    }

    fn two_columns(&mut self, left: &str, right: &str, width: usize) {
        let right_len = char_count(right);
        let max_left = width.saturating_sub(right_len + 1);
        let mut left_lines = wrap_text(left, max_left.max(1));
        let first_left = left_lines.remove(0);
        let spaces = width.saturating_sub(char_count(&first_left) + right_len);
        self.line(&format!("{first_left}{}{right}", " ".repeat(spaces)));
        for line in left_lines {
            self.line(&line);
        }
    }

    fn into_bytes(self) -> Vec<u8> {
        self.bytes
    }
}
