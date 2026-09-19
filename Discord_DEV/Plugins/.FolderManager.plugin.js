/**
 * @name FolderManager
 * @version 17.0.0
 * @description Αυτόματο διάβασμα φακέλων (AutoReadTrash) και κρύψιμο φακέλων (HideFolders) στη λίστα των servers. Δεξί κλικ στο countdown για γρήγορο κρύψιμο φακέλων και «Διάβασμα τώρα».
 * @author ThomasT
 * @authorId 706932839907852389
 * @source https://github.com/thomasthanos/1st-theme/blob/main/Discord_DEV/Plugins/.FolderManager.plugin.js
 * @updateUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/.FolderManager.plugin.js
 * @website https://github.com/thomasthanos
 */

"use strict";

const NAME = "FolderManager";
const NAV_SELECTOR = '[data-list-id="guildsnav"]';
const KEY_PREFIX = "guildsnav___";
const MARK_READ_SOURCE = "Guild List";

const DEFAULT_SETTINGS = {
    autoRead: {
        enabled: true,
        folderIds: "",
        intervalMins: 15,
        showCountdown: true
    },
    hideFolders: {
        enabled: true,
        folderIds: ""
    },
    lastRun: ""
};

const FOLDER_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg>';
const EYE_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

const STYLES = `
/* ── Notification bubble ── */
.fm-notif-wrap {
    position: absolute;
    bottom: 135px; left: 55%;
    transform: translateX(-50%);
    display: flex; flex-direction: column; gap: 8px;
    width: 60px; z-index: 9999;
    pointer-events: none;
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
    font-family: var(--font-primary, 'gg sans', sans-serif);
    opacity: 0; transform: translateY(10px) scale(.95);
    transition: opacity .5s ease, transform .5s ease;
    pointer-events: auto;
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
    font-family: var(--font-primary, 'gg sans', sans-serif);
    box-shadow: 0 6px 16px rgba(0,0,0,.3);
    z-index: 9999; cursor: context-menu;
    gap: 1px;
}
.fm-cd-label { font-size: 7px; font-weight: 600; color: #b9bbbe; text-transform: uppercase; letter-spacing: .5px; }
.fm-cd-time  { font-size: 13px; font-weight: 700; color: #fff; text-shadow: 0 0 4px rgba(100,200,255,.5); }

/* ── Countdown popout ── */
.fm-popout {
    position: fixed; z-index: 99999;
    background: linear-gradient(160deg,#313338,#2b2d31);
    border-radius: 8px;
    padding: 8px; min-width: 150px; max-width: 220px;
    max-height: 70vh; overflow-y: auto;
    border: 1px solid rgba(255,255,255,.1);
    box-shadow: 0 8px 32px rgba(0,0,0,.6);
    font-family: var(--font-primary, 'gg sans', sans-serif);
}
.fm-popout-title {
    font-size: 11px; font-weight: 600;
    color: rgba(255,255,255,.4);
    text-transform: uppercase; letter-spacing: .5px;
    padding: 8px 4px 6px;
}
.fm-popout-row {
    display: flex; align-items: center; gap: 8px;
    padding: 5px 6px; border-radius: 4px;
    cursor: pointer; color: #ddd; font-size: 13px;
    transition: background .12s;
}
.fm-popout-row:hover { background: rgba(255,255,255,.1); }
.fm-popout-action { color: #fff; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,.06); border-radius: 4px 4px 0 0; }
.fm-popout-eye { display: flex; }
.fm-popout-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fm-popout-empty { color: rgba(255,255,255,.35); font-size: 13px; padding: 4px 6px; }

/* ── Settings panel ── */
.fm-panel { display: flex; flex-direction: column; gap: 4px; color: #dbdee1; font-family: var(--font-primary, 'gg sans', sans-serif); }
.fm-section-lbl {
    font-size: 10.5px; font-weight: 700;
    color: #80848e; text-transform: uppercase;
    letter-spacing: .5px; margin: 12px 4px 6px;
}
.fm-card {
    background: rgba(255,255,255,.03);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 10px; overflow: hidden; margin-bottom: 8px;
}
.fm-row {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 11px 14px;
    border-bottom: 1px solid rgba(255,255,255,.05);
}
.fm-row:last-child { border-bottom: none; }
.fm-row-title { font-weight: 500; }
.fm-row-sub   { font-size: 11.5px; color: #80848e; margin-top: 1px; }
.fm-row-ctrl  { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.fm-warn { color: #f0b132; font-size: 12.5px; }
.fm-toggle {
    width: 36px; height: 20px; border-radius: 10px;
    cursor: pointer; position: relative;
    transition: background .2s; flex-shrink: 0;
    background: rgba(255,255,255,0.12);
}
.fm-toggle--on { background: #5865f2; }
.fm-toggle-knob {
    position: absolute; top: 2px; left: 2px;
    width: 16px; height: 16px;
    border-radius: 50%; background: #fff;
    transition: left .18s; display: block;
}
.fm-toggle--on .fm-toggle-knob { left: 18px; }
.fm-num-input {
    width: 60px; padding: 5px;
    border-radius: 7px; border: 1px solid rgba(255,255,255,.1);
    background: #111214; color: #dbdee1; text-align: center;
}
.fm-badge { font-size: 12px; color: #80848e; }
.fm-btn {
    padding: 6px 14px; border-radius: 7px;
    border: none; background: #5865f2;
    color: #fff; cursor: pointer;
    font-size: 12.5px; font-weight: 600;
}
.fm-btn:hover { background: #4752c4; }
.fm-btn:disabled { opacity: .5; cursor: default; }

/* ── Folder list ── */
.fm-folder-list { padding: 6px 8px 8px; display: flex; flex-direction: column; gap: 2px; }
.fm-picker-empty { padding: 16px; text-align: center; color: #80848e; }
.fm-picker-row {
    display: flex; align-items: center; gap: 12px;
    padding: 7px 10px; border-radius: 9px; cursor: pointer;
    border: 1px solid transparent;
    transition: background .1s, border-color .1s;
}
.fm-picker-row:hover { background: rgba(255,255,255,.05); }
.fm-picker-row--sel  { background: rgba(88,101,242,.18); border-color: rgba(88,101,242,.35); }
.fm-picker-icon {
    width: 32px; height: 32px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; color: #fff;
}
.fm-picker-name { flex: 1; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fm-picker-meta { font-size: 12px; color: #80848e; flex-shrink: 0; }
.fm-picker-check {
    width: 18px; height: 18px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,.2);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; font-size: 11px;
    transition: border-color .15s, background .15s;
}
.fm-picker-check--on { border-color: #5865f2; background: #5865f2; color: #fff; }
.fm-footer { font-size: 11.5px; color: #80848e; margin: 6px 4px 0; }
`;

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}

function svgIcon(markup) {
    const holder = el("span");
    holder.style.display = "flex";
    holder.innerHTML = markup;
    return holder;
}

function toggle(active, onChange) {
    const node = el("div", "fm-toggle");
    node.append(el("span", "fm-toggle-knob"));
    node.setAttribute("role", "switch");
    let state = Boolean(active);
    const sync = () => {
        node.classList.toggle("fm-toggle--on", state);
        node.setAttribute("aria-checked", String(state));
    };
    sync();
    node.onclick = () => {
        state = !state;
        sync();
        onChange(state);
    };
    return node;
}

function settingRow(title, subtitle, control) {
    const row = el("div", "fm-row");
    const text = el("div");
    text.append(el("div", "fm-row-title", title));
    if (subtitle) text.append(el("div", "fm-row-sub", subtitle));
    row.append(text);
    if (control) row.append(control);
    return row;
}

module.exports = class FolderManager {
    constructor() {
        this.settings = null;
        this.userId = null;
        this.allUsers = {};
        this.alive = false;
        this.timers = new Set();
        this.tickTimer = null;
        this.saveTimer = null;
        this.nextRunAt = 0;
        this.running = false;
        this.mods = null;
        this.nav = null;
        this.cdEl = null;
        this.cdText = null;
        this.popout = null;
        this.popoutListeners = null;
        this.notifQueue = [];
        this.notifBusy = false;
    }

    // ─────────────────────────────────────────────
    //  LIFECYCLE
    // ─────────────────────────────────────────────

    start() {
        this.alive = true;
        BdApi.DOM.addStyle(NAME, STYLES);
        this._boot();
    }

    async _boot() {
        // Widgets left behind by an older version of the plugin.
        document.querySelectorAll(".fm-notif-wrap, .fm-cd").forEach(node => node.remove());
        const userId = await this._waitForUser();
        if (!this.alive || !userId) return;
        // The settings panel may already have loaded them (and hold unsaved changes).
        if (!this.settings || this.userId !== userId) this._loadSettings(userId);
        this._applyHide();
        const { Folders, markRead } = this._mods();
        const folderCount = this._listFolders().length;
        this._log(`Έτοιμο · mark-as-read: ${markRead ? "Discord action" : "μενού (fallback)"} · φάκελοι: ${Folders ? folderCount : "? (χωρίς store)"}`);
        if (this.settings.autoRead.enabled) this._startAutoRead(5000);
    }

    stop() {
        this.alive = false;
        this._stopAutoRead();
        for (const id of this.timers) clearTimeout(id);
        this.timers.clear();
        this._flushSave();
        this._closePopout();
        document.querySelectorAll(".fm-notif-wrap, .fm-cd").forEach(node => node.remove());
        this.notifQueue = [];
        this.notifBusy = false;
        BdApi.DOM.removeStyle(NAME);
        BdApi.DOM.removeStyle(`${NAME}-hide`);
        this.mods = null;
        this.nav = null;
    }

    // ─────────────────────────────────────────────
    //  SETTINGS  (per user)
    // ─────────────────────────────────────────────

    _currentUserId() {
        try {
            return BdApi.Webpack.getStore("UserStore")?.getCurrentUser()?.id || null;
        }
        catch {
            return null;
        }
    }

    async _waitForUser() {
        while (this.alive) {
            const id = this._currentUserId();
            if (id) return id;
            await this._sleep(1000);
        }
        return null;
    }

    // Another account logged in: switch to that account's settings.
    _ensureUser() {
        const id = this._currentUserId();
        if (!id || id === this.userId) return;
        this._flushSave();
        this._loadSettings(id);
        this._applyHide();
    }

    _loadSettings(userId) {
        this.userId = userId;
        this.allUsers = BdApi.Data.load(NAME, "users") || {};

        if (!this.allUsers[userId]) {
            this.allUsers[userId] = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            // Migration from the old single-user format (key "settings").
            if (Object.keys(this.allUsers).length === 1) {
                const old = BdApi.Data.load(NAME, "settings");
                if (old) this._migrateOld(this.allUsers[userId], old);
            }
        }

        this.settings = this.allUsers[userId];
        this._sanitize();
        this._save();
    }

    _migrateOld(target, old) {
        try {
            if (old.autoReadTrash) {
                target.autoRead.enabled = old.autoReadTrash.enabled ?? target.autoRead.enabled;
                target.autoRead.folderIds = old.autoReadTrash.folderIds ?? target.autoRead.folderIds;
                target.autoRead.intervalMins = old.autoReadTrash.intervalMinutes ?? target.autoRead.intervalMins;
                target.autoRead.showCountdown = old.autoReadTrash.showCountdown ?? target.autoRead.showCountdown;
            }
            if (old.hideFolders) {
                target.hideFolders.enabled = old.hideFolders.enabled ?? target.hideFolders.enabled;
                target.hideFolders.folderIds = old.hideFolders.folderIds ?? target.hideFolders.folderIds;
            }
            if (old.lastRun) target.lastRun = old.lastRun;
            BdApi.Data.delete(NAME, "settings");
            this._log("Migration ολοκληρώθηκε — το παλιό 'settings' key διαγράφηκε");
        }
        catch (e) {
            this._log("Migration error:", e.message);
        }
    }

    _sanitize() {
        const def = DEFAULT_SETTINGS;
        const s = this.settings;
        if (!s.autoRead || typeof s.autoRead !== "object") s.autoRead = { ...def.autoRead };
        if (!s.hideFolders || typeof s.hideFolders !== "object") s.hideFolders = { ...def.hideFolders };
        for (const key of Object.keys(def.autoRead)) s.autoRead[key] ??= def.autoRead[key];
        for (const key of Object.keys(def.hideFolders)) s.hideFolders[key] ??= def.hideFolders[key];
        s.autoRead.intervalMins = Math.min(120, Math.max(5, parseInt(s.autoRead.intervalMins, 10) || def.autoRead.intervalMins));
        if (typeof s.autoRead.folderIds !== "string") s.autoRead.folderIds = "";
        if (typeof s.hideFolders.folderIds !== "string") s.hideFolders.folderIds = "";
        if (typeof s.lastRun !== "string") s.lastRun = "";
    }

    _save() {
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => this._flushSave(), 1000);
    }

    _flushSave() {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
        if (!this.userId || !this.settings) return;
        try {
            this.allUsers[this.userId] = this.settings;
            BdApi.Data.save(NAME, "users", this.allUsers);
        }
        catch (e) {
            this._log("Save error:", e.message);
        }
    }

    _selected(section) {
        return this._splitIds(this.settings?.[section]?.folderIds);
    }

    // ─────────────────────────────────────────────
    //  DISCORD MODULES
    // ─────────────────────────────────────────────

    // A complete lookup is cached for good; an incomplete one is retried at most once a minute,
    // because searching every webpack export is not free.
    _mods() {
        if (this.mods && (this.mods.complete || Date.now() - this.mods.at < 60000)) return this.mods;
        const W = BdApi.Webpack;
        const mods = {};
        try { mods.Folders = W.getStore("SortedGuildStore"); } catch {}
        try { mods.ReadState = W.getStore("GuildReadStateStore"); } catch {}
        try { mods.Guilds = W.getStore("GuildStore"); } catch {}
        // The same function the "Mark Folder As Read" context menu item calls: (guildIds, source).
        try { mods.markRead = W.getByStrings("getSelectableChannelIds", "ackIdForGuild", "GUILD_ONBOARDING_QUESTION", { searchExports: true }); } catch {}
        if (typeof mods.markRead !== "function") mods.markRead = null;
        mods.complete = Boolean(mods.Folders && mods.ReadState && mods.markRead);
        mods.at = Date.now();
        this.mods = mods;
        return mods;
    }

    _listFolders() {
        const { Folders, Guilds } = this._mods();
        let raw = [];
        try { raw = Folders?.getGuildFolders?.() || []; } catch {}
        const folders = [];
        for (const folder of raw) {
            if (folder?.folderId == null) continue;
            const guildIds = Array.isArray(folder.guildIds) ? folder.guildIds : [];
            folders.push({
                key: KEY_PREFIX + folder.folderId,
                id: String(folder.folderId),
                name: this._folderName(folder, guildIds, Guilds),
                color: this._folderColor(folder.folderColor),
                guildIds
            });
        }
        return folders.length ? folders : this._listFoldersFromDom();
    }

    // Used only when the folder store is missing: every folder button owns "folder-items-<id>".
    _listFoldersFromDom() {
        const seen = new Set();
        const folders = [];
        for (const button of document.querySelectorAll(`${NAV_SELECTOR} [aria-owns^="folder-items-"]`)) {
            const id = button.getAttribute("aria-owns").slice("folder-items-".length);
            if (!id || seen.has(id)) continue;
            seen.add(id);
            const name = button.parentElement?.getAttribute("data-dnd-name") || `Φάκελος ${id}`;
            folders.push({ key: KEY_PREFIX + id, id, name, color: "#5865f2", guildIds: [] });
        }
        return folders;
    }

    _folderName(folder, guildIds, Guilds) {
        const name = typeof folder.folderName === "string" ? folder.folderName.trim() : "";
        if (name) return name;
        const names = guildIds.map(id => Guilds?.getGuild?.(id)?.name).filter(Boolean);
        if (names.length) return names.slice(0, 3).join(", ") + (names.length > 3 ? ", …" : "");
        return `Φάκελος ${folder.folderId}`;
    }

    _folderColor(color) {
        return typeof color === "number" && color > 0 ? `#${color.toString(16).padStart(6, "0")}` : "#5865f2";
    }

    _hasUnread(ReadState, guildId) {
        if (!ReadState) return true;
        try {
            return Boolean(ReadState.hasUnread(guildId)
                || ReadState.getMentionCount(guildId) > 0
                || ReadState.getGuildHasUnreadIgnoreMuted?.(guildId));
        }
        catch {
            return true;
        }
    }

    // ─────────────────────────────────────────────
    //  AUTO READ TRASH
    // ─────────────────────────────────────────────

    _intervalMs() {
        return this.settings.autoRead.intervalMins * 60000;
    }

    _startAutoRead(firstDelay = 3000) {
        this._stopAutoRead();
        if (!this.alive || !this.settings) return;
        if (!this.settings.lastRun) {
            this.settings.lastRun = this._now();
            this._save();
        }
        this.nextRunAt = Date.now() + firstDelay;
        this.tickTimer = setInterval(() => this._tick(), 1000);
        this._tick();
    }

    _stopAutoRead() {
        clearInterval(this.tickTimer);
        this.tickTimer = null;
        this.nextRunAt = 0;
        this._removeCountdown();
    }

    _tick() {
        if (!this.alive || !this.settings) return;
        const hasFolders = this._selected("autoRead").length > 0;
        this._syncCountdown(hasFolders);
        if (hasFolders && !this.running && Date.now() >= this.nextRunAt) this._doRead();
    }

    async _doRead() {
        if (this.running || !this.settings) return;
        this.running = true;
        let folderHits = 0;
        try {
            this._ensureUser();
            const ids = this._selected("autoRead").map(key => this._parseKey(key));
            if (!ids.length) return;

            const { Folders, ReadState, markRead } = this._mods();
            if (Folders && markRead) {
                const wanted = new Set(ids);
                for (const folder of this._listFolders()) {
                    if (!this.alive) break;
                    if (!wanted.has(folder.id)) continue;
                    const unread = folder.guildIds.filter(id => this._hasUnread(ReadState, id));
                    if (!unread.length) continue;
                    try {
                        markRead(unread, MARK_READ_SOURCE);
                        folderHits++;
                        this._log(`Φάκελος "${folder.name}" → ${unread.length} server(s) διαβάστηκαν`);
                    }
                    catch (e) {
                        this._log(`Σφάλμα στον φάκελο "${folder.name}":`, e.message);
                    }
                    await this._sleep(300);
                }
            }
            else {
                folderHits = await this._readViaMenu(ids);
            }

            if (folderHits > 0) this._queueNotif(folderHits);
            this.settings.lastRun = this._now();
            this._save();
        }
        catch (e) {
            this._log("Read error:", e?.message || e);
        }
        finally {
            this.running = false;
            if (this.settings) this.nextRunAt = Date.now() + this._intervalMs();
        }
    }

    // Fallback when Discord's mark-as-read function could not be found:
    // opens the folder's context menu and clicks "Mark Folder As Read".
    async _readViaMenu(ids) {
        let hits = 0;
        for (const id of ids) {
            if (!this.alive) break;
            const target = document.querySelector(`${NAV_SELECTOR} [data-list-item-id="${KEY_PREFIX}${CSS.escape(id)}"]`);
            if (!target) continue;
            if (await this._markReadViaMenu(target)) hits++;
            await this._sleep(600);
        }
        return hits;
    }

    _markReadViaMenu(target) {
        return new Promise(resolve => {
            let tries = 0;
            const open = () => {
                const rect = target.getBoundingClientRect();
                target.dispatchEvent(new MouseEvent("contextmenu", {
                    bubbles: true, cancelable: true,
                    clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2
                }));
            };
            const poll = () => {
                if (!this.alive) return resolve(false);
                const item = document.getElementById("guild-context-mark-folder-read");
                if (!item) {
                    if (++tries >= 8) return resolve(false);
                    if (tries % 3 === 0) open();
                    return this._later(poll, 250);
                }
                if (item.getAttribute("aria-disabled") === "true") {
                    try { BdApi.ContextMenu?.close?.(); } catch {}
                    return resolve(false);
                }
                item.click();
                resolve(true);
            };
            open();
            this._later(poll, 300);
        });
    }

    // ─────────────────────────────────────────────
    //  COUNTDOWN WIDGET
    // ─────────────────────────────────────────────

    _findNav() {
        if (!this.nav?.isConnected) this.nav = document.querySelector(NAV_SELECTOR);
        return this.nav;
    }

    // Discord can re-create the server list; every tick puts the widget back if it disappeared.
    _syncCountdown(hasFolders) {
        const ar = this.settings.autoRead;
        if (!ar.enabled || !ar.showCountdown || !hasFolders) {
            this._removeCountdown();
            return;
        }
        const nav = this._findNav();
        if (!nav) return;
        if (!this.cdEl || this.cdEl.parentElement !== nav) {
            this._removeCountdown();
            this.cdEl = this._createCountdown();
            nav.appendChild(this.cdEl);
        }
        const secs = Math.max(0, Math.ceil((this.nextRunAt - Date.now()) / 1000));
        const text = this.running ? "…" : `${Math.floor(secs / 60)}'${String(secs % 60).padStart(2, "0")}"`;
        if (this.cdText.textContent !== text) this.cdText.textContent = text;
    }

    _createCountdown() {
        const node = el("div", "fm-cd");
        node.title = "Επόμενο διάβασμα φακέλων · δεξί κλικ για μενού";
        this.cdText = el("b", "fm-cd-text", "--:--");
        const time = el("span", "fm-cd-time");
        time.append(this.cdText);
        node.append(el("span", "fm-cd-label", "next"), el("span", "fm-cd-label", "clear"), time);
        node.addEventListener("contextmenu", e => this._togglePopout(e));
        return node;
    }

    _removeCountdown() {
        if (!this.cdEl) return;
        this.cdEl.remove();
        this.cdEl = null;
        this.cdText = null;
    }

    // ─────────────────────────────────────────────
    //  COUNTDOWN POPOUT (right click)
    // ─────────────────────────────────────────────

    _togglePopout(e) {
        e.preventDefault();
        e.stopPropagation();
        if (this.popout) {
            this._closePopout();
            return;
        }
        const popout = el("div", "fm-popout");
        const rect = this.cdEl ? this.cdEl.getBoundingClientRect() : { right: e.clientX, bottom: e.clientY };
        popout.style.left = `${rect.right + 8}px`;
        popout.style.bottom = `${Math.max(8, window.innerHeight - rect.bottom)}px`;

        const readNow = el("div", "fm-popout-row fm-popout-action");
        readNow.append(el("span", "fm-popout-eye", "⟳"), el("span", "fm-popout-name", "Διάβασμα τώρα"));
        readNow.onclick = () => {
            this._closePopout();
            this._doRead();
        };
        popout.append(readNow, el("div", "fm-popout-title", "Κρύψιμο φακέλων"));

        const folders = this._listFolders();
        const hidden = new Set(this._selected("hideFolders"));
        for (const folder of folders) {
            const row = el("div", "fm-popout-row");
            const eye = el("span", "fm-popout-eye");
            const sync = () => {
                const isHidden = hidden.has(folder.key);
                eye.innerHTML = isHidden ? EYE_OFF_SVG : EYE_SVG;
                eye.style.opacity = isHidden ? "0.35" : "0.8";
                row.style.opacity = isHidden ? "0.55" : "1";
            };
            row.onclick = () => {
                if (hidden.has(folder.key)) hidden.delete(folder.key);
                else hidden.add(folder.key);
                sync();
                this.settings.hideFolders.folderIds = [...hidden].join(", ");
                if (hidden.size) this.settings.hideFolders.enabled = true;
                this._save();
                this._applyHide();
            };
            sync();
            row.append(eye, el("span", "fm-popout-name", folder.name));
            popout.append(row);
        }
        if (!folders.length) popout.append(el("div", "fm-popout-empty", "Δεν βρέθηκαν φάκελοι"));

        document.body.append(popout);
        this.popout = popout;
        const away = ev => {
            if (!popout.contains(ev.target)) this._closePopout();
        };
        const key = ev => {
            if (ev.key === "Escape") this._closePopout();
        };
        this.popoutListeners = { away, key };
        this._later(() => {
            if (this.popout !== popout) return;
            document.addEventListener("mousedown", away, true);
            document.addEventListener("keydown", key, true);
        }, 0);
    }

    _closePopout() {
        this.popout?.remove();
        this.popout = null;
        if (this.popoutListeners) {
            document.removeEventListener("mousedown", this.popoutListeners.away, true);
            document.removeEventListener("keydown", this.popoutListeners.key, true);
            this.popoutListeners = null;
        }
    }

    // ─────────────────────────────────────────────
    //  HIDE FOLDERS (CSS, survives re-renders)
    // ─────────────────────────────────────────────

    _hideCss() {
        const hf = this.settings?.hideFolders;
        if (!hf?.enabled) return "";
        const ids = this._splitIds(hf.folderIds).map(key => this._parseKey(key)).filter(id => /^[\w-]+$/.test(id));
        if (!ids.length) return "";
        // The folder wrapper (data-drop-hovering) holds the folder button and its expanded list.
        // The other two selectors still hide the button and the list if that wrapper changes.
        const selectors = ids.flatMap(id => [
            `${NAV_SELECTOR} [data-drop-hovering]:has([data-list-item-id="${KEY_PREFIX}${id}"])`,
            `${NAV_SELECTOR} [data-dnd-name]:has(> [data-list-item-id="${KEY_PREFIX}${id}"])`,
            `${NAV_SELECTOR} #folder-items-${id}`
        ]);
        return `${selectors.join(",\n")} {\n    display: none !important;\n}\n`;
    }

    _applyHide() {
        const css = this._hideCss();
        if (css) BdApi.DOM.addStyle(`${NAME}-hide`, css);
        else BdApi.DOM.removeStyle(`${NAME}-hide`);
    }

    // ─────────────────────────────────────────────
    //  NOTIFICATIONS
    // ─────────────────────────────────────────────

    _queueNotif(count) {
        this.notifQueue.push(count);
        if (!this.notifBusy) this._drainNotifs();
    }

    _drainNotifs() {
        if (!this.notifQueue.length || this.notifBusy || !this.alive) return;
        this.notifBusy = true;
        const total = this.notifQueue.reduce((a, b) => a + b, 0);
        this.notifQueue = [];
        this._showNotif(total);
        this.notifBusy = false;
    }

    _showNotif(count) {
        const nav = this._findNav();
        if (!nav) return;
        let wrap = nav.querySelector(":scope > .fm-notif-wrap");
        if (!wrap) {
            wrap = el("div", "fm-notif-wrap");
            nav.appendChild(wrap);
        }
        const card = el("div", "fm-notif");
        card.title = `${count} φάκελοι σημειώθηκαν ως αναγνωσμένοι`;
        card.append(el("b", "fm-notif-num", String(count)), el("span", "fm-notif-lbl", "read"));
        wrap.appendChild(card);
        this._later(() => card.classList.add("fm-notif--in"), 10);

        let hideTimer = this._later(() => this._fadeNotif(card), 5000);
        card.addEventListener("mouseenter", () => this._cancel(hideTimer));
        card.addEventListener("mouseleave", () => {
            this._cancel(hideTimer);
            hideTimer = this._later(() => this._fadeNotif(card), 2000);
        });
    }

    _fadeNotif(card) {
        card.classList.remove("fm-notif--in");
        card.classList.add("fm-notif--out");
        this._later(() => {
            const wrap = card.parentElement;
            card.remove();
            if (wrap && !wrap.childElementCount) wrap.remove();
        }, 500);
    }

    // ─────────────────────────────────────────────
    //  SETTINGS PANEL
    // ─────────────────────────────────────────────

    getSettingsPanel() {
        const root = el("div", "fm-panel");
        if (!this.settings) {
            const id = this._currentUserId();
            if (id) this._loadSettings(id);
        }
        else {
            this._ensureUser();
        }
        if (!this.settings) {
            root.append(el("div", "fm-row-sub", "Περίμενε να συνδεθεί ο λογαριασμός και άνοιξε ξανά τις ρυθμίσεις."));
            return root;
        }
        this._renderPanel(root);
        return root;
    }

    _renderPanel(root) {
        root.textContent = "";
        const s = this.settings;
        const folders = this._listFolders();
        const { markRead } = this._mods();
        const rerender = () => this._renderPanel(root);

        // ── AutoReadTrash ──
        root.append(el("div", "fm-section-lbl", "AutoReadTrash"));
        const arCard = el("div", "fm-card");
        arCard.append(settingRow("AutoReadTrash", "Αυτόματο διάβασμα των φακέλων που επιλέγεις", toggle(s.autoRead.enabled, v => {
            s.autoRead.enabled = v;
            this._save();
            if (v) this._startAutoRead(1500);
            else this._stopAutoRead();
        })));

        const interval = el("input", "fm-num-input");
        interval.type = "number";
        interval.min = "5";
        interval.max = "120";
        interval.value = String(s.autoRead.intervalMins);
        interval.onchange = () => {
            const v = Math.min(120, Math.max(5, parseInt(interval.value, 10) || 5));
            interval.value = String(v);
            s.autoRead.intervalMins = v;
            this._save();
            if (this.tickTimer && !this.running) this.nextRunAt = Date.now() + this._intervalMs();
        };
        arCard.append(settingRow("Διάστημα", "Λεπτά (5 – 120)", interval));

        arCard.append(settingRow("Αντίστροφη μέτρηση", "Το countdown κάτω αριστερά στη λίστα των servers", toggle(s.autoRead.showCountdown, v => {
            s.autoRead.showCountdown = v;
            this._save();
            if (this.tickTimer) this._tick();
        })));

        const readNow = el("button", "fm-btn", "Διάβασμα τώρα");
        readNow.onclick = async () => {
            readNow.disabled = true;
            await this._doRead();
            if (readNow.isConnected) rerender();
        };
        arCard.append(settingRow("Τελευταίο διάβασμα", s.lastRun || "—", readNow));

        if (!markRead) {
            arCard.append(settingRow("Λειτουργία συμβατότητας", null, el("span", "fm-warn", "Δεν βρέθηκε το mark-as-read του Discord· χρησιμοποιείται το δεξί κλικ του φακέλου.")));
        }

        const arCount = el("span", "fm-badge");
        arCard.append(settingRow("Φάκελοι για διάβασμα", null, arCount));
        arCard.append(this._folderList(folders, "autoRead", arCount, () => {
            if (this.tickTimer) this._tick();
        }));
        root.append(arCard);

        // ── HideFolders ──
        root.append(el("div", "fm-section-lbl", "HideFolders"));
        const hfCard = el("div", "fm-card");
        hfCard.append(settingRow("HideFolders", "Κρύβει τους φακέλους που επιλέγεις από τη λίστα των servers", toggle(s.hideFolders.enabled, v => {
            s.hideFolders.enabled = v;
            this._save();
            this._applyHide();
        })));
        const hfCount = el("span", "fm-badge");
        hfCard.append(settingRow("Κρυμμένοι φάκελοι", null, hfCount));
        hfCard.append(this._folderList(folders, "hideFolders", hfCount, () => this._applyHide()));
        root.append(hfCard);

        root.append(el("div", "fm-footer", "Οι ενημερώσεις του plugin γίνονται αυτόματα από το UpdateAllMyPlugins."));
    }

    _folderList(folders, section, counter, onChange) {
        const list = el("div", "fm-folder-list");
        const selected = new Set(this._selected(section));
        const known = new Set(folders.map(f => f.key));
        const updateCounter = () => {
            const n = [...selected].filter(key => known.has(key)).length;
            counter.textContent = n ? `${n} επιλεγμέν${n > 1 ? "οι" : "ος"}` : "κανένας";
        };
        updateCounter();

        if (!folders.length) {
            list.append(el("div", "fm-picker-empty", "Δεν βρέθηκαν φάκελοι στη λίστα των servers"));
            return list;
        }
        for (const folder of folders) {
            const row = el("div", "fm-picker-row");
            const icon = el("div", "fm-picker-icon");
            icon.style.background = folder.color;
            icon.append(svgIcon(FOLDER_SVG));
            const check = el("div", "fm-picker-check");
            const sync = () => {
                const on = selected.has(folder.key);
                row.classList.toggle("fm-picker-row--sel", on);
                check.classList.toggle("fm-picker-check--on", on);
                check.textContent = on ? "✓" : "";
            };
            row.onclick = () => {
                if (selected.has(folder.key)) selected.delete(folder.key);
                else selected.add(folder.key);
                sync();
                updateCounter();
                this.settings[section].folderIds = [...selected].join(", ");
                this._save();
                onChange?.();
            };
            sync();
            const meta = folder.guildIds.length ? `${folder.guildIds.length} servers` : "";
            row.append(icon, el("div", "fm-picker-name", folder.name), el("div", "fm-picker-meta", meta), check);
            list.append(row);
        }
        return list;
    }

    // ─────────────────────────────────────────────
    //  UTILS
    // ─────────────────────────────────────────────

    _splitIds(str) {
        return String(str || "").split(",").map(s => s.trim()).filter(Boolean);
    }

    _parseKey(key) {
        return key.startsWith(KEY_PREFIX) ? key.slice(KEY_PREFIX.length) : key;
    }

    _now() {
        return new Date().toLocaleString("el-GR", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit", second: "2-digit",
            hour12: false
        });
    }

    _later(fn, ms) {
        const id = setTimeout(() => {
            this.timers.delete(id);
            if (this.alive) fn();
        }, ms);
        this.timers.add(id);
        return id;
    }

    _cancel(id) {
        clearTimeout(id);
        this.timers.delete(id);
    }

    // Resolves only while the plugin is running; after stop() pending work just ends.
    _sleep(ms) {
        return new Promise(resolve => this._later(resolve, ms));
    }

    _log(...args) {
        console.log(
            "%c[FolderManager]%c " + args.join(" "),
            "background:#5865f2;color:#fff;padding:2px 6px;border-radius:4px 0 0 4px;font-weight:700",
            "background:#2c2d33;color:#fff;padding:2px 6px;border-radius:0 4px 4px 0;"
        );
    }
};
