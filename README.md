# 🎯 DashLayer

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/platform-Linux-orange.svg" alt="Platform">
  <img src="https://img.shields.io/badge/rust-1.70+-red.svg" alt="Rust">
</p>

**DashLayer** is a fully customizable desktop widget system for Linux. Create widgets with HTML, CSS, and JavaScript that stay fixed anywhere on your screen!

## ✨ Features

- 🎨 **Complete Visual Editor** - Create widgets with HTML, CSS, and JavaScript using the integrated CodeMirror editor
- 📋 **Widget Templates** - Import pre-made widgets including Clock, System Monitor, Notes, Weather, and Pomodoro Timer
- 📍 **Free Positioning** - Place your widgets anywhere on the screen
- 🔧 **Advanced Customization** - Control opacity, size, always-on-top, transparency, and more
- 💾 **Profile System** - Save and load different widget configurations
- 📦 **Dependency Manager** - Download and save external libraries for offline use
- 🖼️ **Transparent Windows** - Widgets with transparent background and no decorations
- 🔄 **Hot Reload** - Preview your changes in real-time
- 🚀 **Auto-start Support** - Launch widgets automatically when your system starts

## 🚀 Installation

### Prerequisites

- **Rust** (1.70+): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Node.js** (18+): [nodejs.org](https://nodejs.org/)
- **System dependencies**:

```bash
# Ubuntu/Debian
sudo apt install -y libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel gtk3-devel libappindicator-gtk3-devel librsvg2-devel

# Arch Linux
sudo pacman -S webkit2gtk-4.1 gtk3 libappindicator-gtk3 librsvg
```

### Build from Source

```bash
# Clone the repository
git clone https://github.com/hiudyy/DashLayer.git
cd DashLayer

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

## 🎮 How to Use

1. **Create Widget**: Click "New Widget" in the Manager
2. **Edit Code**: Use the HTML, CSS, and JavaScript tabs to customize
3. **Configure**: Adjust size, opacity, and other options in the sidebar
4. **Preview**: Click "Preview" to see the widget on your screen
5. **Save**: Save your widget for future use

### Example Widget - Clock

**HTML:**
```html
<div class="clock-widget">
    <div class="time" id="time"></div>
    <div class="date" id="date"></div>
</div>
```

**CSS:**
```css
.clock-widget {
    padding: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 15px;
    color: white;
    text-align: center;
    font-family: 'Segoe UI', sans-serif;
}

.time {
    font-size: 48px;
    font-weight: bold;
}

.date {
    font-size: 16px;
    opacity: 0.8;
}
```

**JavaScript:**
```javascript
function updateClock() {
    const now = new Date();
    document.getElementById('time').textContent = 
        now.toLocaleTimeString('en-US');
    document.getElementById('date').textContent = 
        now.toLocaleDateString('en-US', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long' 
        });
}
updateClock();
setInterval(updateClock, 1000);
```

## 🛠️ Technologies

- **[Tauri](https://tauri.app/)** - Desktop application framework
- **[Rust](https://www.rust-lang.org/)** - Secure and performant backend
- **[WebKit2GTK](https://webkitgtk.org/)** - Web rendering engine
- **[CodeMirror](https://codemirror.net/)** - Code editor

## 📁 Project Structure

```
DashLayer/
├── src/                    # Frontend (HTML, CSS, JS)
│   ├── index.html
│   ├── styles.css
│   └── main.js
├── src-tauri/              # Rust backend
│   ├── src/
│   │   └── lib.rs          # Main logic
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
└── README.md
```

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. Fork the project
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add: amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**hiudyy**

- GitHub: [@hiudyy](https://github.com/hiudyy)

---

### A Personal Note from the Developer

Hello! This is my very first desktop application, and I'm incredibly excited to share it with you. 🎉

DashLayer started as a learning project to explore desktop development with Rust and Tauri, but it grew into something I genuinely use every day. As someone who loves customizing my workspace, I wanted a way to create beautiful, functional widgets that could live anywhere on my desktop.

Please be gentle with any feedback - I'm still learning and growing as a developer! This project represents hours of learning, experimentation, and passion. If you find any bugs or have suggestions for improvement, I'd love to hear from you in a constructive way.

Thank you for trying out DashLayer, and I hope it brings as much joy to your desktop as it did to mine while building it! 💜

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/hiudyy">hiudyy</a>
</p>
