/**
 * @name BlockConsole
 * @version 1.3.0
 * @description Κρύβει όλα τα console μηνύματα που περιέχουν συγκεκριμένα prefixes.
 * @author —
 * @license MIT
 */
class BlockConsole {
    constructor() {
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
        // **Νέα που ζητήθηκαν**
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
        "[ReadStateStore]"
      ];
      this._methods = ["log", "info", "warn", "error", "debug"];
    }
  
    start() {
      if (typeof console.clear === "function") console.clear();
      this._methods.forEach(method => {
        this._orig[method] = console[method].bind(console);
        console[method] = (...args) => {
          // μπλοκάρει αν οποιοδήποτε arg περιέχει ένα απ' τα prefixes
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
  }
  
  module.exports = BlockConsole;
  