# -*- coding: utf-8 -*-

addon_info = {
    "addon_name": "accessibleDiscord",
    "addon_summary": "Accessible Discord",
    "addon_description": "Announces voice channel events (join, leave, mute, deafen) and chat messages in Discord using a BetterDiscord companion plugin.",
    "addon_changelog": (
        "- Switched voice state tracking to direct real-time Discord Flux events for immediate announcements.\n"
        "- Upgraded internal event server to ThreadingHTTPServer for high-concurrency non-blocking event processing.\n"
        "- Fixed BetterDiscord installer download progress UI with percentage updates in MBs and robust error cleanup.\n"
        "- Optimized companion plugin memory footprint and added fetch request timeout safeguards.\n"
        "- Full localization support including Arabic and French translations."
    ),
    "addon_license": "GPL v3",
    "addon_licenseURL": "https://www.gnu.org/licenses/gpl-3.0.txt",
    "addon_author": "salmanf16",
    "addon_url": "https://github.com/salmanf16/accessible-discord",
    "addon_version": "1.0.8",
    "addon_minimumNVDAVersion": "2023.1",
    "addon_lastTestedNVDAVersion": "2026.1",
}
