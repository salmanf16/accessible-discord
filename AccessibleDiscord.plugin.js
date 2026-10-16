/**
 * @name AccessibleDiscord
 * @author salmanf16
 * @description Automatically sends voice channel events (join, leave, mute, deafen, stream) and chat messages to the Accessible Discord NVDA add-on.
 * @version 1.0.9
 */

module.exports = class AccessibleDiscord {
    constructor() {
        this.lastVoiceStates = new Map();
        this.lastStreamViewers = new Set();
        this.streamCheckInterval = null;
        this.pendingStreamTimers = new Map();
        this.myLastChannelId = null;
        this._storeCache = {};
    }

    getStore(name) {
        if (this._storeCache[name]) {
            return this._storeCache[name];
        }
        let store = null;
        try {
            if (BdApi.Webpack && BdApi.Webpack.getStore) {
                store = BdApi.Webpack.getStore(name);
            }
            if (!store && BdApi.Webpack && BdApi.Webpack.getByKeys) {
                if (name === "PresenceStore") {
                    store = BdApi.Webpack.getByKeys("getActivities", "getPresence");
                } else if (name === "ApplicationStreamingStore") {
                    store = BdApi.Webpack.getByKeys("getStreamerActiveStreamMetadata", "getAnyStreamForUser");
                } else if (name === "VoiceStateStore") {
                    store = BdApi.Webpack.getByKeys("getVoiceStateForUser", "getVoiceStatesForChannel");
                } else if (name === "UserStore") {
                    store = BdApi.Webpack.getByKeys("getCurrentUser", "getUser");
                } else if (name === "ChannelStore") {
                    store = BdApi.Webpack.getByKeys("getChannel", "hasChannel");
                } else if (name === "SelectedChannelStore") {
                    store = BdApi.Webpack.getByKeys("getChannelId", "getVoiceChannelId");
                } else if (name === "ApplicationStore") {
                    store = BdApi.Webpack.getByKeys("getApplication", "getApplications");
                } else if (name === "LocaleStore") {
                    store = BdApi.Webpack.getByKeys("locale", "systemLocale");
                }
            }
            if (!store && BdApi.Webpack && BdApi.Webpack.getModule) {
                store = BdApi.Webpack.getModule(m => m && m.getName && m.getName() === name, { searchExports: true });
            }
            if (!store && BdApi.Webpack && BdApi.Webpack.getModule) {
                if (name === "UserStore") {
                    store = BdApi.Webpack.getModule(m => m && m.getCurrentUser && m.getUser, { searchExports: true });
                } else if (name === "VoiceStateStore") {
                    store = BdApi.Webpack.getModule(m => m && m.getVoiceStateForUser && m.getVoiceStatesForChannel, { searchExports: true });
                } else if (name === "ChannelStore") {
                    store = BdApi.Webpack.getModule(m => m && m.getChannel && m.hasChannel, { searchExports: true });
                } else if (name === "SelectedChannelStore") {
                    store = BdApi.Webpack.getModule(m => m && m.getChannelId && m.getVoiceChannelId, { searchExports: true });
                } else if (name === "ApplicationStreamingStore") {
                    store = BdApi.Webpack.getModule(m => m && (m.getCurrentUserActiveStream || m.getViewerIds || m.getAnyStreamForUser), { searchExports: true });
                } else if (name === "PresenceStore") {
                    store = BdApi.Webpack.getModule(m => m && m.getActivities && m.getPresence, { searchExports: true });
                } else if (name === "ApplicationStore") {
                    store = BdApi.Webpack.getModule(m => m && m.getApplication, { searchExports: true });
                }
            }
        } catch (e) {
            console.error(`[AccessibleDiscord] Failed to get store ${name}:`, e);
        }
        if (store) {
            this._storeCache[name] = store;
        }
        return store;
    }

    getDispatcher() {
        if (this._dispatcher) return this._dispatcher;
        try {
            const userStore = this.getStore("UserStore") || this.getStore("VoiceStateStore");
            if (userStore && userStore._dispatcher && typeof userStore._dispatcher.subscribe === "function") {
                this._dispatcher = userStore._dispatcher;
                return this._dispatcher;
            }
            if (BdApi.Webpack && BdApi.Webpack.getByKeys) {
                let disp = BdApi.Webpack.getByKeys("dispatch", "subscribe", "register");
                if (disp) {
                    this._dispatcher = disp;
                    return disp;
                }
                disp = BdApi.Webpack.getByKeys("dispatch", "subscribe");
                if (disp) {
                    this._dispatcher = disp;
                    return disp;
                }
            }
            if (BdApi.Webpack && BdApi.Webpack.getModule) {
                const disp = BdApi.Webpack.getModule(m => m && m.dispatch && m.subscribe && m.unsubscribe, { searchExports: true });
                if (disp) {
                    this._dispatcher = disp;
                    return disp;
                }
            }
        } catch (e) {
            console.error("[AccessibleDiscord] Failed to get Dispatcher:", e);
        }
        return null;
    }

    getDiscordI18n() {
        try {
            if (BdApi.Webpack && BdApi.Webpack.getByKeys) {
                const i18n = BdApi.Webpack.getByKeys("Messages", "getLocale");
                if (i18n) return i18n;
            }
            if (BdApi.Webpack && BdApi.Webpack.getModule) {
                const i18n = BdApi.Webpack.getModule(m => m && m.Messages && typeof m.getLocale === "function");
                if (i18n) return i18n;
            }
        } catch (e) {}
        return null;
    }

    getLocale() {
        try {
            const localeStore = this.getStore("LocaleStore");
            if (localeStore && localeStore.locale) {
                return localeStore.locale;
            }
            const i18n = this.getDiscordI18n();
            if (i18n && typeof i18n.getLocale === "function") {
                return i18n.getLocale();
            }
        } catch (e) {
            console.error("[AccessibleDiscord] Failed to get Discord locale:", e);
        }
        return document.documentElement.lang || "en-US";
    }

    extractDiscordNativeTerm(key, fallback) {
        try {
            const i18n = this.getDiscordI18n();
            if (i18n && i18n.Messages && typeof i18n.Messages[key] === "string" && i18n.Messages[key]) {
                return i18n.Messages[key];
            }
        } catch (e) {}
        return fallback;
    }

    buildDiscordLocalizedMessage(data) {
        const locale = (this.getLocale() || "en-US").toLowerCase();
        const type = data.type;
        const user = data.user || "";
        const channel = data.channel || "";
        const content = data.content || "";
        const state = data.state || "";
        const target = data.target || "";

        // If Discord itself is running in Arabic (e.g. when Discord adds official Arabic support or via Arabic language pack)
        if (locale.startsWith("ar")) {
            if (type === "join") {
                return channel ? `${user} انضم إلى ${channel}` : `${user} انضم`;
            } else if (type === "leave") {
                return channel ? `${user} غادر ${channel}` : `${user} غادر`;
            } else if (type === "mute") {
                const term = state === "muted"
                    ? this.extractDiscordNativeTerm("MUTE", "كتم الصوت")
                    : this.extractDiscordNativeTerm("UNMUTE", "إلغاء كتم الصوت");
                return `${user} ${term}`;
            } else if (type === "deafen") {
                const term = state === "deafened"
                    ? this.extractDiscordNativeTerm("DEAFEN", "كتم السماعة")
                    : this.extractDiscordNativeTerm("UNDEAFEN", "إلغاء كتم السماعة");
                return `${user} ${term}`;
            } else if (type === "stream_status") {
                if (state === "started") {
                    return target ? `${user} بدأ بث ${target}` : `${user} بدأ البث`;
                }
                return `${user} أوقف البث`;
            } else if (type === "stream_join") {
                return `${user} انضم إلى بثك`;
            } else if (type === "stream_leave") {
                return `${user} غادر بثك`;
            } else if (type === "message") {
                return `رسالة جديدة من ${user}: ${content}`;
            }
        }
        // If Discord itself is set to French
        else if (locale.startsWith("fr")) {
            if (type === "join") {
                return channel ? `${user} a rejoint le salon vocal ${channel}` : `${user} a rejoint`;
            } else if (type === "leave") {
                return channel ? `${user} a quitté le salon vocal ${channel}` : `${user} a quitté`;
            } else if (type === "mute") {
                return state === "muted" ? `${user} muet` : `${user} non muet`;
            } else if (type === "deafen") {
                return state === "deafened" ? `${user} en sourdine` : `${user} sourdine désactivée`;
            } else if (type === "stream_status") {
                if (state === "started") {
                    return target ? `${user} a commencé à diffuser ${target}` : `${user} a commencé à diffuser`;
                }
                return `${user} a arrêté de diffuser`;
            } else if (type === "stream_join") {
                return `${user} a rejoint votre diffusion`;
            } else if (type === "stream_leave") {
                return `${user} a quitté votre diffusion`;
            } else if (type === "message") {
                return `Nouveau message de ${user} : ${content}`;
            }
        }

        // Default: Discord standard English terminology (matches Discord UI directly)
        if (type === "join") {
            return channel ? `${user} joined voice channel ${channel}` : `${user} joined`;
        } else if (type === "leave") {
            return channel ? `${user} left voice channel ${channel}` : `${user} left`;
        } else if (type === "mute") {
            return state === "muted" ? `${user} muted` : `${user} unmuted`;
        } else if (type === "deafen") {
            return state === "deafened" ? `${user} deafened` : `${user} undeafened`;
        } else if (type === "stream_status") {
            if (state === "started") {
                return target ? `${user} started streaming ${target}` : `${user} started streaming`;
            }
            return `${user} stopped streaming`;
        } else if (type === "stream_join") {
            return `${user} joined your stream`;
        } else if (type === "stream_leave") {
            return `${user} left your stream`;
        } else if (type === "message") {
            return `New message from ${user}: ${content}`;
        }
        return "";
    }

    load() {
        console.log("[AccessibleDiscord] Plugin loaded.");
    }

    populateChannelVoiceStates(channelId) {
        if (!channelId) return;
        try {
            const VoiceStateStore = this.getStore("VoiceStateStore");
            if (VoiceStateStore && VoiceStateStore.getVoiceStatesForChannel) {
                const channelStates = VoiceStateStore.getVoiceStatesForChannel(channelId);
                if (channelStates) {
                    for (const userId in channelStates) {
                        const vs = channelStates[userId];
                        if (vs) {
                            this.lastVoiceStates.set(userId, {
                                channelId: vs.channelId,
                                selfMute: Boolean(vs.selfMute),
                                selfDeaf: Boolean(vs.selfDeaf),
                                mute: Boolean(vs.mute),
                                deaf: Boolean(vs.deaf),
                                selfStream: Boolean(vs.selfStream)
                            });
                        }
                    }
                }
            }
        } catch (e) {
            console.error("[AccessibleDiscord] Failed to populate channel voice states:", e);
        }
    }

    start() {
        console.log("[AccessibleDiscord] Starting plugin...");
        this._storeCache = {};
        this._dispatcher = null;
        this.lastVoiceStates.clear();
        this.lastStreamViewers.clear();

        try {
            const VoiceStateStore = this.getStore("VoiceStateStore");
            const UserStore = this.getStore("UserStore");
            if (VoiceStateStore && VoiceStateStore.getAllVoiceStates) {
                const states = VoiceStateStore.getAllVoiceStates();
                for (const guildId in states) {
                    for (const userId in states[guildId]) {
                        const vs = states[guildId][userId];
                        if (vs && vs.channelId) {
                            this.lastVoiceStates.set(userId, {
                                channelId: vs.channelId,
                                selfMute: Boolean(vs.selfMute),
                                selfDeaf: Boolean(vs.selfDeaf),
                                mute: Boolean(vs.mute),
                                deaf: Boolean(vs.deaf),
                                selfStream: Boolean(vs.selfStream)
                            });
                        }
                    }
                }
            }
            if (UserStore && VoiceStateStore) {
                const currentUser = UserStore.getCurrentUser();
                if (currentUser) {
                    const myVs = VoiceStateStore.getVoiceStateForUser(currentUser.id);
                    this.myLastChannelId = myVs ? myVs.channelId : null;
                }
            }
        } catch (err) {
            console.error("[AccessibleDiscord] Failed to populate initial voice states:", err);
        }

        const dispatcher = this.getDispatcher();
        if (dispatcher) {
            this.handleVoiceStateUpdate = this.handleVoiceStateUpdate.bind(this);
            this.handleVoiceStateUpdates = this.handleVoiceStateUpdates.bind(this);
            this.handleMessageCreate = this.handleMessageCreate.bind(this);
            this.handleStreamEvent = this.handleStreamEvent.bind(this);

            dispatcher.subscribe("VOICE_STATE_UPDATE", this.handleVoiceStateUpdate);
            dispatcher.subscribe("VOICE_STATE_UPDATES", this.handleVoiceStateUpdates);
            dispatcher.subscribe("MESSAGE_CREATE", this.handleMessageCreate);
            dispatcher.subscribe("STREAM_CREATE", this.handleStreamEvent);
            dispatcher.subscribe("STREAM_DELETE", this.handleStreamEvent);
            dispatcher.subscribe("STREAM_WATCH", this.handleStreamEvent);
            dispatcher.subscribe("STREAM_UPDATE", this.handleStreamEvent);
            console.log("[AccessibleDiscord] Subscribed to Discord events successfully.");
        } else {
            console.error("[AccessibleDiscord] Could not subscribe: Dispatcher not found.");
        }
    }

    stop() {
        console.log("[AccessibleDiscord] Stopping plugin...");
        if (this.streamCheckInterval) {
            clearInterval(this.streamCheckInterval);
            this.streamCheckInterval = null;
        }
        for (const timerId of this.pendingStreamTimers.values()) {
            clearTimeout(timerId);
        }
        this.pendingStreamTimers.clear();

        const dispatcher = this.getDispatcher();
        if (dispatcher) {
            try {
                if (this.handleVoiceStateUpdate) dispatcher.unsubscribe("VOICE_STATE_UPDATE", this.handleVoiceStateUpdate);
                if (this.handleVoiceStateUpdates) dispatcher.unsubscribe("VOICE_STATE_UPDATES", this.handleVoiceStateUpdates);
                if (this.handleMessageCreate) dispatcher.unsubscribe("MESSAGE_CREATE", this.handleMessageCreate);
                if (this.handleStreamEvent) {
                    dispatcher.unsubscribe("STREAM_CREATE", this.handleStreamEvent);
                    dispatcher.unsubscribe("STREAM_DELETE", this.handleStreamEvent);
                    dispatcher.unsubscribe("STREAM_WATCH", this.handleStreamEvent);
                    dispatcher.unsubscribe("STREAM_UPDATE", this.handleStreamEvent);
                }
            } catch (e) {
                console.error("[AccessibleDiscord] Error unsubscribing from Dispatcher:", e);
            }
        }
        this.lastVoiceStates.clear();
        this.lastStreamViewers.clear();
        this._storeCache = {};
        this._dispatcher = null;
    }

    handleStreamEvent(event) {
        this.checkStreamViewers();
    }

    getStreamTarget(userId) {
        try {
            const ApplicationStreamingStore = this.getStore("ApplicationStreamingStore");
            if (ApplicationStreamingStore) {
                if (ApplicationStreamingStore.getStreamerActiveStreamMetadata) {
                    const meta = ApplicationStreamingStore.getStreamerActiveStreamMetadata(userId) || ApplicationStreamingStore.getStreamerActiveStreamMetadata();
                    if (meta) {
                        if (meta.sourceName) return meta.sourceName;
                        if (meta.name) return meta.name;
                    }
                }
                if (ApplicationStreamingStore.getAnyStreamForUser) {
                    const stream = ApplicationStreamingStore.getAnyStreamForUser(userId);
                    if (stream) {
                        if (stream.sourceName) return stream.sourceName;
                        if (stream.gameName) return stream.gameName;
                    }
                }
            }
            const PresenceStore = this.getStore("PresenceStore");
            if (PresenceStore) {
                const activities = PresenceStore.getActivities ? PresenceStore.getActivities(userId) : null;
                if (activities && Array.isArray(activities)) {
                    const streamAct = activities.find(act => act && act.type === 1);
                    if (streamAct) {
                        if (streamAct.details) return streamAct.details;
                        if (streamAct.name) return streamAct.name;
                    }
                    const gameAct = activities.find(act => act && act.type === 0 && act.name !== "Custom Status");
                    if (gameAct && gameAct.name) return gameAct.name;
                }
            }
        } catch (e) {
            console.error("[AccessibleDiscord] Error getting stream target:", e);
        }
        return "";
    }

    announceStreamStarted(userId, userName) {
        if (this.pendingStreamTimers.has(userId)) {
            clearTimeout(this.pendingStreamTimers.get(userId));
            this.pendingStreamTimers.delete(userId);
        }
        const immediateTarget = this.getStreamTarget(userId);
        if (immediateTarget) {
            this.sendEvent({
                type: "stream_status",
                user: userName,
                state: "started",
                target: immediateTarget
            });
            return;
        }
        const timerId = setTimeout(() => {
            this.pendingStreamTimers.delete(userId);
            const delayedTarget = this.getStreamTarget(userId);
            this.sendEvent({
                type: "stream_status",
                user: userName,
                state: "started",
                target: delayedTarget
            });
        }, 350);
        this.pendingStreamTimers.set(userId, timerId);
    }

    checkStreamViewers() {
        try {
            const ApplicationStreamingStore = this.getStore("ApplicationStreamingStore");
            const UserStore = this.getStore("UserStore");
            if (!ApplicationStreamingStore || !UserStore) return;

            const stream = ApplicationStreamingStore.getCurrentUserActiveStream ? ApplicationStreamingStore.getCurrentUserActiveStream() : null;
            if (!stream) {
                if (this.lastStreamViewers.size > 0) {
                    this.lastStreamViewers.clear();
                }
                if (this.streamCheckInterval) {
                    clearInterval(this.streamCheckInterval);
                    this.streamCheckInterval = null;
                }
                return;
            }

            if (!this.streamCheckInterval) {
                this.streamCheckInterval = setInterval(() => this.checkStreamViewers(), 3000);
            }

            const currentViewerIds = ApplicationStreamingStore.getViewerIds ? ApplicationStreamingStore.getViewerIds(stream) || [] : [];
            const currentSet = new Set(currentViewerIds);

            for (const userId of currentViewerIds) {
                if (!this.lastStreamViewers.has(userId)) {
                    this.lastStreamViewers.add(userId);
                    const currentUser = UserStore.getCurrentUser();
                    if (currentUser && userId === currentUser.id) continue;

                    const user = UserStore.getUser(userId);
                    const userName = user ? (user.globalName || user.username) : "Unknown User";
                    this.sendEvent({
                        type: "stream_join",
                        user: userName
                    });
                }
            }

            for (const userId of Array.from(this.lastStreamViewers)) {
                if (!currentSet.has(userId)) {
                    this.lastStreamViewers.delete(userId);
                    const currentUser = UserStore.getCurrentUser();
                    if (currentUser && userId === currentUser.id) continue;

                    const user = UserStore.getUser(userId);
                    const userName = user ? (user.globalName || user.username) : "Unknown User";
                    this.sendEvent({
                        type: "stream_leave",
                        user: userName
                    });
                }
            }
        } catch (e) {
            console.error("[AccessibleDiscord] Error checking stream viewers:", e);
        }
    }

    handleVoiceStateUpdates(event) {
        if (event && Array.isArray(event.voiceStates)) {
            for (const vs of event.voiceStates) {
                this.handleVoiceStateUpdate(vs);
            }
        }
    }

    handleVoiceStateUpdate(event) {
        if (!event || !event.userId) return;

        const UserStore = this.getStore("UserStore");
        const VoiceStateStore = this.getStore("VoiceStateStore");
        const ChannelStore = this.getStore("ChannelStore");
        if (!UserStore || !VoiceStateStore || !ChannelStore) {
            return;
        }

        const currentUser = UserStore.getCurrentUser();
        if (!currentUser) return;
        const myUserId = currentUser.id;

        const oldState = this.lastVoiceStates.get(event.userId);
        const newState = {
            channelId: event.channelId || null,
            selfMute: Boolean(event.selfMute),
            selfDeaf: Boolean(event.selfDeaf),
            mute: Boolean(event.mute),
            deaf: Boolean(event.deaf),
            selfStream: Boolean(event.selfStream)
        };

        if (newState.channelId) {
            this.lastVoiceStates.set(event.userId, newState);
        } else {
            this.lastVoiceStates.delete(event.userId);
        }

        if (event.userId === myUserId) {
            const newMyChannelId = newState.channelId;
            if (newMyChannelId && newMyChannelId !== this.myLastChannelId) {
                this.populateChannelVoiceStates(newMyChannelId);
            }
            this.myLastChannelId = newMyChannelId;
            this.checkStreamViewers();
            return;
        }

        const myVoiceState = VoiceStateStore.getVoiceStateForUser(myUserId);
        const myChannelId = myVoiceState ? myVoiceState.channelId : null;
        if (!myChannelId) {
            this.myLastChannelId = null;
            return;
        }

        const user = UserStore.getUser(event.userId);
        const userName = user ? (user.globalName || user.username) : "Unknown User";

        const oldChannelId = oldState ? oldState.channelId : (event.oldChannelId || null);
        const newChannelId = newState.channelId;

        // Direct Real-time Event 1: JOIN
        if (oldChannelId !== myChannelId && newChannelId === myChannelId) {
            const channel = ChannelStore.getChannel(myChannelId);
            const channelName = channel ? channel.name : "";
            this.sendEvent({
                type: "join",
                user: userName,
                channel: channelName
            });
            if (newState.selfStream) {
                this.announceStreamStarted(event.userId, userName);
            }
        }
        // Direct Real-time Event 2: LEAVE
        else if (oldChannelId === myChannelId && newChannelId !== myChannelId) {
            const channel = ChannelStore.getChannel(myChannelId);
            const channelName = channel ? channel.name : "";
            this.sendEvent({
                type: "leave",
                user: userName,
                channel: channelName
            });
            if (oldState && oldState.selfStream) {
                if (this.pendingStreamTimers.has(event.userId)) {
                    clearTimeout(this.pendingStreamTimers.get(event.userId));
                    this.pendingStreamTimers.delete(event.userId);
                }
                this.sendEvent({
                    type: "stream_status",
                    user: userName,
                    state: "stopped"
                });
            }
        }
        // Direct Real-time Event 3: IN-CHANNEL ACTIONS (Mute / Deafen / Stream)
        else if (oldChannelId === myChannelId && newChannelId === myChannelId && oldState) {
            const oldMute = oldState.selfMute || oldState.mute;
            const newMute = newState.selfMute || newState.mute;
            if (oldMute !== newMute) {
                this.sendEvent({
                    type: "mute",
                    user: userName,
                    state: newMute ? "muted" : "unmuted"
                });
            }

            const oldDeaf = oldState.selfDeaf || oldState.deaf;
            const newDeaf = newState.selfDeaf || newState.deaf;
            if (oldDeaf !== newDeaf) {
                this.sendEvent({
                    type: "deafen",
                    user: userName,
                    state: newDeaf ? "deafened" : "undeafened"
                });
            }

            const oldStream = oldState.selfStream;
            const newStream = newState.selfStream;
            if (oldStream !== newStream) {
                if (newStream) {
                    this.announceStreamStarted(event.userId, userName);
                } else {
                    if (this.pendingStreamTimers.has(event.userId)) {
                        clearTimeout(this.pendingStreamTimers.get(event.userId));
                        this.pendingStreamTimers.delete(event.userId);
                    }
                    this.sendEvent({
                        type: "stream_status",
                        user: userName,
                        state: "stopped"
                    });
                }
            }
        }
    }

    handleMessageCreate(event) {
        if (!event || !event.message || event.optimistic || event.isPushNotification) return;
        const msg = event.message;
        if (!msg.author || msg.state === "SENDING") return;

        const UserStore = this.getStore("UserStore");
        const SelectedChannelStore = this.getStore("SelectedChannelStore");
        if (!UserStore || !SelectedChannelStore) {
            return;
        }

        const currentUser = UserStore.getCurrentUser();
        const myUserId = currentUser ? currentUser.id : null;
        const activeChannelId = SelectedChannelStore.getChannelId();

        if (msg.channel_id === activeChannelId && msg.author.id !== myUserId) {
            const userName = msg.author.globalName || msg.author.username || "Unknown User";
            let content = msg.content || "";
            if (!content && Array.isArray(msg.attachments) && msg.attachments.length > 0) {
                content = msg.attachments.map(a => a.filename || "Attachment").join(", ");
            }
            if (!content && Array.isArray(msg.sticker_items) && msg.sticker_items.length > 0) {
                content = msg.sticker_items.map(s => s.name || "Sticker").join(", ");
            }
            if (!content) return;

            this.sendEvent({
                type: "message",
                user: userName,
                content: content
            });
        }
    }

    sendEvent(data) {
        const locale = this.getLocale();
        const lowerLocale = locale.toLowerCase();
        let lang = "en";
        if (lowerLocale.startsWith("ar")) {
            lang = "ar";
        } else if (lowerLocale.startsWith("fr")) {
            lang = "fr";
        }
        data.lang = lang;
        data.discordLocale = locale;
        data.defaultMessage = this.buildDiscordLocalizedMessage(data);

        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 3000) : null;

        fetch("http://127.0.0.1:48321/event", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data),
            signal: controller ? controller.signal : undefined
        }).then(response => {
            if (timeoutId) clearTimeout(timeoutId);
        }).catch(err => {
            if (timeoutId) clearTimeout(timeoutId);
        });
    }
};
