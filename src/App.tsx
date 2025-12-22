import React, { useCallback, useMemo, useState } from 'react';
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

const App: React.FC = () => {
  const [keyword, setKeyword] = useState('');
  const [files, setFiles] = useState<InputImage[]>([]);
  const [processed, setProcessed] = useState<ProcessedImage[]>([]);
  const [isSquare, setIsSquare] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showSeoPrompt, setShowSeoPrompt] = useState(false);
  const [faqOpenId, setFaqOpenId] = useState<string | null>('q1');

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const incoming = Array.from(fileList).filter((f) =>
      ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(f.type)
    );
    if (!incoming.length) {
      setMessage('请选择 JPG, PNG, WEBP 或 HEIC 图片文件');
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
      setMessage(`已达到单次 ${MAX_FILES} 张上限，为保证浏览器流畅度。`);
    } else {
      setMessage(null);
    }
    setFiles((prev) => [...prev, ...mapped]);
    setProcessed([]);
    setShowSeoPrompt(false);
  }, [files.length]);

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
    setMessage('正在本地处理中，请稍候…');
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
    setMessage(results.length ? '处理完成，可下载 ZIP。' : '处理失败，请重试或更换图片。');
  }, [files, keyword, isSquare]);

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

  return (
    <div className="page">
      <nav className="top-nav">
        <div className="nav-container">
          <div className="nav-logo">bubb-lab 实验室</div>
          <a
            href="https://yourstudio.com/lab"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-link"
          >
            查看更多独立站运营工具
          </a>
        </div>
      </nav>
      <header className="hero">
        <div className="hero-inner">
          <div className="hero-heading">
            <h1>为 Shopify 店铺批量优化商品图</h1>
            <p className="hero-sub">
              只需上传图片和填写一个关键词，即可完成图片重命名与压缩，准备好适合上架的高质量商品图。
            </p>
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
                <p className="drop-title">拖拽图片到此，或点击选择文件</p>
                <p className="drop-sub">
                  支持 JPG / PNG / WEBP / HEIC，单次最多 {MAX_FILES} 张；所有处理均在你浏览器本地完成。
                </p>
                <button
                  type="button"
                  className="btn-primary hero-cta"
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  选择图片
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
          <h2 className="section-title">设置图片名称关键词</h2>
          <p className="section-sub">
            选择一个能概括这一组商品图的英文或拼音关键词，工具会据此自动生成 SEO 友好的文件名。
          </p>
          {!!files.length && (
            <div className="list">
              <div className="list-header">
                <span>已导入图片（{files.length}）</span>
                <span className="list-tip">
                  不会上传到任何服务器，所有处理均在你浏览器本地完成。
                </span>
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
                            {matched ? matched.seoName : '等待处理…'}
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
              <span className="field-label">商品关键词（英文更利于 SEO）</span>
              <input
                type="text"
                placeholder="如：summer silk dress"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <span className="field-hint">
                将自动生成：<code>关键词-序号.原格式</code>，并清洗特殊字符与空格。
              </span>
            </label>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={isSquare}
                onChange={(e) => setIsSquare(e.target.checked)}
              />
              <span>强制 1:1 正方形（自动居中裁剪，适合商品列表）</span>
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
              {isProcessing ? '处理中…' : '一键重命名并压缩'}
            </button>
            {!!files.length && (
              <button type="button" className="btn-text" onClick={resetAll}>
                清空
              </button>
            )}
          </div>

          {!!processed.length && (
            <div className="result-table">
              <div className="table-head">
                <span>图片预览</span>
                <span>原始文件名</span>
                <span>新文件名</span>
                <span>压缩前</span>
                <span>压缩后</span>
                <span>节省</span>
                <span>操作</span>
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
                      下载图片
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {showSeoPrompt && (
            <div className="prompt">
              <h3>想进一步诊断整店图片 SEO 么？</h3>
              <p>
                即将上线的「全店图片 SEO 诊断」可一键扫描你的 Shopify 商店，找出：
                未压缩图片、命名不友好的商品图等问题。
              </p>
              <p className="prompt-sub">
                现在留下邮箱，优先获得内测邀请（可选）：暂未接入表单，这里仅作文案预告。
              </p>
            </div>
          )}
        </section>

        <section className="value-section value-section-text-only">
          <div className="value-copy">
            <h2>不用再为商品图拍摄与处理花费大量时间</h2>
            <p>
              只要有清晰的商品图片，你就可以通过在线压缩与统一命名，让它们在 Shopify 店铺中加载更快、更清晰，无需反复在 PS 和浏览器之间来回折腾。
            </p>
            <p>
              无论你是个人卖家还是品牌团队，都可以把更多精力放在选品与获客成交，而不是机械的图片处理。
            </p>
          </div>
        </section>

        <section className="stats-section">
          <h2 className="stats-heading">用更好的商品图，带来更好的结果</h2>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-number">↑ 20%</span>
              <span className="stat-label">平均页面加载速度提升</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">↓ 30%</span>
              <span className="stat-label">图片相关工时节省</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">↑ 15%</span>
              <span className="stat-label">集合页点击率提升</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">100%</span>
              <span className="stat-label">处理过程在本地完成</span>
            </div>
          </div>
        </section>

        <section className="how-section">
          <h2>如何使用本工具优化你的商品图？</h2>
          <div className="how-grid">
            <div className="how-card">
              <span className="how-step-tag">步骤 1</span>
              <h3>选择一组商品图片</h3>
              <p>
                将你准备上架到 Shopify 的商品图拖入页面，或点击按钮选择已有图片文件，支持常见电商图像格式。
              </p>
            </div>
            <div className="how-card">
              <span className="how-step-tag">步骤 2</span>
              <h3>输入关键词并开始本地处理</h3>
              <p>
                填写一个核心关键词，选择是否强制 1:1 正方形，然后一键启动本地压缩与重命名，无需上传到服务器。
              </p>
            </div>
            <div className="how-card">
              <span className="how-step-tag">步骤 3</span>
              <h3>下载 ZIP 并上传到店铺</h3>
              <p>
                将生成的 ZIP 包解压后，把命名规整、体积更小的图片（保留原格式）
                直接上传到商品详情和集合页，完成一次性优化。
              </p>
            </div>
          </div>
        </section>

        <section className="footer-seo">
          <h2>为什么图片 SEO 对 Shopify 店铺这么重要？</h2>
          <p>
            像 <code>IMG_001.jpg</code> 这样的文件名，对搜索引擎几乎没有任何语义信息；而{' '}
            <code>summer-silk-dress-01.jpg</code> 则能明确告诉搜索引擎这是哪一类商品。
          </p>
          <p>
            通过统一命名并适度压缩，你可以在不牺牲清晰度的前提下显著减小图片体积，提升
            PageSpeed 分数，降低跳出率，并在自然搜索与广告投放中获得更高转化。
          </p>
          <p>
            相比复杂的 SaaS 平台，这个工具更像是一个「上架前图片整理工作台」，一次性把文件名、
            比例与体积都处理好，再上传到 Shopify 商品与集合页。
          </p>
        </section>

        <section className="faq-section">
          <h2>关于图片 SEO：常见问题解答</h2>
          <div className="faq-list">
            <button
              type="button"
              className="faq-item"
              onClick={() => setFaqOpenId(faqOpenId === 'q1' ? null : 'q1')}
            >
              <div className="faq-head">
                <span>这个工具会把图片上传到服务器吗？</span>
                <span className="faq-icon">{faqOpenId === 'q1' ? '−' : '+'}</span>
              </div>
              {faqOpenId === 'q1' && (
                <p>
                  不会。所有图片的读取、裁剪和压缩都在你的浏览器内存中完成，我们不会接触到任何文件，也没有后端存储。
                </p>
              )}
            </button>

            <button
              type="button"
              className="faq-item"
              onClick={() => setFaqOpenId(faqOpenId === 'q2' ? null : 'q2')}
            >
              <div className="faq-head">
                <span>为什么要对图片做压缩优化？</span>
                <span className="faq-icon">{faqOpenId === 'q2' ? '−' : '+'}</span>
              </div>
              {faqOpenId === 'q2' && (
                <p>
                  适度压缩可以在尽量保持清晰度的同时显著减小文件体积，提升页面加载速度和 Core Web
                  Vitals 表现，对 SEO 和转化都有帮助。
                </p>
              )}
            </button>

            <button
              type="button"
              className="faq-item"
              onClick={() => setFaqOpenId(faqOpenId === 'q3' ? null : 'q3')}
            >
              <div className="faq-head">
                <span>文件名一定要用英文吗？</span>
                <span className="faq-icon">{faqOpenId === 'q3' ? '−' : '+'}</span>
              </div>
              {faqOpenId === 'q3' && (
                <p>
                  建议优先使用英文或拼音，有助于欧美市场的搜索引擎更好理解；如果主要面向本地市场，也可以使用中文，我们会自动处理空格和特殊字符。
                </p>
              )}
            </button>

            <button
              type="button"
              className="faq-item"
              onClick={() => setFaqOpenId(faqOpenId === 'q4' ? null : 'q4')}
            >
              <div className="faq-head">
                <span>强制 1:1 裁剪会不会影响商品展示？</span>
                <span className="faq-icon">{faqOpenId === 'q4' ? '−' : '+'}</span>
              </div>
              {faqOpenId === 'q4' && (
                <p>
                  对于 Shopify 集合页或网格列表，统一 1:1 比例通常能带来更整洁的视觉效果；
                  如果你的商品需要完整纵向展示，也可以关闭该选项保持原始比例。
                </p>
              )}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;


