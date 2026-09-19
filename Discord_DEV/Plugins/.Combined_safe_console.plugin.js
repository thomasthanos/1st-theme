/**
 * @name Combined_safe_console
 * @version 4.0.0
 * @description Κρατάει την κονσόλα καθαρή από τον θόρυβο του Discord και των plugins (BlockConsole), δείχνει τα Discord invite links ως «Discord link» (DiscordLinkSafe) και μπλοκάρει τα RPC requests άγνωστων εφαρμογών.
 * @author ThomasT
 * @authorId 706932839907852389
 * @source https://github.com/thomasthanos/1st-theme/blob/main/Discord_DEV/Plugins/.Combined_safe_console.plugin.js
 * @updateUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/.Combined_safe_console.plugin.js
 * @website https://github.com/thomasthanos
 */

"use strict";

const NAME = "Combined_safe_console";
const DATA_KEY = "ThomasTCombined";
const DEFAULTS = {
    blockConsoleEnabled: true,
    discordLinkSafeEnabled: true,
    blockNetworkRequests: true,
    clearConsoleOnStart: true,
    allowedRpcAppIds: "1444008152617189486",
    extraFilters: ""
};
const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"];
const CLEAR_DELAY_MS = 8000;

// Log prefixes of Discord modules and plugins that only produce noise.
const NOISY_PREFIXES = [
    "[FAST CONNECT]", "[default]", "[KeyboardLayoutMapUtils]", "[Spellchecker]", "[libdiscore]",
    "[BetterDiscord]", "[RPCServer:WSS]", "[GatewaySocket]", "[MessageActionCreators]",
    "[ChannelMessages]", "[Spotify]", "[OverlayStoreV3]", "[RPCServer:IPC]", "[BDFDB]",
    "[PinDMs]", "[ReadAllNotificationsButton]", "[StaffTag]", "[OverlayBridgeStore]",
    "[RunningGameStore]", "[ReadStateStore]", "[RTCControlSocket(stream)]", "[RTCControlSocket(default)]",
    "[DirectVideo]", "[HDStreamingConsumableModal]", "[ConnectionEventFramerateReducer]",
    "[OverlayRenderStore]", "[discord_protos.discord_users.v1.FrecencyUserSetting]", "[Routing/Utils]",
    "[MessageQueue]", "[Connection(default)]", "[hde-delete]", "[RTCLatencyTestManager]",
    "[FetchBlockedDomain]", "[AVError]", "[discord_protos.discord_users.v1.PreloadedUserSettings]",
    "[StreamTile]", "[PopoutWindowStore]", "[PostMessageTransport]", "[ComponentDispatchUtils]",
    "[WindowVisibilityVideoManager]", "[MediaEngineNative]", "[AudioActionCreators]", "[Connection(stream)]",
    "[HideMutedCategories]", "[ZeresPluginLibrary]", "[VideoStream]", "[OverlayUsageStatsManager]",
    "[UserProfileModalActionCreators]", "[RPCServer:PostMessage]", "[RpcApplicationLogger]",
    "[AVErrorManager]", "[Flux]", "[JANK]", "[GamesActionCreators]", "[OverlayV3Store]",
    "[AnalyticsTrackImpressionContext]", "[sentry]", "[RTCConnection", "[RPC]", "[AnalyticsTrackingStore]",
    "oauth2/applications", "sentry", "404 (Not Found)", "RTCConnection", "Cannot read properties of undefined"
];
const NOISY_PATTERNS = [
    "GET.*404.*Not Found",
    "RPC.*error",
    "The resource .* was preloaded using link preload but not used",
    "AbortError: The play[(][)] request was interrupted"
];

const RPC_LOOKUP = /\/oauth2\/applications\/(\d+)\/rpc(?:[/?#]|$)/;
const INVITE_LINKS = ['a[href*="discord.gg/"]', 'a[href*="discord.com/invite/"]', 'a[href*="discordapp.com/invite/"]'];

function escapeRegExp(text) {
    const backslash = String.fromCharCode(92);
    return text.replace(/[.*+?^${}()|[\]]/g, match => backslash + match);
}

function splitList(text) {
    return String(text || "").split(/[,\n]/).map(part => part.trim()).filter(Boolean);
}

function linkSafeCss() {
    const links = INVITE_LINKS.join(",\n");
    const after = INVITE_LINKS.map(s => `${s}::after`).join(",\n");
    const inEmbeds = INVITE_LINKS.map(s => `[id^="message-accessories-"] ${s}::after`).join(",\n");
    const expired = INVITE_LINKS.flatMap(s => [
        `[id^="message-accessories-"]:has([class*="inviteDestinationExpired"]) ${s}::after`,
        `[id^="chat-messages-"]:has([class*="inviteDestinationExpired"]) [id^="message-content-"] ${s}::after`
    ]).join(",\n");
    // The link text is hidden with font-size 0 and replaced by a label, so React's own text
    // nodes are never touched (editing the DOM of a message can crash Discord's renderer).
    return `
${links} {
    font-size: 0 !important;
    text-decoration: none !important;
}
${INVITE_LINKS.map(s => `${s} > *`).join(",\n")} {
    display: none !important;
}
${after} {
    content: "Discord link";
    font-size: 1rem;
    font-weight: 700;
    color: #00b0f4;
}
${inEmbeds} {
    font-size: 0.875rem;
}
${expired} {
    color: #8B0000;
}
`;
}

module.exports = class ThomasTCombined {
    constructor() {
        this.settings = { ...DEFAULTS };
        this.noise = null;
        this.rpcAllowed = new Set();
        this.consoleActive = false;
        this.networkActive = false;
        this.consoleHooks = [];
        this.networkHooks = [];
        this.httpPatched = false;
        this.timers = new Set();
        this.saveTimer = null;
        this.blockedLogs = 0;
        this.blockedRequests = 0;
    }

    start() {
        this.settings = this.loadSettings();
        this.compileFilters();
        this.applyAll();
        const onOff = value => (value ? "ναι" : "όχι");
        const rpc = this.networkActive ? (this.httpPatched ? "ναι (HTTP + fetch/XHR)" : "ναι (μόνο fetch/XHR)") : "όχι";
        console.log(`%c[${NAME}]`, "color: #2196f3; font-weight: 700;",
            `Ενεργό · φίλτρο κονσόλας: ${onOff(this.consoleActive)} · DiscordLinkSafe: ${onOff(this.settings.discordLinkSafeEnabled)} · μπλοκ RPC: ${rpc}`);
        if (this.settings.clearConsoleOnStart) {
            this.later(() => this.clearConsole(), CLEAR_DELAY_MS);
        }
    }

    stop() {
        for (const id of this.timers) clearTimeout(id);
        this.timers.clear();
        this.flushSave();
        this.consoleActive = false;
        this.networkActive = false;
        this.removeConsoleFilter();
        this.removeNetworkBlock();
        BdApi.DOM.removeStyle(`${NAME}-linksafe`);
    }

    // ── settings ──────────────────────────────────────────────

    loadSettings() {
        const saved = BdApi.Data.load(DATA_KEY, "settings");
        return { ...DEFAULTS, ...(saved && typeof saved === "object" ? saved : {}) };
    }

    saveSoon() {
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => this.flushSave(), 400);
    }

    flushSave() {
        if (!this.saveTimer) return;
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
        BdApi.Data.save(DATA_KEY, "settings", this.settings);
    }

    later(fn, ms) {
        const id = setTimeout(() => {
            this.timers.delete(id);
            fn();
        }, ms);
        this.timers.add(id);
    }

    compileFilters() {
        const parts = [...NOISY_PREFIXES, ...splitList(this.settings.extraFilters)].map(escapeRegExp);
        this.noise = new RegExp([...parts, ...NOISY_PATTERNS].join("|"));
        this.rpcAllowed = new Set(splitList(this.settings.allowedRpcAppIds).filter(id => /^\d+$/.test(id)));
    }

    applyAll() {
        this.consoleActive = Boolean(this.settings.blockConsoleEnabled);
        if (this.consoleActive) this.installConsoleFilter();

        this.networkActive = Boolean(this.settings.blockNetworkRequests);
        if (this.networkActive) this.installNetworkBlock();

        if (this.settings.discordLinkSafeEnabled) BdApi.DOM.addStyle(`${NAME}-linksafe`, linkSafeCss());
        else BdApi.DOM.removeStyle(`${NAME}-linksafe`);
    }

    // ── BlockConsole ──────────────────────────────────────────

    isNoise(args) {
        for (const arg of args) {
            if (typeof arg === "string") {
                if (this.noise.test(arg)) return true;
            }
            else if (arg instanceof Error) {
                if (this.noise.test(String(arg.message))) return true;
            }
        }
        return false;
    }

    // Every console method is wrapped once. Turning the filter off only flips a flag, so the
    // wrappers never stack up; stop() restores the originals when nobody wrapped on top of them.
    installConsoleFilter() {
        if (this.consoleHooks.length) return;
        const plugin = this;
        const baseLog = console.log;
        for (const method of CONSOLE_METHODS) {
            const original = console[method];
            if (typeof original !== "function") continue;
            const wrapper = function (...args) {
                if (plugin.consoleActive && plugin.isNoise(args)) {
                    plugin.blockedLogs++;
                    return undefined;
                }
                try {
                    return original.apply(this, args);
                }
                catch {
                    // Versions before 4.0.0 left a console.error behind on stop() that throws on
                    // every call. Print through console.log instead of throwing into the caller.
                    try { return baseLog.apply(console, args); } catch { return undefined; }
                }
            };
            console[method] = wrapper;
            this.consoleHooks.push({ method, original, wrapper });
        }
    }

    removeConsoleFilter() {
        for (const { method, original, wrapper } of this.consoleHooks) {
            if (console[method] === wrapper) console[method] = original;
        }
        this.consoleHooks = [];
    }

    clearConsole() {
        const clear = console.clear;
        if (typeof clear === "function") clear.call(console);
        console.log(
            `%c ${NAME} %c Η κονσόλα καθαρίστηκε! %c v${this.version()} `,
            "font-weight: bold; background: #424242; color: white; padding: 4px 8px; border-radius: 6px 0 0 6px;",
            "font-weight: bold; background: #616161; color: white; padding: 4px 8px;",
            "font-weight: bold; background: #2196f3; color: white; padding: 4px 8px; border-radius: 0 6px 6px 0;"
        );
    }

    version() {
        try { return BdApi.Plugins.get(NAME)?.version || "?"; } catch { return "?"; }
    }

    // ── RPC request block ─────────────────────────────────────

    isBlockedUrl(url) {
        if (!this.networkActive || url == null) return false;
        const match = RPC_LOOKUP.exec(String(url));
        return Boolean(match) && !this.rpcAllowed.has(match[1]);
    }

    installNetworkBlock() {
        if (this.networkHooks.length) return;
        const plugin = this;

        // 1) Discord's own HTTP helper, which the RPC server uses to look up an application.
        //    Rejecting here means no request is made at all, and no retries.
        const http = this.findHttpApi();
        if (http) {
            BdApi.Patcher.instead(NAME, http, "get", (thisObject, args, original) => {
                const [options, callback] = args;
                const url = typeof options === "string" ? options : options?.url;
                if (typeof callback !== "function" && plugin.isBlockedUrl(url)) {
                    plugin.blockedRequests++;
                    const body = { message: "Unknown Application", code: 10002 };
                    return Promise.reject(Object.assign(new Error(`Blocked by ${NAME}`), { ok: false, status: 404, body, text: "", headers: {} }));
                }
                return original.apply(thisObject, args);
            });
            this.httpPatched = true;
            this.networkHooks.push({ undo: () => { BdApi.Patcher.unpatchAll(NAME); this.httpPatched = false; } });
        }
        else {
            console.warn(`[${NAME}] Δεν βρέθηκε το HTTP module του Discord· μένει μόνο το φίλτρο fetch/XHR.`);
        }

        // 2) fetch, for code paths that do not go through the HTTP helper.
        const originalFetch = window.fetch;
        if (typeof originalFetch === "function") {
            const fetchWrapper = function (input, init) {
                const url = typeof input === "string" ? input : input?.url;
                if (plugin.isBlockedUrl(url)) {
                    plugin.blockedRequests++;
                    const body = JSON.stringify({ message: "Unknown Application", code: 10002 });
                    return Promise.resolve(new Response(body, { status: 404, statusText: "Not Found", headers: { "Content-Type": "application/json" } }));
                }
                return originalFetch.apply(this, arguments);
            };
            window.fetch = fetchWrapper;
            this.networkHooks.push({ undo: () => { if (window.fetch === fetchWrapper) window.fetch = originalFetch; } });
        }

        // 3) XMLHttpRequest. open() always runs normally (so setRequestHeader keeps working);
        //    a blocked request is never sent and ends like a network error instead.
        const proto = window.XMLHttpRequest?.prototype;
        if (proto) {
            const originalOpen = proto.open;
            const originalSend = proto.send;
            const blockedRequests = new WeakSet();
            const openWrapper = function (method, url) {
                if (plugin.isBlockedUrl(url)) blockedRequests.add(this);
                else blockedRequests.delete(this);
                return originalOpen.apply(this, arguments);
            };
            const sendWrapper = function () {
                if (!blockedRequests.has(this)) return originalSend.apply(this, arguments);
                blockedRequests.delete(this);
                plugin.blockedRequests++;
                const xhr = this;
                setTimeout(() => {
                    try {
                        for (const [key, value] of [["readyState", 4], ["status", 0], ["statusText", ""], ["responseText", ""], ["response", ""]]) {
                            Object.defineProperty(xhr, key, { configurable: true, get: () => value });
                        }
                    }
                    catch {}
                    xhr.dispatchEvent(new Event("readystatechange"));
                    xhr.dispatchEvent(new ProgressEvent("error"));
                    xhr.dispatchEvent(new ProgressEvent("loadend"));
                }, 0);
                return undefined;
            };
            proto.open = openWrapper;
            proto.send = sendWrapper;
            this.networkHooks.push({
                undo: () => {
                    if (proto.open === openWrapper) proto.open = originalOpen;
                    if (proto.send === sendWrapper) proto.send = originalSend;
                }
            });
        }
    }

    removeNetworkBlock() {
        for (const hook of this.networkHooks.reverse()) {
            try { hook.undo(); } catch {}
        }
        this.networkHooks = [];
    }

    // Discord's HTTP helper is a plain object { get, post, put, patch, del }.
    findHttpApi() {
        try {
            return BdApi.Webpack.getModule(m => m
                && typeof m === "object"
                && typeof m.get === "function"
                && typeof m.post === "function"
                && typeof m.put === "function"
                && typeof m.patch === "function"
                && typeof m.del === "function"
                && Object.keys(m).length <= 8, { searchExports: true }) || null;
        }
        catch {
            return null;
        }
    }

    // ── settings panel ────────────────────────────────────────

    getSettingsPanel() {
        const s = this.settings;
        const update = (key, value) => {
            s[key] = value;
            this.saveSoon();
            if (key === "extraFilters" || key === "allowedRpcAppIds") {
                this.compileFilters();
                return;
            }
            this.applyAll();
        };
        return BdApi.UI.buildSettingsPanel({
            settings: [
                {
                    type: "category",
                    id: "console",
                    name: "BlockConsole",
                    collapsible: true,
                    shown: true,
                    settings: [
                        {
                            type: "switch",
                            id: "blockConsoleEnabled",
                            name: "Φιλτράρισμα θορύβου στην κονσόλα",
                            note: `Κρύβει γνωστά μηνύματα του Discord και των plugins (π.χ. [GatewaySocket], [BDFDB], sentry, 404). Κρυμμένα σε αυτή τη συνεδρία: ${this.blockedLogs}.`,
                            value: s.blockConsoleEnabled,
                            onChange: v => update("blockConsoleEnabled", v)
                        },
                        {
                            type: "switch",
                            id: "clearConsoleOnStart",
                            name: "Καθαρισμός κονσόλας στην εκκίνηση",
                            note: "Καθαρίζει την κονσόλα λίγα δευτερόλεπτα αφού φορτώσει το plugin.",
                            value: s.clearConsoleOnStart,
                            onChange: v => update("clearConsoleOnStart", v)
                        },
                        {
                            type: "text",
                            id: "extraFilters",
                            name: "Επιπλέον φίλτρα",
                            note: "Κείμενα χωρισμένα με κόμμα. Όποιο μήνυμα κονσόλας περιέχει κάποιο από αυτά δεν εμφανίζεται.",
                            placeholder: "π.χ. [MyPlugin], κάποιο κείμενο",
                            value: s.extraFilters,
                            onChange: v => update("extraFilters", v)
                        }
                    ]
                },
                {
                    type: "category",
                    id: "links",
                    name: "DiscordLinkSafe",
                    collapsible: true,
                    shown: true,
                    settings: [
                        {
                            type: "switch",
                            id: "discordLinkSafeEnabled",
                            name: "Invite links ως «Discord link»",
                            note: "Κρύβει το URL των προσκλήσεων (discord.gg, discord.com/invite). Κόκκινο όταν η πρόσκληση έχει λήξει.",
                            value: s.discordLinkSafeEnabled,
                            onChange: v => update("discordLinkSafeEnabled", v)
                        }
                    ]
                },
                {
                    type: "category",
                    id: "network",
                    name: "RPC requests",
                    collapsible: true,
                    shown: true,
                    settings: [
                        {
                            type: "switch",
                            id: "blockNetworkRequests",
                            name: "Μπλοκάρισμα RPC requests άγνωστων εφαρμογών",
                            note: `Σταματάει τα /oauth2/applications/<id>/rpc requests (και τα 404 που γεμίζουν την κονσόλα). Μπλοκαρίστηκαν σε αυτή τη συνεδρία: ${this.blockedRequests}.`,
                            value: s.blockNetworkRequests,
                            onChange: v => update("blockNetworkRequests", v)
                        },
                        {
                            type: "text",
                            id: "allowedRpcAppIds",
                            name: "Εφαρμογές που επιτρέπονται",
                            note: "Application IDs χωρισμένα με κόμμα· αυτές οι εφαρμογές συνδέονται κανονικά στο RPC. Το 1444008152617189486 είναι το Touch Deck.",
                            placeholder: "1444008152617189486",
                            value: s.allowedRpcAppIds,
                            onChange: v => update("allowedRpcAppIds", v)
                        }
                    ]
                }
            ]
        });
    }
};
