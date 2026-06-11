/**
 * @name AccessibleDiscord
 * @author salmanf16
 * @description Automatically sends voice channel events (join, leave, mute, deafen) and chat messages to the Accessible Discord NVDA add-on.
 * @version 1.0.0
 */

module.exports = class AccessibleDiscord {
    constructor() {
        this.lastVoiceStates = new Map();
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
                            deaf: vs.deaf
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
            
            dispatcher.subscribe("VOICE_STATE_UPDATE", this.handleVoiceStateUpdate);
            dispatcher.subscribe("VOICE_STATE_UPDATES", this.handleVoiceStateUpdates);
            dispatcher.subscribe("MESSAGE_CREATE", this.handleMessageCreate);

            try {
                const origDispatch = dispatcher.dispatch;
                const origDirtyDispatch = dispatcher.dirtyDispatch;
                
                const logAction = (action) => {
                    if (action && action.type) {
                        const type = action.type;
                        if (type.includes("VOICE") || type.includes("MESSAGE") || type.includes("CHANNEL") || type.includes("MUTE")) {
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
        const dispatcher = this.getDispatcher();
        if (dispatcher) {
            if (this.handleVoiceStateUpdate) dispatcher.unsubscribe("VOICE_STATE_UPDATE", this.handleVoiceStateUpdate);
            if (this.handleVoiceStateUpdates) dispatcher.unsubscribe("VOICE_STATE_UPDATES", this.handleVoiceStateUpdates);
            if (this.handleMessageCreate) dispatcher.unsubscribe("MESSAGE_CREATE", this.handleMessageCreate);

            if (this._origDispatch) {
                dispatcher.dispatch = this._origDispatch;
            }
            if (this._origDirtyDispatch) {
                dispatcher.dirtyDispatch = this._origDirtyDispatch;
            }
        }
        this.lastVoiceStates.clear();
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
            deaf: event.deaf
        };

        this.lastVoiceStates.set(event.userId, newState);

        if (event.userId === myUserId) {
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
        }
        else if (oldState !== undefined && oldState.channelId === myChannelId && event.channelId !== myChannelId) {
            const channel = ChannelStore.getChannel(myChannelId);
            const channelName = channel ? channel.name : "";
            this.sendEvent({
                type: "leave",
                user: userName,
                channel: channelName
            });
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
        const lang = locale.toLowerCase().startsWith("ar") ? "ar" : "en";
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
