/**
 * @name UpdateAllMyPlugins
 * @version 3.0.0
 * @description Βρίσκει μόνο του όλα τα plugins του ThomasT που έχεις εγκατεστημένα και τα κρατάει ενημερωμένα από το GitHub: αυτόματος έλεγχος, έλεγχος εγκυρότητας πριν την εγκατάσταση και backup της προηγούμενης έκδοσης.
 * @author ThomasT
 * @authorId 706932839907852389
 * @source https://github.com/thomasthanos/1st-theme/blob/main/Discord_DEV/Plugins/.allinone_update.plugin.js
 * @updateUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/.allinone_update.plugin.js
 * @website https://github.com/thomasthanos
 */

"use strict";

const NAME = "UpdateAllMyPlugins";
const AUTHOR_ID = "706932839907852389";
// Only files served from the author's GitHub account are ever installed.
const TRUSTED_URL = /^https:\/\/raw\.githubusercontent\.com\/thomasthanos\/[^?#\s]+\.plugin\.js$/i;
// Older releases declared a wrong @updateUrl; these are tried when the declared one fails.
const FALLBACK_URLS = {
    Timer: "https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/.timer.plugin.js"
};
const DEFAULTS = {
    autoCheck: true,
    autoInstall: true,
    intervalHours: 6,
    notify: true,
    keepBackup: true,
    lastCheck: 0
};
const STARTUP_DELAY_MS = 15000;
const RECENT_CHECK_MS = 10 * 60 * 1000;
const PANEL_RECHECK_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 20000;
const BACKUP_DIR = ".update-backups";

const STATUS_TEXT = {
    idle: "Αναμονή ελέγχου",
    checking: "Έλεγχος…",
    current: "✓ Ενημερωμένο",
    installing: "Εγκατάσταση…"
};

const STYLES = `
.uamp-panel { display: flex; flex-direction: column; gap: 10px; width: 100%; }
.uamp-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.uamp-summary { flex: 1; min-width: 200px; color: var(--text-muted, #949ba4); font-size: 13px; line-height: 18px; }
.uamp-list { display: flex; flex-direction: column; border-radius: 8px; overflow: hidden; background: var(--background-secondary, rgba(0, 0, 0, 0.15)); }
.uamp-row { display: grid; grid-template-columns: minmax(120px, 1.2fr) minmax(90px, 0.9fr) minmax(130px, 1.7fr) auto; align-items: center; gap: 10px; padding: 9px 12px; border-top: 1px solid var(--background-modifier-accent, rgba(255, 255, 255, 0.06)); color: var(--text-normal, #dbdee1); font-size: 14px; }
.uamp-row:first-child { border-top: none; }
.uamp-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.uamp-tag { margin-left: 6px; padding: 1px 6px; border-radius: 4px; font-size: 11px; font-weight: 500; color: var(--text-muted, #949ba4); background: var(--background-modifier-accent, rgba(255, 255, 255, 0.08)); }
.uamp-version { font-family: var(--font-code, Consolas, monospace); font-size: 12.5px; color: var(--text-muted, #949ba4); white-space: nowrap; }
.uamp-status { font-size: 13px; overflow-wrap: anywhere; }
.uamp-current .uamp-status, .uamp-updated .uamp-status { color: var(--status-positive, #23a55a); }
.uamp-available .uamp-status { color: var(--status-warning, #f0b232); font-weight: 600; }
.uamp-error .uamp-status { color: var(--status-danger, #f23f43); }
.uamp-ahead .uamp-status { color: var(--text-link, #00a8fc); }
.uamp-empty { padding: 12px; color: var(--text-muted, #949ba4); font-size: 14px; }
.uamp-button { white-space: nowrap; }
`;

function stripBom(text) {
    return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

function parseMeta(source) {
    const match = /^\s*\/\*\*([\s\S]*?)\*\//.exec(stripBom(source));
    if (!match) return null;
    const meta = {};
    for (const line of match[1].split(/\r?\n/)) {
        const field = /^\s*\*?\s*@([A-Za-z]+)\s+(.+?)\s*$/.exec(line);
        if (field && !(field[1] in meta)) meta[field[1]] = field[2];
    }
    return meta;
}

// "2.0,0" (an old typo) and "v1.2.3-beta" both parse; missing parts count as 0.
function versionParts(version) {
    return String(version ?? "")
        .trim()
        .replace(/^v/i, "")
        .split(/[-+\s]/)[0]
        .split(/[.,_]/)
        .map(part => parseInt(part, 10))
        .map(n => (Number.isFinite(n) ? n : 0));
}

function compareVersions(a, b) {
    const x = versionParts(a);
    const y = versionParts(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
        const diff = (x[i] || 0) - (y[i] || 0);
        if (diff) return diff > 0 ? 1 : -1;
    }
    return 0;
}

function inspectRemote(code, expectedName) {
    if (typeof code !== "string" || code.length < 64) throw new Error("το αρχείο στο GitHub είναι άδειο");
    if (code.length > 5 * 1024 * 1024) throw new Error("το αρχείο στο GitHub είναι υπερβολικά μεγάλο");
    const source = stripBom(code);
    if (/^\s*</.test(source)) throw new Error("ήρθε σελίδα HTML αντί για plugin");
    const meta = parseMeta(source);
    if (!meta?.name || !meta?.version) throw new Error("λείπει το @name ή το @version");
    if (meta.name !== expectedName) throw new Error(`το URL δίνει άλλο plugin (${meta.name})`);
    try {
        // Same wrapper BetterDiscord uses to load plugins; this only compiles, nothing runs.
        new Function("require", "module", "exports", "__filename", "__dirname", source);
    }
    catch (err) {
        throw new Error(`συντακτικό σφάλμα στη νέα έκδοση: ${err.message}`);
    }
    return { meta, source };
}

function httpGet(url, signal) {
    if (typeof BdApi.Net?.fetch === "function") {
        return BdApi.Net.fetch(url, { timeout: FETCH_TIMEOUT_MS, signal, headers: { "Cache-Control": "no-cache" } });
    }
    return fetch(url, { cache: "no-store", signal });
}

function relativeTime(ms) {
    const abs = Math.abs(ms);
    const future = ms > 0;
    const units = [[86400000, "μέρα", "μέρες"], [3600000, "ώρα", "ώρες"], [60000, "λεπτό", "λεπτά"]];
    for (const [size, one, many] of units) {
        if (abs < size) continue;
        const n = Math.round(abs / size);
        const word = n === 1 ? one : many;
        return future ? `σε ${n} ${word}` : `πριν από ${n} ${word}`;
    }
    return future ? "σε λίγο" : "μόλις τώρα";
}

function statusText(entry) {
    switch (entry.status) {
        case "available": return `Νέα έκδοση ${entry.remoteVersion}`;
        case "ahead": return `Τοπική έκδοση νεότερη (GitHub: ${entry.remoteVersion})`;
        case "updated": return `✓ Ενημερώθηκε (από ${entry.previousVersion})`;
        case "error": return `✕ ${entry.error}`;
        default: return STATUS_TEXT[entry.status] || entry.status;
    }
}

function PanelButton({ onClick, disabled, color = "brand", children }) {
    const h = BdApi.React.createElement;
    return h("button", {
        type: "button",
        disabled,
        onClick,
        className: `bd-button bd-button-filled bd-button-color-${color} bd-button-small uamp-button${disabled ? " bd-button-disabled" : ""}`
    }, h("div", { className: "bd-button-content" }, children));
}

function StatusRow({ entry, plugin, busy }) {
    const h = BdApi.React.createElement;
    const version = entry.status === "available" ? `${entry.localVersion} → ${entry.remoteVersion}` : entry.localVersion;
    return h("div", { className: `uamp-row uamp-${entry.status}` },
        h("div", { className: "uamp-name", title: entry.filename },
            entry.name,
            entry.enabled === false ? h("span", { className: "uamp-tag" }, "ανενεργό") : null),
        h("div", { className: "uamp-version" }, version),
        h("div", { className: "uamp-status", title: entry.error || "" }, statusText(entry)),
        entry.status === "available"
            ? h(PanelButton, { color: "green", disabled: busy, onClick: () => plugin.installEntries([entry], "manual") }, "Ενημέρωση")
            : h("span")
    );
}

function StatusPanel({ plugin }) {
    const React = BdApi.React;
    const h = React.createElement;
    const [, rerender] = React.useReducer(n => n + 1, 0);
    React.useEffect(() => plugin.subscribe(rerender), [plugin]);
    // Keeps the "πριν από / σε" times fresh while the panel is open.
    React.useEffect(() => {
        const id = setInterval(rerender, 30000);
        return () => clearInterval(id);
    }, []);

    const entries = [...plugin.entries.values()];
    const available = entries.filter(e => e.status === "available");
    const busy = Boolean(plugin.checking) || plugin.installing;

    return h("div", { className: "uamp-panel" },
        h("div", { className: "uamp-toolbar" },
            h("div", { className: "uamp-summary" }, plugin.summaryText()),
            h(PanelButton, { disabled: busy, onClick: () => plugin.checkAll({ reason: "manual" }) }, plugin.checking ? "Έλεγχος…" : "Έλεγχος τώρα"),
            available.length
                ? h(PanelButton, { color: "green", disabled: busy, onClick: () => plugin.installEntries(available, "manual") }, `Ενημέρωση όλων (${available.length})`)
                : null
        ),
        entries.length
            ? h("div", { className: "uamp-list" }, entries.map(entry => h(StatusRow, { key: entry.name, entry, plugin, busy })))
            : h("div", { className: "uamp-empty" }, "Δεν βρέθηκαν εγκατεστημένα plugins του ThomasT με @updateUrl.")
    );
}

module.exports = class UpdateAllMyPlugins {
    constructor(meta) {
        this.meta = meta;
        this.entries = new Map();
        this.listeners = new Set();
        this.timers = new Set();
        this.settings = { ...DEFAULTS };
        this.checking = null;
        this.installing = false;
        this.running = false;
        this.nextTimer = null;
        this.nextAt = 0;
        this.abortController = null;
        this.notice = null;
    }

    start() {
        this.running = true;
        this.settings = this.loadSettings();
        BdApi.DOM.addStyle(NAME, STYLES);
        this.refreshEntries();
        const sinceLast = Date.now() - (this.settings.lastCheck || 0);
        // A reload right after an update (including a self-update) should not re-check at once.
        this.scheduleNext(Math.max(STARTUP_DELAY_MS, RECENT_CHECK_MS - sinceLast));
        this.log(`Ενεργό · παρακολουθεί ${this.entries.size} plugins: ${[...this.entries.keys()].join(", ") || "-"}`);
    }

    stop() {
        this.running = false;
        for (const id of this.timers) clearTimeout(id);
        this.timers.clear();
        this.nextTimer = null;
        this.nextAt = 0;
        this.abortController?.abort();
        this.abortController = null;
        try { this.notice?.close?.(); } catch {}
        this.notice = null;
        BdApi.DOM.removeStyle(NAME);
        this.listeners.clear();
    }

    // ── settings ──────────────────────────────────────────────

    loadSettings() {
        const saved = BdApi.Data.load(NAME, "settings");
        const settings = { ...DEFAULTS, ...(saved && typeof saved === "object" ? saved : {}) };
        if (![1, 3, 6, 12, 24].includes(settings.intervalHours)) settings.intervalHours = DEFAULTS.intervalHours;
        return settings;
    }

    saveSettings() {
        BdApi.Data.save(NAME, "settings", this.settings);
    }

    setSetting(key, value) {
        this.settings[key] = value;
        this.saveSettings();
        if (key === "autoCheck" || key === "intervalHours") {
            const sinceLast = Date.now() - (this.settings.lastCheck || 0);
            const interval = this.settings.intervalHours * 3600000;
            this.scheduleNext(Math.max(STARTUP_DELAY_MS, interval - sinceLast));
        }
        this.emit();
    }

    // ── timers and change notifications ───────────────────────

    later(fn, ms) {
        const id = setTimeout(() => {
            this.timers.delete(id);
            if (this.running) fn();
        }, ms);
        this.timers.add(id);
        return id;
    }

    scheduleNext(delay) {
        if (this.nextTimer) {
            clearTimeout(this.nextTimer);
            this.timers.delete(this.nextTimer);
        }
        this.nextTimer = null;
        this.nextAt = 0;
        if (!this.running || !this.settings.autoCheck) return;
        this.nextAt = Date.now() + delay;
        this.nextTimer = this.later(() => {
            this.nextTimer = null;
            this.checkAll({ reason: "auto" });
        }, delay);
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    emit() {
        for (const listener of this.listeners) {
            try { listener(); } catch {}
        }
    }

    // ── discovery ─────────────────────────────────────────────

    managedPlugins() {
        let all = [];
        try { all = BdApi.Plugins.getAll(); } catch {}
        return all
            .filter(addon => addon
                && typeof addon.updateUrl === "string"
                && TRUSTED_URL.test(addon.updateUrl.trim())
                && (addon.authorId === AUTHOR_ID || String(addon.author || "").trim().toLowerCase() === "thomast"))
            .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }

    refreshEntries() {
        const seen = new Set();
        for (const addon of this.managedPlugins()) {
            seen.add(addon.name);
            const entry = this.entries.get(addon.name) || { name: addon.name, status: "idle", remoteVersion: null, error: null, source: null };
            entry.localVersion = addon.version;
            entry.filename = addon.filename;
            entry.updateUrl = addon.updateUrl.trim();
            try { entry.enabled = BdApi.Plugins.isEnabled(addon.name); } catch { entry.enabled = true; }
            // Updated some other way since the last check.
            if (entry.status === "available" && compareVersions(entry.remoteVersion, addon.version) <= 0) {
                entry.status = "current";
                entry.source = null;
            }
            this.entries.set(addon.name, entry);
        }
        for (const name of [...this.entries.keys()]) {
            if (!seen.has(name)) this.entries.delete(name);
        }
    }

    summaryText() {
        const parts = [];
        const last = this.settings.lastCheck;
        parts.push(last ? `Τελευταίος έλεγχος: ${relativeTime(last - Date.now())}` : "Δεν έχει γίνει έλεγχος ακόμα");
        if (!this.settings.autoCheck) parts.push("αυτόματος έλεγχος ανενεργός");
        else if (this.nextAt) parts.push(`επόμενος ${relativeTime(Math.max(0, this.nextAt - Date.now()))}`);
        if (this.installing) parts.push("εγκατάσταση σε εξέλιξη…");
        return parts.join(" · ");
    }

    // ── checking ──────────────────────────────────────────────

    checkAll({ reason = "manual", install = false } = {}) {
        if (!this.running) return Promise.resolve();
        if (this.checking) return this.checking;
        this.checking = this.runCheck(reason, install)
            .catch(err => this.warn("Ο έλεγχος απέτυχε:", err))
            .finally(() => {
                this.checking = null;
                this.emit();
            });
        this.emit();
        return this.checking;
    }

    async runCheck(reason, install) {
        this.refreshEntries();
        const entries = [...this.entries.values()];
        this.abortController = new AbortController();
        const { signal } = this.abortController;
        await Promise.all(entries.map(entry => this.checkEntry(entry, signal)));
        if (!this.running) return;

        this.settings.lastCheck = Date.now();
        this.saveSettings();
        const available = entries.filter(e => e.status === "available");
        const failed = entries.filter(e => e.status === "error");
        this.log(`Έλεγχος (${reason}): ${entries.length} plugins · ${available.length} ενημερώσεις · ${failed.length} σφάλματα`);

        if (available.length && (install || this.settings.autoInstall)) {
            await this.installEntries(available, reason);
        }
        else if (available.length && reason === "auto") {
            this.announceAvailable(available);
        }
        else if (reason === "manual") {
            const parts = [];
            if (available.length) parts.push(available.length === 1 ? "1 νέα έκδοση διαθέσιμη" : `${available.length} νέες εκδόσεις διαθέσιμες`);
            if (failed.length) parts.push(failed.length === 1 ? "1 σφάλμα (δες τη λίστα)" : `${failed.length} σφάλματα (δες τη λίστα)`);
            if (!parts.length) parts.push("Όλα τα plugins είναι ενημερωμένα");
            BdApi.UI.showToast(parts.join(" · "), { type: failed.length ? "warning" : available.length ? "info" : "success" });
        }
        if (this.running) this.scheduleNext(this.settings.intervalHours * 3600000);
    }

    async checkEntry(entry, signal) {
        entry.status = "checking";
        entry.error = null;
        this.emit();
        try {
            const code = await this.download(entry, signal);
            const { meta, source } = inspectRemote(code, entry.name);
            entry.remoteVersion = meta.version;
            const cmp = compareVersions(meta.version, entry.localVersion);
            entry.status = cmp > 0 ? "available" : cmp < 0 ? "ahead" : "current";
            entry.source = cmp > 0 ? source : null;
        }
        catch (err) {
            entry.status = "error";
            entry.error = signal.aborted ? "ακυρώθηκε" : (err?.message || String(err));
            entry.source = null;
            if (this.running) this.warn(`${entry.name}: ${entry.error}`);
        }
        this.emit();
    }

    async download(entry, signal) {
        const urls = [entry.updateUrl];
        const fallback = FALLBACK_URLS[entry.name];
        if (fallback && fallback !== entry.updateUrl) urls.push(fallback);
        let lastError = null;
        for (const url of urls) {
            try {
                const response = await httpGet(`${url}?t=${Date.now()}`, signal);
                if (!response.ok) {
                    throw new Error(response.status === 404 ? "δεν βρέθηκε στο GitHub (404)" : `το GitHub απάντησε HTTP ${response.status}`);
                }
                return await response.text();
            }
            catch (err) {
                lastError = err;
                if (signal.aborted) break;
            }
        }
        throw lastError || new Error("αποτυχία λήψης");
    }

    // ── installing ────────────────────────────────────────────

    async installEntries(list, reason) {
        if (!this.running || this.installing) return;
        const pending = list.filter(entry => entry.status === "available" && entry.source);
        if (!pending.length) return;
        this.installing = true;
        this.emit();
        try { this.notice?.close?.(); } catch {}
        this.notice = null;

        const done = [];
        const failed = [];
        // The updater replaces itself last: writing its own file makes BetterDiscord restart it.
        const self = pending.find(entry => entry.name === NAME);
        const ordered = pending.filter(entry => entry !== self);
        if (self) ordered.push(self);
        try {
            for (const entry of ordered) {
                if (!this.running) break;
                try {
                    if (entry === self) {
                        this.settings.lastCheck = Date.now();
                        this.saveSettings();
                    }
                    this.installEntry(entry);
                    done.push(entry);
                }
                catch (err) {
                    entry.status = "error";
                    entry.error = `η εγκατάσταση απέτυχε: ${err.message}`;
                    failed.push(entry);
                    this.warn(`${entry.name}: ${entry.error}`);
                    this.emit();
                }
            }
        }
        finally {
            this.installing = false;
            this.emit();
        }
        this.announceInstalled(done, failed, reason);
    }

    installEntry(entry) {
        const source = entry.source;
        if (!source) throw new Error("δεν υπάρχει κατεβασμένη έκδοση");
        const current = BdApi.Plugins.get(entry.name);
        if (!current) throw new Error("το plugin δεν είναι πια εγκατεστημένο");

        const fs = require("fs");
        const path = require("path");
        const folder = BdApi.Plugins.folder;
        const filename = path.basename(String(current.filename || entry.filename || ""));
        if (!filename.endsWith(".plugin.js")) throw new Error(`άκυρο όνομα αρχείου (${filename})`);
        const target = path.join(folder, filename);

        entry.status = "installing";
        this.emit();

        if (this.settings.keepBackup && fs.existsSync(target)) {
            try {
                const dir = path.join(folder, BACKUP_DIR);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir);
                fs.writeFileSync(path.join(dir, `${filename}.bak`), fs.readFileSync(target, "utf8"), "utf8");
            }
            catch (err) {
                this.warn(`${entry.name}: το backup απέτυχε (${err.message}), η ενημέρωση συνεχίζει`);
            }
        }

        // Write next to the target and rename over it, so BetterDiscord never reads half a file.
        // The temporary name does not end in .plugin.js, so BetterDiscord ignores it.
        const temp = `${target}.download`;
        fs.writeFileSync(temp, source, "utf8");
        try {
            fs.renameSync(temp, target);
        }
        catch {
            fs.writeFileSync(target, source, "utf8");
            try { fs.unlinkSync(temp); } catch {}
        }

        entry.previousVersion = entry.localVersion;
        entry.localVersion = entry.remoteVersion;
        entry.status = "updated";
        entry.source = null;
        this.log(`${entry.name}: ${entry.previousVersion} → ${entry.localVersion}`);
        this.emit();
        if (entry.name !== NAME) this.later(() => this.ensureReloaded(entry), 3000);
    }

    // BetterDiscord watches the plugins folder and reloads changed files itself.
    // This only steps in when that did not happen.
    ensureReloaded(entry) {
        const addon = BdApi.Plugins.get(entry.name);
        if (!addon || compareVersions(addon.version, entry.localVersion) >= 0) return;
        this.warn(`${entry.name}: δεν ξαναφορτώθηκε αυτόματα, γίνεται reload`);
        try { BdApi.Plugins.reload(entry.name); }
        catch (err) { this.warn(`${entry.name}: το reload απέτυχε`, err); }
    }

    // ── notifications ─────────────────────────────────────────

    notify(options, fallbackText) {
        try {
            const handle = BdApi.UI.showNotification?.(options);
            if (handle) return handle;
        }
        catch {}
        const type = ["success", "warning", "error"].includes(options.type) ? options.type : "info";
        BdApi.UI.showToast(fallbackText || options.title, { type, timeout: 7000 });
        return null;
    }

    lines(texts) {
        const h = BdApi.React.createElement;
        return texts.map((text, i) => h("div", { key: i }, text));
    }

    announceAvailable(list) {
        if (!this.settings.notify) return;
        this.notice = this.notify({
            id: `${NAME}-available`,
            title: list.length === 1 ? "Νέα έκδοση plugin" : `${list.length} νέες εκδόσεις plugins`,
            content: this.lines(list.map(e => `${e.name}: ${e.localVersion} → ${e.remoteVersion}`)),
            type: "info",
            duration: Infinity,
            actions: [{ label: "Ενημέρωση", onClick: () => this.installEntries(list, "notification") }]
        }, `${list.length} ενημερώσεις plugins διαθέσιμες (ρυθμίσεις ${NAME})`);
    }

    announceInstalled(done, failed, reason) {
        if (!done.length && !failed.length) return;
        const texts = done.map(e => `${e.name}: ${e.previousVersion} → ${e.localVersion}`);
        for (const e of failed) texts.push(`${e.name}: ${e.error}`);
        if (!this.settings.notify && reason === "auto" && !failed.length) return;
        this.notify({
            id: `${NAME}-installed`,
            title: done.length ? (done.length === 1 ? "Ενημερώθηκε 1 plugin" : `Ενημερώθηκαν ${done.length} plugins`) : "Η ενημέρωση απέτυχε",
            content: this.lines(texts),
            type: failed.length ? "warning" : "success",
            duration: 10000
        }, texts.join(" · "));
    }

    // ── settings panel ────────────────────────────────────────

    getSettingsPanel() {
        this.refreshEntries();
        if (this.running && !this.checking && Date.now() - (this.settings.lastCheck || 0) > PANEL_RECHECK_MS) {
            this.checkAll({ reason: "panel" });
        }
        const h = BdApi.React.createElement;
        const s = this.settings;
        return BdApi.UI.buildSettingsPanel({
            settings: [
                {
                    type: "custom",
                    id: "status",
                    name: "Plugins",
                    note: "Βρίσκονται αυτόματα: κάθε εγκατεστημένο plugin του ThomasT με @updateUrl από το GitHub του.",
                    inline: false,
                    children: h(StatusPanel, { plugin: this })
                },
                {
                    type: "switch",
                    id: "autoCheck",
                    name: "Αυτόματος έλεγχος",
                    note: "Ελέγχει στην εκκίνηση του Discord και μετά ανά τακτά διαστήματα.",
                    value: s.autoCheck,
                    onChange: value => this.setSetting("autoCheck", value)
                },
                {
                    type: "dropdown",
                    id: "intervalHours",
                    name: "Συχνότητα ελέγχου",
                    value: s.intervalHours,
                    options: [
                        { label: "Κάθε 1 ώρα", value: 1 },
                        { label: "Κάθε 3 ώρες", value: 3 },
                        { label: "Κάθε 6 ώρες", value: 6 },
                        { label: "Κάθε 12 ώρες", value: 12 },
                        { label: "Μία φορά τη μέρα", value: 24 }
                    ],
                    onChange: value => this.setSetting("intervalHours", Number(value))
                },
                {
                    type: "switch",
                    id: "autoInstall",
                    name: "Αυτόματη εγκατάσταση",
                    note: "Οι νέες εκδόσεις μπαίνουν μόνες τους, αφού ελεγχθεί ότι το αρχείο είναι έγκυρο plugin. Αν το κλείσεις, θα σου εμφανίζεται ειδοποίηση με κουμπί «Ενημέρωση».",
                    value: s.autoInstall,
                    onChange: value => this.setSetting("autoInstall", value)
                },
                {
                    type: "switch",
                    id: "notify",
                    name: "Ειδοποιήσεις",
                    note: "Ειδοποίηση όταν βρεθούν ή εγκατασταθούν νέες εκδόσεις.",
                    value: s.notify,
                    onChange: value => this.setSetting("notify", value)
                },
                {
                    type: "switch",
                    id: "keepBackup",
                    name: "Backup της προηγούμενης έκδοσης",
                    note: `Πριν από κάθε ενημέρωση κρατάει το παλιό αρχείο στον φάκελο plugins/${BACKUP_DIR}.`,
                    value: s.keepBackup,
                    onChange: value => this.setSetting("keepBackup", value)
                }
            ]
        });
    }

    // ── logging ───────────────────────────────────────────────

    log(...args) {
        console.log(`%c[${NAME}]`, "color: #00c8a0; font-weight: 700;", ...args);
    }

    warn(...args) {
        console.warn(`%c[${NAME}]`, "color: #00c8a0; font-weight: 700;", ...args);
    }
};
