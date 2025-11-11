const ENHANCED_HOOK_KEY = Symbol('enhancedHooksInstalled');

const getStableId = (img = {}) => img.fullPath || img.relativePath || img.id || img.path;

const resolveImages = (ctx) => {
  if (typeof ctx?.getImages === 'function') {
    try {
      return ctx.getImages() || [];
    } catch {
      return [];
    }
  }
  const fallback = ctx?.imageManipulator?.images || ctx?.controller?.imageManipulator?.images;
  return Array.isArray(fallback) ? fallback : [];
};

const updateStatistics = (manipulator) => {
  const images = manipulator.images || [];
  const total = images.length;
  const processed = images.filter((img) => img.hasOCRResults).length;
  const remaining = total - processed;

  const totalEl = document.getElementById('statTotal');
  const processedEl = document.getElementById('statProcessed');
  const remainingEl = document.getElementById('statRemaining');
  if (totalEl) totalEl.textContent = total;
  if (processedEl) processedEl.textContent = processed;
  if (remainingEl) remainingEl.textContent = remaining;
};

const applyFilter = (manipulator, filter) => {
  if (!manipulator) return;
  manipulator.currentFilter = filter;
  const cards = document.querySelectorAll('.image-card');
  cards.forEach((card) => {
    const index = parseInt(card.dataset.index, 10);
    const image = manipulator.images[index];
    if (!image) {
      card.style.display = '';
      return;
    }

    let shouldShow = true;
    if (filter === 'processed') {
      shouldShow = image.hasOCRResults === true;
    } else if (filter === 'unprocessed') {
      shouldShow = image.hasOCRResults !== true;
    }
    card.style.display = shouldShow ? '' : 'none';
  });

  updateStatistics(manipulator);
};

const installRenderHooks = (manipulator) => {
  if (!manipulator || manipulator[ENHANCED_HOOK_KEY]) return;
  const originalRender = manipulator.renderImages?.bind(manipulator);
  const originalCreateCard = manipulator.createImageCard?.bind(manipulator);

  if (typeof originalRender === 'function') {
    manipulator.renderImages = function patchedRenderImages(...args) {
      const result = originalRender(...args);
      if (typeof manipulator.applyFilter === 'function') {
        manipulator.applyFilter(manipulator.currentFilter || 'all');
      } else {
        updateStatistics(manipulator);
      }
      return result;
    };
  }

  if (typeof originalCreateCard === 'function') {
    manipulator.createImageCard = function patchedCreateCard(image, index) {
      const card = originalCreateCard(image, index);
      if (image?.hasOCRResults) {
        const infoSection = card.querySelector('.image-info');
        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn-view-ocr';
        viewBtn.innerHTML = '<i class="fas fa-eye"></i> View Results';
        viewBtn.title = 'View OCR Results';
        viewBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          const viewer = manipulator.ocrViewer || window.ocrViewer;
          if (viewer && typeof viewer.open === 'function') {
            viewer.open(image.fullPath || image.relativePath);
          }
        });

        if (infoSection) {
          infoSection.insertBefore(viewBtn, infoSection.querySelector('.image-controls'));
        } else {
          card.appendChild(viewBtn);
        }
      }
      return card;
    };
  }

  manipulator[ENHANCED_HOOK_KEY] = true;
};

const wireFilterControls = (manipulator) => {
  const container = document.querySelector('.batch-filter-controls');
  if (!container || container.dataset.enhancedFilters === 'true') return;
  container.dataset.enhancedFilters = 'true';

  container.querySelectorAll('.filter-btn').forEach((button) => {
    button.addEventListener('click', (event) => {
      const target = event.currentTarget;
      const filter = target.dataset.filter || 'all';
      applyFilter(manipulator, filter);
      container.querySelectorAll('.filter-btn').forEach((btn) => btn.classList.remove('active'));
      target.classList.add('active');
    });
  });
};

const readPresetCount = () => {
  const presetDropdown = document.getElementById('presetCount');
  const customInput = document.getElementById('customCount');
  if (!presetDropdown) return 20;

  if (presetDropdown.value === 'custom' && customInput) {
    const customValue = parseInt(customInput.value, 10);
    return Number.isFinite(customValue) && customValue > 0 ? customValue : 20;
  }

  const presetValue = parseInt(presetDropdown.value, 10);
  return Number.isFinite(presetValue) && presetValue > 0 ? presetValue : 20;
};

const wireQuickSelectControls = (controller, ctx) => {
  const selection = controller?.batchSelection;
  if (!selection) return;

  const getImages = () => resolveImages(ctx);
  const mutateSelection = (ids) => {
    selection.clearAll();
    selection.selectMany(ids);
  };

  const allBtn = document.getElementById('selectUnprocessedBtn');
  if (allBtn && allBtn.dataset.enhanced !== 'true') {
    allBtn.dataset.enhanced = 'true';
    allBtn.addEventListener('click', () => {
      const ids = getImages()
        .filter((img) => !img.hasOCRResults)
        .map(getStableId)
        .filter(Boolean);
      mutateSelection(ids);
    });
  }

  const presetDropdown = document.getElementById('presetCount');
  const customInput = document.getElementById('customCount');
  if (presetDropdown && customInput && presetDropdown.dataset.enhanced !== 'true') {
    presetDropdown.dataset.enhanced = 'true';
    presetDropdown.addEventListener('change', (event) => {
      if (event.target.value === 'custom') {
        customInput.classList.remove('hidden');
        customInput.focus();
      } else {
        customInput.classList.add('hidden');
      }
    });
  }

  const nextBtn = document.getElementById('selectNextBtn');
  if (nextBtn && nextBtn.dataset.enhanced !== 'true') {
    nextBtn.dataset.enhanced = 'true';
    nextBtn.addEventListener('click', () => {
      const count = readPresetCount();
      const ids = getImages()
        .filter((img) => !img.hasOCRResults)
        .slice(0, count)
        .map(getStableId)
        .filter(Boolean);
      mutateSelection(ids);
      if (ids.length < count) {
        console.info(`Requested ${count} items but only ${ids.length} unprocessed images exist.`);
      }
    });
  }
};

export function setupBatchControls(ctx = {}) {
  const controller = ctx.controller;
  const manipulator = ctx.imageManipulator || controller?.imageManipulator || window.imageManipulator;
  if (!controller || !manipulator) return;

  manipulator.applyFilter = (filter) => applyFilter(manipulator, filter || 'all');
  manipulator.updateStatistics = () => updateStatistics(manipulator);

  installRenderHooks(manipulator);
  wireFilterControls(manipulator);
  wireQuickSelectControls(controller, ctx);
  manipulator.updateStatistics();
}
