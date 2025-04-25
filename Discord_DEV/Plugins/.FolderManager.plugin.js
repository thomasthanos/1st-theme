/**
 * @name FolderManager
 * @version 12.0.0
 * @description Combines AutoReadTrash and HideFolders: Marks folders as read and hides folders based on their IDs, with a custom modal UI featuring collapsible sections.
 * @author ThomasT
 * @authorId 706932839907852389
 * @source https://github.com/thomasthanos/1st-theme/blob/main/Discord_DEV/Plugins/FolderManager.plugin.js
 * @updateUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/.FolderManager.plugin.js
 * @website https://github.com/thomasthanos
 */

module.exports = class FolderManager {
    defaultSettings = {
        autoReadTrash: {
            enabled: true,
            folderIds: "",
            intervalMinutes: 15,
            showCountdown: true
        },
        hideFolders: {
            enabled: true,
            folderIds: ""
        },
        lastRun: 0
    };

    constructor() {
        this.initializeSettings();
        this._notificationQueue = [];
        this._isShowingNotification = false;
        this._isRunning = false;
        this._lastRun = 0;
        this._startTimeout = null;
        this._uiCheckInterval = null;
        this._updateInProgress = false;
        this._justUpdated = false;
        this._pendingReads = 0;
        this._notificationDebounce = null;
        this._isSaving = false;
        this._saveDebounce = null;
        this.modal = null;
        this.iconButton = null;
        this.observer = null;
    }

    getVersion() {
        return "11.0.9";
    }

    log(...args) {
        console.log(`%c[FolderManager v${this.getVersion()}]`, "color: #00ffcc; font-weight: bold;", ...args);
    }

    initializeSettings() {
        let loadedSettings = BdApi.loadData("FolderManager", "settings");
        if (!loadedSettings) {
            this.log("⚠️ No settings found, initializing with defaults...");
            this.settings = JSON.parse(JSON.stringify(this.defaultSettings));
            this.settings.lastRun = 0;
            this.saveSettings();
        } else {
            this.settings = JSON.parse(JSON.stringify(this.defaultSettings));
            Object.assign(this.settings, loadedSettings);
            this._lastRun = this.settings.lastRun || 0;
            this.log("✅ Settings loaded:", JSON.stringify(this.settings));
        }
    }

    saveSettings() {
        if (this._isSaving) {
            this.log("⏳ SaveSettings ήδη σε εξέλιξη, παραλείπεται...");
            return;
        }
        if (this._saveDebounce) {
            clearTimeout(this._saveDebounce);
        }
        this._saveDebounce = setTimeout(() => {
            this._isSaving = true;
            try {
                BdApi.saveData("FolderManager", "settings", this.settings);
            } catch (error) {
                this.log("❌ Error saving settings:", error.message, error.stack);
            } finally {
                this._isSaving = false;
            }
        }, 300);
    }

    async retryUICreation() {
        try {
            const guildsWrapper = await this.waitForElement('[class="wrapper_ef3116 guilds_c48ade"]', 5000);
            if (!document.querySelector('.art-countdown') && this.settings.autoReadTrash.showCountdown) {
                await this.createCountdownUI();
                this.log("✅ Countdown UI δημιουργήθηκε επιτυχώς");
            }
            if (!document.querySelector('.art-wrapper') && this._notificationQueue.length > 0) {
                this.wrapper3d = null;
                this.processNotificationQueue();
                this.log("✅ Notification UI δημιουργήθηκε επιτυχώς");
            }
            return true;
        } catch (error) {
            this.log("❌ Αποτυχία δημιουργίας UI:", error.message);
            return false;
        }
    }

    waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const checkElement = () => {
                const element = document.querySelector(selector);
                if (element) return resolve(element);
                if (Date.now() - startTime > timeout) return reject(new Error(`Timeout waiting for element: ${selector}`));
                setTimeout(checkElement, 500);
            };
            checkElement();
        });
    }

    start() {
        setTimeout(() => this._startPlugin(), 20000);
    }

    _startPlugin() {
        this._subscribedToContextClose = false;
                this.injectIcon();
        if (this.settings.autoReadTrash.enabled) {
                    this.startAutoReadTrash();
        }
        if (this.settings.hideFolders.enabled)         this.startHideFolders();
    }

    
    
    async doAutoRead() {
        const raw = this.settings?.autoReadTrash?.folderIds || "";
        const ids = raw.split(",").map(id => id.trim()).filter(Boolean);
        if (!ids.length) {
            this.log("❌ Δεν έχουν οριστεί folder IDs.");
            return false;
        }

        const waitForFolders = async (attempts = 0, maxAttempts = 20) => {
            const visibleFolders = [...document.querySelectorAll('div[data-list-item-id]')];
            const foundIds = visibleFolders.map(el => el.getAttribute("data-list-item-id")).filter(Boolean);
            const allFound = ids.every(id => foundIds.includes(id));
            if (allFound || attempts >= maxAttempts) return visibleFolders;
            await new Promise(r => setTimeout(r, 500));
            return waitForFolders(attempts + 1, maxAttempts);
        };

        const allVisibleFolders = await waitForFolders();
        const folders = allVisibleFolders.filter(el => {
            const id = el.getAttribute("data-list-item-id");
            return ids.includes(id) && el.closest('.wrapper_cc5dd2');
        });

        if (!folders.length) {
            this.log("❌ Δεν βρέθηκαν φάκελοι:", ids);
            return false;
        }

        let successfulReads = 0;
        for (const folder of folders) {
            try {
                await new Promise((resolve, reject) => {
                    const tryContextClick = () => {
                        const existingMenu = document.querySelector('[class*="contextMenu"]');
                        if (existingMenu) existingMenu.remove();

                        folder.dispatchEvent(new MouseEvent("contextmenu", {
                            bubbles: true,
                            cancelable: true,
                            clientX: -9999,
                            clientY: -9999
                        }));
                    };

                    tryContextClick();

                    let attempts = 0;
                    const maxAttempts = 10;
                    const checkMenu = () => {
                        const btn = document.querySelector('#guild-context-mark-folder-read');
                        const disabled = btn?.getAttribute("aria-disabled") === "true";

                        if (btn && !disabled) {
                            btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
                            successfulReads++;
                            const menu = document.querySelector('[class*="contextMenu"]');
                            if (menu) menu.remove();
                            resolve();
                        } else if (btn && disabled) {
                            this.log(`ℹ️ Ο φάκελος ${folder.getAttribute("data-list-item-id")} δεν χρειάζεται read (ήδη καθαρός)`);
                            const menu = document.querySelector('[class*="contextMenu"]');
                            if (menu) menu.remove();
                            resolve(); // Don't reject, just skip
                        } else {
                            attempts++;
                            if (attempts >= maxAttempts) {
                                this.log(`❌ Το κουμπί δεν βρέθηκε για ${folder.getAttribute("data-list-item-id")}`);
                                reject(new Error("Mark-read button not found"));
                            } else {
                                tryContextClick(); // Retry opening context menu
                                setTimeout(checkMenu, 750);
                            }
                        }
                    };

                    setTimeout(checkMenu, 1000);
                });
                await new Promise(r => setTimeout(r, 1200));
            } catch (err) {
                this.log(`❌ Σφάλμα στο φάκελο ${folder.getAttribute("data-list-item-id")}:`, err.message);
            }
        }

        this.log(`📁 Καθαρίστηκαν ${successfulReads} από ${folders.length} φάκελοι`);
        this.queueNotification(successfulReads);
        return successfulReads > 0;
    }



    stop() {
        this.stopAutoReadTrash();
        this.stopHideFolders();
        this.removeIcon();
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
    }

    // --- AutoReadTrash Functionality ---

    async startAutoReadTrash() {
        this._lastRun = this.settings.lastRun || Date.now();
        this.injectStyles();
        try {
            await this.waitForElement('[class="wrapper_ef3116 guilds_c48ade"]', 15000);
            setTimeout(() => this.runAutoReadTrash(), 2000);
            this.startInterval();
            if (this.settings.autoReadTrash.showCountdown) {
                await this.retryUICreation();
                this.startCountdown();
            }
            this.startUICheck();
        } catch (error) {
            this.log("❌ Αποτυχία εύρεσης guilds wrapper:", error.message);
        }
    }

    stopAutoReadTrash() {
        this.clearInterval();
        this.clearStartTimeout();
        this.stopCountdown();
        this.stopUICheck();
        this.clearNotifications();
        this._isRunning = false;
    }

    startUICheck() {
        if (this._uiCheckInterval) return;
        this._uiCheckInterval = setInterval(() => {
            this.retryUICreation().catch(error => 
                this.log("❌ Σφάλμα κατά την επανάληψη δημιουργίας UI:", error.message)
            );
        }, 5000);
    }

    stopUICheck() {
        if (this._uiCheckInterval) {
            clearInterval(this._uiCheckInterval);
            this._uiCheckInterval = null;
        }
    }

    debounceStartInterval() {
        this.clearStartTimeout();
        this._startTimeout = setTimeout(() => this.startInterval(), 500);
    }

    clearStartTimeout() {
        if (this._startTimeout) {
            clearTimeout(this._startTimeout);
            this._startTimeout = null;
        }
    }

    startInterval() {
        this.clearInterval();
        if (!this._isRunning) {
            this.runAutoReadTrash();
        }
        if (!this.interval) {
            this.interval = setInterval(() => {
                if (!this._isRunning) this.runAutoReadTrash();
            }, this.settings.autoReadTrash.intervalMinutes * 60 * 1000);
        }
    }

    clearInterval() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    async runAutoReadTrash() {
        if (this._isRunning) {
            this.log("⏳ AutoReadTrash ήδη σε εξέλιξη, παραλείπεται...");
            return;
        }
        this._isRunning = true;
        try {
            await this.doAutoRead(); // δεν μας νοιάζει αν πέτυχε ή όχι
            this._lastRun = Date.now();
            this.settings.lastRun = this._lastRun;
            this.saveSettings();
            this.startCountdown();
        } catch (error) {
            this.log("❌ Σφάλμα στο AutoReadTrash:", error.message);
        } finally {
            this._isRunning = false;
        }
    }

    queueNotification(successfulReads) {
        if (successfulReads <= 0) {
            this.log("⏩ Παράλειψη notification για 0 reads");
            return;
        }

        if (!this._pendingReads) this._pendingReads = 0;
        this._pendingReads += successfulReads;

        if (this._notificationDebounce) clearTimeout(this._notificationDebounce);
        this._notificationDebounce = setTimeout(() => {
            this._notificationQueue = [this._pendingReads];
            this._pendingReads = 0;
            if (!this._isShowingNotification) this.processNotificationQueue();
        }, 2500);
    }

    processNotificationQueue() {
        if (!this._notificationQueue.length || this._isShowingNotification) return;
        this._isShowingNotification = true;
        const successfulReads = this._notificationQueue[0];
        this._notificationQueue = [];
        this.showDiscordNotification(successfulReads);
    }

    clearNotifications() {
        this._notificationQueue = [];
        this._isShowingNotification = false;
        if (this.wrapper3d) {
            this.wrapper3d.innerHTML = '';
            this.wrapper3d.remove();
            this.wrapper3d = null;
        }
    }

    async showDiscordNotification(successfulReads) {
        try {
            const guildsWrapper = await this.waitForElement('[class="wrapper_ef3116 guilds_c48ade"]');
            if (!guildsWrapper) {
                this.log("❌ Guilds wrapper not found for notifications");
                return;
            }
            if (!this.wrapper3d) {
                this.wrapper3d = document.createElement('div');
                this.wrapper3d.className = 'art-wrapper';
                guildsWrapper.appendChild(this.wrapper3d);
            }
            const notif = document.createElement('div');
            notif.className = 'art-notif';
            notif.style.opacity = '0';
            notif.innerHTML = `
                <div class="art-notif-message">
                    <div class="art-notif-number">${successfulReads}</div>
                    <div class="art-notif-read">read</div>
                </div>
            `;
            this.wrapper3d.appendChild(notif);
            requestAnimationFrame(() => {
                notif.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
                notif.style.opacity = '0.95';
                notif.style.transform = 'translateY(0)';
                notif.classList.add('show');
            });
            const hideNotification = () => {
                notif.style.opacity = '0';
                notif.style.transform = 'translateY(5px)';
                notif.classList.remove('show');
                notif.classList.add('hide');
                notif.addEventListener('transitionend', () => {
                    notif.remove();
                    this._isShowingNotification = false;
                    this.processNotificationQueue();
                }, { once: true });
            };
            clearTimeout(this._hide3d);
            this._hide3d = setTimeout(hideNotification, 6000);
            notif.addEventListener('mouseenter', () => clearTimeout(this._hide3d));
            notif.addEventListener('mouseleave', () => {
                this._hide3d = setTimeout(hideNotification, 2000);
            });
        } catch (error) {
            this.log("❌ Error showing notification:", error.message);
            this._isShowingNotification = false;
        }
    }

    injectStyles() {
        if (this._style3d) return;
        const style = document.createElement('style');
        style.textContent = `
            .art-wrapper {
                position: absolute !important;
                bottom: 85px;
                left: 50% !important;
                transform: translateX(-50%) !important;
                width: 48px;
                max-width: 48px;
                display: flex;
                flex-direction: column;
                gap: 6px;
                z-index: 9999;
                margin: 0 auto;
                right: 0;
            }
            .art-notif {
                position: absolute !important;
                bottom: 50px;
                left: 50% !important;
                transform: translateX(-50%) !important;
                width: 48px !important;
                max-width: 48px;
                height: 50px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                padding: 2px;
                background: linear-gradient(145deg, #2f3136, #36393f);
                color: #dcddde;
                border-radius: 4px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                font-family: 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
                z-index: 9999;
                opacity: 0.95;
                transition: transform 0.7s ease, opacity 0.7s ease, box-shadow 0.2s ease;
                margin: 0 auto;
                right: 0;
            }
            .art-notif.show {
                opacity: 0.95;
                transform: translateY(0);
            }
            .art-notif.hide {
                opacity: 0;
                transform: translateY(5px);
            }
            .art-notif:hover {
                opacity: 1;
                box-shadow: 0 3px 6px rgba(0, 0, 0, 0.4);
                background: linear-gradient(145deg, #36393f, #40444b);
            }
            .art-notif-message {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                text-align: center;
            }
            .art-notif-number {
                font-size: 12px;
                font-weight: 600;
                color: #dcddde;
                line-height: 1;
                margin-bottom: 2px;
            }
            .art-notif-read {
                font-size: 10px;
                color: #b9bbbe;
                line-height: 1;
            }
            .art-countdown {
                position: absolute !important;
                bottom: 75px !important;
                left: 50% !important;
                transform: translateX(-50%) !important;
                width: 48px !important;
                max-width: 48px;
                height: 50px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                padding: 2px;
                background: linear-gradient(145deg, #2f3136, #36393f);
                color: #dcddde;
                border-radius: 4px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                font-family: 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
                z-index: 9999;
                opacity: 0.9;
                transition: transform 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease;
                margin: 0 auto;
                right: 0;
            }
            .art-countdown:hover {
                box-shadow: 0 3px 6px rgba(0, 0, 0, 0.4);
                opacity: 1;
            }
            .art-countdown-title {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                text-align: center;
            }
            .art-countdown-next {
                font-size: 7px;
                font-weight: 600;
                color: #b9bbbe;
                text-transform: uppercase;
                line-height: 1;
                margin-bottom: 2px;
            }
            .art-countdown-clear {
                font-size: 7px;
                font-weight: 600;
                color: #b9bbbe;
                text-transform: uppercase;
                line-height: 1;
                margin-bottom: 2px;
            }
            .art-countdown-time {
                font-size: 13px;
                color: #dcddde;
                line-height: 1;
            }
        `;
        document.head.appendChild(style);
        this._style3d = style;
    }

    async startCountdown() {
        this.stopCountdown();
        if (!this.settings.autoReadTrash.showCountdown) return;
        try {
            await this.createCountdownUI();
            this.countdownInterval = setInterval(() => this.updateCountdownUI(), 1000);
            this.updateCountdownUI();
        } catch (error) {
            this.log("❌ Error starting countdown:", error.message);
        }
    }

    stopCountdown() {
        if (this.countdownInterval) {
            this.log("🛑 Countdown stopped");
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        const el = document.querySelector('.art-countdown');
        if (el) el.remove();
    }

    async createCountdownUI() {
        const guildsWrapper = await this.waitForElement('[class="wrapper_ef3116 guilds_c48ade"]');
        if (!guildsWrapper) {
            this.log("❌ Guilds wrapper not found for countdown");
            throw new Error("Guilds wrapper not found");
        }
        let existingCountdown = document.querySelector('.art-countdown');
        if (existingCountdown) {
            this.log("ℹ️ Countdown UI υπάρχει ήδη, παραλείπεται η δημιουργία");
            return;
        }
        const el = document.createElement('div');
        el.className = 'art-countdown';
        el.style.position = 'absolute';
        el.style.bottom = '75px';
        el.style.left = '50%';
        el.style.transform = 'translateX(-50%)';
        el.style.width = '48px';
        el.style.maxWidth = '48px';
        el.style.margin = '0 auto';
        el.style.right = '0';
        el.innerHTML = `
            <div class="art-countdown-title">
                <div class="art-countdown-next">next</div>
                <div class="art-countdown-clear">clear</div>
                <div class="art-countdown-time"><span class="timer-text">0' 0"</span></div>
            </div>
        `;
        guildsWrapper.appendChild(el);
        this.log("✅ Countdown UI δημιουργήθηκε");
    }

    updateCountdownUI() {
        const el = document.querySelector('.art-countdown');
        if (!el) return;
        const timerText = el.querySelector('.timer-text');
        if (!timerText) return;

        const now = Date.now();
        this._nextCountdownTarget = (this._lastRun || now) + this.settings.autoReadTrash.intervalMinutes * 60 * 1000;
        const next = this._nextCountdownTarget;
        if (!this._nextCountdownTarget || isNaN(this._nextCountdownTarget)) return;
        const diff = Math.max(0, Math.floor((this._nextCountdownTarget - Date.now()) / 1000));
        if (!timerText._lastValue || timerText._lastValue !== diff) {
            timerText._lastValue = diff;
        } else {
            return; // Prevent flicker when value hasn't changed
        }

        if (diff <= 0) {
            this.stopCountdown();
            this.runAutoReadTrash();
            return;
        }

        const mins = Math.floor(diff / 60);
        const secs = diff % 60;
        timerText.textContent = `${mins}' ${secs}"`;
    }

    // --- HideFolders Functionality ---

    startHideFolders() {
        this.hideWrappers();
    }

    stopHideFolders() {
        this.showWrappers();
    }

    getConfigIds() {
        return this.settings.hideFolders.folderIds.split(",").map(id => id.trim()).filter(Boolean);
    }

    hideWrappers() {
        this.getConfigIds().forEach(id => {
            const elm = document.querySelector(`[data-list-item-id="${id}"]`);
            const wrapper = elm?.closest(".wrapper_cc5dd2");
            if (wrapper) wrapper.style.display = "none";
        });
    }

    showWrappers() {
        this.getConfigIds().forEach(id => {
            const elm = document.querySelector(`[data-list-item-id="${id}"]`);
            const wrapper = elm?.closest(".wrapper_cc5dd2");
            if (wrapper) wrapper.style.display = "";
        });
    }

    // --- Custom Modal UI with Collapsible Sections ---

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
        title.textContent = "🔧 FolderManager";
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
            .fm-section {
                margin-bottom: 10px;
                background: rgba(15, 15, 25, 0.5);
                border-radius: 12px;
                box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
                overflow: hidden;
            }
            .fm-section-header {
                padding: 15px 20px;
                background: linear-gradient(145deg, rgba(0, 255, 204, 0.1), rgba(0, 204, 153, 0.1));
                color: #00ffcc;
                font-size: 18px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
                text-shadow: 0 0 5px rgba(0, 255, 204, 0.5);
                transition: background 0.3s ease;
            }
            .fm-section-header:hover {
                background: linear-gradient(145deg, rgba(0, 255, 204, 0.2), rgba(0, 204, 153, 0.2));
            }
            .fm-section-chevron {
                font-size: 16px;
                transition: transform 0.3s ease;
            }
            .fm-section-chevron.expanded {
                transform: rotate(180deg);
            }
            .fm-section-content {
                padding: 0 20px;
                max-height: 0;
                opacity: 0;
                overflow: hidden;
                transition: max-height 0.3s ease, opacity 0.3s ease, padding 0.3s ease;
            }
            .fm-section-content.expanded {
                padding: 20px;
                max-height: 500px;
                opacity: 1;
            }
            .custom-input, .custom-textarea {
                width: 90%;
                max-width: 500px;
                margin: 0 auto;
                padding: 12px 16px;
                border-radius: 12px;
                background: rgba(15, 15, 25, 0.9);
                color: #e0e0e0;
                border: 2px solid rgba(0, 255, 204, 0.3);
                box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
                font-size: 14px;
                font-family: 'Courier New', monospace;
                transition: border-color 0.3s ease, box-shadow 0.3s ease;
            }
            .custom-input:focus, .custom-textarea:focus {
                border-color: rgba(0, 255, 204, 0.6);
                box-shadow: 0 0 10px rgba(0, 255, 204, 0.5);
                outline: none;
            }
            .custom-textarea {
                min-height: 80px;
                resize: vertical;
                scrollbar-width: none;
            }
            .custom-textarea::-webkit-scrollbar {
                display: none;
            }
            .custom-label {
                font-size: 14px;
                color: #a0a0c0;
                margin-bottom: 8px;
                text-transform: uppercase;
                letter-spacing: 1px;
                text-align: center;
            }
            .custom-toggle {
                display: flex;
                justify-content: center;
                margin: 20px 0;
            }
            .custom-toggle-button {
                padding: 10px 20px;
                background: linear-gradient(145deg, rgba(0, 255, 204, 0.2), rgba(0, 204, 153, 0.2));
                color: #00ffcc;
                border: 2px solid #00ffcc;
                border-radius: 12px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 1.5px;
                box-shadow: 0 0 15px rgba(0, 255, 204, 0.5);
            }
            .custom-toggle-button.off {
                background: linear-gradient(145deg, rgba(100, 100, 100, 0.2), rgba(80, 80, 80, 0.2));
                border: 2px solid #a0a0c0;
                color: #a0a0c0;
                box-shadow: 0 0 10px rgba(160, 160, 192, 0.3);
            }
            .custom-toggle-button:hover {
                background: linear-gradient(145deg, rgba(0, 255, 204, 0.4), rgba(0, 204, 153, 0.4));
                transform: translateY(-2px);
                box-shadow: 0 0 25px rgba(0, 255, 204, 0.8);
            }
            .custom-toggle-button.off:hover {
                background: linear-gradient(145deg, rgba(120, 120, 120, 0.4), rgba(100, 100, 100, 0.4));
                box-shadow: 0 0 15px rgba(160, 160, 192, 0.5);
            }
            .custom-clear-button {
                padding: 10px 20px;
                background: linear-gradient(145deg, rgba(255, 85, 85, 0.2), rgba(204, 0, 0, 0.2));
                color: #ff5555;
                border: 2px solid #ff5555;
                border-radius: 12px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 1.5px;
                box-shadow: 0 0 15px rgba(255, 85, 85, 0.5);
                margin: 10px auto;
                display: block;
            }
        `;
        document.head.appendChild(styleSheet);
        modalContent.appendChild(title);

        const description = document.createElement("p");
        description.textContent = "Διαχειριστείτε τις ρυθμίσεις για AutoReadTrash και HideFolders.";
        description.style.textAlign = "center";
        description.style.fontSize = "16px";
        description.style.color = "#a0a0c0";
        description.style.marginBottom = "30px";
        description.style.lineHeight = "1.6";
        description.style.opacity = "0";
        description.style.animation = "slideUp 0.6s ease forwards 0.3s";
        modalContent.appendChild(description);

        // --- AutoReadTrash Section ---
        const autoReadTrashSection = document.createElement("div");
        autoReadTrashSection.className = "fm-section";

        const artHeader = document.createElement("div");
        artHeader.className = "fm-section-header";
        const artTitle = document.createElement("span");
        artTitle.textContent = "AutoReadTrash";
        const artChevron = document.createElement("span");
        artChevron.className = "fm-section-chevron";
        artChevron.textContent = "▼";
        artHeader.appendChild(artTitle);
        artHeader.appendChild(artChevron);

        const artContent = document.createElement("div");
        artContent.className = "fm-section-content";

        // AutoReadTrash Enable Toggle
        const artToggleWrapper = document.createElement("div");
        artToggleWrapper.className = "custom-toggle";
        const artToggleButton = document.createElement("button");
        artToggleButton.className = `custom-toggle-button ${this.settings.autoReadTrash.enabled ? "" : "off"}`;
        artToggleButton.textContent = this.settings.autoReadTrash.enabled ? "Ενεργό" : "Ανενεργό";
        artToggleButton.onclick = () => {
            this.settings.autoReadTrash.enabled = !this.settings.autoReadTrash.enabled;
            this.saveSettings();
            artToggleButton.className = `custom-toggle-button ${this.settings.autoReadTrash.enabled ? "" : "off"}`;
            artToggleButton.textContent = this.settings.autoReadTrash.enabled ? "Ενεργό" : "Ανενεργό";
            this.settings.autoReadTrash.enabled ? this.startAutoReadTrash() : this.stopAutoReadTrash();
        };
        artToggleWrapper.appendChild(artToggleButton);
        artContent.appendChild(artToggleWrapper);

        // AutoReadTrash Folder IDs
        const artFolderIdsWrapper = document.createElement("div");
        artFolderIdsWrapper.style.marginBottom = "20px";
        const artFolderIdsLabel = document.createElement("div");
        artFolderIdsLabel.className = "custom-label";
        artFolderIdsLabel.textContent = "Folder IDs (comma-separated)";
        const artFolderIdsInput = document.createElement("textarea");
        artFolderIdsInput.className = "custom-textarea";
        artFolderIdsInput.value = this.settings.autoReadTrash.folderIds;
        artFolderIdsInput.placeholder = "π.χ. guildsnav___123, guildsnav___456";
        artFolderIdsInput.oninput = () => {
            this.settings.autoReadTrash.folderIds = artFolderIdsInput.value.trim();
            this.log("📝 Ενημέρωση folderIds:", this.settings.autoReadTrash.folderIds);
            this.saveSettings();
            this.debounceStartInterval();
        };
        artFolderIdsWrapper.appendChild(artFolderIdsLabel);
        artFolderIdsWrapper.appendChild(artFolderIdsInput);
        artContent.appendChild(artFolderIdsWrapper);

        // AutoReadTrash Interval
        const artIntervalWrapper = document.createElement("div");
        artIntervalWrapper.style.marginBottom = "20px";
        const artIntervalLabel = document.createElement("div");
        artIntervalLabel.className = "custom-label";
        artIntervalLabel.textContent = "Διάστημα (λεπτά)";
        const artIntervalInput = document.createElement("input");
        artIntervalInput.className = "custom-input";
        artIntervalInput.type = "number";
        artIntervalInput.min = 5;
        artIntervalInput.max = 120;
        artIntervalInput.value = this.settings.autoReadTrash.intervalMinutes;
        artIntervalInput.oninput = () => {
            const parsed = parseInt(artIntervalInput.value.trim()) || 5;
            const v = Math.max(5, Math.min(parsed, 120));
            if (parsed !== v) {
                this.showCustomToast(parsed < 5 ? "Το ελάχιστο είναι 5 λεπτά" : "Το μέγιστο είναι 120 λεπτά", "error");
            }
            artIntervalInput.value = v;
            this.settings.autoReadTrash.intervalMinutes = v;
            this.log("📝 Ενημέρωση intervalMinutes:", this.settings.autoReadTrash.intervalMinutes);
            this.saveSettings();
            this.debounceStartInterval();
        };
        artIntervalWrapper.appendChild(artIntervalLabel);
        artIntervalWrapper.appendChild(artIntervalInput);
        artContent.appendChild(artIntervalWrapper);

        // AutoReadTrash Show Countdown Toggle
        const artCountdownToggleWrapper = document.createElement("div");
        artCountdownToggleWrapper.className = "custom-toggle";
        const artCountdownToggleButton = document.createElement("button");
        artCountdownToggleButton.className = `custom-toggle-button ${this.settings.autoReadTrash.showCountdown ? "" : "off"}`;
        artCountdownToggleButton.textContent = this.settings.autoReadTrash.showCountdown ? "Αντίστροφη Μέτρηση: Ενεργό" : "Αντίστροφη Μέτρηση: Ανενεργό";
        artCountdownToggleButton.onclick = () => {
            this.settings.autoReadTrash.showCountdown = !this.settings.autoReadTrash.showCountdown;
            this.saveSettings();
            artCountdownToggleButton.className = `custom-toggle-button ${this.settings.autoReadTrash.showCountdown ? "" : "off"}`;
            artCountdownToggleButton.textContent = this.settings.autoReadTrash.showCountdown ? "Αντίστροφη Μέτρηση: Ενεργό" : "Αντίστροφη Μέτρηση: Ανενεργό";
            this.settings.autoReadTrash.showCountdown ? this.startCountdown() : this.stopCountdown();
        };
        artCountdownToggleWrapper.appendChild(artCountdownToggleButton);
        artContent.appendChild(artCountdownToggleWrapper);

        // AutoReadTrash Clear Button
        const artClearButton = document.createElement("button");
        artClearButton.className = "custom-clear-button";
        artClearButton.textContent = "Καθαρισμός AutoReadTrash IDs";
        artClearButton.onclick = () => {
            this.settings.autoReadTrash.folderIds = "";
            this.saveSettings();
            artFolderIdsInput.value = "";
            this.debounceStartInterval();
        };
        artContent.appendChild(artClearButton);

        // Toggle functionality for AutoReadTrash section
        artHeader.onclick = () => {
            const isExpanded = artContent.classList.contains("expanded");
            if (isExpanded) {
                artContent.classList.remove("expanded");
                artChevron.classList.remove("expanded");
            } else {
                artContent.classList.add("expanded");
                artChevron.classList.add("expanded");
            }
        };

        autoReadTrashSection.appendChild(artHeader);
        autoReadTrashSection.appendChild(artContent);
        modalContent.appendChild(autoReadTrashSection);

        // --- HideFolders Section ---
        const hideFoldersSection = document.createElement("div");
        hideFoldersSection.className = "fm-section";

        const hfHeader = document.createElement("div");
        hfHeader.className = "fm-section-header";
        const hfTitle = document.createElement("span");
        hfTitle.textContent = "HideFolders";
        const hfChevron = document.createElement("span");
        hfChevron.className = "fm-section-chevron";
        hfChevron.textContent = "▼";
        hfHeader.appendChild(hfTitle);
        hfHeader.appendChild(hfChevron);

        const hfContent = document.createElement("div");
        hfContent.className = "fm-section-content";

        // HideFolders Enable Toggle
        const hfToggleWrapper = document.createElement("div");
        hfToggleWrapper.className = "custom-toggle";
        const hfToggleButton = document.createElement("button");
        hfToggleButton.className = `custom-toggle-button ${this.settings.hideFolders.enabled ? "" : "off"}`;
        hfToggleButton.textContent = this.settings.hideFolders.enabled ? "Ενεργό" : "Ανενεργό";
        hfToggleButton.onclick = () => {
            this.settings.hideFolders.enabled = !this.settings.hideFolders.enabled;
            this.saveSettings();
            hfToggleButton.className = `custom-toggle-button ${this.settings.hideFolders.enabled ? "" : "off"}`;
            hfToggleButton.textContent = this.settings.hideFolders.enabled ? "Ενεργό" : "Ανενεργό";
            if (this.settings.hideFolders.enabled) {
                        this.startHideFolders();
            } else {
                this.stopHideFolders();
            }
        };
        hfToggleWrapper.appendChild(hfToggleButton);
        hfContent.appendChild(hfToggleWrapper);

        // HideFolders Folder IDs
        const hfFolderIdsWrapper = document.createElement("div");
        hfFolderIdsWrapper.style.marginBottom = "20px";
        const hfFolderIdsLabel = document.createElement("div");
        hfFolderIdsLabel.className = "custom-label";
        hfFolderIdsLabel.textContent = "Folder IDs (comma-separated)";
        const hfFolderIdsInput = document.createElement("textarea");
        hfFolderIdsInput.className = "custom-textarea";
        hfFolderIdsInput.value = this.settings.hideFolders.folderIds;
        hfFolderIdsInput.placeholder = "π.χ. guildsnav___123, guildsnav___456";
        hfFolderIdsInput.oninput = () => {
            this.settings.hideFolders.folderIds = hfFolderIdsInput.value.trim();
            this.log("📝 Ενημέρωση hideFolders folderIds:", this.settings.hideFolders.folderIds);
            this.saveSettings();
            this.showWrappers();
            setTimeout(() => this.hideWrappers(), 100);
        };
        hfFolderIdsWrapper.appendChild(hfFolderIdsLabel);
        hfFolderIdsWrapper.appendChild(hfFolderIdsInput);
        hfContent.appendChild(hfFolderIdsWrapper);

        // HideFolders Clear Button
        const hfClearButton = document.createElement("button");
        hfClearButton.className = "custom-clear-button";
        hfClearButton.textContent = "Καθαρισμός HideFolders IDs";
        hfClearButton.onclick = () => {
            this.settings.hideFolders.folderIds = "";
            this.saveSettings();
            hfFolderIdsInput.value = "";
            this.showWrappers();
            setTimeout(() => this.hideWrappers(), 100);
        };
        hfContent.appendChild(hfClearButton);

        // Toggle functionality for HideFolders section
        hfHeader.onclick = () => {
            const isExpanded = hfContent.classList.contains("expanded");
            if (isExpanded) {
                hfContent.classList.remove("expanded");
                hfChevron.classList.remove("expanded");
            } else {
                hfContent.classList.add("expanded");
                hfChevron.classList.add("expanded");
            }
        };

        hideFoldersSection.appendChild(hfHeader);
        hideFoldersSection.appendChild(hfContent);
        modalContent.appendChild(hideFoldersSection);

        // Update Button
        const buttonWrapper = document.createElement("div");
        buttonWrapper.style.position = "relative";
        buttonWrapper.style.display = "flex";
        buttonWrapper.style.justifyContent = "center";
        buttonWrapper.style.margin = "0 auto";
        buttonWrapper.style.width = "fit-content";

        const updateButton = document.createElement("button");
        updateButton.textContent = "🔄 Έλεγχος & Ενημέρωση Τώρα";
        updateButton.style.padding = "14px 32px";
        updateButton.style.background = "linear-gradient(145deg, rgba(0, 255, 204, 0.2), rgba(0, 204, 153, 0.2))";
        updateButton.style.color = "#00ffcc";
        updateButton.style.border = "2px solid #00ffcc";
        updateButton.style.borderRadius = "12px";
        updateButton.style.fontSize = "16px";
        updateButton.style.fontWeight = "600";
        updateButton.style.cursor = "pointer";
        updateButton.style.transition = "all 0.3s ease";
        updateButton.style.textTransform = "uppercase";
        updateButton.style.letterSpacing = "1.5px";
        updateButton.style.position = "relative";
        updateButton.style.overflow = "hidden";
        updateButton.style.animation = "holographicFlicker 2s ease infinite";
        updateButton.style.boxShadow = "0 0 15px rgba(0, 255, 204, 0.5)";

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
            updateButton.appendChild(particle);
        }

        updateButton.onmouseover = () => {
            updateButton.style.background = "linear-gradient(145deg, rgba(0, 255, 204, 0.4), rgba(0, 204, 153, 0.4))";
            updateButton.style.transform = "translateY(-4px)";
            updateButton.style.boxShadow = "0 0 25px rgba(0, 255, 204, 0.8)";
        };
        updateButton.onmouseout = () => {
            updateButton.style.background = "linear-gradient(145deg, rgba(0, 255, 204, 0.2), rgba(0, 204, 153, 0.2))";
            updateButton.style.transform = "translateY(0)";
            updateButton.style.boxShadow = "0 0 15px rgba(0, 255, 204, 0.5)";
        };
        updateButton.onclick = async () => {
            if (this._updateInProgress) return;
            this._updateInProgress = true;
            updateButton.style.pointerEvents = "none";
            updateButton.style.animation = "none";
            updateButton.innerHTML = `<span style="display: inline-block; animation: spin 1s linear infinite;">🔄</span> Ενημέρωση...`;
            await this.checkAndUpdate(modalContent);
            this._updateInProgress = false;
            updateButton.style.pointerEvents = "auto";
            updateButton.style.animation = "holographicFlicker 2s ease infinite";
            updateButton.textContent = "🔄 Έλεγχος & Ενημέρωση Τώρα";
        };

        buttonWrapper.appendChild(updateButton);
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

    // --- Update Functionality ---

    async checkAndUpdate(container) {
        const results = container ? container.querySelector("#update-results") : null;
        if (results) results.innerHTML = "<b>Αποτελέσματα:</b><br>";

        const pluginName = "FolderManager";
        const updateUrl = "https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/.FolderManager.plugin.js";
        const filename = ".FolderManager.plugin.js";

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

            if (this._justUpdated) {
                this._justUpdated = false;
                if (results) {
                    const msg = document.createElement("div");
                    msg.innerHTML = `✅ Είσαι ήδη ενημερωμένος! (<code>${localVersion}</code>)<br>`;
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
        this.showCustomToast2("Ο έλεγχος και η ενημέρωση ολοκληρώθηκαν!", "success");
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
            BdApi.Plugins.disable("FolderManager");
            const fs = require("fs");
            const path = require("path");
            const filePath = path.join(BdApi.Plugins.folder, plugin.filename);
            fs.writeFileSync(filePath, code);
            BdApi.Plugins.enable("FolderManager");
            this._justUpdated = true;
        } catch (err) {
            this.log("❌ Error downloading update:", err.message);
            throw err;
        }
    }

    showCustomToast(message, type = "success") {
        const toast = document.createElement("div");
        toast.style.position = "fixed";
        toast.style.bottom = "20px";
        toast.style.right = "20px";
        toast.style.padding = "10px 20px";
        toast.style.background = type === "success" ? "rgba(0, 255, 204, 0.2)" : "rgba(255, 85, 85, 0.2)";
        toast.style.color = type === "success" ? "#00ffcc" : "#ff5555";
        toast.style.border = `2px solid ${type === "success" ? "#00ffcc" : "#ff5555"}`;
        toast.style.borderRadius = "8px";
        toast.style.boxShadow = `0 0 10px ${type === "success" ? "rgba(0, 255, 204, 0.5)" : "rgba(255, 85, 85, 0.5)"}`;
        toast.style.zIndex = "10000";
        toast.style.opacity = "0";
        toast.style.transition = "opacity 0.3s ease";
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "1";
        }, 10);

        setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // --- Icon Injection ---

    injectIcon() {
        const pluginCards = document.querySelectorAll('[class*="bd-addon-card"]');
        let pluginCard = null;
        pluginCards.forEach(card => {
            const titleElement = card.querySelector('[class*="bd-addon-header"]');
            if (titleElement && titleElement.textContent.includes("FolderManager")) {
                pluginCard = card;
            }
        });

        if (pluginCard) {
            const controls = pluginCard.querySelector('[class*="bd-controls"]');
            if (controls && !controls.querySelector('[aria-label="Plugin Manager"]')) {
                this.createAndInjectIcon(controls);
            }
        }

        this.startObserver();
    }

    startObserver() {
        if (this.observer) return;
        const targetNode = document.body;
        const config = { childList: true, subtree: true };
        this.observer = new MutationObserver((mutations, observer) => {
            const pluginCards = document.querySelectorAll('[class*="bd-addon-card"]');
            let pluginCard = null;
            pluginCards.forEach(card => {
                const titleElement = card.querySelector('[class*="bd-addon-header"]');
                if (titleElement && titleElement.textContent.includes("FolderManager")) {
                    pluginCard = card;
                }
            });

            if (pluginCard) {
                const controls = pluginCard.querySelector('[class*="bd-controls"]');
                if (controls && !controls.querySelector('[aria-label="Plugin Manager"]')) {
                    this.createAndInjectIcon(controls);
                }
            }
        });

        this.observer.observe(targetNode, config);
    }

    createAndInjectIcon(controls) {
        const iconButton = document.createElement("button");
        iconButton.setAttribute("aria-label", "Plugin Manager");
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
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }

    // --- Utility Methods ---

    showCustomToast2(text, type = "info") {
        // Έλεγχος αν υπάρχει ήδη toast για να αποφευχθεί το spam
        const existingToast = document.querySelector('.fm-toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement("div");
        toast.className = 'fm-toast';
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
        toast.style.zIndex = "10000";
        toast.style.fontFamily = "'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif";
        toast.style.transition = "opacity 0.4s ease, transform 0.4s ease";
        toast.style.opacity = "0";
        toast.style.transform = "translateX(-50%) translateY(20px)";

        document.body.appendChild(toast);

        // Animation για εμφάνιση
        requestAnimationFrame(() => {
            toast.style.opacity = "1";
            toast.style.transform = "translateX(-50%) translateY(0)";
        });

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateX(-50%) translateY(20px)";
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    log(...args) {
        console.log("[FolderManager]", ...args);
    }
};