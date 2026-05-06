class Autocomplete {
    static optionsCache = new Map();
    static isGlobalOutsideClickBound = false;

    static closeAllVisible(exceptList = null) {
        document.querySelectorAll('.autocomplete-list.visible').forEach((listEl) => {
            if (listEl !== exceptList) {
                listEl.classList.remove('visible');
            }
        });
    }

    static ensureGlobalOutsideClickHandler() {
        if (Autocomplete.isGlobalOutsideClickBound) return;

        document.addEventListener('click', (event) => {
            const target = event.target;
            const clickedInsideAutocomplete = Boolean(
                target &&
                typeof target.closest === 'function' &&
                (target.closest('.autocomplete-wrapper') || target.closest('.autocomplete-list'))
            );

            if (!clickedInsideAutocomplete) {
                Autocomplete.closeAllVisible();
            }
        }, true);

        Autocomplete.isGlobalOutsideClickBound = true;
    }

    constructor(selectElement) {
        this.selectElement = selectElement;
        this.options = [];
        this.selectedIndex = -1;
        this.forceOpenDown = this.selectElement.classList.contains('autocomplete-force-down');
        this.showAllOnClick = this.selectElement.classList.contains('autocomplete-show-all-on-click');
        
        this.init();
    }

    init() {
        // Hide original select
        this.selectElement.style.display = 'none';
        this.useBodyPortal = this.selectElement.classList.contains('item-select');

        // Create wrapper
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'autocomplete-wrapper';
        this.selectElement.parentNode.insertBefore(this.wrapper, this.selectElement);
        this.wrapper.appendChild(this.selectElement);

        // Create input
        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.className = 'autocomplete-input';
        this.input.placeholder = 'ابحث...';
        this.wrapper.appendChild(this.input);

        // Create list container
        this.list = document.createElement('div');
        this.list.className = 'autocomplete-list';
        if (this.useBodyPortal) {
            document.body.appendChild(this.list);
            this.list.style.position = 'fixed';
        } else {
            this.wrapper.appendChild(this.list);
        }

        // Event Listeners
        this.input.addEventListener('input', () => this.onInput());
        this.input.addEventListener('focus', () => {
            // Use setTimeout to ensure the UI is ready before showing the list
            setTimeout(() => {
                if (this.showAllOnClick) {
                    this.renderList('');
                    return;
                }
                this.onInput();
            }, 50);
        });
        this.input.addEventListener('click', (e) => {
            e.stopPropagation();

            if (this.showAllOnClick) {
                this.renderList('');
                return;
            }

            // Force show list on click
            if (!this.list.classList.contains('visible')) {
                this.onInput();
            }
        });
        this.input.addEventListener('keydown', (e) => this.onKeyDown(e));

        Autocomplete.ensureGlobalOutsideClickHandler();

        // Close or reposition on scroll/resize
        this._onScrollOrResize = (event) => {
            if (!this.list.classList.contains('visible')) return;

            // Ignore internal list scrolling to avoid flipping direction/resetting list position.
            if (event && event.type === 'scroll' && event.target === this.list) {
                return;
            }

            this.reposition();
        };
        window.addEventListener('resize', this._onScrollOrResize);
        // Listen to scroll on all ancestors (capture phase) to handle any scrollable parent
        window.addEventListener('scroll', this._onScrollOrResize, true);

        // Initial sync
        this.syncOptions();

        // Sync disabled state and observe changes
        this.syncDisabledState();
        this.observeDisabledState();
    }

    syncDisabledState() {
        const disabled = this.selectElement.disabled || this.selectElement.hasAttribute('disabled');
        this.input.disabled = disabled;
        if (disabled) {
            this.input.setAttribute('disabled', 'true');
            this.closeList();
        } else {
            this.input.removeAttribute('disabled');
        }
    }

    observeDisabledState() {
        if (this._disabledObserver) return;
        this._disabledObserver = new MutationObserver(() => {
            this.syncDisabledState();
        });
        this._disabledObserver.observe(this.selectElement, { attributes: true, attributeFilter: ['disabled'] });
    }

    syncOptions() {
        const cacheKey = this.selectElement.dataset.autocompleteCacheKey || '';

        if (cacheKey && Autocomplete.optionsCache.has(cacheKey)) {
            this.options = Autocomplete.optionsCache.get(cacheKey);
        } else {
            this.options = Array.from(this.selectElement.options)
                .filter(opt => opt.value !== "") // Filter out placeholders
                .map(opt => ({
                    value: opt.value,
                    text: opt.text,
                    searchText: String(opt.text || '').toLowerCase(),
                    group: opt.parentElement.tagName === 'OPTGROUP' ? opt.parentElement.label : null
                }));

            if (cacheKey) {
                Autocomplete.optionsCache.set(cacheKey, this.options);
            }
        }
        
        // If select has a value, set input text, otherwise clear it
        const selectedOption = this.options.find(o => o.value === this.selectElement.value);
        if (selectedOption && selectedOption.value) {
            this.input.value = selectedOption.text;
        } else {
            this.input.value = ''; // Clear input when no selection
        }
    }

    onInput() {
        if (this.input.disabled) return;
        const value = this.input.value.toLowerCase();
        this.renderList(value);
    }

    renderList(filter = '') {
        Autocomplete.closeAllVisible(this.list);

        // Clear existing content
        this.list.innerHTML = '';

        let matches = this.options;
        if (filter !== '') {
            matches = this.options.filter(opt => opt.searchText.includes(filter));
        }

        // Limit results to 100 to prevent browser freezing
        matches = matches.slice(0, 100);

        if (matches.length === 0) {
            this.closeList();
            return;
        }

        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        
        // Group matches
        const groups = {};
        const noGroup = [];
        
        matches.forEach(opt => {
            if (opt.group) {
                if (!groups[opt.group]) groups[opt.group] = [];
                groups[opt.group].push(opt);
            } else {
                noGroup.push(opt);
            }
        });

        // Helper to create item
        const createItem = (opt) => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.textContent = opt.text;
            div.dataset.value = opt.value;
            
            div.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectItem(opt);
            });
            return div;
        };

        // Render no group items first
        noGroup.forEach(opt => fragment.appendChild(createItem(opt)));

        // Render groups
        for (const [groupName, groupItems] of Object.entries(groups)) {
            const groupHeader = document.createElement('div');
            groupHeader.className = 'autocomplete-group-header';
            groupHeader.textContent = groupName;
            fragment.appendChild(groupHeader);
            
            groupItems.forEach(opt => fragment.appendChild(createItem(opt)));
        }

        this.list.appendChild(fragment);
        
        // Force reflow before showing
        this.list.offsetHeight;
        this.list.classList.add('visible');
        this.reposition(); // Smart positioning
        this.selectedIndex = -1;
        this.highlightCurrentSelection();
    }

    highlightCurrentSelection() {
        const selectedValue = String(this.selectElement.value || '');
        if (!selectedValue) return;

        const items = Array.from(this.list.querySelectorAll('.autocomplete-item'));
        if (!items.length) return;

        const selectedItemIndex = items.findIndex((item) => String(item.dataset.value || '') === selectedValue);
        if (selectedItemIndex < 0) return;

        items.forEach((item) => item.classList.remove('selected'));
        items[selectedItemIndex].classList.add('selected');
        this.selectedIndex = selectedItemIndex;
    }

    reposition() {
        // Reset state
        this.list.classList.remove('autocomplete-list-top');
        this.list.style.maxHeight = '';
        
        const inputRect = this.input.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        
        // Remove manual positioning attributes
        this.list.style.left = '';
        this.list.style.width = '';
        this.list.style.top = '';
        this.list.style.bottom = '';

        if (this.useBodyPortal) {
            this.list.style.left = `${inputRect.left}px`;
            this.list.style.width = `${inputRect.width}px`;

            const margin = 10;
            const spaceBelow = windowHeight - inputRect.bottom - margin;
            const spaceAbove = inputRect.top - margin;
            const actualHeight = this.list.offsetHeight;

            if (this.forceOpenDown) {
                this.list.style.top = `${inputRect.bottom}px`;
                this.list.style.bottom = 'auto';
                this.list.style.maxHeight = `${Math.max(100, spaceBelow)}px`;
                return;
            }

            if (spaceBelow >= actualHeight) {
                this.list.style.top = `${inputRect.bottom}px`;
                this.list.style.bottom = 'auto';
                return;
            }

            if (spaceAbove >= actualHeight) {
                this.list.classList.add('autocomplete-list-top');
                this.list.style.bottom = `${windowHeight - inputRect.top}px`;
                this.list.style.top = 'auto';
                return;
            }

            if (spaceAbove > spaceBelow) {
                this.list.classList.add('autocomplete-list-top');
                this.list.style.bottom = `${windowHeight - inputRect.top}px`;
                this.list.style.top = 'auto';
                this.list.style.maxHeight = `${Math.max(100, spaceAbove)}px`;
            } else {
                this.list.style.top = `${inputRect.bottom}px`;
                this.list.style.bottom = 'auto';
                this.list.style.maxHeight = `${Math.max(100, spaceBelow)}px`;
            }
            return;
        }
        
        // Calculate available space
        const margin = 10;
        const spaceBelow = windowHeight - inputRect.bottom - margin;
        const spaceAbove = inputRect.top - margin;

        if (this.forceOpenDown) {
            this.list.style.maxHeight = `${Math.max(100, spaceBelow)}px`;
            return;
        }
        
        // Current actual height
        const actualHeight = this.list.offsetHeight;

        // Logic to determine position:
        // 1. If it fits perfectly below, keep it below.
        if (spaceBelow >= actualHeight) {
            return;
        }

        // 2. If it fits perfectly above (and not below), move it top.
        if (spaceAbove >= actualHeight) {
            this.list.classList.add('autocomplete-list-top');
            return;
        }

        // 3. If it fits neither, choose the side with MORE space and restrict height.
        if (spaceAbove > spaceBelow) {
            this.list.classList.add('autocomplete-list-top');
            this.list.style.maxHeight = `${Math.max(100, spaceAbove)}px`;
        } else {
            this.list.style.maxHeight = `${Math.max(100, spaceBelow)}px`;
        }
    }

    onKeyDown(e) {
        if (this.input.disabled) return;
        const items = this.list.querySelectorAll('.autocomplete-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex++;
            if (this.selectedIndex >= items.length) this.selectedIndex = 0;
            this.highlightItem(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex--;
            if (this.selectedIndex < 0) this.selectedIndex = items.length - 1;
            this.highlightItem(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (this.selectedIndex > -1 && items[this.selectedIndex]) {
                items[this.selectedIndex].click();
            }
        } else if (e.key === 'Escape') {
            this.closeList();
        }
    }

    highlightItem(items) {
        items.forEach(item => item.classList.remove('selected'));
        if (items[this.selectedIndex]) {
            items[this.selectedIndex].classList.add('selected');
            items[this.selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    selectItem(option) {
        if (this.input.disabled) return;
        this.input.value = option.text;
        this.selectElement.value = option.value;
        
        // Trigger change event on original select so other scripts know
        const event = new Event('change');
        this.selectElement.dispatchEvent(event);
        
        this.closeList();
    }

    closeList() {
        this.list.classList.remove('visible');
        this.selectedIndex = -1;
    }
    
    getInputValue() {
        return this.input.value;
    }

    // Method to refresh options if the underlying select changes
    refresh() {
        this.syncOptions();
        this.syncDisabledState();
    }
}
