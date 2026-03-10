/**
 * @name FolderManager
 * @version 16.0.0
 * @description Αυτόματο διάβασμα φακέλων (AutoReadTrash) και κρύψιμο φακέλων (HideFolders) με custom UI.
 * @author ThomasT
 * @authorId 706932839907852389
 * @source https://github.com/thomasthanos/1st-theme/blob/main/Discord_DEV/Plugins/FolderManager.plugin.js
 * @updateUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/.FolderManager.plugin.js
 * @website https://github.com/thomasthanos
 */

module.exports = class FolderManager {

    // ─────────────────────────────────────────────
    //  DEFAULT SETTINGS
    // ─────────────────────────────────────────────

    DEFAULT_SETTINGS = {
        autoRead: {
            enabled:       true,
            folderIds:     "",
            intervalMins:  15,
            showCountdown: true
        },
        hideFolders: {
            enabled:   true,
            folderIds: ""
        },
        lastRun: ""
    };

    // ─────────────────────────────────────────────
    //  CONSTRUCTOR
    // ─────────────────────────────────────────────

    constructor() {
        this.settings        = null;
        this.userId          = null;
        this.allUsers        = {};

        // intervals / timers
        this.cdInterval      = null;
        this.saveTimer       = null;
        this.nextRunAt       = 0;

        // DOM refs
        this.modalEl         = null;
        this.cdEl            = null;
        this.notifWrap       = null;
        this.settingsBtn     = null;
        this.domObserver     = null;

        // flags
        this.running         = false;
        this.notifBusy       = false;
        this.notifQueue      = [];
        this.updateBusy      = false;
    }

    // ─────────────────────────────────────────────
    //  LIFECYCLE
    // ─────────────────────────────────────────────

    start() {
        // Περιμένει 20s για να φορτώσει πλήρως το Discord
        setTimeout(() => this._boot(), 20_000);
    }

    _boot() {
        this._loadSettings();
        this._watchPluginCard();
        if (this.settings.autoRead.enabled)    this._startAutoRead();
        if (this.settings.hideFolders.enabled) this._bootHide();
    }

    // Περιμένει το guildsnav να φορτώσει πριν κρύψει φακέλους
    async _bootHide() {
        try {
            await this._waitFor('[data-list-id="guildsnav"]', 15_000);
            this._applyHide();
        } catch (e) {
            this._log("HideFolders boot error:", e.message);
        }
    }

    stop() {
        clearInterval(this.cdInterval);
        clearTimeout(this.saveTimer);

        this.modalEl?.remove();
        this.domObserver?.disconnect();
        document.querySelector("#fm-styles")?.remove();
        document.querySelector(".fm-cd")?.remove();
        document.querySelector(".fm-notif-wrap")?.remove();
        document.querySelector(".fm-backdrop")?.remove();
        document.querySelector('[aria-label="FolderManager Settings"]')?.remove();

        this.cdInterval = this.saveTimer = null;
        this.modalEl = this.settingsBtn = null;
        this._style = null;
        this.cdEl = this.notifWrap = this.domObserver = null;
        this.running = false;
        this.notifBusy = false;
        this.notifQueue = [];
        this._mods = null;
    }

    // ─────────────────────────────────────────────
    //  SETTINGS  (per-user)
    // ─────────────────────────────────────────────

    _loadSettings() {
        this.userId   = this._getUserId();
        this.allUsers = BdApi.Data.load("FolderManager", "users") || {};

        if (!this.allUsers[this.userId]) {
            this.allUsers[this.userId] = JSON.parse(JSON.stringify(this.DEFAULT_SETTINGS));

            // Migration από παλιό single-user format (key "settings")
            if (Object.keys(this.allUsers).length === 1) {
                const old = BdApi.Data.load("FolderManager", "settings");
                if (old) this._migrateOld(this.allUsers[this.userId], old);
            }
        }

        this.settings = this.allUsers[this.userId];

        // Sanitize: ensure all required keys exist (handles old saved format or partial data)
        this._sanitize();

        this._save();
        this._log(`Settings φορτώθηκαν για user ${this.userId}`);
    }

    // Μετατρέπει παλιό format (autoReadTrash / intervalMinutes / showCountdown) → νέο
    _migrateOld(target, old) {
        try {
            if (old.autoReadTrash) {
                target.autoRead.enabled       = old.autoReadTrash.enabled       ?? target.autoRead.enabled;
                target.autoRead.folderIds     = old.autoReadTrash.folderIds     ?? target.autoRead.folderIds;
                target.autoRead.intervalMins  = old.autoReadTrash.intervalMinutes ?? target.autoRead.intervalMins;
                target.autoRead.showCountdown = old.autoReadTrash.showCountdown ?? target.autoRead.showCountdown;
            }
            if (old.hideFolders) {
                target.hideFolders.enabled   = old.hideFolders.enabled   ?? target.hideFolders.enabled;
                target.hideFolders.folderIds = old.hideFolders.folderIds ?? target.hideFolders.folderIds;
            }
            if (old.lastRun) target.lastRun = old.lastRun;

            // Διαγραφή παλιού key από το storage
            BdApi.Data.delete("FolderManager", "settings");
            this._log("Migration ολοκληρώθηκε — παλιό 'settings' key διαγράφηκε");
        } catch (e) {
            this._log("Migration error:", e.message);
        }
    }

    // Deep-merge με defaults για να μην λείπει κανένα key
    _sanitize() {
        const def = this.DEFAULT_SETTINGS;

        if (!this.settings.autoRead || typeof this.settings.autoRead !== "object") {
            this.settings.autoRead = JSON.parse(JSON.stringify(def.autoRead));
        } else {
            this.settings.autoRead.enabled       = this.settings.autoRead.enabled       ?? def.autoRead.enabled;
            this.settings.autoRead.folderIds     = this.settings.autoRead.folderIds     ?? def.autoRead.folderIds;
            this.settings.autoRead.intervalMins  = this.settings.autoRead.intervalMins  ?? def.autoRead.intervalMins;
            this.settings.autoRead.showCountdown = this.settings.autoRead.showCountdown ?? def.autoRead.showCountdown;
        }

        if (!this.settings.hideFolders || typeof this.settings.hideFolders !== "object") {
            this.settings.hideFolders = JSON.parse(JSON.stringify(def.hideFolders));
        } else {
            this.settings.hideFolders.enabled   = this.settings.hideFolders.enabled   ?? def.hideFolders.enabled;
            this.settings.hideFolders.folderIds = this.settings.hideFolders.folderIds ?? def.hideFolders.folderIds;
        }

        if (typeof this.settings.lastRun === "undefined") this.settings.lastRun = "";
    }

    _save() {
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            try {
                this.allUsers[this.userId] = this.settings;
                BdApi.Data.save("FolderManager", "users", this.allUsers);
            } catch (e) {
                this._log("Save error:", e.message);
            }
        }, 1000);
    }

    _getUserId() {
        try {
            const store = BdApi.Webpack.getModule(m => m?.getCurrentUser && m?.getUser);
            return store?.getCurrentUser()?.id || "default";
        } catch {
            return "default";
        }
    }

    // ─────────────────────────────────────────────
    //  DISCORD MODULES
    // ─────────────────────────────────────────────

    _getMods() {
        // Επιστρέφει cache μόνο αν είναι πλήρες — δεν κλειδώνει null αποτελέσματα
        if (this._mods?.Ack && this._mods?.Folders && this._mods?.Channels) return this._mods;
        try {
            const Ack      = BdApi.Webpack.getModule(m => typeof m?.ack === "function");
            const Folders  = BdApi.Webpack.getModule(m => m?.getGuildFolders);
            const Channels = BdApi.Webpack.getModule(m => m?.getChannels && m?.getDefaultChannel);
            this._mods = { Ack, Folders, Channels };
        } catch (e) {
            this._log("Module error:", e.message);
            this._mods = {};
        }
        return this._mods;
    }

    _getChannelsForFolder(folder, ChannelStore) {
        const out = [];
        for (const guildId of (folder.guildIds || [])) {
            try {
                const map = ChannelStore.getChannels(guildId);
                Object.values(map).flat()
                    .filter(c => c?.channel?.id && c.channel.lastMessageId)
                    .forEach(c => out.push({
                        channelId:     c.channel.id,
                        readStateType: 0,
                        messageId:     c.channel.lastMessageId
                    }));
            } catch { /* skip */ }
        }
        return out;
    }

    // ─────────────────────────────────────────────
    //  AUTO READ TRASH
    // ─────────────────────────────────────────────

    async _startAutoRead() {
        this._injectStyles();
        try {
            await this._waitFor('[data-list-id="guildsnav"]', 15_000);
            if (!this.settings.lastRun) {
                this.settings.lastRun = this._now();
                this._save();
            }
            this._createCdWidget();
            // Πρώτο read μετά από 2s — αυτό θα καλέσει _startCd() στο τέλος του
            setTimeout(() => this._doRead(), 2000);
        } catch (e) {
            this._log("AutoRead start error:", e.message);
        }
    }

    async _doRead() {
        if (this.running) return;
        this.running = true;

        try {
            const ids = this._splitIds(this.settings.autoRead.folderIds);
            if (!ids.length) {
                this._log("Δεν έχουν οριστεί φάκελοι για AutoRead");
                document.querySelector(".fm-cd")?.style.setProperty("display", "none");
                return;
            }

            const { Ack, Folders, Channels } = this._getMods();

            // Αν τα βασικά modules δεν βρεθούν → fallback
            if (!Ack || !Folders || !Channels) {
                this._log("Modules δεν βρέθηκαν, fallback mode");
                await this._doReadFallback(ids);
                return;
            }

            // Δυναμική εύρεση bulk ack (αντί hardcoded minified name)
            const bulkAckFn = this._findBulkAck(Ack);

            const allFolders   = Folders.getGuildFolders();
            const selectedSet  = new Set(ids.map(id => id.replace("guildsnav___", "")));
            let   hits         = 0;

            for (const folder of allFolders) {
                const key = folder.folderId ? String(folder.folderId) : folder.guildIds?.[0];
                if (!selectedSet.has(key)) continue;

                const channels = this._getChannelsForFolder(folder, Channels);
                if (!channels.length) continue;

                try {
                    if (bulkAckFn) {
                        bulkAckFn(channels);
                    } else {
                        // Fallback: ack κανάλια ένα-ένα
                        for (const ch of channels) {
                            try { Ack.ack(ch.channelId, ch.messageId); } catch {}
                        }
                    }
                    hits++;
                    this._log(`Φάκελος "${folder.folderName || key}" → ${channels.length} κανάλια διαβάστηκαν`);
                } catch (e) {
                    this._log(`Ack error "${folder.folderName || key}":`, e.message);
                }
                await this._sleep(300);
            }

            if (hits > 0) this._queueNotif(hits);
            else this._log("Κανένας φάκελος δεν ταίριαξε");

            this.settings.lastRun = this._now();
            this._save();

        } catch (e) {
            this._log("Read error:", e.message);
        } finally {
            this.running = false;
            this._startCd();
        }
    }

    // Βρίσκει τη bulk ack function δυναμικά (αντί hardcoded minified name)
    _findBulkAck(Ack) {
        if (!Ack) return null;

        // Γνωστά ονόματα (stable + minified)
        for (const name of ["bulkAck", "Uq"]) {
            if (typeof Ack[name] === "function") return channels => Ack[name](channels);
        }

        // Αναζήτηση: function που δέχεται array (εκτός ack)
        const skip = new Set(["ack", "constructor", "__esModule"]);
        for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(Ack) || {})) {
            if (skip.has(key) || typeof Ack[key] !== "function") continue;
            return channels => Ack[key](channels);
        }
        for (const key of Object.keys(Ack)) {
            if (skip.has(key) || typeof Ack[key] !== "function") continue;
            return channels => Ack[key](channels);
        }

        return null;
    }

    async _doReadFallback(ids) {
        const elements = [...document.querySelectorAll("div[data-list-item-id]")]
            .filter(el => ids.includes(el.getAttribute("data-list-item-id")))
            .filter(el => el.closest('[role="treeitem"]'));

        let hits = 0;
        for (const el of elements) {
            try {
                const ok = await this._markReadViaMenu(el);
                if (ok) hits++;
                await this._sleep(800);
            } catch (e) {
                this._log("Fallback error:", e.message);
            }
        }
        if (hits > 0) this._queueNotif(hits);
        this.settings.lastRun = this._now();
        this._save();
        // _startCd() καλείται στο finally block του _doRead()
    }

    _markReadViaMenu(el) {
        return new Promise((resolve, reject) => {
            const MAX = 8;
            let tries = 0;

            const dispatch = () => el.dispatchEvent(
                new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 0, clientY: 0 })
            );

            const poll = () => {
                const btn = document.querySelector("#guild-context-mark-folder-read");
                if (!btn) {
                    if (++tries >= MAX) return reject(new Error("Button not found"));
                    dispatch();
                    return setTimeout(poll, 500);
                }
                if (btn.getAttribute("aria-disabled") !== "true") {
                    btn.click();
                    resolve(true);
                } else {
                    resolve(false);
                }
                setTimeout(() => document.querySelector('[class*="contextMenu"]')?.remove(), 100);
            };

            dispatch();
            setTimeout(poll, 600);
        });
    }

    // ─────────────────────────────────────────────
    //  COUNTDOWN WIDGET
    // ─────────────────────────────────────────────

    _createCdWidget() {
        // Αφαιρεί πάντα το παλιό (αν υπάρχει) ώστε να μην μείνουν duplicates
        document.querySelector(".fm-cd")?.remove();
        this.cdEl = null;

        const nav = document.querySelector('[data-list-id="guildsnav"]');
        if (!nav) return;

        const el = document.createElement("div");
        el.className = "fm-cd";
        el.innerHTML = `
            <span class="fm-cd-label">next</span>
            <span class="fm-cd-label">clear</span>
            <span class="fm-cd-time"><b class="fm-cd-text">--:--</b></span>
        `;
        el.style.display = "none";
        el.addEventListener("contextmenu", e => this._openCdPopout(e));
        nav.appendChild(el);
        this.cdEl = el;
    }

    _startCd() {
        clearInterval(this.cdInterval);
        const el = document.querySelector(".fm-cd");

        const ids = this._splitIds(this.settings.autoRead.folderIds);
        if (!ids.length) {
            if (el) el.style.display = "none";
            return;
        }

        // Κρύβει το widget αν showCountdown=false, αλλά ο timer τρέχει πάντα
        if (el) el.style.display = this.settings.autoRead.showCountdown ? "" : "none";

        this.nextRunAt = Date.now() + this.settings.autoRead.intervalMins * 60_000;
        this._tickCd();
        this.cdInterval = setInterval(() => this._tickCd(), 1000);
    }

    _tickCd() {
        const el = document.querySelector(".fm-cd-text");
        if (!el) return;

        const diff = Math.max(0, Math.floor((this.nextRunAt - Date.now()) / 1000));
        const m = Math.floor(diff / 60), s = diff % 60;
        el.textContent = `${m}'${String(s).padStart(2, "0")}"`;

        if (diff <= 0 && !this.running) {
            clearInterval(this.cdInterval);
            this.cdInterval = null;
            this._doRead();
        }
    }

    _openCdPopout(e) {
        e.preventDefault();
        e.stopPropagation();

        const existing = document.querySelector(".fm-popout");
        if (existing) { existing.remove(); return; }

        // Φτιάχνει λίστα φακέλων για quick-toggle
        const folders   = this._getNavFolders();
        const hiddenSet = new Set(this._splitIds(this.settings.hideFolders.folderIds));

        const popout = document.createElement("div");
        popout.className = "fm-popout";

        const cdEl    = document.querySelector(".fm-cd");
        const rect    = cdEl ? cdEl.getBoundingClientRect() : { right: e.clientX, top: e.clientY };
        popout.style.left   = `${rect.right + 8}px`;
        popout.style.bottom = `${window.innerHeight - rect.top}px`;

        const title = document.createElement("div");
        title.className     = "fm-popout-title";
        title.textContent   = "Φάκελοι";
        popout.appendChild(title);

        folders.forEach(({ id, name }) => {
            let hidden = hiddenSet.has(id);

            const row  = document.createElement("div");
            row.className = "fm-popout-row";

            const icon = document.createElement("span");
            const lbl  = document.createElement("span");
            lbl.textContent = name;
            lbl.className   = "fm-popout-name";

            const EYE     = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
            const EYE_OFF = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

            const refresh = () => {
                icon.innerHTML      = hidden ? EYE_OFF : EYE;
                icon.style.opacity  = hidden ? "0.35" : "0.8";
                row.style.opacity   = hidden ? "0.55" : "1";
            };
            refresh();

            row.onclick = () => {
                const wasHidden = hidden;
                hidden ? hiddenSet.delete(id) : hiddenSet.add(id);
                hidden = !hidden;
                refresh();
                this.settings.hideFolders.folderIds = [...hiddenSet].join(", ");
                this._save();
                const target = document.querySelector(`[data-list-item-id="${id}"]`);
                if (target) {
                    const wrap = target.closest('[class*="listItem"]') || target.closest('[class*="wrapper"]') || target.parentElement;
                    if (wrap) wrap.style.display = wasHidden ? "" : "none";
                }
            };

            row.appendChild(icon);
            row.appendChild(lbl);
            popout.appendChild(row);
        });

        if (!folders.length) {
            const empty = document.createElement("div");
            empty.className   = "fm-popout-empty";
            empty.textContent = "Δεν βρέθηκαν φάκελοι";
            popout.appendChild(empty);
        }

        document.body.appendChild(popout);

        const away = ev => {
            if (!popout.contains(ev.target)) {
                popout.remove();
                document.removeEventListener("mousedown", away);
            }
        };
        setTimeout(() => document.addEventListener("mousedown", away), 0);
    }

    // ─────────────────────────────────────────────
    //  NAV FOLDERS HELPER
    // ─────────────────────────────────────────────

    _getNavFolders() {
        const { Folders } = this._getMods();
        const nameMap = {};
        (Folders?.getGuildFolders() || []).forEach(f => {
            const k = f.folderId ? String(f.folderId) : f.guildIds?.[0];
            if (k) nameMap[k] = f.folderName || null;
        });

        const navItems = [...document.querySelectorAll('[data-list-item-id^="guildsnav___"]')];
        let folderEls = navItems.filter(el =>
            el.querySelector('[class*="folder"]') || el.querySelector('[class*="Folder"]') ||
            el.closest('[class*="folder"]') || el.closest('[class*="Folder"]')
        );
        if (!folderEls.length) folderEls = navItems;

        const seen = new Set();
        return folderEls.map(el => {
            const id = el.getAttribute("data-list-item-id");
            if (!id || seen.has(id)) return null;
            seen.add(id);
            const raw = id.replace("guildsnav___", "");
            const nameEl = el.querySelector('[class*="expandedFolderName"]') || el.querySelector('[class*="folderName"]') || el.querySelector('[class*="name"]');
            const name = nameMap[raw] || el.getAttribute("aria-label") || nameEl?.textContent?.trim() || `Folder ${raw}`;
            const color = el.querySelector('[class*="folder"]')?.style?.backgroundColor || "#5865f2";
            return { id, name, color };
        }).filter(Boolean);
    }

    // ─────────────────────────────────────────────
    //  HIDE FOLDERS
    // ─────────────────────────────────────────────

    _applyHide() {
        this._splitIds(this.settings.hideFolders.folderIds).forEach(id => {
            const el   = document.querySelector(`[data-list-item-id="${id}"]`);
            const wrap = el?.closest('[class*="listItem"]') || el?.closest('[class*="wrapper"]') || el?.parentElement;
            if (wrap) wrap.style.display = "none";
        });
    }

    _removeHide() {
        this._splitIds(this.settings.hideFolders.folderIds).forEach(id => {
            const el   = document.querySelector(`[data-list-item-id="${id}"]`);
            const wrap = el?.closest('[class*="listItem"]') || el?.closest('[class*="wrapper"]') || el?.parentElement;
            if (wrap) wrap.style.display = "";
        });
    }

    // ─────────────────────────────────────────────
    //  NOTIFICATIONS
    // ─────────────────────────────────────────────

    _queueNotif(count) {
        this.notifQueue.push(count);
        if (!this.notifBusy) this._drainNotifs();
    }

    async _drainNotifs() {
        if (!this.notifQueue.length || this.notifBusy) return;
        this.notifBusy = true;

        const total = this.notifQueue.reduce((a, b) => a + b, 0);
        this.notifQueue = [];
        await this._showNotif(total);

        this.notifBusy = false;
        if (this.notifQueue.length) this._drainNotifs();
    }

    async _showNotif(count) {
        try {
            const nav = await this._waitFor('[data-list-id="guildsnav"]', 5000);

            // Πάντα re-sync το ref με ό,τι υπάρχει στο DOM
            let wrap = nav.querySelector(".fm-notif-wrap");
            if (!wrap) {
                wrap = document.createElement("div");
                wrap.className = "fm-notif-wrap";
                nav.appendChild(wrap);
            }
            this.notifWrap = wrap;

            const card = document.createElement("div");
            card.className = "fm-notif";
            card.innerHTML = `<b class="fm-notif-num">${count}</b><span class="fm-notif-lbl">read</span>`;
            this.notifWrap.appendChild(card);

            setTimeout(() => card.classList.add("fm-notif--in"), 10);

            let hide = setTimeout(() => this._fadeNotif(card), 5000);
            card.addEventListener("mouseenter", () => clearTimeout(hide));
            card.addEventListener("mouseleave", () => {
                hide = setTimeout(() => this._fadeNotif(card), 2000);
            });
        } catch (e) {
            this._log("Notif error:", e.message);
            this.notifBusy = false;
        }
    }

    _fadeNotif(el) {
        el.classList.remove("fm-notif--in");
        el.classList.add("fm-notif--out");
        setTimeout(() => el.remove(), 500);
    }

    // ─────────────────────────────────────────────
    //  SETTINGS MODAL
    // ─────────────────────────────────────────────

    _openModal() {
        this.modalEl?.remove();

        const root = document.querySelector('[data-mana-component="layer-modal"]') || document.body;

        // Backdrop
        const backdrop = document.createElement("div");
        backdrop.className = "fm-backdrop";
        backdrop.onclick = e => { if (e.target === backdrop) close(); };
        root.appendChild(backdrop);
        this.modalEl = backdrop;

        // Panel
        const panel = document.createElement("div");
        panel.className = "fm-modal";
        ["click", "mousedown", "keydown"].forEach(ev =>
            panel.addEventListener(ev, e => e.stopPropagation())
        );
        backdrop.appendChild(panel);
        requestAnimationFrame(() => { backdrop.style.opacity = "1"; panel.classList.add("fm-modal--in"); });

        const close = () => {
            backdrop.style.opacity = "0";
            panel.classList.remove("fm-modal--in");
            setTimeout(() => { backdrop.remove(); this.modalEl = null; }, 200);
        };

        // ── Header ──
        panel.innerHTML = `
            <div class="fm-modal-head">
                <div class="fm-modal-title">
                    <div class="fm-modal-icon">📁</div>
                    <span>FolderManager</span>
                </div>
                <button class="fm-x-btn">✕</button>
            </div>
        `;
        panel.querySelector(".fm-x-btn").onclick = close;

        const body = document.createElement("div");
        body.className = "fm-modal-body";
        panel.appendChild(body);

        // ── Helpers ──
        const section = label => {
            const d = document.createElement("div");
            d.innerHTML = `<div class="fm-section-lbl">${label}</div>`;
            body.appendChild(d);
            return d;
        };

        const card = () => {
            const c = document.createElement("div");
            c.className = "fm-card";
            return c;
        };

        const row = (html) => {
            const r = document.createElement("div");
            r.className = "fm-row";
            r.innerHTML = html;
            return r;
        };

        const toggle = (active, cb) => {
            const t    = document.createElement("div");
            t.className = "fm-toggle";
            const knob = document.createElement("span");
            knob.className = "fm-toggle-knob";
            t.appendChild(knob);
            let state  = active;
            const sync = () => {
                t.style.background = state ? "#5865f2" : "rgba(255,255,255,0.12)";
                knob.style.left    = state ? "18px" : "2px";
            };
            sync();
            t.onclick = () => { state = !state; sync(); cb(state); };
            return t;
        };

        const counterBadge = id => {
            const s = document.createElement("span");
            s.className = "fm-badge";
            const refresh = () => {
                const n = this._splitIds(this.settings[id].folderIds).length;
                s.textContent = n ? `${n} folder${n > 1 ? "s" : ""}` : "none";
            };
            refresh();
            s._refresh = refresh;
            return s;
        };

        const pickerBtn = (text, onClick) => {
            const b = document.createElement("button");
            b.className = "fm-btn";
            b.textContent = text;
            b.onclick = onClick;
            return b;
        };

        // ────────────────────────────
        //  SECTION: AutoReadTrash
        // ────────────────────────────
        const artSec  = section("AUTOREADTRASH");
        const artCard = card();

        // Enabled toggle
        const artEnRow = row(`<div><div class="fm-row-title">AutoReadTrash</div><div class="fm-row-sub">Αυτόματο διάβασμα φακέλων</div></div>`);
        artEnRow.appendChild(toggle(this.settings.autoRead.enabled, v => {
            this.settings.autoRead.enabled = v;
            this._save();
            if (v) {
                this._startAutoRead();
            } else {
                clearInterval(this.cdInterval);
                this.cdInterval = null;
                this.running = false;
                document.querySelector(".fm-cd")?.remove();
                this.notifWrap?.remove();
                this.notifWrap = null;
            }
        }));
        artCard.appendChild(artEnRow);

        // Folder picker
        const artFolRow   = row("<div>Φάκελοι</div>");
        const artBadge    = counterBadge("autoRead");
        const artCtrl     = document.createElement("div");
        artCtrl.className = "fm-row-ctrl";
        artCtrl.appendChild(artBadge);
        artCtrl.appendChild(pickerBtn("Επιλογή", () => {
            this._openFolderPicker(
                this.settings.autoRead.folderIds,
                ids => {
                    this.settings.autoRead.folderIds = ids;
                    this._save();
                    artBadge._refresh();
                    this._createCdWidget();
                    this._startCd();
                },
                "AutoReadTrash — Φάκελοι"
            );
        }));
        artFolRow.appendChild(artCtrl);
        artCard.appendChild(artFolRow);

        // Interval
        const intRow = row(`<div><div class="fm-row-title">Διάστημα</div><div class="fm-row-sub">Λεπτά (5 – 120)</div></div>`);
        const numIn  = document.createElement("input");
        numIn.type = "number"; numIn.min = 5; numIn.max = 120;
        numIn.value = this.settings.autoRead.intervalMins;
        numIn.className = "fm-num-input";
        numIn.onchange = () => {
            const v = Math.min(120, Math.max(5, parseInt(numIn.value) || 5));
            numIn.value = v; // δείχνει την clamped τιμή πίσω στον χρήστη
            this.settings.autoRead.intervalMins = v;
            this.settings.lastRun = this._now();
            this._save();
            this._startCd(); // ξαναρχίζει countdown με νέο interval
        };
        intRow.appendChild(numIn);
        artCard.appendChild(intRow);

        // Countdown toggle
        const cdRow = row("<div>Αντίστροφη μέτρηση</div>");
        cdRow.appendChild(toggle(this.settings.autoRead.showCountdown, v => {
            this.settings.autoRead.showCountdown = v;
            this._save();
            this._startCd();
        }));
        artCard.appendChild(cdRow);
        artSec.appendChild(artCard);

        // ────────────────────────────
        //  SECTION: HideFolders
        // ────────────────────────────
        const hfSec  = section("HIDEFOLDERS");
        const hfCard = card();

        // Enabled toggle
        const hfEnRow = row(`<div><div class="fm-row-title">HideFolders</div><div class="fm-row-sub">Κρύψιμο φακέλων</div></div>`);
        hfEnRow.appendChild(toggle(this.settings.hideFolders.enabled, v => {
            this.settings.hideFolders.enabled = v;
            this._save();
            v ? this._applyHide() : this._removeHide();
        }));
        hfCard.appendChild(hfEnRow);

        // Folder picker
        const hfFolRow   = row("<div>Κρυμμένοι φάκελοι</div>");
        const hfBadge    = counterBadge("hideFolders");
        const hfCtrl     = document.createElement("div");
        hfCtrl.className = "fm-row-ctrl";
        hfCtrl.appendChild(hfBadge);
        hfCtrl.appendChild(pickerBtn("Επιλογή", () => {
            this._removeHide();
            this._openFolderPicker(
                this.settings.hideFolders.folderIds,
                ids => {
                    this.settings.hideFolders.folderIds = ids;
                    this._save();
                    hfBadge._refresh();
                    setTimeout(() => this._applyHide(), 100);
                },
                "HideFolders — Φάκελοι",
                () => setTimeout(() => this._applyHide(), 100)
            );
        }));
        hfFolRow.appendChild(hfCtrl);
        hfCard.appendChild(hfFolRow);
        hfSec.appendChild(hfCard);

        // ────────────────────────────
        //  SECTION: Update
        // ────────────────────────────
        const upSec  = section("ΕΝΗΜΕΡΩΣΗ");
        const upCard = card();
        upCard.className += " fm-update-card";

        const upRow  = document.createElement("div");
        upRow.className = "fm-update-row";
        upRow.innerHTML = "<span>Έλεγχος για νέα έκδοση</span>";

        const upBtn    = document.createElement("button");
        upBtn.className = "fm-btn";
        upBtn.textContent = "Έλεγχος τώρα";

        const upResult = document.createElement("div");
        upResult.className = "fm-update-result";

        upBtn.onclick = async () => {
            if (this.updateBusy) return;
            this.updateBusy = true;
            upBtn.textContent = "⏳ Έλεγχος...";
            upBtn.disabled    = true;
            await this._checkUpdate(upResult);
            upBtn.textContent = "Έλεγχος τώρα";
            upBtn.disabled    = false;
            this.updateBusy   = false;
        };

        upRow.appendChild(upBtn);
        upCard.appendChild(upRow);
        upCard.appendChild(upResult);
        upSec.appendChild(upCard);
    }

    // ─────────────────────────────────────────────
    //  FOLDER PICKER
    // ─────────────────────────────────────────────

    _openFolderPicker(currentIds, onSave, title = "Επιλογή Φακέλων", onCancel = null) {
        document.querySelector(".fm-picker-overlay")?.remove();

        const selected = new Set(currentIds.split(",").map(s => s.trim()).filter(Boolean));
        const folders  = this._getNavFolders();

        // ── Build overlay ──
        const overlay = document.createElement("div");
        overlay.className = "fm-picker-overlay";
        document.body.appendChild(overlay);

        const panel = document.createElement("div");
        panel.className = "fm-picker-panel";

        const closeOverlay = (save) => {
            overlay.style.opacity = "0";
            setTimeout(() => overlay.remove(), 200);
            if (save) onSave([...selected].join(", "));
            else onCancel?.();
        };

        overlay.onclick = e => { if (e.target === overlay) closeOverlay(false); };
        requestAnimationFrame(() => overlay.style.opacity = "1");

        // Header
        panel.innerHTML = `
            <div class="fm-picker-head">
                <div class="fm-picker-head-left">
                    <div class="fm-picker-head-icon">📁</div>
                    <span class="fm-picker-head-title">${title}</span>
                </div>
                <button class="fm-x-btn">✕</button>
            </div>
        `;
        panel.querySelector(".fm-x-btn").onclick = () => closeOverlay(false);

        const list = document.createElement("div");
        list.className = "fm-picker-list";

        if (!folders.length) {
            list.innerHTML = `<div class="fm-picker-empty">Δεν βρέθηκαν φάκελοι</div>`;
        }

        panel.appendChild(list);

        // Footer — ορίζεται ΠΡΙΝ το forEach ώστε το updateCount να είναι accessible
        const footer   = document.createElement("div");
        footer.className = "fm-picker-footer";
        const countLbl = document.createElement("div");
        countLbl.className   = "fm-picker-count";
        const updateCount = () => {
            countLbl.textContent = selected.size ? `${selected.size} επιλεγμέν${selected.size > 1 ? "α" : "ο"}` : "Κανένα";
        };
        updateCount();

        folders.forEach(({ id, name, color }) => {
            let sel = selected.has(id);

            const row = document.createElement("div");
            row.className = "fm-picker-row" + (sel ? " fm-picker-row--sel" : "");

            const iconWrap = document.createElement("div");
            iconWrap.className = "fm-picker-icon";
            iconWrap.style.background = color;
            iconWrap.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg>`;

            const nameLbl = document.createElement("div");
            nameLbl.className   = "fm-picker-name";
            nameLbl.textContent = name;

            const check = document.createElement("div");
            check.className   = "fm-picker-check" + (sel ? " fm-picker-check--on" : "");
            check.textContent = sel ? "✓" : "";

            row.appendChild(iconWrap);
            row.appendChild(nameLbl);
            row.appendChild(check);

            row.onclick = () => {
                sel ? selected.delete(id) : selected.add(id);
                sel = !sel;
                row.classList.toggle("fm-picker-row--sel", sel);
                check.classList.toggle("fm-picker-check--on", sel);
                check.textContent = sel ? "✓" : "";
                updateCount();
            };

            list.appendChild(row);
        });

        const btnWrap = document.createElement("div");
        btnWrap.className = "fm-picker-btns";

        const cancelBtn = document.createElement("button");
        cancelBtn.className   = "fm-btn-sec";
        cancelBtn.textContent = "Άκυρο";
        cancelBtn.onclick     = () => closeOverlay(false);

        const saveBtn = document.createElement("button");
        saveBtn.className   = "fm-btn";
        saveBtn.textContent = "Αποθήκευση";
        saveBtn.onclick     = () => closeOverlay(true);

        btnWrap.appendChild(cancelBtn);
        btnWrap.appendChild(saveBtn);
        footer.appendChild(countLbl);
        footer.appendChild(btnWrap);
        panel.appendChild(footer);
        overlay.appendChild(panel);
    }

    // ─────────────────────────────────────────────
    //  UPDATE CHECKER
    // ─────────────────────────────────────────────

    async _checkUpdate(resultEl) {
        const URL = "https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/.FolderManager.plugin.js";
        try {
            const res     = await fetch(URL);
            const code    = await res.text();
            const remote  = code.match(/@version\s+([^\n]+)/)?.[1]?.trim();
            const local   = BdApi.Plugins.get("FolderManager")?.version || "0.0.0";

            if (!remote) return this._setResult(resultEl, "❓ Δεν βρέθηκε έκδοση", "warn");

            if (this._isNewer(remote, local)) {
                this._setResult(resultEl, `📦 Νέα έκδοση ${remote}. Ενημέρωση...`, "warn");
                this._applyUpdate(code);
                this._setResult(resultEl, `✅ Ενημερώθηκε σε ${remote}!`, "ok");
            } else {
                this._setResult(resultEl, `✅ Είσαι ενημερωμένος (${local})`, "ok");
            }
        } catch (e) {
            this._setResult(resultEl, `❌ Σφάλμα: ${e.message}`, "err");
        }
    }

    _setResult(el, msg, type) {
        if (!el) return;
        const colors = { ok: "#23a55a", err: "#f23f43", warn: "#f0b132" };
        el.style.display = "block";
        el.innerHTML = `<div class="fm-update-msg" style="border-color:${colors[type]}33">${msg}</div>`;
    }

    _isNewer(remote, local) {
        const r = remote.split(".").map(Number);
        const l = local.split(".").map(Number);
        for (let i = 0; i < 3; i++) {
            if ((r[i] || 0) > (l[i] || 0)) return true;
            if ((r[i] || 0) < (l[i] || 0)) return false;
        }
        return false;
    }

    _applyUpdate(code) {
        try {
            BdApi.Plugins.disable("FolderManager");
            const fs   = require("fs");
            const path = require("path");
            fs.writeFileSync(path.join(BdApi.Plugins.folder, "FolderManager.plugin.js"), code);
            BdApi.Plugins.enable("FolderManager");
        } catch (e) {
            this._log("Update error:", e.message);
            throw e;
        }
    }

    // ─────────────────────────────────────────────
    //  DOM OBSERVER → settings icon στην plugin card
    // ─────────────────────────────────────────────

    _watchPluginCard() {
        if (this.domObserver) return;
        this.domObserver = new MutationObserver(() => {
            const card = [...document.querySelectorAll('[class*="bd-addon-card"]')]
                .find(c => c.querySelector('[class*="bd-addon-header"]')?.textContent.includes("FolderManager"));
            if (!card) return;
            const controls = card.querySelector('[class*="bd-controls"]');
            if (controls && !controls.querySelector('[aria-label="FolderManager Settings"]')) {
                this._injectSettingsBtn(controls);
            }
        });
        this.domObserver.observe(document.body, { childList: true, subtree: true });
    }

    _injectSettingsBtn(controls) {
        const btn = document.createElement("button");
        btn.setAttribute("aria-label", "FolderManager Settings");
        btn.className = "bd-button bd-button-filled bd-addon-button bd-button-color-brand fm-settings-btn";
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>`;
        btn.onclick = () => this._openModal();
        controls.appendChild(btn);
        this.settingsBtn = btn;
    }

    // ─────────────────────────────────────────────
    //  CSS
    // ─────────────────────────────────────────────

    _injectStyles() {
        // Αφαιρεί παλιό style tag αν υπάρχει (π.χ. από προηγούμενο boot)
        document.querySelector("#fm-styles")?.remove();
        this._style = null;

        const css = /* css */ `

/* ── Notification wrap ── */
.fm-notif-wrap {
    position: absolute;
    bottom: 135px; left: 55%;
    transform: translateX(-50%);
    display: flex; flex-direction: column; gap: 8px;
    width: 60px; z-index: 9999;
}
.fm-notif {
    width: 51px; height: 51px;
    background: rgb(33,37,41);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px;
    box-shadow: 0 8px 20px rgba(0,0,0,.3);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    color: #e0e0e0;
    font-family: 'Whitney','Helvetica Neue',Helvetica,Arial,sans-serif;
    opacity: 0; transform: translateY(10px) scale(.95);
    transition: opacity .5s ease, transform .5s ease;
}
.fm-notif--in  { opacity: 1; transform: none; }
.fm-notif--out { opacity: 0; transform: translateY(5px) scale(.95); }
.fm-notif:hover { background: rgba(50,50,80,.8); box-shadow: 0 10px 25px rgba(0,0,0,.4), 0 0 15px rgba(100,200,255,.5); }
.fm-notif-num { font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 3px; }
.fm-notif-lbl { font-size: 12px; color: #ccc; letter-spacing: .5px; }

/* ── Countdown ── */
.fm-cd {
    position: absolute !important;
    bottom: 75px !important; left: 50% !important;
    transform: translateX(-50%) !important;
    width: 48px; height: 50px;
    background: rgba(33,37,41,.9);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 16px;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    font-family: 'Whitney','Helvetica Neue',Helvetica,Arial,sans-serif;
    box-shadow: 0 6px 16px rgba(0,0,0,.3);
    z-index: 9999; cursor: default;
    gap: 1px;
}
.fm-cd-label { font-size: 7px; font-weight: 600; color: #b9bbbe; text-transform: uppercase; letter-spacing: .5px; }
.fm-cd-time  { font-size: 13px; font-weight: 700; color: #fff; text-shadow: 0 0 4px rgba(100,200,255,.5); }

/* ── Countdown popout ── */
.fm-popout {
    position: fixed; z-index: 99999;
    background: linear-gradient(160deg,#313338,#2b2d31);
    border-radius: 8px;
    padding: 8px; min-width: 110px; max-width: 155px;
    border: 1px solid rgba(255,255,255,.1);
    box-shadow: 0 8px 32px rgba(0,0,0,.6);
    font-family: var(--font-primary,'gg sans',sans-serif);
}
.fm-popout-title {
    font-size: 11px; font-weight: 600;
    color: rgba(255,255,255,.4);
    text-transform: uppercase; letter-spacing: .5px;
    padding: 2px 4px 6px;
}
.fm-popout-row {
    display: flex; align-items: center; gap: 8px;
    padding: 5px 6px; border-radius: 4px;
    cursor: pointer; color: #ddd; font-size: 13px;
    transition: background .12s;
}
.fm-popout-row:hover { background: rgba(255,255,255,.1); }
.fm-popout-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fm-popout-empty { color: rgba(255,255,255,.35); font-size: 13px; padding: 4px 6px; }

/* ── Shared panel base ── */
.fm-backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.55);
    backdrop-filter: blur(6px);
    z-index: 9998; opacity: 0;
    transition: opacity .2s;
}
/* ── Main modal ── */
.fm-modal {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%,-50%) scale(.95);
    background: linear-gradient(175deg,#2c2d33 0%,#1e1f24 55%,#18191d 100%);
    border: 1px solid rgba(255,255,255,.13);
    border-radius: 14px;
    box-shadow: 0 32px 80px rgba(0,0,0,.75);
    display: flex; flex-direction: column;
    font-family: "gg sans",sans-serif;
    color: #dbdee1;
    opacity: 0;
    transition: transform .22s, opacity .18s;
    width: 460px; max-width: 92vw; max-height: 80vh;
    z-index: 9999;
}
.fm-modal.fm-modal--in { opacity: 1; transform: translate(-50%,-50%) scale(1); }

.fm-modal-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 20px;
    border-bottom: 1px solid rgba(255,255,255,.07);
}
.fm-modal-title {
    display: flex; align-items: center; gap: 10px;
    font-size: 16px; font-weight: 700;
}
.fm-modal-icon {
    width: 32px; height: 32px; border-radius: 8px;
    background: linear-gradient(135deg,#5865f2,#3b4fd4);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
}
.fm-x-btn {
    background: rgba(255,255,255,.07);
    border: none; border-radius: 8px;
    width: 30px; height: 30px;
    cursor: pointer; color: #80848e;
    display: flex; align-items: center; justify-content: center;
}
.fm-x-btn:hover { background: rgba(255,255,255,.12); color: #dbdee1; }

.fm-modal-body { flex: 1; overflow-y: auto; padding: 8px 16px 20px; display: flex; flex-direction: column; gap: 4px; }

/* ── Section label ── */
.fm-section-lbl {
    font-size: 10.5px; font-weight: 700;
    color: #5c6070; text-transform: uppercase;
    letter-spacing: .5px; margin: 12px 4px 6px;
}

/* ── Card ── */
.fm-card {
    background: rgba(255,255,255,.03);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 10px; overflow: hidden; margin-bottom: 8px;
}

/* ── Row ── */
.fm-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 11px 14px;
    border-bottom: 1px solid rgba(255,255,255,.05);
}
.fm-row:last-child { border-bottom: none; }
.fm-row-title { font-weight: 500; }
.fm-row-sub   { font-size: 11.5px; color: #5c6070; margin-top: 1px; }
.fm-row-ctrl  { display: flex; align-items: center; gap: 6px; }

/* ── Toggle ── */
.fm-toggle {
    width: 36px; height: 20px; border-radius: 10px;
    cursor: pointer; position: relative;
    transition: background .2s; flex-shrink: 0;
}
.fm-toggle-knob {
    position: absolute; top: 2px;
    width: 16px; height: 16px;
    border-radius: 50%; background: #fff;
    transition: left .18s; display: block;
}

/* ── Inputs / Buttons ── */
.fm-num-input {
    width: 60px; padding: 5px;
    border-radius: 7px; border: 1px solid rgba(255,255,255,.1);
    background: #111214; color: #dbdee1; text-align: center;
}
.fm-badge { font-size: 12px; color: #5c6070; }
.fm-btn {
    padding: 6px 14px; border-radius: 7px;
    border: none; background: #5865f2;
    color: #fff; cursor: pointer;
    font-size: 12.5px; font-weight: 600;
}
.fm-btn:hover { background: #4752c4; }
.fm-btn-sec {
    padding: 7px 16px; border-radius: 8px;
    border: 1px solid rgba(255,255,255,.1);
    background: rgba(255,255,255,.06);
    color: #b5bac1; cursor: pointer;
}
.fm-btn-sec:hover { background: rgba(255,255,255,.1); }

/* ── Update card ── */
.fm-update-card { padding: 11px 14px; }
.fm-update-row  { display: flex; align-items: center; justify-content: space-between; }
.fm-update-result { margin-top: 10px; display: none; }
.fm-update-msg {
    padding: 9px 12px; border-radius: 8px;
    background: rgba(255,255,255,.03);
    color: #b5bac1; font-size: 12.5px;
    border: 1px solid transparent;
}

/* ── Folder picker overlay ── */
.fm-picker-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.6);
    backdrop-filter: blur(6px);
    z-index: 99998; opacity: 0;
    transition: opacity .2s;
    display: flex; align-items: center; justify-content: center;
}
.fm-picker-panel {
    width: 420px; max-width: 92vw; max-height: 72vh;
    background: linear-gradient(175deg,#2c2d33,#1e1f24);
    border: 1px solid rgba(255,255,255,.13);
    border-radius: 14px;
    box-shadow: 0 32px 80px rgba(0,0,0,.75);
    display: flex; flex-direction: column;
    font-family: "gg sans",sans-serif;
    color: #dbdee1; z-index: 99999;
}
.fm-picker-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 18px;
    border-bottom: 1px solid rgba(255,255,255,.07);
}
.fm-picker-head-left { display: flex; align-items: center; gap: 10px; }
.fm-picker-head-icon {
    width: 28px; height: 28px; border-radius: 7px;
    background: linear-gradient(135deg,#5865f2,#3b4fd4);
    display: flex; align-items: center; justify-content: center;
    font-size: 14px;
}
.fm-picker-head-title { font-weight: 700; font-size: 15px; }
.fm-picker-list { overflow-y: auto; flex: 1; padding: 6px 10px; }
.fm-picker-empty { padding: 32px; text-align: center; color: #5c6070; }
.fm-picker-row {
    display: flex; align-items: center; gap: 12px;
    padding: 9px 10px; border-radius: 9px; cursor: pointer;
    border: 1px solid transparent;
    transition: background .1s, border-color .1s;
}
.fm-picker-row:hover { background: rgba(255,255,255,.05); }
.fm-picker-row--sel  { background: rgba(88,101,242,.18); border-color: rgba(88,101,242,.35); }
.fm-picker-icon {
    width: 38px; height: 38px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; color: #fff;
}
.fm-picker-name { flex: 1; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fm-picker-check {
    width: 18px; height: 18px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,.2);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; font-size: 11px;
    transition: border-color .15s, background .15s;
}
.fm-picker-check--on { border-color: #5865f2; background: #5865f2; color: #fff; }
.fm-picker-footer {
    padding: 12px 16px;
    border-top: 1px solid rgba(255,255,255,.07);
    display: flex; align-items: center; justify-content: space-between;
}
.fm-picker-count { font-size: 12px; color: #5c6070; }
.fm-picker-btns  { display: flex; gap: 8px; }

/* ── Settings button ── */
.fm-settings-btn {
    cursor: pointer; padding: 0;
    width: 30px; height: 30px;
    border-radius: 12%;
    display: flex; align-items: center; justify-content: center;
}
        `;

        this._style = document.createElement("style");
        this._style.id = "fm-styles";
        this._style.textContent = css;
        document.head.appendChild(this._style);
        this._log("CSS injected");
    }

    // ─────────────────────────────────────────────
    //  UTILS
    // ─────────────────────────────────────────────

    _splitIds(str) {
        return (str || "").split(",").map(s => s.trim()).filter(Boolean);
    }

    _now() {
        return new Date().toLocaleString("el-GR", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit", second: "2-digit",
            hour12: false
        });
    }

    _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    _waitFor(selector, timeout = 10_000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const poll  = () => {
                const el = document.querySelector(selector);
                if (el) return resolve(el);
                if (Date.now() - start > timeout) return reject(new Error(`Timeout: ${selector}`));
                setTimeout(poll, 500);
            };
            poll();
        });
    }

    _log(...args) {
        console.log(
            "%c[FolderManager]%c " + args.join(" "),
            "background:#5865f2;color:#fff;padding:2px 6px;border-radius:4px 0 0 4px;font-weight:700",
            "background:#2c2d33;color:#fff;padding:2px 6px;border-radius:0 4px 4px 0;"
        );
    }
};