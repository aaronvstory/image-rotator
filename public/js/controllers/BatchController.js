// BatchController.js - Module for batch processing controls
import BatchSelection from '../batch-selection.js';
import BatchModal from '../batch-modal.js';
import BatchProgress from '../batch-progress.js';

export default class BatchController {
    constructor(imageManipulator) {
        this.imageManipulator = imageManipulator;
        this.batchSelection = new BatchSelection();
        this.batchModal = new BatchModal(this.imageManipulator);
        this.batchProgressClient = new BatchProgress();
        this._batchStartInFlight = false;
    }

    init() {
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
                    .map(img => img.fullPath || img.relativePath || img.id)
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
    }

    updateAvailableImages(images) {
        this.batchSelection.setAvailableImages(
            images.map(img => img.fullPath || img.relativePath || img.id).filter(Boolean)
        );
    }

    /**
     * Update the batch UI elements (selection count, checkboxes).
     * Mirrors original ImageManipulator.updateBatchUI logic.
     */
    updateBatchUI(selectionInfo) {
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

        this.imageManipulator.images.forEach(image => {
            const selectionId = image.fullPath || image.relativePath || image.id;
            const encodedSelectionId = encodeURIComponent(selectionId);
            const checkbox = document.querySelector(`input[data-image-id="${encodedSelectionId}"]`);
            if (checkbox) {
                checkbox.checked = this.batchSelection.isSelected(selectionId);
            }
        });
    }

    processImageCard(card, image) {
        const checkbox = card.querySelector('.batch-checkbox');
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                const decodedId = decodeURIComponent(checkbox.dataset.imageId || '');
                this.batchSelection.toggleImage(decodedId);
            });
        }
    }

    async startBatchOCR() {
        if (this._batchStartInFlight) return;

        if (!this.batchSelection || !this.batchModal || !this.batchProgressClient) {
            this.imageManipulator.showError('Batch processing modules not initialized yet. Please refresh and try again.');
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

        const selectedItems = this.batchSelection.getSelectedItems(this.imageManipulator.images);

        if (selectedItems.length === 0) {
            this.imageManipulator.showError('No images selected');
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
                            const p = i.fullPath || i.relativePath || i.path || i.id;
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
                } catch (parseError) {
                    try {
                        serverMessage = await response.text();
                    } catch { }
                }
                const message = `Failed to start batch OCR (HTTP ${response.status}): ${serverMessage || response.statusText || 'Unknown error'}`;
                console.error(message);
                this.imageManipulator.showError(message);
                return;
            }

            const data = await response.json();

            if (data.success) {
                this.batchModal.open(data.jobId, this.batchProgressClient);
            } else {
                this.imageManipulator.showError('Failed to start batch OCR: ' + data.error);
            }
        } catch (error) {
            console.error('Error starting batch OCR:', error);
            this.imageManipulator.showError('Failed to start batch OCR');
        } finally {
            resetState();
        }
    }
}

// End of BatchController.js

