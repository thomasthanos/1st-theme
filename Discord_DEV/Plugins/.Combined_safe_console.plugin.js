/**
 * @name Combined_safe_console
 * @version 3.0.4
 * @description Combines BlockConsole and DiscordLinkSafe with a custom UI for enabling/disabling and updating.
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
        this.isUpdating = false;
        this.modal = null;
        this.iconButton = null;
        this.observer = null;

        // BlockConsole properties
        this._justUpdated = false;
        this._updateInProgress = false;
        this._orig = {};
        this._prefixes = [
            "[FAST CONNECT]", "[default]", "[KeyboardLayoutMapUtils]", "[Spellchecker]", "[libdiscore]",
            "[BetterDiscord]", "[RPCServer:WSS]", "[GatewaySocket]", "[MessageActionCreators]",
            "[ChannelMessages]", "[Spotify]", "[OverlayStoreV3]", "[RPCServer:IPC]", "[BDFDB]",
            "[PinDMs]", "[ReadAllNotificationsButton]", "[StaffTag]", "[OverlayBridgeStore]",
            "[RunningGameStore]", "[ReadStateStore]", "[RTCControlSocket(stream)]",
            "[RTCControlSocket(default)]", "[DirectVideo]", "[HDStreamingConsumableModal]",
            "[ConnectionEventFramerateReducer]", "[OverlayRenderStore]",
            "[discord_protos.discord_users.v1.FrecencyUserSetting]", "[Routing/Utils]", "[MessageQueue]",
            "[Connection(default)]", "[RTCConnection(1366118296042340453, stream)]", "[RTCLatencyTestManager]", "[FetchBlockedDomain]",
            "[AVError]","[RTCConnection(1216757265391161537, default)]","[discord_protos.discord_users.v1.PreloadedUserSettings]",
            "[StreamTile]","[PopoutWindowStore]","[PostMessageTransport]","[sentry.29ec565af5090e88.js:14 [ComponentDispatchUtils]"
        ];
        this._methods = ["log", "info", "warn", "error", "debug"];

        // DiscordLinkSafe properties
        this._linkObserver = null;
    }

    start() {
        console.log("[ThomasTCombined] Starting plugin...");
        if (this.settings.blockConsoleEnabled) this.startBlockConsole();
        if (this.settings.discordLinkSafeEnabled) this.startDiscordLinkSafe();
        this.injectIcon();
    }

    stop() {
        console.log("[ThomasTCombined] Stopping plugin...");
        this.stopBlockConsole();
        this.stopDiscordLinkSafe();
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

    // BlockConsole Methods
    startBlockConsole() {
        if (typeof console.clear === "function") console.clear();
        this._methods.forEach(method => {
            this._orig[method] = console[method].bind(console);
            console[method] = (...args) => {
                const blocked = args.some(arg =>
                    typeof arg === "string" &&
                    this._prefixes.some(pref => arg.includes(pref))
                );
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

    // DiscordLinkSafe Methods
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

    // UI Injection
    injectIcon() {
        const pluginCards = document.querySelectorAll('[class*="bd-addon-card"]');
        let pluginCard = null;
        pluginCards.forEach(card => {
            const titleElement = card.querySelector('[class*="bd-addon-header"]');
            if (titleElement && titleElement.textContent.includes("ThomasTCombined")) {
                pluginCard = card;
            }
        });

        if (pluginCard) {
            const controls = pluginCard.querySelector('[class*="bd-controls"]');
            if (controls && !controls.querySelector('[aria-label="Plugin Controls"]')) {
                this.createAndInjectIcon(controls);
            }
        }

        this.startObserver();
    }

    startObserver() {
        if (this.observer) return;
        const targetNode = document.body;
        const config = { childList: true, subtree: true };
        this.observer = new MutationObserver(() => {
            const pluginCards = document.querySelectorAll('[class*="bd-addon-card"]');
            let pluginCard = null;
            pluginCards.forEach(card => {
                const titleElement = card.querySelector('[class*="bd-addon-header"]');
                if (titleElement && titleElement.textContent.includes("ThomasTCombined")) {
                    pluginCard = card;
                }
            });
            if (pluginCard) {
                const controls = pluginCard.querySelector('[class*="bd-controls"]');
                if (controls && !controls.querySelector('[aria-label="Plugin Controls"]')) {
                    this.createAndInjectIcon(controls);
                }
            }
        });
        this.observer.observe(targetNode, config);
    }

    createAndInjectIcon(controls) {
        const iconButton = document.createElement("button");
        iconButton.setAttribute("aria-label", "Plugin Controls");
        iconButton.className = "bd-button bd-button-filled bd-addon-button bd-button-color-brand";
        iconButton.style.cssText = `
            cursor: pointer;
            padding: 0;
            margin-left: 0px;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            transition: background 0.2s ease;
            z-index: 1000;
        `;
        iconButton.onmouseover = () => { iconButton.style.background = "rgba(255, 255, 255, 0.1)"; };
        iconButton.onmouseout = () => { iconButton.style.background = "none"; };

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

    // Custom Modal UI
    openModal() {
        console.log("[ThomasTCombined] Opening modal...");
        if (this.modal) this.modal.remove();

        const modalOverlay = document.createElement("div");
        modalOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(180deg, rgba(10, 10, 20, 0.9) 0%, rgba(20, 20, 40, 0.9) 100%);
            backdrop-filter: blur(5px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.5s ease;
        `;
        setTimeout(() => { modalOverlay.style.opacity = "1"; }, 10);

        const modalContent = document.createElement("div");
        modalContent.style.cssText = `
            padding: 30px;
            background: rgba(25, 25, 35, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            backdrop-filter: blur(15px);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), inset 0 0 10px rgba(255, 255, 255, 0.05);
            color: #e0e0e0;
            font-family: 'Orbitron', 'Segoe UI', sans-serif;
            max-width: 500px;
            width: 90%;
            max-height: 85vh;
            overflow-y: auto;
            position: relative;
            transform: scale(0.9);
            transition: transform 0.4s ease, box-shadow 0.4s ease;
        `;
        setTimeout(() => {
            modalContent.style.cssText += `
                transform: scale(1);
                box-shadow: 0 15px 40px rgba(0, 0, 0, 0.8), inset 0 0 15px rgba(255, 255, 255, 0.1);
            `;
        }, 100);

        const styleSheet = document.createElement("style");
        styleSheet.textContent = `
            @keyframes neonGlow {
                from { text-shadow: 0 0 10px rgba(0, 255, 204, 0.8), 0 0 20px rgba(0, 255, 204, 0.5), 0 0 30px rgba(0, 255, 204, 0.3); }
                to { text-shadow: 0 0 15px rgba(0, 255, 204, 1), 0 0 30px rgba(0, 255, 204, 0.7), 0 0 50px rgba(0, 255, 204, 0.5); }
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

        const title = document.createElement("h2");
        title.textContent = "🔧 ThomasT Combined Control";
        title.style.cssText = `
            text-align: center;
            color: #00ffcc;
            font-size: 28px;
            font-weight: 600;
            margin-bottom: 20px;
            text-shadow: 0 0 10px rgba(0, 255, 204, 0.8), 0 0 20px rgba(0, 255, 204, 0.5);
            letter-spacing: 1px;
            animation: neonGlow 1.5s ease-in-out infinite alternate;
        `;
        modalContent.appendChild(title);

        const description = document.createElement("p");
        description.textContent = "Control BlockConsole and DiscordLinkSafe with a single interface.";
        description.style.cssText = `
            text-align: center;
            font-size: 16px;
            color: #a0a0c0;
            margin-bottom: 30px;
            line-height: 1.6;
            opacity: 0;
            animation: slideUp 0.6s ease forwards 0.3s;
        `;
        modalContent.appendChild(description);

        // Toggle for BlockConsole
        const blockConsoleToggle = document.createElement("div");
        blockConsoleToggle.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        `;
        const blockConsoleLabel = document.createElement("span");
        blockConsoleLabel.textContent = "BlockConsole";
        blockConsoleLabel.style.cssText = `color: #e0e0e0; font-size: 16px;`;
        const blockConsoleButton = document.createElement("button");
        blockConsoleButton.textContent = this.settings.blockConsoleEnabled ? "Enabled" : "Disabled";
        blockConsoleButton.style.cssText = `
            padding: 8px 16px;
            background: ${this.settings.blockConsoleEnabled ? "linear-gradient(145deg, rgba(0, 255, 204, 0.2), rgba(0, 204, 153, 0.2))" : "linear-gradient(145deg, rgba(100, 100, 100, 0.2), rgba(80, 80, 80, 0.2))"};
            color: ${this.settings.blockConsoleEnabled ? "#00ffcc" : "#a0a0c0"};
            border: 2px solid ${this.settings.blockConsoleEnabled ? "#00ffcc" : "#a0a0c0"};
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.3s ease;
        `;
        blockConsoleButton.onclick = () => {
            this.settings.blockConsoleEnabled = !this.settings.blockConsoleEnabled;
            BdApi.saveData("ThomasTCombined", "settings", this.settings);
            blockConsoleButton.textContent = this.settings.blockConsoleEnabled ? "Enabled" : "Disabled";
            blockConsoleButton.style.background = this.settings.blockConsoleEnabled ? "linear-gradient(145deg, rgba(0, 255, 204, 0.2), rgba(0, 204, 153, 0.2))" : "linear-gradient(145deg, rgba(100, 100, 100, 0.2), rgba(80, 80, 80, 0.2))";
            blockConsoleButton.style.color = this.settings.blockConsoleEnabled ? "#00ffcc" : "#a0a0c0";
            blockConsoleButton.style.borderColor = this.settings.blockConsoleEnabled ? "#00ffcc" : "#a0a0c0";
            if (this.settings.blockConsoleEnabled) {
                this.startBlockConsole();
            } else {
                this.stopBlockConsole();
            }
        };
        blockConsoleToggle.appendChild(blockConsoleLabel);
        blockConsoleToggle.appendChild(blockConsoleButton);
        modalContent.appendChild(blockConsoleToggle);

        // Toggle for DiscordLinkSafe
        const discordLinkSafeToggle = document.createElement("div");
        discordLinkSafeToggle.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        `;
        const discordLinkSafeLabel = document.createElement("span");
        discordLinkSafeLabel.textContent = "DiscordLinkSafe";
        discordLinkSafeLabel.style.cssText = `color: #e0e0e0; font-size: 16px;`;
        const discordLinkSafeButton = document.createElement("button");
        discordLinkSafeButton.textContent = this.settings.discordLinkSafeEnabled ? "Enabled" : "Disabled";
        discordLinkSafeButton.style.cssText = `
            padding: 8px 16px;
            background: ${this.settings.discordLinkSafeEnabled ? "linear-gradient(145deg, rgba(0, 255, 204, 0.2), rgba(0, 204, 153, 0.2))" : "linear-gradient(145deg, rgba(100, 100, 100, 0.2), rgba(80, 80, 80, 0.2))"};
            color: ${this.settings.discordLinkSafeEnabled ? "#00ffcc" : "#a0a0c0"};
            border: 2px solid ${this.settings.discordLinkSafeEnabled ? "#00ffcc" : "#a0a0c0"};
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.3s ease;
        `;
        discordLinkSafeButton.onclick = () => {
            this.settings.discordLinkSafeEnabled = !this.settings.discordLinkSafeEnabled;
            BdApi.saveData("ThomasTCombined", "settings", this.settings);
            discordLinkSafeButton.textContent = this.settings.discordLinkSafeEnabled ? "Enabled" : "Disabled";
            discordLinkSafeButton.style.background = this.settings.discordLinkSafeEnabled ? "linear-gradient(145deg, rgba(0, 255, 204, 0.2), rgba(0, 204, 153, 0.2))" : "linear-gradient(145deg, rgba(100, 100, 100, 0.2), rgba(80, 80, 80, 0.2))";
            discordLinkSafeButton.style.color = this.settings.discordLinkSafeEnabled ? "#00ffcc" : "#a0a0c0";
            discordLinkSafeButton.style.borderColor = this.settings.discordLinkSafeEnabled ? "#00ffcc" : "#a0a0c0";
            if (this.settings.discordLinkSafeEnabled) {
                this.startDiscordLinkSafe();
            } else {
                this.stopDiscordLinkSafe();
            }
        };
        discordLinkSafeToggle.appendChild(discordLinkSafeLabel);
        discordLinkSafeToggle.appendChild(discordLinkSafeButton);
        modalContent.appendChild(discordLinkSafeToggle);

        // Update Button
        const buttonWrapper = document.createElement("div");
        buttonWrapper.style.cssText = `
            position: relative;
            display: flex;
            justify-content: center;
            margin: 0 auto;
            width: fit-content;
        `;
        const button = document.createElement("button");
        button.textContent = "🔄 Check for Updates";
        button.style.cssText = `
            padding: 14px 32px;
            background: linear-gradient(145deg, rgba(0, 255, 204, 0.2), rgba(0, 204, 153, 0.2));
            color: #00ffcc;
            border: 2px solid #00ffcc;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            position: relative;
            overflow: hidden;
            animation: holographicFlicker 2s ease infinite;
            box-shadow: 0 0 15px rgba(0, 255, 204, 0.5);
        `;
        for (let i = 0; i < 5; i++) {
            const particle = document.createElement("span");
            particle.style.cssText = `
                position: absolute;
                width: 4px;
                height: 4px;
                background: #00ffcc;
                border-radius: 50%;
                opacity: 0.5;
                animation: particleGlow ${2 + i * 0.5}s ease-in-out infinite;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
            `;
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
            button.innerHTML = `<span style="display: inline-block; animation: spin 1s linear infinite;">🔄</span> Updating...`;
            await this.checkAndUpdate(modalContent);
            this.isUpdating = false;
            button.style.pointerEvents = "auto";
            button.style.animation = "holographicFlicker 2s ease infinite";
            button.textContent = "🔄 Check for Updates";
        };
        buttonWrapper.appendChild(button);
        modalContent.appendChild(buttonWrapper);

        // Results Box
        const resultBox = document.createElement("div");
        resultBox.id = "update-results";
        resultBox.style.cssText = `
            margin-top: 30px;
            padding: 20px;
            background: rgba(15, 15, 25, 0.9);
            border: 2px solid rgba(0, 255, 204, 0.3);
            border-radius: 12px;
            font-size: 14px;
            color: #00ffcc;
            line-height: 1.6;
            position: relative;
            overflow: hidden;
            opacity: 0;
            animation: slideUp 0.6s ease forwards 0.5s;
            font-family: 'Courier New', monospace;
            box-shadow: inset 0 0 10px rgba(0, 255, 204, 0.2);
            background-image: linear-gradient(rgba(0, 255, 204, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 204, 0.05) 1px, transparent 1px);
            background-size: 20px 20px;
        `;
        const scanLine = document.createElement("div");
        scanLine.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 2px;
            background: linear-gradient(90deg, transparent, rgba(0, 255, 204, 0.5), transparent);
            animation: terminalText 3s linear infinite;
        `;
        resultBox.appendChild(scanLine);
        resultBox.innerHTML = "<b>Results:</b><br>Press the button to start the update check.";
        resultBox.onmouseover = () => {
            resultBox.style.borderColor = "rgba(0, 255, 204, 0.6)";
            resultBox.style.boxShadow = "inset 0 0 15px rgba(0, 255, 204, 0.4)";
        };
        resultBox.onmouseout = () => {
            resultBox.style.borderColor = "rgba(0, 255, 204, 0.3)";
            resultBox.style.boxShadow = "inset 0 0 10px rgba(0, 255, 204, 0.2)";
        };
        modalContent.appendChild(resultBox);

        // Close Button
        const closeButton = document.createElement("button");
        closeButton.textContent = "✕";
        closeButton.style.cssText = `
            position: absolute;
            top: 15px;
            right: 15px;
            background: none;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            width: 30px;
            height: 30px;
            color: #e0e0e0;
            font-size: 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
        `;
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

    // Update Logic
    async checkAndUpdate(container) {
        console.log("[ThomasTCombined] Checking for updates...");
        const results = container.querySelector("#update-results");
        if (results) results.innerHTML = "<b>Results:</b><br>";

        const updateUrl = "https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/.Combined_safe_console.plugin.js?t=" + Date.now();
        try {
            const code = await fetch(updateUrl).then(r => r.text());
            const remoteVersion = code.match(/@version\s+([^\n]+)/)?.[1].trim();
            const localVersion = "3.0.2";

            if (!remoteVersion) {
                if (results) {
                    const msg = document.createElement("div");
                    msg.innerHTML = `❓ Could not find remote version.<br>`;
                    msg.style.cssText = `color: #ff5555; opacity: 0; animation: terminalText 0.5s ease forwards;`;
                    results.appendChild(msg);
                }
                return;
            }

            if (this.isNewerVersion(remoteVersion, localVersion)) {
                if (results) {
                    const msg = document.createElement("div");
                    msg.innerHTML = `📦 New version found: <code>${remoteVersion}</code>. Updating...<br>`;
                    msg.style.cssText = `opacity: 0; animation: terminalText 0.5s ease forwards;`;
                    results.appendChild(msg);
                }
                await this.updatePlugin({ filename: "ThomasTCombined.plugin.js" }, code, "ThomasTCombined");
                if (results) {
                    const msg = document.createElement("div");
                    msg.innerHTML = `✅ Updated to version <code>${remoteVersion}</code>!<br>`;
                    msg.style.cssText = `opacity: 0; animation: terminalText 0.5s ease forwards;`;
                    results.appendChild(msg);
                }
            } else {
                if (results) {
                    const msg = document.createElement("div");
                    msg.innerHTML = `✅ Plugin is up to date (<code>${localVersion}</code>).<br>`;
                    msg.style.cssText = `opacity: 0; animation: terminalText 0.5s ease forwards;`;
                    results.appendChild(msg);
                }
            }
        } catch (err) {
            if (results) {
                const msg = document.createElement("div");
                msg.innerHTML = `❌ Error: ${err.message}<br>`;
                msg.style.cssText = `color: #ff5555; opacity: 0; animation: terminalText 0.5s ease forwards;`;
                results.appendChild(msg);
            }
        }

        if (results) {
            const msg = document.createElement("div");
            msg.innerHTML = `<br><b>Update check completed!</b>`;
            msg.style.cssText = `
                color: #00ffcc;
                text-align: center;
                display: block;
                margin-top: 10px;
                opacity: 0;
                animation: terminalText 0.5s ease forwards;
            `;
            results.appendChild(msg);
        }
        BdApi.showToast("Update check completed!", { type: "success" });
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
            BdApi.showToast(`Failed to update ${name}: ${err.message}`, { type: "error" });
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