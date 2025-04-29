/**
 * @name Prezomenoi_OG
 * @version 6.0.9
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
        console.log("[Prezomenoi_OG] Plugin activated");
        const link = document.createElement('link');
        link.id = 'prezomenoi-og-style';
        link.rel = 'stylesheet';
        link.href = 'https://thomasthanos.github.io/1st-theme/Discord_DEV/Themes/prezomenoi.theme.css?t=' + Date.now();
        document.head.appendChild(link);

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
        console.log("[Prezomenoi_OG] Plugin deactivated");
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
            if (titleElement && titleElement.textContent.includes("Prezomenoi_OG")) {
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
        }

        this.iconCheckInterval = setInterval(() => {
            const pluginCards = document.querySelectorAll('[class*="bd-addon-card"]');
            let pluginCard = null;
            pluginCards.forEach(card => {
                const titleElement = card.querySelector('[class*="bd-addon-header"]');
                if (titleElement && titleElement.textContent.includes("Prezomenoi_OG")) {
                    pluginCard = card;
                }
            });

            if (pluginCard) {
                const controls = pluginCard.querySelector('[class*="bd-controls"]');
                if (controls && !controls.querySelector('[aria-label="Plugin Updater"]')) {
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
                if (titleElement && titleElement.textContent.includes("Prezomenoi_OG")) {
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
            }
        });

        this.observer.observe(targetNode, config);
    }

    createAndInjectIcon(controls) {
        const iconButton = document.createElement("button");
        iconButton.setAttribute("aria-label", "Plugin Updater");
        iconButton.className = "bd-button bd-button-filled bd-addon-button bd-button-color-brand prezomenoi-icon-button";

        const svgIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgIcon.setAttribute("width", "16");
        svgIcon.setAttribute("height", "16");
        svgIcon.setAttribute("viewBox", "0 0 24 24");
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
            clearInterval(this.iconCheckInterval);
            this.iconCheckInterval = null;
        }
    }

    openModal() {
        console.log("[Prezomenoi_OG] Opening updater modal");
        if (this.modal) {
            this.modal.remove();
        }

        const modalOverlay = document.createElement("div");
        modalOverlay.className = "prezomenoi-modal-overlay";
        setTimeout(() => {
            modalOverlay.classList.add("visible");
        }, 10);

        const modalContent = document.createElement("div");
        modalContent.className = "prezomenoi-modal-content";
        setTimeout(() => {
            modalContent.classList.add("visible");
        }, 100);

        const title = document.createElement("h2");
        title.className = "prezomenoi-modal-title";
        title.textContent = "🔧 Prezomenoi OG Updater";
        modalContent.appendChild(title);

        const description = document.createElement("p");
        description.className = "prezomenoi-modal-description";
        description.textContent = "Έλεγχος και ενημέρωση του Prezomenoi OG plugin με ένα κλικ.";
        modalContent.appendChild(description);

        const buttonWrapper = document.createElement("div");
        buttonWrapper.className = "prezomenoi-modal-button-wrapper";

        const button = document.createElement("button");
        button.className = "prezomenoi-modal-button";
        button.textContent = "🔄 Έλεγχος & Ενημέρωση Τώρα";

        for (let i = 0; i < 5; i++) {
            const particle = document.createElement("span");
            particle.className = "particle";
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;
            button.appendChild(particle);
        }

        button.onclick = async () => {
            if (this._updateInProgress) return;
            this._updateInProgress = true;
            button.style.pointerEvents = "none";
            button.style.animation = "none";
            button.innerHTML = `<span style="display: inline-block; animation: spin 1s linear infinite;">🔄</span> Ενημέρωση...`;
            await this.checkAndUpdate(modalContent);
            this._updateInProgress = false;
            button.style.pointerEvents = "auto";
            button.style.animation = "";
            button.textContent = "🔄 Έλεγχος & Ενημέρωση Τώρα";
        };

        buttonWrapper.appendChild(button);
        modalContent.appendChild(buttonWrapper);

        const resultBox = document.createElement("div");
        resultBox.id = "update-results";
        resultBox.innerHTML = "<b>Αποτελέσματα:</b><br>Πατήστε το κουμπί για να ξεκινήσει ο έλεγχος.";
        modalContent.appendChild(resultBox);

        const scanLine = document.createElement("div");
        scanLine.className = "scan-line";
        resultBox.appendChild(scanLine);

        const closeButton = document.createElement("button");
        closeButton.className = "prezomenoi-modal-close-button";
        closeButton.textContent = "✕";
        closeButton.onclick = () => {
            modalOverlay.classList.remove("visible");
            setTimeout(() => modalOverlay.remove(), 500);
        };
        modalContent.appendChild(closeButton);

        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
        this.modal = modalOverlay;

        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.classList.remove("visible");
                setTimeout(() => modalOverlay.remove(), 500);
            }
        };
    }

    async checkAndUpdate(container) {
        const results = container ? container.querySelector("#update-results") : null;
        if (results) results.innerHTML = "<b>Αποτελέσματα:</b><br>";

        const pluginName = "Prezomenoi_OG";
        const updateUrl = "https://thomasthanos.github.io/1st-theme/Discord_DEV/Themes/prezomenoi.theme.css?t=" + Date.now();
        const filename = ".Prezomenoi_OG.plugin.js";

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
        this.showCustomToast("Ο έλεγχος και η ενημέρωση ολοκληρώθηκαν!", "success");
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
            BdApi.Plugins.disable("Prezomenoi_OG");
            const fs = require("fs");
            const path = require("path");
            const filePath = path.join(BdApi.Plugins.folder, plugin.filename);
            fs.writeFileSync(filePath, code, "utf8");
            this._justUpdated = true;
            setTimeout(() => BdApi.Plugins.reload("Prezomenoi_OG"), 1000);
        } catch (err) {
            this.showCustomToast(`Αποτυχία ενημέρωσης του Prezomenoi_OG: ${err.message}`, "error");
            throw err;
        }
    }

    showCustomToast(text, type = "info") {
        const toast = document.createElement("div");
        toast.textContent = text;
        toast.className = `prezomenoi-toast ${type}`;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }
};