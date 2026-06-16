from flask import Flask, jsonify, render_template, request
import urllib.request
import xml.etree.ElementTree as ET
import re
import os
import json
import time
from datetime import datetime

app = Flask(__name__)

CACHE_FILE = 'feed_cache.json'
CACHE_EXPIRY = 3600  # 1 hour in seconds

def clean_html_text(html_str):
    # Strip HTML tags
    clean = re.sub(r'<[^>]+>', ' ', html_str)
    # Remove extra whitespaces
    clean = re.sub(r'\s+', ' ', clean)
    return clean.strip()

def parse_entry_content(content_html):
    if not content_html:
        return []
    
    # Split content by <h3> headers
    parts = re.split(r'<h3[^>]*>(.*?)</h3>', content_html, flags=re.IGNORECASE | re.DOTALL)
    
    items = []
    # Content before any <h3>
    first_part = parts[0].strip()
    if first_part and len(first_part) > 10:
        items.append({
            'category': 'General',
            'html': first_part,
            'text': clean_html_text(first_part)
        })
        
    for i in range(1, len(parts), 2):
        category = parts[i].strip()
        html_content = parts[i+1].strip() if i+1 < len(parts) else ""
        
        items.append({
            'category': category,
            'html': html_content,
            'text': clean_html_text(html_content)
        })
        
    return items

def fetch_feed_xml():
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    )
    with urllib.request.urlopen(req, timeout=10) as response:
        return response.read()

def parse_feed_xml(xml_bytes):
    root = ET.fromstring(xml_bytes)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    feed_title = root.find('atom:title', ns)
    feed_title = feed_title.text if feed_title is not None else "BigQuery Release Notes"
    
    feed_updated = root.find('atom:updated', ns)
    feed_updated = feed_updated.text if feed_updated is not None else ""
    
    entries_data = []
    entries = root.findall('atom:entry', ns)
    
    for entry in entries:
        entry_id = entry.find('atom:id', ns).text if entry.find('atom:id', ns) is not None else ""
        title = entry.find('atom:title', ns).text if entry.find('atom:title', ns) is not None else ""
        updated = entry.find('atom:updated', ns).text if entry.find('atom:updated', ns) is not None else ""
        
        link_el = entry.find("atom:link[@rel='alternate']", ns)
        link = link_el.attrib.get('href') if link_el is not None else ""
        
        content_el = entry.find('atom:content', ns)
        content_html = content_el.text if content_el is not None else ""
        
        items = parse_entry_content(content_html)
        
        categories_count = {}
        for item in items:
            cat = item['category']
            categories_count[cat] = categories_count.get(cat, 0) + 1
            
        entries_data.append({
            'id': entry_id,
            'title': title,
            'updated': updated,
            'link': link,
            'items': items,
            'categories_count': categories_count
        })
        
    return {
        'title': feed_title,
        'updated_at': feed_updated,
        'entries': entries_data
    }

def load_cached_data():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                cached = json.load(f)
                # Check timestamp
                if time.time() - cached.get('timestamp', 0) < CACHE_EXPIRY:
                    return cached.get('data'), False  # Valid cache, no fetch needed
                return cached.get('data'), True   # Cache expired, but returns fallback
        except Exception:
            pass
    return None, True

def save_to_cache(data):
    try:
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump({
                'timestamp': time.time(),
                'data': data
            }, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

def get_feed_data(force_refresh=False):
    cached_data, should_fetch = load_cached_data()
    
    if force_refresh or should_fetch or not cached_data:
        try:
            xml_bytes = fetch_feed_xml()
            parsed_data = parse_feed_xml(xml_bytes)
            save_to_cache(parsed_data)
            return parsed_data, "live"
        except Exception as e:
            if cached_data:
                # Return expired cache as fallback
                return cached_data, "fallback_cache"
            raise e
            
    return cached_data, "cache"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', '').lower() == 'true'
    try:
        data, source = get_feed_data(force_refresh)
        return jsonify({
            'status': 'success',
            'source': source,
            'timestamp': datetime.now().isoformat(),
            'data': data
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/stats')
def get_stats():
    try:
        data, _ = get_feed_data()
        entries = data.get('entries', [])
        
        total_entries = len(entries)
        total_items = 0
        category_counts = {}
        activity_by_date = []
        
        for entry in entries:
            items_count = len(entry.get('items', []))
            total_items += items_count
            
            # Aggregate category counts
            for cat, count in entry.get('categories_count', {}).items():
                category_counts[cat] = category_counts.get(cat, 0) + count
                
            # Date for timeline activity
            # Date formatted as YYYY-MM-DD
            date_str = ""
            if entry.get('updated'):
                try:
                    dt = datetime.fromisoformat(entry['updated'].replace('Z', '+00:00'))
                    date_str = dt.strftime('%Y-%m-%d')
                except Exception:
                    date_str = entry['title']
            else:
                date_str = entry['title']
                
            activity_by_date.append({
                'date': date_str,
                'count': items_count
            })
            
        return jsonify({
            'status': 'success',
            'stats': {
                'total_releases_days': total_entries,
                'total_individual_updates': total_items,
                'categories': category_counts,
                'activity_timeline': activity_by_date[:10]  # Return last 10 entries for activity graph
            }
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    # Default is localhost:5000
    app.run(debug=True, port=5000)
