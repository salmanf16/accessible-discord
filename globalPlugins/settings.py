# -*- coding: utf-8 -*-
import os
import threading
import urllib.request
import tempfile
import time
import wx
import config
import speech
import addonHandler
import logHandler

# Initialize translations for this module
addonHandler.initTranslation()

from gui import settingsDialogs
import gui.guiHelper
from . import server

class AccessibleDiscordSettingsPanel(settingsDialogs.SettingsPanel):
    title = _("Accessible Discord")

    def is_bd_installed(self):
        appdata = os.environ.get("APPDATA")
        if appdata:
            return os.path.exists(os.path.join(appdata, "BetterDiscord", "plugins"))
        return False

    def makeSettings(self, settingsSizer):
        helper = gui.guiHelper.BoxSizerHelper(self, sizer=settingsSizer)
        if server.NVDAEventRequestHandler.plugin_instance:
            server.NVDAEventRequestHandler.plugin_instance.deploy_bd_plugin()
        if not self.is_bd_installed():
            label = _("Install BetterDiscord")
            self.install_bd_btn = wx.Button(self, label=label)
            self.install_bd_btn.Bind(wx.EVT_BUTTON, self.on_install_bd)
            settingsSizer.Add(self.install_bd_btn, 0, wx.ALL | wx.EXPAND | wx.BOTTOM, 15)

        self.speak_join_cb = helper.addItem(wx.CheckBox(self, label=_("Announce when members join a voice channel")))
        self.speak_join_cb.SetValue(config.conf["accessibleDiscord"]["speak_join"])

        self.speak_leave_cb = helper.addItem(wx.CheckBox(self, label=_("Announce when members leave a voice channel")))
        self.speak_leave_cb.SetValue(config.conf["accessibleDiscord"]["speak_leave"])

        self.speak_mute_cb = helper.addItem(wx.CheckBox(self, label=_("Announce microphone mute/unmute status changes")))
        self.speak_mute_cb.SetValue(config.conf["accessibleDiscord"]["speak_mute"])

        self.speak_deafen_cb = helper.addItem(wx.CheckBox(self, label=_("Announce headset deafen/undeafen status changes")))
        self.speak_deafen_cb.SetValue(config.conf["accessibleDiscord"]["speak_deafen"])

        self.speak_stream_status_cb = helper.addItem(wx.CheckBox(self, label=_("Announce when members start or stop streaming")))
        self.speak_stream_status_cb.SetValue(config.conf["accessibleDiscord"]["speak_stream_status"])

        self.speak_stream_viewer_cb = helper.addItem(wx.CheckBox(self, label=_("Announce when members join or leave your stream")))
        self.speak_stream_viewer_cb.SetValue(config.conf["accessibleDiscord"]["speak_stream_viewer"])

        self.speak_message_cb = helper.addItem(wx.CheckBox(self, label=_("Announce incoming text messages in the active channel")))
        self.speak_message_cb.SetValue(config.conf["accessibleDiscord"]["speak_message"])

    def on_install_bd(self, event):
        self.install_bd_btn.Disable()
        self.install_bd_btn.SetLabel(_("Downloading..."))
        dialog = wx.ProgressDialog(
            title=_("Downloading BetterDiscord"),
            message=_("Connecting to server..."),
            maximum=100,
            parent=self,
            style=wx.PD_APP_MODAL | wx.PD_AUTO_HIDE | wx.PD_REMAINING_TIME | wx.PD_ELAPSED_TIME
        )
        threading.Thread(target=self._download_and_run_bd, args=(dialog,), daemon=True).start()

    def _download_and_run_bd(self, dialog):
        speech.speakText(_("Downloading BetterDiscord installer, please wait..."))
        url = "https://github.com/BetterDiscord/Installer/releases/latest/download/BetterDiscord-Windows.exe"
        temp_dir = tempfile.gettempdir()
        installer_path = os.path.join(temp_dir, "BetterDiscord-Windows.exe")
        try:
            req = urllib.request.Request(
                url,
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            )
            start_time = time.time()
            with urllib.request.urlopen(req) as response:
                total_size = int(response.headers.get('Content-Length', 0))
                bytes_downloaded = 0
                chunk_size = 65536
                with open(installer_path, 'wb') as out_file:
                    while True:
                        chunk = response.read(chunk_size)
                        if not chunk:
                            break
                        out_file.write(chunk)
                        bytes_downloaded += len(chunk)
                        elapsed = time.time() - start_time
                        if total_size > 0:
                            percent = int((bytes_downloaded / total_size) * 100)
                            if elapsed > 0.1:
                                speed = bytes_downloaded / elapsed
                                remaining_bytes = total_size - bytes_downloaded
                                remaining_seconds = int(remaining_bytes / speed) if speed > 0 else 0
                                rem_min = remaining_seconds // 60
                                rem_sec = remaining_seconds % 60
                                if rem_min > 0:
                                    time_str = _("{minutes} min and {seconds} sec").format(minutes=rem_min, seconds=rem_sec)
                                else:
                                    time_str = _("{seconds} sec").format(seconds=remaining_seconds)
                            else:
                                time_str = _("Calculating...")
                            msg = _("Downloaded {downloaded} KB of {total} KB ({percent}%)\nTime remaining: {remaining}").format(
                                downloaded=bytes_downloaded // 1024,
                                total=total_size // 1024,
                                percent=percent,
                                remaining=time_str
                            )
                            wx.CallAfter(dialog.Update, percent, msg)
                        else:
                            msg = _("Downloaded {downloaded} KB").format(downloaded=bytes_downloaded // 1024)
                            wx.CallAfter(dialog.Update, 0, msg)
            wx.CallAfter(dialog.Destroy)
            os.startfile(installer_path)
            speech.speakText(_("BetterDiscord installer downloaded and opened successfully. Please complete the installation in the opened window."))
            def reset_btn():
                if hasattr(self, 'install_bd_btn') and self.install_bd_btn:
                    self.install_bd_btn.Enable()
                    self.install_bd_btn.SetLabel(_("Install BetterDiscord"))
            wx.CallAfter(reset_btn)
        except Exception as e:
            try:
                wx.CallAfter(dialog.Destroy)
            except Exception:
                pass
            speech.speakText(_("Failed to download BetterDiscord: {error}").format(error=str(e)))
            def enable_btn():
                if hasattr(self, 'install_bd_btn') and self.install_bd_btn:
                    self.install_bd_btn.Enable()
                    self.install_bd_btn.SetLabel(_("Download failed, retry"))
            wx.CallAfter(enable_btn)

    def onSave(self):
        config.conf["accessibleDiscord"]["speak_join"] = self.speak_join_cb.GetValue()
        config.conf["accessibleDiscord"]["speak_leave"] = self.speak_leave_cb.GetValue()
        config.conf["accessibleDiscord"]["speak_mute"] = self.speak_mute_cb.GetValue()
        config.conf["accessibleDiscord"]["speak_deafen"] = self.speak_deafen_cb.GetValue()
        config.conf["accessibleDiscord"]["speak_stream_status"] = self.speak_stream_status_cb.GetValue()
        config.conf["accessibleDiscord"]["speak_stream_viewer"] = self.speak_stream_viewer_cb.GetValue()
        config.conf["accessibleDiscord"]["speak_message"] = self.speak_message_cb.GetValue()
