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
* **تخصيص كامل لنصوص التنبيهات**: يمكنك تغيير نطق التنبيهات بالكامل وتخصيصها باستخدام رموز بسيطة وسهلة.
* **تثبيت BetterDiscord بضغطة زر**: إذا لم يكن BetterDiscord مثبتاً لديك، ستجد خياراً في إعدادات الإضافة يقوم بتحميله وتثبيته لك تلقائياً وبسهولة تامة مع إظهار شريط تقدم ووقت متبقي للتحميل.

---

### تخصيص نصوص التنبيهات (Custom Templates)

تتيح لك الإضافة تخصيص طريقة نطق التنبيهات بالكامل لكل ميزة بشكل مستقل. عند الذهاب إلى إعدادات الإضافة واختيار **"مخصص" (Custom)** بدلاً من **"الافتراضي" (Default)**، سيظهر لك مربع نصي لكتابة القالب الخاص بك باستخدام الرموز التالية:

#### 📌 رموز التخصيص المتاحة:
* **`%u`** : اسم المستخدم (User)
* **`%c`** : اسم القناة الصوتية (Channel)
* **`%m`** : محتوى الرسالة النصية (Message)
* **`%s`** : الحالة الصوتية (State) - (مثل: muted أو unmuted أو deafened أو undeafened)
* **`%t`** : هدف البث (Target) - (مثل: اسم نافذة التطبيق أو اللعبة التي يتم بثها)

#### 💡 أمثلة على التخصيص:
1. **قالب انضمام للقناة**:
   - القالب: `%u دخل إلى %c`
   - النطق: *أحمد دخل إلى عامة*
2. **قالب الرسائل الواردة**:
   - القالب: `%u يقول %m`
   - النطق: *خالد يقول السلام عليكم*
3. **قالب كتم الصوت (Muted)**:
   - القالب: `%u قفل المايك`
   - النطق: *سعد قفل المايك*

> [!NOTE]
> إذا اخترت **"الافتراضي" (Default)** لأي ميزة، سيتم مسح قالبك المخصص وإرجاع النطق الافتراضي للإضافة وإخفاء مربع الكتابة تلقائياً.

---

### خطوات تثبيت BetterDiscord بالتفصيل

إذا قمت بالضغط على زر **"تثبيت BetterDiscord"** من داخل إعدادات الإضافة، سيتم تحميل المثبت وتشغيله تلقائياً. اتبع الخطوات التالية لإتمام التثبيت:

1. **الموافقة على الشروط**: عند فتح مثبت BetterDiscord، حدد خيار الموافقة **"I accept the license agreement"** ثم اضغط على زر **Next** (التالي).
2. **تحديد نوع الإجراء**: ستظهر لك خيارات. حدد الخيار الأول **"Install BetterDiscord"** ثم اضغط على زر **Next** (التالي).
3. **اختيار نسخة ديسكورد**: سيقوم المثبت بعرض نُسخ ديسكورد المثبتة لديك. اضغط على النسخة التي تستخدمها لتحديدها (عادةً تكون النسخة العادية الأولى **Discord Stable**)، ثم اضغط على زر **Install** (تثبيت).
4. **انتظار التثبيت**: سيقوم البرنامج بتعديل ديسكورد ثم إعادة تشغيل تطبيق ديسكورد تلقائياً. عند اكتمال التثبيت، ستظهر لك رسالة نجاح؛ اضغط على زر **Close** لإغلاق المثبت.
5. **تفعيل الملحق المساعد**: بمجرد فتح ديسكورد مجدداً، اذهب إلى **إعدادات المستخدم (User Settings)**، ثم انزل في القائمة الجانبية لقسم **BetterDiscord**، واضغط على **Plugins**، وقم بتفعيل الملحق المساعد **AccessibleDiscord** عن طريق تشغيل زر التبديل الخاص به.

---

### كيف أثبت الإضافة؟

1. حمل ملف الإضافة `accessible_discord.nvda-addon`.
2. اضغط عليه مرتين لتبدأ عملية التثبيت والموافقة عليها.
3. أعد تشغيل برنامج NVDA.
4. **تثبيت الملحق المساعد (تلقائي)**: عند تشغيل NVDA، ستقوم الإضافة تلقائياً بالتعرف على مجلد BetterDiscord ونسخ ملف الملحق المساعد (`AccessibleDiscord.plugin.js`) إليه دون أي تدخل منك. كما تقوم الإضافة بمقارنة حجم الملف تلقائياً لنسخ أي تحديثات جديدة للملحق فور صدورها.

---

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
* **Custom speech templates**: Fully customize announcement speech formatting for each event independently using easy-to-remember shortcodes.
* **One-Click BetterDiscord Installer**: An easy installer button under settings to download and launch the BetterDiscord installer with a real-time progress bar and remaining time display.

---

### Custom Announcement Templates

You can customize the text spoken for each feature. Go to NVDA Settings -> Accessible Discord, and change the dropdown mode for any feature from **"Default"** to **"Custom"** to reveal the customization text field. You can use the following shortcodes:

#### 📌 Available Shortcodes:
* **`%u`** : User name
* **`%c`** : Voice channel name
* **`%m`** : Text message content
* **`%s`** : Voice state (e.g. `muted`, `unmuted`, `deafened`, `undeafened`)
* **`%t`** : Stream target (e.g. name of the shared application window)

#### 💡 Examples:
1. **Join channel template**:
   - Template: `%u entered %c`
   - Spoken as: *John entered General*
2. **Incoming message template**:
   - Template: `%u says %m`
   - Spoken as: *John says Hello world*
3. **Mute template (Muted)**:
   - Template: `%u is silent`
   - Spoken as: *John is silent*

> [!NOTE]
> Setting any feature back to **"Default"** will delete your custom template, restore the addon's original speech format, and hide the text input field automatically.

---

### Step-by-Step BetterDiscord Installation Guide

If you click the **"Install BetterDiscord"** button in settings, the addon will download and launch the official installer. Follow these steps:

1. **Accept Terms**: Once the installer opens, check **"I accept the license agreement"** and click **Next**.
2. **Choose Action**: Choose **"Install BetterDiscord"** and click **Next**.
3. **Select Discord Version**: The installer will show your detected Discord builds. Click on your active build (usually **Discord Stable**, the first one) to select it, then click **Install**.
4. **Wait & Complete**: The installer will patch Discord and restart your Discord client. Click **Close** when the success screen appears.
5. **Enable Plugin**: In Discord, go to **User Settings**, scroll down to the **BetterDiscord** section in the sidebar, click on **Plugins**, and turn the switch for **AccessibleDiscord** to **ON**.

---

### Installation

1. Download the `accessible_discord.nvda-addon` file.
2. Double-click to install it and restart NVDA.
3. **Auto-Deploy & Sync Plugin**: When NVDA loads, the add-on will **automatically copy** the BetterDiscord companion plugin (`AccessibleDiscord.plugin.js`) into your BetterDiscord plugins folder. It also monitors file size differences to ensure the companion plugin updates automatically when a new addon version is installed.

---

### Developer
* Author: **salmanf16**
* Email: [salman2222222222f16@gmail.com](mailto:salman2222222222f16@gmail.com)
