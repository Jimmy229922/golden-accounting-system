const fs = require('fs');

const lightCss = `:root,
[data-theme="light"] {
    /* =========================================================================
       1. CORE COLORS (Backgrounds & Surfaces)
       ========================================================================= */
    --bg-color: #f4f6fb;           /* App main background */
    --card-bg: #ffffff;            /* Card/Panel background */
    --secondary-bg: #f8fafc;       /* Headers, Footers, Modals */
    --nav-bg: #0f172a;             /* Main Navigation */
    --dropdown-bg: #111827;        /* Dropdown Menus */

    /* =========================================================================
       2. TYPOGRAPHY
       ========================================================================= */
    --text-color: #1f2937;         /* Main headings and text */
    --text-muted: #6b7280;         /* Secondary text */
    --text-secondary: #64748b;     /* Icons, minor details */
    --muted-text: #6b7280;         /* Alias */
    --nav-text: #e2e8f0;           /* Navigation text */
    --nav-hover: #1e293b;          /* Navigation hover state */

    /* =========================================================================
       3. BORDERS & SHADOWS
       ========================================================================= */
    --border-color: #dbe3ed;       /* General structural borders */
    --card-border: #dbe3ed;        /* Specific card borders */
    --input-border: #cfd8e3;       /* Input fields borders */
    --table-border: #d8e1eb;       /* Table lines */
    --shadow-color: rgba(15, 23, 42, 0.12); /* Subtle shadows */
    --shadow-sm: 0 1px 3px var(--shadow-color);
    --shadow-md: 0 4px 6px -1px var(--shadow-color);
    --shadow-lg: 0 10px 15px -3px var(--shadow-color);

    /* =========================================================================
       4. ACTIONS & STATES (Accent Colors)
       ========================================================================= */
    --primary-color: #0f172a;      /* Primary elements */
    --secondary-color: #0ea5e9;    /* Secondary actions (Light Blue) */
    --accent-color: #2563eb;       /* Brand Blue accent */
    --success-color: #16a34a;      /* Success, Add */
    --warning-color: #d97706;      /* Warning, Alerts */
    --danger-color: #dc2626;       /* Error, Delete */
    --info-color: #0284c7;         /* Information */

    /* =========================================================================
       5. BUSINESS MODULES (Sales & Purchases)
       ========================================================================= */
    --sales-color: #15803d;        /* Sales values (Green) */
    --sales-bg: #e8f8ee;           /* Sales background */
    --purchase-color: #c2410c;     /* Purchase values (Orange/Red) */
    --purchase-bg: #fff1e8;        /* Purchase background */
    
    --items-accent: #667eea;
    --items-accent-light: rgba(102, 126, 234, 0.1);

    /* =========================================================================
       6. COMPONENTS (Inputs, Tables)
       ========================================================================= */
    --input-bg: #ffffff;
    --input-focus-ring: rgba(37, 99, 235, 0.2); 
    --table-header-bg: #f3f6fb;
    --table-hover-bg: rgba(37, 99, 235, 0.04);

    /* =========================================================================
       7. GRADIENTS (Unified Palette)
       ========================================================================= */
    --dash-gradient-1: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    --dash-gradient-2: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    --dash-gradient-3: linear-gradient(135deg, #ff9966 0%, #ff5e62 100%);
    --dash-gradient-4: linear-gradient(135deg, #FDC830 0%, #F37335 100%);
    --dash-gradient-5: linear-gradient(135deg, #0891b2 0%, #22d3ee 100%);
    --dash-gradient-6: linear-gradient(135deg, #e11d48 0%, #fb7185 100%);
    --dash-gradient-7: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
    --dash-gradient-8: linear-gradient(135deg, #059669 0%, #34d399 100%);
    
    --items-gradient-1: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    --items-gradient-2: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}
`;

const darkCss = `[data-theme="dark"] {
    /* =========================================================================
       1. CORE COLORS (Backgrounds & Surfaces)
       ========================================================================= */
    --bg-color: #0a0f1a;           /* Deep Midnight Blue (Restful for eyes) */
    --card-bg: #131b2e;            /* Elevated Cards */
    --secondary-bg: #0f1729;       /* Panels, Modals, Secondary sections */
    --nav-bg: #0a0f1a;             /* Navigation Side/Top bar */
    --dropdown-bg: #0f1729;        /* Dropdowns & Popovers */

    /* =========================================================================
       2. TYPOGRAPHY
       ========================================================================= */
    --text-color: #f1f5f9;         /* High contrast white-blue */
    --text-muted: #a8b3cf;         /* Relaxed muted text */
    --text-secondary: #94a3b8;     /* Alternate secondary text */
    --muted-text: #a8b3cf;         /* Alias */
    --nav-text: #f1f5f9;
    --nav-hover: #1e293b;          /* Highlighted Navigation */

    /* =========================================================================
       3. BORDERS & SHADOWS
       ========================================================================= */
    --border-color: #2d3b56;       /* Soft separator lines */
    --card-border: #2d3b56;
    --input-border: #3d4f6b;
    --table-border: #2d3b56;
    --shadow-color: rgba(0, 0, 0, 0.4); 
    --shadow-sm: 0 1px 3px var(--shadow-color);
    --shadow-md: 0 4px 6px -1px var(--shadow-color);
    --shadow-lg: 0 10px 15px -3px var(--shadow-color);

    /* =========================================================================
       4. ACTIONS & STATES (Accent Colors)
       ========================================================================= */
    --primary-color: #a5c9ff;
    --secondary-color: #38d9ee;
    --accent-color: #70b5ff;       /* Vivid Blue for links and buttons */
    --success-color: #34d875;      /* Luminescent Green */
    --warning-color: #fbbf24;      /* Amber/Yellow warning */
    --danger-color: #ff8787;       /* Soft Red for danger */
    --info-color: #38bdf8;

    /* =========================================================================
       5. BUSINESS MODULES (Sales & Purchases)
       ========================================================================= */
    --sales-color: #34d875;
    --sales-bg: #064e3b;           /* Deep green background */
    --purchase-color: #fb923c;
    --purchase-bg: #7c2d12;        /* Deep orange background */
    
    --items-accent: #818cf8;
    --items-accent-light: rgba(129, 140, 248, 0.15);

    /* =========================================================================
       6. COMPONENTS (Inputs, Tables)
       ========================================================================= */
    --input-bg: #0f1729;
    --input-focus-ring: rgba(112, 181, 255, 0.15);
    --table-header-bg: #131b2e;
    --table-hover-bg: rgba(112, 181, 255, 0.08);

    /* =========================================================================
       7. GRADIENTS (Dashboard & Cards - Optimized contrast for Dark)
       ========================================================================= */
    --dash-gradient-1: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);  
    --dash-gradient-2: linear-gradient(135deg, #059669 0%, #10b981 100%);  
    --dash-gradient-3: linear-gradient(135deg, #ea580c 0%, #ef4444 100%);  
    --dash-gradient-4: linear-gradient(135deg, #d97706 0%, #f59e0b 100%);  
    --dash-gradient-5: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);  
    --dash-gradient-6: linear-gradient(135deg, #be123c 0%, #f43f5e 100%);  
    --dash-gradient-7: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%);  
    --dash-gradient-8: linear-gradient(135deg, #047857 0%, #10b981 100%);  
    
    --items-gradient-1: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    --items-gradient-2: linear-gradient(135deg, #059669 0%, #10b981 100%);
}

/* =========================================================================
   Global Overrides for Dark Mode Elements
   ========================================================================= */
[data-theme="dark"] button,
[data-theme="dark"] .btn { 
    border-color: var(--border-color); 
    background: #1e293b;
    color: var(--text-color);
}

[data-theme="dark"] button:hover,
[data-theme="dark"] .btn:hover { 
    background: #2d3b56; 
    border-color: var(--input-border); 
}

[data-theme="dark"] .table tbody tr:hover { 
    background-color: var(--table-hover-bg); 
}

[data-theme="dark"] input:focus, 
[data-theme="dark"] select:focus, 
[data-theme="dark"] textarea:focus {
    border-color: var(--accent-color);
    box-shadow: 0 0 0 3px var(--input-focus-ring);
}

[data-theme="dark"] ::-webkit-scrollbar { width: 10px; height: 10px; }
[data-theme="dark"] ::-webkit-scrollbar-track { background: var(--secondary-bg); }
[data-theme="dark"] ::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 5px; }
[data-theme="dark"] ::-webkit-scrollbar-thumb:hover { background: #4d5f7b; }

[data-theme="dark"] input:disabled, 
[data-theme="dark"] button:disabled, 
[data-theme="dark"] select:disabled {
    opacity: 0.5; 
    cursor: not-allowed; 
    background: var(--secondary-bg);
}

[data-theme="dark"] .dashboard-hero p, 
[data-theme="dark"] .last-updated, 
[data-theme="dark"] .metric-label {
    color: #b8c5d9;
}

[data-theme="dark"] .modal, 
[data-theme="dark"] .modal-content {
    background: var(--card-bg); 
    border: 1px solid var(--card-border); 
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
}

[data-theme="dark"] .modal-header { border-bottom: 1px solid var(--card-border); background: var(--secondary-bg); }
[data-theme="dark"] .modal-footer { border-top: 1px solid var(--card-border); background: var(--secondary-bg); }

[data-theme="dark"] .card, 
[data-theme="dark"] .stat-card, 
[data-theme="dark"] .info-card {
    box-shadow: var(--shadow-md); 
    border: 1px solid var(--card-border);
}

[data-theme="dark"] select, 
[data-theme="dark"] select option, 
[data-theme="dark"] textarea {
    background: var(--input-bg); 
    color: var(--text-color); 
    border: 1px solid var(--input-border);
}

[data-theme="dark"] a { color: var(--accent-color); text-decoration: none; }
[data-theme="dark"] a:hover { color: var(--primary-color); }

[data-theme="dark"] .alert-success { 
    background: rgba(52, 216, 117, 0.1); 
    border-color: rgba(52, 216, 117, 0.3); 
    color: var(--success-color); 
}
[data-theme="dark"] .alert-warning { 
    background: rgba(251, 191, 36, 0.1); 
    border-color: rgba(251, 191, 36, 0.3); 
    color: var(--warning-color); 
}
[data-theme="dark"] .alert-error, 
[data-theme="dark"] .alert-danger { 
    background: rgba(255, 135, 135, 0.1); 
    border-color: rgba(255, 135, 135, 0.3); 
    color: var(--danger-color); 
}
`;

fs.writeFileSync('d:\\\\JS\\\\accounting-system\\\\frontend-desktop\\\\src\\\\renderer\\\\assets\\\\styles\\\\themes\\\\light.css', lightCss, 'utf8');
fs.writeFileSync('d:\\\\JS\\\\accounting-system\\\\frontend-desktop\\\\src\\\\renderer\\\\assets\\\\styles\\\\themes\\\\dark.css', darkCss, 'utf8');

function cleanCSS(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    
    const rootRegex = /:root\s*\\{([^\\}]*)\\}/g;
    const darkRegex = /\\\[data-theme="dark"\\]\s*\\{([^\\}]*)\\}/g;
    
    let isModified = false;
    let newContent = content.replace(rootRegex, (match, inner) => {
        if (!inner.includes('{') && (inner.includes('--dash-gradient') || inner.includes('--items-gradient') || inner.match(/--[a-z-]+:\s*#|rgba?/))) {
            let lines = inner.split('\\n');
            let isOnlyVars = lines.every(l => l.trim() === '' || l.trim().startsWith('--') || l.trim().startsWith('/*'));
            if(isOnlyVars) {
                isModified = true;
                return '';
            }
        }
        return match;
    });

    newContent = newContent.replace(darkRegex, (match, inner) => {
        if (!inner.includes('{') && inner.match(/--[a-z-]+:\s*#|rgba?/)) {
            let lines = inner.split('\\n');
            let isOnlyVars = lines.every(l => l.trim() === '' || l.trim().startsWith('--') || l.trim().startsWith('/*'));
            if(isOnlyVars) {
                isModified = true;
                return '';
            }
        }
        return match;
    });

    if (isModified || newContent !== content) {
        newContent = newContent.replace(/^\\s*\\n/gm, '').replace(/\\n{3,}/g, '\\n\\n');
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log('Cleaned file: ' + filePath);
    }
}

cleanCSS('d:\\\\JS\\\\accounting-system\\\\frontend-desktop\\\\src\\\\renderer\\\\views\\\\dashboard\\\\dashboard.css');
cleanCSS('d:\\\\JS\\\\accounting-system\\\\frontend-desktop\\\\src\\\\renderer\\\\views\\\\items\\\\items.css');
cleanCSS('d:\\\\JS\\\\accounting-system\\\\frontend-desktop\\\\src\\\\renderer\\\\views\\\\customers\\\\customers.css');
cleanCSS('d:\\\\JS\\\\accounting-system\\\\frontend-desktop\\\\src\\\\renderer\\\\views\\\\opening-balance\\\\opening-balance.css');
