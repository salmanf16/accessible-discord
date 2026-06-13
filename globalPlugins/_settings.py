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
from . import _server as server

class AccessibleDiscordSettingsPanel(settingsDialogs.SettingsPanel):
    title = _("Accessible Discord")

    def is_bd_installed(self):
        appdata = os.environ.get("APPDATA")
        if appdata:
            return os.path.exists(os.path.join(appdata, "BetterDiscord", "plugins"))
        return False

    def makeSettings(self, settingsSizer):
        self._feature_groups = []
        helper = gui.guiHelper.BoxSizerHelper(self, sizer=settingsSizer)
        if server.NVDAEventRequestHandler.plugin_instance:
            server.NVDAEventRequestHandler.plugin_instance.deploy_bd_plugin()
        if not self.is_bd_installed():
            label = _("Install BetterDiscord")
            self.install_bd_btn = wx.Button(self, label=label)
            self.install_bd_btn.Bind(wx.EVT_BUTTON, self.on_install_bd)
            settingsSizer.Add(self.install_bd_btn, 0, wx.ALL | wx.EXPAND | wx.BOTTOM, 15)

        self.interrupt_speech_cb = wx.CheckBox(self, label=_("Interrupt speech for new announcements"))
        self.interrupt_speech_cb.SetValue(config.conf["accessibleDiscord"].get("interrupt_speech", True))
        helper.addItem(self.interrupt_speech_cb)

        self.addFeatureGroup(helper, _("Announce when members join a voice channel"), "speak_join", "custom_join", [
            ("msg_join", "%u joined %c", _("Custom join message template:"))
        ])
        
        self.addFeatureGroup(helper, _("Announce when members leave a voice channel"), "speak_leave", "custom_leave", [
            ("msg_leave", "%u left %c", _("Custom leave message template:"))
        ])
        
        self.addFeatureGroup(helper, _("Announce microphone mute/unmute status changes"), "speak_mute", "custom_mute", [
            ("msg_mute_muted", "%u %s", _("Custom muted template:")),
            ("msg_mute_unmuted", "%u %s", _("Custom unmuted template:"))
        ])
        
        self.addFeatureGroup(helper, _("Announce headset deafen/undeafen status changes"), "speak_deafen", "custom_deafen", [
            ("msg_deafen_deafened", "%u %s", _("Custom deafened template:")),
            ("msg_deafen_undeafened", "%u %s", _("Custom undeafened template:"))
        ])
        
        self.addFeatureGroup(helper, _("Announce when members start or stop streaming"), "speak_stream_status", "custom_stream_status", [
            ("msg_stream_started", "%u started streaming", _("Custom streaming started template:")),
            ("msg_stream_stopped", "%u stopped streaming", _("Custom streaming stopped template:"))
        ])
        
        self.addFeatureGroup(helper, _("Announce when members join or leave your stream"), "speak_stream_viewer", "custom_stream_viewer", [
            ("msg_stream_join", "%u joined your stream", _("Custom user joined stream template:")),
            ("msg_stream_leave", "%u left your stream", _("Custom user left stream template:"))
        ])
        
        self.addFeatureGroup(helper, _("Announce incoming text messages in the active channel"), "speak_message", "custom_message", [
            ("msg_message", "New message from %u: %m", _("Custom incoming message template:"))
        ])

    def addFeatureGroup(self, helper, group_label, speak_key, custom_key, templates):
        # 1. Main CheckBox
        cb = wx.CheckBox(self, label=group_label)
        cb.SetValue(config.conf["accessibleDiscord"][speak_key])
        helper.addItem(cb)
        
        # 2. Choice control (Default/Custom) - Always visible, enabled/disabled based on speak_key
        choice_sizer = wx.BoxSizer(wx.HORIZONTAL)
        choice_label = wx.StaticText(self, label=_("Template mode:"))
        choice = wx.Choice(self, choices=[_("Default"), _("Custom")])
        is_custom = config.conf["accessibleDiscord"][custom_key]
        choice.SetSelection(1 if is_custom else 0)
        
        choice_sizer.Add(choice_label, 0, wx.ALIGN_CENTER_VERTICAL | wx.RIGHT, 5)
        choice_sizer.Add(choice, 0, wx.ALIGN_CENTER_VERTICAL)
        helper.sizer.Add(choice_sizer, 0, wx.LEFT | wx.BOTTOM, 15)
        
        # 3. Create text controls for each template
        text_controls = []
        for config_key, default_val, label_text in templates:
            lbl = wx.StaticText(self, label=label_text)
            txt = wx.TextCtrl(self, value=config.conf["accessibleDiscord"][config_key] or default_val)
            
            helper.sizer.Add(lbl, 0, wx.LEFT | wx.BOTTOM, 10)
            helper.sizer.Add(txt, 0, wx.LEFT | wx.RIGHT | wx.BOTTOM | wx.EXPAND, 15)
            
            text_controls.append((config_key, default_val, lbl, txt))
            
        def update_visibility():
            active = cb.GetValue()
            custom_mode = (choice.GetSelection() == 1)
            
            # Choice is always visible, just enabled/disabled
            choice_label.Enable(active)
            choice.Enable(active)
            
            # Hide/show text controls
            show_text = active and custom_mode
            for config_key, default_val, lbl, txt in text_controls:
                lbl.Show(show_text)
                txt.Show(show_text)
                helper.sizer.Show(lbl, show_text)
                helper.sizer.Show(txt, show_text)
                
            if not custom_mode:
                for config_key, default_val, lbl, txt in text_controls:
                    txt.SetValue(default_val)
                    
            self.Layout()
            # Update parent scrolled window scrollbars
            parent = self.GetParent()
            if parent:
                parent.Layout()
                if hasattr(parent, "SetupScrolling"):
                    parent.SetupScrolling()
            
        cb.Bind(wx.EVT_CHECKBOX, lambda e: update_visibility())
        choice.Bind(wx.EVT_CHOICE, lambda e: update_visibility())
        
        update_visibility()
        
        self._feature_groups.append({
            "cb": cb,
            "speak_key": speak_key,
            "choice": choice,
            "custom_key": custom_key,
            "text_controls": [(tc[0], tc[1], tc[2], tc[3], None) for tc in text_controls]
        })

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
        config.conf["accessibleDiscord"]["interrupt_speech"] = self.interrupt_speech_cb.GetValue()
        for group in self._feature_groups:
            speak_active = group["cb"].GetValue()
            config.conf["accessibleDiscord"][group["speak_key"]] = speak_active
            
            custom_active = (group["choice"].GetSelection() == 1)
            config.conf["accessibleDiscord"][group["custom_key"]] = custom_active
            
            for config_key, default_val, lbl, txt, txt_sizer in group["text_controls"]:
                if custom_active:
                    config.conf["accessibleDiscord"][config_key] = txt.GetValue()
                else:
                    config.conf["accessibleDiscord"][config_key] = ""
