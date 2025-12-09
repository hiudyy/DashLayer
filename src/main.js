// DashLayer - Desktop Widget Manager
// Using Tauri Global API

const { invoke } = window.__TAURI__.core;

// App version
const APP_VERSION = '0.1.0';
const GITHUB_REPO = 'hiudyy/DashLayer';

// App State
const state = {
    widgets: [],
    profiles: [],
    dependencies: [],
    currentWidget: null,
    editors: {},
    autostart: false,
    openWidgets: new Set(), // Track open widgets
    templates: [] // Widget templates
};

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    await loadSettings();
    initNavigation();
    initEditors();
    initEventListeners();
    initSettings();
    renderWidgets();
    renderProfiles();
    renderDependencies();
    await loadTemplates(); // Load widget templates
    
    // Launch autostart widgets
    try {
        await invoke('launch_autostart_widgets');
    } catch (e) {
        console.log('No autostart widgets');
    }
    
    // Check for updates (non-blocking)
    checkForUpdates();
});

// Load Data from Backend
async function loadData() {
    try {
        state.widgets = await invoke('get_widgets') || [];
        state.profiles = await invoke('get_profiles') || [];
        state.dependencies = await invoke('get_dependencies') || [];
    } catch (error) {
        console.error('Error loading data:', error);
        state.widgets = [];
        state.profiles = [];
        state.dependencies = [];
    }
}

// Load Settings
async function loadSettings() {
    try {
        state.autostart = await invoke('get_autostart');
    } catch (e) {
        state.autostart = false;
    }
}

// Navigation
function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.dataset.tab;
            
            // Update nav
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            // Update panels
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(`${tab}-panel`).classList.add('active');
        });
    });
}

// Code Editors
function initEditors() {
    const config = {
        theme: 'dracula',
        lineNumbers: true,
        autoCloseBrackets: true,
        autoCloseTags: true,
        tabSize: 2,
        indentWithTabs: false
    };

    state.editors.html = CodeMirror.fromTextArea(document.getElementById('html-editor'), {
        ...config,
        mode: 'htmlmixed'
    });

    state.editors.css = CodeMirror.fromTextArea(document.getElementById('css-editor'), {
        ...config,
        mode: 'css'
    });

    state.editors.js = CodeMirror.fromTextArea(document.getElementById('js-editor'), {
        ...config,
        mode: 'javascript'
    });

    // Set default content
    setDefaultWidgetCode();

    // Editor tabs
    document.querySelectorAll('.editor-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const lang = tab.dataset.lang;
            
            document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            document.querySelectorAll('.code-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(`${lang}-panel`).classList.add('active');
            
            state.editors[lang].refresh();
        });
    });
}

function setDefaultWidgetCode() {
    state.editors.html.setValue(`<div class="widget">
    <div class="time" id="time"></div>
    <div class="date" id="date"></div>
</div>`);

    state.editors.css.setValue(`.widget {
    padding: 24px 32px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 16px;
    color: white;
    text-align: center;
    font-family: 'Segoe UI', sans-serif;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}

.time {
    font-size: 48px;
    font-weight: 700;
    letter-spacing: -1px;
}

.date {
    font-size: 14px;
    opacity: 0.85;
    margin-top: 4px;
    text-transform: capitalize;
}`);

    state.editors.js.setValue(`function updateClock() {
    const now = new Date();
    
    document.getElementById('time').textContent = 
        now.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    
    document.getElementById('date').textContent = 
        now.toLocaleDateString('pt-BR', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long' 
        });
}

updateClock();
setInterval(updateClock, 1000);`);
}

// Event Listeners
function initEventListeners() {
    // New Widget Button
    document.getElementById('new-widget-btn').addEventListener('click', () => {
        state.currentWidget = null;
        setDefaultWidgetCode();
        document.getElementById('widget-name').value = '';
        document.getElementById('widget-width').value = 300;
        document.getElementById('widget-height').value = 200;
        document.getElementById('widget-opacity').value = 100;
        document.getElementById('opacity-value').textContent = '100%';
        document.getElementById('widget-always-top').checked = true;
        document.getElementById('widget-transparent').checked = true;
        
        // Switch to editor
        document.querySelector('[data-tab="editor"]').click();
    });

    // Opacity slider
    document.getElementById('widget-opacity').addEventListener('input', (e) => {
        document.getElementById('opacity-value').textContent = `${e.target.value}%`;
    });

    // Save Widget
    document.getElementById('save-btn').addEventListener('click', saveWidget);

    // Preview Widget
    document.getElementById('preview-btn').addEventListener('click', previewWidget);

    // New Profile
    document.getElementById('new-profile-btn').addEventListener('click', createProfile);

    // Add Dependency
    document.getElementById('add-dep-btn').addEventListener('click', addDependency);

    // Modal close
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });
}

// Widget Functions
async function saveWidget() {
    const widget = {
        id: state.currentWidget?.id || Date.now().toString(),
        name: document.getElementById('widget-name').value || 'Unnamed Widget',
        html: state.editors.html.getValue(),
        css: state.editors.css.getValue(),
        js: state.editors.js.getValue(),
        width: parseInt(document.getElementById('widget-width').value) || 300,
        height: parseInt(document.getElementById('widget-height').value) || 200,
        opacity: parseInt(document.getElementById('widget-opacity').value) || 100,
        alwaysOnTop: document.getElementById('widget-always-top').checked,
        transparent: document.getElementById('widget-transparent').checked,
        x: state.currentWidget?.x || 100,
        y: state.currentWidget?.y || 100
    };

    try {
        await invoke('save_widget', { widget });
        state.currentWidget = widget;
        await loadData();
        renderWidgets();
        showToast('Widget salvo com sucesso!', 'success');
    } catch (error) {
        console.error('Error saving widget:', error);
        showToast('Erro ao salvar widget: ' + error, 'error');
    }
}

async function previewWidget() {
    await saveWidget();
    
    if (!state.currentWidget) return;

    try {
        await invoke('create_widget_window', { widget: state.currentWidget });
        showToast('Widget opened!', 'success');
    } catch (error) {
        console.error('Error creating widget:', error);
        showToast('Error creating widget: ' + error, 'error');
    }
}

function editWidget(id) {
    const widget = state.widgets.find(w => w.id === id);
    if (!widget) return;

    state.currentWidget = widget;
    
    document.getElementById('widget-name').value = widget.name;
    document.getElementById('widget-width').value = widget.width;
    document.getElementById('widget-height').value = widget.height;
    document.getElementById('widget-opacity').value = widget.opacity;
    document.getElementById('opacity-value').textContent = `${widget.opacity}%`;
    document.getElementById('widget-always-top').checked = widget.alwaysOnTop;
    document.getElementById('widget-transparent').checked = widget.transparent;
    
    state.editors.html.setValue(widget.html || '');
    state.editors.css.setValue(widget.css || '');
    state.editors.js.setValue(widget.js || '');
    
    document.querySelector('[data-tab="editor"]').click();
}

async function openWidget(id) {
    const widget = state.widgets.find(w => w.id === id);
    if (!widget) return;

    try {
        // If widget is already open, close it first
        if (state.openWidgets.has(id)) {
            try {
                await invoke('close_widget_window', { widgetId: id });
                state.openWidgets.delete(id);
            } catch (e) {
                // Widget might have been closed manually
                state.openWidgets.delete(id);
            }
        }
        
        await invoke('create_widget_window', { widget });
        state.openWidgets.add(id);
        renderWidgets(); // Update UI to show open state
        showToast('Widget opened!', 'success');
    } catch (error) {
        console.error('Error opening widget:', error);
        // Check if it's a "window already exists" error
        if (error.toString().includes('already exists') || error.toString().includes('already')) {
            state.openWidgets.add(id);
            showToast('Widget is already open', 'warning');
        } else {
            showToast('Error opening widget: ' + error, 'error');
        }
    }
}

async function closeWidget(id) {
    try {
        await invoke('close_widget_window', { widgetId: id });
        state.openWidgets.delete(id);
        renderWidgets();
        showToast('Widget closed!', 'success');
    } catch (error) {
        state.openWidgets.delete(id);
        renderWidgets();
    }
}

async function deleteWidget(id) {
    if (!await showConfirm('Are you sure you want to delete this widget?', 'Delete Widget')) return;

    try {
        await invoke('delete_widget', { widgetId: id });
        await loadData();
        renderWidgets();
        showToast('Widget deleted!', 'success');
    } catch (error) {
        console.error('Error deleting widget:', error);
        showToast('Error deleting widget: ' + error, 'error');
    }
}

function renderWidgets() {
    const container = document.getElementById('widgets-container');
    if (!container) return;
    
    const empty = document.getElementById('empty-widgets');

    if (state.widgets.length === 0) {
        if (empty) {
            container.innerHTML = '';
            container.appendChild(empty);
            empty.style.display = 'flex';
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="7" height="7" rx="1"/>
                        <rect x="14" y="3" width="7" height="7" rx="1"/>
                        <rect x="3" y="14" width="7" height="7" rx="1"/>
                        <rect x="14" y="14" width="7" height="7" rx="1"/>
                    </svg>
                    <h3>No widgets created</h3>
                    <p>Click "New Widget" to get started</p>
                </div>
            `;
        }
        return;
    }

    if (empty) empty.style.display = 'none';
    container.innerHTML = state.widgets.map(widget => {
        const isOpen = state.openWidgets.has(widget.id);
        const openButton = isOpen 
            ? `<button class="btn btn-warning btn-sm" onclick="closeWidget('${widget.id}')" title="Close widget">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                    </svg>
                </button>`
            : `<button class="btn btn-primary btn-sm" onclick="openWidget('${widget.id}')" title="Open widget">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                </button>`;
        
        return `
        <div class="widget-card ${isOpen ? 'widget-open' : ''}">
            <div class="widget-card-header">
                <span class="widget-card-title">${escapeHtml(widget.name)}</span>
                ${isOpen ? '<span class="widget-status-dot" title="Widget active"></span>' : ''}
            </div>
            <div class="widget-card-badges">
                ${widget.autoStart ? '<span class="widget-card-badge">Auto</span>' : ''}
                ${isOpen ? '<span class="widget-card-badge badge-success">Active</span>' : ''}
            </div>
            <div class="widget-card-info">
                <span class="widget-card-stat">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                    </svg>
                    ${widget.width}x${widget.height}
                </span>
                <span class="widget-card-stat">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                    </svg>
                    ${widget.opacity}%
                </span>
                <span class="widget-card-stat">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                    </svg>
                    ${widget.x}, ${widget.y}
                </span>
            </div>
            <div class="widget-card-actions">
                <button class="btn btn-secondary btn-sm" onclick="configureWidget('${widget.id}')" title="Configure">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                    </svg>
                </button>
                <button class="btn btn-secondary btn-sm" onclick="editWidget('${widget.id}')" title="Edit code">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="16 18 22 12 16 6"/>
                        <polyline points="8 6 2 12 8 18"/>
                    </svg>
                </button>
                ${openButton}
                <button class="btn btn-ghost btn-sm" onclick="deleteWidget('${widget.id}')" title="Delete">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        </div>`;
    }).join('');
}

// Profile Functions
async function createProfile() {
    const name = await showPrompt('Enter profile name:', '', 'Create Profile');
    if (!name) return;

    const profile = {
        id: Date.now().toString(),
        name: name,
        widgets: [...state.widgets],
        dependencies: [...state.dependencies],
        createdAt: new Date().toISOString()
    };

    try {
        await invoke('save_profile', { profile });
        await loadData();
        renderProfiles();
        showToast('Profile created!', 'success');
    } catch (error) {
        console.error('Error creating profile:', error);
        showToast('Error creating profile: ' + error, 'error');
    }
}

async function loadProfile(id) {
    const profile = state.profiles.find(p => p.id === id);
    if (!profile) return;

    try {
        await invoke('load_profile', { profile });
        await loadData();
        renderWidgets();
        renderDependencies();
        showToast(`Profile "${profile.name}" loaded!`, 'success');
    } catch (error) {
        console.error('Error loading profile:', error);
        showToast('Error loading profile: ' + error, 'error');
    }
}

async function deleteProfile(id) {
    if (!await showConfirm('Are you sure you want to delete this profile?', 'Delete Profile')) return;

    try {
        await invoke('delete_profile', { profileId: id });
        await loadData();
        renderProfiles();
        showToast('Profile deleted!', 'success');
    } catch (error) {
        console.error('Error deleting profile:', error);
        showToast('Error deleting profile: ' + error, 'error');
    }
}

function renderProfiles() {
    const container = document.getElementById('profiles-container');
    const empty = document.getElementById('empty-profiles');

    if (state.profiles.length === 0) {
        container.innerHTML = '';
        container.appendChild(empty);
        empty.style.display = 'flex';
        return;
    }

    empty.style.display = 'none';
    container.innerHTML = state.profiles.map(profile => `
        <div class="profile-card">
            <div class="profile-card-header">
                <span class="profile-card-title">${escapeHtml(profile.name)}</span>
            </div>
            <div class="profile-card-meta">
                ${profile.widgets?.length || 0} widgets • Created on ${formatDate(profile.createdAt)}
            </div>
            <div class="profile-card-actions">
                <button class="btn btn-primary btn-sm" onclick="loadProfile('${profile.id}')">
                    Load
                </button>
                <button class="btn btn-ghost btn-sm" onclick="deleteProfile('${profile.id}')" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

// Dependency Functions
async function addDependency() {
    const url = document.getElementById('dep-url').value.trim();
    if (!url) {
        showToast('Please enter a valid URL', 'warning');
        return;
    }

    const dependency = {
        id: Date.now().toString(),
        url: url,
        name: url.split('/').pop() || url,
        cached: false,
        addedAt: new Date().toISOString()
    };

    try {
        await invoke('add_dependency', { dependency });
        document.getElementById('dep-url').value = '';
        await loadData();
        renderDependencies();
        showToast('Dependency added!', 'success');
    } catch (error) {
        console.error('Error adding dependency:', error);
        showToast('Error adding dependency: ' + error, 'error');
    }
}

async function removeDependency(id) {
    try {
        await invoke('remove_dependency', { dependencyId: id });
        await loadData();
        renderDependencies();
        showToast('Dependency removed!', 'success');
    } catch (error) {
        console.error('Error removing dependency:', error);
        showToast('Error removing dependency: ' + error, 'error');
    }
}

function renderDependencies() {
    const container = document.getElementById('dependencies-list');
    const empty = document.getElementById('empty-deps');

    if (state.dependencies.length === 0) {
        container.innerHTML = '';
        container.appendChild(empty);
        empty.style.display = 'flex';
        return;
    }

    empty.style.display = 'none';
    container.innerHTML = state.dependencies.map(dep => `
        <div class="dependency-item">
            <div class="dependency-info">
                <div class="dependency-url">${escapeHtml(dep.name)}</div>
                <div class="dependency-meta">${escapeHtml(dep.url)}</div>
            </div>
            <div class="dependency-status ${dep.cached ? '' : 'pending'}">
                ${dep.cached ? '✓ Cached' : '○ Online'}
            </div>
            <button class="btn btn-ghost btn-sm" onclick="removeDependency('${dep.id}')" title="Remove">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
    `).join('');
}

// Modal
function showModal(title, content, footer = '') {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = content;
    document.getElementById('modal-footer').innerHTML = footer;
    document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
}

// Custom Confirmation Modal
function showConfirm(message, title = 'Confirm Action') {
    return new Promise((resolve) => {
        const modalContent = `
            <div class="confirm-content">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.5">
                    <path d="M12 9v4"/>
                    <path d="M12 17h.01"/>
                    <circle cx="12" cy="12" r="10"/>
                </svg>
                <p>${escapeHtml(message)}</p>
            </div>
        `;
        
        const modalFooter = `
            <button class="btn btn-secondary" onclick="closeConfirmModal(false)">Cancel</button>
            <button class="btn btn-danger" onclick="closeConfirmModal(true)">Confirm</button>
        `;
        
        showModal(title, modalContent, modalFooter);
        
        // Store the resolve function globally for the close handlers
        window._currentConfirmResolve = resolve;
        
        // Handle overlay click as cancel
        const overlay = document.getElementById('modal-overlay');
        const overlayHandler = (e) => {
            if (e.target === overlay) {
                closeConfirmModal(false);
            }
        };
        overlay.addEventListener('click', overlayHandler);
        window._currentConfirmOverlayHandler = overlayHandler;
        
        // Handle escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                closeConfirmModal(false);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        window._currentConfirmEscapeHandler = escapeHandler;
    });
}

function closeConfirmModal(confirmed) {
    closeModal();
    
    // Clean up event listeners
    if (window._currentConfirmOverlayHandler) {
        document.getElementById('modal-overlay').removeEventListener('click', window._currentConfirmOverlayHandler);
        delete window._currentConfirmOverlayHandler;
    }
    if (window._currentConfirmEscapeHandler) {
        document.removeEventListener('keydown', window._currentConfirmEscapeHandler);
        delete window._currentConfirmEscapeHandler;
    }
    
    // Resolve the promise
    if (window._currentConfirmResolve) {
        window._currentConfirmResolve(confirmed);
        delete window._currentConfirmResolve;
    }
}

// Make confirm functions global
window.closeConfirmModal = closeConfirmModal;

// Custom Alert Modal
function showAlert(message, title = 'Notification') {
    return new Promise((resolve) => {
        const modalContent = `
            <div class="alert-content">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="1.5">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <p>${escapeHtml(message)}</p>
            </div>
        `;
        
        const modalFooter = `
            <button class="btn btn-primary" onclick="closeAlertModal(true)">OK</button>
        `;
        
        showModal(title, modalContent, modalFooter);
        
        // Store the resolve function globally
        window._currentAlertResolve = resolve;
        
        // Handle escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                closeAlertModal(true);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        window._currentAlertEscapeHandler = escapeHandler;
    });
}

function closeAlertModal(confirmed) {
    closeModal();
    
    // Clean up event listeners
    if (window._currentAlertEscapeHandler) {
        document.removeEventListener('keydown', window._currentAlertEscapeHandler);
        delete window._currentAlertEscapeHandler;
    }
    
    // Resolve the promise
    if (window._currentAlertResolve) {
        window._currentAlertResolve(confirmed);
        delete window._currentAlertResolve;
    }
}

// Custom Prompt Modal
function showPrompt(message, defaultValue = '', title = 'Input Required') {
    return new Promise((resolve) => {
        const modalContent = `
            <div class="prompt-content">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="1.5">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                </svg>
                <p>${escapeHtml(message)}</p>
                <input type="text" id="prompt-input" class="prompt-input" value="${escapeHtml(defaultValue)}" placeholder="Enter your response...">
            </div>
        `;
        
        const modalFooter = `
            <button class="btn btn-secondary" onclick="closePromptModal(null)">Cancel</button>
            <button class="btn btn-primary" onclick="closePromptModal(document.getElementById('prompt-input').value)">OK</button>
        `;
        
        showModal(title, modalContent, modalFooter);
        
        // Store the resolve function globally
        window._currentPromptResolve = resolve;
        
        // Focus input and select text
        setTimeout(() => {
            const input = document.getElementById('prompt-input');
            if (input) {
                input.focus();
                input.select();
            }
        }, 100);
        
        // Handle enter key
        const enterHandler = (e) => {
            if (e.key === 'Enter') {
                closePromptModal(document.getElementById('prompt-input').value);
            }
        };
        document.addEventListener('keydown', enterHandler);
        window._currentPromptEnterHandler = enterHandler;
        
        // Handle escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                closePromptModal(null);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        window._currentPromptEscapeHandler = escapeHandler;
    });
}

function closePromptModal(value) {
    closeModal();
    
    // Clean up event listeners
    if (window._currentPromptEnterHandler) {
        document.removeEventListener('keydown', window._currentPromptEnterHandler);
        delete window._currentPromptEnterHandler;
    }
    if (window._currentPromptEscapeHandler) {
        document.removeEventListener('keydown', window._currentPromptEscapeHandler);
        delete window._currentPromptEscapeHandler;
    }
    
    // Resolve the promise
    if (window._currentPromptResolve) {
        window._currentPromptResolve(value);
        delete window._currentPromptResolve;
    }
}

// Make alert and prompt functions global
window.closeAlertModal = closeAlertModal;
window.closePromptModal = closePromptModal;

// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    
    const icons = {
        success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Utilities
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    try {
        return new Date(dateStr).toLocaleDateString('en-US');
    } catch {
        return dateStr;
    }
}

// Make functions global for onclick handlers
window.editWidget = editWidget;
window.openWidget = openWidget;
window.closeWidget = closeWidget;
window.deleteWidget = deleteWidget;
window.loadProfile = loadProfile;
window.deleteProfile = deleteProfile;
window.removeDependency = removeDependency;
window.toggleAutoStart = toggleAutoStart;
window.configureWidget = configureWidget;

// Settings
function initSettings() {
    const autostartToggle = document.getElementById('autostart-toggle');
    if (autostartToggle) {
        autostartToggle.checked = state.autostart;
        autostartToggle.addEventListener('change', async (e) => {
            try {
                await invoke('set_autostart', { enabled: e.target.checked });
                state.autostart = e.target.checked;
                showToast(e.target.checked ? 'Autostart enabled!' : 'Autostart disabled!', 'success');
            } catch (error) {
                console.error('Error setting autostart:', error);
                showToast('Error configuring autostart', 'error');
                e.target.checked = !e.target.checked;
            }
        });
    }
}

// Toggle widget autostart
async function toggleAutoStart(id) {
    const widget = state.widgets.find(w => w.id === id);
    if (!widget) return;
    
    widget.autoStart = !widget.autoStart;
    
    try {
        await invoke('save_widget', { widget });
        await loadData();
        renderWidgets();
        showToast(widget.autoStart ? 'Widget will start automatically' : 'Auto-start disabled', 'success');
    } catch (error) {
        console.error('Error toggling autostart:', error);
        showToast('Error saving configuration', 'error');
    }
}

// Configure widget position/size visually
function configureWidget(id) {
    const widget = state.widgets.find(w => w.id === id);
    if (!widget) return;
    
    const modalContent = `
        <div class="form-group">
            <label>Name</label>
            <input type="text" class="input" id="config-name" value="${escapeHtml(widget.name)}">
        </div>
        <div class="position-editor">
            <label>Screen Position</label>
            <div class="screen-preview" id="screen-preview">
                <div class="widget-preview-box" id="widget-preview" 
                     style="left: ${(widget.x / 1920) * 100}%; top: ${(widget.y / 1080) * 100}%; 
                            width: ${(widget.width / 1920) * 100}%; height: ${(widget.height / 1080) * 100}%;">
                    Widget
                </div>
            </div>
            <div class="position-coords">
                <div class="form-group">
                    <label>X</label>
                    <input type="number" class="input" id="config-x" value="${widget.x}">
                </div>
                <div class="form-group">
                    <label>Y</label>
                    <input type="number" class="input" id="config-y" value="${widget.y}">
                </div>
                <div class="form-group">
                    <label>Width</label>
                    <input type="number" class="input" id="config-width" value="${widget.width}">
                </div>
                <div class="form-group">
                    <label>Height</label>
                    <input type="number" class="input" id="config-height" value="${widget.height}">
                </div>
            </div>
        </div>
        <div style="margin-top: 16px;">
            <label class="toggle-label">
                <span>Auto-start</span>
                <input type="checkbox" id="config-autostart" ${widget.autoStart ? 'checked' : ''}>
                <span class="toggle"></span>
            </label>
        </div>
    `;
    
    const modalFooter = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveWidgetConfig('${id}')">Save</button>
    `;
    
    showModal('Configure Widget', modalContent, modalFooter);
    
    // Setup drag in preview
    setTimeout(() => {
        setupPreviewDrag(widget);
    }, 100);
}

function setupPreviewDrag(widget) {
    const preview = document.getElementById('widget-preview');
    const container = document.getElementById('screen-preview');
    if (!preview || !container) return;
    
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    preview.addEventListener('mousedown', (e) => {
        isDragging = true;
        const rect = preview.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startLeft = rect.left - container.getBoundingClientRect().left;
        startTop = rect.top - container.getBoundingClientRect().top;
        preview.classList.add('dragging');
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const containerRect = container.getBoundingClientRect();
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        let newLeft = startLeft + deltaX;
        let newTop = startTop + deltaY;
        
        // Clamp to container
        newLeft = Math.max(0, Math.min(newLeft, containerRect.width - preview.offsetWidth));
        newTop = Math.max(0, Math.min(newTop, containerRect.height - preview.offsetHeight));
        
        preview.style.left = (newLeft / containerRect.width * 100) + '%';
        preview.style.top = (newTop / containerRect.height * 100) + '%';
        
        // Update inputs
        document.getElementById('config-x').value = Math.round(newLeft / containerRect.width * 1920);
        document.getElementById('config-y').value = Math.round(newTop / containerRect.height * 1080);
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
        preview.classList.remove('dragging');
    });
}

async function saveWidgetConfig(id) {
    const widget = state.widgets.find(w => w.id === id);
    if (!widget) return;
    
    widget.name = document.getElementById('config-name').value || widget.name;
    widget.x = parseInt(document.getElementById('config-x').value) || 0;
    widget.y = parseInt(document.getElementById('config-y').value) || 0;
    widget.width = parseInt(document.getElementById('config-width').value) || 300;
    widget.height = parseInt(document.getElementById('config-height').value) || 200;
    widget.autoStart = document.getElementById('config-autostart').checked;
    
    try {
        await invoke('save_widget', { widget });
        await loadData();
        renderWidgets();
        closeModal();
        showToast('Configuration saved!', 'success');
    } catch (error) {
        console.error('Error saving widget config:', error);
        showToast('Error saving configuration', 'error');
    }
}

window.saveWidgetConfig = saveWidgetConfig;

// Templates Functions
async function loadTemplates() {
    try {
        const templateFiles = [
            'clock.json',
            'system-monitor.json',
            'notes.json',
            'weather.json',
            'pomodoro.json',
            'world-clock.json',
            'calendar.json',
            'countdown.json'
        ];
        
        state.templates = [];
        
        for (const file of templateFiles) {
            try {
                const response = await fetch(`templates/${file}`);
                if (response.ok) {
                    const template = await response.json();
                    state.templates.push(template);
                }
            } catch (error) {
                console.warn(`Failed to load template ${file}:`, error);
            }
        }
        
        renderTemplates();
    } catch (error) {
        console.error('Error loading templates:', error);
        document.getElementById('loading-templates').innerHTML = 
            '<p>Failed to load templates</p>';
    }
}

function renderTemplates() {
    const container = document.getElementById('templates-container');
    
    if (state.templates.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <line x1="9" y1="9" x2="15" y2="9"/>
                    <line x1="9" y1="13" x2="15" y2="13"/>
                    <line x1="9" y1="17" x2="13" y2="17"/>
                </svg>
                <h3>No templates available</h3>
                <p>Templates could not be loaded</p>
            </div>
        `;
        return;
    }
    
    // Group templates by category
    const templatesByCategory = {};
    state.templates.forEach(template => {
        const category = template.category || 'Other';
        if (!templatesByCategory[category]) {
            templatesByCategory[category] = [];
        }
        templatesByCategory[category].push(template);
    });
    
    let html = '';
    Object.keys(templatesByCategory).forEach(category => {
        html += `
            <div class="template-category">
                <h3>${category}</h3>
                <div class="template-grid">
                    ${templatesByCategory[category].map(template => `
                        <div class="template-card">
                            <div class="template-header">
                                <h4>${escapeHtml(template.name)}</h4>
                                <span class="template-category-badge">${escapeHtml(template.category)}</span>
                            </div>
                            <p class="template-description">${escapeHtml(template.description)}</p>
                            <div class="template-info">
                                <span class="template-size">${template.width}x${template.height}</span>
                                <span class="template-opacity">${template.opacity}% opacity</span>
                            </div>
                            <div class="template-actions">
                                <button class="btn btn-primary btn-sm" onclick="importTemplate('${template.name}')">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                        <polyline points="7 10 12 15 17 10"/>
                                        <line x1="12" y1="15" x2="12" y2="3"/>
                                    </svg>
                                    Import
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

async function importTemplate(templateName) {
    const template = state.templates.find(t => t.name === templateName);
    if (!template) {
        showToast('Template not found', 'error');
        return;
    }
    
    try {
        // Validate template has required fields
        if (!template.name || !template.html || !template.css || !template.js) {
            throw new Error('Template is missing required fields');
        }
        
        // Create a new widget from template
        const widget = {
            id: Date.now().toString(),
            name: template.name + ' (Imported)',
            html: template.html,
            css: template.css,
            js: template.js,
            width: parseInt(template.width) || 300,
            height: parseInt(template.height) || 200,
            opacity: parseInt(template.opacity) || 100,
            alwaysOnTop: Boolean(template.alwaysOnTop),
            transparent: Boolean(template.transparent),
            x: parseInt(template.x) + 50 || 150, // Offset slightly to avoid overlap
            y: parseInt(template.y) + 50 || 150,
            autoStart: false // Don't auto-start imported widgets
        };
        
        // Save the widget
        await invoke('save_widget', { widget });
        
        // Reload widgets
        await loadData();
        renderWidgets();
        
        // Switch to editor tab with the new widget
        document.querySelector('[data-tab="editor"]').click();
        editWidget(widget.id);
        
        showToast(`Template "${templateName}" imported successfully!`, 'success');
    } catch (error) {
        console.error('Error importing template:', error);
        showToast('Error importing template: ' + error, 'error');
    }
}

// Make template functions global
window.importTemplate = importTemplate;

// ============================================
// UPDATE CHECKER
// ============================================

async function checkForUpdates(showNoUpdate = false) {
    try {
        const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
        
        if (!response.ok) {
            if (showNoUpdate) {
                showToast('Could not check for updates', 'error');
            }
            return;
        }
        
        const release = await response.json();
        const latestVersion = release.tag_name.replace('v', '');
        
        if (isNewerVersion(latestVersion, APP_VERSION)) {
            showUpdateModal(latestVersion, release.html_url, release.body);
        } else if (showNoUpdate) {
            showToast('You are using the latest version!', 'success');
        }
    } catch (error) {
        console.error('Error checking for updates:', error);
        if (showNoUpdate) {
            showToast('Could not check for updates', 'error');
        }
    }
}

function isNewerVersion(latest, current) {
    const latestParts = latest.split('.').map(Number);
    const currentParts = current.split('.').map(Number);
    
    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
        const latestPart = latestParts[i] || 0;
        const currentPart = currentParts[i] || 0;
        
        if (latestPart > currentPart) return true;
        if (latestPart < currentPart) return false;
    }
    
    return false;
}

function showUpdateModal(version, url, releaseNotes) {
    const modal = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const footer = document.getElementById('modal-footer');
    
    title.textContent = '🎉 Update Available!';
    
    body.innerHTML = `
        <div class="update-modal">
            <div class="update-header">
                <div class="update-icon">🚀</div>
                <div class="update-info">
                    <h3>DashLayer v${version}</h3>
                    <p>A new version is available!</p>
                </div>
            </div>
            <div class="update-current">
                <span>Current version:</span>
                <span class="version-badge">v${APP_VERSION}</span>
            </div>
            <div class="update-notes">
                <h4>What's New:</h4>
                <div class="release-notes">${formatReleaseNotes(releaseNotes)}</div>
            </div>
        </div>
    `;
    
    footer.innerHTML = `
        <button class="btn btn-ghost" onclick="closeModal()">Later</button>
        <button class="btn btn-primary" onclick="openReleasePage('${url}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download Update
        </button>
    `;
    
    modal.classList.add('active');
}

function formatReleaseNotes(notes) {
    if (!notes) return '<p>No release notes available.</p>';
    
    // Simple markdown to HTML conversion
    return notes
        .replace(/### (.*)/g, '<h5>$1</h5>')
        .replace(/## (.*)/g, '<h4>$1</h4>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/- (.*)/g, '<li>$1</li>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
}

function openReleasePage(url) {
    // Use Tauri opener plugin to open URL in default browser
    if (window.__TAURI__ && window.__TAURI__.opener) {
        window.__TAURI__.opener.openUrl(url);
    } else {
        // Fallback for development
        window.open(url, '_blank');
    }
    closeModal();
}

// Make update functions global
window.checkForUpdates = checkForUpdates;
window.openReleasePage = openReleasePage;
