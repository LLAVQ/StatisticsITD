# StatisticsITD (StatisticsИТД)

A powerful Tampermonkey userscript for **итд.com** (xn--d1ah4a.com) that injects a comprehensive analytics dashboard into any user profile. Track engagement, monitor growth, and visualize post performance through a draggable, interactive interface.

---

## ✨ Features

* **📊 Draggable Analytics Panel**: A sleek, dark-themed UI that follows you as you browse. Drag by the header to reposition and toggle visibility with a dedicated floating button.
* **📈 Growth Tracking**: Save "Snapshots" of account data to calculate percentage growth in followers and engagement over time.
* **📱 Content Deep-Dive**: Aggregates data from the last 50 posts, including:
* **Engagement Rate (ER)** calculation.
* **Management Metrics**: Average views per post and total interaction counts.
* **Post Ranking**: A sortable table identifying your top-performing content by views.


* **📉 Visual Charts**: Built-in canvas-based bar charts visualizing the distribution of Likes, Views, and Comments.
* **🛠 SPA Compatibility**: Works seamlessly with Single Page Application navigation—stats update automatically as you switch profiles.

---

## 🚀 Installation

1. **Install a Userscript Manager**: Download [Tampermonkey](https://www.tampermonkey.net/) for Chrome, Firefox, or Edge.
2. **Create New Script**:
* Open the Tampermonkey Dashboard.
* Click the **"+" (Add)** tab.
* Paste the code from `statistics-itd.user.js`.


3. **Save**: Press `Ctrl+S` or click **File > Save**.
4. **Visit**: Navigate to any profile on `итд.com` or `xn--d1ah4a.com`.

---

## 📖 How It Works

The script interacts with the site's public API to gather data without requiring your login credentials:

1. **Detection**: The script identifies the `@username` from the URL or page metadata.
2. **Data Fetching**: It queries the `/api/users/` and `/api/posts/` endpoints.
3. **Aggregation**: It calculates totals and averages across the fetched post sample.
4. **Rendering**: Data is injected into the draggable floating panel.

---

## 🛠 Usage

1. **Open a Profile**: Go to any user page (e.g., `https://итд.com/@username`).
2. **Toggle Stats**: Click the floating 📊 button in the bottom-right corner to open the panel.
3. **Analyze Growth**: Click **"Save Snapshot"**. The next time you visit, the script will show green/red percentage indicators comparing current stats to your saved data.
4. **Reposition**: Click and hold the header to move the window anywhere on your screen.

---

## 📜 License

This project is licensed under the **GNU GPLv3** - see the [LICENSE](https://www.gnu.org/licenses/gpl-3.0) file for details.

> **Note**: This script is for educational and personal analytical use. It uses public API endpoints provided by the platform.
