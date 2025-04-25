/**
 * @name UpdateAllMyPlugins
 * @version 2.5.4
 * @description Κάνει έλεγχο και αυτόματη ενημέρωση για όλα τα προσωπικά plugins του ThomasT με πλήρες custom UI.
 * @author ThomasT
 * @authorId 706932839907852389
 * @source https://github.com/thomasthanos/1st-theme/blob/main/Discord_DEV/Plugins/.allinone_update.plugin.js
 * @updateUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/.allinone_update.plugin.js
 * @website https://github.com/thomasthanos
 */

module.exports = class UpdateAllMyPlugins {
    constructor() {
        this.plugins = {
            "Combined_safe_console": {
                filename: ".Combined_safe_console.plugin.js",
                updateUrl: "https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/.Combined_safe_console.plugin.js"
            },
            "Prezomenoi_OG": {
                filename: ".Prezomenoi_OG.plugin.js",
                updateUrl: "https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/.Prezomenoi_OG.plugin.js"
            },
            "FolderManager": {
                filename: ".FolderManager.plugin.js",
                updateUrl: "https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/.FolderManager.plugin.js"
            }
        };
        this.modal = null;
        this.iconButton = null;
        this.observer = null;
        this.isUpdating = false;
    }

    start() {
        console.log("[UpdateAllMyPlugins] Starting plugin...");
        this.injectIcon();
    }

    stop() {
        console.log("[UpdateAllMyPlugins] Stopping plugin...");
        this.removeIcon();
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }

    injectIcon() {
        const pluginCards = document.querySelectorAll('[class*="bd-addon-card"]');

        let pluginCard = null;
        pluginCards.forEach(card => {
            const titleElement = card.querySelector('[class*="bd-addon-header"]');
            if (titleElement && titleElement.textContent.includes("UpdateAllMyPlugins")) {
                pluginCard = card;
            }
        });

        if (pluginCard) {
            const controls = pluginCard.querySelector('[class*="bd-controls"]');
            if (controls) {

                if (!controls.querySelector('[aria-label="Plugin Updater"]')) {
                    this.createAndInjectIcon(controls);
                } else {

                }
            }
        } else {
            console.warn("[UpdateAllMyPlugins] UpdateAllMyPlugins plugin card not found");
        }

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
                if (titleElement && titleElement.textContent.includes("UpdateAllMyPlugins")) {
                    pluginCard = card;
                }
            });

            if (pluginCard) {
                const controls = pluginCard.querySelector('[class*="bd-controls"]');
                if (controls) {
                    if (!controls.querySelector('[aria-label="Plugin Updater"]')) {
                        this.createAndInjectIcon(controls);
                    } else {
                    }
                } else {
                    console.warn("[UpdateAllMyPlugins] Controls section not found in plugin card via observer");
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
    }

    openModal() {

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
        title.textContent = "🔧 ThomasT Plugin Updater";
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
        description.textContent = "Έλεγχος και ενημέρωση όλων των προσωπικών plugins του ThomasT με ένα κλικ.";
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
            if (this.isUpdating) return;
            this.isUpdating = true;
            button.style.pointerEvents = "none";
            button.style.animation = "none";
            button.innerHTML = `<span style="display: inline-block; animation: spin 1s linear infinite;">🔄</span> Ενημέρωση...`;
            await this.checkAndUpdate(modalContent);
            this.isUpdating = false;
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

        const results = container ? container.querySelector("#update-results") : null;
        if (results) results.innerHTML = "<b>Αποτελέσματα:</b><br>";

        const fs = require("fs");
        const path = require("path");

        for (const [name, plugin] of Object.entries(this.plugins)) {
            try {
                const localPlugin = BdApi.Plugins.get(name);
                const filePath = path.join(BdApi.Plugins.folder, plugin.filename);
                const isFilePresent = fs.existsSync(filePath);

                if (!localPlugin) {
                    if (isFilePresent) {
                        if (results) {
                            const msg = document.createElement("div");
                            msg.innerHTML = `❓ Δεν βρέθηκε το αρχείο για το <b>${name}</b> στο GitHub.<br>`;
                            msg.style.color = "#ff5555"; // Red color for error
                            msg.style.opacity = "0";
                            msg.style.animation = "terminalText 0.5s ease forwards";
                            results.appendChild(msg);
                        }
                    } else {
                        if (results) {
                            const msg = document.createElement("div");
                            msg.innerHTML = `❓ Το <b>${name}</b> δεν είναι εγκατεστημένο.<br>`;
                            msg.style.color = "#ff5555"; // Red color for error
                            msg.style.opacity = "0";
                            msg.style.animation = "terminalText 0.5s ease forwards";
                            results.appendChild(msg);
                        }
                    }
                    continue;
                }

                const code = await fetch(plugin.updateUrl + "?t=" + Date.now()).then(r => r.text());
                const remoteVersion = code.match(/@version\s+([^\n]+)/)?.[1].trim();
                const localVersion = localPlugin.version;

                if (!remoteVersion) {
                    if (results) {
                        const msg = document.createElement("div");
                        msg.innerHTML = `❓ Δεν βρέθηκε έκδοση για <b>${name}</b>.<br>`;
                        msg.style.opacity = "0";
                        msg.style.animation = "terminalText 0.5s ease forwards";
                        results.appendChild(msg);
                    }
                    continue;
                }

                if (this.isNewerVersion(remoteVersion, localVersion)) {
                    if (results) {
                        const msg = document.createElement("div");
                        msg.innerHTML = `📦 Βρέθηκε νέα έκδοση για <b>${name}</b>: <code>${remoteVersion}</code>. Ενημέρωση σε εξέλιξη...<br>`;
                        msg.style.opacity = "0";
                        msg.style.animation = "terminalText 0.5s ease forwards";
                        results.appendChild(msg);
                    }
                    await this.updatePlugin(plugin, code, name);
                    if (results) {
                        const msg = document.createElement("div");
                        msg.innerHTML = `✅ Το <b>${name}</b> ενημερώθηκε στην έκδοση <code>${remoteVersion}</code>!<br>`;
                        msg.style.opacity = "0";
                        msg.style.animation = "terminalText 0.5s ease forwards";
                        results.appendChild(msg);
                    }
                } else {
                    if (results) {
                        const msg = document.createElement("div");
                        msg.innerHTML = `✅ Το <b>${name}</b> είναι ενημερωμένο (<code>${localVersion}</code>).<br>`;
                        msg.style.opacity = "0";
                        msg.style.animation = "terminalText 0.5s ease forwards";
                        results.appendChild(msg);
                    }
                }
            } catch (err) {
                if (results) {
                    const msg = document.createElement("div");
                    msg.innerHTML = `❌ Σφάλμα για <b>${name}</b>: ${err.message}<br>`;
                    msg.style.opacity = "0";
                    msg.style.animation = "terminalText 0.5s ease forwards";
                    results.appendChild(msg);
                }
            }
        }

        if (results) {
            const msg = document.createElement("div");
            msg.innerHTML = `<br><b>Ο έλεγχος ολοκληρώθηκε!</b>`;
            msg.style.color = "linear-gradient(90deg, #66ffff, #00ccff)"; // Gradient cyan to blue
            msg.style.textAlign = "center";
            msg.style.display = "block";
            msg.style.marginTop = "10px";
            msg.style.opacity = "0";
            msg.style.animation = "terminalText 0.5s ease forwards";
            results.appendChild(msg);
        }
        BdApi.showToast("Ο έλεγχος και η ενημέρωση ολοκληρώθηκαν!", { type: "success" });
    }

    async updatePlugin(plugin, code, name) {
        try {
            BdApi.Plugins.disable(name);
            const fs = require("fs");
            const path = require("path");
            const filePath = path.join(BdApi.Plugins.folder, plugin.filename);
            fs.writeFileSync(filePath, code, "utf8");
            BdApi.Plugins.enable(name);
        } catch (err) {
            BdApi.showToast(`Αποτυχία ενημέρωσης του ${name}: ${err.message}`, { type: "error" });
            throw err;
        }
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
};