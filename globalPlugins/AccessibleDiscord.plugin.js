/**
 * @name AccessibleDiscord
 * @author salmanf16
 * @description Automatically sends voice channel events (join, leave, mute, deafen, stream) and chat messages to the Accessible Discord NVDA add-on.
 * @version 1.1.0
 */

module.exports = class AccessibleDiscord {
    constructor() {
        this.lastVoiceStates = new Map();
        this.lastStreamViewers = new Set();
        this.streamCheckInterval = null;
    }

    getStore(name) {
        try {
            if (BdApi.Webpack.getByKeys) {
                if (name === "PresenceStore") {
                    const store = BdApi.Webpack.getByKeys("getActivities", "getPresence");
                    if (store) return store;
                } else if (name === "ApplicationStreamingStore") {
                    const store = BdApi.Webpack.getByKeys("getStreamerActiveStreamMetadata", "getAnyStreamForUser");
                    if (store) return store;
                } else if (name === "VoiceStateStore") {
                    const store = BdApi.Webpack.getByKeys("getVoiceStateForUser", "getVoiceStatesForChannel");
                    if (store) return store;
                }
            }
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
                return BdApi.Webpack.getModule(m => m.getCurrentUserActiveStream || m.getViewerIds || m.getAnyStreamForUser, { searchExports: true });
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
            if (BdApi.Webpack.getByKeys) {
                const disp = BdApi.Webpack.getByKeys("dispatch", "subscribe");
                if (disp) return disp;
            }
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

        try {
            const VoiceStateStore = this.getStore("VoiceStateStore");
            if (VoiceStateStore && VoiceStateStore.getAllVoiceStates) {
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
        }
        this.lastVoiceStates.clear();
        this.lastStreamViewers.clear();
    }

    handleStreamEvent(event) {
        console.log("[AccessibleDiscord] handleStreamEvent event:", JSON.stringify(event));
        this.checkStreamViewers();
    }

    getStreamTarget(userId) {
        try {
            // Layer 1: PresenceStore Activities (Streaming type 1 or Playing type 0)
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
            // Layer 2: ApplicationStreamingStore Metadata & Stream Object
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
                    if (stream && stream.gameName) return stream.gameName;
                }
            }
        } catch (e) {
            console.error("[AccessibleDiscord] Error getting stream target:", e);
        }
        return "";
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

    syncChannelVoiceStates(channelId) {
        if (!channelId) return;
        try {
            const VoiceStateStore = this.getStore("VoiceStateStore");
            if (VoiceStateStore && VoiceStateStore.getVoiceStatesForChannel) {
                const channelStates = VoiceStateStore.getVoiceStatesForChannel(channelId);
                if (channelStates) {
                    for (const userId in channelStates) {
                        const vs = channelStates[userId];
                        if (vs && !this.lastVoiceStates.has(userId)) {
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
            }
        } catch (e) {
            console.error("[AccessibleDiscord] Error syncing channel voice states:", e);
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
            return;
        }

        const currentUser = UserStore.getCurrentUser();
        if (!currentUser) return;
        const myUserId = currentUser.id;

        const myVoiceState = VoiceStateStore.getVoiceStateForUser(myUserId);
        const myChannelId = myVoiceState ? myVoiceState.channelId : null;

        if (!myChannelId) {
            return;
        }

        this.syncChannelVoiceStates(myChannelId);

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
            return;
        }

        const user = UserStore.getUser(event.userId);
        const userName = user ? (user.globalName || user.username) : "Unknown User";

        const oldChannelId = oldState ? oldState.channelId : (event.oldChannelId || null);
        const newChannelId = event.channelId;

        if (oldChannelId !== myChannelId && newChannelId === myChannelId) {
            const channel = ChannelStore.getChannel(myChannelId);
            const channelName = channel ? channel.name : "";
            this.sendEvent({
                type: "join",
                user: userName,
                channel: channelName
            });
            const newStream = event.selfStream || false;
            if (newStream) {
                const target = this.getStreamTarget(event.userId);
                this.sendEvent({
                    type: "stream_status",
                    user: userName,
                    state: "started",
                    target: target
                });
            }
        }
        else if (oldChannelId === myChannelId && newChannelId !== myChannelId) {
            const channel = ChannelStore.getChannel(myChannelId);
            const channelName = channel ? channel.name : "";
            this.sendEvent({
                type: "leave",
                user: userName,
                channel: channelName
            });
            const oldStream = oldState ? (oldState.selfStream || false) : false;
            if (oldStream) {
                this.sendEvent({
                    type: "stream_status",
                    user: userName,
                    state: "stopped"
                });
            }
        }
        else if (oldChannelId === myChannelId && newChannelId === myChannelId) {
            const oldMute = oldState ? (oldState.selfMute || oldState.mute) : false;
            const newMute = event.selfMute || event.mute;
            if (oldMute !== newMute) {
                this.sendEvent({
                    type: "mute",
                    user: userName,
                    state: newMute ? "muted" : "unmuted"
                });
            }

            const oldDeaf = oldState ? (oldState.selfDeaf || oldState.deaf) : false;
            const newDeaf = event.selfDeaf || event.deaf;
            if (oldDeaf !== newDeaf) {
                this.sendEvent({
                    type: "deafen",
                    user: userName,
                    state: newDeaf ? "deafened" : "undeafened"
                });
            }

            const oldStream = oldState ? (oldState.selfStream || false) : false;
            const newStream = event.selfStream || false;
            if (oldStream !== newStream) {
                if (newStream) {
                    const target = this.getStreamTarget(event.userId);
                    this.sendEvent({
                        type: "stream_status",
                        user: userName,
                        state: "started",
                        target: target
                    });
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
            return;
        }

        const currentUser = UserStore.getCurrentUser();
        const myUserId = currentUser ? currentUser.id : null;
        const activeChannelId = SelectedChannelStore.getChannelId();

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

