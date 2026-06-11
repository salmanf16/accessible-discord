# -*- coding: utf-8 -*-

addon_info = {
    "addon_name": "accessibleDiscord",
    "addon_summary": "Accessible Discord",
    "addon_description": "Announces voice channel events (join, leave, mute, deafen) and chat messages in Discord using a BetterDiscord companion plugin.",
    "addon_changelog": (
        "- Added customizable announcement templates for all features using simple shortcodes (%u, %c, %m, %s, %t).\n"
        "- Fixed a bug where streaming general application windows or Chrome would falsely announce background games.\n"
        "- Refactored the NVDA addon into a modular package structure for better organization and performance.\n"
        "- Added speech announcements when active voice channel members start/stop streaming (including game name if recognized).\n"
        "- Added speech notifications when members join or leave your own stream.\n"
        "- Added a dedicated Accessible Discord category in NVDA Settings dialog to easily configure all preferences.\n"
        "- Full localization support including Arabic and French translations."
    ),
    "addon_license": "GPL v3",
    "addon_licenseURL": "https://www.gnu.org/licenses/gpl-3.0.txt",
    "addon_author": "salmanf16",
    "addon_url": "https://github.com/salmanf16/accessible-discord",
    "addon_version": "1.0.2",
    "addon_minimumNVDAVersion": "2023.1",
    "addon_lastTestedNVDAVersion": "2026.1",
}
