/**
 * @name Prezomenoi_OG
 * @author ThomasT
 * @authorId 706932839907852389
 * @version 2.6.2
 * @description This plugin dynamically renames channels, categories, users, 
 * and the window title in the Prezomenoi OG
 */

module.exports = class RenameChannel {
    constructor() {}

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
            "324631108731928587": { name: "Simple Poll", color: "#FFD700" }
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
    
        // Απλή αντικατάσταση σε κείμενο
        this.replaceTextInNode(rootNode, "Prezomenoi OG", "Ghost Server");
        this.replaceTextInNode(rootNode, "☌⟟⏃⋏⋏⟟☊", "Giannhs");
        this.replaceTextInNode(rootNode, "⏚⏃⋏⍜☊☌⍀⍙⍾⏃⍜⎅⟟", "Akrivos");
        this.replaceTextInNode(rootNode, "スパイダーマン", "Mpillias");
        this.replaceTextInNode(rootNode, "アスタ", "Petros");
        this.replaceTextInNode(rootNode, "ANNOUSKA", "Eirini");
        this.replaceTextInNode(rootNode, "FlaviBot", "FlaviBot");
        this.replaceTextInNode(rootNode, "Simple Poll", "Simple Poll");
    
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
        // Refresh by re-running renameAll to clean up
        this.renameAll();
    }
};