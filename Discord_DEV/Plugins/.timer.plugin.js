/**
 * @name Timer
 * @version 2.1.0
 * @description Δείχνει την τρέχουσα ώρα στη μπάρα τίτλου του Discord, με dark εμφάνιση. Ρυθμίσεις (24ωρη μορφή, δευτερόλεπτα) από το γρανάζι του plugin.
 * @author ThomasT
 * @authorId 706932839907852389
 * @source https://github.com/thomasthanos/1st-theme/blob/main/Discord_DEV/Plugins/.timer.plugin.js
 * @updateUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/.timer.plugin.js
 * @website https://github.com/thomasthanos
 */

"use strict";

const NAME = "Timer";
const CLOCK_ID = "realtime-clock";
const DEFAULTS = { enabled: true, use24h: true, showSeconds: true };

const STYLES = `
#${CLOCK_ID} {
    margin-left: 10px;
    padding: 4px 12px;
    border-radius: 8px;
    background: rgba(30, 31, 34, 0.8);
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #dbdee1;
    font-size: 12px;
    font-weight: 600;
    font-family: Consolas, monospace;
    font-variant-numeric: tabular-nums;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    user-select: none;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    -webkit-app-region: no-drag;
}
`;

module.exports = class Timer {
    constructor() {
        this.settings = { ...DEFAULTS };
        this.clock = null;
        this.tick = null;
        this.titleClass = null;
        this.missingLogged = false;
    }

    start() {
        this.settings = { ...DEFAULTS, ...(BdApi.Data.load(NAME, "settings") || {}) };
        this.titleClass = this.findTitleClass();
        BdApi.DOM.addStyle(NAME, STYLES);
        if (this.settings.enabled) this.startClock();
    }

    stop() {
        this.stopClock();
        BdApi.DOM.removeStyle(NAME);
    }

    startClock() {
        this.stopClock();
        this.update();
        this.tick = setInterval(() => this.update(), 1000);
    }

    stopClock() {
        clearInterval(this.tick);
        this.tick = null;
        this.clock?.remove();
        this.clock = null;
        // Also clears a clock left behind by an older version of the plugin.
        document.getElementById(CLOCK_ID)?.remove();
    }

    // The title bar is re-rendered by Discord (navigation, window changes), so every tick
    // makes sure the clock is still in the current title area before updating the text.
    update() {
        const title = this.findTitleArea();
        if (!title) {
            if (!this.missingLogged) {
                this.missingLogged = true;
                console.warn(`[${NAME}] Δεν βρέθηκε η μπάρα τίτλου ακόμα, θα ξαναδοκιμάσει`);
            }
            return;
        }
        if (!this.clock) {
            this.clock = document.createElement("span");
            this.clock.id = CLOCK_ID;
        }
        if (this.clock.parentElement !== title || title.lastElementChild !== this.clock) {
            title.appendChild(this.clock);
        }
        const now = new Date();
        const text = this.format(now);
        if (this.clock.textContent !== text) this.clock.textContent = text;
        const tooltip = now.toLocaleDateString("el-GR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
        if (this.clock.title !== tooltip) this.clock.title = tooltip;
    }

    format(now) {
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, "0");
        const seconds = String(now.getSeconds()).padStart(2, "0");
        if (!this.settings.use24h) hours = hours % 12 || 12;
        let text = `${String(hours).padStart(2, "0")}:${minutes}`;
        if (this.settings.showSeconds) text += `:${seconds}`;
        if (!this.settings.use24h) text += now.getHours() >= 12 ? " PM" : " AM";
        return text;
    }

    // Discord's window chrome is <div data-window-chrome="true"> with three children:
    // leading, title and trailing. The attribute is not a generated class, so it survives updates.
    findTitleArea() {
        const bar = document.querySelector('[data-window-chrome="true"]');
        if (bar) {
            if (this.titleClass) {
                const byClass = bar.querySelector(`:scope > .${CSS.escape(this.titleClass)}`);
                if (byClass) return byClass;
            }
            if (bar.children.length === 3) return bar.children[1];
        }
        if (this.titleClass) {
            const byClass = document.querySelector(`.${CSS.escape(this.titleClass)}`);
            if (byClass) return byClass;
        }
        return null;
    }

    // The title bar's CSS module has entries like bar_xxxx, title_xxxx and winButtons_xxxx.
    // Looking it up by those prefixes finds the current hash after every Discord update.
    findTitleClass() {
        try {
            const classes = BdApi.Webpack.getModule(m => {
                if (!m || typeof m !== "object") return false;
                const values = Object.values(m);
                if (values.length > 60) return false;
                const has = prefix => values.some(v => typeof v === "string" && v.startsWith(prefix));
                return has("winButtons_") && has("title_") && has("bar_") && has("trailing_");
            });
            const value = classes && Object.values(classes).find(v => typeof v === "string" && v.startsWith("title_"));
            return value ? value.split(" ")[0] : null;
        }
        catch {
            return null;
        }
    }

    saveSettings() {
        BdApi.Data.save(NAME, "settings", this.settings);
    }

    getSettingsPanel() {
        const set = (key, value) => {
            this.settings[key] = value;
            this.saveSettings();
            if (key === "enabled") {
                if (value) this.startClock();
                else this.stopClock();
            }
            else if (this.settings.enabled) {
                this.update();
            }
        };
        return BdApi.UI.buildSettingsPanel({
            settings: [
                { type: "switch", id: "enabled", name: "Εμφάνιση ρολογιού", note: "Το ρολόι μπαίνει δίπλα στον τίτλο, στη μπάρα στην κορυφή του Discord.", value: this.settings.enabled, onChange: v => set("enabled", v) },
                { type: "switch", id: "use24h", name: "24ωρη μορφή", note: "Αν το κλείσεις, η ώρα εμφανίζεται ως 12ωρη με AM/PM.", value: this.settings.use24h, onChange: v => set("use24h", v) },
                { type: "switch", id: "showSeconds", name: "Δευτερόλεπτα", value: this.settings.showSeconds, onChange: v => set("showSeconds", v) }
            ]
        });
    }
};
