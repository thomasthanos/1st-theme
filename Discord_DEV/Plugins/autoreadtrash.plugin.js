/**
 * @name AutoReadTrash
 * @version 5.3.1
 * @author ThomasT
 * @description Μαρκάρει φακέλους ως αναγνωσμένους με βάση τα ID τους, με το παλιό δεξί κλικ + click, responsive UI, Material-style settings και έλεγχο τιμών.
 * @note This version centers the settings panel background and enhances its UI to match notifications.
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
	}

	start() {
		this.settings = Object.assign({}, this.defaultSettings, BdApi.loadData("AutoReadTrash", "settings") || {});
		this._lastRun = Date.now();
		this.injectStyles();
		this.log("✅ Ξεκίνησε με settings:", this.settings);
		this.debounceStartInterval();
		this.startCountdown();
	}

	stop() {
		this.clearInterval();
		this.clearStartTimeout();
		this.stopCountdown();
		this.clearNotifications();
		this._isRunning = false;
		this.log("🛑 Σταμάτησε");
	}

	debounceStartInterval() {
		this.clearStartTimeout();
		this._startTimeout = setTimeout(() => {
			this.startInterval();
		}, 500);
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
			this.run();
		}
		this.interval = setInterval(() => {
			if (!this._isRunning) {
				this.run();
			}
		}, this.settings.intervalMinutes * 60 * 1000);
	}

	clearInterval() {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}

	async run() {
		if (this._isRunning) {
			this.log("⏳ Ήδη εκτελείται, παραλείπεται...");
			return;
		}
		this._isRunning = true;

		try {
			const ids = this.settings.folderIds.split(",").map(id => id.trim()).filter(Boolean);
			const items = ids.map(id => document.querySelector(`[data-list-item-id="${id}"]`)).filter(Boolean);

			if (!items.length) {
				this.log("❌ Δεν βρέθηκαν φάκελοι:", ids);
				this.queueNotification("Κανένας φάκελος δεν καθαρίστηκε");
				return;
			}

			this.log(`🔍 Βρέθηκαν ${items.length} φάκελοι για έλεγχο`);

			let successfulReads = 0;

			for (const [index, folder] of items.entries()) {
				const id = folder.getAttribute("data-list-item-id");
				this.log(`📂 Επεξεργασία φακέλου: ${id}`);

				await new Promise(resolve => {
					const existingMenu = document.querySelector('[class*="contextMenu"]');
					if (existingMenu) {
						existingMenu.style.display = "none";
						this.log(`🧹 Κλείσιμο προηγούμενου context menu`);
					}

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
								const isDisabled = btn.getAttribute("aria-disabled") === "true";
								this.log(`🔘 Κατάσταση κουμπιού για ${id}: aria-disabled=${isDisabled}`);
								if (isDisabled) {
									this.log(`🚫 Ο φάκελος ${id} δεν έχει κάτι για ανάγνωση (κουμπί απενεργοποιημένο)`);
								} else {
									btn.click();
									successfulReads++;
									this.log(`📬 Φάκελος ${id} μαρκαρίστηκε ως αναγνωσμένος`);
								}
							} else {
								this.log(`⚠️ Δεν βρέθηκε κουμπί για φάκελο: ${id}`);
							}

							const menu = document.querySelector('[class*="contextMenu"]');
							if (menu) {
								menu.style.display = "none";
							}

							resolve();
						}, 250);
					}, index * 500);
				});
			}

			const message = successfulReads === 0
				? "Κανένας φάκελος δεν καθαρίστηκε"
				: `Καθαρίστηκαν ${successfulReads} ${successfulReads === 1 ? "φάκελος" : "φάκελοι"}`;
			this.queueNotification(message);
			this.log(`📊 Αποτέλεσμα: ${message}`);

			this._lastRun = Date.now();
			this.updateCountdownUI?.();
		} finally {
			this._isRunning = false;
		}
	}

	queueNotification(message) {
		if (this._notificationQueue.length < 3) {
			this._notificationQueue.push(message);
		}
		if (!this._isShowingNotification) {
			this.processNotificationQueue();
		}
	}

	processNotificationQueue() {
		if (!this._notificationQueue.length || this._isShowingNotification) return;

		this._isShowingNotification = true;
		const message = this._notificationQueue.shift();
		this.showDiscordNotification(message);
	}

	clearNotifications() {
		this._notificationQueue = [];
		this._isShowingNotification = false;
		if (this.wrapper3d) {
			this.wrapper3d.innerHTML = '';
		}
	}

	showDiscordNotification(message) {
		if (!this.wrapper3d) {
			this.wrapper3d = document.createElement('div');
			this.wrapper3d.className = 'art-wrapper';
			document.body.appendChild(this.wrapper3d);
		}

		const notif = document.createElement('div');
		notif.className = 'art-notif';
		notif.innerHTML = `
			<svg class="art-notif-icon" viewBox="0 0 24 24">
				<path d="M9 16.17L4.83 12l-1.42 1.41L9 19l12-12-1.41-1.41z"/>
			</svg>
			<div class="art-notif-message">${message}</div>
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
	}

	injectStyles() {
		if (this._style3d) return;
		const style = document.createElement('style');
		style.textContent = `
			.art-wrapper {
				position: fixed;
				bottom: 20px;
				right: 35px;
				display: flex;
				flex-direction: column-reverse;
				gap: 12px;
				z-index: 9999;
				perspective: 800px;
			}
			.art-notif {
				display: flex;
				align-items: center;
				gap: 10px;
				padding: 12px 16px;
				max-width: 300px;
				background: linear-gradient(145deg, #2f3136, #36393f);
				color: #ffffff;
				border-radius: 12px;
				border: 1px solid rgba(255, 255, 255, 0.1);
				box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2);
				transform-style: preserve-3d;
				transform: translateY(20px) rotateX(10deg) scale(0.95);
				opacity: 0;
				transition: transform 0.3s ease, opacity 0.3s ease, box-shadow 0.3s ease;
				cursor: pointer;
				font-family: 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif;
			}
			.art-notif.show {
				opacity: 1;
				transform: translateY(0) rotateX(0deg) scale(1);
				box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4), 0 4px 8px rgba(0, 0, 0, 0.3);
			}
			.art-notif.hide {
				opacity: 0;
				transform: translateY(20px) rotateX(10deg) scale(0.95);
			}
			.art-notif:hover {
				transform: translateY(-2px) rotateX(0deg) scale(1.02);
				box-shadow: 0 10px 20px rgba(0, 0, 0, 0.5), 0 6px 12px rgba(0, 0, 0, 0.4);
				background: linear-gradient(145deg, #36393f, #40444b);
			}
			.art-notif-icon {
				width: 20px;
				height: 20px;
				fill: #43b581;
				flex-shrink: 0;
			}
			.art-notif-message {
				font-size: 14px;
				line-height: 1.4;
				color: #dcddde;
			}
			.art-countdown {
				position: fixed;
				bottom: 80px;
				right: 64px;
				background: linear-gradient(145deg, #2f3136, #36393f);
				color: #dcddde;
				padding: 8px 14px;
				border-radius: 10px;
				border: 1px solid rgba(255, 255, 255, 0.1);
				font-size: 13px;
				font-family: 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif;
				box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
				z-index: 9999;
				opacity: 0.9;
				transition: transform 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease;
			}
			.art-countdown:hover {
				transform: translateY(-2px);
				box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
				opacity: 1;
			}
		`;
		document.head.appendChild(style);
		this._style3d = style;
	}

	startCountdown() {
		this.stopCountdown();
		if (!this.settings.showCountdown) return;
		this.createCountdownUI();
		this.countdownInterval = setInterval(() => this.updateCountdownUI(), 1000);
		this.updateCountdownUI();
	}

	stopCountdown() {
		if (this.countdownInterval) {
			clearInterval(this.countdownInterval);
			this.countdownInterval = null;
		}
		const el = document.querySelector('.art-countdown');
		if (el) el.remove();
	}

	createCountdownUI() {
		if (document.querySelector('.art-countdown')) return;
		const el = document.createElement('div');
		el.className = 'art-countdown';
		document.body.appendChild(el);
	}

	updateCountdownUI() {
		const el = document.querySelector('.art-countdown');
		if (!el) return;
		const now = Date.now();
		const next = (this._lastRun || now) + this.settings.intervalMinutes * 60 * 1000;
		const diff = Math.max(0, Math.floor((next - now) / 1000));
		const mins = Math.floor(diff / 60);
		const secs = diff % 60;
		el.textContent = `Next clear → ${mins}λ ${secs}δ`;
	}

	getSettingsPanel() {
		const panel = document.createElement("div");
		panel.className = "art-container bd-addon-settings-wrap";
		panel.style = `
			display: flex;
			flex-direction: column;
			gap: 20px;
			max-width: 600px;
			width: 100%;
			margin: 0 auto;
			padding: 24px;
			background: linear-gradient(145deg, #2f3136, #36393f);
			border-radius: 12px;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
			color: #dcddde;
			font-family: 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif;
			box-sizing: border-box;
		`;

		const header = document.createElement("div");
		header.className = "art-header";
		header.textContent = "AutoReadTrash Settings";
		header.style = `
			font-size: 18px;
			font-weight: 600;
			color: #ffffff;
			border-bottom: 1px solid rgba(255, 255, 255, 0.1);
			padding-bottom: 10px;
			margin-bottom: 10px;
		`;
		panel.appendChild(header);

		const style = document.createElement("style");
		style.textContent = `
			.art-label {
				font-weight: 600;
				font-size: 14px;
				color: #b9bbbe;
				margin-bottom: 6px;
				text-transform: uppercase;
				letter-spacing: 0.5px;
			}
			.art-input, .art-textarea {
				width: 100%;
				padding: 12px 16px;
				border-radius: 8px;
				background: linear-gradient(145deg, #1e2124, #232529);
				color: #dcddde;
				border: 1px solid rgba(255, 255, 255, 0.1);
				box-sizing: border-box;
				font-size: 14px;
				font-family: 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif;
				transition: border 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease;
			}
			.art-input:focus, .art-textarea:focus {
				border-color: #5865f2;
				background: linear-gradient(145deg, #232529, #272b2f);
				box-shadow: 0 0 6px rgba(88, 101, 242, 0.4);
				transform: scale(1.01);
				outline: none;
			}
			.art-textarea {
				min-height: 60px;
				resize: vertical;
			}
			.art-toggle {
				display: flex;
				align-items: center;
				gap: 12px;
			}
			.art-toggle button {
				padding: 8px 18px;
				border: none;
				border-radius: 6px;
				background: linear-gradient(145deg, #5865f2, #4752c4);
				color: #ffffff;
				font-weight: 500;
				font-size: 14px;
				cursor: pointer;
				transition: background 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease;
				box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
			}
			.art-toggle button.off {
				background: linear-gradient(145deg, #4f545c, #3a3f45);
			}
			.art-toggle button:hover {
				background: linear-gradient(145deg, #4752c4, #3841a1);
				box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
				transform: translateY(-2px);
			}
			.art-toggle button.off:hover {
				background: linear-gradient(145deg, #3a3f45, #2e3236);
			}
			.art-toggle button:active {
				transform: translateY(0);
				box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
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
			const lbl = document.createElement("div");
			lbl.className = "art-label";
			lbl.textContent = label;

			const input = document.createElement("input");
			input.className = "art-input";
			input.type = "number";
			input.min = 5;
			input.value = value;
			input.oninput = debounce(() => {
				let raw = input.value.trim();
				let parsed = parseInt(raw);
				if (isNaN(parsed)) parsed = 5;

				let v = Math.max(5, Math.min(parsed, 120));
				if (parsed !== v) {
					if (parsed < 5) {
						BdApi.showToast("Το ελάχιστο επιτρεπτό διάστημα είναι 5 λεπτά", { type: "error" });
					} else if (parsed > 120) {
						BdApi.showToast("Το μέγιστο επιτρεπτό διάστημα είναι 120 λεπτά (2 ώρες)", { type: "error" });
					}
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

		return panel;
	}

	log(...args) {
		console.log("[AutoReadTrash]", ...args);
	}
};