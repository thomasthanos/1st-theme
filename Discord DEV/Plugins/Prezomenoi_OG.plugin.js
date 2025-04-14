/**
 * @name Prezomenoi_OG
 * @version 2.6.2
 * @description Plugin που αλλάζει δυναμικά τα ονόματα καναλιών, κατηγοριών, 
 * χρηστών και τον τίτλο παραθύρου μόνο στο guild Prezomenoi OG (ID: 1216757265391161537).
 * Περιλαμβάνει mapping για renames με βάση τα data‑text attributes (π.χ. FlaviBot & Simple Poll με gold)
 * και εφαρμόζει κόκκινο χρώμα (red) στους χρήστες χωρίς role (με το συγκεκριμένο class),
 * αλλά το CSS αυτό τίθεται μόνο στο guild Prezomenoi.
 * Προσθέτει επίσης ένα BDSettings panel με Master Toggle για έλεγχο όλων των features.
 */

module.exports = class RenameChannel {
    constructor() {
        // Initialize settings with a default masterToggle
        this.settings = BdApi.Data.load("Prezomenoi_OG", "settings") || {
            masterToggle: true,
            renameChannels: true,
            renameCategories: true,
            renameUsers: true,
            renameHeader: true,
            renameRepliedMessages: true
        };
    }

    start() {
        // Skip all logic if masterToggle is disabled
        if (!this.settings.masterToggle) return;

        // Inject CSS for guild icons and styling
        const style = document.createElement('style');
        style.id = 'prezomenoi-og-style';
        style.textContent = `
            /* Guild icon για το sidebar */
            [data-list-item-id="guildsnav___1216757265391161537"] img {
                content: url("https://i.postimg.cc/zBLbHXPC/Untitled-Project.jpg") !important;
                object-fit: cover;
                border-radius: 20% !important;
                background-color: #000 !important;
                transform: scale(2) translateX(0px) translateY(8px);
            }
            /* Εικονίδιο για το title */
            .prezomenoi-og-active .icon_f34534.guildIcon__85643.iconSizeMini_f34534.iconActiveMini_f34534 {
                background-image: url("https://i.postimg.cc/zBLbHXPC/Untitled-Project.jpg") !important;
                background-size: cover !important;
                border-radius: 20% !important;
            }
            /* Optional: Style for the BDSettings panel switch */
            .prezomenoi-og-switch .bd-switch-body {
                background-color: var(--brand-experiment) !important;
            }
        `;
        document.head.appendChild(style);

        // Perform renaming if respective settings are enabled
        this.renameAll();

        // Λειτουργία για ενημέρωση του CSS class με βάση το guild ID
        const updateGuildClass = () => {
            if (this.isCorrectGuild()) {
                document.body.classList.add('prezomenoi-og-active');
            } else {
                document.body.classList.remove('prezomenoi-og-active');
            }
        };

        // Εκτέλεση κατά την εκκίνηση
        updateGuildClass();

        // MutationObserver για δυναμικές αλλαγές στο DOM
        this.observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this.renameInNode(node);
                    }
                });
            });
        });
        this.observer.observe(document.body, { childList: true, subtree: true });

        // Παρακολούθηση αλλαγής URL (π.χ. server switch)
        this.currentLocation = window.location.pathname;
        this.locationCheckInterval = setInterval(() => {
            if (window.location.pathname !== this.currentLocation) {
                this.currentLocation = window.location.pathname;
                this.renameAll();
                updateGuildClass();
            }
        }, 500);
    }

    // Επιστρέφει true αν το URL ανήκει στο guild Prezomenoi OG (ID: 1216757265391161537)
    isCorrectGuild() {
        const match = window.location.pathname.match(/^\/channels\/(\d+)\//);
        return match && match[1] === "1216757265391161537";
    }

    // Κεντρική μέθοδος: καλεί όλες τις λειτουργίες ανανέωσης
    renameAll() {
        if (!this.isCorrectGuild() || !this.settings.masterToggle) {
            this.removeNoRoleCss();
            return;
        }
        if (this.settings.renameChannels) this.renameChannels();
        if (this.settings.renameCategories) this.renameCategories();
        if (this.settings.renameHeader) this.renameHeaderTitle();
        if (this.settings.renameUsers) this.renameUsers();
        if (this.settings.renameRepliedMessages) this.renameRepliedMessages();
        this.textReplace(document.body);
    }

    /* -------------------- RENAME CHANNELS & CATEGORIES -------------------- */
    renameChannels() {
        const channels = this.getChannelMap();
        Object.entries(channels).forEach(([channelId, newName]) => {
            const elements = document.querySelectorAll(`[data-list-item-id="channels___${channelId}"]`);
            elements.forEach(el => {
                const nameEl = el.querySelector("div[class*='name']");
                if (nameEl && nameEl.textContent !== newName) {
                    nameEl.textContent = newName;
                }
            });
        });
    }

    renameCategories() {
        const categories = {
            "1216757265936154686": "💬",
            "1216757265936154687": "📱"
        };
        Object.entries(categories).forEach(([categoryId, newName]) => {
            const headers = document.querySelectorAll(`[data-list-item-id="channels___${categoryId}"] h3`);
            headers.forEach(header => {
                const nameEl = header.querySelector("div[class*='overflow']");
                if (nameEl && nameEl.textContent !== newName) {
                    nameEl.textContent = newName;
                }
            });
        });
    }

    renameHeaderTitle() {
        const channels = this.getChannelMap();
        const match = window.location.pathname.match(/channels\/\d+\/(\d+)/);
        if (!match) return;
        const newTitle = channels[match[1]];
        if (!newTitle) return;
        const header = document.querySelector("h1[class*='title__']");
        if (header && header.textContent !== newTitle) {
            header.textContent = newTitle;
        }
    }

    /* ------------------------- RENAME USERS ------------------------- */
    renameUsers() {
        const userMap = {
            "411178013103751190": { name: "Akrivos", color: "#1F8249" },
            "681933873877352472": { name: "Mpillias", color: "#734986" },
            "1076347460500324363": { name: "Giannhs", color: "#1F8249" },
            "633412575601623049": { name: "Petros", color: "#FF4500" },
            "804860278788456469": { name: "Eirini", color: "#FF69B4" },
            "684773505157431347": { name: "FlaviBot", color: "#FFD700" },
            "324631108731928587": { name: "Simple Poll", color: "#FFD700" }
        };

        // 1) Mapping μέσω custom avatar
        const allUsernameDivs = document.querySelectorAll("div[class*='username']");
        allUsernameDivs.forEach(div => {
            const avatarDiv = div.closest(".content__07f91")?.querySelector(".userAvatar__55bab");
            if (!avatarDiv) return;
            const match = avatarDiv.style.backgroundImage.match(/avatars\/(\d+)\//);
            if (!match) return;
            const userId = match[1];
            const userInfo = userMap[userId];
            if (userInfo) {
                div.textContent = userInfo.name;
                div.style.color = userInfo.color;
            }
        });

        // 2) Fallback μέσω data‑text
        const fallbackUsers = [
            { fallback: "☌⟟⏃⋏⋏⟟☊", name: "Giannhs", color: "#1F8249" },
            { fallback: "⏚⏃⋏⍜☊☌⍀⍙⍾⏃⍜⎅⟟", name: "Akrivos", color: "#1F8249" },
            { fallback: "スパイダーマン", name: "Mpillias", color: "#734986" },
            { fallback: "アスタ", name: "Petros", color: "#FF4500" },
            { fallback: "ANNOUSKA", name: "Eirini", color: "#FF69B4" },
            { fallback: "FlaviBot", name: "FlaviBot", color: "#FFD700" },
            { fallback: "Simple Poll", name: "Simple Poll", color: "#FFD700" }
        ];
        fallbackUsers.forEach(user => {
            document.querySelectorAll(`[data-text="${user.fallback}"]`).forEach(el => {
                el.textContent = user.name;
                el.style.color = user.color;
            });
        });

        // 3) Default fallback χρώμα για όλους τους χρήστες χωρίς inline χρώμα
        const defaultCustomColor = "#C0C0C0";
        document.querySelectorAll("div[class*='username']").forEach(div => {
            if (!div.style.color || div.style.color === "") {
                div.style.setProperty("color", defaultCustomColor, "important");
            }
        });
    }

    /* -------------------- RENAME IN REPLIED MESSAGES -------------------- */
    renameRepliedMessages() {
        const replyAriaElements = document.querySelectorAll(
            "[aria-label*='☌⟟⏃⋏⋏⟟☊'], " +
            "[aria-label*='⏚⏃⋏⍜☊☌⍀⍙⍾⏃⍜⎅⟟'], " +
            "[aria-label*='スパイダーマン'], " +
            "[aria-label*='アスタ'], " +
            "[aria-label*='ANNOUSKA'], " +
            "[aria-label*='FlaviBot'], " +
            "[aria-label*='Simple Poll']"
        );
        replyAriaElements.forEach(el => {
            const oldAria = el.getAttribute("aria-label");
            if (!oldAria) return;
            if (oldAria.includes("☌⟟⏃⋏⋏⟟☊"))
                el.setAttribute("aria-label", oldAria.replace("☌⟟⏃⋏⋏⟟☊", "Giannhs"));
            if (oldAria.includes("⏚⏃⋏⍜☊☌⍀⍙⍾⏃⍜⎅⟟"))
                el.setAttribute("aria-label", oldAria.replace("⏚⏃⋏⍜☊☌⍀⍙⍾⏃⍜⎅⟟", "Akrivos"));
            if (oldAria.includes("スパイダーマン"))
                el.setAttribute("aria-label", oldAria.replace("スパイダーマン", "Mpillias"));
            if (oldAria.includes("アスタ"))
                el.setAttribute("aria-label", oldAria.replace("アスタ", "Petros"));
            if (oldAria.includes("ANNOUSKA"))
                el.setAttribute("aria-label", oldAria.replace("ANNOUSKA", "Eirini"));
            if (oldAria.includes("FlaviBot"))
                el.setAttribute("aria-label", oldAria.replace("FlaviBot", "FlaviBot"));
            if (oldAria.includes("Simple Poll"))
                el.setAttribute("aria-label", oldAria.replace("Simple Poll", "Simple Poll"));
        });
        document.querySelectorAll("*").forEach(el => {
            if (el.childElementCount === 0) {
                const trimmed = el.textContent.trim();
                if (trimmed === "☌⟟⏃⋏⋏⟟☊") {
                    el.textContent = "Giannhs";
                    el.style.color = "#1F8249";
                }
                if (trimmed === "⏚⏃⋏⍜☊☌⍀⍙⍾⏃⍜⎅⟟") {
                    el.textContent = "Akrivos";
                    el.style.color = "#1F8249";
                }
                if (trimmed === "スパイダーマン") {
                    el.textContent = "Mpillias";
                    el.style.color = "#734986";
                }
                if (trimmed === "アスタ") {
                    el.textContent = "Petros";
                    el.style.color = "#FF4500";
                }
                if (trimmed === "ANNOUSKA") {
                    el.textContent = "Eirini";
                    el.style.color = "#FF69B4";
                }
                if (trimmed === "FlaviBot") {
                    el.textContent = "FlaviBot";
                    el.style.color = "#FFD700";
                }
                if (trimmed === "Simple Poll") {
                    el.textContent = "Simple Poll";
                    el.style.color = "#FFD700";
                }
            }
        });
    }

    /* -------------------- TEXT REPLACEMENT -------------------- */
    textReplace(rootNode) {
        if (!rootNode) return;
        this.replaceTextInNode(rootNode, "☌⟟⏃⋏⋏⟟☊", "Giannhs");
        this.replaceTextInNode(rootNode, "⏚⏃⋏⍜☊☌⍀⍙⍾⏃⍜⎅⟟", "Akrivos");
        this.replaceTextInNode(rootNode, "スパイダーマン", "Mpillias");
        this.replaceTextInNode(rootNode, "アスタ", "Petros");
        this.replaceTextInNode(rootNode, "ANNOUSKA", "Eirini");
        this.replaceTextInNode(rootNode, "FlaviBot", "FlaviBot");
        this.replaceTextInNode(rootNode, "Simple Poll", "Simple Poll");

        const elementsWithAttrs = rootNode.querySelectorAll("[aria-label], [data-text], [title], [alt]");
        elementsWithAttrs.forEach(el => {
            const ariaVal = el.getAttribute("aria-label");
            if (ariaVal) {
                if (ariaVal.includes("☌⟟⏃⋏⋏⟟☊"))
                    el.setAttribute("aria-label", ariaVal.replace("☌⟟⏃⋏⋏⟟☊", "Giannhs"));
                if (ariaVal.includes("⏚⏃⋏⍜☊☌⍀⍙⍾⏃⍜⎅⟟"))
                    el.setAttribute("aria-label", ariaVal.replace("⏚⏃⋏⍜☊☌⍀⍙⍾⏃⍜⎅⟟", "Akrivos"));
                if (ariaVal.includes("スパイダーマン"))
                    el.setAttribute("aria-label", ariaVal.replace("スパイダーマン", "Mpillias"));
                if (ariaVal.includes("アスタ"))
                    el.setAttribute("aria-label", ariaVal.replace("アスタ", "Petros"));
                if (ariaVal.includes("ANNOUSKA"))
                    el.setAttribute("aria-label", ariaVal.replace("ANNOUSKA", "Eirini"));
                if (ariaVal.includes("FlaviBot"))
                    el.setAttribute("aria-label", ariaVal.replace("FlaviBot", "FlaviBot"));
                if (ariaVal.includes("Simple Poll"))
                    el.setAttribute("aria-label", ariaVal.replace("Simple Poll", "Simple Poll"));
            }
            const dtVal = el.getAttribute("data-text");
            if (dtVal) {
                if (dtVal.includes("☌⟟⏃⋏⋏⟟☊")) {
                    el.setAttribute("data-text", dtVal.replace("☌⟟⏃⋏⋏⟟☊", "Giannhs"));
                    if (el.textContent.includes("☌⟟⏃⋏⋏⟟☊"))
                        el.textContent = el.textContent.replace("☌⟟⏃⋏⋏⟟☊", "Giannhs");
                }
                if (dtVal.includes("⏚⏃⋏⍜☊☌⍀⍙⍾⏃⍜⎅⟟")) {
                    el.setAttribute("data-text", dtVal.replace("⏚⏃⋏⍜☊☌⍀⍙⍾⏃⍜⎅⟟", "Akrivos"));
                    if (el.textContent.includes("⏚⏃⋏⍜☊☌⍀⍙⍾⏃⍜⎅⟟"))
                        el.textContent = el.textContent.replace("⏚⏃⋏⍜☊☌⍀⍙⍾⏃⍜⎅⟟", "Akrivos");
                }
                if (dtVal.includes("スパイダーマン")) {
                    el.setAttribute("data-text", dtVal.replace("スパイダーマン", "Mpillias"));
                    if (el.textContent.includes("スパイダーマン"))
                        el.textContent = el.textContent.replace("スパイダーマン", "Mpillias");
                }
                if (dtVal.includes("アスタ")) {
                    el.setAttribute("data-text", dtVal.replace("アスタ", "Petros"));
                    if (el.textContent.includes("アスタ"))
                        el.textContent = el.textContent.replace("アスタ", "Petros");
                }
                if (dtVal.includes("ANNOUSKA")) {
                    el.setAttribute("data-text", dtVal.replace("ANNOUSKA", "Eirini"));
                    if (el.textContent.includes("ANNOUSKA"))
                        el.textContent = el.textContent.replace("ANNOUSKA", "Eirini");
                }
                if (dtVal.includes("FlaviBot")) {
                    el.setAttribute("data-text", dtVal.replace("FlaviBot", "FlaviBot"));
                    if (el.textContent.includes("FlaviBot"))
                        el.textContent = el.textContent.replace("FlaviBot", "FlaviBot");
                }
                if (dtVal.includes("Simple Poll")) {
                    el.setAttribute("data-text", dtVal.replace("Simple Poll", "Simple Poll"));
                    if (el.textContent.includes("Simple Poll"))
                        el.textContent = el.textContent.replace("Simple Poll", "Simple Poll");
                }
            }
        });
    }

    /* -------------------- HELPER FUNCTIONS -------------------- */
    replaceTextInNode(node, oldStr, newStr) {
        if (!node) return;
        if (node.nodeType === Node.TEXT_NODE) {
            if (node.nodeValue.includes(oldStr))
                node.nodeValue = node.nodeValue.replaceAll(oldStr, newStr);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            node.childNodes.forEach(child => {
                this.replaceTextInNode(child, oldStr, newStr);
            });
        }
    }

    renameInNode(node) {
        this.textReplace(node);
    }

    getChannelMap() {
        return {
            "1216778033550196856": "📜〢Rules",
            "1217201547054944377": "🎵〢Music",
            "1216757354574385203": "💬〢Chat",
            "1333458086094045385": "📽️〢Clips",
            "1344770404023144550": "📰〢Epikairotita",
            "1357173641745404006": "🔒〢Password",
            "1355323003084341359": "📝〢Notes",
            "1216757265936154689": "📞〢Larose",
            "1250083136818122813": "☣️〢Karkinos",
            "1216761517194739936": "⚖️〢Dikastirio",
            "1216818976898941068": "🎬〢Movies"
        };
    }

    removeNoRoleCss() {
        const s = document.getElementById("noRoleCustomCss");
        if (s) s.remove();
    }

    stop() {
        if (this.observer) this.observer.disconnect();
        if (this.locationCheckInterval) clearInterval(this.locationCheckInterval);
        const style = document.getElementById("prezomenoi-og-style");
        if (style) style.remove();
    }

    /* -------------------- BDSETTINGS PANEL -------------------- */
    getSettingsPanel() {
        const settings = [
            {
                type: "switch",
                id: "masterToggle",
                name: "Enable ALL Features (Master Switch)",
                note: "Toggle all renaming features at once",
                value: this.settings.masterToggle
            },
            {
                type: "switch",
                id: "renameChannels",
                name: "Rename Channels",
                note: "Enable renaming of channels",
                value: this.settings.renameChannels
            },
            {
                type: "switch",
                id: "renameCategories",
                name: "Rename Categories",
                note: "Enable renaming of categories",
                value: this.settings.renameCategories
            },
            {
                type: "switch",
                id: "renameUsers",
                name: "Rename Users",
                note: "Enable renaming of users",
                value: this.settings.renameUsers
            },
            {
                type: "switch",
                id: "renameHeader",
                name: "Rename Header Title",
                note: "Enable renaming of the header title",
                value: this.settings.renameHeader
            },
            {
                type: "switch",
                id: "renameRepliedMessages",
                name: "Rename Replied Messages",
                note: "Enable renaming in replied messages",
                value: this.settings.renameRepliedMessages
            }
        ];

        return BdApi.UI.buildSettingsPanel({
            settings: settings,
            onChange: (category, id, value) => {
                let newSettings = { ...this.settings, [id]: value };

                // Master Toggle logic: Enable/Disable all features
                if (id === "masterToggle") {
                    if (value === true) {
                        Object.keys(newSettings).forEach(key => {
                            if (key !== "masterToggle") newSettings[key] = true;
                        });
                    } else {
                        Object.keys(newSettings).forEach(key => {
                            if (key !== "masterToggle") newSettings[key] = false;
                        });
                    }
                }

                this.saveSettings(newSettings);

                // Restart plugin to apply changes
                this.stop();
                this.start();
            }
        });
    }

    saveSettings(newSettings) {
        this.settings = newSettings;
        BdApi.Data.save("Prezomenoi_OG", "settings", newSettings);
    }
};