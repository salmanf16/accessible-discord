# -*- coding: utf-8 -*-
import os
import shutil
import threading
from http.server import HTTPServer
import wx
import config
import speech
import globalPluginHandler
import gui
from gui import settingsDialogs
import addonHandler
import logHandler

logHandler.log.info("Accessible Discord global plugin package loading")
addonHandler.initTranslation()

from . import _settings as settings
from . import _server as server

confspec = {
    "speak_join": "boolean(default=True)",
    "custom_join": "boolean(default=False)",
    "msg_join": "string(default='')",
    
    "speak_leave": "boolean(default=True)",
    "custom_leave": "boolean(default=False)",
    "msg_leave": "string(default='')",
    
    "speak_mute": "boolean(default=True)",
    "custom_mute": "boolean(default=False)",
    "msg_mute_muted": "string(default='')",
    "msg_mute_unmuted": "string(default='')",
    
    "speak_deafen": "boolean(default=True)",
    "custom_deafen": "boolean(default=False)",
    "msg_deafen_deafened": "string(default='')",
    "msg_deafen_undeafened": "string(default='')",
    
    "speak_stream_status": "boolean(default=True)",
    "custom_stream_status": "boolean(default=False)",
    "msg_stream_started": "string(default='')",
    "msg_stream_stopped": "string(default='')",
    
    "speak_stream_viewer": "boolean(default=True)",
    "custom_stream_viewer": "boolean(default=False)",
    "msg_stream_join": "string(default='')",
    "msg_stream_leave": "string(default='')",
    
    "speak_message": "boolean(default=True)",
    "custom_message": "boolean(default=False)",
    "msg_message": "string(default='')",
    "interrupt_speech": "boolean(default=True)",
}
config.conf.spec["accessibleDiscord"] = confspec

def format_custom_message(template, user="", channel="", content="", state="", target=""):
    if not template:
        return ""
    msg = template
    msg = msg.replace("%u", user)
    msg = msg.replace("%c", channel)
    msg = msg.replace("%m", content)
    msg = msg.replace("%s", state)
    msg = msg.replace("%t", target)
    return msg

class GlobalPlugin(globalPluginHandler.GlobalPlugin):
    server_thread = None
    server_inst = None

    def __init__(self):
        super(GlobalPlugin, self).__init__()
        gui.settingsDialogs.NVDASettingsDialog.categoryClasses.append(settings.AccessibleDiscordSettingsPanel)
        server.NVDAEventRequestHandler.plugin_instance = self
        self.start_server()
        self.deploy_bd_plugin()
        threading.Thread(target=self.monitor_and_deploy_bd, daemon=True).start()

    def terminate(self):
        try:
            gui.settingsDialogs.NVDASettingsDialog.categoryClasses.remove(settings.AccessibleDiscordSettingsPanel)
        except Exception:
            pass
        self.stop_server()
        super(GlobalPlugin, self).terminate()

    def start_server(self):
        def run_server():
            try:
                self.server_inst = HTTPServer(('127.0.0.1', 48321), server.NVDAEventRequestHandler)
                self.server_inst.serve_forever()
            except Exception:
                pass

        self.server_thread = threading.Thread(target=run_server)
        self.server_thread.daemon = True
        self.server_thread.start()

    def stop_server(self):
        if self.server_inst:
            try:
                self.server_inst.shutdown()
                self.server_inst.server_close()
            except Exception:
                pass
            self.server_inst = None
        if self.server_thread:
            self.server_thread.join(timeout=1.0)
            self.server_thread = None

    def deploy_bd_plugin(self):
        appdata = os.environ.get("APPDATA")
        if not appdata:
            return False
        bd_plugins_dir = os.path.join(appdata, "BetterDiscord", "plugins")
        if not os.path.exists(bd_plugins_dir):
            return False
        plugin_dir = os.path.dirname(__file__)
        src_file = os.path.join(plugin_dir, "AccessibleDiscord.plugin.js")
        dest_file = os.path.join(bd_plugins_dir, "AccessibleDiscord.plugin.js")
        if os.path.exists(src_file):
            should_copy = False
            if not os.path.exists(dest_file):
                should_copy = True
            else:
                try:
                    if os.path.getsize(src_file) != os.path.getsize(dest_file):
                        should_copy = True
                except Exception:
                    should_copy = True
            if should_copy:
                try:
                    shutil.copy2(src_file, dest_file)
                    return True
                except Exception:
                    pass
        return False

    def monitor_and_deploy_bd(self):
        import time
        appdata = os.environ.get("APPDATA")
        if not appdata:
            return
        bd_plugins_dir = os.path.join(appdata, "BetterDiscord", "plugins")
        dest_file = os.path.join(bd_plugins_dir, "AccessibleDiscord.plugin.js")
        plugin_dir = os.path.dirname(__file__)
        src_file = os.path.join(plugin_dir, "AccessibleDiscord.plugin.js")
        if os.path.exists(dest_file) and os.path.exists(src_file):
            try:
                if os.path.getsize(src_file) == os.path.getsize(dest_file):
                    return
            except Exception:
                pass
        for _ in range(200):
            if os.path.exists(bd_plugins_dir):
                if os.path.exists(src_file):
                    try:
                        should_copy = False
                        if not os.path.exists(dest_file):
                            should_copy = True
                        else:
                            if os.path.getsize(src_file) != os.path.getsize(dest_file):
                                should_copy = True
                        if should_copy:
                            shutil.copy2(src_file, dest_file)
                            msg = _("BetterDiscord companion plugin copied automatically. Please enable it in Discord settings.")
                            wx.CallAfter(speech.speakText, msg)
                            break
                    except Exception:
                        pass
            time.sleep(3)

    def handle_event(self, event):
        logHandler.log.info(f"Accessible Discord received event: {event}")
        event_type = event.get("type")
        user = event.get("user", "")
        channel = event.get("channel", "")
        content = event.get("content", "")
        state = event.get("state", "")
        target = event.get("target", "")

        conf = config.conf["accessibleDiscord"]
        msg = ""

        if event_type == "join":
            if not conf["speak_join"]:
                return
            if conf["custom_join"] and conf["msg_join"]:
                msg = format_custom_message(conf["msg_join"], user=user, channel=channel)
            else:
                if channel:
                    msg = "{user} joined voice channel {channel}".format(user=user, channel=channel)
                else:
                    msg = "{user} joined".format(user=user)
        elif event_type == "leave":
            if not conf["speak_leave"]:
                return
            if conf["custom_leave"] and conf["msg_leave"]:
                msg = format_custom_message(conf["msg_leave"], user=user, channel=channel)
            else:
                if channel:
                    msg = "{user} left voice channel {channel}".format(user=user, channel=channel)
                else:
                    msg = "{user} left".format(user=user)
        elif event_type == "mute":
            if not conf["speak_mute"]:
                return
            state_str = "muted" if state == "muted" else "unmuted"
            if conf["custom_mute"]:
                custom_template = conf["msg_mute_muted"] if state == "muted" else conf["msg_mute_unmuted"]
                if custom_template:
                    msg = format_custom_message(custom_template, user=user, state=state_str)
                else:
                    msg = "{user} {state}".format(user=user, state=state_str)
            else:
                msg = "{user} {state}".format(user=user, state=state_str)
        elif event_type == "deafen":
            if not conf["speak_deafen"]:
                return
            state_str = "deafened" if state == "deafened" else "undeafened"
            if conf["custom_deafen"]:
                custom_template = conf["msg_deafen_deafened"] if state == "deafened" else conf["msg_deafen_undeafened"]
                if custom_template:
                    msg = format_custom_message(custom_template, user=user, state=state_str)
                else:
                    msg = "{user} {state}".format(user=user, state=state_str)
            else:
                msg = "{user} {state}".format(user=user, state=state_str)
        elif event_type == "stream_status":
            if not conf["speak_stream_status"]:
                return
            is_started = (state == "started")
            if conf["custom_stream_status"]:
                custom_template = conf["msg_stream_started"] if is_started else conf["msg_stream_stopped"]
                if custom_template:
                    msg = format_custom_message(custom_template, user=user, target=target)
                else:
                    msg = "{user} started streaming".format(user=user) if is_started else "{user} stopped streaming".format(user=user)
            else:
                msg = "{user} started streaming".format(user=user) if is_started else "{user} stopped streaming".format(user=user)
        elif event_type == "stream_join":
            if not conf["speak_stream_viewer"]:
                return
            if conf["custom_stream_viewer"] and conf["msg_stream_join"]:
                msg = format_custom_message(conf["msg_stream_join"], user=user)
            else:
                msg = "{user} joined your stream".format(user=user)
        elif event_type == "stream_leave":
            if not conf["speak_stream_viewer"]:
                return
            if conf["custom_stream_viewer"] and conf["msg_stream_leave"]:
                msg = format_custom_message(conf["msg_stream_leave"], user=user)
            else:
                msg = "{user} left your stream".format(user=user)
        elif event_type == "message":
            if not conf["speak_message"]:
                return
            if len(content) > 100:
                content = content[:97] + "..."
            if conf["custom_message"] and conf["msg_message"]:
                msg = format_custom_message(conf["msg_message"], user=user, content=content)
            else:
                msg = "New message from {user}: {content}".format(user=user, content=content)

        if msg:
            if conf.get("interrupt_speech", True):
                speech.cancelSpeech()
            speech.speakText(msg)
