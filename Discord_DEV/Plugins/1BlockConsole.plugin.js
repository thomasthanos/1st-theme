/**
 * @name 1BlockConsole
 * @version 1.0.8
 * @description Μαρκάρει φακέλους ως αναγνωσμένους με βάση τα ID τους, με το παλιό δεξί κλικ + click, responsive UI, Material-style settings και έλεγχο τιμών.
 * @author ThomasT
 * @authorId 706932839907852389
 * @source https://github.com/thomasthanos/1st-theme/blob/main/Discord_DEV/Plugins/BlockConsole.plugin.js
 * @updateUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/BlockConsole.plugin.js
 * @downloadUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/BlockConsole.plugin.js
 * @website https://github.com/thomasthanos
 */

class BlockConsole {
  // Ρυθμίσεις για αποθήκευση δεδομένων
  defaultSettings = {
      enabled: true // Παράδειγμα ρύθμισης, μπορείς να προσθέσεις περισσότερες
  };

  // Κατασκευαστής για αποθήκευση ρυθμίσεων
  constructor() {
      this.settings = Object.assign({}, this.defaultSettings, BdApi.loadData("BlockConsole", "settings") || {});
      this._justUpdated = false;
      this._updateInProgress = false;
      this._orig = {};
      this._prefixes = [
          "[FAST CONNECT]",
          "[default]",
          "[KeyboardLayoutMapUtils]",
          "[Spellchecker]",
          "[libdiscore]",
          "[BetterDiscord]",
          "[RPCServer:WSS]",
          "[GatewaySocket]",
          "[MessageActionCreators]",
          "[ChannelMessages]",
          "[Spotify]",
          "[OverlayStoreV3]",
          "[RPCServer:IPC]",
          "[BDFDB]",
          "[PinDMs]",
          "[ReadAllNotificationsButton]",
          "[StaffTag]",
          "[OverlayBridgeStore]",
          "[RunningGameStore]",
          "[ReadStateStore]",
          "[RTCControlSocket(stream)]",
          "[RTCControlSocket(default)]",
          "[DirectVideo]",
          "[HDStreamingConsumableModal]",
          "[ConnectionEventFramerateReducer]",
          "[OverlayRenderStore]",
          "[discord_protos.discord_users.v1.FrecencyUserSetting]",
          "[Routing/Utils]"
      ];
      this._methods = ["log", "info", "warn", "error", "debug"];
  }

  start() {
      if (!this.settings.enabled) return; // Ελέγχει αν το plugin είναι ενεργοποιημένο
      if (typeof console.clear === "function") console.clear();
      this._methods.forEach(method => {
          this._orig[method] = console[method].bind(console);
          console[method] = (...args) => {
              // Μπλοκάρει αν οποιοδήποτε arg περιέχει ένα απ' τα prefixes
              const blocked = args.some(arg =>
                  typeof arg === "string" &&
                  this._prefixes.some(pref => arg.includes(pref))
              );
              if (blocked) return;
              this._orig[method](...args);
          };
      });
  }

  stop() {
      this._methods.forEach(method => {
          if (this._orig[method]) console[method] = this._orig[method];
      });
      this._orig = {};
  }

  /* -------------------- SETTINGS PANEL -------------------- */
  getSettingsPanel() {
      const panel = document.createElement("div");
      panel.className = "blockconsole-container bd-addon-settings-wrap";
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
          .blockconsole-label {
              font-weight: 500;
              font-size: 14px;
              color: #b0bec5;
              margin-bottom: 8px;
              text-transform: uppercase;
              letter-spacing: 0.8px;
              text-align: center;
              transition: color 0.2s ease;
          }
          .blockconsole-input, .blockconsole-textarea {
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
          .blockconsole-input:focus, .blockconsole-textarea:focus {
              background: linear-gradient(145deg, #202023, #252528);
              box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4), 0 0 8px rgba(33, 150, 243, 0.5);
              outline: none;
          }
          .blockconsole-textarea {
              min-height: 48px;
              resize: vertical;
              -ms-overflow-style: none;
              scrollbar-width: none;
          }
          .blockconsole-textarea::-webkit-scrollbar {
              display: none;
          }
          .blockconsole-toggle {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 12px;
          }
          .blockconsole-toggle button {
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
          .blockconsole-toggle button.off {
              background: linear-gradient(145deg, #455a64, #37474f);
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          }
          .blockconsole-toggle button:hover {
              background: linear-gradient(145deg, #01579b, #0277bd);
              box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5), 0 3px 6px rgba(0, 0, 0, 0.4);
              transform: translateY(-2px);
          }
          .blockconsole-toggle button.off:hover {
              background: linear-gradient(145deg, #546e7a, #455a64);
          }
          .blockconsole-toggle button:active {
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

      // Toggle button για ενεργοποίηση/απενεργοποίηση του plugin
      const createToggleButton = (label, value, key) => {
          const wrapper = document.createElement("div");
          wrapper.className = "blockconsole-toggle";
          const lbl = document.createElement("div");
          lbl.className = "blockconsole-label";
          lbl.textContent = label;
          const button = document.createElement("button");
          button.textContent = value ? "Ενεργό" : "Ανενεργό";
          button.className = value ? "" : "off";
          button.onclick = () => {
              const newVal = !this.settings[key];
              this.settings[key] = newVal;
              BdApi.saveData("BlockConsole", "settings", this.settings);
              button.textContent = newVal ? "Ενεργό" : "Ανενεργό";
              button.className = newVal ? "" : "off";
              if (newVal) {
                  this.start();
              } else {
                  this.stop();
              }
          };
          wrapper.append(lbl, button);
          return wrapper;
      };

      // Κουμπί ενημέρωσης
      const updateButton = document.createElement("button");
      updateButton.textContent = "Έλεγχος για νέα έκδοση";
      updateButton.style.padding = "12px 24px";
      updateButton.style.marginTop = "16px";
      updateButton.style.background = "#181818";
      updateButton.style.color = "#ffffff";
      updateButton.style.border = "1px solid #444";
      updateButton.style.borderRadius = "8px";
      updateButton.style.fontSize = "14px";
      updateButton.style.fontWeight = "600";
      updateButton.style.transition = "all 0.2s ease-in-out";
      updateButton.style.boxShadow = "0 4px 14px rgba(0, 0, 0, 0.5)";
      updateButton.style.cursor = "pointer";
      updateButton.onmouseenter = () => updateButton.style.background = "#181818";
      updateButton.onmouseleave = () => updateButton.style.background = "#141414";
      updateButton.onclick = () => this.checkForUpdate();

      panel.append(
          createToggleButton("Ενεργοποίηση Plugin", this.settings.enabled, "enabled"),
          updateButton
      );

      return panel;
  }

  /* -------------------- UPDATE FUNCTIONALITY -------------------- */
  checkForUpdate() {
      const updateUrl = "https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/BlockConsole.plugin.js?t=" + Date.now();
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
      desc.textContent = `Η έκδοση ${newVersion} είναι έτοιμη για εγκατάσταση. Θέλεις να προχωρήσεις;`;
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
      cancel.style = `padding: 10px 20px; border-radius: 8px; border: 1px solid #888; background: #1e1e1e; color: #ddd; font-weight: 500; cursor: pointer; transition: all 0.2s ease-in-out;`;
      cancel.onclick = () => document.body.removeChild(modal);

      const confirm = document.createElement("button");
      confirm.textContent = "Ενημέρωση";
      confirm.style = `padding: 10px 20px; border-radius: 8px; border: 1px solid #2e7d32; background: linear-gradient(145deg, #2e7d32, #1b5e20); color: #e0f2f1; font-weight: 600; cursor: pointer; transition: all 0.2s ease-in-out; box-shadow: 0 6px 14px rgba(0, 0, 0, 0.6), 0 3px 6px rgba(0, 0, 0, 0.4);`;
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
                  const filePath = path.join(BdApi.Plugins.folder, "BlockConsole.plugin.js");
                  fs.writeFileSync(filePath, content, "utf8");
                  this._justUpdated = true;
                  setTimeout(() => BdApi.Plugins.reload("BlockConsole"), 1000);

                  // Απενεργοποίηση κουμπιού ενημέρωσης
                  try {
                      const btns = document.querySelectorAll("button");
                      for (const btn of btns) {
                          if (btn.textContent.includes("Έλεγχος για νέα έκδοση")) {
                              btn.disabled = true;
                              btn.style.cursor = "not-allowed";
                              btn.textContent = "Ενημερώθηκε!";
                          }
                      }
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
      return "1.3.0";
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
}

module.exports = BlockConsole;