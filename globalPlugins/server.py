# -*- coding: utf-8 -*-
import json
import wx
from http.server import BaseHTTPRequestHandler, HTTPServer
import logHandler

class NVDAEventRequestHandler(BaseHTTPRequestHandler):
    plugin_instance = None

    def log_message(self, format, *args):
        pass

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.end_headers()

    def do_POST(self):
        if self.path == "/event":
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                event = json.loads(post_data.decode('utf-8'))
                self.send_response(200, "ok")
                self.end_headers()
                if NVDAEventRequestHandler.plugin_instance:
                    wx.CallAfter(NVDAEventRequestHandler.plugin_instance.handle_event, event)
            except Exception as e:
                self.send_response(500, str(e))
                self.end_headers()
        else:
            self.send_response(404, "Not Found")
            self.end_headers()
