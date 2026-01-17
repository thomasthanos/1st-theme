/**
 * @name Prezomenoi_OG
 * @version 6.2.2
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

    get USERS() {
        return [
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
    }

    start() {
        this.log("[Prezomenoi_OG] Plugin activated");
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
        this.applyOfflineColors();
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
            "1216757265936154687": "📱",
            "1459305587413094420": "🇩🇪"
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
        
        const header = document.querySelector("h1[class*='title']");
        if (header && !header.textContent.includes(newTitle)) {
            header.textContent = newTitle;
        }
    }

    renameUsers() {
        const userMap = {};
        this.USERS.forEach(user => {
            if (user.id) userMap[user.id] = user;
        });

        const allUsernameDivs = document.querySelectorAll("div[class*='username']");
        allUsernameDivs.forEach(div => {
            if (div.getAttribute("data-prezomenoi-renamed")) return; // Skip if already processed

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
                if (div.textContent !== userInfo.target) {
                    const computedStyle = window.getComputedStyle(div);
                    const originalFontSize = computedStyle.fontSize;

                    div.textContent = userInfo.target;
                    div.style.color = userInfo.color;
                    div.setAttribute("data-prezomenoi-renamed", "true");

                    if (isVoiceCall) {
                        div.style.fontSize = originalFontSize;
                    }
                }
            }
        });

        // Fallback for names in lists where ID might isn't easily accessible or generally by text
        this.USERS.forEach(user => {
            user.original.forEach(origName => {
                document.querySelectorAll(`[data-text="${origName}"]`).forEach(el => {
                     if (el.textContent !== user.target) {
                        el.textContent = user.target;
                        el.style.color = user.color;
                     }
                });
            });
        });
    }

    applyOfflineColors(rootNode = document) {
        if (!rootNode || !rootNode.querySelectorAll) return;
        const defaultCustomColor = "#C0C0C0";
        rootNode.querySelectorAll("[class*='username']").forEach(el => {
            const isOffline = el.closest('[class*="offline"]');
            if (isOffline) {
                el.style.setProperty("color", defaultCustomColor, "important");
            }
        });
    }

    renameRepliedMessages() {
        const selectors = this.USERS.flatMap(u => u.original.map(name => `[aria-label*='${name}']`)).join(", ");
        const replyAriaElements = document.querySelectorAll(selectors);

        replyAriaElements.forEach(el => {
            const oldAria = el.getAttribute("aria-label");
            if (!oldAria) return;

            this.USERS.forEach(user => {
                user.original.forEach(origName => {
                     if (oldAria.includes(origName)) {
                         el.setAttribute("aria-label", oldAria.replace(origName, user.target));
                     }
                });
            });
        });

        document.querySelectorAll("*").forEach(el => {
            if (el.childElementCount === 0) {
                const trimmed = el.textContent.trim();
                const matchedUser = this.USERS.find(u => u.original.includes(trimmed));
                if (matchedUser) {
                     if (el.textContent !== matchedUser.target) {
                        el.textContent = matchedUser.target;
                        el.style.color = matchedUser.color;
                     }
                }
            }
        });
    }

    textReplace(rootNode) {
        if (!rootNode) return;

        this.replaceTextInNode(rootNode, "Xountikoi OG", "Ghost Server");
        
        this.USERS.forEach(user => {
            user.original.forEach(origName => {
                this.replaceTextInNode(rootNode, origName, user.target);
            });
        });


        const elementsWithAttrs = rootNode.querySelectorAll("[aria-label], [data-text], [title], [alt]");
        elementsWithAttrs.forEach(el => {
            const ariaVal = el.getAttribute("aria-label");
            if (ariaVal && ariaVal.includes("Xountikoi OG")) {
                el.setAttribute("aria-label", ariaVal.replace("Xountikoi OG", "Prezomenoi LOCAL"));
            }

            const dtVal = el.getAttribute("data-text");
            if (dtVal && dtVal.includes("Xountikoi OG")) {
                el.setAttribute("data-text", dtVal.replace("Xountikoi OG", "Prezomenoi LOCAL"));
                if (el.textContent.includes("Xountikoi OG"))
                    el.textContent = el.textContent.replace("Xountikoi OG", "Prezomenoi LOCAL");
            }
            
            this.USERS.forEach(user => {
                user.original.forEach(origName => {
                    const currentAria = el.getAttribute("aria-label");
                    if (currentAria && currentAria.includes(origName)) {
                         el.setAttribute("aria-label", currentAria.replace(origName, user.target));
                    }
                    
                    const currentDt = el.getAttribute("data-text");
                    if (currentDt && currentDt.includes(origName)) {
                         el.setAttribute("data-text", currentDt.replace(origName, user.target));
                         // Safe double check for text content if it matches data-text pattern
                         if (el.textContent.includes(origName)) {
                             el.textContent = el.textContent.replace(origName, user.target);
                         }
                    }
                });
            });
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
        this.applyOfflineColors(node);
        
        // Check for channel list updates
        if (node.querySelector && (
            node.querySelector('[data-list-item-id^="channels___"]') || 
            (node.getAttribute && node.getAttribute('data-list-item-id')?.startsWith('channels___')) ||
            node.querySelector('[class*="sidebar"]') ||
            (node.classList && Array.from(node.classList).some(c => c.includes("sidebar")))
        )) {
            this.renameChannels();
            this.renameCategories();
        }

        // Check for header updates
        if (node.querySelector && (node.querySelector('h1[class*="title"]') || node.tagName === 'H1')) {
            this.renameHeaderTitle();
        }
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
            "1345100969393917953": "🔏〢Secret",
            "1459305637841473711": "🇩🇪〢secret channel",
            "1459297181721952307": "🇩🇪〢secret call"
        };
    }

    removeNoRoleCss() {
        const s = document.getElementById("noRoleCustomCss");
        if (s) s.remove();
    }

    stop() {
        this.log("[Prezomenoi_OG] Plugin deactivated");
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
        this.log("[Prezomenoi_OG] Opening updater modal");
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
    log(...args) {
        console.log(
            "%c [Prezomenoi_OG v6.2.2] %c " + args.join(" "),
            "font-weight: bold; background: #424242; color: white; padding: 4px 8px; border-radius: 6px 0 0 6px;",
            "font-weight: bold; background: #313131; color: white; padding: 4px 8px; border-radius: 0 6px 6px 0;"
        );
    }
};
