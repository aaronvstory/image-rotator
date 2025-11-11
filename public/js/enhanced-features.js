/**
 * Enhanced Features - Filters, Statistics, and Advanced Selection
 */

// Extend ImageManipulator with new methods
(function() {
    const IM = window.ImageManipulator;
    if (!IM) return;

    // Extend ImageManipulator with new methods
    const originalSetupBatchControls = IM.prototype.setupBatchControls;

    IM.prototype.setupBatchControls = function() {
        // Call original setup
        if (originalSetupBatchControls) {
            originalSetupBatchControls.call(this);
        }

        // Setup filter buttons
        const filterContainer = document.querySelector('.batch-filter-controls');
        if (filterContainer) {
            filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const filter = e.currentTarget.dataset.filter;
                    this.applyFilter(filter);

                    filterContainer.querySelectorAll('.filter-btn').forEach(b => {
                        b.classList.remove('active');
                    });
                    e.currentTarget.classList.add('active');
                });
            });
        }

        document.getElementById('selectUnprocessedBtn')?.addEventListener('click', () => {
            this.selectAllUnprocessed();
        });

        const presetDropdown = document.getElementById('presetCount');
        const customInput = document.getElementById('customCount');
        if (presetDropdown && customInput) {
            presetDropdown.addEventListener('change', (e) => {
                if (e.target.value === 'custom') {
                    customInput.classList.remove('hidden');
                    customInput.focus();
                } else {
                    customInput.classList.add('hidden');
                }
            });
        }

        document.getElementById('selectNextBtn')?.addEventListener('click', () => {
            this.selectNextUnprocessed();
        });
    };

    // Apply filter to image grid
    IM.prototype.applyFilter = function(filter) {
        this.currentFilter = filter;

        const cards = document.querySelectorAll('.image-card');
        cards.forEach((card, index) => {
            const image = this.images[index];
            if (!image) return;

            let shouldShow = true;

            if (filter === 'processed') {
                shouldShow = image.hasOCRResults === true;
            } else if (filter === 'unprocessed') {
                shouldShow = image.hasOCRResults !== true;
            }

            card.style.display = shouldShow ? '' : 'none';
        });

        // Update statistics after filtering
        this.updateStatistics();
    };

    // Update statistics banner
    IM.prototype.updateStatistics = function() {
        const total = this.images.length;
        const processed = this.images.filter(img => img.hasOCRResults).length;
        const remaining = total - processed;

        const totalEl = document.getElementById('statTotal');
        const processedEl = document.getElementById('statProcessed');
        const remainingEl = document.getElementById('statRemaining');
        if (totalEl) totalEl.textContent = total;
        if (processedEl) processedEl.textContent = processed;
        if (remainingEl) remainingEl.textContent = remaining;
    };

    // Select all unprocessed images
    IM.prototype.selectAllUnprocessed = function() {
        this.batchSelection.clearAll();

        const unprocessedIds = this.images
            .filter(img => !img.hasOCRResults)
            .map(img => img.fullPath);

        unprocessedIds.forEach(id => {
            this.batchSelection.selectedIds.add(id);
        });

        this.batchSelection._notifyChange();
    };

    // Select next X unprocessed images
    IM.prototype.selectNextUnprocessed = function() {
        const presetDropdown = document.getElementById('presetCount');
        const customInput = document.getElementById('customCount');
        if (!presetDropdown || !customInput) return;

        let count;
        if (presetDropdown.value === 'custom') {
            count = parseInt(customInput.value) || 20;
        } else {
            count = parseInt(presetDropdown.value);
        }

        // Clear current selection
        this.batchSelection.clearAll();

        // Find unprocessed images
        const unprocessedImages = this.images.filter(img => !img.hasOCRResults);

        // Select next X
        const toSelect = unprocessedImages.slice(0, count);
        toSelect.forEach(img => {
            this.batchSelection.selectedIds.add(img.fullPath);
        });

        this.batchSelection._notifyChange();

        // Show feedback
        if (toSelect.length < count) {
            alert(`Only ${toSelect.length} unprocessed images available (requested ${count})`);
        }
    };

    // View OCR results for an image
    IM.prototype.viewOCRResults = function(imagePath) {
        if (!this.ocrViewer || typeof this.ocrViewer.open !== 'function') {
            console.warn('OCR Viewer is not available');
            return;
        }
        this.ocrViewer.open(imagePath);
    };

    // Override renderImages to add statistics
    const originalRenderImages = IM.prototype.renderImages;
    IM.prototype.renderImages = function() {
        originalRenderImages.call(this);
        if (typeof this.applyFilter === 'function' && this.currentFilter) {
            this.applyFilter(this.currentFilter);
        } else {
            this.updateStatistics();
        }
    };

    // Override createImageCard to add View Results button
    const originalCreateImageCard = IM.prototype.createImageCard;
    IM.prototype.createImageCard = function(image, index) {
        const card = originalCreateImageCard.call(this, image, index);

        // Add "View Results" button if OCR results exist
        if (image.hasOCRResults) {
            const infoSection = card.querySelector('.image-info');
            const viewBtn = document.createElement('button');
            viewBtn.className = 'btn-view-ocr';
            viewBtn.innerHTML = '<i class="fas fa-eye"></i> View Results';
            viewBtn.title = 'View OCR Results';
            viewBtn.onclick = (e) => {
                e.stopPropagation();
                this.viewOCRResults(image.fullPath);
            };

            // Insert before controls
            if (infoSection) {
                const controls = infoSection.querySelector('.image-controls');
                if (controls) {
                    infoSection.insertBefore(viewBtn, controls);
                } else {
                    infoSection.appendChild(viewBtn);
                }
            } else {
                card.appendChild(viewBtn);
            }
        }

        return card;
    };
})();
