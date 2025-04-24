/**
 * @name 1Prezomenoi_OG
 * @version 2.6.2
 * @description Μαρκάρει φακέλους ως αναγνωσμένους με βάση τα ID τους, με το παλιό δεξί κλικ + click, responsive UI, Material-style settings και έλεγχο τιμών.
 * @author ThomasT
 * @authorId 706932839907852389
 * @source https://github.com/thomasthanos/1st-theme/blob/main/Discord_DEV/Plugins/Prezomenoi_OG.plugin.js
 * @updateUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/Prezomenoi_OG.plugin.js
 * @downloadUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/Prezomenoi_OG.plugin.js
 * @website https://github.com/thomasthanos
 */

module.exports = class RenameChannel {
    // Ρυθμίσεις για αποθήκευση δεδομένων
    defaultSettings = {
        enabled: true // Παράδειγμα ρύθμισης, μπορείς να προσθέσεις περισσότερες
    };

    // Κατασκευαστής για αποθήκευση ρυθμίσεων
    constructor() {
        this.settings = Object.assign({}, this.defaultSettings, BdApi.loadData("Prezomenoi_OG", "settings") || {});
        this._justUpdated = false;
        this._updateInProgress = false;
    }

    start() {
        // Inject CSS for guild icons and styling
        const style = document.createElement('style');
        style.id = 'prezomenoi-og-style';
        style.textContent = `
            /* Guild icon για το sidebar */
            [data-list-item-id="guildsnav___1216757265391161537"] img {
                content: url("https://i.postimg.cc/vmvDRcRr/Chat-GPT-Image-14-2025-07-08-17.png") !important;
                object-fit: cover;
                border-radius: 20% !important;
                background-color: #000 !important;
                transform: scale(2) translateX(0px) translateY(8px);
            }
            /* Εικονίδιο για το title */
            .prezomenoi-og-active .icon_f34534.guildIcon__85643.iconSizeMini_f34534.iconActiveMini_f34534 {
                background-image: url("https://i.postimg.cc/vmvDRcRr/Chat-GPT-Image-14-2025-07-08-17.png") !important;
                background-size: cover !important;
                border-radius: 20% !important;
            }
            /* Επαναφορά του font-size για usernames σε voice calls */
            .prezomenoi-og-active [class*="voiceUser"] [class*="username"],
            .prezomenoi-og-active [class*="voiceUser"] [class*="name"] {
                font-size: 14.5px !important; /* Το default μέγεθος του Discord για voice calls */
            }
        `;
        document.head.appendChild(style);

        // Perform renaming
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
        if (!this.isCorrectGuild()) {
            this.removeNoRoleCss();
            return;
        }
        this.renameChannels();
        this.renameCategories();
        this.renameHeaderTitle();
        this.renameUsers();
        this.renameRepliedMessages();
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
            "633412575601623049": { name: "Petros", color: "#206694" },
            "804860278788456469": { name: "Eirini", color: "#FF69B4" },
            "684773505157431347": { name: "FlaviBot", color: "#FFD700" },
            "324631108731928587": { name: "Simple Poll", color: "#FFD700" },
            "778355613373693953": { name: "Andreas", color: "#8B0000" }
        };

        // 1) Mapping μέσω custom avatar
        const allUsernameDivs = document.querySelectorAll("div[class*='username']");
        allUsernameDivs.forEach(div => {
            const avatarDiv = div.closest(".content__07f91")?.querySelector(".userAvatar__55bab");
            const isVoiceCall = div.closest("[class*='voiceUser']"); // Ελέγχουμε αν είναι σε voice call

            if (!avatarDiv && !isVoiceCall) return; // Αν δεν υπάρχει avatar και δεν είναι voice call, συνεχίζουμε

            let userId;
            if (avatarDiv) {
                const match = avatarDiv.style.backgroundImage.match(/avatars\/(\d+)\//);
                if (!match) return;
                userId = match[1];
            } else if (isVoiceCall) {
                // Ελέγχουμε το user ID μέσω άλλου τρόπου για voice calls (π.χ. data attributes)
                const voiceUserDiv = div.closest("[class*='voiceUser']");
                if (!voiceUserDiv) return;
                const userIdMatch = voiceUserDiv.getAttribute("data-user-id") || voiceUserDiv.id?.match(/voice-user-(\d+)/)?.[1];
                if (!userIdMatch) return;
                userId = userIdMatch;
            }

            const userInfo = userMap[userId];
            if (userInfo) {
                // Αποθηκεύουμε το αρχικό font-size πριν την αλλαγή
                const computedStyle = window.getComputedStyle(div);
                const originalFontSize = computedStyle.fontSize;

                div.textContent = userInfo.name;
                div.style.color = userInfo.color;

                // Επαναφέρουμε το font-size αν είναι σε voice call
                if (isVoiceCall) {
                    div.style.fontSize = originalFontSize; // Επαναφέρουμε το αρχικό μέγεθος
                }
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
            { fallback: "Simple Poll", name: "Simple Poll", color: "#FFD700" },
            { fallback: "Kontosouvli lover", name: "Andreas", color: "#8B0000" }
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
            "[aria-label*='Simple Poll'], " +
            "[aria-label*='Kontosouvli lover']"
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
            if (oldAria.includes("@Kontosouvli lover"))
                el.setAttribute("aria-label", oldAria.replace("@Kontosouvli lover", "Andreas"));
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
                if (trimmed === "Kontosouvli lover") {
                    el.textContent = "Andreas";
                    el.style.color = "#8B0000";
                }
            }
        });
    }

    /* -------------------- TEXT REPLACEMENT -------------------- */
    textReplace(rootNode) {
        if (!rootNode) return;
    
        // Απλή αντικατάσταση σε κείμενο
        this.replaceTextInNode(rootNode, "Prezomenoi OG", "Ghost Server");
        this.replaceTextInNode(rootNode, "☌⟟⏃⋏⋏⟟☊", "Giannhs");
        this.replaceTextInNode(rootNode, "⏚⏃⋏⍜☊☌⍀⍙⍾⏃⍜⎅⟟", "Akrivos");
        this.replaceTextInNode(rootNode, "スパイダーマン", "Mpillias");
        this.replaceTextInNode(rootNode, "アスタ", "Petros");
        this.replaceTextInNode(rootNode, "ANNOUSKA", "Eirini");
        this.replaceTextInNode(rootNode, "FlaviBot", "FlaviBot");
        this.replaceTextInNode(rootNode, "Simple Poll", "Simple Poll");
        this.replaceTextInNode(rootNode, "@Kontosouvli lover", "Andreas");
    
        // Αντικατάσταση σε attributes (aria-label, data-text, title, alt)
        const elementsWithAttrs = rootNode.querySelectorAll("[aria-label], [data-text], [title], [alt]");
        elementsWithAttrs.forEach(el => {
            const ariaVal = el.getAttribute("aria-label");
            if (ariaVal && ariaVal.includes("Prezomenoi OG")) {
                el.setAttribute("aria-label", ariaVal.replace("Prezomenoi OG", "Prezomenoi LOCAL"));
            }
    
            const dtVal = el.getAttribute("data-text");
            if (dtVal && dtVal.includes("Prezomenoi OG")) {
                el.setAttribute("data-text", dtVal.replace("Prezomenoi OG", "Prezomenoi LOCAL"));
                if (el.textContent.includes("Prezomenoi OG"))
                    el.textContent = el.textContent.replace("Prezomenoi OG", "Prezomenoi LOCAL");
            }
    
            if (ariaVal && ariaVal.includes("☌⟟⏃⋏⋏⟟☊"))
                el.setAttribute("aria-label", ariaVal.replace("☌⟟⏃⋏⋏⟟☊", "Giannhs"));
            if (ariaVal && ariaVal.includes("⏚⏃⋏⍜☊☌⍀⍙⍾⏃⍜⎅⟟"))
                el.setAttribute("aria-label", ariaVal.replace("⏚⏃⋏⍜☊☌⍀⍙⍾⏃⍜⎅⟟", "Akrivos"));
            if (ariaVal && ariaVal.includes("スパイダーマン"))
                el.setAttribute("aria-label", ariaVal.replace("スパイダーマン", "Mpillias"));
            if (ariaVal && ariaVal.includes("アスタ"))
                el.setAttribute("aria-label", ariaVal.replace("アスタ", "Petros"));
            if (ariaVal && ariaVal.includes("ANNOUSKA"))
                el.setAttribute("aria-label", ariaVal.replace("ANNOUSKA", "Eirini"));
            if (ariaVal && ariaVal.includes("FlaviBot"))
                el.setAttribute("aria-label", ariaVal.replace("FlaviBot", "FlaviBot"));
            if (ariaVal && ariaVal.includes("Simple Poll"))
                el.setAttribute("aria-label", ariaVal.replace("Simple Poll", "Simple Poll"));
            if (ariaVal && ariaVal.includes("@Kontosouvli lover"))
                el.setAttribute("aria-label", ariaVal.replace("@Kontosouvli lover", "Andreas"));
    
            if (dtVal && dtVal.includes("☌⟟⏃⋏⋏⟟☊")) {
                el.setAttribute("data-text", dtVal.replace("☌⟟⏃⋏⋏⟟☊", "Giannhs"));
                if (el.textContent.includes("☌⟟⏃⋏⋏⟟☊"))
                    el.textContent = el.textContent.replace("☌⟟⏃⋏⋏⟟☊", "Giannhs");
            }
            if (dtVal && dtVal.includes("⏚⏃⋏⍜☊☌⍀⍙⍾⏃⍜⎅⟟")) {
                el.setAttribute("data-text", dtVal.replace("⏚⏃⋏⍜☊☌⍀⍙⍾⏃⍜⎅⟟", "Akrivos"));
                if (el.textContent.includes("⏚⏃⋏⍜☊☌⍀⍙⍾⏃⍜⎅⟟"))
                    el.textContent = el.textContent.replace("⏚⏃⋏⍜☊☌⍀⍙⍾⏃⍜⎅⟟", "Akrivos");
            }
            if (dtVal && dtVal.includes("スパイダーマン")) {
                el.setAttribute("data-text", dtVal.replace("スパイダーマン", "Mpillias"));
                if (el.textContent.includes("スパイダーマン"))
                    el.textContent = el.textContent.replace("スパイダーマン", "Mpillias");
            }
            if (dtVal && dtVal.includes("アスタ")) {
                el.setAttribute("data-text", dtVal.replace("アスタ", "Petros"));
                if (el.textContent.includes("アスタ"))
                    el.textContent = el.textContent.replace("アスタ", "Petros");
            }
            if (dtVal && dtVal.includes("ANNOUSKA")) {
                el.setAttribute("data-text", dtVal.replace("ANNOUSKA", "Eirini"));
                if (el.textContent.includes("ANNOUSKA"))
                    el.textContent = el.textContent.replace("ANNOUSKA", "Eirini");
            }
            if (dtVal && dtVal.includes("FlaviBot")) {
                el.setAttribute("data-text", dtVal.replace("FlaviBot", "FlaviBot"));
                if (el.textContent.includes("FlaviBot"))
                    el.textContent = el.textContent.replace("FlaviBot", "FlaviBot");
            }
            if (dtVal && dtVal.includes("Simple Poll")) {
                el.setAttribute("data-text", dtVal.replace("Simple Poll", "Simple Poll"));
                if (el.textContent.includes("Simple Poll"))
                    el.textContent = el.textContent.replace("Simple Poll", "Simple Poll");
            }
            if (dtVal && dtVal.includes("@Kontosouvli lover")) {
                el.setAttribute("data-text", dtVal.replace("@Kontosouvli lover", "Andreas"));
                if (el.textContent.includes("@Kontosouvli lover"))
                    el.textContent = el.textContent.replace("@Kontosouvli lover", "Andreas");
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
            "1357173641745404006": "☘️〢Drugs",
            "1355323003084341359": "🌐〢Nord VPN",
            "1216757265936154689": "📞〢Larose",
            "1250083136818122813": "☣️〢Karkinos",
            "1216761517194739936": "⚖️〢Dikastirio",
            "1216818976898941068": "🎬〢Movies",
            "1345100969393917953": "🔏〢Secret"
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
        // Refresh by re-running renameAll to clean up
        this.renameAll();
    }

    /* -------------------- SETTINGS PANEL -------------------- */
    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.className = "prezomenoi-og-container bd-addon-settings-wrap";
        panel.style = `
            display: flex;
            flex-direction: column;
            gap: 20px;
            max-width: 500px;
            width: 100%;
            margin: 0 auto;
            padding: 24px;
            background: linear-gradient(145deg, #1A1A1E, #202023);
            border-radius: 16px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3);
            color: #e0e0e0;
            font-family: 'Roboto', 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif;
            box-sizing: border-box;
            overflow: hidden;
        `;

        const style = document.createElement("style");
        style.textContent = `
            .prezomenoi-og-label {
                font-weight: 500;
                font-size: 14px;
                color: #b0bec5;
                margin-bottom: 8px;
                text-transform: uppercase;
                letter-spacing: 0.8px;
                text-align: center;
                transition: color 0.2s ease;
            }
            .prezomenoi-og-input, .prezomenoi-og-textarea {
                max-width: 360px;
                width: 100%;
                margin: 0 auto;
                padding: 12px 16px;
                border-radius: 12px;
                background: linear-gradient(145deg,rgb(26, 26, 30),rgb(22, 22, 24));
                color: #e0e0e0;
                border: none;
                box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.2);
                box-sizing: border-box;
                font-size: 14px;
                font-family: 'Roboto', 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif;
                transition: box-shadow 0.3s ease, background 0.3s ease;
                display: block;
            }
            .prezomenoi-og-input:focus, .prezomenoi-og-textarea:focus {
                background: linear-gradient(145deg, #202023, #252528);
                box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4), 0 0 8px rgba(33, 150, 243, 0.5);
                outline: none;
            }
            .prezomenoi-og-textarea {
                min-height: 48px;
                resize: vertical;
                -ms-overflow-style: none;
                scrollbar-width: none;
            }
            .prezomenoi-og-textarea::-webkit-scrollbar {
                display: none;
            }
            .prezomenoi-og-toggle {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 12px;
            }
            .prezomenoi-og-toggle button {
                padding: 10px 20px;
                border: none;
                border-radius: 12px;
                background: linear-gradient(145deg, #0288d1, #0277bd);
                color: #ffffff;
                font-weight: 500;
                font-size: 14px;
                cursor: pointer;
                transition: background 0.3s ease, box-shadow 0.3s ease, transform 0.2s ease;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .prezomenoi-og-toggle button.off {
                background: linear-gradient(145deg, #ارکسا64, #37474f);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            }
            .prezomenoi-og-toggle button:hover {
                background: linear-gradient(145deg, #01579b, #0277bd);
                box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5), 0 3px 6px rgba(0, 0, 0, 0.4);
                transform: translateY(-2px);
            }
            .prezomenoi-og-toggle button.off:hover {
                background: linear-gradient(145deg, #546e7a, #455a64);
            }
            .prezomenoi-og-toggle button:active {
                transform: translateY(0);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            }
        `;
        document.head.appendChild(style);

        const debounce = (fn, wait = 500) => {
            let timeout;
            return (...args) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => fn(...args), wait);
            };
        };

        // Παράδειγμα toggle button για ενεργοποίηση/απενεργοποίηση του plugin
        const createToggleButton = (label, value, key) => {
            const wrapper = document.createElement("div");
            wrapper.className = "prezomenoi-og-toggle";
            const lbl = document.createElement("div");
            lbl.className = "prezomenoi-og-label";
            lbl.textContent = label;
            const button = document.createElement("button");
            button.textContent = value ? "Ενεργό" : "Ανενεργό";
            button.className = value ? "" : "off";
            button.onclick = () => {
                const newVal = !this.settings[key];
                this.settings[key] = newVal;
                BdApi.saveData("Prezomenoi_OG", "settings", this.settings);
                button.textContent = newVal ? "Ενεργό" : "Ανενεργό";
                button.className = newVal ? "" : "off";
                if (newVal) {
                    this.start();
                } else {
                    this.stop();
                }
            };
            wrapper.append(lbl, button);
            return wrapper;
        };

        // Κουμπί ενημέρωσης
        const updateButton = document.createElement("button");
        updateButton.textContent = "Έλεγχος για νέα έκδοση";
        updateButton.style.padding = "12px 24px";
        updateButton.style.marginTop = "16px";
        updateButton.style.background = "#181818";
        updateButton.style.color = "#ffffff";
        updateButton.style.border = "1px solid #444";
        updateButton.style.borderRadius = "8px";
        updateButton.style.fontSize = "14px";
        updateButton.style.fontWeight = "600";
        updateButton.style.transition = "all 0.2s ease-in-out";
        updateButton.style.boxShadow = "0 4px 14px rgba(0, 0, 0, 0.5)";
        updateButton.style.cursor = "pointer";
        updateButton.onmouseenter = () => updateButton.style.background = "#181818";
        updateButton.onmouseleave = () => updateButton.style.background = "#141414";
        updateButton.onclick = () => this.checkForUpdate();

        panel.append(
            createToggleButton("Ενεργοποίηση Plugin", this.settings.enabled, "enabled"),
            updateButton
        );

        return panel;
    }

    /* -------------------- UPDATE FUNCTIONALITY -------------------- */
    checkForUpdate() {
        const updateUrl = "https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/Prezomenoi_OG.plugin.js?t=" + Date.now();
        const currentVersion = this.getVersion();
        fetch(updateUrl)
            .then(res => res.text())
            .then(code => {
                const remoteVersion = code.match(/@version\s+([^\n]+)/)?.[1].trim();
                if (!remoteVersion) {
                    this.showCustomToast("⚠️ Δεν βρέθηκε απομακρυσμένη έκδοση.", "error");
                    return;
                }
                if (this.isNewerVersion(remoteVersion, currentVersion)) {
                    if (this._justUpdated) {
                        this._justUpdated = false;
                        this.showCustomToast("✅ Είσαι ήδη ενημερωμένος!", "success");
                        return;
                    }
                    this.promptUpdate(updateUrl, remoteVersion);
                } else {
                    this.showCustomToast("🔍 Έχεις ήδη την τελευταία έκδοση (" + currentVersion + ")", "info");
                }
            })
            .catch(err => {
                console.error("Update check failed:", err);
                BdApi.showToast("❌ Σφάλμα σύνδεσης για έλεγχο ενημέρωσης.", { type: "error" });
            });
    }

    isNewerVersion(remote, local) {
        const r = remote.split(".").map(n => parseInt(n));
        const l = local.split(".").map(n => parseInt(n));
        for (let i = 0; i < Math.max(r.length, l.length); i++) {
            if ((r[i] || 0) > (l[i] || 0)) return true;
            if ((r[i] || 0) < (l[i] || 0)) return false;
        }
        return false;
    }

    promptUpdate(url, newVersion) {
        const modal = document.createElement("div");
        modal.style = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        `;

        const box = document.createElement("div");
        box.style = `
            background: #181818;
            border: 1px solid #2a2a2a;
            border-radius: 12px;
            padding: 30px 32px;
            min-width: 420px;
            max-width: 90vw;
            color: #e0e0e0;
            box-shadow: 0 8px 30px rgba(0,0,0,0.7);
            font-family: Segoe UI, sans-serif;
            text-align: center;
            display: flex;
            flex-direction: column;
            gap: 20px;
        `;

        const title = document.createElement("h2");
        title.textContent = "✨ Νέα Έκδοση Διαθέσιμη";
        title.style = "margin: 0; font-size: 22px; color: #ffffff;";

        const desc = document.createElement("p");
        desc.textContent = `Η έκδοση ${newVersion} είναι έτοιμη για εγκατάσταση. Θέλεις να προχωρήσεις;`;
        desc.style = "margin: 0; font-size: 14px; color: #bbbbbb;";

        const buttons = document.createElement("div");
        buttons.style = `
            display: flex;
            justify-content: center;
            gap: 16px;
            margin-top: 10px;
        `;

        const cancel = document.createElement("button");
        cancel.textContent = "Όχι τώρα";
        cancel.style = `padding: 10px 20px; border-radius: 8px; border: 1px solid #888; background: #1e1e1e; color: #ddd; font-weight: 500; cursor: pointer; transition: all 0.2s ease-in-out;`;
        cancel.onclick = () => document.body.removeChild(modal);

        const confirm = document.createElement("button");
        confirm.textContent = "Ενημέρωση";
        confirm.style = `padding: 10px 20px; border-radius: 8px; border: 1px solid #2e7d32; background: linear-gradient(145deg, #2e7d32, #1b5e20); color: #e0f2f1; font-weight: 600; cursor: pointer; transition: all 0.2s ease-in-out; box-shadow: 0 6px 14px rgba(0, 0, 0, 0.6), 0 3px 6px rgba(0, 0, 0, 0.4);`;
        confirm.onclick = () => {
            document.body.removeChild(modal);
            if (this._updateInProgress) return;
            this._updateInProgress = true;
            this.downloadUpdate(url);
        };

        buttons.append(cancel, confirm);
        box.append(title, desc, buttons);
        modal.appendChild(box);
        document.body.appendChild(modal);
    }

    downloadUpdate(url) {
        fetch(url)
            .then(res => res.text())
            .then(content => {
                try {
                    const fs = require("fs");
                    const path = require("path");
                    const filePath = path.join(BdApi.Plugins.folder, "Prezomenoi_OG.plugin.js");
                    fs.writeFileSync(filePath, content, "utf8");
                    this._justUpdated = true;
                    setTimeout(() => BdApi.Plugins.reload("Prezomenoi_OG"), 1000);

                    // Απενεργοποίηση κουμπιού ενημέρωσης
                    try {
                        const btns = document.querySelectorAll("button");
                        for (const btn of btns) {
                            if (btn.textContent.includes("Έλεγχος για νέα έκδοση")) {
                                btn.disabled = true;
                                btn.style.cursor = "not-allowed";
                                btn.textContent = "Ενημερώθηκε!";
                            }
                        }
                        const ModalStack = BdApi.findModuleByProps("push", "pop", "popWithKey");
                        ModalStack?.pop();
                    } catch (e) {
                        console.warn("❌ ModalStack pop failed:", e);
                    }
                } catch (err) {
                    console.error("Update failed:", err);
                    this.showCustomToast("❌ Αποτυχία ενημέρωσης.", "error");
                }
            })
            .catch(() => {
                this.showCustomToast("❌ Αποτυχία σύνδεσης για ενημέρωση.", "error");
            });
    }

    getVersion() {
        return "2.6.2";
    }

    showCustomToast(text, type = "info") {
        const toast = document.createElement("div");
        toast.textContent = text;
        toast.style.position = "fixed";
        toast.style.bottom = "30px";
        toast.style.left = "50%";
        toast.style.transform = "translateX(-50%)";
        toast.style.background = type === "error" ? "#ff4d4f" : type === "success" ? "#4caf50" : "#2f2f2f";
        toast.style.color = "#fff";
        toast.style.padding = "12px 20px";
        toast.style.borderRadius = "8px";
        toast.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.3)";
        toast.style.zIndex = "9999";
        toast.style.fontFamily = "Segoe UI, sans-serif";
        toast.style.transition = "opacity 0.4s ease";
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }
};