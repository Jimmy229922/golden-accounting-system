const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const rootPackagePath = path.join(rootDir, 'package.json');

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJsonIfChanged(filePath, data) {
    const nextContent = `${JSON.stringify(data, null, 2)}\n`;
    const currentContent = fs.readFileSync(filePath, 'utf8');
    if (currentContent === nextContent) {
        return false;
    }

    fs.writeFileSync(filePath, nextContent, 'utf8');
    return true;
}

function syncPackageVersion(filePath, version) {
    const data = readJson(filePath);
    data.version = version;
    return writeJsonIfChanged(filePath, data);
}

function syncPackageLockVersion(filePath, version) {
    const data = readJson(filePath);
    data.version = version;

    if (data.packages && data.packages['']) {
        data.packages[''].version = version;
    }

    if (data.packages && data.packages['..']) {
        data.packages['..'].version = version;
    }

    return writeJsonIfChanged(filePath, data);
}

function main() {
    const rootPackage = readJson(rootPackagePath);
    const version = String(rootPackage.version || '').trim();

    if (!version) {
        throw new Error('Root package version is missing.');
    }

    const targets = [
        {
            label: 'backend/package.json',
            sync: () => syncPackageVersion(path.join(rootDir, 'backend', 'package.json'), version)
        },
        {
            label: 'frontend-desktop/package.json',
            sync: () => syncPackageVersion(path.join(rootDir, 'frontend-desktop', 'package.json'), version)
        },
        {
            label: 'backend/package-lock.json',
            sync: () => syncPackageLockVersion(path.join(rootDir, 'backend', 'package-lock.json'), version)
        },
        {
            label: 'frontend-desktop/package-lock.json',
            sync: () => syncPackageLockVersion(path.join(rootDir, 'frontend-desktop', 'package-lock.json'), version)
        }
    ];

    const changedTargets = [];
    for (const target of targets) {
        if (target.sync()) {
            changedTargets.push(target.label);
        }
    }

    if (changedTargets.length === 0) {
        console.log(`Workspace versions already synced to ${version}`);
        return;
    }

    console.log(`Synced workspace version to ${version}`);
    for (const target of changedTargets) {
        console.log(`- ${target}`);
    }
}

main();
