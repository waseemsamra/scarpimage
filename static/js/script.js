// Global variables
let currentSessionId = null;
let statusInterval = null;
let currentData = [];

// DOM Elements
const urlInput = document.getElementById('urlInput');
const validateBtn = document.getElementById('validateBtn');
const scrapeBtn = document.getElementById('scrapeBtn');
const stopBtn = document.getElementById('stopBtn');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const statusMessage = document.getElementById('statusMessage');
const productsCount = document.getElementById('productsCount');
const imagesCount = document.getElementById('imagesCount');
const scrapedCount = document.getElementById('scrapedCount');
const statusBadge = document.getElementById('statusBadge');
const resultsBody = document.getElementById('resultsBody');
const validationResult = document.getElementById('validationResult');
const exportCsv = document.getElementById('exportCsv');
const exportExcel = document.getElementById('exportExcel');
const exportJson = document.getElementById('exportJson');
const exportImages = document.getElementById('exportImages');
const stockFilter = document.getElementById('stockFilter');

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Load example URLs
    loadExampleUrls();
    
    // Add event listeners
    validateBtn.addEventListener('click', validateUrl);
    scrapeBtn.addEventListener('click', startScraping);
    stopBtn.addEventListener('click', stopScraping);
    exportCsv.addEventListener('click', () => exportData('csv'));
    exportExcel.addEventListener('click', () => exportData('excel'));
    exportJson.addEventListener('click', () => exportData('json'));
    exportImages.addEventListener('click', exportImagesZip);
    stockFilter.addEventListener('change', () => displayResults(currentData));
    
    // Enter key to start scraping
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            startScraping();
        }
    });
});

// Load example URLs
function loadExampleUrls() {
    const examples = [
        'https://kith.com/collections/mens-footwear',
        'https://allbirds.com/collections/mens',
        'https://gymshark.com/collections/t-shirts-tops-men',
        'https://store.steampowered.com/'
    ];
    
    // Set first example as placeholder
    if (urlInput.placeholder.includes('example')) {
        urlInput.placeholder = examples[0];
    }
}

// Validate URL
async function validateUrl() {
    const url = urlInput.value.trim();
    
    if (!url) {
        showValidation('Please enter a URL', false);
        return;
    }
    
    validateBtn.disabled = true;
    validateBtn.innerHTML = '<span class="spinner"></span> Validating...';
    
    try {
        const response = await fetch('/api/validate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });
        
        const data = await response.json();
        
        if (data.valid) {
            showValidation('✅ Valid Shopify store detected', true);
            urlInput.value = data.url;
            scrapeBtn.focus();
        } else {
            showValidation(`❌ ${data.message}`, false);
        }
    } catch (error) {
        showValidation('❌ Error validating URL', false);
    } finally {
        validateBtn.disabled = false;
        validateBtn.innerHTML = '<i class="fas fa-check"></i> Validate';
    }
}

function showValidation(message, isValid) {
    validationResult.textContent = message;
    validationResult.className = `url-validation ${isValid ? 'valid' : 'invalid'}`;
    validationResult.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        validationResult.style.display = 'none';
    }, 5000);
}

// Start scraping
async function startScraping() {
    const url = urlInput.value.trim();
    
    if (!url) {
        showToast('Please enter a Shopify store URL', 'error');
        return;
    }
    
    // Get scraping options
    const maxProducts = parseInt(document.getElementById('maxProducts').value) || 50;
    const delay = parseFloat(document.getElementById('delay').value) || 1;
    const downloadImages = document.getElementById('downloadImages').checked;
    const stockOption = stockFilter.value;

    // Disable controls
    scrapeBtn.disabled = true;
    urlInput.disabled = true;
    stopBtn.disabled = false;
    
    // Reset UI
    progressFill.style.width = '0%';
    progressText.textContent = '0%';
    resultsBody.innerHTML = `
        <tr>
            <td colspan="6" class="empty-state">
                <div class="spinner"></div>
                <p>Starting to scrape...</p>
            </td>
        </tr>
    `;
    
    try {
        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url,
                max_products: maxProducts,
                delay: delay,
                download_images: downloadImages,
                stock_status: stockOption
            })
        });
        
        const data = await response.json();
        
        if (data.session_id) {
            currentSessionId = data.session_id;
            startStatusPolling();
            showToast('Scraping started successfully!', 'success');
        } else if (data.error) {
            throw new Error(data.error);
        }
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
        resetControls();
    }
}

// Poll for status updates
function startStatusPolling() {
    if (statusInterval) {
        clearInterval(statusInterval);
    }
    
    statusInterval = setInterval(async () => {
        if (!currentSessionId) return;
        
        try {
            const response = await fetch(`/api/scrape/${currentSessionId}/status`);
            const data = await response.json();
            
            updateUI(data);
            
            // Stop polling if scraping is complete or errored
            if (['completed', 'error', 'stopped'].includes(data.status)) {
                clearInterval(statusInterval);
                
                if (data.status === 'completed') {
                    showToast('Scraping completed!', 'success');
                    loadScrapedData();
                } else if (data.status === 'error') {
                    showToast(`Error: ${data.error}`, 'error');
                }
                
                // Re-enable controls
                scrapeBtn.disabled = false;
                urlInput.disabled = false;
                stopBtn.disabled = true;
                
                // Enable export buttons if there's data
                if (data.has_data) {
                    exportCsv.disabled = false;
                    exportExcel.disabled = false;
                    exportJson.disabled = false;
                    exportImages.disabled = false;
                }
            }
        } catch (error) {
            console.error('Error polling status:', error);
        }
    }, 1000); // Poll every second
}

// Update UI with status data
function updateUI(data) {
    // Update progress bar
    progressFill.style.width = `${data.progress}%`;
    progressText.textContent = `${Math.round(data.progress)}%`;
    
    // Update status message
    statusMessage.textContent = data.message;
    statusBadge.textContent = data.status.charAt(0).toUpperCase() + data.status.slice(1);
    statusBadge.className = `status-badge status-${data.status}`;
    
    // Update statistics
    productsCount.textContent = data.total_products || 0;
    scrapedCount.textContent = data.scraped_count || 0;
    imagesCount.textContent = data.images_downloaded || 0;
    
    // Update button states
    if (data.status === 'running') {
        scrapeBtn.innerHTML = '<span class="spinner"></span> Scraping...';
    } else {
        scrapeBtn.innerHTML = '<i class="fas fa-play"></i> Start Scraping';
    }
}

// Stop scraping
async function stopScraping() {
    if (!currentSessionId) return;
    
    try {
        const response = await fetch(`/api/scrape/${currentSessionId}/stop`, {
            method: 'POST'
        });
        
        showToast('Stopping scraping...', 'warning');
        stopBtn.disabled = true;
        
    } catch (error) {
        showToast('Error stopping scraping', 'error');
    }
}

// Load scraped data
async function loadScrapedData() {
    if (!currentSessionId) return;
    
    try {
        const response = await fetch(`/api/scrape/${currentSessionId}/data`);
        const data = await response.json();
        
        currentData = data.data || [];
        
        if (currentData.length > 0) {
            displayResults(currentData);
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Display results in table
function displayResults(products) {
    const stockOption = stockFilter.value;

    const filteredProducts = products.filter(p => {
        if (stockOption === 'in_stock') return p.availability;
        if (stockOption === 'out_of_stock') return !p.availability;
        return true; // 'all'
    });

    if (filteredProducts.length === 0) {
        resultsBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>No products match the selected filter.</p>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    
    filteredProducts.forEach((product, index) => {
        const title = product.title || 'No title';
        const price = product.price ? 
            (typeof product.price === 'number' ? `$${product.price.toFixed(2)}` : product.price) : 
            'N/A';
        
        const availability = product.availability ? 
            '<span class="badge available">In Stock</span>' : 
            '<span class="badge out-of-stock">Out of Stock</span>';
        
        const imageCount = product.image_urls ? product.image_urls.length : 0;
        
        html += `
            <tr class="fade-in">
                <td>${index + 1}</td>
                <td class="product-title" title="${title}">
                    ${truncateText(title, 50)}
                </td>
                <td class="product-price">${price}</td>
                <td>${availability}</td>
                <td>${imageCount} images</td>
                <td>
                    <button class="btn btn-small btn-info" onclick="viewProductDetails(${currentData.indexOf(product)})">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn btn-small btn-secondary" onclick="previewProductData(${currentData.indexOf(product)})">
                        <i class="fas fa-code"></i> JSON
                    </button>
                </td>
            </tr>
        `;
    });
    
    resultsBody.innerHTML = html;
}

// View product details
function viewProductDetails(index) {
    const product = currentData[index];
    
    const modalBody = document.getElementById('modalBody');
    let html = `
        <div class="product-details">
            <h4>${product.title || 'No Title'}</h4>
            <div class="detail-section">
                <h5><i class="fas fa-tag"></i> Pricing</h5>
                <p><strong>Price:</strong> ${product.price || 'N/A'}</p>
                ${product.compare_at_price ? `<p><strong>Compare at:</strong> ${product.compare_at_price}</p>` : ''}
                <p><strong>Currency:</strong> ${product.currency || 'USD'}</p>
            </div>
            
            <div class="detail-section">
                <h5><i class="fas fa-info-circle"></i> Details</h5>
                <p><strong>SKU:</strong> ${product.sku || 'N/A'}</p>
                <p><strong>Vendor:</strong> ${product.vendor || 'N/A'}</p>
                <p><strong>Type:</strong> ${product.type || 'N/A'}</p>
                <p><strong>Availability:</strong> ${product.availability ? 'In Stock' : 'Out of Stock'}</p>
            </div>
            
            <div class="detail-section">
                <h5><i class="fas fa-align-left"></i> Description</h5>
                <p>${product.description || 'No description available'}</p>
            </div>
    `;
    
    // Add images if available
    if (product.image_urls && product.image_urls.length > 0) {
        html += `
            <div class="detail-section">
                <h5><i class="fas fa-images"></i> Images (${product.image_urls.length})</h5>
                <div class="image-gallery">
        `;
        
        product.image_urls.slice(0, 3).forEach((url, i) => {
            html += `
                <div class="image-thumbnail">
                    <img src="${url}" alt="Product Image ${i + 1}" 
                         onclick="window.open('${url}', '_blank')"
                         style="cursor: pointer;">
                    <small>Image ${i + 1}</small>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    }
    
    // Add variants if available
    if (product.variants && product.variants.length > 0) {
        html += `
            <div class="detail-section">
                <h5><i class="fas fa-list"></i> Variants (${product.variants.length})</h5>
                <div class="variants-list">
        `;
        
        product.variants.slice(0, 5).forEach(variant => {
            html += `
                <div class="variant-item">
                    <span>${variant.title || 'Variant'}</span>
                    <span>$${variant.price || '0.00'}</span>
                </div>
            `;
        });
        
        if (product.variants.length > 5) {
            html += `<p>... and ${product.variants.length - 5} more variants</p>`;
        }
        
        html += `
                </div>
            </div>
        `;
    }
    
    html += `
            <div class="detail-section">
                <h5><i class="fas fa-link"></i> URL</h5>
                <a href="${product.url}" target="_blank" class="product-url">
                    ${product.url}
                </a>
            </div>
        </div>
    `;
    
    modalBody.innerHTML = html;
    document.getElementById('productModal').style.display = 'flex';
}

// Preview product JSON data
function previewProductData(index) {
    const product = currentData[index];
    const previewContent = document.getElementById('previewContent');
    
    previewContent.textContent = JSON.stringify(product, null, 2);
    document.getElementById('dataPreview').style.display = 'flex';
}

// Close preview
function closePreview() {
    document.getElementById('dataPreview').style.display = 'none';
}

// Close modal
function closeModal() {
    document.getElementById('productModal').style.display = 'none';
}

// Export data
async function exportData(format) {
    if (!currentSessionId || currentData.length === 0) {
        showToast('No data to export', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`/api/export/${currentSessionId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ format: format })
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            
            let filename = `shopify_products_${currentSessionId}`;
            if (format === 'csv') filename += '.csv';
            else if (format === 'excel') filename += '.xlsx';
            else if (format === 'json') filename += '.json';
            
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showToast(`Data exported as ${format.toUpperCase()}`, 'success');
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Export failed');
        }
    } catch (error) {
        showToast(`Export error: ${error.message}`, 'error');
    }
}

// Export images as ZIP
async function exportImagesZip() {
    if (!currentSessionId) {
        showToast('No session found', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/export/${currentSessionId}/images`);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            
            a.href = url;
            a.download = `shopify_images_${currentSessionId}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showToast('Images exported as ZIP file', 'success');
        } else {
            const error = await response.json();
            if (error.error.includes('No images found')) {
                showToast('No images were downloaded during scraping', 'warning');
            } else {
                throw new Error(error.error || 'Export failed');
            }
        }
    } catch (error) {
        showToast(`Export error: ${error.message}`, 'error');
    }
}

// Reset controls
function resetControls() {
    scrapeBtn.disabled = false;
    urlInput.disabled = false;
    stopBtn.disabled = true;
    scrapeBtn.innerHTML = '<i class="fas fa-play"></i> Start Scraping';
}

// Utility functions
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

function showToast(message, type = 'info') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} fade-in`;
    toast.innerHTML = `
        <i class="fas fa-${getToastIcon(type)}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function getToastIcon(type) {
    switch(type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'warning': return 'exclamation-triangle';
        default: return 'info-circle';
    }
}

// Add toast styles dynamically
const toastStyles = `
    .toast {
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 10px;
        color: white;
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 10000;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        min-width: 300px;
        max-width: 400px;
    }
    
    .toast-success { background: linear-gradient(135deg, #00b09b 0%, #96c93d 100%); }
    .toast-error { background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%); }
    .toast-warning { background: linear-gradient(135deg, #f7971e 0%, #ffd200 100%); }
    .toast-info { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
    
    .toast i { font-size: 1.2rem; }
    
    .fade-out {
        opacity: 0;
        transform: translateY(20px);
        transition: all 0.3s ease;
    }
    
    .badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.8rem;
        font-weight: 600;
    }
    
    .badge.available {
        background: rgba(102, 187, 106, 0.2);
        color: #2e7d32;
        border: 1px solid #66bb6a;
    }
    
    .badge.out-of-stock {
        background: rgba(239, 83, 80, 0.2);
        color: #c62828;
        border: 1px solid #ef5350;
    }
    
    .product-details { max-width: 500px; }
    .detail-section { margin-bottom: 20px; }
    .detail-section h5 { 
        color: #667eea; 
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .image-gallery { 
        display: flex; 
        gap: 10px; 
        flex-wrap: wrap;
    }
    .image-thumbnail { 
        width: 100px; 
        text-align: center;
    }
    .image-thumbnail img { 
        width: 100%; 
        height: 100px; 
        object-fit: cover;
        border-radius: 8px;
    }
    .variants-list { 
        background: #f8f9fa; 
        padding: 10px;
        border-radius: 8px;
    }
    .variant-item { 
        display: flex; 
        justify-content: space-between;
        padding: 5px 0;
        border-bottom: 1px solid #e0e0e0;
    }
    .variant-item:last-child { border-bottom: none; }
    .product-url { 
        word-break: break-all; 
        color: #667eea;
        text-decoration: none;
    }
    .product-url:hover { text-decoration: underline; }
`;

const styleSheet = document.createElement("style");
styleSheet.textContent = toastStyles;
document.head.appendChild(styleSheet);

// CSS for status badges
const statusBadgeStyles = `
    .status-badge {
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 0.9rem;
        font-weight: 600;
        display: inline-block;
    }
    
    .status-running {
        background: rgba(33, 150, 243, 0.2);
        color: #1976d2;
        border: 1px solid #2196f3;
    }
    
    .status-completed {
        background: rgba(102, 187, 106, 0.2);
        color: #2e7d32;
        border: 1px solid #66bb6a;
    }
    
    .status-error, .status-stopped {
        background: rgba(239, 83, 80, 0.2);
        color: #c62828;
        border: 1px solid #ef5350;
    }
    
    .status-idle {
        background: rgba(158, 158, 158, 0.2);
        color: #424242;
        border: 1px solid #9e9e9e;
    }
`;

const statusStyleSheet = document.createElement("style");
statusStyleSheet.textContent = statusBadgeStyles;
document.head.appendChild(statusStyleSheet);
