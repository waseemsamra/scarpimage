// Main JavaScript for Web Scraper
document.addEventListener('DOMContentLoaded', function() {
    // Initialize tooltips
    const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltips.forEach(tooltip => {
        new bootstrap.Tooltip(tooltip);
    });
    
    // Set up event listeners - ONLY Analyze button is active initially
    document.getElementById('analyzeBtn').addEventListener('click', analyzeWebsite);
    
    // Other buttons are disabled until analysis
    document.getElementById('scrapeBtn').disabled = true;
    document.getElementById('quickTestBtn').disabled = true;
    
    // Hide scraping section initially
    document.getElementById('scrapingSection').style.display = 'none';
    document.getElementById('quickTestResults').style.display = 'none';
    
    // Auto-focus URL input
    document.getElementById('url').focus();
});

// Global variables
let currentAnalysis = null;
let currentCategories = [];
let currentJobId = null;

// Analyze website - FIRST ACTION
async function analyzeWebsite() {
    const urlInput = document.getElementById('url');
    const url = urlInput.value.trim();
    
    if (!url) {
        showToast('Please enter a website URL', 'error');
        urlInput.focus();
        return;
    }
    
    const analyzeBtn = document.getElementById('analyzeBtn');
    const originalText = analyzeBtn.innerHTML;
    analyzeBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Analyzing...';
    analyzeBtn.disabled = true;
    
    // Clear previous results
    document.getElementById('analysisResults').innerHTML = '';
    document.getElementById('quickTestResults').innerHTML = '';
    document.getElementById('scrapingResults').innerHTML = '';
    document.getElementById('quickTestResults').style.display = 'none';
    
    // Show loading
    const resultsDiv = document.getElementById('analysisResults');
    resultsDiv.innerHTML = `
        <div class="card">
            <div class="card-body text-center py-5">
                <div class="spinner"></div>
                <h4 class="mt-3">Analyzing Website Structure</h4>
                <p class="text-muted">Detecting platform, categories, and selectors...</p>
                <div class="progress mt-3" style="height: 8px;">
                    <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: 100%"></div>
                </div>
            </div>
        </div>
    `;
    
    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: url })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentAnalysis = data.analysis;
            currentCategories = data.categories || [];
            
            displayAnalysis(data.analysis, data.categories);
            showToast('Website analysis completed!', 'success');
            
            // Enable other buttons
            document.getElementById('scrapeBtn').disabled = false;
            document.getElementById('quickTestBtn').disabled = false;
            
            // Show scraping section
            document.getElementById('scrapingSection').style.display = 'block';
            document.getElementById('scrapingSection').scrollIntoView({ behavior: 'smooth' });
            
        } else {
            resultsDiv.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Analysis Failed:</strong> ${data.error}
                    <p class="mt-2 mb-0">Please check the URL and try again.</p>
                </div>
            `;
            showToast('Analysis failed: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        resultsDiv.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Connection Error:</strong> ${error.message}
                <p class="mt-2 mb-0">Make sure the Flask server is running on port 5000</p>
            </div>
        `;
        showToast('Error: ' + error.message, 'error');
    } finally {
        analyzeBtn.innerHTML = originalText;
        analyzeBtn.disabled = false;
    }
}

// Display analysis results with categories
function displayAnalysis(analysis, categories) {
    const resultsDiv = document.getElementById('analysisResults');
    
    let html = `
        <div class="card">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h3 class="card-title mb-0">
                        <i class="fas fa-chart-bar me-2"></i>Analysis Results
                    </h3>
                    <span class="badge bg-success">${analysis.website_type || 'Website'}</span>
                </div>
                
                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <strong><i class="fas fa-globe me-2"></i>Website:</strong>
                            <a href="${analysis.url}" target="_blank" class="ms-2">${analysis.url}</a>
                        </div>
                        <div class="mb-3">
                            <strong><i class="fas fa-heading me-2"></i>Title:</strong>
                            <span class="ms-2">${analysis.title || 'No title found'}</span>
                        </div>
                        <div class="mb-3">
                            <strong><i class="fas fa-cogs me-2"></i>Platform:</strong>
                            <span class="badge ${analysis.platform === 'Shopify' ? 'bg-primary' : 'bg-info'} ms-2">
                                ${analysis.platform || 'Unknown'}
                            </span>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="mb-3">
                            <strong><i class="fas fa-box me-2"></i>Items Found:</strong>
                            <span class="badge ${analysis.item_count > 0 ? 'bg-success' : 'bg-warning'} ms-2">
                                ${analysis.item_count || 0} items
                            </span>
                        </div>
                        <div class="mb-3">
                            <strong><i class="fas fa-code me-2"></i>JSON-LD:</strong>
                            <span class="badge ${analysis.has_json_ld ? 'bg-success' : 'bg-secondary'} ms-2">
                                ${analysis.has_json_ld ? 'Present' : 'Not Found'}
                            </span>
                        </div>
                        <div class="mb-3">
                            <strong><i class="fas fa-bolt me-2"></i>Status:</strong>
                            <span class="badge bg-success ms-2">Ready to Scrape</span>
                        </div>
                    </div>
                </div>
    `;
    
    // Display categories
    if (categories && categories.length > 0) {
        html += `
            <div class="mb-4">
                <h5><i class="fas fa-folder me-2"></i>Detected Categories</h5>
                <div class="row mt-3">
        `;
        
        categories.forEach((category, index) => {
            html += `
                <div class="col-md-3 mb-3">
                    <div class="card category-card ${index === 0 ? 'border-primary' : ''}" 
                         onclick="selectCategory('${category.id}')"
                         style="cursor: pointer; ${index === 0 ? 'border: 2px solid #4361ee;' : ''}">
                        <div class="card-body text-center">
                            <i class="fas ${index === 0 ? 'fa-star text-warning' : 'fa-folder text-info'} fa-2x mb-3"></i>
                            <h6 class="card-title">${category.name}</h6>
                            <small class="text-muted">ID: ${category.id}</small>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
                <div class="mt-3">
                    <label for="categorySelect" class="form-label">Select Category to Scrape:</label>
                    <select class="form-select" id="categorySelect">
        `;
        
        categories.forEach(category => {
            html += `<option value="${category.id}">${category.name}</option>`;
        });
        
        html += `
                    </select>
                </div>
            </div>
        `;
    }
    
    // Display detected patterns
    if (analysis.detected_patterns && analysis.detected_patterns.length > 0) {
        html += `
            <div class="mb-3">
                <h5><i class="fas fa-search me-2"></i>Detected Patterns</h5>
                <div class="mt-2">
        `;
        
        analysis.detected_patterns.forEach(pattern => {
            html += `<span class="badge bg-secondary me-2 mb-2">${pattern}</span>`;
        });
        
        html += `
                </div>
            </div>
        `;
    }
    
    // Display suggested selectors
    if (analysis.suggested_selectors && Object.keys(analysis.suggested_selectors).length > 0) {
        html += `
            <div class="mb-3">
                <h5><i class="fas fa-code me-2"></i>Suggested CSS Selectors</h5>
                <p class="text-muted">These selectors will be used for scraping. You can modify them if needed.</p>
                <div class="row mt-3">
        `;
        
        for (const [key, value] of Object.entries(analysis.suggested_selectors)) {
            if (value) {
                html += `
                    <div class="col-md-4 mb-3">
                        <label class="form-label">${key.charAt(0).toUpperCase() + key.slice(1)} Selector:</label>
                        <input type="text" class="form-control selector-input" 
                               id="selector-${key}" value="${value}" 
                               placeholder="CSS selector for ${key}">
                        <small class="text-muted">Finds: ${key}s</small>
                    </div>
                `;
            }
        }
        
        html += `
                </div>
            </div>
        `;
    }
    
    // Display recommendations
    if (analysis.recommendations && analysis.recommendations.length > 0) {
        html += `
            <div class="mb-3">
                <h5><i class="fas fa-lightbulb me-2"></i>Recommendations</h5>
                <div class="alert alert-info">
                    <ul class="mb-0">
        `;
        
        analysis.recommendations.forEach(rec => {
            html += `<li>${rec}</li>`;
        });
        
        html += `
                    </ul>
                </div>
            </div>
        `;
    }
    
    // Show sample HTML if available
    if (analysis.sample_html) {
        html += `
            <div class="mb-3">
                <h5><i class="fas fa-code me-2"></i>Sample HTML Structure</h5>
                <div class="alert alert-secondary">
                    <p class="mb-2"><small>This is how one item looks in HTML:</small></p>
                    <pre class="bg-light p-3 rounded" style="max-height: 200px; overflow: auto; font-size: 0.8rem;">
${analysis.sample_html}
                    </pre>
                </div>
            </div>
        `;
    }
    
    html += `
            </div>
        </div>
    `;
    
    resultsDiv.innerHTML = html;
    
    // Enable category selection
    setupCategorySelection();
}

// Setup category selection
function setupCategorySelection() {
    const categorySelect = document.getElementById('categorySelect');
    if (categorySelect) {
        categorySelect.addEventListener('change', function() {
            const selectedCategory = this.value;
            showToast(`Selected category: ${this.options[this.selectedIndex].text}`, 'info');
        });
    }
}

// Select category
function selectCategory(categoryId) {
    const categorySelect = document.getElementById('categorySelect');
    if (categorySelect) {
        categorySelect.value = categoryId;
        
        // Highlight selected card
        document.querySelectorAll('.category-card').forEach(card => {
            card.style.border = '1px solid #dee2e6';
        });
        
        const selectedCard = document.querySelector(`[onclick="selectCategory('${categoryId}')"]`);
        if (selectedCard) {
            selectedCard.style.border = '2px solid #4361ee';
        }
        
        showToast(`Selected category: ${categoryId}`, 'info');
    }
}

// Start scraping with category
async function startScraping() {
    if (!currentAnalysis) {
        showToast('Please analyze website first', 'warning');
        return;
    }
    
    // Get selected category
    const categorySelect = document.getElementById('categorySelect');
    const selectedCategory = categorySelect ? categorySelect.value : 'all';
    
    if (!selectedCategory) {
        showToast('Please select a category', 'warning');
        return;
    }
    
    // Get selectors from inputs
    const selectors = {};
    const selectorTypes = ['container', 'title', 'price', 'image', 'link', 'description'];
    
    selectorTypes.forEach(type => {
        const input = document.getElementById(`selector-${type}`);
        if (input && input.value) {
            selectors[type] = input.value;
        }
    });
    
    // If no selectors entered, use suggested ones
    if (Object.keys(selectors).length === 0) {
        selectors = currentAnalysis.suggested_selectors || {};
    }
    
    const scrapeBtn = document.getElementById('scrapeBtn');
    const originalText = scrapeBtn.innerHTML;
    scrapeBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Starting...';
    scrapeBtn.disabled = true;
    
    const scrapingResults = document.getElementById('scrapingResults');
    scrapingResults.innerHTML = `
        <div class="card">
            <div class="card-body text-center py-5">
                <div class="spinner"></div>
                <h4 class="mt-3">Preparing Scraping Job</h4>
                <p class="text-muted">Category: ${selectedCategory}</p>
            </div>
        </div>
    `;
    
    try {
        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: currentAnalysis.url,
                category: selectedCategory,
                selectors: selectors
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentJobId = data.job_id;
            showToast(`Scraping job started for ${selectedCategory} category!`, 'success');
            
            // Start monitoring the job
            monitorJob(data.job_id, selectedCategory);
            
        } else {
            scrapingResults.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Failed to start scraping:</strong> ${data.error}
                </div>
            `;
            showToast('Failed to start scraping: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        scrapingResults.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Connection Error:</strong> ${error.message}
            </div>
        `;
        showToast('Error: ' + error.message, 'error');
    } finally {
        scrapeBtn.innerHTML = originalText;
        scrapeBtn.disabled = false;
    }
}

// Monitor scraping job with category
async function monitorJob(jobId, category) {
    const scrapingResults = document.getElementById('scrapingResults');
    
    const interval = setInterval(async () => {
        try {
            const response = await fetch(`/api/job/${jobId}`);
            const job = await response.json();
            
            // Update progress
            const progressDiv = document.getElementById('progressSection');
            if (!progressDiv.innerHTML.includes('progress')) {
                progressDiv.innerHTML = `
                    <div class="card">
                        <div class="card-body">
                            <h5><i class="fas fa-sync-alt me-2"></i>Scraping Progress</h5>
                            <p class="text-muted">Category: ${category}</p>
                            <div class="progress-container">
                                <div class="progress">
                                    <div class="progress-bar progress-bar-striped progress-bar-animated" 
                                         role="progressbar" style="width: ${job.progress}%"></div>
                                </div>
                                <div class="d-flex justify-content-between mt-2">
                                    <span><i class="fas fa-box me-1"></i> ${job.scraped_items || 0}/${job.total_items || 0} items</span>
                                    <span><strong>${job.progress}%</strong></span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                const progressBar = progressDiv.querySelector('.progress-bar');
                if (progressBar) {
                    progressBar.style.width = job.progress + '%';
                }
                const countSpan = progressDiv.querySelector('span:first-child');
                if (countSpan) {
                    countSpan.innerHTML = `<i class="fas fa-box me-1"></i> ${job.scraped_items || 0}/${job.total_items || 0} items`;
                }
            }
            
            // Check job status
            if (job.status === 'completed') {
                clearInterval(interval);
                showToast(`Scraping completed for ${category}!`, 'success');
                getJobData(jobId, category);
            } else if (job.status === 'error') {
                clearInterval(interval);
                scrapingResults.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <strong>Scraping Error:</strong> ${job.error_message}
                    </div>
                `;
                showToast('Scraping failed: ' + job.error_message, 'error');
            }
            
        } catch (error) {
            console.error('Error monitoring job:', error);
        }
    }, 2000);
}

// Get job data with category
async function getJobData(jobId, category) {
    try {
        const response = await fetch(`/api/job/${jobId}/data`);
        const data = await response.json();
        
        if (data.success) {
            displayScrapedData(data.data, data.download_url, category);
        }
    } catch (error) {
        console.error('Error getting job data:', error);
    }
}

// Display scraped data with category
function displayScrapedData(data, downloadUrl, category) {
    const scrapingResults = document.getElementById('scrapingResults');
    
    let html = `
        <div class="card">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h3 class="card-title mb-0">
                            <i class="fas fa-database me-2"></i>Scraped Data
                            <span class="badge bg-primary ms-2">${data.length} items</span>
                        </h3>
                        <p class="text-muted mb-0">Category: ${category}</p>
                    </div>
    `;
    
    if (downloadUrl) {
        html += `
            <a href="${downloadUrl}" class="btn btn-success btn-lg" download>
                <i class="fas fa-download me-2"></i>Download Excel
            </a>
        `;
    }
    
    html += `
                </div>
    `;
    
    if (data.length > 0) {
        html += `
            <div class="alert alert-success">
                <i class="fas fa-check-circle me-2"></i>
                Successfully scraped ${data.length} items from ${category} category.
                ${downloadUrl ? 'Click the download button to get the Excel file.' : ''}
            </div>
            
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Title</th>
                            <th>Price</th>
                            <th>Image</th>
                            <th>Link</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        data.forEach((item, index) => {
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${item.title || 'Untitled'}</strong></td>
                    <td><span class="badge bg-success">${item.price || 'N/A'}</span></td>
                    <td>
                        ${item.image_url ? 
                            `<img src="${item.image_url}" alt="${item.title || 'Item'}" 
                                  style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;">` : 
                            '<i class="fas fa-image text-muted"></i>'
                        }
                    </td>
                    <td>
                        ${item.link_url ? 
                            `<a href="${item.link_url}" target="_blank" class="btn btn-sm btn-outline-primary">
                                <i class="fas fa-external-link-alt"></i>
                            </a>` : 
                            '<span class="text-muted">No link</span>'
                        }
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        // Show data preview
        html += `
            <div class="mt-4">
                <h5><i class="fas fa-eye me-2"></i>Data Preview</h5>
                <pre class="bg-light p-3 rounded" style="max-height: 200px; overflow: auto; font-size: 0.8rem;">
${JSON.stringify(data.slice(0, 3), null, 2)}
                </pre>
            </div>
        `;
    } else {
        html += `
            <div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle me-2"></i>
                No data scraped from ${category} category. Try adjusting the selectors or choose a different category.
            </div>
        `;
    }
    
    html += `
            </div>
        </div>
    `;
    
    scrapingResults.innerHTML = html;
}

// Quick test with category
async function quickTest() {
    if (!currentAnalysis) {
        showToast('Please analyze website first', 'warning');
        return;
    }
    
    // Get selected category
    const categorySelect = document.getElementById('categorySelect');
    const selectedCategory = categorySelect ? categorySelect.value : 'all';
    
    const quickTestBtn = document.getElementById('quickTestBtn');
    const originalText = quickTestBtn.innerHTML;
    quickTestBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Testing...';
    quickTestBtn.disabled = true;
    
    const quickTestResults = document.getElementById('quickTestResults');
    quickTestResults.style.display = 'block';
    quickTestResults.innerHTML = `
        <div class="card">
            <div class="card-body text-center py-5">
                <div class="spinner"></div>
                <h4 class="mt-3">Quick Testing</h4>
                <p class="text-muted">Testing ${selectedCategory} category...</p>
            </div>
        </div>
    `;
    
    try {
        const response = await fetch('/api/quick-test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                url: currentAnalysis.url,
                category: selectedCategory
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayQuickTestResults(data.data, data.count, selectedCategory);
            showToast(`Quick test successful! Found ${data.count} items.`, 'success');
        } else {
            quickTestResults.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Test Failed:</strong> ${data.error}
                </div>
            `;
            showToast('Test failed: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        quickTestResults.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Connection Error:</strong> ${error.message}
            </div>
        `;
        showToast('Error: ' + error.message, 'error');
    } finally {
        quickTestBtn.innerHTML = originalText;
        quickTestBtn.disabled = false;
    }
}

// Display quick test results with category
function displayQuickTestResults(data, count, category) {
    const quickTestResults = document.getElementById('quickTestResults');
    
    let html = `
        <div class="card">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h3 class="card-title mb-0">
                        <i class="fas fa-bolt me-2"></i>Quick Test Results
                        <span class="badge bg-primary ms-2">${count} items</span>
                    </h3>
                    <span class="badge bg-info">Category: ${category}</span>
                </div>
    `;
    
    if (data.length > 0) {
        html += `
            <div class="alert alert-success">
                <i class="fas fa-check-circle me-2"></i>
                Quick test successful! Found ${count} items in ${category} category.
            </div>
            
            <div class="results-grid">
        `;
        
        data.forEach((item, index) => {
            html += `
                <div class="result-card">
                    <div class="result-image">
                        ${item.image_url ? 
                            `<img src="${item.image_url}" alt="${item.title || 'Item'}" 
                                  style="width: 100%; height: 100%; object-fit: cover;">` : 
                            `<div class="d-flex align-items-center justify-content-center h-100">
                                <i class="fas fa-image fa-3x text-muted"></i>
                            </div>`
                        }
                    </div>
                    <div class="result-content">
                        <h4 class="result-title">${item.title || 'Untitled'}</h4>
                        ${item.price ? `<div class="result-price">${item.price}</div>` : ''}
                        ${item.link_url ? 
                            `<a href="${item.link_url}" target="_blank" class="btn btn-sm btn-outline-primary w-100 mt-2">
                                <i class="fas fa-external-link-alt me-2"></i>View Product
                            </a>` : ''
                        }
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
    } else {
        html += `
            <div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle me-2"></i>
                No items found in ${category} category during quick test.
                Try selecting a different category or check if the website has products.
            </div>
        `;
    }
    
    html += `
            </div>
        </div>
    `;
    
    quickTestResults.innerHTML = html;
}

// Toast notification
function showToast(message, type = 'info') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 
                 type === 'error' ? 'fa-exclamation-circle' : 
                 type === 'warning' ? 'fa-exclamation-triangle' : 
                 'fa-info-circle';
    
    const iconColor = type === 'success' ? '#28a745' : 
                     type === 'error' ? '#dc3545' : 
                     type === 'warning' ? '#ffc107' : 
                     '#17a2b8';
    
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="fas ${icon} me-3" style="color: ${iconColor};"></i>
            <div>${message}</div>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Auto remove
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 3000);
}

// Clear all results
function clearAll() {
    document.getElementById('url').value = '';
    document.getElementById('analysisResults').innerHTML = '';
    document.getElementById('quickTestResults').innerHTML = '';
    document.getElementById('scrapingResults').innerHTML = '';
    document.getElementById('progressSection').innerHTML = '';
    document.getElementById('scrapingSection').style.display = 'none';
    document.getElementById('quickTestResults').style.display = 'none';
    
    // Disable buttons
    document.getElementById('scrapeBtn').disabled = true;
    document.getElementById('quickTestBtn').disabled = true;
    
    // Reset variables
    currentAnalysis = null;
    currentCategories = [];
    currentJobId = null;
    
    showToast('All cleared. Enter a new website URL to start.', 'info');
    document.getElementById('url').focus();
}