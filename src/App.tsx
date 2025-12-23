import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';

type InputImage = {
  id: string;
  file: File;
  previewUrl: string;
};

type ProcessedImage = {
  id: string;
  originalName: string;
  seoName: string;
  blob: Blob;
  sizeKb: number;
  originalSizeKb: number;
  savedPercent: number;
  downloadUrl: string;
};

const MAX_FILES = 10;

const sanitizeKeyword = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const mimeToExt: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

type Lang = 'zh' | 'en';

const messages: Record<
  Lang,
  {
    navLogo: string;
    navMore: string;
    heroTitle: string;
    heroSub: string;
    dropTitle: string;
    dropSub: (max: number) => string;
    chooseImages: string;
    keywordLabel: string;
    keywordPlaceholder: string;
    keywordHint: string;
    checkboxLabel: string;
    processButton: string;
    downloadSingle: string;
    clear: string;
    messageLimit: (max: number) => string;
    messageInvalidType: string;
    messageProcessing: string;
    messageDone: string;
    messageFail: string;
    listTitle: (count: number) => string;
    listTip: string;
    waiting: string;
    tableHeadPreview: string;
    tableHeadOriginal: string;
    tableHeadNew: string;
    tableHeadBefore: string;
    tableHeadAfter: string;
    tableHeadSaving: string;
    tableHeadAction: string;
    workflowTitle: string;
    workflowStep1Title: string;
    workflowStep1Desc: string;
    workflowStep2Title: string;
    workflowStep2Desc: string;
    workflowStep3Title: string;
    workflowStep3Desc: string;
    valueTitle: string;
    valueP1: string;
    valueP2: string;
    statsHeading: string;
    stat1: string;
    stat2: string;
    stat3: string;
    stat4: string;
    stat5: string;
    howTitle: string;
    howStep1Title: string;
    howStep1Desc: string;
    howStep2Title: string;
    howStep2Desc: string;
    howStep3Title: string;
    howStep3Desc: string;
    footerSeoTitle: string;
    footerSeoP1: string;
    footerSeoP2: string;
    footerSeoP3: string;
    faqTitle: string;
    faqQ1: string;
    faqA1: string;
    faqQ2: string;
    faqA2: string;
    faqQ3: string;
    faqA3: string;
    faqQ4: string;
    faqA4: string;
    promptTitle: string;
    promptP1: string;
    promptP2: string;
  }
> = {
  zh: {
    navLogo: 'bubb-lab',
    navMore: '查看更多独立站运营工具',
    heroTitle: '为 Shopify 店铺批量优化商品图',
    heroSub:
      '只需上传图片和填写一个关键词，即可完成图片重命名与压缩，准备好适合上架的高质量商品图。',
    dropTitle: '拖拽图片到此，或点击选择文件',
    dropSub: (max: number) =>
      `支持 JPG / PNG / WEBP / HEIC，单次最多 ${max} 张，所有处理均在你浏览器本地完成。`,
    chooseImages: '选择图片',
    keywordLabel: '商品关键词（英文更利于 SEO）',
    keywordPlaceholder: '如：summer silk dress',
    keywordHint: '将自动生成：关键词-序号.原格式，并清洗特殊字符与空格。',
    checkboxLabel: '强制 1:1 正方形（自动居中裁剪，适合商品列表）',
    processButton: '一键重命名并压缩',
    downloadSingle: '下载图片',
    clear: '清空',
    messageLimit: (max: number) => `已达到单次 ${max} 张上限，为保证浏览器流畅度。`,
    messageInvalidType: '请选择 JPG, PNG, WEBP 或 HEIC 图片文件',
    messageProcessing: '正在本地处理中，请稍候…',
    messageDone: '处理完成，可下载图片。',
    messageFail: '处理失败，请重试或更换图片。',
    listTitle: (count: number) => `已导入图片（${count}）`,
    listTip: '不会上传到任何服务器，所有处理均在你浏览器本地完成。',
    waiting: '等待处理…',
    tableHeadPreview: '图片预览',
    tableHeadOriginal: '原始文件名',
    tableHeadNew: '新文件名',
    tableHeadBefore: '压缩前',
    tableHeadAfter: '压缩后',
    tableHeadSaving: '节省',
    tableHeadAction: '操作',
    workflowTitle: '三步完成 Shopify 商品图 SEO 处理',
    workflowStep1Title: '选择一组商品图片',
    workflowStep1Desc: '上传你准备上架到 Shopify / 独立站的商品图，支持日常拍摄或已有商品图。',
    workflowStep2Title: '输入核心关键词并本地压缩',
    workflowStep2Desc: '工具会在浏览器内将图片自动裁剪为 1:1（可选）并压缩为轻量格式。',
    workflowStep3Title: '下载图片并上传到店铺',
    workflowStep3Desc: '直接上传到商品详情和集合页，完成一次性优化。',
    valueTitle: '不用再为商品图拍摄与处理花费大量时间',
    valueP1:
      '只要有清晰的商品图片，你就可以通过在线压缩与统一命名，让它们在 Shopify 店铺中加载更快、更清晰，无需反复在 PS 和浏览器之间来回折腾。',
    valueP2:
      '无论你是个人卖家还是品牌团队，都可以把更多精力放在选品与获客成交，而不是机械的图片处理。',
    statsHeading: '用更好的商品图，带来更好的结果',
    stat1: '平均页面加载速度提升',
    stat2: '图片相关工时节省',
    stat3: '集合页点击率提升',
    stat4: '处理过程在本地完成',
    stat5: '累计处理图片数量',
    howTitle: '如何使用本工具优化你的商品图？',
    howStep1Title: '选择一组商品图片',
    howStep1Desc:
      '将你准备上架到 Shopify 的商品图拖入页面，或点击按钮选择已有图片文件，支持常见电商图像格式。',
    howStep2Title: '输入关键词并开始本地处理',
    howStep2Desc: '填写一个核心关键词，选择是否强制 1:1，然后一键启动本地压缩与重命名。',
    howStep3Title: '下载图片并上传到店铺',
    howStep3Desc: '把命名规整、体积更小的图片直接上传到商品详情和集合页，完成一次性优化。',
    footerSeoTitle: '为什么图片 SEO 对 Shopify 店铺这么重要？',
    footerSeoP1:
      '像 IMG_001.jpg 这样的文件名，对搜索引擎几乎没有任何语义信息；而 summer-silk-dress-01.jpg 则能明确告诉搜索引擎这是哪一类商品。',
    footerSeoP2:
      '通过统一命名并适度压缩，你可以在不牺牲清晰度的前提下显著减小图片体积，提升 PageSpeed 分数，降低跳出率，并在自然搜索与广告投放中获得更高转化。',
    footerSeoP3:
      '相比复杂的 SaaS 平台，这个工具更像是一个「上架前图片整理工作台」，一次性把文件名、比例与体积都处理好，再上传到 Shopify 商品与集合页。',
    faqTitle: '关于图片 SEO：常见问题解答',
    faqQ1: '这个工具会把图片上传到服务器吗？',
    faqA1:
      '不会。所有图片的读取、裁剪和压缩都在你的浏览器内存中完成，我们不会接触到任何文件，也没有后端存储。',
    faqQ2: '为什么要对图片做压缩优化？',
    faqA2:
      '适度压缩可以在尽量保持清晰度的同时显著减小文件体积，提升页面加载速度和 Core Web Vitals 表现，对 SEO 和转化都有帮助。',
    faqQ3: '文件名一定要用英文吗？',
    faqA3:
      '建议优先使用英文或拼音，有助于欧美市场的搜索引擎更好理解；如果主要面向本地市场，也可以使用中文，我们会自动处理空格和特殊字符。',
    faqQ4: '强制 1:1 裁剪会不会影响商品展示？',
    faqA4:
      '对于 Shopify 集合页或网格列表，统一 1:1 比例通常能带来更整洁的视觉效果；如果你的商品需要完整纵向展示，也可以关闭该选项保持原始比例。',
    promptTitle: '想进一步诊断整店图片 SEO 么？',
    promptP1:
      '即将上线的「全店图片 SEO 诊断」可一键扫描你的 Shopify 商店，找出：未压缩图片、非 WebP 图片、文件名不友好的商品图等问题。',
    promptP2: '现在留下邮箱，优先获得内测邀请（可选）：暂未接入表单，这里仅作文案预告。'
  },
  en: {
    navLogo: 'bubb-lab',
    navMore: 'Explore more eCommerce tools',
    heroTitle: 'Optimize Shopify product images in bulk',
    heroSub:
      'Just upload images and enter one keyword to batch rename and compress locally—ready for listing in minutes.',
    dropTitle: 'Drag images here or click to select',
    dropSub: (max: number) =>
      `Supports JPG / PNG / WEBP / HEIC, up to ${max} images per batch. All processing happens locally in your browser.`,
    chooseImages: 'Choose images',
    keywordLabel: 'Product keyword (English recommended for SEO)',
    keywordPlaceholder: 'e.g. summer silk dress',
    keywordHint:
      'Will auto-generate: keyword-index.originalExt, with spaces/special characters cleaned.',
    checkboxLabel: 'Force 1:1 square (auto center-crop, good for product grids)',
    processButton: 'Rename & compress',
    downloadSingle: 'Download image',
    clear: 'Clear',
    messageLimit: (max: number) =>
      `Reached the limit of ${max} images per batch to keep the browser smooth.`,
    messageInvalidType: 'Please select JPG, PNG, WEBP, or HEIC images.',
    messageProcessing: 'Processing locally, please wait…',
    messageDone: 'Processing completed. You can download the images.',
    messageFail: 'Processing failed. Please retry with other images.',
    listTitle: (count: number) => `Imported images (${count})`,
    listTip: 'Nothing is uploaded to any server; all processing stays in your browser.',
    waiting: 'Waiting to process…',
    tableHeadPreview: 'Preview',
    tableHeadOriginal: 'Original name',
    tableHeadNew: 'New name',
    tableHeadBefore: 'Before',
    tableHeadAfter: 'After',
    tableHeadSaving: 'Saving',
    tableHeadAction: 'Action',
    workflowTitle: '3 steps to optimize Shopify images',
    workflowStep1Title: 'Choose your product images',
    workflowStep1Desc:
      'Upload the product photos you plan to list on Shopify / your site; everyday shots or existing images are fine.',
    workflowStep2Title: 'Enter a keyword and compress locally',
    workflowStep2Desc:
      'We can auto crop to 1:1 (optional) and compress in your browser without uploading to servers.',
    workflowStep3Title: 'Download images and upload to your store',
    workflowStep3Desc:
      'Upload the renamed and smaller images directly to product pages and collections to finish optimization.',
    valueTitle: 'Save time on product image prep',
    valueP1:
      'With clear product photos, you can compress and rename online so Shopify pages load faster without bouncing between PS and your browser.',
    valueP2:
      'Whether you’re a solo seller or a team, spend more time on products and customers—not repetitive image work.',
    statsHeading: 'Better images, better results',
    stat1: 'Page load speed uplift',
    stat2: 'Image ops time saved',
    stat3: 'Collection CTR uplift',
    stat4: 'Processing done locally',
    stat5: 'Total images processed',
    howTitle: 'How to use this tool',
    howStep1Title: 'Pick a set of product images',
    howStep1Desc:
      'Drag your Shopify product images into the page or click to select. Common ecom formats are supported.',
    howStep2Title: 'Enter a keyword and start processing',
    howStep2Desc:
      'Fill a core keyword, choose whether to force 1:1, then run one-click local compression and rename.',
    howStep3Title: 'Download images and upload to store',
    howStep3Desc:
      'Upload the renamed, smaller images directly to product and collection pages to finish optimization.',
    footerSeoTitle: 'Why image SEO matters for Shopify',
    footerSeoP1:
      'A filename like IMG_001.jpg tells search engines nothing; summer-silk-dress-01.jpg clearly signals the product category.',
    footerSeoP2:
      'Consistent naming plus smart compression reduces file size without losing clarity, boosts PageSpeed, lowers bounce, and improves conversions.',
    footerSeoP3:
      'Think of this as a “pre-upload image workstation” to fix names, ratios, and sizes before pushing to Shopify products and collections.',
    faqTitle: 'Image SEO FAQs',
    faqQ1: 'Does this tool upload images to a server?',
    faqA1:
      'No. Reading, cropping, and compression all happen in your browser memory. We never touch or store your files.',
    faqQ2: 'Why compress images?',
    faqA2:
      'Right-sized files load faster and improve Core Web Vitals, helping SEO and conversions while keeping clarity.',
    faqQ3: 'Must filenames be in English?',
    faqA3:
      'English or pinyin is recommended for global search engines. For local markets, Chinese is fine—spaces and special characters are cleaned automatically.',
    faqQ4: 'Will forcing 1:1 hurt my product display?',
    faqA4:
      'For collection grids, consistent 1:1 usually looks cleaner. If you need full-height shots, leave it off to keep the original ratio.',
    promptTitle: 'Want a full-store image SEO audit?',
    promptP1:
      'Coming soon: scan your Shopify store to find uncompressed images, non-WebP assets, and unfriendly filenames.',
    promptP2:
      'Leave an email for early access (optional). No form is wired yet—this is a copy preview.'
  }
};

const detectLangFromNavigator = (): Lang => {
  if (typeof navigator === 'undefined') return 'zh';
  const nav = navigator.language?.toLowerCase() || '';
  const zhList = ['zh', 'zh-cn', 'zh-hans', 'zh-hk', 'zh-mo', 'zh-tw'];
  return zhList.some((z) => nav.startsWith(z)) ? 'zh' : 'en';
};

const App: React.FC = () => {
  const [keyword, setKeyword] = useState('');
  const [files, setFiles] = useState<InputImage[]>([]);
  const [processed, setProcessed] = useState<ProcessedImage[]>([]);
  const [isSquare, setIsSquare] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showSeoPrompt, setShowSeoPrompt] = useState(false);
  const [faqOpenId, setFaqOpenId] = useState<string | null>('q1');
  const [lang, setLang] = useState<Lang>('zh');
  const [totalProcessedCount, setTotalProcessedCount] = useState<number>(0);
  const [faqClickCount, setFaqClickCount] = useState<number>(0);
  const faqClickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const userSelectedLang = useRef(false);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      const incoming = Array.from(fileList).filter((f) =>
        ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(f.type)
      );
      if (!incoming.length) {
        setMessage(messages[lang].messageInvalidType);
        return;
      }
      const remainingSlots = MAX_FILES - files.length;
      const sliced = incoming.slice(0, remainingSlots);
      const mapped: InputImage[] = sliced.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file)
      }));
      if (files.length + mapped.length >= MAX_FILES) {
        setMessage(messages[lang].messageLimit(MAX_FILES));
      } else {
        setMessage(null);
      }
      setFiles((prev) => [...prev, ...mapped]);
      setProcessed([]);
      setShowSeoPrompt(false);
    },
    [files.length, lang]
  );

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleFiles(e.dataTransfer.files);
  };

  const onBrowseChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    handleFiles(e.target.files);
    e.target.value = '';
  };

  const canProcess = useMemo(
    () => !!keyword.trim() && files.length > 0 && !isProcessing,
    [keyword, files.length, isProcessing]
  );

  const revokeDownloadUrls = (items: ProcessedImage[]) => {
    items.forEach((item) => {
      if (item.downloadUrl) URL.revokeObjectURL(item.downloadUrl);
    });
  };

  const processImages = useCallback(async () => {
    if (!files.length || !keyword.trim()) return;
    setIsProcessing(true);
    setMessage(messages[lang].messageProcessing);
    setShowSeoPrompt(false);
    revokeDownloadUrls(processed);

    const cleanKeyword = sanitizeKeyword(keyword) || 'product';
    const results: ProcessedImage[] = [];

    for (let i = 0; i < files.length; i += 1) {
      const input = files[i];
      try {
        // 读取为 ImageBitmap / HTMLImageElement
        const blob = input.file;
        const imgBitmap = await createImageBitmap(blob).catch(async () => {
          // 兼容性回退
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = (err) => reject(err);
            image.src = URL.createObjectURL(blob);
          });
          return img as unknown as ImageBitmap;
        });

        const width = (imgBitmap as any).width;
        const height = (imgBitmap as any).height;

        let targetWidth = width;
        let targetHeight = height;
        let sx = 0;
        let sy = 0;
        let sWidth = width;
        let sHeight = height;

        if (isSquare) {
          const size = Math.min(width, height);
          sWidth = size;
          sHeight = size;
          sx = (width - size) / 2;
          sy = (height - size) / 2;
          targetWidth = size;
          targetHeight = size;
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas not supported');

        ctx.drawImage(
          imgBitmap as any,
          sx,
          sy,
          sWidth,
          sHeight,
          0,
          0,
          targetWidth,
          targetHeight
        );

        const originalType = input.file.type || 'image/jpeg';
        const preferredType = ['image/jpeg', 'image/png', 'image/webp'].includes(originalType)
          ? originalType
          : 'image/jpeg';
        const canAdjustQuality = preferredType === 'image/jpeg' || preferredType === 'image/webp';

        const toBlobAsync = (type: string, quality?: number) =>
          new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
              type,
              quality
            );
          });

        let quality = canAdjustQuality ? 0.78 : undefined;
        let outputBlob: Blob = await toBlobAsync(preferredType, quality);

        const targetBytes = 200 * 1024;
        if (canAdjustQuality && outputBlob.size > targetBytes) {
          quality = 0.6;
          outputBlob = await toBlobAsync(preferredType, quality);
        }

        const indexStr = String(i + 1).padStart(2, '0');
        const originalSizeKb = +(input.file.size / 1024).toFixed(1);

        let ext = mimeToExt[preferredType] || 'jpg';
        let finalBlob = outputBlob;

        // 如果压缩后反而更大，则退回使用原文件，避免体积变大导致负数百分比
        if (outputBlob.size > input.file.size) {
          finalBlob = input.file;
          ext = mimeToExt[originalType] || ext;
        }

        const seoName = `${cleanKeyword}-${indexStr}.${ext}`;
        const finalSizeKb = +(finalBlob.size / 1024).toFixed(1);
        const savedPercent =
          originalSizeKb > 0
            ? Math.max(0, +(((originalSizeKb - finalBlob.size / 1024) / originalSizeKb) * 100).toFixed(1))
            : 0;
        const downloadUrl = URL.createObjectURL(finalBlob);
        results.push({
          id: input.id,
          originalName: input.file.name,
          seoName,
          blob: finalBlob,
          sizeKb: finalSizeKb,
          originalSizeKb,
          savedPercent,
          downloadUrl
        });
      } catch (err) {
        console.error(err);
      }
    }

    setProcessed(results);
    setIsProcessing(false);
    setMessage(results.length ? messages[lang].messageDone : messages[lang].messageFail);
    
    // 更新总处理图片数量
    if (results.length > 0) {
      setTotalProcessedCount((prevCount) => {
        const newTotal = prevCount + results.length;
        localStorage.setItem('totalProcessedCount', String(newTotal));
        return newTotal;
      });
    }
  }, [files, keyword, isSquare, lang]);

  const downloadZip = useCallback(async () => {
    if (!processed.length) return;
    const zip = new JSZip();
    processed.forEach((item) => {
      zip.file(item.seoName, item.blob);
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shopify-image-seo-${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    setShowSeoPrompt(true);
  }, [processed]);

  const downloadSingle = useCallback(
    (item: ProcessedImage) => {
      const a = document.createElement('a');
      a.href = item.downloadUrl;
      a.download = item.seoName;
      a.click();
    },
    []
  );

  const resetAll = () => {
    files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    revokeDownloadUrls(processed);
    setFiles([]);
    setProcessed([]);
    setKeyword('');
    setMessage(null);
    setShowSeoPrompt(false);
  };

  useEffect(() => {
    // 从 localStorage 读取总处理图片数量
    const savedCount = localStorage.getItem('totalProcessedCount');
    if (savedCount) {
      const count = parseInt(savedCount, 10);
      if (!isNaN(count) && count >= 0) {
        setTotalProcessedCount(count);
      }
    }
    
    const saved = localStorage.getItem('lang') as Lang | null;
    if (saved === 'zh' || saved === 'en') {
      setLang(saved);
      return;
    }
    const navLang = detectLangFromNavigator();
    setLang(navLang);

    let cancelled = false;
    fetch('https://ipapi.co/json/')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || userSelectedLang.current) return;
        const country = (data?.country_code || '').toUpperCase();
        if (country === 'CN' || country === 'HK') {
          setLang('zh');
        } else {
          setLang('en');
        }
      })
      .catch(() => {
        /* ignore */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // 清理FAQ点击定时器
  useEffect(() => {
    return () => {
      if (faqClickTimerRef.current) {
        clearTimeout(faqClickTimerRef.current);
      }
    };
  }, []);

  const handleLangToggle = () => {
    const next = lang === 'zh' ? 'en' : 'zh';
    userSelectedLang.current = true;
    localStorage.setItem('lang', next);
    setLang(next);
  };

  const handleFaqTitleClick = () => {
    // 清除之前的定时器
    if (faqClickTimerRef.current) {
      clearTimeout(faqClickTimerRef.current);
    }

    // 增加点击计数
    const newCount = faqClickCount + 1;
    setFaqClickCount(newCount);

    // 如果连续点击3次，显示处理图片数量
    if (newCount >= 3) {
      const count = totalProcessedCount || 0;
      const message = lang === 'zh' 
        ? `累计处理图片数量：${count.toLocaleString()} 张`
        : `Total images processed: ${count.toLocaleString()}`;
      alert(message);
      setFaqClickCount(0);
    } else {
      // 设置定时器，2秒后重置计数
      faqClickTimerRef.current = setTimeout(() => {
        setFaqClickCount(0);
      }, 2000);
    }
  };

  const t = messages[lang];

  return (
    <div className="page">
      <nav className="top-nav">
        <div className="nav-container">
          <a
            href="https://www.bubb-lab.com"
            className="nav-logo"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            {t.navLogo}
          </a>
          <div className="nav-actions">
            <a
              href="https://www.bubb-lab.com/lab"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-link"
            >
              {t.navMore}
            </a>
            <button type="button" className="nav-lang" onClick={handleLangToggle}>
              {lang === 'zh' ? 'EN' : '中'}
            </button>
          </div>
        </div>
      </nav>
      <header className="hero">
        <div className="hero-inner">
          <div className="hero-heading">
            <h1>{t.heroTitle}</h1>
            <p className="hero-sub">{t.heroSub}</p>
          </div>

          <div className="hero-drop">
            <div
              className="drop-area"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={onDrop}
            >
              <div className="drop-inner">
                <p className="drop-title">{t.dropTitle}</p>
                <p className="drop-sub">{t.dropSub(MAX_FILES)}</p>
                <button
                  type="button"
                  className="btn-primary hero-cta"
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  {t.chooseImages}
                </button>
                <input
                  id="file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  multiple
                  onChange={onBrowseChange}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        <section className="panel panel-upload">
          <h2 className="section-title">{t.workflowStep2Title}</h2>
          <p className="section-sub">{t.workflowStep2Desc}</p>
          {!!files.length && (
            <div className="list">
              <div className="list-header">
                <span>{t.listTitle(files.length)}</span>
                <span className="list-tip">{t.listTip}</span>
              </div>
              <div className="thumbs">
                {files.map((item, index) => {
                  const matched = processed.find((p) => p.id === item.id);
                  return (
                    <div key={item.id} className="thumb">
                      <img src={item.previewUrl} alt={item.file.name} />
                      <div className="thumb-meta">
                        <div className="thumb-line thumb-line-main">
                          <span className="thumb-index">
                            #{String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="thumb-original" title={item.file.name}>
                            {item.file.name}
                          </span>
                        </div>
                        <div className="thumb-line">
                          <span className="thumb-arrow">→</span>
                          <span className="thumb-seo">
                            {matched ? matched.seoName : t.waiting}
                          </span>
                          {matched && (
                            <span className="thumb-size">
                              {(matched.sizeKb / 1024).toFixed(2)} MB
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="control-row">
            <label className="field">
              <span className="field-label">{t.keywordLabel}</span>
              <input
                type="text"
                placeholder={t.keywordPlaceholder}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <span className="field-hint">{t.keywordHint}</span>
            </label>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={isSquare}
                onChange={(e) => setIsSquare(e.target.checked)}
              />
              <span>{t.checkboxLabel}</span>
            </label>
          </div>

          {message && <div className="message">{message}</div>}

          <div className="actions-row">
            <button
              type="button"
              className="btn-primary"
              disabled={!canProcess}
              onClick={processImages}
            >
              {isProcessing ? t.messageProcessing : t.processButton}
            </button>
            {!!files.length && (
              <button type="button" className="btn-text" onClick={resetAll}>
                {t.clear}
              </button>
            )}
          </div>

          {!!processed.length && (
            <div className="result-table">
              <div className="table-head">
                <span>{t.tableHeadPreview}</span>
                <span>{t.tableHeadOriginal}</span>
                <span>{t.tableHeadNew}</span>
                <span>{t.tableHeadBefore}</span>
                <span>{t.tableHeadAfter}</span>
                <span>{t.tableHeadSaving}</span>
                <span>{t.tableHeadAction}</span>
              </div>
              {processed.map((item, idx) => {
                const input = files.find((f) => f.id === item.id);
                return (
                  <div className="table-row" key={item.id}>
                    <div className="table-thumb">
                      {input ? <img src={input.previewUrl} alt={item.originalName} /> : null}
                      <span className="table-index">#{String(idx + 1).padStart(2, '0')}</span>
                    </div>
                    <span className="table-text" title={item.originalName}>
                      {item.originalName}
                    </span>
                    <span className="table-text" title={item.seoName}>
                      {item.seoName}
                    </span>
                    <span className="table-mono">
                      {(item.originalSizeKb / 1024).toFixed(2)} MB
                    </span>
                    <span className="table-mono">
                      {(item.sizeKb / 1024).toFixed(2)} MB
                    </span>
                    <span className="table-mono table-saving">-{item.savedPercent}%</span>
                    <button
                      type="button"
                      className="btn-outline btn-sm"
                      onClick={() => downloadSingle(item)}
                    >
                      {t.downloadSingle}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {showSeoPrompt && (
            <div className="prompt">
              <h3>{t.promptTitle}</h3>
              <p>{t.promptP1}</p>
              <p className="prompt-sub">{t.promptP2}</p>
            </div>
          )}
        </section>

        <section className="value-section value-section-text-only">
          <div className="value-copy">
            <h2>{t.valueTitle}</h2>
            <p>{t.valueP1}</p>
            <p>{t.valueP2}</p>
          </div>
        </section>

        <section className="stats-section">
          <h2 className="stats-heading">{t.statsHeading}</h2>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-number">↑ 20%</span>
              <span className="stat-label">{t.stat1}</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">↓ 30%</span>
              <span className="stat-label">{t.stat2}</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">↑ 15%</span>
              <span className="stat-label">{t.stat3}</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">100%</span>
              <span className="stat-label">{t.stat4}</span>
            </div>
          </div>
        </section>

        <section className="how-section">
          <h2>{t.howTitle}</h2>
          <div className="how-grid">
            <div className="how-card">
              <span className="how-step-tag">{lang === 'zh' ? '步骤 1' : 'Step 1'}</span>
              <h3>{t.howStep1Title}</h3>
              <p>{t.howStep1Desc}</p>
            </div>
            <div className="how-card">
              <span className="how-step-tag">{lang === 'zh' ? '步骤 2' : 'Step 2'}</span>
              <h3>{t.howStep2Title}</h3>
              <p>{t.howStep2Desc}</p>
            </div>
            <div className="how-card">
              <span className="how-step-tag">{lang === 'zh' ? '步骤 3' : 'Step 3'}</span>
              <h3>{t.howStep3Title}</h3>
              <p>{t.howStep3Desc}</p>
            </div>
          </div>
        </section>

        <section className="footer-seo">
          <h2>{t.footerSeoTitle}</h2>
          <p>{t.footerSeoP1}</p>
          <p>{t.footerSeoP2}</p>
          <p>{t.footerSeoP3}</p>
        </section>

        <section className="faq-section">
          <h2 style={{ cursor: 'pointer', userSelect: 'none' }} onClick={handleFaqTitleClick}>
            {t.faqTitle}
          </h2>
          <div className="faq-list">
            <button
              type="button"
              className="faq-item"
              onClick={() => setFaqOpenId(faqOpenId === 'q1' ? null : 'q1')}
            >
              <div className="faq-head">
                <span>{t.faqQ1}</span>
                <span className="faq-icon">{faqOpenId === 'q1' ? '−' : '+'}</span>
              </div>
              {faqOpenId === 'q1' && (
                <p>{t.faqA1}</p>
              )}
            </button>

            <button
              type="button"
              className="faq-item"
              onClick={() => setFaqOpenId(faqOpenId === 'q2' ? null : 'q2')}
            >
              <div className="faq-head">
                <span>{t.faqQ2}</span>
                <span className="faq-icon">{faqOpenId === 'q2' ? '−' : '+'}</span>
              </div>
              {faqOpenId === 'q2' && (
                <p>{t.faqA2}</p>
              )}
            </button>

            <button
              type="button"
              className="faq-item"
              onClick={() => setFaqOpenId(faqOpenId === 'q3' ? null : 'q3')}
            >
              <div className="faq-head">
                <span>{t.faqQ3}</span>
                <span className="faq-icon">{faqOpenId === 'q3' ? '−' : '+'}</span>
              </div>
              {faqOpenId === 'q3' && (
                <p>{t.faqA3}</p>
              )}
            </button>

            <button
              type="button"
              className="faq-item"
              onClick={() => setFaqOpenId(faqOpenId === 'q4' ? null : 'q4')}
            >
              <div className="faq-head">
                <span>{t.faqQ4}</span>
                <span className="faq-icon">{faqOpenId === 'q4' ? '−' : '+'}</span>
              </div>
              {faqOpenId === 'q4' && (
                <p>{t.faqA4}</p>
              )}
            </button>
          </div>
        </section>
      </main>

      <footer className="page-footer">
        <div className="footer-content">
          <p>
            © 2025{' '}
            <a
              href="https://www.bubb-lab.com"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              bubb-lab
            </a>
            . Built for eCommerce Creators.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;


