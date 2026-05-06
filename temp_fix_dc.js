const fs = require('fs');
const path = require('path');

const dcPath = path.join(__dirname, 'frontend-desktop', 'src', 'renderer', 'views', 'reports', 'debtor-creditor', 'debtor-creditor.js');
let dcContent = fs.readFileSync(dcPath, 'utf8');

// 1. Fix the status filter logic
const regex1 = /if \(customer\.type === 'customer' \|\| customer\.type === 'both'\) \{\s*if \(balance > 0\) status = 'debtor'; \/\/ They owe us\s*else if \(balance < 0\) status = 'creditor'; \/\/ We owe them\s*\} else \{ \/\/ supplier\s*if \(balance > 0\) status = 'creditor'; \/\/ We owe them\s*else if \(balance < 0\) status = 'debtor'; \/\/ They owe us\s*\}/g;

dcContent = dcContent.replace(regex1, `if (balance > 0) status = 'debtor'; // They owe us
        else if (balance < 0) status = 'creditor'; // We owe them`);

// 2. Fix the rendering logic
const regex2 = /if \(customer\.type === 'customer' \|\| customer\.type === 'both'\) \{\s*if \(balance > 0\) \{\s*statusText = t\('debtorCreditor\.debtorLabel', 'لينا \(مدين\)'\);\s*statusClass = 'dc-badge-debtor';\s*\} else if \(balance < 0\) \{\s*statusText = t\('debtorCreditor\.creditorLabel', 'علينا \(دائن\)'\);\s*statusClass = 'dc-badge-creditor';\s*\}\s*\} else \{\s*if \(balance > 0\) \{\s*statusText = t\('debtorCreditor\.creditorLabel', 'علينا \(دائن\)'\);\s*statusClass = 'dc-badge-creditor';\s*\} else if \(balance < 0\) \{\s*statusText = t\('debtorCreditor\.debtorLabel', 'لينا \(مدين\)'\);\s*statusClass = 'dc-badge-debtor';\s*\}\s*\}/g;

dcContent = dcContent.replace(regex2, `if (balance > 0) {
            statusText = t('debtorCreditor.debtorLabel', 'لينا (مدين)');
            statusClass = 'dc-badge-debtor';
        } else if (balance < 0) {
            statusText = t('debtorCreditor.creditorLabel', 'علينا (دائن)');
            statusClass = 'dc-badge-creditor';
        }`);

// 3. Fix the totals calculation
const regex3 = /if \(customer\.type === 'customer' \|\| customer\.type === 'both'\) \{\s*if \(balance > 0\) totalDebtor \+= balance;\s*else if \(balance < 0\) totalCreditor \+= Math\.abs\(balance\);\s*\} else \{\s*if \(balance > 0\) totalCreditor \+= balance;\s*else if \(balance < 0\) totalDebtor \+= Math\.abs\(balance\);\s*\}/g;

dcContent = dcContent.replace(regex3, `if (balance > 0) totalDebtor += balance;
        else if (balance < 0) totalCreditor += Math.abs(balance);`);

fs.writeFileSync(dcPath, dcContent, 'utf8');
console.log('Fixed debtor-creditor.js type checks');
