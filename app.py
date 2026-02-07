from flask import Flask, render_template, jsonify, request, send_file, current_app
from flask_cors import CORS
import json
import os
from datetime import datetime
import pandas as pd
from scraper import ShopifyScraper
import threading
from werkzeug.utils import secure_filename
import zipfile
import io
import time

# In-memory storage for scraping sessions
scraping_sessions = {}

class ScrapingSession:
    def __init__(self, session_id):
        self.session_id = session_id
        self.data = []
        self.status = 'idle'
        self.progress = 0
        self.message = ''
        self.total_products = 0
        self.scraped_count = 0
        self.images_downloaded = 0
        self.error = None

def run_scraping(app, session_id, url, max_products, delay, download_images):
    with app.app_context():
        session = scraping_sessions[session_id]
        
        try:
            session.status = 'running'
            session.message = 'Initializing scraper...'
            
            scraper = ShopifyScraper()
            
            session.message = 'Analyzing website structure...'
            
            product_urls = []
            
            if '/products/' in url and '/collections/' not in url:
                product_urls = [url]
            else:
                session.message = 'Extracting product links...'
                product_urls = scraper.extract_product_links(url, max_products)
                
                if not product_urls:
                    session.message = 'Searching for products...'
                    product_urls = scraper.find_products_on_page(url, max_products)
            
            if not product_urls:
                session.status = 'error'
                session.error = 'No products found on this page'
                return
            
            session.total_products = min(len(product_urls), max_products)
            session.message = f'Found {session.total_products} products. Starting to scrape...'
            
            for i, product_url in enumerate(product_urls[:session.total_products]):
                if session.status == 'stopped':
                    break
                    
                session.progress = int((i + 1) / session.total_products * 100)
                session.scraped_count = i + 1
                session.message = f'Scraping product {i+1}/{session.total_products}: {product_url}'
                
                product_data = scraper.scrape_product_page(product_url)
                
                if product_data:
                    session.data.append(product_data)
                
                if i < session.total_products - 1:
                    time.sleep(delay)
            
            session.status = 'completed'
            session.message = f'Scraping completed! Scraped {len(session.data)} products'
            session.progress = 100
            
        except Exception as e:
            session.status = 'error'
            session.error = str(e)
            session.message = f'Error: {str(e)}'

def create_app():
    app = Flask(__name__)
    CORS(app)
    app.config['UPLOAD_FOLDER'] = 'uploads'
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    @app.route('/')
    def index():
        return render_template('index.html')

    @app.route('/api/scrape', methods=['POST'])
    def start_scraping():
        try:
            data = request.json
            url = data.get('url', '').strip()
            
            if not url:
                return jsonify({'error': 'URL is required'}), 400
            
            session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            session = ScrapingSession(session_id)
            scraping_sessions[session_id] = session
            
            max_products = data.get('max_products', 50)
            delay = data.get('delay', 1)
            download_images = data.get('download_images', False)
            
            thread = threading.Thread(
                target=run_scraping,
                args=(app, session_id, url, max_products, delay, download_images)
            )
            thread.daemon = True
            thread.start()
            
            return jsonify({
                'session_id': session_id,
                'message': 'Scraping started'
            })
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/scrape/<session_id>/status')
    def get_scraping_status(session_id):
        if session_id not in scraping_sessions:
            return jsonify({'error': 'Session not found'}), 404
        
        session = scraping_sessions[session_id]
        
        return jsonify({
            'session_id': session.session_id,
            'status': session.status,
            'progress': session.progress,
            'message': session.message,
            'total_products': session.total_products,
            'scraped_count': session.scraped_count,
            'images_downloaded': session.images_downloaded,
            'error': session.error,
            'has_data': len(session.data) > 0
        })

    @app.route('/api/scrape/<session_id>/stop', methods=['POST'])
    def stop_scraping(session_id):
        if session_id in scraping_sessions:
            scraping_sessions[session_id].status = 'stopped'
            return jsonify({'message': 'Scraping stopped'})
        return jsonify({'error': 'Session not found'}), 404

    @app.route('/api/scrape/<session_id>/data')
    def get_scraped_data(session_id):
        if session_id not in scraping_sessions:
            return jsonify({'error': 'Session not found'}), 404
        
        session = scraping_sessions[session_id]
        
        return jsonify({
            'data': session.data,
            'total': len(session.data)
        })

    @app.route('/api/scrape/<session_id>/columns')
    def get_available_columns(session_id):
        if session_id not in scraping_sessions or not scraping_sessions[session_id].data:
            return jsonify({'error': 'No data to determine columns'}), 404

        session = scraping_sessions[session_id]
        df = pd.DataFrame(session.data)

        # Expand image_urls before determining columns
        if 'image_urls' in df.columns:
            image_urls_df = df['image_urls'].apply(pd.Series)
            image_urls_df = image_urls_df.rename(columns = lambda x : f'image_url_{x + 1}')
            df = pd.concat([df.drop(['image_urls'], axis=1), image_urls_df], axis=1)

        return jsonify(list(df.columns))

    @app.route('/api/export/<session_id>', methods=['POST'])
    def export_data(session_id):
        if session_id not in scraping_sessions:
            return jsonify({'error': 'Session not found'}), 404
        
        session = scraping_sessions[session_id]
        
        if not session.data:
            return jsonify({'error': 'No data to export'}), 400
        
        export_format = request.json.get('format', 'csv')
        selected_columns = request.json.get('columns')
        
        try:
            df = pd.DataFrame(session.data)
            
            # First, expand the image_urls column into separate columns
            if 'image_urls' in df.columns:
                image_urls_df = df['image_urls'].apply(pd.Series)
                image_urls_df = image_urls_df.rename(columns = lambda x : f'image_url_{x + 1}')
                df = pd.concat([df.drop(['image_urls'], axis=1), image_urls_df], axis=1)

            if selected_columns:
                valid_columns = [col for col in selected_columns if col in df.columns]
                df = df[valid_columns]
            
            if export_format == 'csv':
                filename = f'scraped_products_{session_id}.csv'
                filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
                df.to_csv(filepath, index=False, encoding='utf-8')
                
                return send_file(
                    filepath,
                    as_attachment=True,
                    download_name=filename,
                    mimetype='text/csv'
                )
                
            elif export_format == 'excel':
                filename = f'scraped_products_{session_id}.xlsx'
                filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
                df.to_excel(filepath, index=False)
                
                return send_file(
                    filepath,
                    as_attachment=True,
                    download_name=filename,
                    mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                )
                
            elif export_format == 'json':
                filename = f'scraped_products_{session_id}.json'
                filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
                df.to_json(filepath, orient='records', indent=4)
                
                return send_file(
                    filepath,
                    as_attachment=True,
                    download_name=filename,
                    mimetype='application/json'
                )
                
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/export/<session_id>/images')
    def export_images(session_id):
        try:
            session_folder = os.path.join(current_app.config['UPLOAD_FOLDER'], session_id)
            
            if not os.path.exists(session_folder):
                return jsonify({'error': 'No images found'}), 404
            
            zip_path = os.path.join(current_app.config['UPLOAD_FOLDER'], f'scraped_images_{session_id}.zip')
            
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                for root, dirs, files in os.walk(session_folder):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, session_folder)
                        zf.write(file_path, arcname)
            
            return send_file(
                zip_path,
                as_attachment=True,
                download_name=f'scraped_images_{session_id}.zip',
                mimetype='application/zip'
            )
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/validate', methods=['POST'])
    def validate_url():
        try:
            data = request.json
            url = data.get('url', '').strip()
            
            if not url:
                return jsonify({'valid': False, 'message': 'URL is required'})
            
            if not url.startswith(('http://', 'https://')):
                url = 'https://' + url
            
            scraper = ShopifyScraper()
            is_shopify, message = scraper.is_shopify_store(url)
            
            return jsonify({
                'valid': True, # Always true if accessible
                'is_shopify': is_shopify,
                'message': message,
                'url': url
            })
                
        except Exception as e:
            return jsonify({
                'valid': False,
                'message': f'An error occurred: {str(e)}'
            })

    return app