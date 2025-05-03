/**
 * @name Combined_safe_console
 * @version 3.6.0
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
            }, 10); // μικρό delay για να εμφανιστεί κάτω από το system μήνυμα

            if (this.settings.blockConsoleEnabled) this.startBlockConsole();
            if (this.settings.discordLinkSafeEnabled) this.startDiscordLinkSafe();
        }, 8000); // καθυστέρηση 8 δευτερολέπτων
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

        // Toggle 1
        panel.appendChild(this._createStyledToggle("Enable BlockConsole", this.settings.blockConsoleEnabled, (checked) => {
            this.settings.blockConsoleEnabled = checked;
            BdApi.saveData("ThomasTCombined", "settings", this.settings);
            if (checked) this.startBlockConsole(); else this.stopBlockConsole();
        }));

        // Toggle 2
        panel.appendChild(this._createStyledToggle("Enable DiscordLinkSafe", this.settings.discordLinkSafeEnabled, (checked) => {
            this.settings.discordLinkSafeEnabled = checked;
            BdApi.saveData("ThomasTCombined", "settings", this.settings);
            if (checked) this.startDiscordLinkSafe(); else this.stopDiscordLinkSafe();
        }));

        // Update Check Button
        const updateButton = document.createElement("button");
        updateButton.textContent = "Check for Update";
        updateButton.classList.add("update-check");

        updateButton.onclick = async () => {
            updateButton.textContent = "Checking...";
            try {
                const response = await fetch("https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/.Combined_safe_console.plugin.js");
                const remoteText = await response.text();

                const remoteVersion = remoteText.match(/@version (\d+\.\d+\.\d+)/)?.[1];
                const localVersion = "3.6.0"; // Update this if you bump local version

                if (remoteVersion && remoteVersion !== localVersion) {
                    BdApi.alert("Update Available", `New version ${remoteVersion} available! Please download from GitHub.`);
                    window.open("https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/.Combined_safe_console.plugin.js", "_blank");
                } else {
                    BdApi.alert("Up to Date", "You already have the latest version.");
                }

                // Add custom ID to the alert modal after it appears
                setTimeout(() => {
                    const modals = document.querySelectorAll('.bd-modal-root.bd-modal-small');
                    modals.forEach(modal => {
                        modal.id = "thomasT-update-modal";
                    });
                }, 100);
            } catch (e) {
                BdApi.alert("Error", "Failed to check for updates.");
            } finally {
                updateButton.textContent = "Check for Update";
            }
        };

        panel.appendChild(updateButton);

        // Inject custom CSS only once
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
            
            /* Custom styling for the update modal */
            #thomasT-update-modal {
                background-color: #2a2a2a !important;
                border: 1px solid #3a3a3a !important;
                border-radius: 16px !important;
                box-shadow: 0 12px 28px rgba(0, 0, 0, 0.6) !important;
                padding: 24px !important;
            }
            #thomasT-update-modal .bd-modal-footer {
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                margin-top: 12px !important;
                padding-top: 12px !important;
                display: flex !important;
                justify-content: center !important;
            }
            #thomasT-update-modal.bd-modal-root.bd-modal-small {
                width: 75% !important;
            }

            #thomasT-update-modal .bd-header-primary {
                font-size: 22px !important;
                font-weight: 700 !important;
                color: #ffffff !important;
                margin-bottom: 12px !important;
            }
            #thomasT-update-modal .bd-modal-content {
                color: #cccccc !important;
                font-size: 15px !important;
                line-height: 1.7 !important;
            }
            #thomasT-update-modal .bd-button {
                border-radius: 999px !important;
                background: linear-gradient(135deg, #42a5f5, #1e88e5) !important;
                color: #ffffff !important;
                font-weight: 600 !important;
                padding: 10px 28px !important;
                
                box-shadow: 0 4px 12px rgba(66, 165, 245, 0.6), 0 0 10px rgba(66, 165, 245, 0.5) !important;
                transition: transform 0.2s, box-shadow 0.2s !important;
            }
            #thomasT-update-modal .bd-button:hover {
                transform: translateY(-3px) !important;
                box-shadow: 0 6px 18px rgba(30, 136, 229, 0.7), 0 0 12px rgba(30, 136, 229, 0.6) !important;
            }

        `;
            document.head.appendChild(style);
        }

        // Add ID to modal if it exists
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



};