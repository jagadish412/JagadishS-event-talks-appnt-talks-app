# BigQuery Release Notes Hub

A premium, interactive web dashboard built with **Python Flask** and **plain vanilla HTML, CSS, and JavaScript** that fetches, parses, parses and aggregates the official Google Cloud BigQuery release notes.

> [!NOTE]
> The application is completely self-contained and handles XML parsing, sub-item category extraction, local file caching, and real-time dashboard analytics out of the box without requiring bloated database dependencies.

---

## 🏗️ Project Architecture & File Locations

All application files are stored inside the project workspace directory. You can click on the links below to inspect them:

1. **Backend Server**: [app.py](file:///D:/Knowledge/TechFolder/AI_ML/Agentic_AI/Kaggle/GoogleIntensiveAICourse_2026/Antigravity_repo_1/app.py)
   - Configures the Flask routing, manages caches, and parses the Atom XML feed.
2. **HTML Layout**: [index.html](file:///D:/Knowledge/TechFolder/AI_ML/Agentic_AI/Kaggle/GoogleIntensiveAICourse_2026/Antigravity_repo_1/templates/index.html)
   - Defines the split-pane viewer, search/filter controls, and statistics metrics structure.
3. **Vanilla CSS Design**: [styles.css](file:///D:/Knowledge/TechFolder/AI_ML/Agentic_AI/Kaggle/GoogleIntensiveAICourse_2026/Antigravity_repo_1/static/css/styles.css)
   - Custom-tailored dark theme using glassmorphism, animated neon backgrounds, responsive configurations, and custom styled tables/code blocks.
4. **Vanilla JavaScript Client**: [main.js](file:///D:/Knowledge/TechFolder/AI_ML/Agentic_AI/Kaggle/GoogleIntensiveAICourse_2026/Antigravity_repo_1/static/js/main.js)
   - Implements clientside state, asynchronous AJAX fetching, real-time query filtering, local bookmarks synchronization, and sub-item tab selection.

---

## ⚡ Premium Features Implemented

The application implements a premium user experience with several advanced capabilities:

| Feature | Description | Implementation Details |
| :--- | :--- | :--- |
| **Atom Feed Parser** | Parses the feed using Python `xml.etree.ElementTree`. | Handled in `app.py`. Custom splitting isolates individual updates. |
| **Adaptive Caching** | Prevents rate limiting by saving cached copies. | Stores feed in-memory and caches in [feed_cache.json](file:///D:/Knowledge/TechFolder/AI_ML/Agentic_AI/Kaggle/GoogleIntensiveAICourse_2026/Antigravity_repo_1/feed_cache.json). Fallback active if offline. |
| **Glassmorphic Layout** | Premium visual interface with neon gradients. | Custom CSS variables, backdrop blur `backdrop-filter: blur(16px)`, and animation orbs. |
| **Dynamic Sub-Item Tabs** | Splits days containing multiple updates into interactive tabs. | JavaScript filters individual updates (e.g. June 15 has 1 Issue and 3 Features) into tabs. |
| **Category Breakdown** | Visual breakdown bar chart of update types. | Computes category metrics on server via `/api/stats` and renders using pure CSS. |
| **Bookmark Manager** | Star / Bookmark releases to view later. | Saved locally in browser `localStorage` and synchronized in sidebar. |
| **Fuzzy Search & Filters** | Real-time text search and category toggles. | Live filtering on typing or category badge click. |
| **Tweet Integration** | Share specific release updates directly on X/Twitter. | Launches Twitter Web Intent pre-populated with update category, date, text snippet, link, and hashtags. |
| **Print & Export Layout** | Dedicated layout for PDF and hardcopy printing. | Cleans up panels automatically using CSS `@media print` rules. |

---

## 🚀 How to Run the Application

Follow these steps to run the application locally on your machine:

### 1. Pre-requisites
Ensure you have Python 3 installed. The package requirements have already been installed in this environment (`Flask` and `requests`).

### 2. Launching the Flask Server
Navigate to the directory and run the application:
```powershell
# Run using the python interpreter
python app.py
```

### 3. Open in Browser
Once the server starts, open your web browser and navigate to:
```
http://127.0.0.1:5000/
```

---

## 📈 Technical Implementation Details

```mermaid
graph TD
    User([User Browser]) -->|Loads Page| Flask[Flask App]
    Flask -->|Checks Cache| Cache{Cache Valid?}
    Cache -->|Yes| ReadCache[Read feed_cache.json]
    Cache -->|No / Force Refresh| FetchFeed[Fetch from Google Feeds XML]
    FetchFeed -->|Parse & Clean| ParseXML[Atom Parser & Regex Segmenter]
    ParseXML -->|Write| WriteCache[Write feed_cache.json]
    ParseXML -->|Response| APIReleases[/api/releases]
    ReadCache -->|Response| APIReleases
    User -->|Fetch API JSON| APIReleases
    User -->|Fetch Stats JSON| APIStats[/api/stats]
```

### Feed Parsing & Content Splitting
Each Atom entry from Google is cataloged by date. However, single entries contain multiple update topics separated by `<h3>` tags (e.g., `<h3>Feature</h3>... <h3>Fix</h3>...`).
The Python server breaks these down using:
```python
parts = re.split(r'<h3[^>]*>(.*?)</h3>', content_html, flags=re.IGNORECASE | re.DOTALL)
```
This enables the frontend to represent them as separate item cards/tabs rather than rendering a giant unformatted block of HTML text.
