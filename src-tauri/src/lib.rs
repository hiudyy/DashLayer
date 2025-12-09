use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Manager, WebviewWindow, WebviewWindowBuilder};
use tokio::sync::Mutex;
use sysinfo::{System, Disks, Components};

// Data structures with serde rename for JavaScript compatibility
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Widget {
    pub id: String,
    pub name: String,
    pub html: String,
    pub css: String,
    pub js: String,
    pub width: u32,
    pub height: u32,
    pub opacity: u8,
    pub always_on_top: bool,
    pub transparent: bool,
    pub x: i32,
    pub y: i32,
    #[serde(default)]
    pub auto_start: bool,
    #[serde(default)]
    pub locked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub widgets: Vec<Widget>,
    pub dependencies: Vec<Dependency>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Dependency {
    pub id: String,
    pub url: String,
    pub name: String,
    pub cached: bool,
    pub added_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub cpu_usage: f32,
    pub memory_usage: f32,
    pub memory_total: u64,
    pub memory_used: u64,
    pub disk_usage: f32,
    pub disk_total: u64,
    pub disk_used: u64,
    pub cpu_temperature: Option<f32>,
}

pub struct AppState {
    pub widget_windows: Mutex<HashMap<String, WebviewWindow>>,
    pub system: Arc<Mutex<System>>,
}

// Get config directory
fn get_config_dir() -> Result<PathBuf, String> {
    dirs::config_dir()
        .map(|dir| dir.join("dashlayer"))
        .ok_or_else(|| "Failed to get configuration directory".to_string())
}

fn get_cache_dir() -> Result<PathBuf, String> {
    get_config_dir().map(|dir| dir.join("cache"))
}

// Ensure directories exist
fn ensure_directories() -> Result<(), String> {
    let config_dir = get_config_dir()?;
    let cache_dir = get_cache_dir()?;
    
    fs::create_dir_all(&config_dir).map_err(|e| format!("Failed to create configuration directory: {}", e))?;
    fs::create_dir_all(&cache_dir).map_err(|e| format!("Failed to create cache directory: {}", e))?;
    
    Ok(())
}

// Widget commands
#[tauri::command]
async fn get_widgets() -> Result<Vec<Widget>, String> {
    ensure_directories()?;
    
    let config_dir = get_config_dir()?;
    let widgets_file = config_dir.join("widgets.json");
    
    if widgets_file.exists() {
        let content = fs::read_to_string(&widgets_file)
            .map_err(|e| format!("Failed to read widgets file: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse widgets: {}", e))
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
async fn save_widget(widget: Widget) -> Result<(), String> {
    ensure_directories()?;
    
    let config_dir = get_config_dir()?;
    let widgets_file = config_dir.join("widgets.json");
    
    let mut widgets = if widgets_file.exists() {
        let content = fs::read_to_string(&widgets_file)
            .map_err(|e| format!("Failed to read widgets file: {}", e))?;
        serde_json::from_str::<Vec<Widget>>(&content)
            .map_err(|e| format!("Failed to parse widgets: {}", e))?
    } else {
        vec![]
    };
    
    // Update or add widget
    if let Some(index) = widgets.iter().position(|w| w.id == widget.id) {
        widgets[index] = widget;
    } else {
        widgets.push(widget);
    }
    
    let content = serde_json::to_string_pretty(&widgets)
        .map_err(|e| format!("Failed to serialize widgets: {}", e))?;
    fs::write(&widgets_file, content)
        .map_err(|e| format!("Failed to write widgets file: {}", e))?;
    
    Ok(())
}

#[tauri::command]
async fn delete_widget(widget_id: String, app: AppHandle) -> Result<(), String> {
    ensure_directories()?;
    
    let config_dir = get_config_dir()?;
    let widgets_file = config_dir.join("widgets.json");
    
    let mut widgets = if widgets_file.exists() {
        let content = fs::read_to_string(&widgets_file)
            .map_err(|e| format!("Failed to read widgets file: {}", e))?;
        serde_json::from_str::<Vec<Widget>>(&content)
            .map_err(|e| format!("Failed to parse widgets: {}", e))?
    } else {
        vec![]
    };
    
    widgets.retain(|w| w.id != widget_id);
    
    let content = serde_json::to_string_pretty(&widgets)
        .map_err(|e| format!("Failed to serialize widgets: {}", e))?;
    fs::write(&widgets_file, content)
        .map_err(|e| format!("Failed to write widgets file: {}", e))?;
    
    // Close widget window if open
    let state = app.state::<AppState>();
    let windows = state.widget_windows.lock().await;
    if let Some(window) = windows.get(&widget_id) {
        let _ = window.close();
    }
    
    Ok(())
}

#[tauri::command]
async fn create_widget_window(widget: Widget, app: AppHandle) -> Result<String, String> {
    let state = app.state::<AppState>();
    let mut windows = state.widget_windows.lock().await;
    
    // Close existing window if open
    if let Some(existing) = windows.get(&widget.id) {
        let _ = existing.close();
    }
    
    // Create widget HTML content - clean, no controls
    let widget_html = format!(
        r#"<!DOCTYPE html>
<html lang="en" style="margin:0;padding:0;height:100%;overflow:hidden;">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        *, *::before, *::after {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        html, body {{
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: transparent;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }}
        
        #widget-root {{
            width: 100%;
            height: 100%;
            opacity: {opacity};
        }}
        
        {css}
    </style>
</head>
<body>
    <div id="widget-root">{html}</div>
    <script>
        try {{ {js} }} catch(e) {{ console.error('Widget error:', e); }}
    </script>
</body>
</html>"#,
        title = widget.name,
        opacity = widget.opacity as f32 / 100.0,
        css = widget.css,
        html = widget.html,
        js = widget.js
    );
    
    // Write HTML file to config directory (not monitored by dev server)
    let widgets_dir = get_config_dir()?.join("widgets");
    
    fs::create_dir_all(&widgets_dir).map_err(|e| format!("Failed to create widgets directory: {}", e))?;
    
    let widget_file = widgets_dir.join(format!("{}.html", widget.id));
    fs::write(&widget_file, &widget_html)
        .map_err(|e| format!("Failed to write widget HTML: {}", e))?;
    
    // Use file:// URL to load from config directory
    let widget_url = format!("file://{}", widget_file.display());
    
    // Create new window with correct Tauri v2 API
    let window = WebviewWindowBuilder::new(
        &app,
        &widget.id,
        tauri::WebviewUrl::External(widget_url.parse().map_err(|e| format!("Invalid URL: {}", e))?)
    )
    .title(&widget.name)
    .inner_size(widget.width as f64, widget.height as f64)
    .resizable(true)
    .decorations(false)
    .transparent(widget.transparent)
    .always_on_top(widget.always_on_top)
    .skip_taskbar(true)
    .position(widget.x as f64, widget.y as f64)
    .build()
    .map_err(|e| format!("Failed to create widget window: {}", e))?;
    
    windows.insert(widget.id.clone(), window);
    
    Ok(widget.id)
}

#[tauri::command]
async fn close_widget_window(widget_id: String, app: AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let mut windows = state.widget_windows.lock().await;
    
    if let Some(window) = windows.remove(&widget_id) {
        window.close().map_err(|e| format!("Failed to close widget window: {}", e))?;
    }
    
    Ok(())
}

// Profile commands
#[tauri::command]
async fn get_profiles() -> Result<Vec<Profile>, String> {
    ensure_directories()?;
    
    let config_dir = get_config_dir()?;
    let profiles_file = config_dir.join("profiles.json");
    
    if profiles_file.exists() {
        let content = fs::read_to_string(&profiles_file)
            .map_err(|e| format!("Failed to read profiles file: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse profiles: {}", e))
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
async fn save_profile(profile: Profile) -> Result<(), String> {
    ensure_directories()?;
    
    let config_dir = get_config_dir()?;
    let profiles_file = config_dir.join("profiles.json");
    
    let mut profiles = if profiles_file.exists() {
        let content = fs::read_to_string(&profiles_file)
            .map_err(|e| format!("Failed to read profiles file: {}", e))?;
        serde_json::from_str::<Vec<Profile>>(&content)
            .map_err(|e| format!("Failed to parse profiles: {}", e))?
    } else {
        vec![]
    };
    
    // Update or add profile
    if let Some(index) = profiles.iter().position(|p| p.id == profile.id) {
        profiles[index] = profile;
    } else {
        profiles.push(profile);
    }
    
    let content = serde_json::to_string_pretty(&profiles)
        .map_err(|e| format!("Failed to serialize profiles: {}", e))?;
    fs::write(&profiles_file, content)
        .map_err(|e| format!("Failed to write profiles file: {}", e))?;
    
    Ok(())
}

#[tauri::command]
async fn delete_profile(profile_id: String) -> Result<(), String> {
    ensure_directories()?;
    
    let config_dir = get_config_dir()?;
    let profiles_file = config_dir.join("profiles.json");
    
    let mut profiles = if profiles_file.exists() {
        let content = fs::read_to_string(&profiles_file)
            .map_err(|e| format!("Failed to read profiles file: {}", e))?;
        serde_json::from_str::<Vec<Profile>>(&content)
            .map_err(|e| format!("Failed to parse profiles: {}", e))?
    } else {
        vec![]
    };
    
    profiles.retain(|p| p.id != profile_id);
    
    let content = serde_json::to_string_pretty(&profiles)
        .map_err(|e| format!("Failed to serialize profiles: {}", e))?;
    fs::write(&profiles_file, content)
        .map_err(|e| format!("Failed to write profiles file: {}", e))?;
    
    Ok(())
}

#[tauri::command]
async fn load_profile(profile: Profile) -> Result<(), String> {
    // Save current widgets and dependencies as current profile
    ensure_directories()?;
    
    let config_dir = get_config_dir()?;
    let widgets_file = config_dir.join("widgets.json");
    let dependencies_file = config_dir.join("dependencies.json");
    
    // Save widgets
    let widgets_content = serde_json::to_string_pretty(&profile.widgets)
        .map_err(|e| format!("Failed to serialize widgets: {}", e))?;
    fs::write(&widgets_file, widgets_content)
        .map_err(|e| format!("Failed to write widgets file: {}", e))?;
    
    // Save dependencies
    let deps_content = serde_json::to_string_pretty(&profile.dependencies)
        .map_err(|e| format!("Failed to serialize dependencies: {}", e))?;
    fs::write(&dependencies_file, deps_content)
        .map_err(|e| format!("Failed to write dependencies file: {}", e))?;
    
    Ok(())
}

// Dependency commands
#[tauri::command]
async fn get_dependencies() -> Result<Vec<Dependency>, String> {
    ensure_directories()?;
    
    let config_dir = get_config_dir()?;
    let dependencies_file = config_dir.join("dependencies.json");
    
    if dependencies_file.exists() {
        let content = fs::read_to_string(&dependencies_file)
            .map_err(|e| format!("Failed to read dependencies file: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse dependencies: {}", e))
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
async fn add_dependency(dependency: Dependency) -> Result<(), String> {
    ensure_directories()?;
    
    let config_dir = get_config_dir()?;
    let dependencies_file = config_dir.join("dependencies.json");
    
    let mut dependencies = if dependencies_file.exists() {
        let content = fs::read_to_string(&dependencies_file)
            .map_err(|e| format!("Failed to read dependencies file: {}", e))?;
        serde_json::from_str::<Vec<Dependency>>(&content)
            .map_err(|e| format!("Failed to parse dependencies: {}", e))?
    } else {
        vec![]
    };
    
    // Update or add dependency
    if let Some(index) = dependencies.iter().position(|d| d.id == dependency.id) {
        dependencies[index] = dependency;
    } else {
        dependencies.push(dependency);
    }
    
    let content = serde_json::to_string_pretty(&dependencies)
        .map_err(|e| format!("Failed to serialize dependencies: {}", e))?;
    fs::write(&dependencies_file, content)
        .map_err(|e| format!("Failed to write dependencies file: {}", e))?;
    
    Ok(())
}

#[tauri::command]
async fn remove_dependency(dependency_id: String) -> Result<(), String> {
    ensure_directories()?;
    
    let config_dir = get_config_dir()?;
    let dependencies_file = config_dir.join("dependencies.json");
    
    let mut dependencies = if dependencies_file.exists() {
        let content = fs::read_to_string(&dependencies_file)
            .map_err(|e| format!("Failed to read dependencies file: {}", e))?;
        serde_json::from_str::<Vec<Dependency>>(&content)
            .map_err(|e| format!("Failed to parse dependencies: {}", e))?
    } else {
        vec![]
    };
    
    dependencies.retain(|d| d.id != dependency_id);
    
    let content = serde_json::to_string_pretty(&dependencies)
        .map_err(|e| format!("Failed to serialize dependencies: {}", e))?;
    fs::write(&dependencies_file, content)
        .map_err(|e| format!("Failed to write dependencies file: {}", e))?;
    
    Ok(())
}

// Autostart command - creates/removes .desktop file in autostart directory
#[tauri::command]
async fn set_autostart(enabled: bool) -> Result<(), String> {
    let autostart_dir = dirs::config_dir()
        .map(|d| d.join("autostart"))
        .ok_or("Failed to get autostart directory")?;
    
    fs::create_dir_all(&autostart_dir)
        .map_err(|e| format!("Failed to create autostart directory: {}", e))?;
    
    let desktop_file = autostart_dir.join("dashlayer.desktop");
    
    if enabled {
        let exe_path = std::env::current_exe()
            .map_err(|e| format!("Failed to get executable path: {}", e))?;
        
        let content = format!(
            r#"[Desktop Entry]
Type=Application
Name=DashLayer
Comment=Desktop Widget Manager
Exec={}
Icon=dashlayer
Terminal=false
Categories=Utility;
StartupNotify=false
X-GNOME-Autostart-enabled=true
"#,
            exe_path.display()
        );
        
        fs::write(&desktop_file, content)
            .map_err(|e| format!("Failed to write autostart file: {}", e))?;
    } else {
        if desktop_file.exists() {
            fs::remove_file(&desktop_file)
                .map_err(|e| format!("Failed to remove autostart file: {}", e))?;
        }
    }
    
    Ok(())
}

#[tauri::command]
async fn get_autostart() -> Result<bool, String> {
    let autostart_dir = dirs::config_dir()
        .map(|d| d.join("autostart"))
        .ok_or("Failed to get autostart directory")?;
    
    let desktop_file = autostart_dir.join("dashlayer.desktop");
    Ok(desktop_file.exists())
}

// Get screen info for visual positioning
#[tauri::command]
async fn get_screen_size() -> Result<(u32, u32), String> {
    // Return a default screen size - in real app would query the system
    Ok((1920, 1080))
}

// Launch all autostart widgets
#[tauri::command]
async fn launch_autostart_widgets(app: AppHandle) -> Result<(), String> {
    let widgets = get_widgets().await?;
    
    for widget in widgets.iter().filter(|w| w.auto_start) {
        let _ = create_widget_window(widget.clone(), app.clone()).await;
    }
    
    Ok(())
}

// System monitoring commands
#[tauri::command]
async fn get_system_info(system: tauri::State<'_, Arc<Mutex<System>>>) -> Result<SystemInfo, String> {
    let mut sys = system.lock().await;
    
    // Double refresh for accurate usage calculation
    sys.refresh_all();
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    sys.refresh_all();
    
    // Get CPU usage from global_cpu_info
    let cpu_info = sys.global_cpu_info();
    let cpu_usage = cpu_info.cpu_usage();
    
    // Get memory information
    let total_memory = sys.total_memory();
    let used_memory = sys.used_memory();
    let memory_usage = if total_memory > 0 {
        (used_memory as f32 / total_memory as f32) * 100.0
    } else {
        0.0
    };
    
    // Get disk information using separate Disks struct
    let disks = Disks::new_with_refreshed_list();
    let (disk_total, disk_used, disk_usage) = if let Some(disk) = disks.list().first() {
        let total = disk.total_space();
        let available = disk.available_space();
        let used = total - available;
        let usage = if total > 0 {
            (used as f32 / total as f32) * 100.0
        } else {
            0.0
        };
        (total, used, usage)
    } else {
        (0, 0, 0.0)
    };
    
    // Get CPU temperature using separate Components struct
    let components = Components::new_with_refreshed_list();
    let cpu_temp = components.list()
        .iter()
        .find(|c| {
            let label = c.label().to_lowercase();
            label.contains("cpu") || label.contains("core") || label.contains("package")
        })
        .map(|c| c.temperature());
    
    Ok(SystemInfo {
        cpu_usage,
        memory_usage,
        memory_total: total_memory,
        memory_used: used_memory,
        disk_usage,
        disk_total,
        disk_used,
        cpu_temperature: cpu_temp,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            widget_windows: Mutex::new(HashMap::new()),
            system: Arc::new(Mutex::new(System::new())),
        })
        .invoke_handler(tauri::generate_handler![
            get_widgets,
            save_widget,
            delete_widget,
            create_widget_window,
            close_widget_window,
            get_profiles,
            save_profile,
            delete_profile,
            load_profile,
            get_dependencies,
            add_dependency,
            remove_dependency,
            get_autostart,
            set_autostart,
            get_screen_size,
            launch_autostart_widgets,
            get_system_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
