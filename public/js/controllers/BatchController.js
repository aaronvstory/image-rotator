// BatchController.js - Batch processing controls (classic script variant)
(function () {
    function getStableSelectionId(image) {
        if (!image || typeof image !== 'object') return null;
        return image.fullPath || image.relativePath || image.path || image.id || null;
    }

    function BatchController(imageManipulator) {
        this.imageManipulator = imageManipulator || null;
        this.batchSelection = window.BatchSelection ? new window.BatchSelection() : null;
        this.batchModal = window.BatchModal && this.imageManipulator
            ? new window.BatchModal(this.imageManipulator)
            : null;
        this.batchProgressClient = window.BatchProgress ? new window.BatchProgress() : null;
        this._batchStartInFlight = false;
    }

    BatchController.prototype.init = function () {
        if (!this.batchSelection) return;

        this.batchSelection.onChange(this.updateBatchUI.bind(this));

        const selectAllBtn = document.getElementById('selectAllBtn');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => this.batchSelection.selectAll());
        }

        const selectPageBtn = document.getElementById('selectPageBtn');
        if (selectPageBtn) {
            selectPageBtn.addEventListener('click', () => {
                if (!this.imageManipulator || typeof this.imageManipulator.getVisibleImages !== 'function') {
                    return;
                }
                const visible = this.imageManipulator.getVisibleImages();
                const ids = visible
                    .map(getStableSelectionId)
                    .filter(Boolean);
                this.batchSelection.selectMany(ids);
            });
        }

        const clearSelectionBtn = document.getElementById('clearSelectionBtn');
        if (clearSelectionBtn) {
            clearSelectionBtn.addEventListener('click', () => this.batchSelection.clearAll());
        }

        const startBatchBtn = document.getElementById('startBatchOCRBtn');
        if (startBatchBtn) {
            startBatchBtn.addEventListener('click', () => this.startBatchOCR());
        }
    };

    BatchController.prototype.updateAvailableImages = function (images) {
        if (!this.batchSelection) return;
        this.batchSelection.setAvailableImages(
            (Array.isArray(images) ? images : [])
                .map(getStableSelectionId)
                .filter(Boolean)
        );
    };

    /**
     * Update the batch UI elements (selection count, checkboxes).
     * Mirrors original ImageManipulator.updateBatchUI logic.
     */
    BatchController.prototype.updateBatchUI = function (selectionInfo) {
        if (!this.batchSelection) return;

        const info = selectionInfo || {
            selectedIds: this.batchSelection.getSelectedIds(),
            count: this.batchSelection.getSelectedCount(),
            allSelected: this.batchSelection.isAllSelected(),
            someSelected: this.batchSelection.isSomeSelected()
        };
        const count = info.count;

        const selectionCountEl = document.getElementById('selectionCount');
        if (selectionCountEl) {
            selectionCountEl.textContent = count;
        }

        const startBtn = document.getElementById('startBatchOCRBtn');
        if (startBtn) {
            startBtn.disabled = count === 0;
        }

        const images = (this.imageManipulator && Array.isArray(this.imageManipulator.images))
            ? this.imageManipulator.images
            : [];

        images.forEach(image => {
            const selectionId = getStableSelectionId(image);
            if (!selectionId) return;
            const encodedSelectionId = encodeURIComponent(selectionId);
            const checkbox = document.querySelector(`input[data-image-id="${encodedSelectionId}"]`);
            if (checkbox) {
                checkbox.checked = this.batchSelection.isSelected(selectionId);
            }
        });
    };

    BatchController.prototype.processImageCard = function (card) {
        if (!card || !this.batchSelection) return;
        const checkbox = card.querySelector('.batch-checkbox');
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                const decodedId = decodeURIComponent(checkbox.dataset.imageId || '');
                if (decodedId) {
                    this.batchSelection.toggleImage(decodedId);
                }
            });
        }
    };

    BatchController.prototype.startBatchOCR = async function () {
        if (this._batchStartInFlight) return;

        if (!this.batchSelection || !this.batchModal || !this.batchProgressClient) {
            if (this.imageManipulator && typeof this.imageManipulator.showError === 'function') {
                this.imageManipulator.showError('Batch processing modules not initialized yet. Please refresh and try again.');
            }
            return;
        }

        const startBtn = document.getElementById('startBatchOCRBtn');
        this._batchStartInFlight = true;
        if (startBtn) startBtn.disabled = true;

        const resetState = () => {
            this._batchStartInFlight = false;
            if (startBtn) {
                const selectedCount = this.batchSelection ? this.batchSelection.getSelectedCount() : 0;
                startBtn.disabled = selectedCount === 0;
            }
        };

        const sourceImages = (this.imageManipulator && Array.isArray(this.imageManipulator.images))
            ? this.imageManipulator.images
            : [];
        const selectedItems = this.batchSelection.getSelectedItems(sourceImages);

        if (selectedItems.length === 0) {
            if (this.imageManipulator && typeof this.imageManipulator.showError === 'function') {
                this.imageManipulator.showError('No images selected');
            }
            resetState();
            return;
        }

        try {
            const response = await fetch('/api/batch/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    items: selectedItems
                        .map(i => {
                            const p = getStableSelectionId(i);
                            return p ? { path: String(p), filename: i.filename || i.name || null } : null;
                        })
                        .filter(Boolean),
                    options: {
                        chunkSize: 50,
                        overwrite: 'skip'
                    }
                })
            });

            if (!response.ok) {
                let serverMessage = '';
                try {
                    const errorPayload = await response.json();
                    serverMessage = errorPayload?.error || JSON.stringify(errorPayload);
                } catch {
                    try {
                        serverMessage = await response.text();
                    } catch { }
                }
                const message = `Failed to start batch OCR (HTTP ${response.status}): ${serverMessage || response.statusText || 'Unknown error'}`;
                console.error(message);
                if (this.imageManipulator && typeof this.imageManipulator.showError === 'function') {
                    this.imageManipulator.showError(message);
                }
                return;
            }

            const data = await response.json();

            if (data.success) {
                this.batchModal.open(data.jobId, this.batchProgressClient);
            } else if (this.imageManipulator && typeof this.imageManipulator.showError === 'function') {
                this.imageManipulator.showError('Failed to start batch OCR: ' + data.error);
            }
        } catch (error) {
            console.error('Error starting batch OCR:', error);
            if (this.imageManipulator && typeof this.imageManipulator.showError === 'function') {
                this.imageManipulator.showError('Failed to start batch OCR');
            }
        } finally {
            resetState();
        }
    };

    window.BatchController = BatchController;
})();

