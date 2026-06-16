# 🌌 Google BigQuery Release Notes Hub

A premium, interactive web application built with **Python Flask** and **plain vanilla HTML, CSS, and JavaScript** that fetches, segments, caches, and visualizes the official Google Cloud BigQuery release notes. 

The application is styled with a modern **glassmorphic dark theme** and includes advanced client-side utilities such as fuzzy keyword search, category tag filtering, bookmark favorites (saved in `localStorage`), and dynamic Twitter/X sharing.

---

## 🚀 Key Features

* **Sub-Item Segmented Reader**: Automatically splits daily releases containing multiple updates (e.g. 1 Fix, 2 Features) into distinct, interactive sub-tabs rather than rendering a giant block of unformatted text.
* **Double-Tier Caching Pipeline**: Caches the XML data in-memory (1-hour expiry) and writes a local JSON copy to `feed_cache.json` as an **offline fallback** to guarantee the dashboard remains fully functional even without an internet connection.
* **Insights Analytics**: Generates real-time CSS breakdown charts of category frequencies and release volumes across the timeline.
* **Bookmarks Favorites**: Star specific release notes to save them locally. Bookmarks persist across browser reloads via `localStorage`.
* **Fuzzy Text Search**: Instantly filter release titles, category tags, and raw article text.
* **Twitter/X Sharing Integration**: Select any specific release update, click the **Tweet** button, and share it on X/Twitter with a prefilled intent URL containing the update category, date, text snippet, link, and hashtags.
* **Print-Optimized**: Integrates custom CSS `@media print` rules to instantly clean up sidebars and menus for clean PDF export or printing.

---

## 📂 Project Directory Structure

```text
Antigravity_repo_1/
├── app.py                  # Flask server application (XML parsing & cache routes)
├── feed_cache.json         # Structured local cache of release notes data
├── .gitignore              # Specifies patterns for Git to ignore (caches, venvs, IDEs)
├── README.md               # Repository documentation (this file)
├── templates/
│   └── index.html          # Core HTML layout & dashboard controls structure
└── static/
    ├── css/
    │   └── styles.css      # Custom dark-theme glassmorphism rules & animations
    └── js/
        └── main.js         # Client-side state manager, AJAX, bookmarks, & events
```

---

## 🛠️ Local Installation & Run Guide

### 1. Prerequisites
Ensure you have Python 3.x installed. The required dependencies are `Flask` and `requests`.

### 2. Setup Dependencies
Install the required packages using pip:
```bash
pip install flask requests
```

### 3. Launch the Server
Run the Flask server script:
```bash
python app.py
```

### 4. Open the Interface
Open your web browser and navigate to:
```url
http://127.0.0.1:5000/
```

---

## 🔗 Backend API Routes

The backend in `app.py` exposes REST endpoints that return structured JSON data:

* **`GET /`**: Serves the main HTML interface.
* **`GET /api/releases`**: Returns parsed release entries.
  * *Query Parameter:* `?refresh=true` forces the server to bypass cache, download a fresh copy from Google, update the local cache, and return the latest data.
* **`GET /api/stats`**: Computes insights metrics (e.g. total dates, total updates, category volumes) for the dashboard charts.

---

## 🛠️ Tech Stack & Implementation details
* **Backend**: Python 3, Flask, XML ElementTree, Regex parsers.
* **Frontend**: Plain Vanilla HTML5, Vanilla JavaScript (ES6+), Vanilla CSS3.
* **Fonts**: Outfit (Headings), Inter (Body) imported from Google Fonts.
* **Icons**: Inline SVG vectors for zero external CDN dependencies and instant page load speeds.
