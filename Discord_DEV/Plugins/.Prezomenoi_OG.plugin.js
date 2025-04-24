/**
 * @name 1Prezomenoi_OG
 * @version 6.0.1
 * @description Μαρκάρει φακέλους ως αναγνωσμένους με βάση τα ID τους, με το παλιό δεξί κλικ + click, responsive UI, Material-style settings και έλεγχο τιμών.
 * @author ThomasT
 * @authorId 706932839907852389
 * @source https://github.com/thomasthanos/1st-theme/blob/main/Discord_DEV/Plugins/Prezomenoi_OG.plugin.js
 * @updateUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/.Prezomenoi_OG.plugin.js
 * @website https://github.com/thomasthanos
 */

module.exports = class RenameChannel {
    constructor() {
        this._justUpdated = false;
        this._updateInProgress = false;
        this.modal = null;
        this.iconButton = null;
        this.observer = null;
        this.locationCheckInterval = null;
    }

    start() {
        console.log("[Prezomenoi_OG] Starting plugin...");
        const style = document.createElement('style');
        style.id = 'prezomenoi-og-style';
        style.textContent = `
            [data-list-item-id="guildsnav___1216757265391161537"] img {
                content: url("https://i.postimg.cc/vmvDRcRr/Chat-GPT-Image-14-2025-07-08-17.png") !important;
                object-fit: cover;
                border-radius: 20% !important;
                background-color: #000 !important;
                transform: scale(2) translateX(0px) translateY(8px);
            }
            .prezomenoi-og-active .icon_f34534.guildIcon__85643.iconSizeMini_f34534.iconActiveMini_f34534 {
                background-image: url("https://i.postimg.cc/vmvDRcRr/Chat-GPT-Image-14-2025-07-08-17.png") !important;
                background-size: cover !important;
                border-radius: 20% !important;
            }
            .prezomenoi-og-active [class*="voiceUser"] [class*="username"],
            .prezomenoi-og-active [class*="voiceUser"] [class*="name"] {
                font-size: 14.5px !important;
            }
        `;
        document.head.appendChild(style);

        this.renameAll();

        const updateGuildClass = () => {
            if (this.isCorrectGuild()) {
                document.body.classList.add('prezomenoi-og-active');
            } else {
                document.body.classList.remove('prezomenoi-og-active');
            }
        };

        updateGuildClass();

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

        this.currentLocation = window.location.pathname;
        this.locationCheckInterval = setInterval(() => {
            if (window.location.pathname !== this.currentLocation) {
                this.currentLocation = window.location.pathname;
                this.renameAll();
                updateGuildClass();
            }
        }, 500);

        this.injectIcon();
    }

    isCorrectGuild() {
        const match = window.location.pathname.match(/^\/channels\/(\d+)\//);
        return match && match[1] === "1216757265391161537";
    }

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

        const allUsernameDivs = document.querySelectorAll("div[class*='username']");
        allUsernameDivs.forEach(div => {
            const avatarDiv = div.closest(".content__07f91")?.querySelector(".userAvatar__55bab");
            const isVoiceCall = div.closest("[class*='voiceUser']");

            if (!avatarDiv && !isVoiceCall) return;

            let userId;
            if (avatarDiv) {
                const match = avatarDiv.style.backgroundImage.match(/avatars\/(\d+)\//);
                if (!match) return;
                userId = match[1];
            } else if (isVoiceCall) {
                const voiceUserDiv = div.closest("[class*='voiceUser']");
                if (!voiceUserDiv) return;
                const userIdMatch = voiceUserDiv.getAttribute("data-user-id") || voiceUserDiv.id?.match(/voice-user-(\d+)/)?.[1];
                if (!userIdMatch) return;
                userId = userIdMatch;
            }

            const userInfo = userMap[userId];
            if (userInfo) {
                const computedStyle = window.getComputedStyle(div);
                const originalFontSize = computedStyle.fontSize;

                div.textContent = userInfo.name;
                div.style.color = userInfo.color;

                if (isVoiceCall) {
                    div.style.fontSize = originalFontSize;
                }
            }
        });

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

        const defaultCustomColor = "#C0C0C0";
        document.querySelectorAll("div[class*='username']").forEach(div => {
            if (!div.style.color || div.style.color === "") {
                div.style.setProperty("color", defaultCustomColor, "important");
            }
        });
    }

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

    textReplace(rootNode) {
        if (!rootNode) return;

        this.replaceTextInNode(rootNode, "Prezomenoi OG", "Ghost Server");
        this.replaceTextInNode(rootNode, "☌⟟⏃⋏⋏⟟☊", "Giannhs");
        this.replaceTextInNode(rootNode, "⏚⏃⋏⍜☊☌⍀⍙⍾⏃⍜⎅⟟", "Akrivos");
        this.replaceTextInNode(rootNode, "スパイダーマン", "Mpillias");
        this.replaceTextInNode(rootNode, "アスタ", "Petros");
        this.replaceTextInNode(rootNode, "ANNOUSKA", "Eirini");
        this.replaceTextInNode(rootNode, "FlaviBot", "FlaviBot");
        this.replaceTextInNode(rootNode, "Simple Poll", "Simple Poll");
        this.replaceTextInNode(rootNode, "@Kontosouvli lover", "Andreas");

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
        console.log("[Prezomenoi_OG] Stopping plugin...");
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        if (this.locationCheckInterval) {
            clearInterval(this.locationCheckInterval);
            this.locationCheckInterval = null;
        }
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
        this.removeIcon();
        const style = document.getElementById("prezomenoi-og-style");
        if (style) style.remove();
        this.renameAll();
    }

    injectIcon() {
        const pluginCards = document.querySelectorAll('[class*="bd-addon-card"]');

        let pluginCard = null;
        pluginCards.forEach(card => {
            const titleElement = card.querySelector('[class*="bd-addon-header"]');
            if (titleElement && titleElement.textContent.includes("1Prezomenoi_OG")) {
                pluginCard = card;
            }
        });

        if (pluginCard) {
            const controls = pluginCard.querySelector('[class*="bd-controls"]');
            if (controls) {
                if (!controls.querySelector('[aria-label="Plugin Updater"]')) {
                    this.createAndInjectIcon(controls);
                }
            }
        } else {
            console.warn("[Prezomenoi_OG] 1Prezomenoi_OG plugin card not found");
        }

        // Fallback interval to check every 500ms if the icon is missing
        this.iconCheckInterval = setInterval(() => {
            const pluginCards = document.querySelectorAll('[class*="bd-addon-card"]');
            let pluginCard = null;
            pluginCards.forEach(card => {
                const titleElement = card.querySelector('[class*="bd-addon-header"]');
                if (titleElement && titleElement.textContent.includes("1Prezomenoi_OG")) {
                    pluginCard = card;
                }
            });

            if (pluginCard) {
                const controls = pluginCard.querySelector('[class*="bd-controls"]');
                if (controls && !controls.querySelector('[aria-label="Plugin Updater"]')) {
                    console.log("[Prezomenoi_OG] Icon missing, re-injecting via interval...");
                    this.createAndInjectIcon(controls);
                }
            }
        }, 500);

        this.startObserver();
    }

    startObserver() {
        if (this.observer) {
            return;
        }

        const targetNode = document.body;
        const config = { childList: true, subtree: true };

        this.observer = new MutationObserver((mutations, observer) => {
            const pluginCards = document.querySelectorAll('[class*="bd-addon-card"]');
            let pluginCard = null;
            pluginCards.forEach(card => {
                const titleElement = card.querySelector('[class*="bd-addon-header"]');
                if (titleElement && titleElement.textContent.includes("1Prezomenoi_OG")) {
                    pluginCard = card;
                }
            });

            if (pluginCard) {
                const controls = pluginCard.querySelector('[class*="bd-controls"]');
                if (controls) {
                    if (!controls.querySelector('[aria-label="Plugin Updater"]')) {
                        this.createAndInjectIcon(controls);
                    }
                } else {
                    console.warn("[Prezomenoi_OG] Controls section not found in plugin card via observer");
                }
            }
        });

        this.observer.observe(targetNode, config);
    }

    createAndInjectIcon(controls) {
        const iconButton = document.createElement("button");
        iconButton.setAttribute("aria-label", "Plugin Updater");
        iconButton.className = "bd-button bd-button-filled bd-addon-button bd-button-color-brand";
        iconButton.style.cursor = "pointer";
        iconButton.style.padding = "0";
        iconButton.style.marginLeft = "0px";
        iconButton.style.display = "flex";
        iconButton.style.alignItems = "center";
        iconButton.style.justifyContent = "center";
        iconButton.style.width = "30px";
        iconButton.style.height = "30px";
        iconButton.style.borderRadius = "50%";
        iconButton.style.transition = "background 0.2s ease";
        iconButton.style.zIndex = "1000";

        iconButton.onmouseover = () => {
            iconButton.style.background = "rgba(255, 255, 255, 0.1)";
        };
        iconButton.onmouseout = () => {
            iconButton.style.background = "none";
        };

        const svgIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgIcon.setAttribute("width", "16");
        svgIcon.setAttribute("height", "16");
        svgIcon.setAttribute("viewBox", "0 0 24 24");
        svgIcon.setAttribute("fill", "none");
        svgIcon.setAttribute("stroke", "currentColor");
        svgIcon.setAttribute("stroke-width", "2");
        svgIcon.setAttribute("stroke-linecap", "round");
        svgIcon.setAttribute("stroke-linejoin", "round");
        svgIcon.innerHTML = `
            <path d="M12 2a10 10 0 0 1 10 10c0 2.5-1 4.8-2.6 6.5l-3.5-3.5"></path>
            <path d="M12 22a10 10 0 0 1-10-10c0-2.5 1-4.8 2.6-6.5l3.5 3.5"></path>
            <path d="M8.1 8.1L2 4"></path>
            <path d="M15.9 15.9L22 20"></path>
        `;
        iconButton.appendChild(svgIcon);

        iconButton.onclick = () => this.openModal();
        controls.appendChild(iconButton);
        this.iconButton = iconButton;
    }

    removeIcon() {
        if (this.iconButton) {
            this.iconButton.remove();
            this.iconButton = null;
        }
        if (this.iconCheckInterval) {
            console.log("[Prezomenoi_OG] Stopping icon check interval...");
            clearInterval(this.iconCheckInterval);
            this.iconCheckInterval = null;
        }
    }

    openModal() {
        console.log("[Prezomenoi_OG] Opening modal...");
        if (this.modal) {
            this.modal.remove();
        }

        const modalOverlay = document.createElement("div");
        modalOverlay.style.position = "fixed";
        modalOverlay.style.top = "0";
        modalOverlay.style.left = "0";
        modalOverlay.style.width = "100%";
        modalOverlay.style.height = "100%";
        modalOverlay.style.background = "linear-gradient(180deg, rgba(10, 10, 20, 0.9) 0%, rgba(20, 20, 40, 0.9) 100%)";
        modalOverlay.style.backdropFilter = "blur(5px)";
        modalOverlay.style.display = "flex";
        modalOverlay.style.alignItems = "center";
        modalOverlay.style.justifyContent = "center";
        modalOverlay.style.zIndex = "1000";
        modalOverlay.style.opacity = "0";
        modalOverlay.style.transition = "opacity 0.5s ease";

        setTimeout(() => {
            modalOverlay.style.opacity = "1";
        }, 10);

        const modalContent = document.createElement("div");
        modalContent.style.padding = "30px";
        modalContent.style.background = "rgba(25, 25, 35, 0.7)";
        modalContent.style.border = "1px solid rgba(255, 255, 255, 0.1)";
        modalContent.style.borderRadius = "20px";
        modalContent.style.backdropFilter = "blur(15px)";
        modalContent.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.6), inset 0 0 10px rgba(255, 255, 255, 0.05)";
        modalContent.style.color = "#e0e0e0";
        modalContent.style.fontFamily = "'Orbitron', 'Segoe UI', sans-serif";
        modalContent.style.maxWidth = "550px";
        modalContent.style.width = "90%";
        modalContent.style.maxHeight = "85vh";
        modalContent.style.overflowY = "auto";
        modalContent.style.position = "relative";
        modalContent.style.transform = "scale(0.9)";
        modalContent.style.transition = "transform 0.4s ease, box-shadow 0.4s ease";

        setTimeout(() => {
            modalContent.style.transform = "scale(1)";
            modalContent.style.boxShadow = "0 15px 40px rgba(0, 0, 0, 0.8), inset 0 0 15px rgba(255, 255, 255, 0.1)";
        }, 100);

        const title = document.createElement("h2");
        title.textContent = "🔧 Prezomenoi OG Updater";
        title.style.textAlign = "center";
        title.style.color = "#00ffcc";
        title.style.fontSize = "28px";
        title.style.fontWeight = "600";
        title.style.marginBottom = "20px";
        title.style.textShadow = "0 0 10px rgba(0, 255, 204, 0.8), 0 0 20px rgba(0, 255, 204, 0.5)";
        title.style.letterSpacing = "1px";
        title.style.animation = "neonGlow 1.5s ease-in-out infinite alternate";

        const styleSheet = document.createElement("style");
        styleSheet.textContent = `
            @keyframes neonGlow {
                from {
                    text-shadow: 0 0 10px rgba(0, 255, 204, 0.8), 0 0 20px rgba(0, 255, 204, 0.5), 0 0 30px rgba(0, 255, 204, 0.3);
                }
                to {
                    text-shadow: 0 0 15px rgba(0, 255, 204, 1), 0 0 30px rgba(0, 255, 204, 0.7), 0 0 50px rgba(0, 255, 204, 0.5);
                }
            }
            @keyframes pulseGlow {
                0% { box-shadow: 0 0 5px rgba(0, 255, 204, 0.5), 0 0 10px rgba(0, 255, 204, 0.3); }
                50% { box-shadow: 0 0 15px rgba(0, 255, 204, 0.8), 0 0 25px rgba(0, 255, 204, 0.5); }
                100% { box-shadow: 0 0 5px rgba(0, 255, 204, 0.5), 0 0 10px rgba(0, 255, 204, 0.3); }
            }
            @keyframes slideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            @keyframes holographicFlicker {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.8; }
            }
            @keyframes particleGlow {
                0% { transform: translate(0, 0); opacity: 0.5; }
                50% { transform: translate(5px, -5px); opacity: 1; }
                100% { transform: translate(0, 0); opacity: 0.5; }
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            @keyframes terminalText {
                from { transform: translateY(10px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(styleSheet);
        modalContent.appendChild(title);

        const description = document.createElement("p");
        description.textContent = "Έλεγχος και ενημέρωση του Prezomenoi OG plugin με ένα κλικ.";
        description.style.textAlign = "center";
        description.style.fontSize = "16px";
        description.style.color = "#a0a0c0";
        description.style.marginBottom = "30px";
        description.style.lineHeight = "1.6";
        description.style.opacity = "0";
        description.style.animation = "slideUp 0.6s ease forwards 0.3s";
        modalContent.appendChild(description);

        const buttonWrapper = document.createElement("div");
        buttonWrapper.style.position = "relative";
        buttonWrapper.style.display = "flex";
        buttonWrapper.style.justifyContent = "center";
        buttonWrapper.style.margin = "0 auto";
        buttonWrapper.style.width = "fit-content";

        const button = document.createElement("button");
        button.textContent = "🔄 Έλεγχος & Ενημέρωση Τώρα";
        button.style.padding = "14px 32px";
        button.style.background = "linear-gradient(145deg, rgba(0, 255, 204, 0.2), rgba(0, 204, 153, 0.2))";
        button.style.color = "#00ffcc";
        button.style.border = "2px solid #00ffcc";
        button.style.borderRadius = "12px";
        button.style.fontSize = "16px";
        button.style.fontWeight = "600";
        button.style.cursor = "pointer";
        button.style.transition = "all 0.3s ease";
        button.style.textTransform = "uppercase";
        button.style.letterSpacing = "1.5px";
        button.style.position = "relative";
        button.style.overflow = "hidden";
        button.style.animation = "holographicFlicker 2s ease infinite";
        button.style.boxShadow = "0 0 15px rgba(0, 255, 204, 0.5)";

        for (let i = 0; i < 5; i++) {
            const particle = document.createElement("span");
            particle.style.position = "absolute";
            particle.style.width = "4px";
            particle.style.height = "4px";
            particle.style.background = "#00ffcc";
            particle.style.borderRadius = "50%";
            particle.style.opacity = "0.5";
            particle.style.animation = `particleGlow ${2 + i * 0.5}s ease-in-out infinite`;
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;
            button.appendChild(particle);
        }

        button.onmouseover = () => {
            button.style.background = "linear-gradient(145deg, rgba(0, 255, 204, 0.4), rgba(0, 204, 153, 0.4))";
            button.style.transform = "translateY(-4px)";
            button.style.boxShadow = "0 0 25px rgba(0, 255, 204, 0.8)";
        };
        button.onmouseout = () => {
            button.style.background = "linear-gradient(145deg, rgba(0, 255, 204, 0.2), rgba(0, 204, 153, 0.2))";
            button.style.transform = "translateY(0)";
            button.style.boxShadow = "0 0 15px rgba(0, 255, 204, 0.5)";
        };
        button.onclick = async () => {
            if (this._updateInProgress) return;
            this._updateInProgress = true;
            button.style.pointerEvents = "none";
            button.style.animation = "none";
            button.innerHTML = `<span style="display: inline-block; animation: spin 1s linear infinite;">🔄</span> Ενημέρωση...`;
            await this.checkAndUpdate(modalContent);
            this._updateInProgress = false;
            button.style.pointerEvents = "auto";
            button.style.animation = "holographicFlicker 2s ease infinite";
            button.textContent = "🔄 Έλεγχος & Ενημέρωση Τώρα";
        };

        buttonWrapper.appendChild(button);
        modalContent.appendChild(buttonWrapper);

        const resultBox = document.createElement("div");
        resultBox.id = "update-results";
        resultBox.style.marginTop = "30px";
        resultBox.style.padding = "20px";
        resultBox.style.background = "rgba(15, 15, 25, 0.9)";
        resultBox.style.border = "2px solid rgba(0, 255, 204, 0.3)";
        resultBox.style.borderRadius = "12px";
        resultBox.style.fontSize = "14px";
        resultBox.style.color = "#00ffcc";
        resultBox.style.lineHeight = "1.6";
        resultBox.style.position = "relative";
        resultBox.style.overflow = "hidden";
        resultBox.style.opacity = "0";
        resultBox.style.animation = "slideUp 0.6s ease forwards 0.5s";
        resultBox.style.fontFamily = "'Courier New', monospace";
        resultBox.style.boxShadow = "inset 0 0 10px rgba(0, 255, 204, 0.2)";

        resultBox.style.backgroundImage = "linear-gradient(rgba(0, 255, 204, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 204, 0.05) 1px, transparent 1px)";
        resultBox.style.backgroundSize = "20px 20px";

        const scanLine = document.createElement("div");
        scanLine.style.position = "absolute";
        scanLine.style.top = "0";
        scanLine.style.left = "0";
        scanLine.style.width = "100%";
        scanLine.style.height = "2px";
        scanLine.style.background = "linear-gradient(90deg, transparent, rgba(0, 255, 204, 0.5), transparent)";
        scanLine.style.animation = "terminalText 3s linear infinite";
        resultBox.appendChild(scanLine);

        resultBox.innerHTML = "<b>Αποτελέσματα:</b><br>Πατήστε το κουμπί για να ξεκινήσει ο έλεγχος.";

        resultBox.onmouseover = () => {
            resultBox.style.borderColor = "rgba(0, 255, 204, 0.6)";
            resultBox.style.boxShadow = "inset 0 0 15px rgba(0, 255, 204, 0.4)";
        };
        resultBox.onmouseout = () => {
            resultBox.style.borderColor = "rgba(0, 255, 204, 0.3)";
            resultBox.style.boxShadow = "inset 0 0 10px rgba(0, 255, 204, 0.2)";
        };

        modalContent.appendChild(resultBox);

        const closeButton = document.createElement("button");
        closeButton.textContent = "✕";
        closeButton.style.position = "absolute";
        closeButton.style.top = "15px";
        closeButton.style.right = "15px";
        closeButton.style.background = "none";
        closeButton.style.border = "1px solid rgba(255, 255, 255, 0.2)";
        closeButton.style.borderRadius = "50%";
        closeButton.style.width = "30px";
        closeButton.style.height = "30px";
        closeButton.style.color = "#e0e0e0";
        closeButton.style.fontSize = "16px";
        closeButton.style.cursor = "pointer";
        closeButton.style.display = "flex";
        closeButton.style.alignItems = "center";
        closeButton.style.justifyContent = "center";
        closeButton.style.transition = "all 0.3s ease";

        closeButton.onmouseover = () => {
            closeButton.style.color = "#ff5555";
            closeButton.style.borderColor = "#ff5555";
            closeButton.style.boxShadow = "0 0 10px rgba(255, 85, 85, 0.5)";
        };
        closeButton.onmouseout = () => {
            closeButton.style.color = "#e0e0e0";
            closeButton.style.borderColor = "rgba(255, 255, 255, 0.2)";
            closeButton.style.boxShadow = "none";
        };
        closeButton.onclick = () => {
            modalOverlay.style.opacity = "0";
            setTimeout(() => modalOverlay.remove(), 500);
        };

        modalContent.appendChild(closeButton);
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
        this.modal = modalOverlay;

        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.style.opacity = "0";
                setTimeout(() => modalOverlay.remove(), 500);
            }
        };
    }

    async checkAndUpdate(container) {
        console.log("[Prezomenoi_OG] Checking and updating plugin...");
        const results = container ? container.querySelector("#update-results") : null;
        if (results) results.innerHTML = "<b>Αποτελέσματα:</b><br>";

        const pluginName = "1Prezomenoi_OG";
        const updateUrl = "https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/.Prezomenoi_OG.plugin.js?t=" + Date.now();
        const filename = "1Prezomenoi_OG.plugin.js";

        try {
            const localPlugin = BdApi.Plugins.get(pluginName);
            if (!localPlugin) {
                if (results) {
                    const msg = document.createElement("div");
                    msg.innerHTML = `❓ το <b>${pluginName}</b> δεν είναι εγκατεστημένο.<br>`;
                    msg.style.color = "#ff5555";
                    msg.style.opacity = "0";
                    msg.style.animation = "terminalText 0.5s ease forwards";
                    results.appendChild(msg);
                }
                return;
            }

            const code = await fetch(updateUrl).then(r => r.text());
            const remoteVersion = code.match(/@version\s+([^\n]+)/)?.[1].trim();
            const localVersion = localPlugin.version;

            if (!remoteVersion) {
                if (results) {
                    const msg = document.createElement("div");
                    msg.innerHTML = `❓ Δεν βρέθηκε έκδοση για <b>${pluginName}</b>.<br>`;
                    msg.style.color = "#ff5555";
                    msg.style.opacity = "0";
                    msg.style.animation = "terminalText 0.5s ease forwards";
                    results.appendChild(msg);
                }
                return;
            }

            if (this.isNewerVersion(remoteVersion, localVersion)) {
                if (results) {
                    const msg = document.createElement("div");
                    msg.innerHTML = `📦 Βρέθηκε νέα έκδοση για <b>${pluginName}</b>: <code>${remoteVersion}</code>. Ενημέρωση σε εξέλιξη...<br>`;
                    msg.style.opacity = "0";
                    msg.style.animation = "terminalText 0.5s ease forwards";
                    results.appendChild(msg);
                }
                await this.downloadUpdate({ filename, updateUrl }, code);
                if (results) {
                    const msg = document.createElement("div");
                    msg.innerHTML = `✅ Το <b>${pluginName}</b> ενημερώθηκε στην έκδοση <code>${remoteVersion}</code>!<br>`;
                    msg.style.opacity = "0";
                    msg.style.animation = "terminalText 0.5s ease forwards";
                    results.appendChild(msg);
                }
            } else {
                if (results) {
                    const msg = document.createElement("div");
                    msg.innerHTML = `✅ Το <b>${pluginName}</b> είναι ενημερωμένο (<code>${localVersion}</code>).<br>`;
                    msg.style.opacity = "0";
                    msg.style.animation = "terminalText 0.5s ease forwards";
                    results.appendChild(msg);
                }
            }
        } catch (err) {
            if (results) {
                const msg = document.createElement("div");
                msg.innerHTML = `❌ Σφάλμα για <b>${pluginName}</b>: ${err.message}<br>`;
                msg.style.color = "#ff5555";
                msg.style.opacity = "0";
                msg.style.animation = "terminalText 0.5s ease forwards";
                results.appendChild(msg);
            }
        }

        if (results) {
            const msg = document.createElement("div");
            msg.innerHTML = `<br><b>Ο έλεγχος ολοκληρώθηκε!</b>`;
            msg.style.color = "linear-gradient(90deg, #66ffff, #00ccff)";
            msg.style.textAlign = "center";
            msg.style.display = "block";
            msg.style.marginTop = "10px";
            msg.style.opacity = "0";
            msg.style.animation = "terminalText 0.5s ease forwards";
            results.appendChild(msg);
        }
        BdApi.showToast("Ο έλεγχος και η ενημέρωση ολοκληρώθηκαν!", { type: "success" });
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

    downloadUpdate(plugin, code) {
        try {
            BdApi.Plugins.disable("1Prezomenoi_OG");
            const fs = require("fs");
            const path = require("path");
            const filePath = path.join(BdApi.Plugins.folder, plugin.filename);
            fs.writeFileSync(filePath, code, "utf8");
            this._justUpdated = true;
            setTimeout(() => BdApi.Plugins.reload("1Prezomenoi_OG"), 1000);
        } catch (err) {
            BdApi.showToast(`Αποτυχία ενημέρωσης του 1Prezomenoi_OG: ${err.message}`, { type: "error" });
            throw err;
        }
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