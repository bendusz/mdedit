use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{App, Emitter};

pub fn setup_menu(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    // macOS app submenu — contains About, Hide, and Quit.
    // We use a custom Quit item (not the predefined .quit()) so the frontend
    // can save unsaved changes before the process exits.
    let app_menu = SubmenuBuilder::new(app, "mdedit")
        .about(None)
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .item(
            &MenuItemBuilder::with_id("quit", "Quit mdedit")
                .accelerator("CmdOrCtrl+Q")
                .build(app)?,
        )
        .build()?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&MenuItemBuilder::with_id("new", "New").accelerator("CmdOrCtrl+N").build(app)?)
        .item(&MenuItemBuilder::with_id("open", "Open...").accelerator("CmdOrCtrl+O").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("save", "Save").accelerator("CmdOrCtrl+S").build(app)?)
        .item(
            &MenuItemBuilder::with_id("save_as", "Save As...")
                .accelerator("CmdOrCtrl+Shift+S")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("export_html", "Export to HTML...")
                .accelerator("CmdOrCtrl+Shift+E")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("export_pdf", "Export to PDF...")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("print", "Print...")
                .accelerator("CmdOrCtrl+P")
                .build(app)?,
        )
        .separator()
        .close_window()
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[&app_menu, &file_menu, &edit_menu])
        .build()?;

    app.set_menu(menu)?;

    app.on_menu_event(move |app_handle, event| {
        let id = event.id().0.as_str();
        match id {
            "new" | "open" | "save" | "save_as" | "export_html" | "export_pdf" | "print"
            | "quit" => {
                let _ = app_handle.emit("menu-event", id);
            }
            _ => {}
        }
    });

    Ok(())
}
