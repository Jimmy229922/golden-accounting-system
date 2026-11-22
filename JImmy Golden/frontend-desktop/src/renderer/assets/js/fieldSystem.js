(function () {
    'use strict';

    const BASE_SELECTOR = 'input, select, textarea, .autocomplete-input';
    const ATTR_BOUND = 'data-fs-bound';
    const CLASS_HOST = 'fs-host';
    const CLASS_CONTROL = 'fs-control';

    let observer = null;

    function isElement(node) {
        return Boolean(node && node.nodeType === 1);
    }

    function isHiddenInput(control) {
        return control.tagName === 'INPUT' && String(control.type || '').toLowerCase() === 'hidden';
    }

    function resolveControl(target) {
        if (!isElement(target)) return null;
        if (target.matches(BASE_SELECTOR)) return target;
        return target.querySelector(BASE_SELECTOR);
    }

    function resolveHost(control) {
        if (!isElement(control)) return null;
        return control.closest('.autocomplete-wrapper') || control.closest('.fs-field') || control.parentElement || control;
    }

    function getType(control) {
        if (!isElement(control)) return 'text';

        if (control.classList.contains('autocomplete-input')) return 'autocomplete';
        if (control.tagName === 'SELECT') return 'select';
        if (control.tagName === 'TEXTAREA') return 'textarea';

        const rawType = String(control.type || 'text').toLowerCase();
        if (!rawType) return 'text';

        if (rawType === 'password') return 'password';
        if (rawType === 'number') return 'number';
        if (rawType === 'date' || rawType === 'datetime-local' || rawType === 'time') return 'date';
        if (rawType === 'checkbox' || rawType === 'radio') return 'choice';
        if (rawType === 'file') return 'file';

        return 'text';
    }

    function setHostType(host, type) {
        if (!isElement(host)) return;
        Array.from(host.classList)
            .filter((name) => name.indexOf('fs-type-') === 0)
            .forEach((name) => host.classList.remove(name));
        host.classList.add('fs-type-' + String(type || 'text'));
    }

    function resolveSize(control, fallbackSize) {
        if (!isElement(control)) return fallbackSize === 'sm' ? 'sm' : 'lg';

        const explicit = String(control.getAttribute('data-fs-size') || '').trim().toLowerCase();
        if (explicit === 'sm' || explicit === 'lg') {
            return explicit;
        }

        if (control.classList.contains('autocomplete-input')) {
            const wrapper = control.closest('.autocomplete-wrapper');
            const source = wrapper && wrapper.querySelector('select[data-fs-size], input[data-fs-size], textarea[data-fs-size]');
            const inherited = String(source?.getAttribute('data-fs-size') || '').trim().toLowerCase();
            if (inherited === 'sm' || inherited === 'lg') {
                return inherited;
            }
        }

        return fallbackSize === 'sm' ? 'sm' : 'lg';
    }

    function setSize(control, size) {
        if (!isElement(control)) return;
        const normalized = size === 'sm' ? 'sm' : 'lg';
        control.classList.remove('fs-size-sm', 'fs-size-lg');
        control.classList.add(normalized === 'sm' ? 'fs-size-sm' : 'fs-size-lg');
        control.setAttribute('data-fs-size', normalized);
    }

    function syncState(control) {
        if (!isElement(control)) return;

        const host = resolveHost(control);
        if (!isElement(host)) return;

        const isDisabled = Boolean(control.disabled || control.hasAttribute('disabled'));
        const isReadonly = Boolean(control.readOnly || control.hasAttribute('readonly'));

        host.classList.toggle('fs-state-disabled', isDisabled);
        host.classList.toggle('fs-state-readonly', isReadonly);
    }

    function ensureAutocompleteClasses(control) {
        const host = resolveHost(control);
        if (!isElement(host)) return;

        if (host.classList.contains('autocomplete-wrapper')) {
            host.classList.add('fs-autocomplete');
        }

        const list = host.querySelector('.autocomplete-list');
        if (isElement(list)) {
            list.classList.add('fs-autocomplete-list');
        }

        host.querySelectorAll('.autocomplete-item').forEach((item) => {
            item.classList.add('fs-autocomplete-item');
        });
    }

    function bindFocusBehavior(control) {
        const host = resolveHost(control);
        if (!isElement(host)) return;

        control.addEventListener('focus', function () {
            host.classList.add('fs-state-focused');
        });

        control.addEventListener('blur', function () {
            host.classList.remove('fs-state-focused');
            syncState(control);
        });
    }

    function removeGeneratedError(host) {
        if (!isElement(host)) return;
        host.querySelectorAll('.fs-error-text[data-fs-generated="true"]').forEach((node) => node.remove());
    }

    function markError(target, message) {
        const control = resolveControl(target);
        if (!isElement(control)) return;

        const host = resolveHost(control);
        if (!isElement(host)) return;

        control.setAttribute('aria-invalid', 'true');
        host.classList.add('fs-state-error');

        removeGeneratedError(host);

        const text = String(message || '').trim();
        if (text) {
            const msg = document.createElement('div');
            msg.className = 'fs-error-text';
            msg.setAttribute('data-fs-generated', 'true');
            msg.textContent = text;
            host.appendChild(msg);
        }
    }

    function clearError(target) {
        const control = resolveControl(target);
        if (!isElement(control)) return;

        const host = resolveHost(control);
        if (!isElement(host)) return;

        control.removeAttribute('aria-invalid');
        host.classList.remove('fs-state-error');
        removeGeneratedError(host);
    }

    function register(target, options) {
        const control = resolveControl(target);
        if (!isElement(control)) return null;
        if (isHiddenInput(control)) return null;
        if (control.getAttribute(ATTR_BOUND) === '1') return control;

        const host = resolveHost(control);
        const type = getType(control);
        const size = resolveSize(control, options && options.size ? options.size : 'lg');
        const isChoice = type === 'choice';

        control.setAttribute(ATTR_BOUND, '1');
        if (isChoice) {
            control.classList.add('fs-choice');
        } else {
            control.classList.add(CLASS_CONTROL);
            setSize(control, size);
        }

        if (isElement(host)) {
            host.classList.add(CLASS_HOST);
            setHostType(host, type);
        }

        syncState(control);
        ensureAutocompleteClasses(control);
        bindFocusBehavior(control);

        control.addEventListener('input', function () {
            if (control.getAttribute('aria-invalid') === 'true' && String(control.value || '').trim() !== '') {
                clearError(control);
            }
            syncState(control);
        });

        return control;
    }

    function scan(root, options) {
        const targetRoot = root || document;
        const selector = (options && options.selector) || BASE_SELECTOR;
        const size = options && options.size ? options.size : 'lg';

        targetRoot.querySelectorAll(selector).forEach((control) => {
            register(control, { size: control.getAttribute('data-fs-size') || size });
        });

        decorateAutocompleteLists(targetRoot);
    }

    function decorateAutocompleteLists(root) {
        const targetRoot = root || document;

        targetRoot.querySelectorAll('.autocomplete-list').forEach((list) => {
            list.classList.add('fs-autocomplete-list');
        });

        targetRoot.querySelectorAll('.autocomplete-item').forEach((item) => {
            item.classList.add('fs-autocomplete-item');
        });
    }

    function setDisabled(target, disabled) {
        const control = resolveControl(target);
        if (!isElement(control)) return;

        control.disabled = Boolean(disabled);
        syncState(control);
    }

    function setReadonly(target, isReadonly) {
        const control = resolveControl(target);
        if (!isElement(control)) return;

        if (isReadonly) {
            control.setAttribute('readonly', 'true');
        } else {
            control.removeAttribute('readonly');
        }

        if ('readOnly' in control) {
            control.readOnly = Boolean(isReadonly);
        }

        syncState(control);
    }

    function observe(root, options) {
        const targetRoot = root || document;

        if (observer) {
            observer.disconnect();
        }

        observer = new MutationObserver(function (mutations) {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (!isElement(node)) return;

                        if (node.matches && node.matches(BASE_SELECTOR)) {
                            register(node, { size: options && options.size ? options.size : 'lg' });
                        }

                        if (node.matches && node.matches('.autocomplete-list')) {
                            node.classList.add('fs-autocomplete-list');
                        }

                        if (node.matches && node.matches('.autocomplete-item')) {
                            node.classList.add('fs-autocomplete-item');
                        }

                        if (node.querySelectorAll) {
                            node.querySelectorAll(BASE_SELECTOR).forEach((control) => register(control, { size: options && options.size ? options.size : 'lg' }));
                            node.querySelectorAll('.autocomplete-list').forEach((list) => list.classList.add('fs-autocomplete-list'));
                            node.querySelectorAll('.autocomplete-item').forEach((item) => item.classList.add('fs-autocomplete-item'));
                        }
                    });
                }

                if (mutation.type === 'attributes' && isElement(mutation.target) && mutation.target.matches(BASE_SELECTOR)) {
                    syncState(mutation.target);
                }
            }
        });

        observer.observe(targetRoot, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['disabled', 'readonly', 'aria-invalid']
        });
    }

    function enable(root, options) {
        const targetRoot = root || document;
        const normalizedOptions = options || {};

        const hostRoot = targetRoot === document ? document.documentElement : targetRoot;
        if (isElement(hostRoot)) {
            hostRoot.classList.add('field-system-root');
        }

        scan(targetRoot, normalizedOptions);

        if (normalizedOptions.watch !== false) {
            observe(targetRoot, normalizedOptions);
        }
    }

    function disableObserver() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
    }

    const api = {
        enable,
        scan,
        register,
        setSize,
        setDisabled,
        setReadonly,
        markError,
        clearError,
        decorateAutocompleteLists,
        disableObserver
    };

    window.FieldSystem = api;
    window.fieldSystem = api;

    const autoMode = document.documentElement && document.documentElement.getAttribute('data-field-system') === 'enabled';
    if (autoMode) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                enable(document, { watch: true });
            });
        } else {
            enable(document, { watch: true });
        }
    }
})();
