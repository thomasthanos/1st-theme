/**
 * @name OfflineGrey
 * @version 1.0.0
 * @description Δείχνει γκρι τα ονόματα των offline μελών στη λίστα μελών, σε όλους τους servers, αντί για το χρώμα του ρόλου τους. Το χρώμα και η ένταση αλλάζουν από τις ρυθμίσεις.
 * @author ThomasT
 * @authorId 706932839907852389
 * @source https://github.com/thomasthanos/1st-theme/blob/main/Discord_DEV/Plugins/.OfflineGrey.plugin.js
 * @updateUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/.OfflineGrey.plugin.js
 * @website https://github.com/thomasthanos
 */

"use strict";

const NAME = "OfflineGrey";
const DEFAULTS = {
    color: "#7A7E85",
    opacity: 30
};
// Discord's member list: every offline member's row keeps the class "offline__xxxxx".
const MEMBER_LIST = '[data-list-id^="members"]';
const NAME_PARTS = ['[class*="username"]', '[class*="nameContainer"]', '[class*="name__"]'];

function toHex(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return "#" + ((value >>> 0) & 0xFFFFFF).toString(16).padStart(6, "0");
    }
    const text = String(value ?? "").trim();
    if (/^#[0-9a-f]{6}$/i.test(text)) return text;
    if (/^#[0-9a-f]{3}$/i.test(text)) return "#" + text.slice(1).split("").map(part => part + part).join("");
    if (/^[0-9a-f]{6}$/i.test(text)) return "#" + text;
    return DEFAULTS.color;
}

function clamp(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.min(max, Math.max(min, Math.round(number)));
}

// Pure CSS: no observers, no DOM edits. Discord adds and removes the offline class itself,
// so names follow every status change on their own.
function buildCss(settings) {
    const color = toHex(settings.color);
    const opacity = clamp(settings.opacity, 10, 100) / 100;
    const names = NAME_PARTS.map(part => `${MEMBER_LIST} [class*="offline"] ${part}`).join(",\n");
    return `
${names} {
    color: ${color} !important;
}

${MEMBER_LIST} [class*="member__"][class*="offline"] {
    opacity: ${opacity} !important;
}
`;
}

module.exports = class OfflineGrey {
    constructor() {
        this.settings = { ...DEFAULTS };
    }

    start() {
        const saved = BdApi.Data.load(NAME, "settings");
        this.settings = { ...DEFAULTS, ...(saved && typeof saved === "object" ? saved : {}) };
        this.apply();
        console.log(`%c[${NAME}]`, "color: #7a7e85; font-weight: 700;",
            `Ενεργό · χρώμα offline: ${toHex(this.settings.color)} · ένταση: ${clamp(this.settings.opacity, 10, 100)}%`);
    }

    stop() {
        BdApi.DOM.removeStyle(NAME);
    }

    apply() {
        BdApi.DOM.addStyle(NAME, buildCss(this.settings));
    }

    getSettingsPanel() {
        const set = (key, value) => {
            this.settings[key] = value;
            BdApi.Data.save(NAME, "settings", this.settings);
            this.apply();
        };
        return BdApi.UI.buildSettingsPanel({
            settings: [
                {
                    type: "color",
                    id: "color",
                    name: "Χρώμα offline ονομάτων",
                    note: "Αντικαθιστά το χρώμα του ρόλου στη λίστα μελών, σε όλους τους servers.",
                    value: toHex(this.settings.color),
                    defaultValue: DEFAULTS.color,
                    onChange: value => set("color", toHex(value))
                },
                {
                    type: "slider",
                    id: "opacity",
                    name: "Ένταση των offline μελών",
                    note: "Πόσο ξεθωριασμένη είναι όλη η γραμμή του μέλους. 30% είναι η προεπιλογή του Discord· ανέβασέ το αν θες το γκρι πιο ευδιάκριτο.",
                    value: clamp(this.settings.opacity, 10, 100),
                    min: 10,
                    max: 100,
                    step: 5,
                    units: "%",
                    markers: [10, 30, 50, 70, 100],
                    onChange: value => set("opacity", clamp(value, 10, 100))
                }
            ]
        });
    }
};
