import requests
from bs4 import BeautifulSoup
import json
import re
import time
import os
from urllib.parse import urljoin, urlparse
from datetime import datetime
import random

class ShopifyScraper:
    def __init__(self):
        self.session = requests.Session()
        self.setup_headers()
        self.timeout = 30
        
    def setup_headers(self):
        """Setup realistic browser headers"""
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
        })
    
    def is_shopify_store(self, url):
        """Check if a website is built with Shopify"""
        try:
            response = self.session.get(url, timeout=self.timeout)
            
            # Check for Shopify indicators
            shopify_indicators = [
                'shopify',
                'cdn.shopify.com',
                'Shopify.theme',
                'window.Shopify',
                'var Shopify'
            ]
            
            content = response.text.lower()
            
            for indicator in shopify_indicators:
                if indicator.lower() in content:
                    return True
            
            # Check for Shopify in headers
            if 'shopify' in response.headers.get('server', '').lower():
                return True
                
            # Check for Shopify in meta tags
            soup = BeautifulSoup(response.content, 'html.parser')
            generator = soup.find('meta', {'name': 'generator'})
            if generator and 'shopify' in generator.get('content', '').lower():
                return True
                
            return False
            
        except Exception as e:
            print(f"Error checking Shopify: {e}")
            return False
    
    def extract_product_links(self, url, max_links=50):
        """Extract product URLs from a Shopify collection or search page"""
        try:
            print(f"Extracting product links from: {url}")
            response = self.session.get(url, timeout=self.timeout)
            soup = BeautifulSoup(response.content, 'html.parser')
            
            product_links = set()
            
            # Method 1: Look for JSON data in script tags
            scripts = soup.find_all('script', type='application/json')
            for script in scripts:
                try:
                    data = json.loads(script.string)
                    links = self.extract_links_from_json(data)
                    product_links.update(links[:max_links])
                except:
                    continue
            
            # Method 2: Look for product links in href attributes
            for link in soup.find_all('a', href=True):
                href = link['href']
                if '/products/' in href and '#' not in href and '?' not in href:
                    full_url = urljoin(url, href)
                    product_links.add(full_url)
            
            # Method 3: Check for pagination and scrape additional pages
            if len(product_links) < max_links:
                product_links.update(self.scrape_additional_pages(url, max_links - len(product_links)))
            
            return list(product_links)[:max_links]
            
        except Exception as e:
            print(f"Error extracting links: {e}")
            return []
    
    def extract_links_from_json(self, data):
        """Extract product links from JSON data"""
        links = []
        
        def search_dict(obj):
            if isinstance(obj, dict):
                for key, value in obj.items():
                    if key == 'url' and isinstance(value, str) and '/products/' in value:
                        links.append(value)
                    elif key == 'products' and isinstance(value, list):
                        for product in value:
                            if isinstance(product, dict) and 'url' in product:
                                links.append(product['url'])
                    else:
                        search_dict(value)
            elif isinstance(obj, list):
                for item in obj:
                    search_dict(item)
        
        search_dict(data)
        return links
    
    def scrape_additional_pages(self, base_url, max_links):
        """Scrape additional pagination pages"""
        links = set()
        
        for page in range(2, 6):  # Try up to 5 pages
            try:
                page_url = f"{base_url}?page={page}" if '?' not in base_url else f"{base_url}&page={page}"
                response = self.session.get(page_url, timeout=self.timeout)
                soup = BeautifulSoup(response.content, 'html.parser')
                
                for link in soup.find_all('a', href=True):
                    href = link['href']
                    if '/products/' in href and '#' not in href and '?' not in href:
                        full_url = urljoin(base_url, href)
                        links.add(full_url)
                
                if len(links) >= max_links:
                    break
                    
                # Check if there's a next page
                next_page = soup.find('a', string=re.compile(r'next', re.I))
                if not next_page:
                    break
                    
            except Exception as e:
                print(f"Error scraping page {page}: {e}")
                break
        
        return list(links)[:max_links]
    
    def find_products_on_page(self, url, max_links=50):
        """Find products on any Shopify page"""
        try:
            response = self.session.get(url, timeout=self.timeout)
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Look for product cards or grid items
            product_selectors = [
                '[class*="product-card"] a',
                '[class*="product-item"] a',
                '[class*="product-grid"] a',
                '.product a',
                'a[href*="/products/"]'
            ]
            
            links = set()
            for selector in product_selectors:
                elements = soup.select(selector)
                for element in elements:
                    href = element.get('href')
                    if href and '/products/' in href:
                        full_url = urljoin(url, href.split('?')[0])
                        links.add(full_url)
            
            return list(links)[:max_links]
            
        except Exception as e:
            print(f"Error finding products: {e}")
            return []
    
    def scrape_product_page(self, url):
        """Scrape individual product page with multiple fallback methods"""
        try:
            print(f"Scraping product: {url}")
            response = self.session.get(url, timeout=self.timeout)
            soup = BeautifulSoup(response.content, 'html.parser')
            
            product_data = {
                'url': url,
                'title': '',
                'price': '',
                'compare_at_price': '',
                'description': '',
                'availability': True,
                'sku': '',
                'vendor': '',
                'type': '',
                'tags': [],
                'variants': [],
                'options': [],
                'image_urls': [],
                'scraped_at': datetime.now().isoformat(),
                'currency': 'USD'
            }
            
            # Method 1: Extract from JSON-LD (most reliable)
            product_data = self.extract_from_jsonld(soup, product_data)
            
            # Method 2: Extract from product JSON in script tags
            if not product_data['title']:
                product_data = self.extract_from_product_json(soup, product_data)
            
            # Method 3: Extract from HTML elements (fallback)
            product_data = self.extract_from_html(soup, product_data)
            
            # Method 4: Extract from meta tags
            product_data = self.extract_from_meta(soup, product_data)
            
            # Clean up data
            product_data = self.clean_product_data(product_data)
            
            return product_data
            
        except Exception as e:
            print(f"Error scraping product {url}: {e}")
            return None
    
    def _ensure_https(self, url):
        if not url:
            return None
        if url.startswith('//'):
            return f'https:{url}'
        if not url.startswith(('http://', 'https://')):
            # Assuming it's a relative path, needs to be joined with base URL
            return None
        return url

    def extract_from_jsonld(self, soup, product_data):
        """Extract product data from JSON-LD"""
        try:
            json_ld_scripts = soup.find_all('script', type='application/ld+json')
            for script in json_ld_scripts:
                if not script.string:
                    continue
                data = json.loads(script.string)
                
                if isinstance(data, list):
                    product_item = next((item for item in data if item.get('@type') == 'Product'), None)
                    if product_item:
                        data = product_item

                if data.get('@type') == 'Product':
                    if not product_data['title']:
                        product_data['title'] = data.get('name', '')
                    if not product_data['description']:
                        product_data['description'] = data.get('description', '')
                    if not product_data['sku']:
                        product_data['sku'] = data.get('sku', '')
                    
                    image_data = data.get('image', [])
                    if isinstance(image_data, str):
                        img_url = self._ensure_https(urljoin(product_data['url'], image_data))
                        if img_url: product_data['image_urls'].append(img_url)
                    elif isinstance(image_data, list):
                        for img in image_data:
                            img_url = self._ensure_https(urljoin(product_data['url'], img if isinstance(img, str) else img.get('url')))
                            if img_url: product_data['image_urls'].append(img_url)

                    offers = data.get('offers', {})
                    if isinstance(offers, list):
                        offers = offers[0] if offers else {}
                    
                    if not product_data['price']:
                        product_data['price'] = offers.get('price') or offers.get('lowPrice')
                    if not product_data['compare_at_price']:
                         product_data['compare_at_price'] = offers.get('highPrice')
                    
                    product_data['availability'] = 'InStock' in offers.get('availability', '')
                    product_data['currency'] = offers.get('priceCurrency', 'USD')
                    
        except (json.JSONDecodeError, TypeError) as e:
            print(f"Skipping invalid JSON-LD: {e}")
        except Exception as e:
            print(f"Error in extract_from_jsonld: {e}")
        return product_data
    
    def extract_from_product_json(self, soup, product_data):
        """Extract product data from Shopify's product JSON in script tags"""
        try:
            for script in soup.find_all('script'):
                if not script.string:
                    continue
                
                # More robust patterns to find product JSON
                patterns = [
                    r'var\s+meta\s*=\s*{\s*"product"\s*:\s*({.*?})\s*};',
                    r'new\s+Shopify\.OptionSelectors\([^,]+,\s*{\s*product\s*:\s*({.*?}),.*?}\);',
                    r'"product":\s*({.*)'
                ]
                
                for pattern in patterns:
                    match = re.search(pattern, script.string, re.DOTALL)
                    if match:
                        try:
                            product_json = json.loads(match.group(1))
                            self.update_from_product_json(product_json, product_data)
                            return product_data # Exit after first successful parse
                        except json.JSONDecodeError:
                            continue # Try next pattern if JSON is invalid

        except Exception as e:
            print(f"Error extracting from product JSON: {e}")
        
        return product_data

    
    def update_from_product_json(self, product_json, product_data):
        """Update product data from a parsed product JSON object"""
        if not product_data.get('title') and product_json.get('title'):
            product_data['title'] = product_json['title']

        if not product_data.get('description') and product_json.get('description'):
            product_data['description'] = product_json['description']
        
        if not product_data.get('vendor') and product_json.get('vendor'):
            product_data['vendor'] = product_json['vendor']

        if not product_data.get('price') and product_json.get('price'):
             product_data['price'] = product_json.get('price') / 100.0 # Assuming cents

        # Images
        images = product_json.get('images', [])
        for img in images:
            img_url = self._ensure_https(urljoin(product_data['url'], img))
            if img_url: product_data['image_urls'].append(img_url)
            
        return product_data

    def extract_from_html(self, soup, product_data):
        """Fallback to extract product data directly from HTML elements"""
        # Title
        if not product_data.get('title'):
            title_selectors = ['h1.product-title', 'h1.product__title', 'h1[class*="title"]']
            for selector in title_selectors:
                el = soup.select_one(selector)
                if el:
                    product_data['title'] = el.get_text(strip=True)
                    break
        
        # Price
        if not product_data.get('price'):
            price_selectors = ['.price__regular .money', '.product-price', '[data-product-price]']
            for selector in price_selectors:
                el = soup.select_one(selector)
                if el:
                    price_text = el.get_text(strip=True)
                    price_match = re.search(r'[\d,]+(?:\.\d{2})?', price_text)
                    if price_match:
                        product_data['price'] = price_match.group(0).replace(',','')
                        break
        
        # Images
        for img_tag in soup.find_all('img'):
            src = img_tag.get('src') or img_tag.get('data-src')
            srcset = img_tag.get('srcset')

            if srcset:
                # Get the largest image from srcset
                try:
                    largest_url = sorted([
                        (url.strip().split()[0], int(url.strip().split()[1][:-1]))
                        for url in srcset.split(',')
                    ], key=lambda x: x[1], reverse=True)[0][0]
                    img_url = self._ensure_https(urljoin(product_data['url'], largest_url))
                    if img_url: product_data['image_urls'].append(img_url)
                except (ValueError, IndexError):
                    pass # Ignore malformed srcset

            elif src:
                img_url = self._ensure_https(urljoin(product_data['url'], src))
                if img_url: product_data['image_urls'].append(img_url)
                
        return product_data

    def extract_from_meta(self, soup, product_data):
        """Extract data from OpenGraph meta tags"""
        if not product_data.get('title'):
            og_title = soup.find('meta', property='og:title')
            if og_title:
                product_data['title'] = og_title.get('content', '')

        if not product_data.get('description'):
            og_desc = soup.find('meta', property='og:description')
            if og_desc:
                product_data['description'] = og_desc.get('content', '')

        if not product_data.get('price'):
            og_price = soup.find('meta', property='og:price:amount')
            if og_price:
                product_data['price'] = og_price.get('content', '')

        og_images = soup.find_all('meta', property='og:image')
        for og_image in og_images:
            img_url = self._ensure_https(urljoin(product_data['url'], og_image.get('content')))
            if img_url: product_data['image_urls'].append(img_url)

        return product_data

    
    def clean_product_data(self, product_data):
        """Clean and format product data"""
        # Clean title
        if product_data['title']:
            product_data['title'] = ' '.join(product_data['title'].split())
        
        # Clean description
        if product_data['description']:
            # Remove multiple spaces and newlines
            product_data['description'] = ' '.join(product_data['description'].split())
            # Truncate if too long
            if len(product_data['description']) > 1000:
                product_data['description'] = product_data['description'][:997] + '...'
        
        # Format price
        if product_data['price']:
            # Remove currency symbols and format
            price = re.sub(r'[^\d.]', '', str(product_data['price']))
            try:
                product_data['price'] = float(price)
            except:
                pass
        
        # Remove duplicate image URLs
        if product_data['image_urls']:
            seen = set()
            unique_urls = []
            for url in product_data['image_urls']:
                if url not in seen:
                    seen.add(url)
                    unique_urls.append(url)
            product_data['image_urls'] = unique_urls
        
        return product_data
    
    def download_product_images(self, image_urls, product_title, base_folder, session_id):
        """Download product images"""
        downloaded = 0
        
        try:
            # Create session folder
            session_folder = os.path.join(base_folder, session_id)
            os.makedirs(session_folder, exist_ok=True)
            
            # Sanitize product title for folder name
            safe_title = re.sub(r'[^\w\s-]', '', product_title)[:50].strip()
            if not safe_title:
                safe_title = 'product_' + str(int(time.time()))
            
            product_folder = os.path.join(session_folder, safe_title)
            os.makedirs(product_folder, exist_ok=True)
            
            # Download images
            for i, img_url in enumerate(image_urls[:10]):  # Limit to 10 images
                try:
                    # Ensure URL is absolute and has a scheme
                    img_url = self._ensure_https(urljoin(base_folder, img_url))
                    if not img_url:
                        continue

                    response = self.session.get(img_url, timeout=10)
                    
                    if response.status_code == 200:
                        # Determine file extension
                        content_type = response.headers.get('content-type', '')
                        if 'jpeg' in content_type or 'jpg' in content_type:
                            ext = '.jpg'
                        elif 'png' in content_type:
                            ext = '.png'
                        elif 'gif' in content_type:
                            ext = '.gif'
                        elif 'webp' in content_type:
                            ext = '.webp'
                        else:
                            # Try to guess from URL
                            parsed = urlparse(img_url)
                            path = parsed.path.lower()
                            if '.jpg' in path or '.jpeg' in path:
                                ext = '.jpg'
                            elif '.png' in path:
                                ext = '.png'
                            elif '.gif' in path:
                                ext = '.gif'
                            else:
                                ext = '.jpg'
                        
                        # Save image
                        filename = f"{i+1}{ext}"
                        filepath = os.path.join(product_folder, filename)
                        
                        with open(filepath, 'wb') as f:
                            f.write(response.content)
                        
                        downloaded += 1
                        
                except Exception as e:
                    print(f"Error downloading image {img_url}: {e}")
                    continue
            
            return downloaded
            
        except Exception as e:
            print(f"Error creating folders: {e}")
            return 0