const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 获取终端里输入的文件名，没输入就默认查这四个核心文件
const defaultFiles = ['server.py', 'static/app.js', 'templates/index.html', 'static/style.css'];
const targetFiles = process.argv.length > 2 ? process.argv.slice(2) : defaultFiles;

function checkPython(filePath) {
    try {
        execSync(`python -m py_compile "${filePath}"`, { stdio: 'pipe' });
        return { ok: true };
    } catch (e) {
        return { ok: false, err: e.stderr.toString() };
    }
}

function checkJS(filePath) {
    try {
        execSync(`node --check "${filePath}"`, { stdio: 'pipe' });
        return { ok: true };
    } catch (e) {
        return { ok: false, err: e.stderr.toString() };
    }
}

function checkHTMLAndCSS(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let errors = [];

    if (filePath.endsWith('.html')) {
        // 简易版：检查标签配对（<div> 和 </div> 数量）
        const openTags = (content.match(/<div/g) || []).length;
        const closeTags = (content.match(/<\/div>/g) || []).length;
        if (openTags !== closeTags) {
            errors.push(`<div> 标签不匹配！(开: ${openTags}, 闭: ${closeTags})`);
        }
    }
    
    if (filePath.endsWith('.css')) {
        // 简易版：检查大括号 { } 数量
        const openBraces = (content.match(/{/g) || []).length;
        const closeBraces = (content.match(/}/g) || []).length;
        if (openBraces !== closeBraces) {
            errors.push(`CSS 大括号不匹配！(开: ${openBraces}, 闭: ${closeBraces})`);
        }
    }

    if (errors.length > 0) return { ok: false, err: errors.join('\n') };
    return { ok: true };
}

console.log("🚀 启动全栈代码静态检查...\n");

let hasError = false;

targetFiles.forEach(file => {
    const fullPath = path.resolve(__dirname, file);
    const ext = path.extname(fullPath);
    
    if (!fs.existsSync(fullPath)) {
        console.log(`⏭️  [跳过] 找不到文件: ${file}`);
        return;
    }

    let result;
    if (ext === '.py') result = checkPython(fullPath);
    else if (ext === '.js') result = checkJS(fullPath);
    else if (ext === '.html' || ext === '.css') result = checkHTMLAndCSS(fullPath);
    else return;

    if (result.ok) {
        console.log(`\x1b[32m✅ [通过] ${file.padEnd(20)} (语法无误)\x1b[0m`);
    } else {
        hasError = true;
        console.log(`\x1b[31m❌ [报错] ${file.padEnd(20)}\x1b[0m`);
        console.log(`\x1b[31m${result.err}\x1b[0m`);
    }
});

console.log("\n==========================================");
if (hasError) {
    console.log("\x1b[31m🚨 检查完毕，发现上述错误，请立刻去代码里修改！\x1b[0m");
} else {
    console.log("\x1b[32m🎉 完美！所有文件语法全绿，准备起飞！\x1b[0m");
}