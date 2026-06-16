// State Management
let appState = {
    feedTitle: "BigQuery Release Notes",
    entries: [],
    filteredEntries: [],
    selectedEntry: null,
    selectedItemIndex: 0,
    searchTerm: "",
    selectedCategory: null,
    showBookmarkedOnly: false,
    bookmarks: [],
    stats: null
};

// DOM Elements
const DOM = {
    refreshBtn: document.getElementById('refreshBtn'),
    feedStatus: document.getElementById('feedStatus'),
    statDays: document.getElementById('statDays'),
    statUpdates: document.getElementById('statUpdates'),
    categoryBreakdown: document.getElementById('categoryBreakdown'),
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    categoryFilters: document.getElementById('categoryFilters'),
    bookmarkToggle: document.getElementById('bookmarkToggle'),
    bookmarkCount: document.getElementById('bookmarkCount'),
    bookmarksSection: document.getElementById('bookmarksSection'),
    bookmarksList: document.getElementById('bookmarksList'),
    clearAllBookmarks: document.getElementById('clearAllBookmarks'),
    timelineContainer: document.getElementById('timelineContainer'),
    timelineMeta: document.getElementById('timelineMeta'),
    readerIdle: document.getElementById('readerIdle'),
    readerActive: document.getElementById('readerActive'),
    readerDate: document.getElementById('readerDate'),
    readerTitle: document.getElementById('readerTitle'),
    bookmarkBtn: document.getElementById('bookmarkBtn'),
    externalLinkBtn: document.getElementById('externalLinkBtn'),
    tweetBtn: document.getElementById('tweetBtn'),
    printBtn: document.getElementById('printBtn'),
    refreshDetailsBtn: document.getElementById('refreshDetailsBtn'),
    entryItemsTabs: document.getElementById('entryItemsTabs'),
    releaseArticle: document.getElementById('releaseArticle'),
    mobileShowTimeline: document.getElementById('mobileShowTimeline'),
    mobileShowReader: document.getElementById('mobileShowReader'),
    appContainer: document.querySelector('.app-container')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    loadBookmarks();
    initEventListeners();
    fetchFeedData();
});

// Load Bookmarks from LocalStorage
function loadBookmarks() {
    try {
        const saved = localStorage.getItem('bq_release_bookmarks');
        appState.bookmarks = saved ? JSON.parse(saved) : [];
        updateBookmarksUI();
    } catch (e) {
        console.error("Failed to load bookmarks", e);
        appState.bookmarks = [];
    }
}

// Save Bookmarks to LocalStorage
function saveBookmarks() {
    try {
        localStorage.setItem('bq_release_bookmarks', JSON.stringify(appState.bookmarks));
        updateBookmarksUI();
        // If we are currently showing bookmarked only, we need to filter and re-render
        if (appState.showBookmarkedOnly) {
            filterEntries();
        }
    } catch (e) {
        console.error("Failed to save bookmarks", e);
    }
}

// Update Bookmarks Sidebar list and Counter
function updateBookmarksUI() {
    const count = appState.bookmarks.length;
    DOM.bookmarkCount.textContent = count;
    
    if (count === 0) {
        DOM.bookmarksSection.style.display = 'none';
        return;
    }
    
    DOM.bookmarksSection.style.display = 'block';
    DOM.bookmarksList.innerHTML = '';
    
    appState.bookmarks.forEach(bookmark => {
        const li = document.createElement('li');
        
        // Find the title/date of this bookmarked item if loaded
        const entry = appState.entries.find(e => e.id === bookmark.id);
        const titleText = entry ? entry.title : bookmark.date;
        const mainCat = bookmark.category || 'Release';
        
        li.innerHTML = `
            <button class="bookmark-item-btn" data-id="${bookmark.id}">
                <span class="bookmark-item-date">${titleText}</span>
                <span class="badge badge-${mainCat.toLowerCase()}">${mainCat}</span>
            </button>
        `;
        
        li.querySelector('button').addEventListener('click', () => {
            selectEntryById(bookmark.id);
            // On mobile, automatically show details
            switchToMobileReader();
        });
        
        DOM.bookmarksList.appendChild(li);
    });
}

// Event Listeners Registration
function initEventListeners() {
    // Refresh Button Click
    DOM.refreshBtn.addEventListener('click', () => {
        fetchFeedData(true);
    });
    
    // Search Bar Input
    DOM.searchInput.addEventListener('input', (e) => {
        appState.searchTerm = e.target.value.toLowerCase().trim();
        DOM.clearSearchBtn.style.display = appState.searchTerm ? 'block' : 'none';
        filterEntries();
    });
    
    // Clear Search Input
    DOM.clearSearchBtn.addEventListener('click', () => {
        DOM.searchInput.value = "";
        appState.searchTerm = "";
        DOM.clearSearchBtn.style.display = 'none';
        filterEntries();
        DOM.searchInput.focus();
    });
    
    // Bookmark Toggle Checkbox
    DOM.bookmarkToggle.addEventListener('change', (e) => {
        appState.showBookmarkedOnly = e.target.checked;
        filterEntries();
    });
    
    // Clear All Bookmarks
    DOM.clearAllBookmarks.addEventListener('click', () => {
        if (confirm("Are you sure you want to clear all starred releases?")) {
            appState.bookmarks = [];
            saveBookmarks();
            // Update active reader bookmark button if active
            updateReaderBookmarkBtn();
            // Re-render timeline to remove star indicators
            renderTimeline();
        }
    });
    
    // Active Reader Actions
    DOM.bookmarkBtn.addEventListener('click', toggleCurrentBookmark);
    DOM.printBtn.addEventListener('click', () => window.print());
    
    // Refresh Details button click
    DOM.refreshDetailsBtn.addEventListener('click', async () => {
        DOM.refreshDetailsBtn.classList.add('loading');
        
        const currentEntryId = appState.selectedEntry ? appState.selectedEntry.id : null;
        const currentItemIndex = appState.selectedItemIndex;
        
        try {
            await fetchFeedData(true);
            
            if (currentEntryId) {
                const updatedEntry = appState.entries.find(e => e.id === currentEntryId);
                if (updatedEntry) {
                    appState.selectedEntry = updatedEntry;
                    appState.selectedItemIndex = Math.min(currentItemIndex, updatedEntry.items.length - 1);
                    renderReaderPane();
                }
            }
        } catch (e) {
            console.error("Failed to refresh details", e);
        } finally {
            DOM.refreshDetailsBtn.classList.remove('loading');
        }
    });
    
    // Mobile Navigation Button Handlers
    DOM.mobileShowTimeline.addEventListener('click', () => {
        document.body.classList.remove('show-reader');
        DOM.mobileShowTimeline.classList.add('active');
        DOM.mobileShowReader.classList.remove('active');
    });
    
    DOM.mobileShowReader.addEventListener('click', () => {
        document.body.classList.add('show-reader');
        DOM.mobileShowTimeline.classList.remove('active');
        DOM.mobileShowReader.classList.add('active');
    });
}

function switchToMobileReader() {
    document.body.classList.add('show-reader');
    DOM.mobileShowTimeline.classList.remove('active');
    DOM.mobileShowReader.classList.add('active');
}

// API Calls: Fetch feed and parse details
async function fetchFeedData(forceRefresh = false) {
    // Show Loading Spin & skeleton
    DOM.refreshBtn.classList.add('loading');
    showTimelineLoadingSkeleton();
    updateStatusIndicator('connecting', 'Connecting to server...');
    
    const url = forceRefresh ? '/api/releases?refresh=true' : '/api/releases';
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        
        const res = await response.json();
        
        if (res.status === 'success') {
            appState.entries = res.data.entries;
            appState.feedTitle = res.data.title;
            
            // Update status indicator
            const sourceText = res.source === 'live' ? 'Connected (Live)' : 
                             res.source === 'cache' ? 'Cached' : 
                             res.source === 'fallback_cache' ? 'Offline Fallback' : 'Connected';
            updateStatusIndicator(res.source, sourceText);
            
            // Extract dynamic categories to generate filter badges
            generateCategoryFilterBadges();
            
            // Run filters to initial state
            filterEntries();
            
            // Load statistics
            fetchStats();
        } else {
            throw new Error(res.message || 'Unknown server error');
        }
    } catch (e) {
        console.error("Failed to load release notes", e);
        updateStatusIndicator('error', 'Error loading feed');
        showTimelineErrorState(e.message);
    } finally {
        DOM.refreshBtn.classList.remove('loading');
    }
}

// API Calls: Fetch statistics
async function fetchStats() {
    try {
        const response = await fetch('/api/stats');
        if (!response.ok) throw new Error("Stats fetch failed");
        
        const res = await response.json();
        if (res.status === 'success') {
            appState.stats = res.stats;
            renderStatsDashboard();
        }
    } catch (e) {
        console.error("Failed to load statistics", e);
        DOM.categoryBreakdown.innerHTML = '<div class="breakdown-loading">Stats unavailable</div>';
    }
}

// Render Stats Section
function renderStatsDashboard() {
    if (!appState.stats) return;
    
    DOM.statDays.textContent = appState.stats.total_releases_days;
    DOM.statUpdates.textContent = appState.stats.total_individual_updates;
    
    // Render horizontal breakdown progress bars
    DOM.categoryBreakdown.innerHTML = '';
    
    const categories = appState.stats.categories;
    const sortedCats = Object.entries(categories).sort((a, b) => b[1] - a[1]);
    
    // Find max value for percentages
    const maxVal = sortedCats.length > 0 ? sortedCats[0][1] : 1;
    
    sortedCats.forEach(([cat, count]) => {
        const pct = (count / maxVal) * 100;
        
        const barWrapper = document.createElement('div');
        barWrapper.className = 'category-bar-wrapper';
        
        // Match category to colors
        const catClass = cat.toLowerCase();
        let bgStyle = 'var(--color-general)';
        if (catClass === 'feature') bgStyle = 'var(--grad-feature)';
        else if (catClass === 'fix') bgStyle = 'var(--grad-fix)';
        else if (catClass === 'issue' || catClass === 'deprecation') bgStyle = 'var(--grad-issue)';
        else if (catClass === 'change') bgStyle = 'var(--grad-change)';
        
        barWrapper.innerHTML = `
            <div class="category-bar-label">
                <span>${cat}</span>
                <strong>${count}</strong>
            </div>
            <div class="category-bar-container">
                <div class="category-bar-fill" style="width: 0%; background: ${bgStyle}"></div>
            </div>
        `;
        
        DOM.categoryBreakdown.appendChild(barWrapper);
        
        // Trigger animation
        setTimeout(() => {
            const fill = barWrapper.querySelector('.category-bar-fill');
            if (fill) fill.style.width = `${pct}%`;
        }, 100);
    });
}

// Generate Category Badge buttons inside Filter widget
function generateCategoryFilterBadges() {
    // Extract unique categories from feed entries
    const catsSet = new Set();
    appState.entries.forEach(entry => {
        entry.items.forEach(item => {
            if (item.category) catsSet.add(item.category);
        });
    });
    
    DOM.categoryFilters.innerHTML = '';
    
    // Add "All" badge button
    const allBtn = document.createElement('button');
    allBtn.className = `filter-badge-btn ${appState.selectedCategory === null ? 'active' : ''}`;
    allBtn.textContent = 'All';
    allBtn.addEventListener('click', () => {
        toggleCategoryFilter(null);
    });
    DOM.categoryFilters.appendChild(allBtn);
    
    // Add dynamic buttons
    Array.from(catsSet).sort().forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `filter-badge-btn ${appState.selectedCategory === cat ? 'active' : ''}`;
        btn.textContent = cat;
        btn.addEventListener('click', () => {
            toggleCategoryFilter(cat);
        });
        DOM.categoryFilters.appendChild(btn);
    });
}

// Toggle status indicators
function updateStatusIndicator(source, text) {
    // Remove all classes
    DOM.feedStatus.querySelector('.status-indicator').className = 'status-indicator';
    
    let indicatorClass = 'status-unknown';
    if (source === 'live') indicatorClass = 'status-live';
    else if (source === 'cache') indicatorClass = 'status-cache';
    else if (source === 'fallback_cache') indicatorClass = 'status-fallback';
    else if (source === 'error') indicatorClass = 'status-error';
    
    DOM.feedStatus.querySelector('.status-indicator').classList.add(indicatorClass);
    DOM.feedStatus.querySelector('.status-text').textContent = text;
}

// Toggle category active state
function toggleCategoryFilter(category) {
    appState.selectedCategory = category;
    
    // Update badge active classes
    const buttons = DOM.categoryFilters.querySelectorAll('.filter-badge-btn');
    buttons.forEach(btn => {
        if (category === null && btn.textContent === 'All') {
            btn.classList.add('active');
        } else if (btn.textContent === category) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    filterEntries();
}

// Filters logic: Search keywords, categories, and bookmarks
function filterEntries() {
    appState.filteredEntries = appState.entries.filter(entry => {
        // 1. Bookmark Check
        if (appState.showBookmarkedOnly) {
            const isBookmarked = appState.bookmarks.some(b => b.id === entry.id);
            if (!isBookmarked) return false;
        }
        
        // 2. Category Check
        if (appState.selectedCategory) {
            const hasCategory = entry.items.some(item => item.category === appState.selectedCategory);
            if (!hasCategory) return false;
        }
        
        // 3. Search Term Check
        if (appState.searchTerm) {
            const matchesTitle = entry.title.toLowerCase().includes(appState.searchTerm);
            const matchesItems = entry.items.some(item => 
                item.category.toLowerCase().includes(appState.searchTerm) || 
                item.text.toLowerCase().includes(appState.searchTerm)
            );
            
            if (!matchesTitle && !matchesItems) return false;
        }
        
        return true;
    });
    
    // Update Subtitle Meta
    DOM.timelineMeta.textContent = `Showing ${appState.filteredEntries.length} of ${appState.entries.length} dates`;
    
    renderTimeline();
}

// Loading indicator skeleton HTML helper
function showTimelineLoadingSkeleton() {
    DOM.timelineContainer.innerHTML = `
        <div class="skeleton-list">
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
        </div>
    `;
}

// Error state HTML helper
function showTimelineErrorState(message) {
    DOM.timelineContainer.innerHTML = `
        <div class="timeline-empty">
            <svg class="empty-icon" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <h3>Feed Connection Failed</h3>
            <p>${message || 'Could not fetch BigQuery release notes feed from server. Please check connection and try again.'}</p>
            <button class="action-btn" onclick="fetchFeedData(true)">Retry Fetch</button>
        </div>
    `;
}

// Render Timeline List view
function renderTimeline() {
    DOM.timelineContainer.innerHTML = '';
    
    if (appState.filteredEntries.length === 0) {
        DOM.timelineContainer.innerHTML = `
            <div class="timeline-empty">
                <svg class="empty-icon" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M9.5 3A6.5 6.5 0 0116 9.5c0 1.61-.59 3.09-1.57 4.23l4.99 5L18 20.19l-4.99-5A6.5 6.5 0 119.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14 14 12 14 9.5 12 5 9.5 5z"/>
                </svg>
                <h3>No Release Notes Found</h3>
                <p>Try modifying your search text, clearing category tags, or disabling bookmarked-only filter.</p>
            </div>
        `;
        return;
    }
    
    appState.filteredEntries.forEach(entry => {
        const card = document.createElement('div');
        
        // Bookmarked state class
        const isBookmarked = appState.bookmarks.some(b => b.id === entry.id);
        
        card.className = `release-card ${appState.selectedEntry && appState.selectedEntry.id === entry.id ? 'active' : ''} ${isBookmarked ? 'bookmarked' : ''}`;
        card.setAttribute('data-id', entry.id);
        
        // Count category badges for card representation
        let badgeHTML = '';
        Object.entries(entry.categories_count).forEach(([cat, count]) => {
            const lowCat = cat.toLowerCase();
            badgeHTML += `<span class="badge badge-${lowCat}">${cat}${count > 1 ? ` (x${count})` : ''}</span>`;
        });
        
        // Snippet preview (First 110 characters of the first item text)
        const firstItem = entry.items[0];
        const snippetText = firstItem ? firstItem.text : "No preview available.";
        
        card.innerHTML = `
            <div class="release-card-header">
                <span class="release-card-date">${entry.title}</span>
                <svg class="release-card-star icon" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                </svg>
            </div>
            <h4 class="release-card-title">${entry.title} Updates</h4>
            <p class="release-card-snippet">${snippetText}</p>
            <div class="release-card-badges">
                ${badgeHTML}
            </div>
        `;
        
        card.addEventListener('click', () => {
            selectEntry(entry);
        });
        
        DOM.timelineContainer.appendChild(card);
    });
}

// Select an Entry and update details pane
function selectEntry(entry) {
    appState.selectedEntry = entry;
    appState.selectedItemIndex = 0;
    
    // Update active class in list UI
    const cards = DOM.timelineContainer.querySelectorAll('.release-card');
    cards.forEach(card => {
        if (card.getAttribute('data-id') === entry.id) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });
    
    renderReaderPane();
}

// Select Entry by its ID (used for sidebar bookmark clicks)
function selectEntryById(id) {
    const entry = appState.entries.find(e => e.id === id);
    if (entry) {
        selectEntry(entry);
        
        // Scroll list item into view if exists in timeline panel
        setTimeout(() => {
            const activeCard = DOM.timelineContainer.querySelector(`.release-card.active`);
            if (activeCard) {
                activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 100);
    }
}

// Render the Detail Reading Panel
function renderReaderPane() {
    if (!appState.selectedEntry) {
        DOM.readerIdle.style.display = 'flex';
        DOM.readerActive.style.display = 'none';
        return;
    }
    
    DOM.readerIdle.style.display = 'none';
    DOM.readerActive.style.display = 'flex';
    
    const entry = appState.selectedEntry;
    
    // Date & title
    DOM.readerDate.textContent = entry.title;
    DOM.readerTitle.textContent = `${entry.title} release details`;
    
    // Link button
    if (entry.link) {
        DOM.externalLinkBtn.setAttribute('href', entry.link);
        DOM.externalLinkBtn.style.display = 'flex';
    } else {
        DOM.externalLinkBtn.style.display = 'none';
    }
    
    // Update Bookmark Button state
    updateReaderBookmarkBtn();
    
    // Render sub-items tabs if there are multiple items
    DOM.entryItemsTabs.innerHTML = '';
    if (entry.items.length > 1) {
        DOM.entryItemsTabs.style.display = 'flex';
        entry.items.forEach((item, idx) => {
            const tabBtn = document.createElement('button');
            tabBtn.className = `tab-btn ${idx === appState.selectedItemIndex ? 'active' : ''}`;
            tabBtn.setAttribute('data-category', item.category);
            
            // Icon or indicator color based on category
            const catClass = item.category.toLowerCase();
            let dotColor = 'var(--color-general)';
            if (catClass === 'feature') dotColor = 'var(--color-feature)';
            else if (catClass === 'fix') dotColor = 'var(--color-fix)';
            else if (catClass === 'issue' || catClass === 'deprecation') dotColor = 'var(--color-issue)';
            else if (catClass === 'change') dotColor = 'var(--color-change)';
            
            tabBtn.innerHTML = `
                <span class="status-indicator" style="background-color: ${dotColor}; width: 6px; height: 6px;"></span>
                <span>Update ${idx + 1}: ${item.category}</span>
            `;
            
            tabBtn.addEventListener('click', () => {
                appState.selectedItemIndex = idx;
                
                // Set active tab class
                DOM.entryItemsTabs.querySelectorAll('.tab-btn').forEach((btn, bIdx) => {
                    if (bIdx === idx) btn.classList.add('active');
                    else btn.classList.remove('active');
                });
                
                renderActiveArticle();
            });
            DOM.entryItemsTabs.appendChild(tabBtn);
        });
    } else {
        DOM.entryItemsTabs.style.display = 'none';
    }
    
    renderActiveArticle();
}

// Render the actual HTML of the selected item inside reading pane
function renderActiveArticle() {
    const entry = appState.selectedEntry;
    const item = entry.items[appState.selectedItemIndex];
    
    if (!item) {
        DOM.releaseArticle.innerHTML = '<p>No content available.</p>';
        return;
    }
    
    // Add category prefix element dynamically
    const catClass = item.category.toLowerCase();
    let badgeClass = 'badge-general';
    if (catClass === 'feature') badgeClass = 'badge-feature';
    else if (catClass === 'fix') badgeClass = 'badge-fix';
    else if (catClass === 'issue') badgeClass = 'badge-issue';
    else if (catClass === 'deprecation') badgeClass = 'badge-deprecation';
    else if (catClass === 'change') badgeClass = 'badge-change';
    
    // We inject HTML directly as the release feed's HTML content is curated and safe
    DOM.releaseArticle.innerHTML = `
        <h3>
            <span class="badge ${badgeClass}" style="font-size: 0.9rem; padding: 4px 12px; border-radius: 8px;">
                ${item.category}
            </span>
        </h3>
        <div class="html-container">
            ${item.html}
        </div>
    `;
    
    // Update Tweet button link for the specific selected update item
    if (DOM.tweetBtn) {
        const dateText = entry.title;
        const categoryText = item.category;
        let snippetText = item.text || "";
        if (snippetText.length > 150) {
            snippetText = snippetText.substring(0, 147) + "...";
        }
        const tweetText = `Google BigQuery [${categoryText}] (${dateText}): "${snippetText}"`;
        const tweetUrl = entry.link || "https://cloud.google.com/bigquery/docs/release-notes";
        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(tweetUrl)}&hashtags=BigQuery,GoogleCloud`;
        DOM.tweetBtn.setAttribute('href', shareUrl);
    }
    
    // Enhance code blocks and links targets
    enhanceArticleContent();
}

// Add copy buttons to code blocks, and force links to open in new tab
function enhanceArticleContent() {
    const article = DOM.releaseArticle;
    
    // 1. Force external links to open in a new tab
    const links = article.querySelectorAll('a');
    links.forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
    });
    
    // 2. Wrap block codes and add syntax highlight styles
    // Find pre code tags and make sure they are styled properly
}

// Bookmark management functions
function updateReaderBookmarkBtn() {
    const isBookmarked = appState.bookmarks.some(b => b.id === appState.selectedEntry.id);
    if (isBookmarked) {
        DOM.bookmarkBtn.classList.add('active');
        DOM.bookmarkBtn.querySelector('.action-btn-text').textContent = 'Starred';
    } else {
        DOM.bookmarkBtn.classList.remove('active');
        DOM.bookmarkBtn.querySelector('.action-btn-text').textContent = 'Star';
    }
}

function toggleCurrentBookmark() {
    if (!appState.selectedEntry) return;
    
    const entry = appState.selectedEntry;
    const index = appState.bookmarks.findIndex(b => b.id === entry.id);
    
    if (index > -1) {
        // Remove bookmark
        appState.bookmarks.splice(index, 1);
        DOM.bookmarkBtn.classList.remove('active');
        DOM.bookmarkBtn.querySelector('.action-btn-text').textContent = 'Star';
        
        // Remove class from card
        const card = DOM.timelineContainer.querySelector(`.release-card[data-id="${entry.id}"]`);
        if (card) card.classList.remove('bookmarked');
    } else {
        // Add bookmark
        // Pick primary category to show in bookmarks list
        const primaryCat = entry.items[0] ? entry.items[0].category : 'Release';
        
        appState.bookmarks.push({
            id: entry.id,
            date: entry.title,
            category: primaryCat
        });
        DOM.bookmarkBtn.classList.add('active');
        DOM.bookmarkBtn.querySelector('.action-btn-text').textContent = 'Starred';
        
        // Add class to card
        const card = DOM.timelineContainer.querySelector(`.release-card[data-id="${entry.id}"]`);
        if (card) card.classList.add('bookmarked');
    }
    
    saveBookmarks();
}
