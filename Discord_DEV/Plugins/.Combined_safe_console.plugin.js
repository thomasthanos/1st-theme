/**
 * @name Combined_safe_console
 * @version 3.8.0
 * @description Combines BlockConsole and DiscordLinkSafe with BetterDiscord settings panel using styled light buttons and improved fonts.
 * @author ThomasT
 * @authorId 706932839907852389
 * @source https://github.com/thomasthanos/1st-theme/blob/main/Discord_DEV/Plugins/Combined_safe_console.plugin.js
 * @updateUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/.Combined_safe_console.plugin.js
 * @website https://github.com/thomasthanos
 */

module.exports = class ThomasTCombined {
    constructor() {
        this.settings = BdApi.loadData("ThomasTCombined", "settings") || {
            blockConsoleEnabled: true,
            discordLinkSafeEnabled: true
        };
        this._orig = {};
        this._prefixes = [
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
            "[HideMutedCategories]", "[ZeresPluginLibrary]", "[VideoStream]","[OverlayUsageStatsManager]",
            "[UserProfileModalActionCreators]"
        ];
        this._methods = ["log", "info", "warn", "error", "debug"];
        this._linkObserver = null;
        this._justUpdated = false;
    }

    start() {
        setTimeout(() => {
            console.clear();
            setTimeout(() => {
                console.log(
                    "%c [Combined_safe_console] %c Η κονσόλα καθαρίστηκε!",
                    "font-weight: bold; background: #424242; color: white; padding: 4px 8px; border-radius: 6px 0 0 6px;",
                    "font-weight: bold; background: #616161; color: white; padding: 4px 8px; border-radius: 0 6px 6px 0;"
                );
            }, 10);

            if (this.settings.blockConsoleEnabled) this.startBlockConsole();
            if (this.settings.discordLinkSafeEnabled) this.startDiscordLinkSafe();
        }, 8000);
    }

    stop() {
        this.stopBlockConsole();
        this.stopDiscordLinkSafe();
    }

    startBlockConsole() {
        this._methods.forEach(method => {
            this._orig[method] = console[method].bind(console);
            console[method] = (...args) => {
                const blocked = args.some(arg => typeof arg === "string" && (this._prefixes.some(pref => arg.includes(pref)) || arg.includes("[RTCConnection")));
                if (blocked) return;
                this._orig[method](...args);
            };
        });
    }

    stopBlockConsole() {
        this._methods.forEach(method => {
            if (this._orig[method]) console[method] = this._orig[method];
        });
        this._orig = {};
    }

    startDiscordLinkSafe() {
        this._linkObserver = new MutationObserver(() => this.replaceLinks());
        this._linkObserver.observe(document.body, { childList: true, subtree: true });
        this.replaceLinks();
    }

    stopDiscordLinkSafe() {
        if (this._linkObserver) this._linkObserver.disconnect();
        this._linkObserver = null;
    }

    replaceLinks() {
        const links = document.querySelectorAll('a[href*="discord.gg/"], a[href*="discord.com/invite/"]');
        links.forEach(link => {
            if (link.dataset._discordSafeModified) return;
            const wrapper = link.closest('[id^="message-accessories"]');
            const isExpired = wrapper?.querySelector('h3.inviteDestinationExpired_d5f3cd');
            link.innerHTML = 'Discord link';
            link.style.fontWeight = 'bold';
            link.style.textDecoration = 'none';
            link.style.color = isExpired ? '#8B0000' : '#00b0f4';
            link.dataset._discordSafeModified = "true";
        });
    }

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.id = "thomasT-settings-panel";
        panel.style.padding = "20px";
        panel.style.background = "linear-gradient(135deg, #2c2c2c, #1e1e1e)";
        panel.style.borderRadius = "12px";
        panel.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.4)";
        panel.style.display = "flex";
        panel.style.flexDirection = "column";
        panel.style.alignItems = "center";
        panel.style.gap = "16px";

        panel.appendChild(this._createStyledToggle("Enable BlockConsole", this.settings.blockConsoleEnabled, (checked) => {
            this.settings.blockConsoleEnabled = checked;
            BdApi.saveData("ThomasTCombined", "settings", this.settings);
            if (checked) this.startBlockConsole(); else this.stopBlockConsole();
        }));

        panel.appendChild(this._createStyledToggle("Enable DiscordLinkSafe", this.settings.discordLinkSafeEnabled, (checked) => {
            this.settings.discordLinkSafeEnabled = checked;
            BdApi.saveData("ThomasTCombined", "settings", this.settings);
            if (checked) this.startDiscordLinkSafe(); else this.stopDiscordLinkSafe();
        }));

        const updateButton = document.createElement("button");
        updateButton.textContent = "Check for Update";
        updateButton.classList.add("update-check");

        updateButton.onclick = async () => {
            updateButton.textContent = "Checking...";
            try {
                const pluginName = "Combined_safe_console";
                const updateUrl = "https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/.Combined_safe_console.plugin.js";
                const filename = ".Combined_safe_console.plugin.js";

                const localPlugin = BdApi.Plugins.get(pluginName);
                if (!localPlugin) {
                    BdApi.alert("Error", `Το ${pluginName} δεν είναι εγκατεστημένο.`);
                    updateButton.textContent = "Check for Update";
                    return;
                }

                const code = await fetch(updateUrl).then(r => r.text());
                const remoteVersion = code.match(/@version\s+([^\n]+)/)?.[1].trim();
                const localVersion = localPlugin.version;

                if (!remoteVersion) {
                    BdApi.alert("Error", `Δεν βρέθηκε έκδοση για ${pluginName}.`);
                    updateButton.textContent = "Check for Update";
                    return;
                }

                if (this.isNewerVersion(remoteVersion, localVersion)) {
                    BdApi.Plugins.disable(pluginName);
                    const fs = require("fs");
                    const path = require("path");
                    const filePath = path.join(BdApi.Plugins.folder, filename);
                    fs.writeFileSync(filePath, code, "utf8");
                    this._justUpdated = true;
                    setTimeout(() => BdApi.Plugins.reload(pluginName), 1000);
                    BdApi.alert("Success", `Το ${pluginName} ενημερώθηκε στην έκδοση ${remoteVersion}!`);
                } else {
                    BdApi.alert("Up to Date", `Το ${pluginName} είναι ήδη στην τελευταία έκδοση (${localVersion}).`);
                }
            } catch (e) {
                BdApi.alert("Error", `Αποτυχία ελέγχου ή ενημέρωσης: ${e.message}`);
            } finally {
                updateButton.textContent = "Check for Update";
            }
        };

        panel.appendChild(updateButton);

        if (!document.getElementById("thomasT-custom-css")) {
            const style = document.createElement("style");
            style.id = "thomasT-custom-css";
            style.textContent = `
                .bd-modal-root.bd-modal-medium.bd-addon-modal#thomasT-addon-modal {
                    width: 320px !important;
                    max-width: 320px !important;
                    min-width: 320px !important;
                    background-color: #1e1e1e !important;
                    border-radius: 14px !important;
                    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6) !important;
                }
                #thomasT-settings-panel button {
                    border-radius: 999px !important;
                    padding: 10px 24px !important;
                    font-size: 13px !important;
                    font-weight: 500 !important;
                    border: none !important;
                    color: #ffffff !important;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3) !important;
                    transition: background-color 0.3s, transform 0.2s, box-shadow 0.3s !important;
                }
                #thomasT-settings-panel button.on {
                    background-color: #4caf50 !important;
                }
                #thomasT-settings-panel button.off {
                    background-color: #e57373 !important;
                }
                #thomasT-settings-panel button.update-check {
                    background: linear-gradient(135deg, #2196f3, #1976d2) !important;
                    box-shadow: 0 4px 12px rgba(25, 118, 210, 0.6) !important;
                }
                #thomasT-settings-panel button.update-check:hover {
                    background: linear-gradient(135deg, #1976d2, #1565c0) !important;
                    box-shadow: 0 6px 16px rgba(21, 101, 192, 0.7) !important;
                }
                #thomasT-settings-panel button:hover {
                    filter: brightness(1.1) !important;
                    transform: translateY(-2px) !important;
                }
                #thomasT-settings-panel span {
                    color: #ffffff !important;
                }
            `;
            document.head.appendChild(style);
        }

        setTimeout(() => {
            const modal = document.querySelector('.bd-addon-modal');
            if (modal) {
                modal.id = "thomasT-addon-modal";
            }
        }, 100);

        return panel;
    }

    _createStyledToggle(labelText, checked, onChange) {
        const container = document.createElement("div");
        container.style.marginBottom = "12px";
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.alignItems = "center";
        container.style.width = "100%";

        const label = document.createElement("span");
        label.textContent = labelText;
        label.style.marginRight = "10px";
        label.style.fontWeight = "600";
        label.style.fontFamily = "Segoe UI, sans-serif";
        label.style.fontSize = "14px";
        label.style.color = "#fff";

        const button = document.createElement("button");
        button.textContent = checked ? "ON" : "OFF";
        button.style.padding = "6px 16px";
        button.style.border = "1px solid #ccc";
        button.style.borderRadius = "6px";
        button.style.cursor = "pointer";
        button.style.backgroundColor = checked ? "#009106" : "#a90000";
        button.style.color = "#fff";
        button.style.fontFamily = "Segoe UI, sans-serif";
        button.style.fontSize = "12px";
        button.style.fontWeight = "500";
        button.style.transition = "background-color 0.3s, transform 0.1s";

        button.onmouseover = () => {
            button.style.transform = "scale(1.05)";
        };
        button.onmouseout = () => {
            button.style.transform = "scale(1)";
        };

        button.onclick = () => {
            checked = !checked;
            button.textContent = checked ? "ON" : "OFF";
            button.style.backgroundColor = checked ? "#4caf50" : "#e57373";
            onChange(checked);
        };

        container.appendChild(label);
        container.appendChild(button);
        return container;
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