// Global variables
let currentSessionId = null;
let statusInterval = null;
let currentData = [];
let selectedColumns = [];

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
const selectColumnsBtn = document.getElementById('selectColumnsBtn');
const columnsModal = document.getElementById('columnsModal');
const columnsBody = document.getElementById('columnsBody');
const applyColumnsBtn = document.getElementById('applyColumnsBtn');


// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    scrapeBtn.addEventListener('click', startScraping);
    stopBtn.addEventListener('click', stopScraping);
    validateBtn.addEventListener('click', validateUrl);
    
    exportCsv.addEventListener('click', () => exportData('csv'));
    exportExcel.addEventListener('click', () => exportData('excel'));
    exportJson.addEventListener('click', () => exportData('json'));
    exportImages.addEventListener('click', exportImagesZip);
    
    selectColumnsBtn.addEventListener('click', openColumnsModal);
    applyColumnsBtn.addEventListener('click', applyColumnSelection);

    stockFilter.addEventListener('change', () => displayResults(currentData));

    urlInput.addEventListener('input', () => {
        // Enable scrape button if there is any text in the URL input
        scrapeBtn.disabled = urlInput.value.trim() === '';
    });

    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            if (!scrapeBtn.disabled) {
                startScraping();
            }
        }
    });
});

// Main Scraping Functions
async function validateUrl() {
    const url = urlInput.value.trim();
    if (!url) {
        showValidation('Please enter a URL', 'invalid');
        return;
    }

    setButtonLoading(validateBtn, true, 'Validating...');
    scrapeBtn.disabled = true;
    try {
        const response = await fetch('/api/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await response.json();
        
        let message = data.message;
        let messageType = data.is_shopify ? 'valid' : 'info';
        if (!data.valid) {
            messageType = 'invalid';
        }
        
        showValidation(message, messageType);

        if (data.valid) {
            urlInput.value = data.url;
            scrapeBtn.focus();
        }
    } catch (error) {
        showValidation('Error validating URL. Please check the console.', 'invalid');
    } finally {
        setButtonLoading(validateBtn, false, '<i class="fas fa-check"></i> Validate');
        scrapeBtn.disabled = urlInput.value.trim() === '';
    }
}

async function startScraping() {
    const url = urlInput.value.trim();
    if (!url) {
        showToast('Please enter a URL to scrape', 'error');
        return;
    }

    // Reset from previous runs
    resetUI();
    setControlsState(false);

    try {
        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url,
                max_products: parseInt(document.getElementById('maxProducts').value) || 50,
                delay: parseFloat(document.getElementById('delay').value) || 1,
                download_images: document.getElementById('downloadImages').checked
            })
        });

        const data = await response.json();
        if (data.session_id) {
            currentSessionId = data.session_id;
            startStatusPolling();
            showToast('Scraping started successfully!', 'success');
        } else {
            throw new Error(data.error || 'Failed to start session.');
        }
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
        setControlsState(true);
    }
}

async function stopScraping() {
    if (!currentSessionId || statusBadge.textContent === 'Stopped') return;

    try {
        await fetch(`/api/scrape/${currentSessionId}/stop`, { method: 'POST' });
        showToast('Stopping scraping...', 'warning');
        stopBtn.disabled = true;
    } catch (error) {
        showToast('Error stopping scraping', 'error');
    }
}

function startStatusPolling() {
    if (statusInterval) clearInterval(statusInterval);

    statusInterval = setInterval(async () => {
        if (!currentSessionId) return;

        try {
            const response = await fetch(`/api/scrape/${currentSessionId}/status`);
            const data = await response.json();
            
            updateProgressUI(data);

            if (['completed', 'error', 'stopped'].includes(data.status)) {
                clearInterval(statusInterval);
                setControlsState(true, data.has_data);

                if (data.status === 'completed') {
                    showToast('Scraping completed!', 'success');
                    loadScrapedData();
                } else if (data.status === 'error') {
                    showToast(`Error: ${data.error}`, 'error');
                }
            }
        } catch (error) {
            console.error('Error polling status:', error);
            clearInterval(statusInterval);
            setControlsState(true);
        }
    }, 1500);
}

async function loadScrapedData() {
    if (!currentSessionId) return;
    try {
        const response = await fetch(`/api/scrape/${currentSessionId}/data`);
        const data = await response.json();
        currentData = data.data || [];
        displayResults(currentData);
    } catch (error) {
        console.error('Error loading data:', error);
        showToast('Could not load scraped data.', 'error');
    }
}


// UI Update Functions
function resetUI() {
    currentData = [];
    selectedColumns = [];
    resultsBody.innerHTML = `<tr><td colspan="6" class="empty-state"><div class="spinner"></div><p>Starting to scrape...</p></td></tr>`;
    updateProgressUI({ progress: 0, message: 'Initiating...', status: 'idle', total_products: 0, scraped_count: 0, images_downloaded: 0 });
}

function updateProgressUI(data) {
    progressFill.style.width = `${data.progress || 0}%`;
    progressText.textContent = `${Math.round(data.progress || 0)}%`;
    statusMessage.textContent = data.message || 'Waiting for status...';
    
    const currentStatus = data.status || 'idle';
    statusBadge.textContent = currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1);
    statusBadge.className = `status-badge status-${currentStatus}`;

    productsCount.textContent = data.total_products || 0;
    scrapedCount.textContent = data.scraped_count || 0;
    imagesCount.textContent = data.images_downloaded || 0;
}

function displayResults(products) {
    const stockOption = stockFilter.value;
    const filteredProducts = products.filter(p => {
        if (stockOption === 'in_stock') return p.availability;
        if (stockOption === 'out_of_stock') return !p.availability;
        return true;
    });

    if (filteredProducts.length === 0) {
        resultsBody.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fas fa-exclamation-circle"></i><p>No products match the selected filter.</p></td></tr>`;
        return;
    }

    resultsBody.innerHTML = filteredProducts.map((product, index) => `
        <tr class="fade-in">
            <td>${index + 1}</td>
            <td class="product-title" title="${product.title || ''}">${truncateText(product.title || 'No title', 50)}</td>
            <td class="product-price">${formatPrice(product.price)}</td>
            <td>${product.availability ? '<span class="badge available">In Stock</span>' : '<span class="badge out-of-stock">Out of Stock</span>'}</td>
            <td>${product.image_urls ? product.image_urls.length : 0} images</td>
            <td>
                <button class="btn btn-small btn-info" onclick="viewProductDetails(${products.indexOf(product)})"><i class="fas fa-eye"></i> View</button>
                <button class="btn btn-small btn-secondary" onclick="previewProductData(${products.indexOf(product)})"><i class="fas fa-code"></i> JSON</button>
            </td>
        </tr>
    `).join('');
}


// Modal Functions
function viewProductDetails(index) {
    const product = currentData[index];
    const modalBody = document.getElementById('modalBody');

    let imagesHTML = '';
    if (product.image_urls && product.image_urls.length > 0) {
        imagesHTML = `
            <div class="detail-section">
                <h5><i class="fas fa-images"></i> Images (${product.image_urls.length})</h5>
                <div class="image-gallery">
                    ${product.image_urls.slice(0, 5).map((url, i) => `
                        <div class="image-thumbnail">
                            <img src="${url}" alt="Product Image ${i + 1}" onclick="window.open('${url}', '_blank')" style="cursor: pointer;">
                        </div>
                    `).join('')}
                </div>
            </div>`;
    }

    modalBody.innerHTML = `
        <div class="product-details">
            <h4>${product.title || 'No Title'}</h4>
            <div class="detail-grid">
                <p><strong>Price:</strong> ${formatPrice(product.price)}</p>
                <p><strong>SKU:</strong> ${product.sku || 'N/A'}</p>
                <p><strong>Vendor:</strong> ${product.vendor || 'N/A'}</p>
                <p><strong>Type:</strong> ${product.type || 'N/A'}</p>
            </div>
            ${imagesHTML}
            <div class="detail-section">
                <h5><i class="fas fa-link"></i> URL</h5>
                <a href="${product.url}" target="_blank" class="product-url">${product.url}</a>
            </div>
        </div>`;

    openModal('productModal');
}

async function openColumnsModal() {
    if (!currentSessionId || currentData.length === 0) {
        showToast('No data available to select columns from.', 'warning');
        return;
    }
    
    columnsBody.innerHTML = '<div class="spinner"></div>';
    openModal('columnsModal');

    try {
        const response = await fetch(`/api/scrape/${currentSessionId}/columns`);
        const columns = await response.json();
        
        if (columns.error) throw new Error(columns.error);
        
        const preferredOrder = ['title', 'price', 'currency', 'sku', 'vendor', 'availability', 'url'];
        const sortedColumns = [...new Set([...preferredOrder, ...columns.sort()])];


        columnsBody.innerHTML = sortedColumns.map(col => `
            <div class="checkbox-group">
                <input type="checkbox" id="col-${col}" value="${col}" ${selectedColumns.includes(col) || selectedColumns.length === 0 ? 'checked' : ''}>
                <label for="col-${col}">${col}</label>
            </div>
        `).join('');
    } catch (error) {
        columnsBody.innerHTML = '<p class="error-text">Could not load columns.</p>';
        showToast(error.message, 'error');
    }
}

function applyColumnSelection() {
    selectedColumns = Array.from(columnsBody.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
    if (selectedColumns.length === 0) {
        showToast('No columns selected. All columns will be exported.', 'info');
    } else {
        showToast(`${selectedColumns.length} columns selected for export.`, 'success');
    }
    closeModal('columnsModal');
}

function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function previewProductData(index) {
    const product = currentData[index];
    document.getElementById('previewContent').textContent = JSON.stringify(product, null, 2);
    document.getElementById('dataPreview').style.display = 'flex';
}

function closePreview() {
    document.getElementById('dataPreview').style.display = 'none';
}


// Export Functions
async function exportData(format) {
    if (!currentSessionId || currentData.length === 0) {
        showToast('No data to export', 'warning');
        return;
    }

    const body = { format };
    if (selectedColumns.length > 0) {
        body.columns = selectedColumns;
    }

    try {
        const response = await fetch(`/api/export/${currentSessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (response.ok) {
            triggerFileDownload(await response.blob(), `scraped_products_${currentSessionId}.${format}`);
            showToast(`Data exported as ${format.toUpperCase()}`, 'success');
        } else {
            throw new Error((await response.json()).error || 'Export failed');
        }
    } catch (error) {
        showToast(`Export error: ${error.message}`, 'error');
    }
}

async function exportImagesZip() {
    if (!currentSessionId) {
        showToast('No session found for image export.', 'error');
        return;
    }
    try {
        const response = await fetch(`/api/export/${currentSessionId}/images`);
        if (response.ok) {
            triggerFileDownload(await response.blob(), `scraped_images_${currentSessionId}.zip`);
            showToast('Images exported as ZIP file', 'success');
        } else {
            const error = await response.json();
            showToast(error.error.includes('No images found') ? 'No images were downloaded for this session.' : `Export error: ${error.error}`, 'warning');
        }
    } catch (error) {
        showToast(`Export error: ${error.message}`, 'error');
    }
}

function triggerFileDownload(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}


// Utility & Helper Functions
function setControlsState(enabled, hasData = false) {
    scrapeBtn.disabled = !enabled;
    urlInput.disabled = !enabled;
    stopBtn.disabled = enabled;
    
    exportCsv.disabled = !hasData;
    exportExcel.disabled = !hasData;
    exportJson.disabled = !hasData;
    exportImages.disabled = !hasData;
    selectColumnsBtn.disabled = !hasData;

    scrapeBtn.innerHTML = enabled ? '<i class="fas fa-play"></i> Start Scraping' : '<span class="spinner"></span> Scraping...';
}

function setButtonLoading(button, isLoading, loadingText) {
    button.disabled = isLoading;
    button.innerHTML = isLoading ? `<span class="spinner"></span> ${loadingText}` : loadingText;
}

function showValidation(message, type) {
    validationResult.textContent = message;
    validationResult.className = `url-validation ${type}`;
    validationResult.style.display = 'block';
    setTimeout(() => { validationResult.style.display = 'none'; }, 5000);
}

function showToast(message, type = 'info') {
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());

    const toast = document.createElement('div');
    toast.className = `toast toast-${type} fade-in`;
    toast.innerHTML = `<i class="fas fa-${{success: 'check-circle', error: 'exclamation-circle', warning: 'exclamation-triangle', info: 'info-circle'}[type]}"></i><span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function truncateText(text, maxLength) {
    return text.length > maxLength ? text.substr(0, maxLength) + '...' : text;
}

function formatPrice(price) {
    return typeof price === 'number' ? `$${price.toFixed(2)}` : (price || 'N/A');
}

// Dynamically inject required styles
const dynamicStyles = `
    .toast { position: fixed; bottom: 20px; right: 20px; padding: 15px 20px; border-radius: 10px; color: white; display: flex; align-items: center; gap: 10px; z-index: 10000; box-shadow: 0 5px 15px rgba(0,0,0,0.2); min-width: 300px; }
    .toast-success { background: linear-gradient(135deg, #00b09b, #96c93d); }
    .toast-error { background: linear-gradient(135deg, #ff416c, #ff4b2b); }
    .toast-warning { background: linear-gradient(135deg, #f7971e, #ffd200); }
    .toast-info { background: linear-gradient(135deg, #4facfe, #00f2fe); }
    .url-validation.info { background-color: #e0f0ff; color: #004085; border-left: 5px solid #007bff; }
    .toast.fade-out { opacity: 0; transform: translateY(20px); transition: all 0.3s ease; }
    .status-badge { padding: 6px 12px; border-radius: 20px; font-size: 0.9rem; font-weight: 600; }
    .status-running { background: rgba(33, 150, 243, 0.2); color: #1976d2; border: 1px solid #2196f3; }
    .status-completed { background: rgba(102, 187, 106, 0.2); color: #2e7d32; border: 1px solid #66bb6a; }
    .status-error, .status-stopped { background: rgba(239, 83, 80, 0.2); color: #c62828; border: 1px solid #ef5350; }
    .status-idle { background: rgba(158, 158, 158, 0.2); color: #424242; border: 1px solid #9e9e9e; }
    .checkbox-group { display: block; margin-bottom: 10px; }
    .checkbox-group input { margin-right: 10px; }
`;
const styleSheet = document.createElement("style");
styleSheet.textContent = dynamicStyles;
document.head.appendChild(styleSheet);