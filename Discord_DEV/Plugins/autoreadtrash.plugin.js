/**
 * @name AutoReadTrash
 * @version 5.6.4
 * @description Μαρκάρει φακέλους ως αναγνωσμένους με βάση τα ID τους, με το παλιό δεξί κλικ + click, responsive UI, Material-style settings και έλεγχο τιμών.
 * @author ThomasT
 * @authorId 706932839907852389
 * @source https://github.com/thomasthanos/1st-theme/blob/main/Discord_DEV/Plugins/autoreadtrash.plugin.js
 * @updateUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/autoreadtrash.plugin.js
 * @downloadUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/autoreadtrash.plugin.js
 * @website https://github.com/thomasthanos
 */
module.exports = class AutoReadTrash {
	defaultSettings = {
		folderIds: "guildsnav___2512556488",
		intervalMinutes: 15,
		showCountdown: true
	};
	constructor() {
		this._notificationQueue = [];
		this._isShowingNotification = false;
		this._isRunning = false;
		this._lastRun = 0;
		this._startTimeout = null;
		this._uiCheckInterval = null;
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
	startUICheck() {
		if (this._uiCheckInterval) return;
		this._uiCheckInterval = setInterval(() => {
			const guildsWrapper = document.querySelector('[class="wrapper_ef3116 guilds_c48ade"]');
			if (!guildsWrapper) return;
			if (!document.querySelector('.art-countdown') && this.settings.showCountdown) {
				this.createCountdownUI().catch(error => this.log("❌ Error re-adding countdown:", error.message));
			}
			if (!document.querySelector('.art-wrapper') && this._notificationQueue.length > 0) {
				this.wrapper3d = null;
				this.processNotificationQueue();
			}
		}, 2000);
	}
	stopUICheck() {
		if (this._uiCheckInterval) {
			clearInterval(this._uiCheckInterval);
			this._uiCheckInterval = null;
		}
	}
	async start() {
		this.settings = Object.assign({}, this.defaultSettings, BdApi.loadData("AutoReadTrash", "settings") || {});
		this._lastRun = Date.now();
		this.injectStyles();
		try {
			await this.waitForElement('[class="wrapper_ef3116 guilds_c48ade"]');
			this.debounceStartInterval();
			this.startCountdown();
			this.startUICheck();
		} catch (error) {
			this.log("❌ Failed to find guilds wrapper:", error.message);
		}
	}
	stop() {
		this.clearInterval();
		this.clearStartTimeout();
		this.stopCountdown();
		this.stopUICheck();
		this.clearNotifications();
		this._isRunning = false;
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
		if (!this._isRunning) this.run();
		this.interval = setInterval(() => {
			if (!this._isRunning) this.run();
		}, this.settings.intervalMinutes * 60 * 1000);
	}
	clearInterval() {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}
	async run() {
		if (this._isRunning) return;
		this._isRunning = true;
		try {
			const ids = this.settings.folderIds.split(",").map(id => id.trim()).filter(Boolean);
			const items = await Promise.all(
				ids.map(async id => {
					try {
						return await this.waitForElement(`[data-list-item-id="${id}"]`, 5000);
					} catch (error) {
						this.log(`❌ Failed to find folder with ID ${id}:`, error.message);
						return null;
					}
				})
			).then(results => results.filter(Boolean));
			if (!items.length) {
				this.log("❌ Δεν βρέθηκαν φάκελοι:", ids);
				this.queueNotification(0);
				return;
			}
			let successfulReads = 0;
			for (const [index, folder] of items.entries()) {
				const id = folder.getAttribute("data-list-item-id");
				await new Promise(resolve => {
					const existingMenu = document.querySelector('[class*="contextMenu"]');
					if (existingMenu) existingMenu.style.display = "none";
					setTimeout(() => {
						folder.dispatchEvent(new MouseEvent("contextmenu", {
							bubbles: true,
							cancelable: true,
							clientX: -9999,
							clientY: -9999
						}));
						setTimeout(() => {
							const btn = document.querySelector('#guild-context-mark-folder-read');
							if (btn) {
								if (btn.getAttribute("aria-disabled") !== "true") {
									btn.click();
									successfulReads++;
									this.log(`📬 Φάκελος ${id} μαρκαρίστηκε ως αναγνωσμένος`);
								}
							}
							const menu = document.querySelector('[class*="contextMenu"]');
							if (menu) menu.style.display = "none";
							resolve();
						}, 250);
					}, index * 500);
				});
			}
			this.queueNotification(successfulReads);
			this._lastRun = Date.now();
			this.updateCountdownUI?.();
		} finally {
			this._isRunning = false;
		}
	}
	queueNotification(successfulReads) {
		if (this._notificationQueue.length < 3) this._notificationQueue.push(successfulReads);
		if (!this._isShowingNotification) this.processNotificationQueue();
	}
	processNotificationQueue() {
		if (!this._notificationQueue.length || this._isShowingNotification) return;
		this._isShowingNotification = true;
		const successfulReads = this._notificationQueue.shift();
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
			notif.innerHTML = `
				<div class="art-notif-message">
					<div class="art-notif-number">${successfulReads}</div>
					<div class="art-notif-read">read</div>
				</div>
			`;
			this.wrapper3d.appendChild(notif);
			requestAnimationFrame(() => notif.classList.add('show'));
			const hideNotification = () => {
				notif.classList.remove('show');
				notif.classList.add('hide');
				notif.addEventListener('transitionend', () => {
					notif.remove();
					this._isShowingNotification = false;
					this.processNotificationQueue();
				}, { once: true });
			};
			clearTimeout(this._hide3d);
			this._hide3d = setTimeout(hideNotification, 3000);
			notif.addEventListener('mouseenter', () => clearTimeout(this._hide3d));
			notif.addEventListener('mouseleave', () => {
				this._hide3d = setTimeout(hideNotification, 1000);
			});
		} catch (error) {
			this.log("❌ Error showing notification:", error.message);
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
				opacity: 0.9;
				transition: transform 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease;
				margin: 0 auto;
				right: 0;
			}
			.art-notif.show {
				opacity: 0.9;
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
		if (!this.settings.showCountdown) return;
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
		if (document.querySelector('.art-countdown')) return;
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
		guildsWrapper.appendChild(el);
	}
	updateCountdownUI() {
		const el = document.querySelector('.art-countdown');
		if (!el) return;
		const now = Date.now();
		const next = (this._lastRun || now) + this.settings.intervalMinutes * 60 * 1000;
		const diff = Math.max(0, Math.floor((next - now) / 1000));
		const mins = Math.floor(diff / 60);
		const secs = diff % 60;
		el.innerHTML = `
			<div class="art-countdown-title">
				<div class="art-countdown-next">next</div>
				<div class="art-countdown-clear">clear</div>
				<div class="art-countdown-time">${mins}' ${secs}"</div>
			</div>
		`;
	}
	getSettingsPanel() {
		const panel = document.createElement("div");
		panel.className = "art-container bd-addon-settings-wrap";
		panel.style = `
			display: flex;
			flex-direction: column;
			gap: 20px;
			max-width: 500px;
			width: 100%;
			margin: 0 auto;
			padding: 24px;
			background: linear-gradient(145deg, #1A1A1E, #202023);
			border-radius: 16px;
			box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3);
			color: #e0e0e0;
			font-family: 'Roboto', 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif;
			box-sizing: border-box;
			overflow: hidden;
		`;
		const style = document.createElement("style");
		style.textContent = `
			.art-label {
				font-weight: 500;
				font-size: 14px;
				color: #b0bec5;
				margin-bottom: 8px;
				text-transform: uppercase;
				letter-spacing: 0.8px;
				text-align: center;
				transition: color 0.2s ease;
			}
			.art-input, .art-textarea {
				max-width: 360px;
				width: 100%;
				margin: 0 auto;
				padding: 12px 16px;
				border-radius: 12px;
				background: linear-gradient(145deg,rgb(26, 26, 30),rgb(22, 22, 24));
				color: #e0e0e0;
				border: none;
				box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.2);
				box-sizing: border-box;
				font-size: 14px;
				font-family: 'Roboto', 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif;
				transition: box-shadow 0.3s ease, background 0.3s ease;
				display: block;
			}
			.art-input:focus, .art-textarea:focus {
				background: linear-gradient(145deg, #202023, #252528);
				box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4), 0 0 8px rgba(33, 150, 243, 0.5);
				outline: none;
			}
			.art-textarea {
				min-height: 48px;
				resize: vertical;
				-ms-overflow-style: none;  /* IE and Edge */
				scrollbar-width: none;  /* Firefox */
			}
			.art-textarea::-webkit-scrollbar {
				display: none;  /* Chrome, Safari, and Opera */
			}
        .art-toggle {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
        }
        .art-toggle button {
            padding: 10px 20px;
            border: none;
            border-radius: 12px;
            background: linear-gradient(145deg, #0288d1, #0277bd);
            color: #ffffff;
            font-weight: 500;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.3s ease, box-shadow 0.3s ease, transform 0.2s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .art-toggle button.off {
            background: linear-gradient(145deg, #455a64, #37474f);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        .art-toggle button:hover {
            background: linear-gradient(145deg, #01579b, #0277bd);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5), 0 3px 6px rgba(0, 0, 0, 0.4);
            transform: translateY(-2px);
        }
        .art-toggle button.off:hover {
            background: linear-gradient(145deg, #546e7a, #455a64);
        }
        .art-toggle button:active {
            transform: translateY(0);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
		`;
		document.head.appendChild(style);
		const debounce = (fn, wait = 500) => {
			let timeout;
			return (...args) => {
				clearTimeout(timeout);
				timeout = setTimeout(() => fn(...args), wait);
			};
		};
		const createTextArea = (label, value, key) => {
			const wrapper = document.createElement("div");
			wrapper.style.textAlign = "center";
			const lbl = document.createElement("div");
			lbl.className = "art-label";
			lbl.textContent = label;
			const input = document.createElement("textarea");
			input.className = "art-textarea";
			input.value = value;
			input.placeholder = "π.χ. guildsnav___123, guildsnav___456";
			input.oninput = debounce(() => {
				this.settings[key] = input.value;
				BdApi.saveData("AutoReadTrash", "settings", this.settings);
				this.debounceStartInterval();
			});
			wrapper.append(lbl, input);
			return wrapper;
		};
		const createNumberInput = (label, value, key) => {
			const wrapper = document.createElement("div");
			wrapper.style.textAlign = "center";
			const lbl = document.createElement("div");
			lbl.className = "art-label";
			lbl.textContent = label;
			const input = document.createElement("input");
			input.className = "art-input";
			input.type = "number";
			input.min = 5;
			input.value = value;
			input.oninput = debounce(() => {
				const parsed = parseInt(input.value.trim()) || 5;
				const v = Math.max(5, Math.min(parsed, 120));
				if (parsed !== v) {
					BdApi.showToast(parsed < 5 ? "Το ελάχιστο είναι 5 λεπτά" : "Το μέγιστο είναι 120 λεπτά", { type: "error" });
				}
				input.value = v;
				this.settings[key] = v;
				BdApi.saveData("AutoReadTrash", "settings", this.settings);
				this.debounceStartInterval();
			});
			wrapper.append(lbl, input);
			return wrapper;
		};
		const createToggleButton = (label, value, key) => {
			const wrapper = document.createElement("div");
			wrapper.className = "art-toggle";
			const lbl = document.createElement("div");
			lbl.className = "art-label";
			lbl.textContent = label;
			const button = document.createElement("button");
			button.textContent = value ? "Ενεργό" : "Ανενεργό";
			button.className = value ? "" : "off";
			button.onclick = () => {
				const newVal = !this.settings[key];
				this.settings[key] = newVal;
				BdApi.saveData("AutoReadTrash", "settings", this.settings);
				button.textContent = newVal ? "Ενεργό" : "Ανενεργό";
				button.className = newVal ? "" : "off";
				newVal ? this.startCountdown() : this.stopCountdown();
			};
			wrapper.append(lbl, button);
			return wrapper;
		};
		panel.append(
			createTextArea("Folder IDs (comma-separated)", this.settings.folderIds, "folderIds"),
			createNumberInput("Διάστημα (λεπτά)", this.settings.intervalMinutes, "intervalMinutes"),
			createToggleButton("Αντίστροφη μέτρηση κάτω δεξιά", this.settings.showCountdown, "showCountdown")
		);
        const updateButton = document.createElement("button");
        updateButton.textContent = "Έλεγχος για νέα έκδοση";
        updateButton.style.padding = "12px 24px";
        updateButton.style.marginTop = "16px";
        updateButton.style.background = "#1e1e2f";
        updateButton.style.color = "#ffffff";
        updateButton.style.border = "1px solid #444";
        updateButton.style.borderRadius = "8px";
        updateButton.style.fontSize = "14px";
        updateButton.style.fontWeight = "600";
        updateButton.style.transition = "all 0.2s ease-in-out";
        updateButton.style.boxShadow = "0 4px 14px rgba(0, 0, 0, 0.5)";
        updateButton.style.cursor = "pointer";
        updateButton.onmouseenter = () => updateButton.style.background = "#2a2a3d";
        updateButton.onmouseleave = () => updateButton.style.background = "#1e1e2f";
        updateButton.onclick = () => this.checkForUpdate();
        panel.append(updateButton);
        return panel;
	}
	log(...args) {
		console.log("[AutoReadTrash]", ...args);
	}
	checkForUpdate() {
		const updateUrl = "https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/autoreadtrash.plugin.js?t=" + Date.now();
		const currentVersion = this.getVersion();
		fetch(updateUrl)
			.then(res => res.text())
			.then(code => {
				const remoteVersion = code.match(/@version\s+([^\n]+)/)?.[1].trim();
				if (!remoteVersion) {
					this.showCustomToast("⚠️ Δεν βρέθηκε απομακρυσμένη έκδοση.", "error");
					return;
				}
				if (this.isNewerVersion(remoteVersion, currentVersion)) {
				if (this._justUpdated) {
					this._justUpdated = false;
					this.showCustomToast("✅ Είσαι ήδη ενημερωμένος!", "success");
					return;
				}
					this.promptUpdate(updateUrl, remoteVersion);
				} else {
					this.showCustomToast("🔍 Έχεις ήδη την τελευταία έκδοση (" + currentVersion + ")", "info");
				}
			})
			.catch(err => {
				console.error("Update check failed:", err);
				BdApi.showToast("❌ Σφάλμα σύνδεσης για έλεγχο ενημέρωσης.", { type: "error" });
			});
};
isNewerVersion(remote, local) {
		const r = remote.split(".").map(n => parseInt(n));
		const l = local.split(".").map(n => parseInt(n));
		for (let i = 0; i < Math.max(r.length, l.length); i++) {
			if ((r[i] || 0) > (l[i] || 0)) return true;
			if ((r[i] || 0) < (l[i] || 0)) return false;
		}
		return false;
	}
	promptUpdate(url, newVersion) {
    const modal = document.createElement("div");
    modal.style = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;

    const box = document.createElement("div");
    box.style = `
      background: #181818;
      border: 1px solid #2a2a2a;
      border-radius: 12px;
      padding: 30px 32px;
      min-width: 420px;
      max-width: 90vw;
      color: #e0e0e0;
      box-shadow: 0 8px 30px rgba(0,0,0,0.7);
      font-family: Segoe UI, sans-serif;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 20px;
    `;

    const title = document.createElement("h2");
    title.textContent = "✨ Νέα Έκδοση Διαθέσιμη";
    title.style = "margin: 0; font-size: 22px; color: #ffffff;";

    const desc = document.createElement("p");
    desc.textContent = `Η έκδοση \${newVersion} είναι έτοιμη για εγκατάσταση. Θέλεις να προχωρήσεις;`;
    desc.style = "margin: 0; font-size: 14px; color: #bbbbbb;";

    const buttons = document.createElement("div");
    buttons.style = `
      display: flex;
      justify-content: center;
      gap: 16px;
      margin-top: 10px;
    `;

    const cancel = document.createElement("button");
    cancel.textContent = "Όχι τώρα";
    cancel.style = `
      padding: 10px 20px;
      border-radius: 8px;
      border: 1px solid #444;
      background: #121214;
      color: #eee;
      font-weight: 500;
      cursor: pointer;
    `;
    cancel.onclick = () => document.body.removeChild(modal);

    const confirm = document.createElement("button");
    confirm.textContent = "Ενημέρωση";
    confirm.style = `
      padding: 10px 20px;
      border-radius: 8px;
      border: 1px solid #1A1A1E;
      background: #1A1A1E;
      color: #ffffff;
      font-weight: 600;
      cursor: pointer;
    `;
    confirm.onclick = () => {
      document.body.removeChild(modal);
      if (this._updateInProgress) return;
      this._updateInProgress = true;
      this.downloadUpdate(url);
    };

    buttons.append(cancel, confirm);
    box.append(title, desc, buttons);
    modal.appendChild(box);
    document.body.appendChild(modal);
}
	downloadUpdate(url) {
		fetch(url)
			.then(res => res.text())
			.then(content => {
				try {
					const fs = require("fs");
					const path = require("path");
					const filePath = path.join(BdApi.Plugins.folder, "autoreadtrash.plugin.js");
					fs.writeFileSync(filePath, content, "utf8");
					this.showCustomToast("✅ Ενημερώθηκε! Γίνεται αυτόματη επανεκκίνηση...", "success");
this._justUpdated = true;
setTimeout(() => BdApi.Plugins.reload("AutoReadTrash"), 1000);

// Προσπάθησε να απενεργοποιήσεις το κουμπί ενημέρωσης
try {
    const btns = document.querySelectorAll("button");
    for (const btn of btns) {
        if (btn.textContent.includes("Έλεγχος για νέα έκδοση")) {
            btn.disabled = true;
            btn.style.cursor = "not-allowed";
            btn.textContent = "Ενημερώθηκε!";
        }
    }

    // Κλείσε το modal των settings για να γίνει force reload
    const ModalStack = BdApi.findModuleByProps("push", "pop", "popWithKey");
    ModalStack?.pop();
} catch (e) {
    console.warn("❌ ModalStack pop failed:", e);
}

				} catch (err) {
					console.error("Update failed:", err);
					this.showCustomToast("❌ Αποτυχία ενημέρωσης.", "error");
				}
			})
			.catch(() => {
				this.showCustomToast("❌ Αποτυχία σύνδεσης για ενημέρωση.", "error");
			});
	}
	getVersion() {
		return "5.6.4";
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