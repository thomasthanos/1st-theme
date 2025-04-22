/**
 * @name AutoReadTrash
 * @version 5.2.2
 * @author ThomasT
 * @description Μαρκάρει φακέλους ως αναγνωσμένους με βάση τα ID τους, με το παλιό δεξί κλικ + click, responsive UI, Material-style settings και έλεγχο τιμών.
 */

module.exports = class AutoReadTrash {
	defaultSettings = {
	  folderIds: "guildsnav___2512556488",
	  intervalMinutes: 15,
	  showCountdown: true
	};
  
	start() {
	  this.settings = Object.assign({}, this.defaultSettings, BdApi.loadData("AutoReadTrash", "settings") || {});
	  this._lastRun = Date.now();
	  this.injectStyles();
	  this.log("✅ Ξεκίνησε με settings:", this.settings);
	  this.startInterval();
	  this.startCountdown();
	}
  
	stop() {
	  this.clearInterval();
	  this.stopCountdown();
	  this.log("🛑 Σταμάτησε");
	}
  
	startInterval() {
	  this.clearInterval();
	  this.run();
	  this.interval = setInterval(() => this.run(), this.settings.intervalMinutes * 60 * 1000);
	}
  
	clearInterval() {
	  if (this.interval) clearInterval(this.interval);
	}
  
	async run() {
	  const ids = this.settings.folderIds.split(",").map(id => id.trim()).filter(Boolean);
  
	  const items = ids.map(id => document.querySelector(`[data-list-item-id="${id}"]`)).filter(Boolean);
  
	  if (!items.length) {
		this.log("❌ Δεν βρέθηκαν φάκελοι:", ids);
		return;
	  }
  
	  for (const [index, folder] of items.entries()) {
		const id = folder.getAttribute("data-list-item-id");
  
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
			  btn.click();
			  //this.log(`📬 Κλικ στο κουμπί για φάκελο: ${id}`);
			} else {
			 // this.log(`⚠️ Δεν βρέθηκε κουμπί για φάκελο: ${id}`);
			}
  
			const menu = document.querySelector('[class*="contextMenu"]');
			if (menu) {
			  menu.style.display = "none";
			}
		  }, 150);
		}, index * 400);
	  }
  
	  this._lastRun = Date.now();
	  this.updateCountdownUI?.();
	  this.showDiscordNotification(`Καθαρίστηκαν ${items.length} φάκελοι!`);
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
		<svg style="width:20px;height:20px;fill:white" viewBox="0 0 24 24">
		  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19l12-12-1.41-1.41z"/>
		</svg>
		<div style="flex:1;font-size:14px;line-height:1.3;">${message}</div>
	  `;
	  this.wrapper3d.appendChild(notif);
	  requestAnimationFrame(() => notif.classList.add('show'));
	  clearTimeout(this._hide3d);
	  this._hide3d = setTimeout(() => {
		notif.classList.remove('show');
		notif.classList.add('hide');
		notif.addEventListener('transitionend', () => notif.remove(), { once: true });
	  }, 3000);
	  notif.addEventListener('mouseenter', () => clearTimeout(this._hide3d));
	  notif.addEventListener('mouseleave', () => {
		this._hide3d = setTimeout(() => {
		  notif.classList.remove('show');
		  notif.classList.add('hide');
		  notif.addEventListener('transitionend', () => notif.remove(), { once: true });
		}, 1000);
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
		  gap: 8px;
		  padding: 10px 14px;
		  max-width: 280px;
		  background: var(--background-secondary);
		  color: var(--text-normal);
		  border-radius: 8px;
		  box-shadow: 0 4px 6px rgba(0,0,0,0.2), 0 8px 20px rgba(0,0,0,0.15);
		  transform-style: preserve-3d;
		  transform: rotateX(0deg) translateZ(0);
		  opacity: 0;
		  transition: transform 0.4s ease, opacity 0.4s ease, box-shadow 0.4s ease;
		  cursor: pointer;
		}
		.art-notif.show {
		  opacity: 1;
		  transform: rotateX(15deg) translateZ(20px);
		  box-shadow: 0 8px 12px rgba(0,0,0,0.3), 0 12px 30px rgba(0,0,0,0.2);
		}
		.art-notif.hide {
		  opacity: 0;
		  transform: rotateX(0deg) translateZ(0);
		}
		.art-countdown {
		  position: fixed;
		  bottom: 80px;
		  right: 40px;
		  background: #202225;
		  color: white;
		  padding: 8px 14px;
		  border-radius: 10px;
		  font-size: 13px;
		  font-family: sans-serif;
		  box-shadow: 0 2px 10px rgba(0,0,0,0.3);
		  z-index: 9999;
		  opacity: 0.85;
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
	  if (this.countdownInterval) clearInterval(this.countdownInterval);
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
	  el.textContent = `Next clear --> ${mins}λ ${secs}δ`;
	}
  
	getSettingsPanel() {
	  const panel = document.createElement("div");
	  panel.className = "art-container bd-addon-settings-wrap";
	  panel.style = `
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 18px;
		max-width: 600px;
		font-size: 15px;
		color: white;
	  `;
  
	  const style = document.createElement("style");
	  style.textContent = `
		.art-label {
		  font-weight: 500;
		  font-size: 14px;
		  color: var(--header-secondary);
		  margin-bottom: 4px;
		}
		.art-input, .art-textarea {
		  width: 100%;
		  padding: 10px 14px;
		  border-radius: 6px;
		  background: #1f1f1f;
		  color: white;
		  border: 1px solid #3a3a3a;
		  box-sizing: border-box;
		  font-size: 14px;
		  transition: border 0.2s, background 0.2s;
		}
		.art-textarea {
		  min-height: 40px;
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
		  background: #5865f2;
		  color: white;
		  font-weight: 500;
		  cursor: pointer;
		  transition: background 0.2s ease, box-shadow 0.2s ease;
		  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
		}
		.art-toggle button.off {
		  background: #4f545c;
		}
		.art-toggle button:hover {
		  background: #4752c4;
		}
		.art-toggle button.off:hover {
		  background: #3a3f45;
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
			this.startInterval();
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
  