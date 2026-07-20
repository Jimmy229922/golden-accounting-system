const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'frontend-desktop', 'dist');
const portableDir = path.join(distDir, 'APP_JS');

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function runCommand(command, args) {
    const result = spawnSync(command, args, {
        cwd: rootDir,
        stdio: 'inherit',
        shell: process.platform === 'win32'
    });

    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
}

function ensureWindows() {
    if (process.platform !== 'win32') {
        throw new Error('سكربت تجهيز الريليز الحالي يعمل على ويندوز فقط.');
    }
}

function getRootVersion() {
    const rootPackage = readJson(path.join(rootDir, 'package.json'));
    const version = String(rootPackage.version || '').trim();
    if (!version) {
        throw new Error('رقم الإصدار غير موجود داخل package.json');
    }
    return version;
}

function findInstaller(version) {
    if (!fs.existsSync(distDir)) {
        return null;
    }

    const distFiles = fs.readdirSync(distDir, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name);

    const exactInstaller = distFiles.find((name) => (
        /\.exe$/i.test(name) &&
        !/blockmap/i.test(name) &&
        name.includes(version)
    ));

    if (!exactInstaller) {
        return null;
    }

    return path.join(distDir, exactInstaller);
}

function recreatePortableDir() {
    if (fs.existsSync(portableDir)) {
        fs.rmSync(portableDir, { recursive: true, force: true });
    }

    fs.mkdirSync(portableDir, { recursive: true });
}

function createZip(zipPath) {
    const escapedPortableDir = portableDir.replace(/'/g, "''");
    const escapedZipPath = zipPath.replace(/'/g, "''");
    const command = `Compress-Archive -Path '${escapedPortableDir}' -DestinationPath '${escapedZipPath}' -Force`;
    const result = spawnSync('powershell', ['-NoProfile', '-Command', command], {
        cwd: rootDir,
        stdio: 'inherit'
    });

    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
}

function yamlQuote(value) {
    return `'${String(value || '').replace(/'/g, "''")}'`;
}

function getSha512(filePath) {
    return crypto
        .createHash('sha512')
        .update(fs.readFileSync(filePath))
        .digest('base64');
}

function createLatestYml(version, installerPath) {
    const installerName = path.basename(installerPath);
    const installerSize = fs.statSync(installerPath).size;
    const installerSha512 = getSha512(installerPath);
    const latestYmlPath = path.join(distDir, 'latest.yml');
    const releaseDate = new Date().toISOString();

    const content = [
        `version: ${version}`,
        'files:',
        `  - url: ${yamlQuote(installerName)}`,
        `    sha512: ${installerSha512}`,
        `    size: ${installerSize}`,
        `path: ${yamlQuote(installerName)}`,
        `sha512: ${installerSha512}`,
        `releaseDate: ${yamlQuote(releaseDate)}`,
        ''
    ].join('\n');

    fs.writeFileSync(latestYmlPath, content, 'utf8');
    return latestYmlPath;
}

function prepareArtifacts(version) {
    const installerPath = findInstaller(version);
    if (!installerPath) {
        throw new Error(`لم يتم العثور على ملف Setup للإصدار ${version} داخل frontend-desktop/dist. شغل npm run release:build بعد تعديل رقم الإصدار.`);
    }

    recreatePortableDir();

    const installerName = path.basename(installerPath);
    const latestYmlPath = createLatestYml(version, installerPath);
    const portableInstallerPath = path.join(portableDir, installerName);
    fs.copyFileSync(installerPath, portableInstallerPath);

    const zipPath = path.join(distDir, `APP_JS-${version}.zip`);
    if (fs.existsSync(zipPath)) {
        fs.rmSync(zipPath, { force: true });
    }

    createZip(zipPath);

    return {
        installerPath,
        portableInstallerPath,
        zipPath,
        latestYmlPath
    };
}

function printSummary({ version, buildExecuted, installerPath, portableInstallerPath, zipPath, latestYmlPath }) {
    console.log('');
    console.log('========================================');
    console.log(`جاهز لتجهيز Release الإصدار ${version}`);
    console.log('========================================');
    console.log(`الوسم المقترح على GitHub: v${version}`);
    console.log(`تم تنفيذ البناء الآن: ${buildExecuted ? 'نعم' : 'لا'}`);
    console.log('');
    console.log('ترتيب الخطوات:');
    console.log(`1. عدل رقم الإصدار في package.json الرئيسي إلى ${version}`);
    console.log('2. شغل أمر التجهيز المناسب');
    console.log('3. ارفع ملف Setup على GitHub Release');
    console.log('');
    console.log('الملفات النهائية:');
    console.log(`- Setup: ${path.relative(rootDir, installerPath)}`);
    console.log(`- Latest YAML: ${path.relative(rootDir, latestYmlPath)}`);
    console.log(`- APP_JS: ${path.relative(rootDir, portableInstallerPath)}`);
    console.log(`- APP_JS ZIP: ${path.relative(rootDir, zipPath)}`);
    console.log('');
    console.log('الملفات المطلوبة رفعها على GitHub Release للتحديث داخل البرنامج:');
    console.log(`- ${path.basename(installerPath)}`);
    console.log(`- ${path.basename(installerPath)}.blockmap`);
    console.log('- latest.yml');
    console.log('');
    console.log('للتجهيز مع البناء: npm run release:build');
    console.log('للتجهيز بعد البناء فقط: npm run release:prepare');
    console.log('');
}

function main() {
    ensureWindows();

    const shouldBuild = process.argv.includes('--with-build');

    runCommand('node', ['scripts/sync-workspace-version.js']);

    const version = getRootVersion();

    if (shouldBuild) {
        runCommand('npm', ['run', 'desktop:build']);
    }

    const artifacts = prepareArtifacts(version);
    printSummary({
        version,
        buildExecuted: shouldBuild,
        ...artifacts
    });
}

try {
    main();
} catch (error) {
    console.error('');
    console.error(`فشل تجهيز الريليز: ${error?.message || error}`);
    process.exit(1);
}
