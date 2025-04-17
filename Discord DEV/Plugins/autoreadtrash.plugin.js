/**
 * @name AutoReadTrash
 * @version 4.0.0
 * @author ThomasT
 * @description Μαρκάρει αυτόματα φακέλους ως αναγνωσμένους κάθε Χ δευτερόλεπτα. Μοντέρνο UI, υποστήριξη πολλαπλών φακέλων, χωρίς ορατό context menu.
 * @source https://github.com/thomasthanos/1st-theme
 * @updateUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/refs/heads/main/Discord%20DEV/Plugins/autoreadtrash.plugin.js
 */

module.exports = class AutoReadTrash {
	defaultSettings = {
		folderName: "σκουπιδαριο",
		intervalSeconds: 60
	};

	start() {
		this.settings = Object.assign({}, this.defaultSettings, BdApi.loadData("AutoReadTrash", "settings") || {});
		this.log("✅ Ξεκίνησε με settings:", this.settings);
		this.startInterval();
	}

	stop() {
		this.clearInterval();
		this.log("🛑 Σταμάτησε");
	}

	startInterval() {
		this.clearInterval();
		this.run();
		this.interval = setInterval(() => this.run(), this.settings.intervalSeconds * 1000);
	}

	clearInterval() {
		if (this.interval) clearInterval(this.interval);
	}

	run() {
		const names = this.settings.folderName
			.split(",")
			.map(n => n.trim().toLowerCase())
			.filter(Boolean);

		this.log("Ψάχνει φακέλους:", names);

		const folder = [...document.querySelectorAll('div[role="treeitem"]')].find(el => {
			const label = el.getAttribute("aria-label")?.toLowerCase();
			if (!label) return false;

			const folderNameInLabel = label.split(",")[0].trim();
			this.log("Comparing folder name in label:", folderNameInLabel, "with target names:", names);

			return names.some(name => folderNameInLabel === name);
		});

		if (!folder) {
			this.log("❌ Δεν βρέθηκε φάκελος από τη λίστα:", names);
			return;
		}

		this.log("Βρέθηκε φάκελος:", folder.getAttribute("aria-label"));

		const event = new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
			clientX: -9999,
			clientY: -9999
		});
		folder.dispatchEvent(event);

		setTimeout(() => {
			const markRead = document.querySelector('#guild-context-mark-folder-read');
			if (markRead) {
				markRead.click();
				this.log("✅ Ο φάκελος μαρκαρίστηκε ως αναγνωσμένος");
			}
			const menu = document.querySelector('[class*="contextMenu"]');
			if (menu) menu.style.display = "none";
		}, 150);
	}

	getSettingsPanel() {
		const style = `
			.art-container {
				padding: 24px;
				max-width: 500px;
				background: var(--background-primary);
				border-radius: 12px;
				box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
				display: flex;
				flex-direction: column;
				gap: 24px;
				transition: box-shadow 0.3s ease;
				margin: 0 auto;
			}
			.art-container:hover {
				box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
			}
			.art-header {
				font-size: 20px;
				font-weight: 500;
				color: var(--header-primary);
				text-align: left;
				letter-spacing: 0.2px;
				margin: 0 16px;
			}
			.art-group {
				display: flex;
				flex-direction: column;
				gap: 8px;
				margin: 0 16px;
			}
			.art-label {
				font-size: 14px;
				font-weight: 500;
				color: var(--header-secondary);
				margin-bottom: 4px;
			}
			.art-input {
				width: 100%;
				padding: 12px 16px;
				border-radius: 8px;
				border: 1px solid var(--background-modifier-accent);
				background: var(--background-secondary);
				color: var(--text-normal);
				font-size: 14px;
				box-sizing: border-box;
				transition: border-color 0.2s ease, box-shadow 0.2s ease;
			}
			.art-input:focus {
				border-color: var(--brand-experiment);
				box-shadow: 0 0 0 3px rgba(var(--brand-experiment-rgb), 0.1);
				outline: none;
			}
			.art-tooltip {
				font-size: 12px;
				color: var(--text-muted);
			}
			.art-button-wrapper {
				display: flex;
				justify-content: flex-end;
				margin: 16px 16px 0 16px;
			}
			.art-button {
				position: relative;
				padding: 12px 24px;
				background: #0288d1;
				color: #ffffff;
				border-radius: 8px;
				border: none;
				font-size: 14px;
				font-weight: 500;
				cursor: pointer;
				transition: background 0.2s ease, transform 0.1s ease;
				overflow: hidden;
			}
			.art-button:hover {
				background: #01579b;
				transform: translateY(-1px);
			}
			.art-button:active {
				transform: translateY(0);
			}
			.art-button::after {
				content: '';
				position: absolute;
				top: 50%;
				left: 50%;
				width: 0;
				height: 0;
				background: rgba(255, 255, 255, 0.3);
				border-radius: 50%;
				transform: translate(-50%, -50%);
				transition: width 0.3s ease, height 0.3s ease;
			}
			.art-button:hover::after {
				width: 200px;
				height: 200px;
			}
		`;

		const panel = document.createElement("div");
		panel.className = "art-container bd-addon-settings-wrap";
		panel.innerHTML = `
			<style>${style}</style>
			<h1 class="art-header">AutoReadTrash Ρυθμίσεις</h1>
		`;

		const debounce = (func, wait) => {
			let timeout;
			return (...args) => {
				clearTimeout(timeout);
				timeout = setTimeout(() => func.apply(this, args), wait);
			};
		};
		
		const createInputGroup = (labelText, value, type, tooltip, settingKey, onChange) => {
			const wrapper = document.createElement("div");
			wrapper.className = "art-group bd-form-divider";
		
			const label = document.createElement("label");
			label.className = "art-label";
			label.textContent = labelText;
		
			const input = document.createElement("input");
			input.type = type;
			input.value = value;
			input.className = "art-input";
			input.oninput = debounce((e) => {
				const newValue = e.target.value;
				this.settings[settingKey] = newValue;
				BdApi.saveData("AutoReadTrash", "settings", this.settings);
				this.log(`Updated ${settingKey}:`, newValue);
				this.startInterval();
			}, 1000); // 1 δευτερόλεπτο καθυστέρηση
		
			const tooltipEl = document.createElement("div");
			tooltipEl.className = "art-tooltip";
			tooltipEl.textContent = tooltip;
		
			wrapper.append(label, input, tooltipEl);
			return wrapper;
		};

		const folderInput = createInputGroup(
			"Ονόματα φακέλων",
			this.settings.folderName,
			"text",
			"Χωρίστε πολλαπλούς φακέλους με κόμμα (π.χ. σκουπιδαριο, spam)",
			"folderName",
			(val) => {
				this.settings.folderName = val;
			}
		);

		const intervalInput = createInputGroup(
			"Διάστημα (δευτερόλεπτα)",
			this.settings.intervalSeconds,
			"number",
			"Ελάχιστο 10 δευτερόλεπτα",
			"intervalSeconds",
			(val) => {
				const v = Math.max(10, parseInt(val));
				this.settings.intervalSeconds = isNaN(v) ? 60 : v;
			}
		);

		const buttonWrapper = document.createElement("div");
		buttonWrapper.className = "art-button-wrapper";

		const saveButton = document.createElement("button");
		saveButton.className = "art-button";
		saveButton.textContent = "Αποθήκευση";
		saveButton.onclick = () => {
			BdApi.saveData("AutoReadTrash", "settings", this.settings);
			this.startInterval();
			BdApi.UI.showToast("Οι ρυθμίσεις αποθηκεύτηκαν!", { type: "success" });
		};

		buttonWrapper.append(saveButton);
		panel.append(folderInput, intervalInput, buttonWrapper);
		return panel;
	}

	log(...args) {
		console.log("[AutoReadTrash]", ...args);
	}
};