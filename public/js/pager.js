/**
 * Lightweight client-side pagination helper for large image lists.
 */
export default class Pager {
  constructor(pageSize = 150) {
    this.pageSize = this.#normalizePageSize(pageSize);
    this.page = 1;
    this.total = 0;
  }

  #normalizePageSize(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 150;
    return Math.max(50, Math.min(500, Math.round(parsed)));
  }

  setPageSize(value) {
    this.pageSize = this.#normalizePageSize(value);
    this.page = 1;
  }

  setTotal(total) {
    const parsed = Number(total);
    this.total = Math.max(0, Number.isFinite(parsed) ? parsed : 0);
    const pageCount = this.getPageCount();
    if (this.page > pageCount) {
      this.page = pageCount || 1;
    }
  }

  getPageCount() {
    if (!this.pageSize) return 1;
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  canPrev() {
    return this.page > 1;
  }

  canNext() {
    return this.page < this.getPageCount();
  }

  goTo(page) {
    const parsed = Number(page);
    const max = this.getPageCount();
    if (!Number.isFinite(parsed)) {
      this.page = 1;
      return;
    }
    this.page = Math.max(1, Math.min(max, Math.floor(parsed)));
  }

  next() {
    if (this.canNext()) {
      this.page += 1;
    }
  }

  prev() {
    if (this.canPrev()) {
      this.page -= 1;
    }
  }

  getVisible(items = []) {
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }
    const start = (this.page - 1) * this.pageSize;
    return items.slice(start, start + this.pageSize);
  }
}
