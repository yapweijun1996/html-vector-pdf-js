# Font Build Process

## 概述 (Overview)

为了保持源代码的整洁和可维护性，字体的 base64 数据**不再直接存储在源代码中**。

Instead, font data is injected during the build process.

## 工作原理 (How It Works)

### 开发时 (Development)

- `services/fontLoader.ts` 包含占位符 `"EMBEDDED_FONT_DATA_PLACEHOLDER"`
- 源代码文件很小（~3KB），易于阅读和维护

### 构建时 (Build Time)

1. 运行 `npm run build` 时，`prebuild` 脚本自动执行
2. `scripts/inject-fonts.js` 读取 `fonts/NotoSansSC-Regular.base64.txt`
3. 将占位符替换为实际的 base64 数据
4. Vite 构建包含完整字体数据的最终版本

## 文件结构 (File Structure)

```
├── fonts/
│   ├── NotoSansSC-Regular.ttf          # 原始字体文件 (10.5MB)
│   └── NotoSansSC-Regular.base64.txt   # Base64 编码 (14MB)
├── scripts/
│   └── inject-fonts.js                  # 构建脚本
└── services/
    └── fontLoader.ts                    # 源代码（占位符）
```

### 建议追加的字体（用于英文符号/引号与粗体）

为避免 `“ ”`、`•`（以及其他符号）在 PDF 中出现替代字形/间距异常，建议同时准备：

```
fonts/
  NotoSans-Regular.base64.txt
  NotoSans-Bold.base64.txt
  (optional) NotoSansSC-Bold.base64.txt
```

> 注：本项目注入脚本会自动检测这些文件是否存在，存在则注入，不存在则跳过。

## 命令 (Commands)

```bash
# 开发模式（不需要注入字体）
npm run dev

# 构建生产版本（自动注入字体）
npm run build

# 清理注入的字体数据（恢复占位符）
npm run cleanup

# 手动注入字体（通常不需要）
node scripts/inject-fonts.js
```

## 注意事项 (Important Notes)

⚠️ **不要**将注入后的 `fontLoader.ts` 提交到 Git
⚠️ **不要**手动编辑 base64 数据
⚠️ 如果需要更新字体，替换 `.ttf` 文件并重新生成 `.base64.txt`

## 生成 Base64 文件 (Generate Base64)

如果需要更新字体：

```bash
# Linux/Mac
base64 fonts/NotoSansSC-Regular.ttf > fonts/NotoSansSC-Regular.base64.txt

# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("fonts/NotoSansSC-Regular.ttf")) | Out-File -Encoding ASCII fonts/NotoSansSC-Regular.base64.txt
```

## 优势 (Benefits)

✅ 源代码保持整洁（3KB vs 14MB）
✅ 更快的 Git 操作
✅ 更好的代码审查体验
✅ 构建时自动处理，无需手动操作
