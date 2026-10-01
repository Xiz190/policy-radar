// 文件解析器：支持 PDF / Word / 图片 / 文本文件
// 纯浏览器端实现，不需要后端 API

export interface ParsedResult {
  fileType: string;
  fileName: string;
  text: string;
  pageCount?: number;
  imageCount?: number;
  error?: string;
}

// 外部库最小类型声明，避免 `any`
type PdfjsLib = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(params: { data: ArrayBuffer }): {
    promise: Promise<{
      numPages: number;
      getPage(pageNum: number): Promise<{
        getTextContent(): Promise<{ items: Array<{ str: string; transform: number[] }> }>;
        getOperatorList(): Promise<{ fnArray: number[] }>;
      }>;
    }>;
  };
  OPS: { paintImageXObject: number; paintInlineImageXObject: number };
  version: string;
};

type MammothLib = {
  extractRawText(params: { arrayBuffer: ArrayBuffer }): Promise<{
    value: string;
    messages: Array<{ type: string; message: string }>;
  }>;
};

type TesseractLib = {
  recognize(
    input: File | string,
    lang?: string,
    options?: { logger?: (log: TesseractLog) => void },
  ): Promise<{ data: TesseractResult }>;
};

type TesseractLog = {
  status: string;
  progress?: number;
  [key: string]: unknown;
};

type TesseractResult = {
  text: string;
  confidence?: number;
  [key: string]: unknown;
};

// 动态导入库（避免打包时加载全部）
let pdfjsLibPromise: Promise<PdfjsLib> | null = null;
let tesseractPromise: Promise<TesseractLib> | null = null;
let mammothPromise: Promise<MammothLib> | null = null;

// 测试某个 worker URL 是否可被浏览器加载（通过 fetch 预检 + 内容类型验证）
async function testWorkerUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "GET", mode: "same-origin" });
    if (!response.ok) return false;
    const text = await response.text();
    // 简单校验：worker 必须是有效的 JS 代码，含有 pdfjs 关键字
    return text.length > 1000 && text.includes("pdfjs");
  } catch {
    return false;
  }
}

async function loadPdfLib(): Promise<PdfjsLib> {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("pdfjs-dist").then(async (mod) => {
      // ESM 模块可能以 `{ default: pdfjs, ... }` 或直接 `pdfjs` 对象形式返回
      const pdfjs: PdfjsLib = (mod && (mod as { default?: PdfjsLib }).default) || (mod as unknown as PdfjsLib);

      const workerCandidates: Array<{ name: string; url: string }> = [
        { name: "本地 public/lib", url: "/lib/pdf.worker.min.mjs" },
        { name: "jsDelivr CDN", url: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js` },
        { name: "unpkg CDN", url: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js` },
        { name: "Cloudflare CDN", url: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js` },
      ];

      let finalUrl: string | null = null;
      const tried: string[] = [];

      for (const candidate of workerCandidates) {
        tried.push(`${candidate.name} (${candidate.url})`);
        try {
          const ok = await testWorkerUrl(candidate.url);
          if (ok) {
            finalUrl = candidate.url;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!finalUrl) finalUrl = "/lib/pdf.worker.min.mjs";

      pdfjs.GlobalWorkerOptions.workerSrc = finalUrl;
      return pdfjs;
    });
  }
  // pdfjsLibPromise 在上文已赋值（或已被其他并发调用赋值），这里非 null
  return pdfjsLibPromise as Promise<PdfjsLib>;
}

async function loadTesseract(): Promise<TesseractLib> {
  if (!tesseractPromise) {
    tesseractPromise = import("tesseract.js").then((mod) => {
      // 归一化：处理 ESM/CJS 不同模块形状
      const ns = mod as unknown as { default?: TesseractLib };
      return (ns.default || mod) as unknown as TesseractLib;
    });
  }
  return tesseractPromise as Promise<TesseractLib>;
}

async function loadMammoth(): Promise<MammothLib> {
  if (!mammothPromise) {
    mammothPromise = import("mammoth").then((mod) => {
      const ns = mod as { default?: MammothLib };
      return (ns.default || mod) as unknown as MammothLib;
    });
  }
  return mammothPromise as Promise<MammothLib>;
}

export async function parseFile(file: File): Promise<ParsedResult> {
  const fileName = file.name.toLowerCase();
  const result: ParsedResult = {
    fileType: "未知文件",
    fileName: file.name,
    text: "",
  };

  try {
    if (fileName.endsWith(".pdf")) {
      return await parsePdf(file);
    }
    if (fileName.endsWith(".docx")) {
      return await parseDocx(file);
    }
    if (fileName.endsWith(".doc")) {
      result.fileType = "Word 文档 (.doc)";
      result.text =
        "⚠ 检测到旧式 Word 格式 (.doc)\n\n" +
        "当前仅支持现代 Word (.docx) 格式。\n\n" +
        "推荐转换方法：\n" +
        "方法 1（最可靠）：\n" +
        "  在 Microsoft Word 中打开 → 另存为 → 选择 \"Word 文档 (*.docx)\"\n\n" +
        "方法 2（WPS 用户）：\n" +
        "  在 WPS 中打开 → 另存为 → 文件类型选择 \"Microsoft Word 2007/2010/2013/2016/2019 文档 (*.docx)\"\n\n" +
        "方法 3（在线转换）：\n" +
        "  使用 Google Drive / 在线转换工具 将 .doc 导出为 .docx 后再上传\n\n" +
        "文件信息：\n" +
        `  文件名：${file.name}\n` +
        `  文件大小：${(file.size / 1024).toFixed(1)} KB\n` +
        `  MIME 类型：${file.type || "未知"}`;
      return result;
    }
    if (
      fileName.endsWith(".jpg") ||
      fileName.endsWith(".jpeg") ||
      fileName.endsWith(".png") ||
      fileName.endsWith(".gif") ||
      fileName.endsWith(".bmp") ||
      fileName.endsWith(".webp")
    ) {
      return await parseImage(file);
    }
    if (fileName.endsWith(".txt") || file.type.includes("text")) {
      return await parseText(file);
    }

    // 未知格式尝试当文本处理
    result.fileType = `其他格式 (${file.name.split(".").pop() || "未知"})`;
    result.text = "当前暂不支持该文件格式。\n支持的格式：PDF、Word (.docx)、图片 (jpg/png)、文本文件 (.txt)";
    return result;
  } catch (error) {
    result.error = (error as Error).message;
    result.text = `解析失败：${(error as Error).message}\n\n如果是大型文件（>10MB），请尝试拆分后再上传。`;
    return result;
  }
}

async function parsePdf(file: File): Promise<ParsedResult> {
  const pdfjs = await loadPdfLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  const result: ParsedResult = {
    fileType: "PDF 文档",
    fileName: file.name,
    text: "",
    pageCount: pdf.numPages,
    imageCount: 0,
  };

  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    let pageText = "";
    let lastY: number | null = null;

    // PDF.js 返回的 text 需要处理换行
    for (const item of content.items) {
      if ("str" in item) {
        // 如果 Y 坐标变化很大，视为换行
        if (lastY !== null && Math.abs(lastY - item.transform[5]) > 5) {
          pageText += "\n";
        }
        pageText += item.str;
        lastY = item.transform[5];
      }
    }

    // 尝试提取图片信息
    try {
      const operatorList = await page.getOperatorList();
      for (const fn of operatorList.fnArray) {
        if (fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintInlineImageXObject) {
          result.imageCount = (result.imageCount || 0) + 1;
        }
      }
    } catch {
      // 图片提取失败，忽略
    }

    if (pageText.trim()) {
      pageTexts.push(`\n=== 第 ${pageNum} 页 ===\n${pageText.trim()}`);
    }
  }

  result.text = pageTexts.join("\n\n");

  // 如果 PDF 没有文字（扫描件），提示
  if (!result.text || result.text.trim().length < 50) {
    result.text = `⚠ 该 PDF 可能是扫描件（图片 PDF），无法直接提取文字。\n\n建议：\n1. 尝试使用 OCR 功能重新上传（当前支持图片文件的 OCR）\n2. 或将 PDF 每页另存为图片后再上传\n3. 或手动复制粘贴关键内容到对话框\n\nPDF 基本信息：\n• 页数：${pdf.numPages}\n• 文件大小：${(file.size / 1024 / 1024).toFixed(2)} MB`;
  }

  return result;
}

async function parseDocx(file: File): Promise<ParsedResult> {
  const mammoth = await loadMammoth();
  const arrayBuffer = await file.arrayBuffer();

  const conversionResult = await mammoth.extractRawText({
    arrayBuffer,
  });

  const result: ParsedResult = {
    fileType: "Word 文档 (.docx)",
    fileName: file.name,
    text: conversionResult.value || "",
  };

  // mammoth 的 messages 中会包含警告（如无法处理的元素）
  if (conversionResult.messages && conversionResult.messages.length > 0) {
    const warnings = conversionResult.messages
      .filter((m) => m.type === "warning" || m.type === "error")
      .slice(0, 3)
      .map((m) => `• ${m.message}`);

    if (warnings.length > 0) {
      result.text += `\n\n⚠ 解析提示：\n${warnings.join("\n")}\n\n(如有图片内容，无法从 .docx 中自动提取文字)`;
    }
  }

  if (!result.text || result.text.trim().length < 10) {
    result.text = `⚠ Word 文档内容为空，或全部为图片。\n\n建议：\n1. 检查 Word 文档是否有文字内容\n2. 如果是纯图片，请另存为图片文件后用 OCR 识别`;
  }

  return result;
}

async function parseImage(file: File): Promise<ParsedResult> {
  const result: ParsedResult = {
    fileType: `图片文件 (${file.name.split(".").pop()?.toUpperCase() || "图片"})`,
    fileName: file.name,
    text: "",
    imageCount: 1,
  };

  try {
    // 使用 tesseract.js 进行 OCR
    const Tesseract = await loadTesseract();

    // 显示 OCR 进度
    result.text = "（正在识别图片文字，可能需要 10-30 秒，请耐心等待...）";

    const ocrResult = await Tesseract.recognize(file, "chi_sim+eng", {
      logger: (m) => {
        if (m.status === "recognizing text") {
          const progress = Math.round((m.progress ?? 0) * 100);
          if (progress % 20 === 0) {
          }
        }
      },
    });

    const ocrText = ocrResult.data?.text || "";

    if (ocrText.trim().length < 10) {
      result.text = `⚠ OCR 识别完成，但没有识别到足够的文字内容。\n\n可能的原因：\n1. 图片中的文字过小或模糊\n2. 图片质量不佳（如扫描件有噪点）\n3. 字体特殊或倾斜\n\n建议：\n• 使用更高清晰度的图片\n• 文字尽量水平，不要倾斜\n• 中文字体需要清晰可辨`;
    } else {
      result.text = ocrText.trim();
    }

    // 添加置信度信息
    if (ocrResult.data?.confidence) {
      result.text += `\n\n---\nOCR 识别置信度：${Math.round(ocrResult.data.confidence)}%`;
    }
  } catch (error) {
    result.text = `⚠ OCR 识别失败：${(error as Error).message}\n\n可能是网络问题或图片格式不兼容。\n请尝试：\n1. 检查网络连接\n2. 使用 jpg/png 格式的图片\n3. 图片不要过大（建议 <5MB）`;
  }

  return result;
}

async function parseText(file: File): Promise<ParsedResult> {
  const text = await file.text();
  const result: ParsedResult = {
    fileType: "文本文件",
    fileName: file.name,
    text,
  };

  if (!text || text.trim().length < 10) {
    result.text = "⚠ 文件内容为空或无法识别。";
  }

  return result;
}