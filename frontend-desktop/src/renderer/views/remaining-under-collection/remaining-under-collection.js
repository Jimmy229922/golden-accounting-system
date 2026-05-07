let ar = {};
const { t } = window.i18n?.createPageHelpers?.(() => ar) || { t: (_k, fallback = '') => fallback };

function buildTopNavHTML() {
    if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
        return window.navManager.getTopNavHTML(t);
    }
    return '';
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        ar = await window.i18n.loadArabicDictionary();
    }

    document.getElementById('app').innerHTML = `
        ${buildTopNavHTML()}
        <main class="petty-page under-collection-page">
            <section class="petty-hero">
                <div class="hero-shapes">
                    <span class="hero-shape shape-1"></span>
                    <span class="hero-shape shape-2"></span>
                    <span class="hero-shape shape-3"></span>
                </div>
                <div class="hero-content">
                    <h1>بيان المتبقي من تحت التحصيل</h1>
                    <p>متابعة المتبقي من سجلات تحت التحصيل</p>
                </div>
            </section>

            <section class="invoice-form-container">
                <div class="invoice-shell soon-card">
                    <h2>قريباً</h2>
                </div>
            </section>
        </main>
    `;
});
