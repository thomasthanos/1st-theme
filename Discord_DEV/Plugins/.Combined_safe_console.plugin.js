/**
 * @name Combined_safe_console
 * @version 3.5.0
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

        return panel;
    }

    _createStyledToggle(labelText, checked, onChange) {
        const container = document.createElement("div");
        container.style.marginBottom = "12px";
        container.style.display = "flex";
        container.style.alignItems = "center";

        const label = document.createElement("span");
        label.textContent = labelText;
        label.style.marginRight = "10px";
        label.style.fontWeight = "600";
        label.style.fontFamily = "Segoe UI, sans-serif";
        label.style.fontSize = "14px";
        label.style.color = "#333";

        const button = document.createElement("button");
        button.textContent = checked ? "ON" : "OFF";
        button.style.padding = "6px 16px";
        button.style.border = "1px solid #ccc";
        button.style.borderRadius = "6px";
        button.style.cursor = "pointer";
        button.style.backgroundColor = checked ? "#4caf50" : "#e57373";
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