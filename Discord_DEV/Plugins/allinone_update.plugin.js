/**
 * @name UpdateAllMyPlugins
 * @version 1.0.10
 * @description Κάνει έλεγχο και αυτόματη ενημέρωση για όλα τα προσωπικά plugins του ThomasT με πλήρες custom UI.
 * @author ThomasT
 * @authorId 706932839907852389
 * @updateUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/UpdateAllMyPlugins.plugin.js
 * @downloadUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/UpdateAllMyPlugins.plugin.js
 */

module.exports = class UpdateAllMyPlugins {
    constructor() {
        this.plugins = {
            "1BlockConsole": {
                filename: "1BlockConsole.plugin.js",
                updateUrl: "https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/BlockConsole.plugin.js"
            },
            "1HideFolders": {
                filename: "1HideFolders.plugin.js",
                updateUrl: "https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/HideFolders.plugin.js"
            },
            "1Prezomenoi_OG": {
                filename: "1Prezomenoi_OG.plugin.js",
                updateUrl: "https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/Prezomenoi_OG.plugin.js"
            },
            "1AutoReadTrash": {
                filename: "1autoreadtrash.plugin.js",
                updateUrl: "https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/autoreadtrash.plugin.js"
            },
            "1DiscordChange": {
                filename: "1discord_change.plugin.js",
                updateUrl: "https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/discord_change.plugin.js"
            }
        };
    }

    start() {
        // No automatic update on start; updates will only happen when the button is clicked
    }

    stop() {
        // Δεν χρειάζεται κάποια ενέργεια κατά το κλείσιμο
    }

    getSettingsPanel() {
        const container = document.createElement("div");
        container.style.padding = "24px";
        container.style.background = "linear-gradient(135deg, #1e1e2e 0%, #2e2e3e 100%)";
        container.style.borderRadius = "16px";
        container.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.5)";
        container.style.color = "#e0e0e0";
        container.style.fontFamily = "'Inter', 'Segoe UI', sans-serif";
        container.style.maxWidth = "500px";
        container.style.margin = "0 auto";
        container.style.transition = "transform 0.3s ease";

        container.onmouseover = () => {
            container.style.transform = "scale(1.02)";
        };
        container.onmouseout = () => {
            container.style.transform = "scale(1)";
        };

        const title = document.createElement("h2");
        title.textContent = "🔧 ThomasT Plugin Updater";
        title.style.textAlign = "center";
        title.style.color = "#cba6f7";
        title.style.fontSize = "24px";
        title.style.fontWeight = "700";
        title.style.marginBottom = "16px";
        title.style.textShadow = "0 2px 4px rgba(0, 0, 0, 0.3)";
        container.appendChild(title);

        const description = document.createElement("p");
        description.textContent = "Έλεγχος και ενημέρωση όλων των προσωπικών plugins του ThomasT με ένα κλικ.";
        description.style.textAlign = "center";
        description.style.fontSize = "15px";
        description.style.color = "#b0b0b0";
        description.style.marginBottom = "24px";
        description.style.lineHeight = "1.5";
        container.appendChild(description);

        const button = document.createElement("button");
        button.textContent = "🔄 Έλεγχος & Ενημέρωση Τώρα";
        button.style.padding = "12px 28px";
        button.style.margin = "0 auto";
        button.style.display = "block";
        button.style.background = "linear-gradient(145deg, #cba6f7, #a78bfa)";
        button.style.color = "#1e1e2e";
        button.style.border = "none";
        button.style.borderRadius = "10px";
        button.style.fontSize = "16px";
        button.style.fontWeight = "600";
        button.style.cursor = "pointer";
        button.style.transition = "background 0.3s ease, transform 0.2s ease, box-shadow 0.3s ease";
        button.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";

        button.onmouseover = () => {
            button.style.background = "linear-gradient(145deg, #b48fd8, #9575cd)";
            button.style.transform = "translateY(-3px)";
            button.style.boxShadow = "0 6px 16px rgba(0, 0, 0, 0.4)";
        };
        button.onmouseout = () => {
            button.style.background = "linear-gradient(145deg, #cba6f7, #a78bfa)";
            button.style.transform = "translateY(0)";
            button.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
        };
        button.onclick = () => this.checkAndUpdate(container);

        container.appendChild(button);

        const resultBox = document.createElement("div");
        resultBox.style.marginTop = "24px";
        resultBox.style.padding = "16px";
        resultBox.style.background = "rgba(18, 18, 20, 0.9)";
        resultBox.style.border = "1px solid #333";
        resultBox.style.borderRadius = "10px";
        resultBox.style.fontSize = "14px";
        resultBox.style.color = "#d0d0d0";
        resultBox.style.lineHeight = "1.6";
        resultBox.style.transition = "opacity 0.3s ease";
        resultBox.id = "update-results";
        resultBox.style.opacity = "0.9";
        resultBox.innerHTML = "<b>Αποτελέσματα:</b><br>Πατήστε το κουμπί για να ξεκινήσει ο έλεγχος.";

        resultBox.onmouseover = () => {
            resultBox.style.opacity = "1";
        };
        resultBox.onmouseout = () => {
            resultBox.style.opacity = "0.9";
        };

        container.appendChild(resultBox);
        return container;
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
                        if (results) results.innerHTML += `❓ Δεν βρέθηκε το αρχείο για το <b>${name}</b> στο GitHub.<br>`;
                    } else {
                        if (results) results.innerHTML += `❓ Το <b>${name}</b> δεν είναι εγκατεστημένο.<br>`;
                    }
                    continue;
                }

                const code = await fetch(plugin.updateUrl + "?t=" + Date.now()).then(r => r.text());
                const remoteVersion = code.match(/@version\s+([^\n]+)/)?.[1].trim();
                const localVersion = localPlugin.version;

                if (!remoteVersion) {
                    if (results) results.innerHTML += `❓ Δεν βρέθηκε έκδοση για <b>${name}</b>.<br>`;
                    continue;
                }

                if (this.isNewerVersion(remoteVersion, localVersion)) {
                    if (results) results.innerHTML += `📦 Βρέθηκε νέα έκδοση για <b>${name}</b>: <code>${remoteVersion}</code>. Ενημέρωση σε εξέλιξη...<br>`;
                    await this.updatePlugin(plugin, code, name);
                    if (results) results.innerHTML += `✅ Το <b>${name}</b> ενημερώθηκε στην έκδοση <code>${remoteVersion}</code>!<br>`;
                } else {
                    if (results) results.innerHTML += `✅ Το <b>${name}</b> είναι ενημερωμένο (<code>${localVersion}</code>).<br>`;
                }
            } catch (err) {
                if (results) results.innerHTML += `❌ Σφάλμα για <b>${name}</b>: ${err.message}<br>`;
            }
        }

        if (results) results.innerHTML += `<br><b>Ο έλεγχος ολοκληρώθηκε!</b>`;
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