(function () {
    const MAX_FILES_PER_TX = 5;
    const MAX_IMAGE_INPUT_BYTES = 5 * 1024 * 1024;
    const MAX_PDF_BYTES = 5 * 1024 * 1024;
    const MAX_IMAGE_DIMENSION = 1600;
    const IMAGE_JPEG_QUALITY = 0.78;
    const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
    const ALLOWED_PDF_TYPE = 'application/pdf';

    let cachedEnabled = null;
    let stylesInjected = false;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatBytes(bytes) {
        const size = Number(bytes) || 0;
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
        return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    }

    async function isEnabled(forceRefresh = false) {
        if (cachedEnabled !== null && !forceRefresh) return cachedEnabled;
        const api = window.electronAPI;
        if (!api || typeof api.getClientFeatures !== 'function') {
            cachedEnabled = false;
            return false;
        }
        try {
            const res = await api.getClientFeatures();
            cachedEnabled = Boolean(res && res.success && res.features && res.features.treasury_attachments);
            return cachedEnabled;
        } catch (_) {
            cachedEnabled = false;
            return false;
        }
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('تعذر قراءة الملف.'));
            reader.readAsDataURL(file);
        });
    }

    function compressImageDataUrl(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                let width = img.naturalWidth || img.width;
                let height = img.naturalHeight || img.height;
                if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
                    const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
                    width = Math.max(1, Math.round(width * ratio));
                    height = Math.max(1, Math.round(height * ratio));
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                const compressed = canvas.toDataURL('image/jpeg', IMAGE_JPEG_QUALITY);
                resolve(compressed);
            };
            img.onerror = () => reject(new Error('تعذر معالجة الصورة المختارة.'));
            img.src = dataUrl;
        });
    }

    async function prepareFilesForUpload(fileList, existingCount = 0) {
        const files = Array.from(fileList || []);
        const prepared = [];
        const errors = [];

        if (existingCount + files.length > MAX_FILES_PER_TX) {
            return {
                files: [],
                errors: [`الحد الأقصى هو ${MAX_FILES_PER_TX} مرفقات لكل سند (المتاح حالياً: ${Math.max(0, MAX_FILES_PER_TX - existingCount)}).`]
            };
        }

        for (const file of files) {
            const mime = String(file.type || '').toLowerCase();
            const isPdf = mime === ALLOWED_PDF_TYPE || /\.pdf$/i.test(file.name || '');
            const isImage = ALLOWED_IMAGE_TYPES.has(mime);

            if (!isPdf && !isImage) {
                errors.push(`الملف "${file.name}" غير مدعوم. المسموح: صور (JPG, PNG, WEBP) أو PDF فقط.`);
                continue;
            }

            if (isPdf && file.size > MAX_PDF_BYTES) {
                errors.push(`ملف PDF "${file.name}" يتجاوز الحد الأقصى (5 ميجابايت).`);
                continue;
            }

            if (isImage && file.size > MAX_IMAGE_INPUT_BYTES) {
                errors.push(`الصورة "${file.name}" تتجاوز الحد الأقصى (5 ميجابايت).`);
                continue;
            }

            try {
                let dataUrl = await readFileAsDataUrl(file);
                let finalMime = isPdf ? ALLOWED_PDF_TYPE : mime;
                if (isImage) {
                    const compressed = await compressImageDataUrl(dataUrl);
                    if (compressed.length < dataUrl.length) {
                        dataUrl = compressed;
                        finalMime = 'image/jpeg';
                    }
                }
                const base64Part = dataUrl.split(',')[1] || '';
                const estimatedBytes = Math.floor((base64Part.length * 3) / 4);
                prepared.push({
                    originalName: file.name || (isPdf ? 'document.pdf' : 'image.jpg'),
                    mimeType: finalMime,
                    base64Data: dataUrl,
                    previewUrl: isImage ? dataUrl : '',
                    fileSize: estimatedBytes
                });
            } catch (err) {
                errors.push(err.message || `تعذر تجهيز الملف "${file.name}".`);
            }
        }

        return { files: prepared, errors };
    }

    async function getCounts(transactionIds = []) {
        const enabled = await isEnabled();
        if (!enabled) return {};
        const api = window.electronAPI;
        if (!api || typeof api.getTreasuryAttachmentCounts !== 'function') return {};
        try {
            const res = await api.getTreasuryAttachmentCounts(transactionIds);
            return (res && res.success && res.counts) ? res.counts : {};
        } catch (_) {
            return {};
        }
    }

    function injectStyles() {
        if (stylesInjected) return;
        stylesInjected = true;
        const style = document.createElement('style');
        style.id = 'treasury-attachments-viewer-styles';
        style.textContent = `
            .ta-modal-backdrop {
                position: fixed;
                inset: 0;
                z-index: 99999;
                background: rgba(15, 23, 42, 0.82);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                direction: rtl;
            }
            .ta-modal-box {
                width: min(980px, 96vw);
                height: min(86vh, 760px);
                background: var(--bg-card, #ffffff);
                color: var(--text-primary, #0f172a);
                border: 1px solid var(--border-color, #cbd5e1);
                border-radius: 14px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
            }
            .ta-modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 12px 18px;
                border-bottom: 1px solid var(--border-color, #e2e8f0);
                background: var(--bg-secondary, #f8fafc);
            }
            .ta-modal-title {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 15px;
                font-weight: 700;
                margin: 0;
            }
            .ta-modal-toolbar {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }
            .ta-btn {
                border: 1px solid var(--border-color, #cbd5e1);
                background: var(--bg-card, #ffffff);
                color: var(--text-primary, #0f172a);
                border-radius: 8px;
                padding: 6px 11px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                transition: opacity 0.15s ease, transform 0.15s ease;
            }
            .ta-btn:hover { opacity: 0.9; }
            .ta-btn-primary {
                background: #2563eb;
                border-color: #2563eb;
                color: #ffffff;
            }
            .ta-btn-danger {
                background: #dc2626;
                border-color: #dc2626;
                color: #ffffff;
            }
            .ta-modal-stage {
                flex: 1;
                min-height: 0;
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #0f172a;
                overflow: auto;
                padding: 16px;
            }
            .ta-stage-img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                border-radius: 8px;
                transition: transform 0.2s ease;
                transform-origin: center center;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
            }
            .ta-stage-pdf-wrap {
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 14px;
                color: #e2e8f0;
            }
            .ta-stage-pdf-frame {
                width: 100%;
                height: 100%;
                border: none;
                border-radius: 8px;
                background: #ffffff;
            }
            .ta-nav-arrow {
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: none;
                background: rgba(15, 23, 42, 0.72);
                color: #ffffff;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                z-index: 2;
            }
            .ta-nav-arrow:hover { background: rgba(37, 99, 235, 0.9); }
            .ta-nav-prev { right: 14px; }
            .ta-nav-next { left: 14px; }
            .ta-modal-footer {
                padding: 10px 16px;
                border-top: 1px solid var(--border-color, #e2e8f0);
                background: var(--bg-secondary, #f8fafc);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                flex-wrap: wrap;
            }
            .ta-thumbs {
                display: flex;
                align-items: center;
                gap: 8px;
                overflow-x: auto;
                max-width: 100%;
            }
            .ta-thumb {
                padding: 6px 10px;
                border-radius: 8px;
                border: 2px solid transparent;
                background: var(--bg-card, #ffffff);
                color: var(--text-primary, #0f172a);
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                white-space: nowrap;
            }
            .ta-thumb.active {
                border-color: #2563eb;
                background: rgba(37, 99, 235, 0.12);
            }
            .ta-meta-text {
                font-size: 12px;
                color: var(--text-secondary, #64748b);
            }
            .ta-trigger-btn {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                padding: 4px 9px;
                border-radius: 7px;
                border: 1px solid rgba(37, 99, 235, 0.35);
                background: rgba(37, 99, 235, 0.1);
                color: #2563eb;
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
                transition: background 0.15s ease;
            }
            .ta-trigger-btn:hover {
                background: rgba(37, 99, 235, 0.2);
            }
        `;
        document.head.appendChild(style);
    }

    async function openViewer(transactionId, options = {}) {
        const enabled = await isEnabled();
        if (!enabled) return;

        const api = window.electronAPI;
        if (!api || typeof api.getTreasuryAttachments !== 'function') return;

        injectStyles();

        const txId = Number(transactionId);
        const allowManage = Boolean(options.allowManage);
        const onChanged = typeof options.onChanged === 'function' ? options.onChanged : null;
        const voucherLabel = options.voucherNumber ? ` — ${options.voucherNumber}` : '';

        const existingBackdrop = document.getElementById('treasuryAttachmentsModalBackdrop');
        if (existingBackdrop) existingBackdrop.remove();

        const backdrop = document.createElement('div');
        backdrop.id = 'treasuryAttachmentsModalBackdrop';
        backdrop.className = 'ta-modal-backdrop';
        backdrop.innerHTML = `
            <div class="ta-modal-box" role="dialog" aria-modal="true">
                <div class="ta-modal-header">
                    <h3 class="ta-modal-title">
                        <i class="fas fa-paperclip"></i>
                        <span>معاينة مرفقات السند${escapeHtml(voucherLabel)}</span>
                    </h3>
                    <div class="ta-modal-toolbar">
                        <button type="button" class="ta-btn" data-ta-action="zoom-out" title="تصغير"><i class="fas fa-search-minus"></i></button>
                        <button type="button" class="ta-btn" data-ta-action="zoom-reset" title="الحجم الأصلي">100%</button>
                        <button type="button" class="ta-btn" data-ta-action="zoom-in" title="تكبير"><i class="fas fa-search-plus"></i></button>
                        <button type="button" class="ta-btn ta-btn-primary" data-ta-action="open-external"><i class="fas fa-external-link-alt"></i> فتح خارجياً</button>
                        ${allowManage ? `<button type="button" class="ta-btn ta-btn-danger" data-ta-action="delete-current"><i class="fas fa-trash-alt"></i> حذف</button>` : ''}
                        <button type="button" class="ta-btn" data-ta-action="close"><i class="fas fa-times"></i> إغلاق</button>
                    </div>
                </div>
                <div class="ta-modal-stage" id="taModalStage">
                    <div style="color:#e2e8f0;font-size:14px;">جاري تحميل المرفقات...</div>
                </div>
                <div class="ta-modal-footer">
                    <div class="ta-thumbs" id="taModalThumbs"></div>
                    <div class="ta-meta-text" id="taModalMeta"></div>
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);

        let items = [];
        let currentIndex = 0;
        let zoomLevel = 1;
        const dataCache = new Map();

        const stage = backdrop.querySelector('#taModalStage');
        const thumbs = backdrop.querySelector('#taModalThumbs');
        const meta = backdrop.querySelector('#taModalMeta');
        const zoomResetBtn = backdrop.querySelector('[data-ta-action="zoom-reset"]');

        function closeModal() {
            document.removeEventListener('keydown', onKeyDown);
            backdrop.remove();
        }

        function onKeyDown(e) {
            if (e.key === 'Escape') closeModal();
            else if (e.key === 'ArrowRight' && items.length > 1) {
                currentIndex = (currentIndex - 1 + items.length) % items.length;
                renderCurrent();
            } else if (e.key === 'ArrowLeft' && items.length > 1) {
                currentIndex = (currentIndex + 1) % items.length;
                renderCurrent();
            }
        }

        document.addEventListener('keydown', onKeyDown);
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closeModal();
        });

        async function loadList() {
            const res = await api.getTreasuryAttachments(txId);
            items = (res && res.success && Array.isArray(res.attachments)) ? res.attachments : [];
            if (currentIndex >= items.length) currentIndex = Math.max(0, items.length - 1);
            await renderCurrent();
        }

        function updateZoom() {
            const imgEl = stage.querySelector('.ta-stage-img');
            if (imgEl) {
                imgEl.style.transform = `scale(${zoomLevel})`;
            }
            if (zoomResetBtn) {
                zoomResetBtn.textContent = `${Math.round(zoomLevel * 100)}%`;
            }
        }

        async function renderCurrent() {
            zoomLevel = 1;
            if (zoomResetBtn) zoomResetBtn.textContent = '100%';

            if (!items.length) {
                stage.innerHTML = `<div style="color:#cbd5e1;font-size:15px;">لا توجد مرفقات لهذا السند.</div>`;
                thumbs.innerHTML = '';
                meta.textContent = '';
                return;
            }

            const current = items[currentIndex];
            thumbs.innerHTML = items.map((item, idx) => {
                const isPdf = item.mime_type === ALLOWED_PDF_TYPE;
                const icon = isPdf ? 'fa-file-pdf' : 'fa-image';
                return `
                    <button type="button" class="ta-thumb ${idx === currentIndex ? 'active' : ''}" data-ta-idx="${idx}">
                        <i class="fas ${icon}"></i>
                        <span>${escapeHtml(item.original_name)}</span>
                    </button>
                `;
            }).join('');

            meta.textContent = `${currentIndex + 1} / ${items.length} — ${current.original_name} (${formatBytes(current.file_size)})`;
            stage.innerHTML = `<div style="color:#e2e8f0;font-size:14px;">جاري تحميل الملف...</div>`;

            let loaded = dataCache.get(current.id);
            if (!loaded) {
                const readRes = await api.readTreasuryAttachment(current.id);
                if (!readRes || !readRes.success || !readRes.attachment) {
                    stage.innerHTML = `<div style="color:#fca5a5;font-size:14px;">${escapeHtml(readRes?.error || 'تعذر قراءة الملف.')}</div>`;
                    return;
                }
                loaded = readRes.attachment;
                dataCache.set(current.id, loaded);
            }

            const arrowsHtml = items.length > 1 ? `
                <button type="button" class="ta-nav-arrow ta-nav-prev" data-ta-action="prev" title="السابق"><i class="fas fa-chevron-right"></i></button>
                <button type="button" class="ta-nav-arrow ta-nav-next" data-ta-action="next" title="التالي"><i class="fas fa-chevron-left"></i></button>
            ` : '';

            if (loaded.mime_type === ALLOWED_PDF_TYPE) {
                stage.innerHTML = `
                    ${arrowsHtml}
                    <div class="ta-stage-pdf-wrap">
                        <i class="fas fa-file-pdf" style="font-size:64px;color:#ef4444;"></i>
                        <div style="font-size:16px;font-weight:700;">${escapeHtml(loaded.original_name)}</div>
                        <div style="font-size:13px;color:#94a3b8;">ملف PDF — الحجم: ${formatBytes(loaded.file_size)}</div>
                        <button type="button" class="ta-btn ta-btn-primary" data-ta-action="open-external" style="padding:10px 18px;font-size:14px;">
                            <i class="fas fa-external-link-alt"></i> فتح ملف PDF
                        </button>
                    </div>
                `;
            } else {
                stage.innerHTML = `
                    ${arrowsHtml}
                    <img class="ta-stage-img" src="${loaded.dataUrl}" alt="${escapeHtml(loaded.original_name)}" />
                `;
            }
        }

        backdrop.addEventListener('click', async (e) => {
            const thumbBtn = e.target.closest('[data-ta-idx]');
            if (thumbBtn) {
                currentIndex = Number(thumbBtn.getAttribute('data-ta-idx')) || 0;
                await renderCurrent();
                return;
            }

            const actionBtn = e.target.closest('[data-ta-action]');
            if (!actionBtn) return;
            const action = actionBtn.getAttribute('data-ta-action');

            if (action === 'close') {
                closeModal();
            } else if (action === 'prev' && items.length > 1) {
                currentIndex = (currentIndex - 1 + items.length) % items.length;
                await renderCurrent();
            } else if (action === 'next' && items.length > 1) {
                currentIndex = (currentIndex + 1) % items.length;
                await renderCurrent();
            } else if (action === 'zoom-in') {
                zoomLevel = Math.min(3, zoomLevel + 0.25);
                updateZoom();
            } else if (action === 'zoom-out') {
                zoomLevel = Math.max(0.5, zoomLevel - 0.25);
                updateZoom();
            } else if (action === 'zoom-reset') {
                zoomLevel = 1;
                updateZoom();
            } else if (action === 'open-external' && items[currentIndex]) {
                const res = await api.openTreasuryAttachmentExternal(items[currentIndex].id);
                if (res && !res.success && typeof window.showToast === 'function') {
                    window.showToast(res.error || 'تعذر فتح الملف.', 'error');
                }
            } else if (action === 'delete-current' && allowManage && items[currentIndex]) {
                const targetItem = items[currentIndex];
                const confirmed = typeof window.showConfirmDialog === 'function'
                    ? await window.showConfirmDialog('هل أنت متأكد من حذف هذا المرفق نهائياً؟')
                    : window.confirm('هل أنت متأكد من حذف هذا المرفق نهائياً؟');
                if (!confirmed) return;

                const delRes = await api.deleteTreasuryAttachment(targetItem.id);
                if (delRes && delRes.success) {
                    dataCache.delete(targetItem.id);
                    if (typeof window.showToast === 'function') {
                        window.showToast('تم حذف المرفق بنجاح', 'success');
                    }
                    await loadList();
                    if (onChanged) onChanged(items.length);
                } else if (typeof window.showToast === 'function') {
                    window.showToast(delRes?.error || 'تعذر حذف المرفق.', 'error');
                }
            }
        });

        await loadList();
    }

    async function hydrateSlots(root = document) {
        const enabled = await isEnabled();
        if (!enabled || !root) return;

        const slots = Array.from(root.querySelectorAll('.ta-slot[data-ta-tx-id]'));
        if (!slots.length) return;

        const ids = slots
            .map((el) => Number(el.getAttribute('data-ta-tx-id')))
            .filter((id) => Number.isFinite(id) && id > 0);
        if (!ids.length) return;

        const counts = await getCounts(ids);
        injectStyles();

        slots.forEach((slot) => {
            const txId = Number(slot.getAttribute('data-ta-tx-id'));
            const voucher = slot.getAttribute('data-ta-voucher') || '';
            const count = Number(counts[txId] || 0);
            if (count > 0) {
                slot.innerHTML = `
                    <button type="button" class="ta-trigger-btn" data-ta-open-tx-id="${txId}" data-ta-voucher="${escapeHtml(voucher)}" title="معاينة المرفقات">
                        <i class="fas fa-paperclip"></i>
                        <span>${count}</span>
                    </button>
                `;
            } else {
                slot.innerHTML = '';
            }
        });
    }

    document.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-ta-open-tx-id]');
        if (!trigger) return;
        event.preventDefault();
        event.stopPropagation();
        const txId = Number(trigger.getAttribute('data-ta-open-tx-id'));
        const voucherNumber = trigger.getAttribute('data-ta-voucher') || '';
        if (txId > 0) {
            openViewer(txId, { voucherNumber, allowManage: false });
        }
    });

    window.treasuryAttachmentsViewer = {
        MAX_FILES_PER_TX,
        MAX_IMAGE_INPUT_BYTES,
        MAX_PDF_BYTES,
        isEnabled,
        prepareFilesForUpload,
        getCounts,
        openViewer,
        hydrateSlots,
        formatBytes
    };
})();
