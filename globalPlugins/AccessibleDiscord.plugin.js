/**
 * @name AccessibleDiscord
 * @author salmanf16
 * @description Automatically sends voice channel events (join, leave, mute, deafen) and chat messages to the Accessible Discord NVDA add-on.
 * @version 1.0.0
 */

module.exports = class AccessibleDiscord {
    constructor() {
        this.lastVoiceStates = new Map();
        this.lastStreamViewers = new Set();
        this.streamCheckInterval = null;
    }

    getStore(name) {
        try {
            const store = BdApi.Webpack.getModule(m => m.getName && m.getName() === name, { searchExports: true });
            if (store) return store;
            if (BdApi.Webpack.getStore) {
                const store = BdApi.Webpack.getStore(name);
                if (store) return store;
            }
            if (name === "UserStore") {
                return BdApi.Webpack.getModule(m => m.getCurrentUser && m.getUser, { searchExports: true });
            } else if (name === "VoiceStateStore") {
                return BdApi.Webpack.getModule(m => m.getVoiceStateForUser && m.getVoiceStatesForChannel, { searchExports: true });
            } else if (name === "ChannelStore") {
                return BdApi.Webpack.getModule(m => m.getChannel && m.hasChannel, { searchExports: true });
            } else if (name === "SelectedChannelStore") {
                return BdApi.Webpack.getModule(m => m.getChannelId && m.getVoiceChannelId, { searchExports: true });
            } else if (name === "ApplicationStreamingStore") {
                return BdApi.Webpack.getModule(m => m.getCurrentUserActiveStream && m.getViewerIds, { searchExports: true });
            } else if (name === "PresenceStore") {
                return BdApi.Webpack.getModule(m => m.getActivities && m.getPresence, { searchExports: true });
            } else if (name === "ApplicationStore") {
                return BdApi.Webpack.getModule(m => m.getApplication, { searchExports: true });
            }
        } catch (e) {
            console.error(`[AccessibleDiscord] Failed to get store ${name}:`, e);
        }
        return null;
    }

    getDispatcher() {
        try {
            const disp = BdApi.Webpack.getModule(m => m.dispatch && m.subscribe, { searchExports: true });
            if (disp) return disp;
        } catch (e) {
            console.error("[AccessibleDiscord] Failed to get Dispatcher via filter:", e);
        }
        try {
            if (BdApi.Webpack.getByProps) {
                let disp = BdApi.Webpack.getByProps("dispatch", "subscribe", "dirtyDispatch");
                if (disp) return disp;
                disp = BdApi.Webpack.getByProps("dirtyDispatch");
                if (disp) return disp;
            }
        } catch (e) {
            console.error("[AccessibleDiscord] Failed to get Dispatcher via props:", e);
        }
        return null;
    }

    load() {
        console.log("[AccessibleDiscord] Plugin loaded.");
    }

    start() {
        console.log("[AccessibleDiscord] Starting plugin...");
        this.lastVoiceStates.clear();
        this.lastStreamViewers.clear();

        // Debug: dump ApplicationStreamingStore keys to NVDA log
        try {
            const store = this.getStore("ApplicationStreamingStore");
            if (store) {
                let keys = [];
                let obj = store;
                while (obj) {
                    keys = keys.concat(Object.getOwnPropertyNames(obj));
                    obj = Object.getPrototypeOf(obj);
                }
                let uniqueKeys = [...new Set(keys)].filter(k => typeof store[k] === "function" || store[k] !== undefined);
                this.sendEvent({
                    type: "debug_log",
                    message: `ApplicationStreamingStore keys: ${uniqueKeys.join(", ")}`
                });
            } else {
                this.sendEvent({
                    type: "debug_log",
                    message: "ApplicationStreamingStore store not found"
                });
            }
        } catch (e) {
            this.sendEvent({
                type: "debug_log",
                message: `Error dumping store: ${e.message}`
            });
        }

        try {
            const VoiceStateStore = this.getStore("VoiceStateStore");
            if (VoiceStateStore) {
                const states = VoiceStateStore.getAllVoiceStates();
                for (const guildId in states) {
                    for (const userId in states[guildId]) {
                        const vs = states[guildId][userId];
                        this.lastVoiceStates.set(userId, {
                            channelId: vs.channelId,
                            selfMute: vs.selfMute,
                            selfDeaf: vs.selfDeaf,
                            mute: vs.mute,
                            deaf: vs.deaf,
                            selfStream: vs.selfStream || false
                        });
                    }
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

            try {
                const origDispatch = dispatcher.dispatch;
                const origDirtyDispatch = dispatcher.dirtyDispatch;
                const logAction = (action) => {
                    if (action && action.type) {
                        const type = action.type;
                        if (type.includes("VOICE") || type.includes("MESSAGE") || type.includes("CHANNEL") || type.includes("MUTE") || type.includes("STREAM") || type.includes("WATCH")) {
                            console.log("[AccessibleDiscord] Intercepted dispatcher action:", type, JSON.stringify(action));
                        }
                    }
                };
                if (origDispatch && !origDispatch.__accessibleDiscordHooked) {
                    dispatcher.dispatch = function(action) {
                        logAction(action);
                        return origDispatch.apply(this, arguments);
                    };
                    dispatcher.dispatch.__accessibleDiscordHooked = true;
                    this._origDispatch = origDispatch;
                }
                if (origDirtyDispatch && !origDirtyDispatch.__accessibleDiscordHooked) {
                    dispatcher.dirtyDispatch = function(action) {
                        logAction(action);
                        return origDirtyDispatch.apply(this, arguments);
                    };
                    dispatcher.dirtyDispatch.__accessibleDiscordHooked = true;
                    this._origDirtyDispatch = origDirtyDispatch;
                }
            } catch (err) {
                console.error("[AccessibleDiscord] Error hooking dispatcher:", err);
            }
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
        const dispatcher = this.getDispatcher();
        if (dispatcher) {
            if (this.handleVoiceStateUpdate) dispatcher.unsubscribe("VOICE_STATE_UPDATE", this.handleVoiceStateUpdate);
            if (this.handleVoiceStateUpdates) dispatcher.unsubscribe("VOICE_STATE_UPDATES", this.handleVoiceStateUpdates);
            if (this.handleMessageCreate) dispatcher.unsubscribe("MESSAGE_CREATE", this.handleMessageCreate);
            if (this.handleStreamEvent) {
                dispatcher.unsubscribe("STREAM_CREATE", this.handleStreamEvent);
                dispatcher.unsubscribe("STREAM_DELETE", this.handleStreamEvent);
                dispatcher.unsubscribe("STREAM_WATCH", this.handleStreamEvent);
                dispatcher.unsubscribe("STREAM_UPDATE", this.handleStreamEvent);
            }

            if (this._origDispatch) {
                dispatcher.dispatch = this._origDispatch;
            }
            if (this._origDirtyDispatch) {
                dispatcher.dirtyDispatch = this._origDirtyDispatch;
            }
        }
        this.lastVoiceStates.clear();
        this.lastStreamViewers.clear();
    }

    handleStreamEvent(event) {
        console.log("[AccessibleDiscord] handleStreamEvent event:", JSON.stringify(event));
        this.checkStreamViewers();
    }

    getStreamTargetFromMeta(meta, userId) {
        // 1. Direct names
        const name = meta.sourceName || meta.applicationName || meta.name;
        if (name) return name;

        // 2. game object structure
        if (meta.game && meta.game.name) return meta.game.name;
        if (meta.game && typeof meta.game === "string") return meta.game;

        // 3. Resolve by application ID via ApplicationStore
        if (meta.id) {
            const ApplicationStore = this.getStore("ApplicationStore");
            if (ApplicationStore) {
                const app = ApplicationStore.getApplication(meta.id);
                if (app && app.name) return app.name;
            }
        }

        // 4. Resolve by application ID via PresenceStore fallback (ensures we match the exact streamed game)
        if (meta.id) {
            const PresenceStore = this.getStore("PresenceStore");
            if (PresenceStore) {
                const activities = PresenceStore.getActivities(userId) || [];
                for (const act of activities) {
                    if (act && act.applicationId === meta.id && act.name) {
                        return act.name;
                    }
                }
            }
        }

        return "";
    }

    announceStreamStart(userId, userName, attempt = 1) {
        try {
            const ApplicationStreamingStore = this.getStore("ApplicationStreamingStore");
            const PresenceStore = this.getStore("PresenceStore");
            
            if (ApplicationStreamingStore) {
                let stream = ApplicationStreamingStore.getAnyStreamForUser(userId);
                let activities = PresenceStore ? (PresenceStore.getActivities ? PresenceStore.getActivities(userId) : []) : [];
                
                let streamKeys = [];
                let streamProtoKeys = [];
                if (stream) {
                    streamKeys = Object.getOwnPropertyNames(stream);
                    try {
                        streamProtoKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(stream));
                    } catch (e) {}
                }

                this.sendEvent({
                    type: "debug_log",
                    message: `attempt ${attempt} for ${userName}: streamKeys: ${JSON.stringify(streamKeys)}, streamProtoKeys: ${JSON.stringify(streamProtoKeys)}, activities: ${JSON.stringify(activities)}`
                });
            }
        } catch (e) {
            this.sendEvent({
                type: "debug_log",
                message: `Error in debug logging: ${e.message}`
            });
        }

        if (attempt < 4) {
            setTimeout(() => {
                this.announceStreamStart(userId, userName, attempt + 1);
            }, 500);
        } else {
            // After 4 attempts (2 seconds total), announce without a game name if still not found
            this.sendEvent({
                type: "stream_status",
                user: userName,
                state: "started",
                target: ""
            });
        }
    }

    checkStreamViewers() {
        try {
            const ApplicationStreamingStore = this.getStore("ApplicationStreamingStore");
            const UserStore = this.getStore("UserStore");
            if (!ApplicationStreamingStore || !UserStore) return;

            const stream = ApplicationStreamingStore.getCurrentUserActiveStream();
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

            const currentViewerIds = ApplicationStreamingStore.getViewerIds(stream) || [];
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

            for (const userId of this.lastStreamViewers) {
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
        console.log("[AccessibleDiscord] handleVoiceStateUpdates event:", JSON.stringify(event));
        if (event && event.voiceStates) {
            for (const vs of event.voiceStates) {
                this.handleVoiceStateUpdate(vs);
            }
        }
    }

    handleVoiceStateUpdate(event) {
        console.log("[AccessibleDiscord] handleVoiceStateUpdate event:", JSON.stringify(event));
        const UserStore = this.getStore("UserStore");
        const VoiceStateStore = this.getStore("VoiceStateStore");
        const ChannelStore = this.getStore("ChannelStore");
        if (!UserStore || !VoiceStateStore || !ChannelStore) {
            console.log("[AccessibleDiscord] missing stores:", !UserStore, !VoiceStateStore, !ChannelStore);
            return;
        }

        const currentUser = UserStore.getCurrentUser();
        if (!currentUser) {
            console.log("[AccessibleDiscord] missing currentUser");
            return;
        }
        const myUserId = currentUser.id;

        const myVoiceState = VoiceStateStore.getVoiceStateForUser(myUserId);
        const myChannelId = myVoiceState ? myVoiceState.channelId : null;
        console.log("[AccessibleDiscord] myChannelId:", myChannelId, "myUserId:", myUserId, "event.userId:", event.userId);

        if (!myChannelId) {
            console.log("[AccessibleDiscord] NVDA user not in a voice channel. Event skipped.");
            return;
        }

        const oldState = this.lastVoiceStates.get(event.userId);
        const newState = {
            channelId: event.channelId,
            selfMute: event.selfMute,
            selfDeaf: event.selfDeaf,
            mute: event.mute,
            deaf: event.deaf,
            selfStream: event.selfStream || false
        };
        this.lastVoiceStates.set(event.userId, newState);

        if (event.userId === myUserId) {
            this.checkStreamViewers();
            console.log("[AccessibleDiscord] Event is from self. Skipping.");
            return;
        }

        const user = UserStore.getUser(event.userId);
        const userName = user ? (user.globalName || user.username) : "Unknown User";

        if ((oldState === undefined || oldState.channelId !== myChannelId) && event.channelId === myChannelId) {
            const channel = ChannelStore.getChannel(myChannelId);
            const channelName = channel ? channel.name : "";
            this.sendEvent({
                type: "join",
                user: userName,
                channel: channelName
            });
            const oldStream = oldState ? (oldState.selfStream || false) : false;
            const newStream = event.selfStream || false;
            if (newStream) {
                this.announceStreamStart(event.userId, userName);
            }
        }
        else if (oldState !== undefined && oldState.channelId === myChannelId && event.channelId !== myChannelId) {
            const channel = ChannelStore.getChannel(myChannelId);
            const channelName = channel ? channel.name : "";
            this.sendEvent({
                type: "leave",
                user: userName,
                channel: channelName
            });
            const oldStream = oldState.selfStream || false;
            if (oldStream) {
                this.sendEvent({
                    type: "stream_status",
                    user: userName,
                    state: "stopped"
                });
            }
        }
        else if (oldState !== undefined && oldState.channelId === myChannelId && event.channelId === myChannelId) {
            const oldMute = oldState.selfMute || oldState.mute;
            const newMute = event.selfMute || event.mute;
            if (oldMute !== newMute) {
                this.sendEvent({
                    type: "mute",
                    user: userName,
                    state: newMute ? "muted" : "unmuted"
                });
            }

            const oldDeaf = oldState.selfDeaf || oldState.deaf;
            const newDeaf = event.selfDeaf || event.deaf;
            if (oldDeaf !== newDeaf) {
                this.sendEvent({
                    type: "deafen",
                    user: userName,
                    state: newDeaf ? "deafened" : "undeafened"
                });
            }

            const oldStream = oldState.selfStream || false;
            const newStream = event.selfStream || false;
            if (oldStream !== newStream) {
                if (newStream) {
                    this.announceStreamStart(event.userId, userName);
                } else {
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
        console.log("[AccessibleDiscord] handleMessageCreate event:", JSON.stringify(event));
        if (!event.message) return;

        const UserStore = this.getStore("UserStore");
        const SelectedChannelStore = this.getStore("SelectedChannelStore");
        if (!UserStore || !SelectedChannelStore) {
            console.log("[AccessibleDiscord] Message missing stores:", !UserStore, !SelectedChannelStore);
            return;
        }

        const currentUser = UserStore.getCurrentUser();
        const myUserId = currentUser ? currentUser.id : null;
        const activeChannelId = SelectedChannelStore.getChannelId();

        console.log("[AccessibleDiscord] Message channel:", event.message.channel_id, "activeChannel:", activeChannelId, "author:", event.message.author.id, "myUserId:", myUserId);

        if (event.message.channel_id === activeChannelId && event.message.author.id !== myUserId) {
            const userName = event.message.author.globalName || event.message.author.username;
            this.sendEvent({
                type: "message",
                user: userName,
                content: event.message.content
            });
        }
    }

    getLocale() {
        try {
            const LocaleManager = BdApi.Webpack.getModule(m => m.getLocale && m.setLocale);
            if (LocaleManager) {
                return LocaleManager.getLocale();
            }
        } catch (e) {
            console.error("[AccessibleDiscord] Failed to get LocaleManager:", e);
        }
        return document.documentElement.lang || "en-US";
    }

    sendEvent(data) {
        const locale = this.getLocale();
        let lang = "en";
        const lowerLocale = locale.toLowerCase();
        if (lowerLocale.startsWith("ar")) {
            lang = "ar";
        } else if (lowerLocale.startsWith("fr")) {
            lang = "fr";
        }
        data.lang = lang;
        console.log("[AccessibleDiscord] Sending event to NVDA addon:", JSON.stringify(data));

        fetch("http://127.0.0.1:48321/event", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        }).then(response => {
            console.log("[AccessibleDiscord] sendEvent response status:", response.status);
        }).catch(err => {
            console.error("[AccessibleDiscord] sendEvent fetch failed:", err);
        });
    }
};
