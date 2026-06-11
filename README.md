# Accessible Discord 🎮

[العربية](#العربية) | [English](#english)

---

## العربية

إضافة لقارئ الشاشة NVDA مصممة لمساعدة المستخدمين المكفوفين وضِعاف البصر في متابعة ديسكورد بكل سهولة ويسر. تقوم الإضافة بنطق حركات القنوات الصوتية (انضمام ومغادرة الأعضاء، كتم وإلغاء كتم الميكروفون، وتعطيل وتفعيل السمع) ونطق الرسائل النصية الجديدة فوراً في الخلفية أو الواجهة.

> [!IMPORTANT]
> **تنبيه هام جداً:** تتطلب هذه الإضافة تثبيت برنامج المساعد **BetterDiscord** في تطبيق ديسكورد لكي تعمل بالشكل الصحيح.

### وش المميزات الرهيبة فيها؟

* **نطق أحداث القنوات الصوتية تلقائياً**: ينطق لك عند دخول أو خروج أي شخص من قناتك الصوتية الحالية.
* **تحديثات حالة الصوت**: ينطق عند كتم الميكروفون (Mute) أو إلغاء الكتم، أو تعطيل السمع (Deafen) وتفعيله لأي شخص معك في القناة.
* **نطق الرسائل النصية الجديدة**: يقرأ لك الرسائل النصية الجديدة في القناة المفتوحة حالياً فور وصولها دون الحاجة للانتقال إليها.
* **تحديد لغة النطق تلقائياً**: تتطابق لغة نطق التنبيهات تلقائياً مع لغة تطبيق ديسكورد المفتوح (عربي أو إنجليزي) لتوفير أفضل تجربة استخدام.
* **خيار النطق بالخلفية فقط**: يمكنك تفعيل هذا الخيار لكي تنطق الإضافة التنبيهات فقط عندما يكون ديسكورد في الخلفية، لكي لا يتم تكرار النطق أثناء تصفحك للديسكورد.
* **تثبيت BetterDiscord بضغطة زر**: إذا لم يكن BetterDiscord مثبتاً لديك، ستجد خياراً في إعدادات الإضافة يقوم بتحميله وتثبيته لك تلقائياً وبسهولة تامة مع إظهار شريط تقدم ووقت متبقي للتحميل.

### كيف أثبت الإضافة؟

1. حمل ملف الإضافة `accessible_discord.nvda-addon`.
2. اضغط عليه مرتين لتبدأ عملية التثبيت والموافقة عليها.
3. أعد تشغيل برنامج NVDA.
4. **تثبيت الملحق المساعد (تلقائي)**: عند تشغيل NVDA، ستقوم الإضافة تلقائياً بالتعرف على مجلد BetterDiscord ونسخ ملف الملحق المساعد (`AccessibleDiscord.plugin.js`) إليه دون أي تدخل منك.
5. تأكد من تفعيل الملحق المساعد من داخل إعدادات ديسكورد (BetterDiscord -> Plugins -> قم بتفعيل AccessibleDiscord).

> [!TIP]
> إذا لم يكن BetterDiscord مثبتاً لديك، يمكنك الذهاب إلى قائمة NVDA -> تفضيلات -> إعدادات -> Accessible Discord واختيار **تثبيت BetterDiscord المساعد (تلقائي)**.

### المطور
* المطور: **salmanf16**
* البريد الإلكتروني: [salman2222222222f16@gmail.com](mailto:salman2222222222f16@gmail.com)

---

## English

An NVDA screen reader add-on designed to assist blind and visually impaired users in tracking Discord events seamlessly. It automatically announces voice channel actions (member joins/leaves, mute/unmute toggles, deafen/undeafen status) and new text chat messages instantly in the background or foreground.

> [!IMPORTANT]
> **CRITICAL REQUIREMENT:** This add-on **requires BetterDiscord** installed in your Discord client in order to function.

### Key Features

* **Voice Channel Notifications**: Announces when users join or leave your active voice channel.
* **Voice State Updates**: Speaks when members mute/unmute their microphone or deafen/undeafen their audio.
* **Text Message Announcements**: Reads incoming text messages in the active channel/DM instantly.
* **Automatic Language Matching**: Matches the speech language (Arabic/English) automatically with Discord's active client language.
* **Background Only Mode**: Option to suppress announcements when you are actively viewing Discord.
* **One-Click BetterDiscord Installer**: An easy installer button under settings to download and launch the BetterDiscord installer with a real-time progress bar and remaining time display.

### Installation

1. Download the `accessible_discord.nvda-addon` file.
2. Double-click to install it and restart NVDA.
3. **Auto-Deploy Plugin**: When NVDA loads, the add-on will **automatically copy** the BetterDiscord companion plugin (`AccessibleDiscord.plugin.js`) into your BetterDiscord plugins folder.
4. Enable the plugin inside Discord Settings -> Plugins -> Toggle **AccessibleDiscord** ON.

### Developer
* Author: **salmanf16**
* Email: [salman2222222222f16@gmail.com](mailto:salman2222222222f16@gmail.com)
