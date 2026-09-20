/**
 * @name Prezomenoi_OG
 * @version 7.1.0
 * @description Μετονομάζει κανάλια, κατηγορίες και μέλη στον server των Prezomenoi (Ghost Server), χρωματίζει τα ονόματά τους και φορτώνει το θέμα του server. Οι αλλαγές είναι μόνο οπτικές και αναιρούνται όταν το απενεργοποιήσεις.
 * @author ThomasT
 * @authorId 706932839907852389
 * @source https://github.com/thomasthanos/1st-theme/blob/main/Discord_DEV/Plugins/.Prezomenoi_OG.plugin.js
 * @updateUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/.Prezomenoi_OG.plugin.js
 * @website https://github.com/thomasthanos
 */

"use strict";

const NAME = "Prezomenoi_OG";
const GUILD_ID = "1216757265391161537";
const THEME_LINK_ID = "prezomenoi-og-style";
const THEME_URL = "https://thomasthanos.github.io/1st-theme/Discord_DEV/Themes/prezomenoi.theme.css";
const BODY_CLASS = "prezomenoi-og-active";

const SERVER_NAME = "Xountikoi OG";
const SERVER_TEXT = "Ghost Server";       // what is shown on screen
const SERVER_LABEL = "Prezomenoi LOCAL";  // what aria-label / data-text get

const USERS = [
    { id: "411178013103751190", original: ["AnimalRapist"], target: "Akrivos", color: "#1F8249" },
    { id: "681933873877352472", original: ["Karaflopekatsos", "Tony Redgrave"], target: "Mpillias", color: "#734986" },
    { id: "1076347460500324363", original: ["Skiguros"], target: "Giannhs", color: "#1F8249" },
    { id: "633412575601623049", original: ["Pipirokauletas", "アスタ"], target: "Petros", color: "#206694" },
    { id: "804860278788456469", original: ["nyxterida", "ANNOUSKA"], target: "Eirini", color: "#FF69B4" },
    { id: "684773505157431347", original: ["FlaviBot"], target: "FlaviBot", color: "#FFD700" },
    { id: "324631108731928587", original: ["Simple Poll"], target: "Simple Poll", color: "#FFD700" },
    { id: "778355613373693953", original: ["Kontosouvli lover", "@Kontosouvli lover"], target: "Andreas", color: "#8B0000" },
    { id: null, original: ["Seniora Chara"], target: "Chara", color: "#9b59b6" }
];

const CHANNELS = {
    "1216778033550196856": "📜〢Rules",
    "1217201547054944377": "🎵〢Music",
    "1216757354574385203": "💬〢Chat",
    "1333458086094045385": "📽️〢Clips",
    "1344770404023144550": "📰〢Epikairotita",
    "1357173641745404006": "☘️〢Drugs",
    "1355323003084341359": "🌐〢Nord VPN",
    "1216757265936154689": "📞〢Larose",
    "1250083136818122813": "☣️〢Karkinos",
    "1216761517194739936": "⚖️〢Dikastirio",
    "1216818976898941068": "🎬〢Movies",
    "1345100969393917953": "🔏〢Secret",
    "1490509630776934500": "🤫〢Mpillias",
    "1517315171104849990": "🧪〢Exomologisi",
    "1459305637841473711": "🇩🇪〢secret channel",
    "1459297181721952307": "🇩🇪〢secret call"
};

const CATEGORIES = {
    "1216757265936154686": "💬",
    "1216757265936154687": "📱",
    "1459305587413094420": "🇩🇪"
};

// Places where the user types. Changing text there would corrupt the message editor.
const EDITABLE = '[contenteditable="true"], [role="textbox"], textarea, input';
const SKIP_PARENTS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "NOSCRIPT"]);
const ATTRIBUTES = ["aria-label", "data-text"];
const CHANNEL_ITEM = '[data-list-item-id^="channels___"]';
const CHANNEL_LINK = `a[href*="/channels/${GUILD_ID}/"]`;
const HEADER = 'h1, h2, [data-window-chrome="true"]';
const MAX_TRACKED = 4000;
const HIDE_ATTR = "data-prezomenoi-hidden";
const OFFLINE_COLOR = "#C0C0C0";
// Offline members keep Discord's class "offline__xxxxx" on their row, so no JS is needed to
// grey their names: the rule wins over the inline role colour. Drop ".prezomenoi-og-active "
// from the selectors to grey offline members in every server.
const STYLES = `
[${HIDE_ATTR}="1"] { display: none !important; }

.${BODY_CLASS} [data-list-id^="members"] [class*="offline"] [class*="username"],
.${BODY_CLASS} [data-list-id^="members"] [class*="offline"] [class*="nameContainer"],
.${BODY_CLASS} [data-list-id^="members"] [class*="offline"] [class*="name__"] {
    color: ${OFFLINE_COLOR} !important;
}
`;

// Names on screen are not always the raw Discord name: other plugins (BetterChatNames)
// capitalise them and drop dashes/underscores, and emoji may be images. Comparing only
// letters and digits, lowercased, still matches the right channel.
function looseName(text) {
    return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

// What a user actually reads inside an element: Discord turns emoji in names into
// <img alt="X">, so the name is spread over several nodes instead of one text node.
function displayText(element) {
    let text = "";
    for (const node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) text += node.nodeValue;
        else if (node.nodeType === Node.ELEMENT_NODE && node.getAttribute(HIDE_ATTR) !== "1") {
            text += node.tagName === "IMG" ? (node.getAttribute("alt") || "") : displayText(node);
        }
    }
    return text;
}

function escapeRegExp(text) {
    const backslash = String.fromCharCode(92);
    return text.replace(/[.*+?^${}()|[\]]/g, match => backslash + match);
}

function alternation(words) {
    return [...words].sort((a, b) => b.length - a.length).map(escapeRegExp).join("|");
}

module.exports = class RenameChannel {
    constructor() {
        this.running = false;
        this.observer = null;
        this.pending = new Set();
        this.frame = 0;
        this.fallback = 0;
        this.stores = {};
        this.unsubscribers = [];
        this.inGuild = false;
        this.names = new Map();
        this.namesAt = 0;
        this.reported = new Set();
        // Everything changed on screen, so stop() can put it back.
        this.textChanges = new Map();
        this.attrChanges = new Map();
        this.colorChanges = new Map();
    }

    start() {
        this.running = true;
        this.compile();
        const W = BdApi.Webpack;
        for (const [key, store] of [["guild", "SelectedGuildStore"], ["channel", "SelectedChannelStore"], ["channels", "ChannelStore"]]) {
            try { this.stores[key] = W.getStore(store); } catch {}
        }
        BdApi.DOM.addStyle(NAME, STYLES);
        this.addTheme();
        this.refreshNames(true);
        this.updateGuildState();
        this.subscribe();

        this.observer = new MutationObserver(records => this.onMutations(records));
        this.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        this.processRoot(document.body);
        // The channel list is not always rendered yet at start; this reports what was found.
        this.diagTimer = setTimeout(() => {
            if (!this.running) return;
            const items = document.querySelectorAll(CHANNEL_ITEM);
            let mapped = 0;
            for (const item of items) {
                if (this.names.has(item.getAttribute("data-list-item-id").slice("channels___".length))) mapped++;
            }
            const missing = [...this.names.entries()].filter(([, entry]) => !entry.from).map(([id]) => id);
            this.log(`Λίστα καναλιών: ${items.length} items στο DOM, ${mapped} από τη λίστα μετονομασίας`
                + (missing.length ? ` · άγνωστα στο Discord (μάλλον διαγραμμένα): ${missing.join(", ")}` : ""));
        }, 5000);
        const resolved = [...this.names.values()].filter(entry => entry.from).length;
        this.log(`Ενεργό · ονόματα καναλιών/κατηγοριών: ${resolved}/${this.names.size} από το Discord · ${USERS.length} μέλη · στον server τώρα: ${this.inGuild ? "ναι" : "όχι"}`);
    }

    stop() {
        this.running = false;
        this.observer?.disconnect();
        this.observer = null;
        cancelAnimationFrame(this.frame);
        clearTimeout(this.fallback);
        clearTimeout(this.diagTimer);
        this.frame = 0;
        this.fallback = 0;
        this.diagTimer = 0;
        this.pending.clear();
        for (const off of this.unsubscribers) {
            try { off(); } catch {}
        }
        this.unsubscribers = [];
        document.getElementById(THEME_LINK_ID)?.remove();
        document.body.classList.remove(BODY_CLASS);
        BdApi.DOM.removeStyle(NAME);
        const restored = this.revertAll();
        this.log(`Απενεργοποιήθηκε · αναιρέθηκαν ${restored} αλλαγές`);
    }

    // ── read by the Touch Deck app ────────────────────────────
    // touch-screen-app/src/main/discord-renames.js requires this file, creates an instance and
    // reads USERS, getChannelMap() and isCorrectGuild() so the deck shows the same names.
    // Keep these three available and keep the guild id written out in isCorrectGuild().

    get USERS() {
        return USERS;
    }

    getChannelMap() {
        return { ...CHANNELS };
    }

    getCategoryMap() {
        return { ...CATEGORIES };
    }

    isCorrectGuild() {
        return this.selectedGuildId() === "1216757265391161537";
    }

    // ── setup ─────────────────────────────────────────────────

    compile() {
        this.textMap = new Map([[SERVER_NAME, SERVER_TEXT]]);
        this.attrMap = new Map([[SERVER_NAME, SERVER_LABEL]]);
        this.exactUsers = new Map();
        this.usersById = new Map();
        for (const user of USERS) {
            if (user.id) this.usersById.set(user.id, user);
            for (const name of user.original) {
                this.exactUsers.set(name, user);
                if (name === user.target) continue;
                // "@Kontosouvli lover" is covered by "Kontosouvli lover" and keeps its "@".
                if (user.original.some(other => other !== name && name.includes(other))) continue;
                this.textMap.set(name, user.target);
                this.attrMap.set(name, user.target);
            }
        }
        this.textPattern = new RegExp(alternation(this.textMap.keys()), "g");
        this.attrPattern = new RegExp(alternation(this.attrMap.keys()), "g");
        // Cheap pre-check before looking at a text node in detail.
        this.quickText = new RegExp(alternation([...this.textMap.keys(), ...this.exactUsers.keys(), " / "]));
    }

    addTheme() {
        if (document.getElementById(THEME_LINK_ID)) return;
        const link = document.createElement("link");
        link.id = THEME_LINK_ID;
        link.rel = "stylesheet";
        link.href = `${THEME_URL}?t=${Date.now()}`;
        document.head.appendChild(link);
    }

    subscribe() {
        const onSelect = () => {
            if (!this.running) return;
            const was = this.inGuild;
            this.updateGuildState();
            if (this.inGuild) this.refreshNames(!was);
            // Headers and the channel list show the new channel; new messages arrive as mutations.
            this.queueAll(document.querySelectorAll(`${HEADER}, ${CHANNEL_ITEM}`));
        };
        for (const store of [this.stores.guild, this.stores.channel]) {
            if (typeof store?.addChangeListener !== "function") continue;
            store.addChangeListener(onSelect);
            this.unsubscribers.push(() => store.removeChangeListener(onSelect));
        }
        if (!this.stores.guild) {
            // Without the store, fall back to watching the URL (cheap string compare).
            let path = location.pathname;
            const id = setInterval(() => {
                if (location.pathname === path) return;
                path = location.pathname;
                onSelect();
            }, 1000);
            this.unsubscribers.push(() => clearInterval(id));
        }
    }

    selectedGuildId() {
        try {
            const id = this.stores.guild?.getGuildId?.();
            if (id !== undefined) return id;
        }
        catch {}
        if (typeof location === "undefined") return null;
        return /^\/channels\/(\d+)\//.exec(location.pathname)?.[1] || null;
    }

    selectedChannelId() {
        try {
            const id = this.stores.channel?.getChannelId?.();
            if (id !== undefined) return id;
        }
        catch {}
        if (typeof location === "undefined") return null;
        return /^\/channels\/\d+\/(\d+)/.exec(location.pathname)?.[1] || null;
    }

    updateGuildState() {
        const was = this.inGuild;
        this.inGuild = this.selectedGuildId() === GUILD_ID;
        document.body.classList.toggle(BODY_CLASS, this.inGuild);
        // Names keep their replacement everywhere, but the colours belong to this server only.
        if (was && !this.inGuild) this.revertColors();
        // Back in the server: colour again whatever is already on screen.
        if (!was && this.inGuild && this.observer) this.queueAll([document.body]);
    }

    revertColors() {
        for (const [element, change] of this.colorChanges) {
            if (element.isConnected && element.style.color === change.applied) element.style.color = change.original;
        }
        this.colorChanges.clear();
    }

    // Original channel names come from Discord's ChannelStore, so renames keep working
    // when a channel is renamed on the server.
    refreshNames(force = false) {
        const total = Object.keys(CHANNELS).length + Object.keys(CATEGORIES).length;
        if (!force && this.names.size === total && Date.now() - this.namesAt < 60000) return;
        const names = new Map();
        for (const [id, to] of Object.entries({ ...CHANNELS, ...CATEGORIES })) {
            let from = null;
            try { from = this.stores.channels?.getChannel?.(id)?.name || null; } catch {}
            names.set(id, { from, to });
        }
        this.names = names;
        this.namesAt = Date.now();
        this.namesByText = new Map();
        for (const entry of names.values()) {
            if (entry.from && entry.from !== entry.to) this.namesByText.set(entry.from, entry.to);
        }
    }

    // ── mutation handling (batched once per frame) ────────────

    onMutations(records) {
        for (const record of records) {
            if (record.type === "characterData") {
                this.pending.add(record.target);
                continue;
            }
            for (const node of record.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) this.pending.add(node);
            }
        }
        this.schedule();
    }

    queueAll(nodes) {
        for (const node of nodes) this.pending.add(node);
        this.schedule();
    }

    // Runs on the next frame. requestAnimationFrame does not fire while Discord is minimised,
    // so a timeout makes sure the queue is still processed (and does not keep growing).
    schedule() {
        if (this.frame || !this.pending.size || !this.running) return;
        const run = () => {
            cancelAnimationFrame(this.frame);
            clearTimeout(this.fallback);
            this.frame = 0;
            this.fallback = 0;
            if (this.running) this.flush();
        };
        this.frame = requestAnimationFrame(run);
        this.fallback = setTimeout(run, 300);
    }

    flush() {
        const nodes = [...this.pending];
        this.pending.clear();
        if (Date.now() - this.namesAt > 5000 && [...this.names.values()].some(e => !e.from)) this.refreshNames(true);
        for (const node of nodes) {
            if (!node.isConnected) continue;
            if (node.nodeType === Node.TEXT_NODE) this.processTextNode(node, true);
            else this.processRoot(node);
        }
        this.prune();
    }

    // ── processing ────────────────────────────────────────────

    isEditable(element) {
        return !element || SKIP_PARENTS.has(element.tagName) || Boolean(element.closest(EDITABLE));
    }

    processRoot(root) {
        if (root.nodeType !== Node.ELEMENT_NODE || this.isEditable(root)) return;

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (this.quickText.test(node.nodeValue)) this.processTextNode(node, false);
        }

        this.processAttributes(root);
        for (const element of root.querySelectorAll("[aria-label], [data-text]")) this.processAttributes(element);

        this.renameChannelsIn(root);
        this.renameMessageAuthors(root);
    }

    processTextNode(node, withContext) {
        const parent = node.parentElement;
        const value = node.nodeValue;
        if (!value || this.isEditable(parent)) return;
        const trimmed = value.trim();

        let next = value.replace(this.textPattern, match => this.textMap.get(match) ?? match);

        // Voice panel style "<channel> / <server>".
        const split = next.indexOf(" / ");
        if (split > 0) {
            const head = next.slice(0, split).trim();
            const tail = next.slice(split + 3).trim();
            const renamed = this.namesByText?.get(head);
            if (renamed && (tail === SERVER_TEXT || tail === SERVER_NAME)) next = `${renamed} / ${tail}`;
        }

        if (next !== value) this.setText(node, next);
        const user = this.exactUsers.get(trimmed);
        if (user && this.inGuild) this.setColor(parent, user.color);

        // A single text node that changed on its own (characterData) or was added alone:
        // check whether it sits in a channel item, a channel link or a header.
        if (withContext && parent) {
            const context = parent.closest(`${CHANNEL_ITEM}, ${CHANNEL_LINK}, ${HEADER}`);
            if (context) this.renameChannelsIn(context);
        }
    }

    processAttributes(element) {
        for (const attr of ATTRIBUTES) {
            const value = element.getAttribute(attr);
            if (!value) continue;
            this.attrPattern.lastIndex = 0;
            if (!this.attrPattern.test(value)) continue;
            const next = value.replace(this.attrPattern, match => this.attrMap.get(match) ?? match);
            if (next !== value) this.setAttr(element, attr, next);
        }
    }

    renameChannelsIn(root) {
        if (!this.names.size) return;
        const scope = root.nodeType === Node.ELEMENT_NODE ? root : root.parentElement;
        if (!scope) return;

        // Channel list items carry the channel id, so they are renamed in any context.
        const items = scope.matches(CHANNEL_ITEM) ? [scope] : [];
        const inside = scope.closest(CHANNEL_ITEM);
        if (inside && inside !== scope) items.push(inside);
        items.push(...scope.querySelectorAll(CHANNEL_ITEM));
        for (const item of items) {
            const id = item.getAttribute("data-list-item-id").slice("channels___".length);
            const entry = this.names.get(id);
            if (entry) this.renameInside(item, entry, true);
        }

        // Links to a channel of this server (voice panel, mentions, embeds).
        const links = scope.matches(CHANNEL_LINK) ? [scope] : [];
        const linkAround = scope.closest(CHANNEL_LINK);
        if (linkAround && linkAround !== scope) links.push(linkAround);
        links.push(...scope.querySelectorAll(CHANNEL_LINK));
        for (const link of links) {
            const id = /\/channels\/\d+\/(\d+)/.exec(link.getAttribute("href") || "")?.[1];
            const entry = id && this.names.get(id);
            if (entry) this.renameInside(link, entry, false);
        }

        // Headers show the selected channel's name.
        if (!this.inGuild) return;
        const entry = this.names.get(this.selectedChannelId());
        if (!entry?.from) return;
        const headers = scope.matches(HEADER) ? [scope] : [];
        const headerAround = scope.closest(HEADER);
        if (headerAround && headerAround !== scope) headers.push(headerAround);
        headers.push(...scope.querySelectorAll(HEADER));
        for (const header of headers) this.renameInside(header, entry, false);
    }

    renameInside(container, entry, isListItem) {
        const { from, to } = entry;
        if (from) {
            // A name split across nodes (emoji rendered as images) is handled first, so the
            // old emoji image is hidden instead of ending up next to the custom name.
            const host = this.findNameHost(container, from);
            if (host && this.renameHost(host, to)) return;
            if (this.renameTextNodes(container, from, to)) return;
            if (isListItem) this.reportMismatch(container, entry);
            return;
        }
        // Without ChannelStore the original name is unknown; the list item's name element is used.
        if (isListItem) {
            const nameElement = container.querySelector('[class*="name"]');
            const walkerByClass = nameElement && document.createTreeWalker(nameElement, NodeFilter.SHOW_TEXT);
            const node = walkerByClass?.nextNode();
            if (node && node.nodeValue.trim() && node.nodeValue !== to) this.setText(node, to);
        }
    }

    // The whole name sits in one text node. Returns true when the container already shows
    // the custom name too, so nothing else needs to run.
    renameTextNodes(container, from, to) {
        const loose = looseName(from);
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        let done = false;
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const value = node.nodeValue;
            const trimmed = value.trim();
            if (!trimmed || trimmed === to) {
                if (trimmed === to) done = true;
                continue;
            }
            if (trimmed === from) {
                this.setText(node, value.replace(from, to));
                done = true;
            }
            else if (loose && looseName(trimmed) === loose) {
                this.setText(node, to);
                done = true;
            }
        }
        return done;
    }

    // Finds the element that holds the original name, even when Discord split it into an
    // emoji image plus text.
    findNameHost(container, from) {
        const loose = looseName(from);
        const seen = new Set();
        for (const image of container.querySelectorAll("img[alt]")) {
            const alt = image.getAttribute("alt");
            if (!alt || !from.includes(alt)) continue;
            let host = image.parentElement;
            for (let depth = 0; host && depth < 4 && container.contains(host); depth++) {
                if (!seen.has(host)) {
                    seen.add(host);
                    const shown = displayText(host).trim();
                    if (shown === from || (loose && looseName(shown) === loose)) return host;
                }
                host = host.parentElement;
            }
        }
        return null;
    }

    // Puts the custom name into the first text node, blanks the rest and hides the emoji
    // images with an attribute. Nothing is removed, so React keeps owning every node.
    renameHost(host, to) {
        const texts = [];
        const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) texts.push(node);
        if (!texts.length) return false;
        if (texts[0].nodeValue !== to) this.setText(texts[0], to);
        for (let i = 1; i < texts.length; i++) {
            if (texts[i].nodeValue !== "") this.setText(texts[i], "");
        }
        for (const image of host.querySelectorAll("img")) {
            if (image.getAttribute(HIDE_ATTR) !== "1") this.setAttr(image, HIDE_ATTR, "1");
        }
        return true;
    }

    // Logged once per channel so a name that stopped matching is easy to see in the console.
    reportMismatch(container, entry) {
        if (this.reported.has(entry.from)) return;
        this.reported.add(entry.from);
        const shown = displayText(container).trim().replace(/\s+/g, " ").slice(0, 80);
        this.log(`Δεν ταίριαξε το όνομα "${entry.from}" → "${entry.to}" · στο DOM: "${shown}"`);
    }

    // Message headers: the author's avatar URL contains the user id, which also catches
    // display names that are not in the USERS list.
    renameMessageAuthors(root) {
        const images = root.matches?.('img[src*="/avatars/"]') ? [root] : [];
        images.push(...root.querySelectorAll('img[src*="/avatars/"]'));
        for (const image of images) {
            const id = /\/avatars\/(\d+)\//.exec(image.getAttribute("src") || "")?.[1];
            const user = id && this.usersById.get(id);
            if (!user) continue;
            if (image.closest('[id^="message-reply-context-"], [id^="message-accessories-"], [id^="message-content-"]')) continue;
            const message = image.closest('[id^="chat-messages-"]');
            const host = message?.querySelector('[id^="message-username-"]');
            if (!host) continue;
            const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
            let node = walker.nextNode();
            while (node && !node.nodeValue.trim()) node = walker.nextNode();
            if (!node) continue;
            if (node.nodeValue !== user.target) this.setText(node, user.target);
            if (this.inGuild) this.setColor(node.parentElement, user.color);
            const labelled = node.parentElement?.closest("[data-text]");
            if (labelled && host.contains(labelled) && labelled.getAttribute("data-text") !== user.target) {
                this.setAttr(labelled, "data-text", user.target);
            }
        }
    }

    // ── change tracking ───────────────────────────────────────

    setText(node, value) {
        const known = this.textChanges.get(node);
        if (!known || known.applied !== node.nodeValue) this.textChanges.set(node, { original: node.nodeValue, applied: value });
        else known.applied = value;
        node.nodeValue = value;
    }

    setAttr(element, attr, value) {
        let attrs = this.attrChanges.get(element);
        if (!attrs) {
            attrs = new Map();
            this.attrChanges.set(element, attrs);
        }
        const current = element.getAttribute(attr);
        const known = attrs.get(attr);
        if (!known || known.applied !== current) attrs.set(attr, { original: current, applied: value });
        else known.applied = value;
        element.setAttribute(attr, value);
    }

    setColor(element, color) {
        if (!element) return;
        const before = element.style.color;
        element.style.color = color;
        const applied = element.style.color;
        if (before === applied) return;
        const known = this.colorChanges.get(element);
        if (!known || known.applied !== before) this.colorChanges.set(element, { original: before, applied });
        else known.applied = applied;
    }

    prune() {
        const total = this.textChanges.size + this.attrChanges.size + this.colorChanges.size;
        if (total < MAX_TRACKED) return;
        for (const map of [this.textChanges, this.attrChanges, this.colorChanges]) {
            for (const node of map.keys()) {
                if (!node.isConnected) map.delete(node);
            }
        }
    }

    // Puts back only what still shows our value; anything Discord re-rendered since is left alone.
    revertAll() {
        let restored = 0;
        for (const [node, change] of this.textChanges) {
            if (node.isConnected && node.nodeValue === change.applied) {
                node.nodeValue = change.original;
                restored++;
            }
        }
        for (const [element, attrs] of this.attrChanges) {
            if (!element.isConnected) continue;
            for (const [attr, change] of attrs) {
                if (element.getAttribute(attr) !== change.applied) continue;
                if (change.original == null) element.removeAttribute(attr);
                else element.setAttribute(attr, change.original);
                restored++;
            }
        }
        for (const [element, change] of this.colorChanges) {
            if (element.isConnected && element.style.color === change.applied) {
                element.style.color = change.original;
                restored++;
            }
        }
        this.textChanges.clear();
        this.attrChanges.clear();
        this.colorChanges.clear();
        return restored;
    }

    log(...args) {
        console.log(
            `%c [${NAME}] %c ${args.join(" ")}`,
            "font-weight: bold; background: #424242; color: white; padding: 4px 8px; border-radius: 6px 0 0 6px;",
            "font-weight: bold; background: #313131; color: white; padding: 4px 8px; border-radius: 0 6px 6px 0;"
        );
    }
};
