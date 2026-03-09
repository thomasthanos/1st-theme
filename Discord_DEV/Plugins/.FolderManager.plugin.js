/**
 * @name FolderManager
 * @version 12.4.20
 * @description Combines AutoReadTrash and HideFolders: Marks folders as read and hides folders based on their IDs, with a custom modal UI featuring collapsible sections.
 * @author ThomasT
 * @authorId 706932839907852389
 * @source https://github.com/thomasthanos/1st-theme/blob/main/Discord_DEV/Plugins/FolderManager.plugin.js
 * @updateUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/.FolderManager.plugin.js
 * @website https://github.com/thomasthanos
 */

module.exports = class FolderManager {
    defaultSettings = {
        autoReadTrash: {
            enabled: true,
            folderIds: "",
            intervalMinutes: 15,
            showCountdown: true
        },
        hideFolders: {
            enabled: true,
            folderIds: ""
        },
        lastRun: ""
    };

    constructor() {
        this.initializeSettings();
        this._notificationQueue = [];
        this._isShowingNotification = false;
        this._isRunning = false;
        this._updateInProgress = false;
        this._justUpdated = false;
        this.modal = null;
        this.iconButton = null;
        this.observer = null;
        this._style = null;
        this.interval = null;
        this.countdownInterval = null;
        this._nextRunAt = 0;
        this.wrapper3d = null;
    }

    getVersion() {
        return "12.4.20";
    }

    initializeSettings() {
        // Load all per-user settings map; currentUserId will be set in _startPlugin
        this.allUsersSettings = BdApi.Data.load("FolderManager", "users") || {};
        this.currentUserId = null;
        // Use defaults until we know who's logged in
        this.settings = JSON.parse(JSON.stringify(this.defaultSettings));
    }

    getCurrentUserId() {
        try {
            const UserStore = BdApi.Webpack.getModule(m => m?.getCurrentUser && m?.getUser);
            return UserStore?.getCurrentUser()?.id || null;
        } catch(e) {
            return null;
        }
    }

    loadUserSettings() {
        const userId = this.getCurrentUserId();
        if (!userId) {
            this.log('Could not get user ID, using default settings');
            return;
        }

        this.currentUserId = userId;
        // Re-read from disk (constructor load may be too early)
        this.allUsersSettings = BdApi.Data.load("FolderManager", "users") || {};

        if (!this.allUsersSettings[userId]) {
            this.allUsersSettings[userId] = JSON.parse(JSON.stringify(this.defaultSettings));

            // Migration: only if NO other users exist yet (first-time migration from old format)
            const isFirstUser = Object.keys(this.allUsersSettings).length === 1;
            if (isFirstUser) {
                const oldSettings = BdApi.Data.load("FolderManager", "settings");
                if (oldSettings) {
                    Object.assign(this.allUsersSettings[userId], oldSettings);
                    this.log(`Migrated old settings to user ${userId}`);
                }
            }
        }

        this.settings = this.allUsersSettings[userId];
        this.saveSettings();
        this.log(`Loaded settings for user ${userId}`);
    }

    saveSettings() {
        clearTimeout(this._saveDebounce);
        this._saveDebounce = setTimeout(() => {
            try {
                if (this.currentUserId) {
                    this.allUsersSettings[this.currentUserId] = this.settings;
                    BdApi.Data.save("FolderManager", "users", this.allUsersSettings);
                } else {
                    // Fallback before user ID is known
                    BdApi.Data.save("FolderManager", "settings", this.settings);
                }
            } catch (error) {
                this.log("Error saving settings:", error.message);
            }
        }, 1000);
    }

    waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const check = () => {
                const el = document.querySelector(selector);
                if (el) return resolve(el);
                if (Date.now() - startTime > timeout) {
                    return reject(new Error(`Timeout: ${selector}`));
                }
                setTimeout(check, 500);
            };
            check();
        });
    }

    start() {
        setTimeout(() => this._startPlugin(), 20000);
    }

    _startPlugin() {
        this.loadUserSettings();

        const lastVersion = BdApi.Data.load('FolderManager', 'lastShownVersion');
        const currentVersion = this.getVersion();
        if (lastVersion !== currentVersion) {
            BdApi.Data.save('FolderManager', 'lastShownVersion', currentVersion);
        }

        this.injectIcon();
        if (this.settings.autoReadTrash.enabled) this.startAutoReadTrash();
        if (this.settings.hideFolders.enabled) this.startHideFolders();
    }

    stop() {
        clearInterval(this.interval);
        clearInterval(this.countdownInterval);
        clearTimeout(this._saveDebounce);
        
        if (this.modal) this.modal.remove();
        if (this._style) this._style.remove();
        if (this.iconButton) this.iconButton.remove();
        if (this.observer) this.observer.disconnect();
        
        this.interval = null;
        this.countdownInterval = null;
        this.modal = null;
        this._style = null;
        this.iconButton = null;
        this.observer = null;
        this._isRunning = false;
        this._isShowingNotification = false;
        this._notificationQueue = [];
    }

    // ==================== AUTO READ TRASH ====================

    async startAutoReadTrash() {
        this.injectStyles();
        try {
            await this.waitForElement('[data-list-id="guildsnav"]', 15000);
            // If never run before, anchor lastRun to now so countdown starts correctly
            if (!this.settings.lastRun) {
                this.settings.lastRun = new Date().toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                this.saveSettings();
            }
            setTimeout(() => this.runAutoRead(), 2000);
            this.startInterval();
            if (this.settings.autoReadTrash.showCountdown) {
                this.createCountdown();
                this.startCountdown();
            }
        } catch (error) {
            this.log("Error starting AutoReadTrash:", error.message);
        }
    }

    startInterval() {
        clearInterval(this.interval);
        this.interval = setInterval(() => {
            if (!this._isRunning) this.runAutoRead();
        }, this.settings.autoReadTrash.intervalMinutes * 60 * 1000);
    }

    getModules() {
        if (this._modules) return this._modules;
        try {
            const AckModule = BdApi.Webpack.getModule(m => typeof m?.ack === 'function');
            const FolderStore = BdApi.Webpack.getModule(m => m?.getGuildFolders);
            const GuildChannelStore = BdApi.Webpack.getModule(m => m?.getChannels && m?.getDefaultChannel);
            this._modules = { AckModule, FolderStore, GuildChannelStore };
        } catch(e) {
            this.log('getModules error:', e.message);
            this._modules = {};
        }
        return this._modules;
    }

    getChannelsForFolder(folder, GuildChannelStore) {
        const channels = [];
        for (const guildId of folder.guildIds) {
            try {
                const guildChannels = GuildChannelStore.getChannels(guildId);
                const allCh = Object.values(guildChannels)
                    .flat()
                    .filter(c => c?.channel?.id && c.channel.lastMessageId)
                    .map(c => ({
                        channelId: c.channel.id,
                        readStateType: 0,
                        messageId: c.channel.lastMessageId
                    }));
                channels.push(...allCh);
            } catch(e) { /* skip */ }
        }
        return channels;
    }

    async runAutoRead() {
        if (this._isRunning) return;
        this._isRunning = true;

        try {
            const ids = this.settings.autoReadTrash.folderIds
                .split(',').map(id => id.trim()).filter(Boolean);

            if (!ids.length) {
                this.log('No folder IDs set');
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
                const wrapper = document.querySelector('.art-countdown');
                if (wrapper) wrapper.style.display = 'none';
                return;
            }

            const { AckModule, FolderStore, GuildChannelStore } = this.getModules();

            if (!AckModule?.Uq || !FolderStore || !GuildChannelStore) {
                this.log('Modules not found, falling back to context menu');
                await this.runAutoReadFallback(ids);
                return;
            }

            const allFolders = FolderStore.getGuildFolders();
            // IDs saved as 'guildsnav___FOLDERID' — strip prefix and match folderId
            const selectedFolderIds = new Set(ids.map(id => String(id.replace('guildsnav___', ''))));

            let successCount = 0;

            for (const folder of allFolders) {
                // Match by folderId (named folders) or by single guildId (ungrouped)
                const folderKey = folder.folderId ? String(folder.folderId) : folder.guildIds?.[0];
                if (!selectedFolderIds.has(folderKey)) continue;

                const channels = this.getChannelsForFolder(folder, GuildChannelStore);

                if (channels.length) {
                    AckModule.Uq(channels);
                    successCount++;
                    this.log(`Marked folder "${folder.folderName || folderKey}" as read — ${channels.length} channels`);
                    await new Promise(r => setTimeout(r, 300));
                }
            }

            if (successCount > 0) this.queueNotification(successCount);
            else this.log('No matching folders found in FolderStore');

            this.settings.lastRun = new Date().toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
            this.saveSettings();
            this.startCountdown();

        } catch (error) {
            this.log('Error in AutoReadTrash:', error.message);
        } finally {
            this._isRunning = false;
        }
    }

    async runAutoReadFallback(ids) {
        const folders = [...document.querySelectorAll('div[data-list-item-id]')]
            .filter(el => ids.includes(el.getAttribute('data-list-item-id')))
            .filter(el => el.closest('[role="treeitem"]'));
        let successCount = 0;
        for (const folder of folders) {
            try {
                const marked = await this.markFolderAsReadFallback(folder);
                if (marked) successCount++;
                await new Promise(r => setTimeout(r, 800));
            } catch (err) {
                this.log(`Fallback error: ${err.message}`);
            }
        }
        if (successCount > 0) this.queueNotification(successCount);
        this.settings.lastRun = new Date().toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        this.saveSettings();
        this.startCountdown();
    }

    markFolderAsReadFallback(folder) {
        return new Promise((resolve, reject) => {
            const maxAttempts = 8;
            let attempts = 0;
            const tryClick = () => folder.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 0, clientY: 0 }));
            const checkMenu = () => {
                const btn = document.querySelector('#guild-context-mark-folder-read');
                if (!btn) {
                    attempts++;
                    if (attempts >= maxAttempts) return reject(new Error('Button not found'));
                    tryClick();
                    return setTimeout(checkMenu, 500);
                }
                const disabled = btn.getAttribute('aria-disabled') === 'true';
                if (!disabled) { btn.click(); resolve(true); }
                else resolve(false);
                setTimeout(() => document.querySelector('[class*="contextMenu"]')?.remove(), 100);
            };
            tryClick();
            setTimeout(checkMenu, 600);
        });
    }

    // ==================== NOTIFICATIONS ====================

    queueNotification(count) {
        this._notificationQueue.push(count);
        if (!this._isShowingNotification) {
            this.processNotifications();
        }
    }

    async processNotifications() {
        if (!this._notificationQueue.length || this._isShowingNotification) return;
        
        this._isShowingNotification = true;
        const total = this._notificationQueue.reduce((a, b) => a + b, 0);
        this._notificationQueue = [];
        
        await this.showNotification(total);
        this._isShowingNotification = false;
        
        if (this._notificationQueue.length) {
            this.processNotifications();
        }
    }

    async showNotification(count) {
        try {
            const guildsWrapper = await this.waitForElement('[data-list-id="guildsnav"]', 5000);
            
            if (!this.wrapper3d) {
                this.wrapper3d = document.createElement('div');
                this.wrapper3d.className = 'art-wrapper';
                guildsWrapper.appendChild(this.wrapper3d);
            }

            const notif = document.createElement('div');
            notif.className = 'art-notif';
            notif.innerHTML = `<div class="art-notif-message"><div class="art-notif-number">${count}</div><div class="art-notif-read">read</div></div>`;
            this.wrapper3d.appendChild(notif);
            setTimeout(() => notif.classList.add('show'), 10);
            
            const hideTimeout = setTimeout(() => {
                notif.classList.remove('show');
                notif.classList.add('hide');
                setTimeout(() => notif.remove(), 500);
            }, 5000);

            notif.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
            notif.addEventListener('mouseleave', () => {
                setTimeout(() => { notif.classList.remove('show'); notif.classList.add('hide'); setTimeout(() => notif.remove(), 500); }, 2000);
            });
        } catch (error) {
            this.log("Error showing notification:", error.message);
            this._isShowingNotification = false;
        }
    }

    // ==================== COUNTDOWN ====================

    injectStyles() {
        if (this._style) return;
        try {
            const fs = require('fs');
            const path = require('path');
            const cssPath = path.join(BdApi.Plugins.folder, 'folder.theme.css');
            if (fs.existsSync(cssPath)) {
                const css = fs.readFileSync(cssPath, 'utf8');
                this._style = document.createElement('style');
                this._style.id = 'fm-folder-theme';
                this._style.textContent = css;
                document.head.appendChild(this._style);
                this.log('Loaded folder.theme.css from local plugins folder');
                return;
            }
        } catch(e) {
            this.log('Local CSS load failed, falling back to remote:', e.message);
        }
        // Fallback: remote
        this._style = document.createElement('link');
        this._style.rel = 'stylesheet';
        this._style.href = 'https://thomasthanos.github.io/1st-theme/Discord_DEV/Themes/folder.theme.css';
        document.head.appendChild(this._style);
    }

    createCountdown() {
        const existing = document.querySelector('.art-countdown');
        if (existing) return;

        const guildsWrapper = document.querySelector('[data-list-id="guildsnav"]');
        if (!guildsWrapper) return;

        const el = document.createElement('div');
        el.className = 'art-countdown';
        el.style.display = 'none';
        el.innerHTML = `
            <div class="art-countdown-title">
                <div class="art-countdown-next">next</div>
                <div class="art-countdown-clear">clear</div>
                <div class="art-countdown-time"><span class="timer-text">0' 0"</span></div>
            </div>
        `;
        el.addEventListener('contextmenu', (e) => this.openCountdownPopout(e));
        guildsWrapper.appendChild(el);
    }

    openCountdownPopout(e) {
        e.preventDefault();
        e.stopPropagation();

        const existing = document.querySelector('.fm-countdown-popout');
        if (existing) { existing.remove(); return; }

        // Ονόματα φακέλων από FolderStore
        const FolderStore = BdApi.Webpack.getModule(m => m?.getGuildFolders);
        const storeFolders = FolderStore?.getGuildFolders() || [];
        const folderNameMap = {};
        storeFolders.forEach(f => {
            const key = f.folderId ? String(f.folderId) : f.guildIds?.[0];
            if (key) folderNameMap[key] = f.folderName || null;
        });

        const allNavItems = [...document.querySelectorAll('[data-list-item-id^="guildsnav___"]')];
        let folderElements = allNavItems.filter(el =>
            el.querySelector('[class*="folder"]') || el.querySelector('[class*="Folder"]') ||
            el.closest('[class*="folder"]') || el.closest('[class*="Folder"]')
        );
        if (!folderElements.length) folderElements = allNavItems;

        const seenIds = new Set();
        const folders = folderElements.map(el => {
            const id = el.getAttribute('data-list-item-id');
            if (!id || seenIds.has(id)) return null;
            seenIds.add(id);
            const rawId = id.replace('guildsnav___', '');
            const nameEl = el.querySelector('[class*="expandedFolderName"]') || el.querySelector('[class*="folderName"]') || el.querySelector('[class*="name"]');
            const label = folderNameMap[rawId] || el.getAttribute('aria-label') || nameEl?.textContent?.trim() || `Folder ${rawId}`;
            return { id, label };
        }).filter(Boolean);

        const hiddenIds = new Set(this.settings.hideFolders.folderIds.split(',').map(s => s.trim()).filter(Boolean));

        const popout = document.createElement('div');
        popout.className = 'fm-countdown-popout';
        popout.style.cssText = `
            position:fixed;z-index:9999;
            background:linear-gradient(160deg,#313338 0%,#2b2d31 100%);
            border-radius:8px;
            padding:8px;min-width:100px;max-width:150px;
            border-top:1px solid rgba(255,255,255,0.2);
            border-left:1px solid rgba(255,255,255,0.13);
            border-right:1px solid rgba(0,0,0,0.4);
            border-bottom:1px solid rgba(0,0,0,0.45);
            box-shadow:0 8px 32px rgba(0,0,0,0.65),0 2px 8px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.07);
            font-family:var(--font-primary,'gg sans',sans-serif);
        `;

        // Τοποθέτηση πάνω από το countdown
        const countdownEl = document.querySelector('.art-countdown');
        const rect = countdownEl ? countdownEl.getBoundingClientRect() : { right: e.clientX, top: e.clientY };
        popout.style.left = (rect.right + 8) + 'px';
        popout.style.bottom = (window.innerHeight - rect.top) + 'px';

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'font-size:11px;font-weight:600;color:rgba(255,255,255,0.45);text-transform:uppercase;padding:2px 4px 6px;letter-spacing:0.5px;text-shadow:0 1px 4px rgba(0,0,0,0.8);';
        header.textContent = 'Φάκελοι';
        popout.appendChild(header);

        // Scrollable list (max 4 ορατά)
        const list = document.createElement('div');
        if (folders.length > 4) {
            list.style.cssText = 'max-height:124px;overflow-y:auto;';
        }

        if (!folders.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:rgba(255,255,255,0.4);font-size:13px;padding:4px 6px;';
            empty.textContent = 'Δεν βρέθηκαν φάκελοι';
            list.appendChild(empty);
        }

        folders.forEach(({ id, label }) => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:4px;cursor:pointer;color:#ddd;font-size:13px;transition:background 0.12s,box-shadow 0.12s;';

            let hidden = hiddenIds.has(id);

            const icon = document.createElement('span');
            icon.style.cssText = 'width:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;';

            const name = document.createElement('span');
            name.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,0.7);';
            name.textContent = label;

            const svgEye = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
            const svgEyeOff = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
            const updateRow = () => {
                icon.innerHTML = hidden ? svgEyeOff : svgEye;
                icon.style.color = hidden ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)';
                row.style.opacity = hidden ? '0.6' : '1';
            };
            updateRow();

            row.appendChild(icon);
            row.appendChild(name);
            row.onmouseenter = () => { row.style.background = 'rgba(255,255,255,0.1)'; row.style.boxShadow = 'inset 2px 0 0 rgba(88,101,242,0.75)'; };
            row.onmouseleave = () => { row.style.background = ''; row.style.boxShadow = ''; };
            row.onclick = () => {
                const wasHidden = hidden;
                hidden ? hiddenIds.delete(id) : hiddenIds.add(id);
                hidden = !hidden;
                updateRow();
                this.settings.hideFolders.folderIds = [...hiddenIds].join(', ');
                this.saveSettings();
                const targetEl = document.querySelector(`[data-list-item-id="${id}"]`);
                if (targetEl) {
                    const listItem = targetEl.closest('[class*="listItem"]') || targetEl.closest('[class*="wrapper"]') || targetEl.parentElement;
                    if (listItem) listItem.style.display = wasHidden ? '' : 'none';
                }
            };
            list.appendChild(row);
        });

        popout.appendChild(list);
        document.body.appendChild(popout);

        const closeHandler = (ev) => {
            if (!popout.contains(ev.target)) {
                popout.remove();
                document.removeEventListener('mousedown', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('mousedown', closeHandler), 0);
    }

    startCountdown() {
        clearInterval(this.countdownInterval);
        const wrapper = document.querySelector('.art-countdown');

        // Always hide if no folders selected, regardless of showCountdown toggle
        const ids = this.settings.autoReadTrash.folderIds.split(',').map(s => s.trim()).filter(Boolean);
        if (!ids.length) {
            if (wrapper) wrapper.style.display = 'none';
            return;
        }

        // Folders exist — respect the showCountdown toggle
        if (!this.settings.autoReadTrash.showCountdown) {
            if (wrapper) wrapper.style.display = 'none';
            return;
        }

        if (wrapper) wrapper.style.display = '';
        this._nextRunAt = Date.now() + (this.settings.autoReadTrash.intervalMinutes * 60 * 1000);
        this.updateCountdown();
        this.countdownInterval = setInterval(() => this.updateCountdown(), 1000);
    }

    updateCountdown() {
        const el = document.querySelector('.art-countdown .timer-text');
        if (!el) return;

        if (!this._nextRunAt) {
            this._nextRunAt = Date.now() + (this.settings.autoReadTrash.intervalMinutes * 60 * 1000);
        }

        const diff = Math.max(0, Math.floor((this._nextRunAt - Date.now()) / 1000));

        const mins = Math.floor(diff / 60);
        const secs = diff % 60;
        el.textContent = `${mins}' ${secs}"`;

        if (diff <= 0) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
            if (!this._isRunning) this.runAutoRead();
        }
    }

    // ==================== HIDE FOLDERS ====================

    startHideFolders() {
        this.hideFolders();
    }

    stopHideFolders() {
        this.showFolders();
    }

    getHiddenIds() {
        return this.settings.hideFolders.folderIds
            .split(",").map(id => id.trim()).filter(Boolean);
    }

    hideFolders() {
        this.getHiddenIds().forEach(id => {
            const el = document.querySelector(`[data-list-item-id="${id}"]`);
            if (!el) return;
            const listItem = el.closest('[class*="listItem"]') || el.closest('[class*="wrapper"]') || el.parentElement;
            if (listItem) listItem.style.display = "none";
        });
    }

    showFolders() {
        this.getHiddenIds().forEach(id => {
            const el = document.querySelector(`[data-list-item-id="${id}"]`);
            if (!el) return;
            const listItem = el.closest('[class*="listItem"]') || el.closest('[class*="wrapper"]') || el.parentElement;
            if (listItem) listItem.style.display = "";
        });
    }

    // ==================== UI COMPONENTS ====================

    openFolderPicker(currentIds, onSave, title = "Επιλογή Folders", onCancel = null) {
        const existing = document.querySelector('.fm-folder-picker-overlay');
        if (existing) existing.remove();

        const selectedIds = new Set(currentIds.split(',').map(s => s.trim()).filter(Boolean));

        const allNavItems = [...document.querySelectorAll('[data-list-item-id^="guildsnav___"]')];
        let folderElements = allNavItems.filter(el =>
            el.querySelector('[class*="folder"]') || el.querySelector('[class*="Folder"]') ||
            el.closest('[class*="folder"]') || el.closest('[class*="Folder"]')
        );
        if (!folderElements.length) folderElements = allNavItems;

        const seenIds = new Set();
        const folders = folderElements.map(el => {
            const id = el.getAttribute('data-list-item-id');
            if (!id || seenIds.has(id)) return null;
            seenIds.add(id);
            const nameEl = el.querySelector('[class*="expandedFolderName"]') || el.querySelector('[class*="folderName"]') || el.querySelector('[class*="name"]');
            const label = el.getAttribute('aria-label') || nameEl?.textContent?.trim() || id.replace('guildsnav___', '');
            const iconEl = el.querySelector('[class*="folderIcon"]') || el.querySelector('[class*="folder"]>svg') || el.querySelector('svg');
            const iconClone = iconEl ? iconEl.cloneNode(true) : null;
            if (iconClone) { iconClone.style.width = '20px'; iconClone.style.height = '20px'; iconClone.style.flexShrink = '0'; }
            const colorEl = el.querySelector('[class*="folderIcon"]') || el.querySelector('[style*="background"]');
            const folderColor = colorEl ? (getComputedStyle(colorEl).backgroundColor || 'rgba(255,255,255,0.1)') : 'rgba(255,255,255,0.1)';
            return { id, label, iconClone, folderColor };
        }).filter(Boolean);

        const close = (save) => {
            backdrop.style.opacity = '0';
            panel.classList.remove('visible');
            setTimeout(() => {
                backdrop.remove(); panel.remove();
                if (save) onSave([...selectedIds].join(', '));
                else if (onCancel) onCancel();
            }, 200);
        };

        const backdrop = document.createElement('div');
        backdrop.className = 'fm-folder-picker-overlay';
        backdrop.onclick = e => { if (e.target === backdrop) close(false); };
        document.body.appendChild(backdrop);

        const panel = document.createElement('div');
        panel.className = 'fm-panel fm-picker-panel';
        document.body.appendChild(panel);

        requestAnimationFrame(() => { backdrop.style.opacity = '1'; panel.classList.add('visible'); });

        // Header
        const header = document.createElement('div');
        header.className = 'fm-picker-header';
        header.innerHTML = `<div style="display:flex;align-items:center;gap:10px;"><div class="fm-picker-header-icon">📁</div><div class="fm-picker-title">${title}</div></div>`;
        const closeBtn = document.createElement('button');
        closeBtn.className = 'fm-close-btn';
        closeBtn.textContent = '✕';
        closeBtn.onclick = () => close(false);
        header.appendChild(closeBtn);
        panel.appendChild(header);

        // List
        const list = document.createElement('div');
        list.className = 'fm-picker-list';
        if (!folders.length) {
            const empty = document.createElement('div');
            empty.className = 'fm-picker-empty';
            empty.textContent = 'Δεν βρέθηκαν folders';
            list.appendChild(empty);
        }

        folders.forEach(({ id, label, iconClone, folderColor }) => {
            const row = document.createElement('div');
            let sel = selectedIds.has(id);
            row.className = 'fm-picker-row' + (sel ? ' selected' : '');

            const iconWrapper = document.createElement('div');
            iconWrapper.className = 'fm-picker-icon-wrap';
            iconWrapper.style.background = folderColor;
            if (iconClone) iconWrapper.appendChild(iconClone);
            else iconWrapper.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)"><path d="M2 5a3 3 0 0 1 3-3h3.93a2 2 0 0 1 1.66.9L12 5h7a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V5Z"/></svg>`;

            const nameEl2 = document.createElement('div');
            nameEl2.className = 'fm-picker-name';
            nameEl2.textContent = label;

            const checkBox = document.createElement('div');
            checkBox.className = 'fm-picker-check' + (sel ? ' checked' : '');
            checkBox.textContent = sel ? '✓' : '';

            row.appendChild(iconWrapper);
            row.appendChild(nameEl2);
            row.appendChild(checkBox);

            row.onclick = () => {
                if (selectedIds.has(id)) {
                    selectedIds.delete(id); sel = false;
                    row.classList.remove('selected');
                    checkBox.classList.remove('checked');
                    checkBox.textContent = '';
                } else {
                    selectedIds.add(id); sel = true;
                    row.classList.add('selected');
                    checkBox.classList.add('checked');
                    checkBox.textContent = '✓';
                }
                updateCount();
            };
            list.appendChild(row);
        });
        panel.appendChild(list);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'fm-picker-footer';
        const countEl = document.createElement('div');
        countEl.className = 'fm-picker-count';
        const updateCount = () => {
            const size = selectedIds.size;
            countEl.textContent = size ? `${size} επιλεγμέν${size > 1 ? 'α' : 'ο'}` : 'Κανένα';
        };
        updateCount();
        const btns = document.createElement('div');
        btns.className = 'fm-picker-buttons';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'fm-btn-secondary';
        cancelBtn.textContent = 'Άκυρο';
        cancelBtn.onclick = () => close(false);
        const saveBtn = document.createElement('button');
        saveBtn.className = 'fm-btn-primary';
        saveBtn.textContent = 'Αποθήκευση';
        saveBtn.onclick = () => close(true);
        btns.appendChild(cancelBtn);
        btns.appendChild(saveBtn);
        footer.appendChild(countEl);
        footer.appendChild(btns);
        panel.appendChild(footer);
    }

    openModal() {
        if (this.modal) this.modal.remove();

        const closeModal = () => {
            backdrop.style.opacity = '0';
            panel.classList.remove('visible');
            setTimeout(() => { backdrop.remove(); panel.remove(); this.modal = null; }, 200);
        };

        const backdrop = document.createElement('div');
        backdrop.className = 'fm-backdrop';
        backdrop.onclick = e => { if (e.target === backdrop) closeModal(); };
        document.body.appendChild(backdrop);
        this.modal = backdrop;

        const panel = document.createElement('div');
        panel.className = 'fm-panel fm-modal-panel';
        document.body.appendChild(panel);
        requestAnimationFrame(() => { backdrop.style.opacity = '1'; panel.classList.add('visible'); });

        // Header
        const header = document.createElement('div');
        header.className = 'fm-modal-header';
        header.innerHTML = `<div style="display:flex;align-items:center;gap:10px;"><div class="fm-modal-header-icon">📁</div><div class="fm-modal-title">FolderManager</div></div>`;
        const closeBtn = document.createElement('button');
        closeBtn.className = 'fm-close-btn';
        closeBtn.textContent = '✕';
        closeBtn.onclick = closeModal;
        header.appendChild(closeBtn);
        panel.appendChild(header);

        const content = document.createElement('div');
        content.className = 'fm-modal-content';

        const createToggle = (initial, onChange) => {
            const toggle = document.createElement('div');
            toggle.className = 'fm-toggle';
            let state = initial;
            const knob = document.createElement('span');
            knob.className = 'fm-toggle-knob';
            toggle.appendChild(knob);
            const updateStyle = () => {
                toggle.style.background = state ? '#5865f2' : 'rgba(255,255,255,0.12)';
                knob.style.left = state ? '18px' : '2px';
            };
            updateStyle();
            toggle.onclick = () => { state = !state; updateStyle(); onChange(state); };
            return toggle;
        };

        const createPickerButton = (text, onClick) => {
            const btn = document.createElement('button');
            btn.className = 'fm-btn';
            btn.textContent = text;
            btn.onclick = onClick;
            return btn;
        };

        const makeRow = (html, last = false) => {
            const row = document.createElement('div');
            row.className = 'fm-card-row' + (last ? ' last' : '');
            row.innerHTML = html;
            return row;
        };

        // ── AutoReadTrash Section ──
        const artSection = document.createElement('div');
        const artLabel = document.createElement('div');
        artLabel.className = 'fm-section-label';
        artLabel.textContent = 'AUTOREADTRASH';
        artSection.appendChild(artLabel);

        const artCard = document.createElement('div');
        artCard.className = 'fm-card';

        const enabledRow = makeRow('<div><div class="fm-card-row-title">AutoReadTrash</div><div class="fm-card-row-subtitle">Αυτόματο διάβασμα φακέλων</div></div>');
        const artToggle = createToggle(this.settings.autoReadTrash.enabled, v => {
            this.settings.autoReadTrash.enabled = v; this.saveSettings();
            v ? this.startAutoReadTrash() : this.stop();
        });
        enabledRow.appendChild(artToggle);
        artCard.appendChild(enabledRow);

        const foldersRow = makeRow('<div>Φάκελοι</div>');
        const folderCount = document.createElement('span');
        folderCount.className = 'fm-folder-count';
        const updateFolderCount = () => {
            const count = this.settings.autoReadTrash.folderIds.split(',').filter(Boolean).length;
            folderCount.textContent = count ? `${count} folder${count > 1 ? 's' : ''}` : 'none';
        };
        updateFolderCount();
        const folderPickerBtn = createPickerButton('Επιλογή', () => {
            this.openFolderPicker(this.settings.autoReadTrash.folderIds, ids => {
                this.settings.autoReadTrash.folderIds = ids; this.saveSettings();
                updateFolderCount(); this.createCountdown(); this.startCountdown();
            }, 'AutoReadTrash — Φάκελοι');
        });
        const folderCtrl = document.createElement('div');
        folderCtrl.className = 'fm-card-row-ctrl';
        folderCtrl.appendChild(folderCount); folderCtrl.appendChild(folderPickerBtn);
        foldersRow.appendChild(folderCtrl);
        artCard.appendChild(foldersRow);

        const intervalRow = makeRow('<div><div>Διάστημα</div><div class="fm-card-row-subtitle">Λεπτά (5–120)</div></div>');
        const intervalInput = document.createElement('input');
        intervalInput.type = 'number'; intervalInput.min = 5; intervalInput.max = 120;
        intervalInput.value = this.settings.autoReadTrash.intervalMinutes;
        intervalInput.className = 'fm-number-input';
        intervalInput.oninput = () => {
            const val = Math.min(120, Math.max(5, parseInt(intervalInput.value) || 5));
            this.settings.autoReadTrash.intervalMinutes = val;
            this.settings.lastRun = new Date().toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); this.saveSettings();
            this.startInterval(); this.startCountdown();
        };
        intervalRow.appendChild(intervalInput);
        artCard.appendChild(intervalRow);

        const countdownRow = makeRow('<div>Αντίστροφη μέτρηση</div>', true);
        const countdownToggle = createToggle(this.settings.autoReadTrash.showCountdown, v => {
            this.settings.autoReadTrash.showCountdown = v; this.saveSettings();
            v ? this.startCountdown() : clearInterval(this.countdownInterval);
        });
        countdownRow.appendChild(countdownToggle);
        artCard.appendChild(countdownRow);
        artSection.appendChild(artCard);
        content.appendChild(artSection);

        // ── HideFolders Section ──
        const hfSection = document.createElement('div');
        const hfLabel = document.createElement('div');
        hfLabel.className = 'fm-section-label';
        hfLabel.textContent = 'HIDEFOLDERS';
        hfSection.appendChild(hfLabel);

        const hfCard = document.createElement('div');
        hfCard.className = 'fm-card';

        const hfEnabledRow = makeRow('<div><div class="fm-card-row-title">HideFolders</div><div class="fm-card-row-subtitle">Κρύψιμο φακέλων</div></div>');
        const hfToggle = createToggle(this.settings.hideFolders.enabled, v => {
            this.settings.hideFolders.enabled = v; this.saveSettings();
            v ? this.hideFolders() : this.showFolders();
        });
        hfEnabledRow.appendChild(hfToggle);
        hfCard.appendChild(hfEnabledRow);

        const hfFoldersRow = makeRow('<div>Κρυμμένοι φάκελοι</div>', true);
        const hfCount = document.createElement('span');
        hfCount.className = 'fm-folder-count';
        const updateHfCount = () => {
            const count = this.settings.hideFolders.folderIds.split(',').filter(Boolean).length;
            hfCount.textContent = count ? `${count} folder${count > 1 ? 's' : ''}` : 'none';
        };
        updateHfCount();
        const hfPickerBtn = createPickerButton('Επιλογή', () => {
            this.showFolders();
            this.openFolderPicker(this.settings.hideFolders.folderIds, ids => {
                this.settings.hideFolders.folderIds = ids; this.saveSettings();
                updateHfCount(); setTimeout(() => this.hideFolders(), 100);
            }, 'HideFolders — Φάκελοι', () => { setTimeout(() => this.hideFolders(), 100); });
        });
        const hfCtrl = document.createElement('div');
        hfCtrl.className = 'fm-card-row-ctrl';
        hfCtrl.appendChild(hfCount); hfCtrl.appendChild(hfPickerBtn);
        hfFoldersRow.appendChild(hfCtrl);
        hfCard.appendChild(hfFoldersRow);
        hfSection.appendChild(hfCard);
        content.appendChild(hfSection);

        // ── Update Section ──
        const updateSection = document.createElement('div');
        const updateLabel = document.createElement('div');
        updateLabel.className = 'fm-section-label';
        updateLabel.textContent = 'ΕΝΗΜΕΡΩΣΗ';
        updateSection.appendChild(updateLabel);

        const updateCard = document.createElement('div');
        updateCard.className = 'fm-update-card';
        const updateRow = document.createElement('div');
        updateRow.className = 'fm-update-row';
        updateRow.innerHTML = '<div>Έλεγχος για νέα έκδοση</div>';
        const updateBtn = document.createElement('button');
        updateBtn.className = 'fm-btn';
        updateBtn.textContent = 'Έλεγχος τώρα';
        const resultEl = document.createElement('div');
        resultEl.className = 'fm-update-result';
        updateBtn.onclick = async () => {
            if (this._updateInProgress) return;
            this._updateInProgress = true;
            updateBtn.textContent = '⏳ Έλεγχος...'; updateBtn.disabled = true;
            await this.checkForUpdates(resultEl);
            updateBtn.textContent = 'Έλεγχος τώρα'; updateBtn.disabled = false;
            this._updateInProgress = false;
        };
        updateRow.appendChild(updateBtn);
        updateCard.appendChild(updateRow);
        updateCard.appendChild(resultEl);
        updateSection.appendChild(updateCard);
        content.appendChild(updateSection);
        panel.appendChild(content);
    }

    async checkForUpdates(resultEl) {
        const updateUrl = "https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/.FolderManager.plugin.js";
        
        try {
            const response = await fetch(updateUrl);
            const code = await response.text();
            
            const remoteVersion = code.match(/@version\s+([^\n]+)/)?.[1].trim();
            const localVersion = this.getVersion();

            if (!remoteVersion) {
                this.showResult(resultEl, '❓ Δεν βρέθηκε έκδοση', 'warn');
                return;
            }

            if (this.isNewerVersion(remoteVersion, localVersion)) {
                this.showResult(resultEl, `📦 Νέα έκδοση ${remoteVersion}. Ενημέρωση...`, 'warn');
                await this.downloadUpdate(code);
                this.showResult(resultEl, `✅ Ενημερώθηκε σε ${remoteVersion}!`, 'success');
            } else {
                this.showResult(resultEl, `✅ Είσαι ενημερωμένος (${localVersion})`, 'success');
            }
        } catch (err) {
            this.showResult(resultEl, `❌ Σφάλμα: ${err.message}`, 'error');
        }
    }

    showResult(container, message, type) {
        if (!container) return;
        const colors = { success: '#23a55a', error: '#f23f43', warn: '#f0b132' };
        container.style.display = 'block';
        container.innerHTML = `<div class="fm-update-result-inner" style="border:1px solid ${colors[type]}22;">${message}</div>`;
    }

    isNewerVersion(remote, local) {
        const r = remote.split('.').map(Number);
        const l = local.split('.').map(Number);
        for (let i = 0; i < 3; i++) {
            if ((r[i] || 0) > (l[i] || 0)) return true;
            if ((r[i] || 0) < (l[i] || 0)) return false;
        }
        return false;
    }

    downloadUpdate(code) {
        try {
            BdApi.Plugins.disable("FolderManager");
            const fs = require("fs");
            const path = require("path");
            const filePath = path.join(BdApi.Plugins.folder, ".FolderManager.plugin.js");
            fs.writeFileSync(filePath, code);
            BdApi.Plugins.enable("FolderManager");
            this._justUpdated = true;
        } catch (err) {
            this.log("Error downloading update:", err.message);
            throw err;
        }
    }

    // ==================== ICON & OBSERVER ====================

    injectIcon() {
        this.startObserver();
    }

    startObserver() {
        if (this.observer) return;

        this.observer = new MutationObserver(() => {
            const pluginCard = [...document.querySelectorAll('[class*="bd-addon-card"]')]
                .find(card => card.querySelector('[class*="bd-addon-header"]')?.textContent.includes("FolderManager"));

            if (pluginCard) {
                const controls = pluginCard.querySelector('[class*="bd-controls"]');
                if (controls && !controls.querySelector('[aria-label="Plugin Manager"]')) {
                    this.createIcon(controls);
                }
            }
        });

        this.observer.observe(document.body, { childList: true, subtree: true });
    }

    createIcon(controls) {
        const button = document.createElement("button");
        button.setAttribute("aria-label", "Plugin Manager");
        button.className = "bd-button bd-button-filled bd-addon-button bd-button-color-brand fm-icon-btn";
        button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 0 1 10 10c0 2.5-1 4.8-2.6 6.5l-3.5-3.5"/><path d="M12 22a10 10 0 0 1-10-10c0-2.5 1-4.8 2.6-6.5l3.5 3.5"/><path d="M8.1 8.1L2 4"/><path d="M15.9 15.9L22 20"/></svg>`;
        button.onclick = () => this.openModal();
        controls.appendChild(button);
        this.iconButton = button;
    }
    
    log(...args) {
        console.log(
            "%c [FolderManager] %c " + args.join(" "),
            "background:#5865f2;color:white;padding:2px 6px;border-radius:4px 0 0 4px;",
            "background:#2c2d33;color:white;padding:2px 6px;border-radius:0 4px 4px 0;"
        );
    }
};