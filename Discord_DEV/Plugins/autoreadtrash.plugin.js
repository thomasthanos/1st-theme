/**
 * @name AutoReadTrash
 * @version 4.1.5
 * @author ThomasT (merged)
 * @description Μαρκάρει αυτόματα φακέλους ως αναγνωσμένους κάθε X λεπτά. Μοντέρνο UI, υποστήριξη πολλαπλών φακέλων, χωρίς ορατό context menu.
 * @source https://github.com/thomasthanos/1st-theme/blob/main/Discord_DEV/Plugins/autoreadtrash.plugin.js
 * @updateUrl https://thomasthanos.github.io/1st-theme/Discord_DEV/Plugins/autoreadtrash.plugin.js
 */

module.exports = class AutoReadTrash {
	defaultSettings = {
	  folderName: "σκουπιδαριο",
	  intervalMinutes: 15
	};
  
	start() {
	  this.settings = Object.assign({}, this.defaultSettings, BdApi.loadData("AutoReadTrash", "settings") || {});
	  if (this.settings.hasOwnProperty('intervalSeconds')) {
		this.settings.intervalMinutes = Math.max(1, Math.ceil(this.settings.intervalSeconds / 60));
		delete this.settings.intervalSeconds;
		BdApi.saveData("AutoReadTrash", "settings", this.settings);
	  }
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
	  this.interval = setInterval(() => this.run(), this.settings.intervalMinutes * 60 * 1000);
	}
  
	clearInterval() {
	  if (this.interval) clearInterval(this.interval);
	}
  
	run() {
	  const raw = this.settings.folderName;
	  const str = raw != null ? raw.toString() : "";
	  const names = str.split(",").map(n => n.trim().toLowerCase()).filter(Boolean);
	  this.log("Ψάχνει φακέλους με ονόματα:", names);
  
	  const items = [...document.querySelectorAll('div[role="treeitem"]')].filter(el => {
		const label = el.getAttribute("aria-label")?.toLowerCase();
		return label && names.some(name => label.includes(name));
	  });
  
	  if (!items.length) {
		this.log("❌ Δεν βρέθηκε κανένας φάκελος από τη λίστα:", names);
		return;
	  }
  
	  items.forEach((folder, index) => {
		this.log(`✅ Μαρκάρισμα φακέλου #${index+1}:`, folder.getAttribute("aria-label"));
		// Σταδιακά dispatch και click για να μην σβήνει το μενού πολύ γρήγορα
		setTimeout(() => {
		  const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: -9999, clientY: -9999 });
		  folder.dispatchEvent(event);
		  setTimeout(() => {
			const markRead = document.querySelector('#guild-context-mark-folder-read');
			if (markRead) markRead.click();
			const menu = document.querySelector('[class*="contextMenu"]');
			if (menu) menu.style.display = "none";
		  }, 150);
		}, index * 300);
	  });
	}
  
	getSettingsPanel() {
	  const style = `
		.art-container { padding:24px; max-width:500px; background:#292929; border-radius:12px;
		  box-shadow:0 4px 20px rgba(0,0,0,0.1); display:flex; flex-direction:column; gap:16px;
		  transition:box-shadow 0.3s ease; margin:16px; font-family:var(--font-primary),sans-serif;
		  color:var(--text-normal); font-size:15px; }
		.art-group { display:flex; flex-direction:column; gap:8px; }
		.art-label { font-size:14px; font-weight:500; color:var(--text-muted); }
		.art-input { width:100%; padding:10px 14px; border-radius:8px;
		  border:1px solid var(--background-modifier-accent); background:#1e1e1e;
		  color:var(--text-normal); font-size:14px; box-sizing:border-box;
		  transition:border-color 0.2s ease, box-shadow 0.2s ease; }
		.art-input:focus { border-color:var(--brand-experiment);
		  box-shadow:0 0 0 3px rgba(var(--brand-experiment-rgb),0.1); outline:none; }
		.art-tooltip { font-size:12px; color:var(--text-muted); }
	  `;
  
	  const panel = document.createElement("div");
	  panel.className = "art-container bd-addon-settings-wrap";
	  panel.innerHTML = `<style>${style}</style>`;
	  const debounce = (fn, wait) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), wait); }; };
	  const createInputGroup = (labelText, value, type, tooltip, key) => {
		const wrap = document.createElement("div"); wrap.className="art-group bd-form-divider";
		const lbl = document.createElement("label"); lbl.className="art-label"; lbl.textContent=labelText;
		const inp = document.createElement("input"); inp.type=type; inp.value=value;
		if(key==='intervalMinutes'){inp.min=1;inp.step=1;} inp.className="art-input";
		inp.oninput = debounce(e => {
		  const rawVal = e.target.value; let v = key==='intervalMinutes' ? Math.max(5, parseInt(rawVal)||0) : rawVal;
		  if(key==='intervalMinutes'&&v<5){BdApi.showToast("Το διάστημα πρέπει να είναι τουλάχιστον 5 λεπτά",{type:'error'});e.target.value=v;}
		  this.settings[key]=v; BdApi.saveData("AutoReadTrash","settings",this.settings);
		  this.startInterval();
		}, 500);
		const tip = document.createElement("div"); tip.className="art-tooltip"; tip.textContent=tooltip;
		wrap.append(lbl, inp, tip); return wrap;
	  };
	  panel.append(
		createInputGroup("Ονόματα φακέλων", this.settings.folderName, "text", "Χωρίστε πολλαπλούς φακέλους με κόμμα", "folderName"),
		createInputGroup("Διάστημα (λεπτά)", this.settings.intervalMinutes, "number", "Ελάχιστο 5 λεπτά", "intervalMinutes")
	  );
	  return panel;
	}
  
	log(...args) { console.log("[AutoReadTrash]", ...args); }
  };