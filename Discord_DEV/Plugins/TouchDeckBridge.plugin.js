/**
 * @name TouchDeckBridge
 * @author Touch Deck
 * @version 3.0.0
 * @description Tells the Touch Deck who is sharing a screen or on camera in your current voice channel, and streams a live preview of a screen share to the deck while the deck asks for one. Discord's local RPC does not expose Go Live, which is why this exists.
 * @source https://github.com/thomasthanos/touch-screen-app
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(process.env.APPDATA || '', 'TouchDeck');
const OUTPUT_FILE = path.join(ROOT, 'voice-bridge.json');
const REQUEST_FILE = path.join(ROOT, 'preview-request.json');
const PREVIEW_DIRECTORY = path.join(ROOT, 'previews');
const DIAGNOSTICS_FILE = path.join(ROOT, 'bridge-diagnostics.json');
const HEARTBEAT_MS = 30000;
const SETTLE_MS = 200;
const SCAN_MS = 1500;
const REQUEST_POLL_MS = 200;
const FRAME_INTERVAL_MS = 100;
const FRAME_WIDTH = 640;
const FRAME_QUALITY = 0.7;
const THUMBNAIL_REFRESH_MS = 120000;
const SNOWFLAKE = /^[0-9]{17,20}$/;

module.exports = class TouchDeckBridge {
  start() {
    this.voiceStates = this.findStore('VoiceStateStore', (m) => typeof m?.getVoiceStatesForChannel === 'function');
    this.selectedChannel = this.findStore('SelectedChannelStore', (m) => typeof m?.getVoiceChannelId === 'function');
    this.channels = this.findStore('ChannelStore', (m) => typeof m?.getChannel === 'function' && typeof m?.getDMFromUserId === 'function');
    this.streams = this.findStore('ApplicationStreamingStore', (m) => typeof m?.getAllApplicationStreams === 'function');
    this.previewStore = this.findStore('ApplicationStreamPreviewStore', (m) => typeof m?.getPreviewURL === 'function');
    this.fetchPreview = this.findPreviewFetcher();

    this.lastSignature = '';
    this.lastWrite = 0;
    this.thumbnails = new Map();
    this.watching = [];
    this.request = { userId: '', until: 0, stamp: '' };
    this.pumping = false;
    this.canvas = document.createElement('canvas');

    this.onChange = () => this.schedule();
    for (const store of [this.voiceStates, this.selectedChannel, this.streams, this.previewStore]) {
      store?.addChangeListener?.(this.onChange);
    }
    this.heartbeat = setInterval(() => this.publish(true), HEARTBEAT_MS);
    this.scanTimer = setInterval(() => this.scanVideos(), SCAN_MS);
    this.requestTimer = setInterval(() => this.checkRequest(), REQUEST_POLL_MS);
    this.scanVideos();
    this.publish(true);

    this.diagnosticsTimer = setTimeout(() => this.writeDiagnostics(), 4000);

    if (!this.voiceStates || !this.selectedChannel) {
      BdApi?.UI?.showToast?.('TouchDeckBridge could not reach Discord’s voice stores', { type: 'error' });
    }
  }

  stop() {
    clearInterval(this.heartbeat);
    clearInterval(this.scanTimer);
    clearInterval(this.requestTimer);
    clearTimeout(this.settleTimer);
    clearTimeout(this.pumpTimer);
    clearTimeout(this.diagnosticsTimer);
    this.pumping = false;
    for (const store of [this.voiceStates, this.selectedChannel, this.streams, this.previewStore]) {
      store?.removeChangeListener?.(this.onChange);
    }
    this.removeFrames(() => true);
    this.write({ version: 3, updatedAt: Date.now(), channelId: '', guildId: '', streaming: [], video: [], watching: [], previews: {} });
  }

  findStore(name, probe) {
    const webpack = typeof BdApi !== 'undefined' ? BdApi.Webpack : null;
    if (!webpack) return null;
    try {
      const byName = webpack.getStore?.(name);
      if (byName) return byName;
    } catch (_) {}
    try {
      return webpack.getModule?.(probe) || null;
    } catch (_) {
      return null;
    }
  }

  findPreviewFetcher() {
    const webpack = typeof BdApi !== 'undefined' ? BdApi.Webpack : null;
    if (!webpack) return null;
    try {
      const named = webpack.getModule?.((m) => typeof m?.fetchStreamPreview === 'function');
      if (named) return { kind: 'named', call: (guildId, channelId, userId) => named.fetchStreamPreview(guildId, channelId, userId) };
    } catch (_) {}
    try {
      const mangled = webpack.getModule?.(
        (m) => typeof m === 'function' && String(m).includes('STREAM_PREVIEW_FETCH_START'),
        { searchExports: true }
      );
      if (mangled) return { kind: 'mangled', call: (guildId, channelId, userId) => mangled(guildId, channelId, userId), source: String(mangled).slice(0, 400) };
    } catch (_) {}
    return null;
  }

  schedule() {
    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => this.publish(false), SETTLE_MS);
  }

  collect() {
    const channelId = this.selectedChannel?.getVoiceChannelId?.() || '';
    const channel = channelId ? this.channels?.getChannel?.(channelId) : null;
    const guildId = channel?.guild_id || channel?.getGuildId?.() || '';
    const streaming = new Set();
    const video = new Set();

    if (channelId) {
      const states = this.voiceStates?.getVoiceStatesForChannel?.(channelId);
      const entries = states instanceof Map ? Array.from(states.values()) : Object.values(states || {});
      entries.forEach((state) => {
        const userId = state?.userId;
        if (!userId) return;
        if (state.selfStream) streaming.add(userId);
        if (state.selfVideo) video.add(userId);
      });

      try {
        (this.streams?.getAllApplicationStreams?.() || []).forEach((stream) => {
          if (stream?.channelId === channelId && stream?.ownerId) streaming.add(stream.ownerId);
        });
      } catch (_) {}
    }

    return { channelId, guildId, streaming: Array.from(streaming).sort(), video: Array.from(video).sort() };
  }

  thumbnailsFor({ channelId, guildId, streaming }) {
    const now = Date.now();
    const previews = {};
    for (const userId of streaming) {
      const known = this.thumbnails.get(userId) || { url: '', at: 0, askedAt: 0, error: '' };
      let url = '';
      try {
        url = this.previewStore?.getPreviewURL?.(guildId || null, channelId, userId) || '';
      } catch (_) {}
      if (url && url !== known.url) {
        known.url = url;
        known.at = now;
      }
      if (this.fetchPreview && now - known.askedAt > THUMBNAIL_REFRESH_MS && (!known.url || now - known.at > THUMBNAIL_REFRESH_MS)) {
        known.askedAt = now;
        try {
          Promise.resolve(this.fetchPreview.call(guildId || null, channelId, userId))
            .then(() => { known.error = ''; })
            .catch((error) => { known.error = String(error?.message || error); });
        } catch (error) {
          known.error = String(error?.message || error);
        }
      }
      this.thumbnails.set(userId, known);
      previews[userId] = { thumbnail: known.url || '', thumbnailAt: known.at || 0 };
    }
    for (const userId of Array.from(this.thumbnails.keys())) {
      if (!streaming.includes(userId)) this.thumbnails.delete(userId);
    }
    this.removeFrames((userId) => !streaming.includes(userId));
    return previews;
  }

  videoFor(userId) {
    let best = null;
    for (const video of document.querySelectorAll('[data-selenium-video-tile] video')) {
      const tile = video.closest('[data-selenium-video-tile]');
      const tag = tile?.getAttribute('data-selenium-video-tile') || '';
      if (!tag.split(':').includes(userId)) continue;
      if (video.readyState < 2 || !video.videoWidth || video.paused) continue;
      if (!best || video.videoWidth * video.videoHeight > best.videoWidth * best.videoHeight) best = video;
    }
    return best;
  }

  scanVideos() {
    const { streaming } = this.collect();
    const watching = streaming.filter((userId) => Boolean(this.videoFor(userId)));
    if (watching.join(',') !== this.watching.join(',')) {
      this.watching = watching;
      this.schedule();
    }
  }

  checkRequest() {
    let stamp = '';
    try {
      const stats = fs.statSync(REQUEST_FILE);
      stamp = `${stats.mtimeMs}:${stats.size}`;
    } catch (_) {
      this.request = { userId: '', until: 0, stamp: '' };
      return;
    }
    if (stamp !== this.request.stamp) {
      try {
        const payload = JSON.parse(fs.readFileSync(REQUEST_FILE, 'utf8'));
        const userId = typeof payload?.userId === 'string' && SNOWFLAKE.test(payload.userId) ? payload.userId : '';
        const until = Number(payload?.until);
        this.request = { userId, until: Number.isFinite(until) ? until : 0, stamp };
      } catch (_) {
        this.request = { userId: '', until: 0, stamp };
      }
    }
    if (this.requestActive() && !this.pumping) {
      this.pumping = true;
      this.pump();
    }
  }

  requestActive() {
    return Boolean(this.request.userId) && this.request.until > Date.now();
  }

  pump() {
    if (!this.requestActive()) {
      this.pumping = false;
      return;
    }
    const started = performance.now();
    const next = (delay) => {
      this.pumpTimer = setTimeout(() => this.pump(), Math.max(0, delay - (performance.now() - started)));
    };
    const userId = this.request.userId;
    const video = this.videoFor(userId);
    if (!video) return next(500);
    this.captureOne(video, userId).then(() => next(FRAME_INTERVAL_MS));
  }

  captureOne(video, userId) {
    return new Promise((resolve) => {
      try {
        const width = Math.min(FRAME_WIDTH, video.videoWidth);
        const height = Math.round(width * (video.videoHeight / video.videoWidth));
        if (this.canvas.width !== width) this.canvas.width = width;
        if (this.canvas.height !== height) this.canvas.height = height;
        this.canvas.getContext('2d').drawImage(video, 0, 0, width, height);
        this.canvas.toBlob((blob) => {
          if (!blob) return resolve(false);
          blob.arrayBuffer().then((buffer) => {
            fs.mkdirSync(PREVIEW_DIRECTORY, { recursive: true });
            const target = path.join(PREVIEW_DIRECTORY, `${userId}.jpg`);
            const temporary = `${target}.tmp`;
            fs.writeFileSync(temporary, new Uint8Array(buffer));
            fs.renameSync(temporary, target);
            resolve(true);
          }).catch(() => resolve(false));
        }, 'image/jpeg', FRAME_QUALITY);
      } catch (_) {
        resolve(false);
      }
    });
  }

  removeFrames(shouldRemove) {
    let names = [];
    try {
      names = fs.readdirSync(PREVIEW_DIRECTORY);
    } catch (_) {
      return;
    }
    for (const name of names) {
      const userId = name.split('.')[0];
      if (SNOWFLAKE.test(userId) && shouldRemove(userId)) {
        try { fs.rmSync(path.join(PREVIEW_DIRECTORY, name), { force: true }); } catch (_) {}
      }
    }
  }

  publish(force) {
    const snapshot = this.collect();
    const previews = this.thumbnailsFor(snapshot);
    const watching = this.watching.filter((userId) => snapshot.streaming.includes(userId));
    const payload = { version: 3, updatedAt: Date.now(), ...snapshot, watching, previews };
    const signature = JSON.stringify({ ...payload, updatedAt: 0 });
    if (!force && signature === this.lastSignature) return;
    if (force && signature === this.lastSignature && Date.now() - this.lastWrite < HEARTBEAT_MS - 1000) return;

    this.lastSignature = signature;
    this.lastWrite = Date.now();
    this.write(payload);
  }

  write(payload) {
    try {
      fs.mkdirSync(ROOT, { recursive: true });
      const temporary = `${OUTPUT_FILE}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify(payload), 'utf8');
      fs.renameSync(temporary, OUTPUT_FILE);
    } catch (error) {
      console.warn('[TouchDeckBridge] could not publish voice state:', error.message);
    }
  }

  writeDiagnostics() {
    const describe = (object) => {
      if (!object) return null;
      const names = new Set();
      for (let proto = object; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
        Object.getOwnPropertyNames(proto).forEach((name) => names.add(name));
      }
      return Array.from(names).filter((name) => !name.startsWith('_')).sort();
    };
    const snapshot = this.collect();
    const attempt = (run) => { try { return run(); } catch (error) { return `error: ${error?.message || error}`; } };
    const report = {
      at: new Date().toISOString(),
      version: 3,
      stores: {
        VoiceStateStore: Boolean(this.voiceStates),
        SelectedChannelStore: Boolean(this.selectedChannel),
        ChannelStore: Boolean(this.channels),
        ApplicationStreamingStore: describe(this.streams),
        ApplicationStreamPreviewStore: describe(this.previewStore)
      },
      previewFetcher: this.fetchPreview ? { kind: this.fetchPreview.kind, source: this.fetchPreview.source || '' } : null,
      snapshot,
      watching: this.watching,
      request: this.request,
      previewState: Object.fromEntries(snapshot.streaming.map((userId) => {
        const guildId = snapshot.guildId || null;
        return [userId, {
          shouldFetch: attempt(() => this.previewStore?.shouldFetchPreview?.(guildId, snapshot.channelId, userId)),
          url: attempt(() => this.previewStore?.getPreviewURL?.(guildId, snapshot.channelId, userId)),
          thumbnail: this.thumbnails.get(userId) || null
        }];
      })),
      videos: Array.from(document.querySelectorAll('video')).map((video) => ({
        size: `${video.videoWidth}x${video.videoHeight}`,
        playing: video.readyState >= 2 && !video.paused,
        tile: video.closest('[data-selenium-video-tile]')?.getAttribute('data-selenium-video-tile') || null
      }))
    };
    try {
      fs.mkdirSync(ROOT, { recursive: true });
      fs.writeFileSync(DIAGNOSTICS_FILE, JSON.stringify(report, null, 2), 'utf8');
    } catch (_) {}
  }
};
