🚀 Protocol Desk

A powerful, minimal, and offline-first productivity app to manage projects, habits, analytics, and focus mode — all in one place.

---

📌 Overview

Protocol Desk is a lightweight web app designed to help you:

- Track daily & weekly habits
- Organize projects and activities
- Visualize productivity through analytics
- Stay focused using a distraction-free mode
- Store useful resources and wallet info
- Backup and restore your data anytime

Everything runs locally in your browser using "localStorage" — no login, no tracking.

---

✨ Features

📁 Projects & Activities

- Create unlimited projects
- Add activities with:
  - Daily or weekly frequency
  - Optional targets
- Drag & reorder projects
- Archive & restore projects

---

🔁 Habit Tracking

- Daily completion tracking
- Weekly goal tracking
- Streak calculation
- Missed day detection

---

📊 Analytics Dashboard

- Today & weekly completion %
- Per-project breakdown
- Interactive weekly chart
- Activity heatmap (last 84 days)
- Smart insights (AI-like logic)

---

🧠 Smart Insights

Automatically detects:

- Weak habits (<40%)
- Inconsistent habits
- Strong habits (≥80%)
- Missed streak breaks
- Overloaded projects

---

🎯 Focus Mode

- Shows only pending tasks
- One-tap completion
- Real-time progress bar

---

🔍 Search System

- Search projects
- Search resources
- Smart filtering in settings

---

📚 Resources Manager

- Save links with notes
- Quick access & deletion

---

💼 Wallet Manager

- Store addresses securely
- Copy with one click
- Clean UI display

---

💾 Backup & Restore

- Export data as JSON
- Import anytime
- Preserves:
  - Projects
  - Activities
  - History
  - Resources
  - Wallets

---

🧩 Advanced UI Features

- Drag & drop with smooth animation
- Long-press radial menu
- Toast notifications
- Animated insights
- Responsive design

---

🛠️ Tech Stack

- Vanilla JavaScript (ES6)
- HTML5 + CSS3
- Chart.js (for analytics)
- LocalStorage API

---

📂 Data Structure

Projects

{
  "name": "Project Name",
  "archived": false,
  "activities": [
    {
      "name": "Activity",
      "frequency": "daily | weekly",
      "target": 1,
      "history": {
        "2026-04-09": true
      }
    }
  ]
}

---

⚙️ Installation

1. Download or clone the project
2. Open "index.html" in your browser

That’s it. No setup required.

---

🔐 Security Note

When opening external links, use:

window.open(url, "_blank", "noopener,noreferrer");

This prevents security risks from new tabs.

---

📈 Future Improvements

- 🌐 Cloud sync (Firebase / Supabase)
- 📱 PWA (Install as app)
- 🤖 AI-powered insights
- 🔔 Notifications / reminders
- 🌙 Dark/light theme toggle

---

👨‍💻 Author

LESSSOUL 

Built as a full-feature productivity system using pure JavaScript.

---

📜 License

Free to use and modify for personal or educational purposes(but give me the credits)

---

💡 Final Note

This is not just a habit tracker —
it’s a complete personal productivity engine.

Stay consistent. Stay focused. 🚀
