// 智能图片关键词分析器
// 结合文件名分析和本地图像识别提取商品关键词

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl'; // WebGL后端，性能更好
import '@tensorflow/tfjs-backend-cpu'; // CPU后端，兼容性更好
import * as mobilenet from '@tensorflow-models/mobilenet';

// 定义类型
export interface ImageInfo {
  fileName: string;
  fileType: string;
  fileSize: number;
  suggestedCategory: string;
  suggestedKeywords: string[];
}

// AI API 配置接口
interface AIConfig {
  provider: 'openai' | 'google' | 'huggingface' | 'none';
  apiKey?: string;
  enabled: boolean;
}

/**
 * 智能图片分析器 - 使用文件名分析和本地图像识别
 */
class ImageAnalyzer {
  private aiConfig: AIConfig = {
    provider: 'none',
    enabled: false
  };
  
  private mobilenetModel: mobilenet.MobileNet | null = null;
  private modelLoading: Promise<mobilenet.MobileNet> | null = null;

  /**
   * 设置AI配置
   */
  setAIConfig(config: AIConfig) {
    this.aiConfig = config;
    // 保存到localStorage
    localStorage.setItem('aiConfig', JSON.stringify(config));
  }

  /**
   * 初始化TensorFlow.js后端（必须，否则会报错 "No backend found in registry"）
   */
  private async initTensorFlowBackend(): Promise<void> {
    // 检查是否已经有后端
    try {
      const backends = tf.engine().backendNames;
      if (backends.length > 0) {
        console.log('✅ TensorFlow.js backend already initialized:', backends);
        return;
      }
    } catch (e) {
      // 如果检查失败，继续初始化
    }

    console.log('📦 Initializing TensorFlow.js backend...');
    
    // 尝试使用WebGL后端（性能更好）
    try {
      await tf.setBackend('webgl');
      await tf.ready();
      console.log('✅ WebGL backend initialized');
      return;
    } catch (error) {
      console.warn('⚠️ WebGL backend failed, falling back to CPU:', error);
    }

    // 回退到CPU后端
    try {
      await tf.setBackend('cpu');
      await tf.ready();
      console.log('✅ CPU backend initialized');
    } catch (error) {
      console.error('❌ Failed to initialize TensorFlow.js backend:', error);
      throw error;
    }
  }

  /**
   * 加载MobileNet模型（本地运行，无需API）
   */
  private async loadMobileNetModel(): Promise<mobilenet.MobileNet> {
    // 如果模型正在加载，返回同一个Promise
    if (this.modelLoading) {
      return this.modelLoading;
    }

    // 如果模型已加载，直接返回
    if (this.mobilenetModel) {
      return this.mobilenetModel;
    }

    // 先初始化后端（必须，否则会报错）
    await this.initTensorFlowBackend();

    // 开始加载模型
    console.log('📦 Loading MobileNet model...');
    this.modelLoading = mobilenet.load({
      version: 2,
      alpha: 1.0
    }).then(model => {
      console.log('✅ MobileNet model loaded');
      this.mobilenetModel = model;
      this.modelLoading = null;
      return model;
    }).catch(error => {
      console.error('❌ Failed to load MobileNet model:', error);
      this.modelLoading = null;
      throw error;
    });

    return this.modelLoading;
  }

  /**
   * 使用本地MobileNet模型识别图片内容（完全免费，无CORS问题）
   */
  private async recognizeWithMobileNet(imageFile: File): Promise<string[]> {
    try {
      console.log('🚀 Starting MobileNet recognition for:', imageFile.name);
      
      // 加载模型
      const model = await this.loadMobileNetModel();
      
      // 创建图片元素
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = URL.createObjectURL(imageFile);
      });

      // 进行预测
      console.log('🔍 Running prediction...');
      const predictions = await model.classify(img);
      console.log('✅ Predictions:', predictions);

      // 清理URL
      URL.revokeObjectURL(img.src);

      // 提取关键词（置信度>0.3）
      const keywords: string[] = [];
      predictions.forEach(prediction => {
        if (prediction.probability > 0.3) {
          const label = prediction.className.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-');
          if (label.length > 2 && !keywords.includes(label)) {
            keywords.push(label);
            console.log(`  ✓ Found: ${label} (confidence: ${(prediction.probability * 100).toFixed(1)}%)`);
          }
        }
      });

      // 映射常见标签到商品关键词
      const keywordMap: Record<string, string> = {
        'dress': 'dress',
        'shirt': 'shirt',
        't-shirt': 't-shirt',
        'jeans': 'jeans',
        'pants': 'pants',
        'trousers': 'pants',
        'shoes': 'sneakers',
        'boots': 'boots',
        'handbag': 'handbag',
        'backpack': 'backpack',
        'watch': 'watch',
        'sunglasses': 'sunglasses',
        'jacket': 'jacket',
        'coat': 'coat',
        'sweater': 'sweater',
        'skirt': 'skirt',
        'shorts': 'shorts',
        'phone': 'smartphone',
        'mobile-phone': 'smartphone',
        'laptop': 'laptop',
        'headphones': 'headphones',
        'camera': 'camera',
        'bottle': 'water-bottle',
        'cup': 'cup',
        'chair': 'chair',
        'table': 'table',
        'sofa': 'sofa',
        'couch': 'sofa',
        'bed': 'bed',
        'lamp': 'lamp',
        'sneakers': 'sneakers',
        'running-shoes': 'sneakers',
        'sports-shoe': 'sneakers',
        'tennis-shoe': 'sneakers'
      };

      // 转换标签为商品关键词
      const mappedKeywords = keywords
        .map(label => keywordMap[label] || label)
        .filter(k => {
          const excludeWords = ['image', 'photo', 'picture', 'photograph', 'snapshot'];
          return k.length > 2 && !excludeWords.includes(k);
        })
        .slice(0, 4);

      console.log('🎯 Final mapped keywords:', mappedKeywords);
      return mappedKeywords;
    } catch (error) {
      console.error('❌ MobileNet recognition error:', error);
      return [];
    }
  }

  /**
   * 使用Hugging Face Inference API识别图片内容（已废弃，改用MobileNet）
   */
  private async recognizeWithHuggingFace(imageFile: File): Promise<string[]> {
    try {
      // 压缩图片以减少API调用大小（Hugging Face API对文件大小有限制）
      const compressedFile = await this.compressImageForAPI(imageFile);
      
      // 读取文件为base64
      const base64 = await this.fileToBase64(compressedFile);

      // 使用多个模型尝试，提高成功率
      const models = [
        'google/vit-base-patch16-224',
        'microsoft/resnet-50'
      ];

      const allKeywords: string[] = [];

      for (const model of models) {
        try {
          const response = await fetch(
            `https://api-inference.huggingface.co/models/${model}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                inputs: base64
              })
            }
          );

          if (response.ok) {
            const data = await response.json();
            console.log(`🤖 ${model} API response:`, data);
            
            // 处理返回结果
            let results = Array.isArray(data) ? data : [data];
            
            // 提取标签
            results.forEach((result: any) => {
              if (Array.isArray(result)) {
                result.forEach((item: any) => {
                  if (item.label && item.score > 0.1) {
                    const label = item.label.toLowerCase()
                      .replace(/[^a-z0-9\s-]/g, '')
                      .replace(/\s+/g, '-');
                    if (label.length > 2 && !allKeywords.includes(label)) {
                      allKeywords.push(label);
                    }
                  }
                });
              } else if (result.label && result.score > 0.1) {
                const label = result.label.toLowerCase()
                  .replace(/[^a-z0-9\s-]/g, '')
                  .replace(/\s+/g, '-');
                if (label.length > 2 && !allKeywords.includes(label)) {
                  allKeywords.push(label);
                }
              }
            });

            // 如果成功获取关键词，跳出循环
            if (allKeywords.length > 0) {
              break;
            }
          } else {
            const errorText = await response.text();
            console.warn(`Hugging Face ${model} API error:`, response.status, errorText);
          }
        } catch (error) {
          console.warn(`Hugging Face ${model} API error:`, error);
        }
      }

      // 映射常见标签到商品关键词
      const keywordMap: Record<string, string> = {
        'dress': 'dress',
        'shirt': 'shirt',
        't-shirt': 't-shirt',
        'jeans': 'jeans',
        'pants': 'pants',
        'trousers': 'pants',
        'shoes': 'sneakers',
        'boots': 'boots',
        'handbag': 'handbag',
        'backpack': 'backpack',
        'watch': 'watch',
        'sunglasses': 'sunglasses',
        'jacket': 'jacket',
        'coat': 'coat',
        'sweater': 'sweater',
        'skirt': 'skirt',
        'shorts': 'shorts',
        'phone': 'smartphone',
        'mobile-phone': 'smartphone',
        'laptop': 'laptop',
        'headphones': 'headphones',
        'camera': 'camera',
        'bottle': 'water-bottle',
        'cup': 'cup',
        'chair': 'chair',
        'table': 'table',
        'sofa': 'sofa',
        'couch': 'sofa',
        'bed': 'bed',
        'lamp': 'lamp',
        'sneakers': 'sneakers',
        'running-shoes': 'sneakers',
        'sports-shoe': 'sneakers',
        'tennis-shoe': 'sneakers',
        'clothing': 'clothing',
        'apparel': 'apparel',
        'garment': 'garment'
      };

      // 转换标签为商品关键词，去重并限制数量
      const mappedKeywords = allKeywords
        .map(label => keywordMap[label] || label)
        .filter(k => {
          const excludeWords = ['image', 'photo', 'picture', 'photograph', 'snapshot', 'clothing', 'apparel', 'garment'];
          return k.length > 2 && !excludeWords.includes(k);
        })
        .slice(0, 4);

      console.log('🎯 Mapped keywords:', mappedKeywords);
      return mappedKeywords;
    } catch (error) {
      console.error('Hugging Face recognition error:', error);
      return [];
    }
  }

  /**
   * 压缩图片用于API调用（减少文件大小）
   */
  private async compressImageForAPI(file: File): Promise<File> {
    // 如果文件小于500KB，直接返回
    if (file.size < 500 * 1024) {
      return file;
    }

    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = URL.createObjectURL(file);
      });

      const canvas = document.createElement('canvas');
      const maxSize = 512; // 最大尺寸
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;

      ctx.drawImage(img, 0, 0, width, height);

      return new Promise((resolve) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: 'image/jpeg' }));
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.8
        );
      });
    } catch (error) {
      console.warn('Image compression failed:', error);
      return file;
    }
  }

  /**
   * 使用OpenAI Vision API识别图片内容
   */
  private async recognizeWithOpenAI(imageFile: File): Promise<string[]> {
    if (!this.aiConfig.apiKey) return [];

    try {
      const base64 = await this.fileToBase64(imageFile);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.aiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analyze this product image and suggest SEO-friendly keywords in English. Return only 2-4 keywords separated by commas, focusing on product type, material, color, and style. Example: "cotton-dress-red-casual"'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${imageFile.type};base64,${base64}`
                  }
                }
              ]
            }
          ],
          max_tokens: 100
        })
      });

      if (!response.ok) {
        throw new Error('OpenAI API error');
      }

      const data = await response.json();
      const keywords = data.choices[0]?.message?.content?.trim() || '';
      return keywords.split(',').map(k => k.trim().toLowerCase().replace(/\s+/g, '-'));
    } catch (error) {
      console.error('OpenAI Vision API error:', error);
      return [];
    }
  }

  /**
   * 使用Google Vision API识别图片内容
   */
  private async recognizeWithGoogle(imageFile: File): Promise<string[]> {
    if (!this.aiConfig.apiKey) return [];

    try {
      const base64 = await this.fileToBase64(imageFile);
      
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${this.aiConfig.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [
              {
                image: {
                  content: base64
                },
                features: [
                  {
                    type: 'LABEL_DETECTION',
                    maxResults: 10
                  },
                  {
                    type: 'OBJECT_LOCALIZATION',
                    maxResults: 5
                  }
                ]
              }
            ]
          })
        }
      );

      if (!response.ok) {
        throw new Error('Google Vision API error');
      }

      const data = await response.json();
      const labels = data.responses[0]?.labelAnnotations || [];
      const objects = data.responses[0]?.localizedObjectAnnotations || [];
      
      const keywords: string[] = [];
      
      // 提取标签（按置信度排序）
      labels.forEach((label: any) => {
        if (label.score > 0.7) {
          keywords.push(label.description.toLowerCase().replace(/\s+/g, '-'));
        }
      });
      
      // 提取对象
      objects.forEach((obj: any) => {
        if (obj.score > 0.7) {
          keywords.push(obj.name.toLowerCase().replace(/\s+/g, '-'));
        }
      });

      return keywords.slice(0, 5);
    } catch (error) {
      console.error('Google Vision API error:', error);
      return [];
    }
  }

  /**
   * 将文件转换为Base64
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * 使用AI识别图片（本地MobileNet模型，完全免费，无CORS问题）
   */
  private async recognizeWithAI(imageFile: File): Promise<string[]> {
    console.log('🔍 Starting AI recognition for:', imageFile.name);
    
    // 使用本地MobileNet模型（完全免费，无CORS问题）
    try {
      const mobileNetKeywords = await this.recognizeWithMobileNet(imageFile);
      console.log('🤖 MobileNet keywords:', mobileNetKeywords);
      if (mobileNetKeywords.length > 0) {
        return mobileNetKeywords;
      }
    } catch (error) {
      console.warn('MobileNet recognition failed:', error);
    }

    // 如果配置了其他付费API，也尝试
    if (this.aiConfig.enabled && this.aiConfig.provider !== 'none') {
      try {
        switch (this.aiConfig.provider) {
          case 'openai':
            return await this.recognizeWithOpenAI(imageFile);
          case 'google':
            return await this.recognizeWithGoogle(imageFile);
          default:
            return [];
        }
      } catch (error) {
        console.error('AI recognition error:', error);
      }
    }

    console.log('⚠️ AI recognition returned no keywords');
    return [];
  }
  /**
   * 清理文件名，移除常见的前缀和后缀
   */
  private cleanFileName(fileName: string): string {
    let cleaned = fileName.toLowerCase();
    
    // 移除文件扩展名
    cleaned = cleaned.replace(/\.(jpg|jpeg|png|gif|webp|heic|heif)$/i, '');
    
    // 移除常见的前缀
    const prefixes = [
      'img_', 'image_', 'photo_', 'pic_', 'picture_', 'dsc_', 'dscn', 
      'dscf', 'dsc_', 'img', 'photo', 'pic', 'p', 'wp_', 'wp', 
      'snap', 'snapshot', 'capture', 'screenshot', 'screen',
      'wechat', 'wx_', 'qq_', 'alipay_', 'taobao_',
      'export_', 'export', 'output_', 'output',
      'untitled', 'new', 'copy', 'copy of', '副本', '新建',
      '2024', '2023', '2025', '2022', '2021', '2020', // 年份
      '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12' // 月份
    ];
    
    for (const prefix of prefixes) {
      if (cleaned.startsWith(prefix)) {
        cleaned = cleaned.substring(prefix.length).trim();
        // 移除可能的前导下划线或连字符
        cleaned = cleaned.replace(/^[-_\s]+/, '');
      }
    }
    
    // 移除常见的后缀模式
    cleaned = cleaned.replace(/[-_\s]*\d{4,}$/, ''); // 移除末尾的长数字
    cleaned = cleaned.replace(/[-_\s]*\([^)]*\)$/, ''); // 移除括号内容
    cleaned = cleaned.replace(/[-_\s]*\[[^\]]*\]$/, ''); // 移除方括号内容
    
    // 移除多余的空格、下划线和连字符
    cleaned = cleaned.replace(/[-_\s]+/g, ' ').trim();
    
    return cleaned;
  }

  /**
   * 从文件名推断可能的商品类型（增强版）
   */
  private analyzeFileName(fileName: string): string[] {
    const cleaned = this.cleanFileName(fileName);
    const keywords: string[] = [];
    
    // 如果清理后文件名太短或为空，尝试从原始文件名提取
    const name = cleaned.length > 2 ? cleaned : fileName.toLowerCase();

    // ========== 颜色识别（增强版）==========
    const colors: Record<string, string[]> = {
      'red': ['红', '红色', '赤', '朱红', '绯红', 'red', 'crimson', 'scarlet', 'burgundy', 'maroon'],
      'blue': ['蓝', '蓝色', '湛蓝', '天蓝', '宝蓝', 'navy', 'royal', 'sky', 'azure', 'cyan'],
      'green': ['绿', '绿色', '翠绿', '墨绿', '草绿', 'emerald', 'mint', 'lime', 'olive', 'forest'],
      'yellow': ['黄', '黄色', '金黄', '橙黄', '柠檬黄', 'golden', 'amber', 'lemon', 'mustard'],
      'black': ['黑', '黑色', '玄', '墨黑', '乌黑', 'ebony', 'charcoal', 'onyx'],
      'white': ['白', '白色', '纯白', '象牙白', '雪白', 'ivory', 'pearl', 'cream', 'off-white'],
      'gray': ['灰', '灰色', '炭灰', '银灰', '浅灰', 'grey', 'slate', 'ash', 'silver'],
      'pink': ['粉', '粉色', '桃红', '玫红', '粉红', 'rose', 'coral', 'salmon', 'blush'],
      'purple': ['紫', '紫色', '紫罗兰', '薰衣草', 'violet', 'lavender', 'plum', 'mauve'],
      'orange': ['橙', '橙色', '橘色', '橘红', 'tangerine', 'peach', 'apricot'],
      'brown': ['棕', '棕色', '褐色', '咖啡色', '卡其', 'tan', 'beige', 'khaki', 'camel', 'chocolate'],
      'beige': ['米色', '米白', '杏色', '卡其', 'nude', 'sand', 'taupe'],
      'gold': ['金', '金色', '黄金', '金属色', 'metallic'],
      'silver': ['银', '银色', '金属银', 'platinum'],
      'multicolor': ['彩', '多彩', '拼色', '渐变', '花色', 'colorful', 'rainbow', 'print', 'pattern']
    };

    // 颜色识别：使用更智能的匹配
    for (const [color, patterns] of Object.entries(colors)) {
      // 检查完整单词匹配和部分匹配
      const matched = patterns.some(p => {
        const regex = new RegExp(`\\b${p}\\w*|${p}`, 'i');
        return regex.test(name);
      });
      if (matched) {
        keywords.push(color);
        break; // 只取第一个匹配的颜色
      }
    }

    // ========== 材质识别（增强版）==========
    const materials: Record<string, string[]> = {
      'leather': ['皮', '皮革', '真皮', '牛皮', '羊皮', 'leather', 'genuine-leather', 'suede', 'nappa'],
      'canvas': ['帆布', 'canvas', 'duck-canvas'],
      'cotton': ['棉', '纯棉', '棉质', 'cotton', 'organic-cotton', 'pima-cotton'],
      'silk': ['丝', '丝绸', '真丝', '缎面', 'silk', 'satin', 'chiffon'],
      'wool': ['羊毛', '毛', '绒', 'wool', 'cashmere', 'merino', 'alpaca'],
      'denim': ['丹宁', '牛仔布', 'denim', 'jean'],
      'linen': ['亚麻', '麻', 'linen'],
      'velvet': ['天鹅绒', '绒布', 'velvet', 'velour'],
      'lace': ['蕾丝', '镂空', 'lace'],
      'knit': ['针织', '编织', 'knit', 'knitted', 'sweater'],
      'metal': ['金属', '合金', '不锈钢', 'metal', 'stainless-steel', 'aluminum', 'brass'],
      'wood': ['木', '木质', '实木', 'wood', 'wooden', 'bamboo', 'oak', 'walnut'],
      'ceramic': ['陶瓷', '瓷', 'ceramic', 'porcelain'],
      'glass': ['玻璃', '钢化玻璃', 'glass', 'crystal'],
      'plastic': ['塑料', '塑胶', 'plastic', 'pvc', 'acrylic'],
      'rubber': ['橡胶', 'rubber', 'silicone'],
      'carbon-fiber': ['碳纤维', 'carbon-fiber', 'carbon'],
      'fabric': ['布料', 'fabric', 'textile', 'cloth']
    };

    // 材质识别：使用单词边界匹配
    for (const [material, patterns] of Object.entries(materials)) {
      const matched = patterns.some(p => {
        const regex = new RegExp(`\\b${p}\\w*|${p}`, 'i');
        return regex.test(name);
      });
      if (matched) {
        keywords.push(material);
        break;
      }
    }

    // ========== 风格识别 ==========
    const styles: Record<string, string[]> = {
      'casual': ['休闲', '日常', '随性'],
      'formal': ['正式', '商务', '职场'],
      'vintage': ['复古', '怀旧', 'vintage'],
      'minimalist': ['简约', '极简', '简单'],
      'luxury': ['奢华', '豪华', '奢侈', '高端'],
      'cute': ['可爱', '萌', '甜美'],
      'elegant': ['优雅', '典雅', '优雅'],
      'sport': ['运动', '活力', '户外'],
      'classic': ['经典', '经典款'],
      'modern': ['现代', '潮流', '时尚'],
      'bohemian': ['波西米亚', '波西米亚风'],
      'preppy': ['学院', '学院风'],
      'street': ['街头', '街头风']
    };

    for (const [style, patterns] of Object.entries(styles)) {
      if (patterns.some(p => name.includes(p))) {
        keywords.push(style);
        break;
      }
    }

    // ========== 服装类（增强版）==========
    const clothing: Record<string, string[]> = {
      'dress': ['连衣裙', '裙装', '礼服裙', '晚礼服', '婚纱裙', 'tea-dress', 'maxi-dress', 'midi-dress', 'mini-dress', 'cocktail-dress', 'dress', 'gown'],
      'skirt': ['半身裙', '短裙', '长裙', 'a字裙', '百褶裙', '包臀裙', 'skirt', 'pencil-skirt', 'a-line-skirt', 'pleated-skirt'],
      'pants': ['裤子', '长裤', '休闲裤', '直筒裤', '阔腿裤', '小脚裤', 'pants', 'trousers', 'slacks', 'wide-leg-pants'],
      'jeans': ['牛仔裤', '牛仔裤', 'denim', '丹宁', 'jeans', 'jean', 'denim-pants'],
      'shorts': ['短裤', '热裤', 'shorts', 'bermuda-shorts', 'cargo-shorts'],
      't-shirt': ['t恤', 'tshirt', 't-shirt', '短袖', '体恤', 'tee', 'tank-top', 'sleeveless'],
      'shirt': ['衬衫', '长袖', 'top', '上衣', 'shirt', 'button-down', 'button-up', 'oxford-shirt'],
      'blouse': ['女衫', '女士衬衫', '雪纺衫', 'blouse', 'chiffon-blouse'],
      'sweater': ['毛衣', '针织衫', 'pullover', 'sweater', 'knit-sweater', 'cardigan-sweater'],
      'hoodie': ['卫衣', '连帽衫', '套头衫', 'hoodie', 'hooded-sweatshirt', 'sweatshirt'],
      'cardigan': ['开衫', '开襟衫', 'cardigan'],
      'jacket': ['夹克', '外套', '短外套', 'jacket', 'bomber-jacket', 'denim-jacket', 'leather-jacket'],
      'coat': ['大衣', '风衣', '毛呢大衣', '羊毛大衣', 'coat', 'trench-coat', 'wool-coat', 'overcoat'],
      'blazer': ['西装外套', '小西装', 'blazer', 'sport-coat'],
      'suit': ['西装', '套装', '正装', 'suit', 'business-suit', 'formal-suit'],
      'vest': ['背心', '马甲', 'vest', 'waistcoat'],
      'jumpsuit': ['连体裤', '连身衣', 'jumpsuit', 'romper', 'onesie'],
      'romper': ['连体短裤', 'romper'],
      'leggings': ['打底裤', 'leggings', 'yoga-pants'],
      'sweatpants': ['运动裤', 'sweatpants', 'joggers'],
      'pajamas': ['睡衣', 'pajamas', 'pjs', 'sleepwear']
    };

    // 服装类：优先匹配更具体的类型
    const clothingEntries = Object.entries(clothing).sort((a, b) => {
      // 优先匹配更长的关键词（更具体）
      const aMaxLen = Math.max(...a[1].map(p => p.length));
      const bMaxLen = Math.max(...b[1].map(p => p.length));
      return bMaxLen - aMaxLen;
    });
    
    for (const [item, patterns] of clothingEntries) {
      const matched = patterns.some(p => {
        const regex = new RegExp(`\\b${p.replace(/[-_]/g, '[-_]?')}\\w*|${p}`, 'i');
        return regex.test(name);
      });
      if (matched) {
        keywords.push(item);
        break;
      }
    }

    // ========== 鞋类 ==========
    const shoes: Record<string, string[]> = {
      'sneakers': ['运动鞋', '休闲鞋', '板鞋', 'sneaker', 'trainer'],
      'running-shoes': ['跑鞋', '跑步鞋', '慢跑鞋'],
      'boots': ['靴子', '靴', '长靴', '短靴', '马丁靴', '切尔西靴', 'snow-boots'],
      'ankle-boots': ['短靴', '踝靴'],
      'heels': ['高跟鞋', '高跟', 'stiletto', 'pumps'],
      'stilettos': ['细高跟', '细跟'],
      'flats': ['平底鞋', '平底', 'ballet'],
      'sandals': ['凉鞋', '凉鞋', 'sandals'],
      'slippers': ['拖鞋', '拖鞋'],
      'loafers': ['乐福鞋', '豆豆鞋', 'loafer'],
      'oxfords': ['牛津鞋'],
      'derby': ['德比鞋'],
      'canvas-shoes': ['帆布鞋']
    };

    for (const [item, patterns] of Object.entries(shoes)) {
      if (patterns.some(p => name.includes(p))) {
        keywords.push(item);
        break;
      }
    }

    // ========== 包袋类 ==========
    const bags: Record<string, string[]> = {
      'handbag': ['手提包', '拎包', 'handbag'],
      'shoulder-bag': ['单肩包', '肩包', '斜挎包'],
      'crossbody-bag': ['斜挎包', '跨包'],
      'backpack': ['双肩包', '背包', '书包'],
      'tote-bag': ['托特包', 'tote', '大容量包'],
      'clutch': ['手拿包', '晚宴包', 'clutch'],
      'wallet': ['钱包', '皮夹', '长款钱包', '短款钱包'],
      'purse': ['零钱包', '小包'],
      'belt-bag': ['腰包', '胸包'],
      'messenger-bag': ['邮差包', '信使包'],
      'backpack-purse': ['双肩包', '背包']
    };

    for (const [item, patterns] of Object.entries(bags)) {
      if (patterns.some(p => name.includes(p))) {
        keywords.push(item);
        break;
      }
    }

    // ========== 珠宝首饰类 ==========
    const jewelry: Record<string, string[]> = {
      'necklace': ['项链', '吊坠', 'pendant', 'chain'],
      'choker': ['颈链', 'choker'],
      'earrings': ['耳环', '耳钉', 'earring', 'stud'],
      'drop-earrings': ['耳坠', '长耳环'],
      'bracelet': ['手链', '手镯', 'bracelet'],
      'bangle': ['手镯', '硬手镯'],
      'ring': ['戒指', '指环', 'wedding-ring', 'engagement-ring'],
      'brooch': ['胸针', '胸花'],
      'watch': ['手表', '腕表', '智能手表'],
      'anklet': ['脚链']
    };

    for (const [item, patterns] of Object.entries(jewelry)) {
      if (patterns.some(p => name.includes(p))) {
        keywords.push(item);
        break;
      }
    }

    // ========== 配饰类 ==========
    const accessories: Record<string, string[]> = {
      'belt': ['腰带', '皮带', '皮带'],
      'scarf': ['围巾', '丝巾', '羊绒围巾'],
      'hat': ['帽子', '鸭舌帽', 'cap', '礼帽'],
      'beanie': ['针织帽', '冷帽', '毛线帽'],
      'gloves': ['手套', '皮手套', '针织手套'],
      'sunglasses': ['太阳镜', '墨镜', 'sunglasses'],
      'eyeglasses': ['眼镜', '光学镜', 'frame'],
      'tie': ['领带', 'necktie'],
      'bow-tie': ['领结'],
      'hair-accessory': ['发饰', '发夹', '发箍']
    };

    for (const [item, patterns] of Object.entries(accessories)) {
      if (patterns.some(p => name.includes(p))) {
        keywords.push(item);
        break;
      }
    }

    // ========== 电子产品 ==========
    const electronics: Record<string, string[]> = {
      'smartphone': ['智能手机', '手机', 'iphone', 'android'],
      'phone': ['手机', '移动电话'],
      'laptop': ['笔记本电脑', '笔记本', 'laptop', 'macbook'],
      'tablet': ['平板电脑', '平板', 'ipad', 'tablet'],
      'headphones': ['头戴式耳机', '耳机', 'headphones', 'over-ear'],
      'earbuds': ['入耳式耳机', '耳塞', 'earbuds', 'airpods'],
      'speaker': ['音箱', '扬声器', '音响', '蓝牙音箱'],
      'camera': ['相机', '摄像机', '单反', '微单', 'dslr'],
      'smartwatch': ['智能手表', '智能手环'],
      'keyboard': ['键盘', '机械键盘'],
      'mouse': ['鼠标', '无线鼠标'],
      'charger': ['充电器', '充电头'],
      'cable': ['数据线', '充电线', '连接线'],
      'case': ['手机壳', '保护壳', 'case', 'cover']
    };

    for (const [item, patterns] of Object.entries(electronics)) {
      if (patterns.some(p => name.includes(p))) {
        keywords.push(item);
        break;
      }
    }

    // ========== 家居电器 ==========
    const home: Record<string, string[]> = {
      'coffee-maker': ['咖啡机', '咖啡壶', 'espresso'],
      'coffee-grinder': ['磨豆机', '研磨机', '磨咖啡'],
      'kettle': ['电水壶', '烧水壶', '水壶'],
      'blender': ['搅拌机', '榨汁机', '破壁机'],
      'toaster': ['烤面包机', '多士炉'],
      'microwave': ['微波炉'],
      'air-fryer': ['空气炸锅', '炸锅'],
      'rice-cooker': ['电饭煲', '电饭锅'],
      'mixer': ['厨师机', '和面机'],
      'vacuum': ['吸尘器', '扫地机'],
      'lamp': ['台灯', '落地灯', '吊灯', '灯具'],
      'bulb': ['灯泡', '照明'],
      'fan': ['风扇', '电风扇', '台扇'],
      'heater': ['取暖器', '电暖器'],
      'humidifier': ['加湿器'],
      'dehumidifier': ['除湿机'],
      'purifier': ['净化器', '空气净化器']
    };

    // 家居电器：移除 break，允许识别多个相关产品
    for (const [item, patterns] of Object.entries(home)) {
      if (patterns.some(p => name.includes(p))) {
        keywords.push(item);
      }
    }

    // ========== 家具类 ==========
    const furniture: Record<string, string[]> = {
      'sofa': ['沙发', '真皮沙发', '布艺沙发', 'couch'],
      'chair': ['椅子', '餐椅', '办公椅', 'armchair', '休闲椅'],
      'table': ['桌子', '餐桌', '书桌', 'coffee-table', '茶几'],
      'desk': ['书桌', '办公桌', '写字台'],
      'bed': ['床', '双人床', '单人床', '床架'],
      'mattress': ['床垫', '弹簧床垫'],
      'cabinet': ['柜子', '储物柜', '电视柜', 'sideboard'],
      'shelf': ['架子', '书架', '置物架'],
      'wardrobe': ['衣柜', '衣橱'],
      'drawer': ['抽屉', '床头柜', 'bedside-table']
    };

    for (const [item, patterns] of Object.entries(furniture)) {
      if (patterns.some(p => name.includes(p))) {
        keywords.push(item);
        break;
      }
    }

    // ========== 厨房用品 ==========
    const kitchen: Record<string, string[]> = {
      'cookware': ['锅具', '炒锅', '汤锅', '平底锅'],
      'knife': ['刀具', '菜刀', 'chef-knife'],
      'cutting-board': ['砧板', '切菜板'],
      'dinnerware': ['餐具', '碗碟', '盘子', 'plate'],
      'flatware': ['刀叉', '勺子', 'cutlery'],
      'glassware': ['玻璃杯', '水杯', '酒杯'],
      'storage': ['收纳盒', '保鲜盒', '储物罐']
    };

    for (const [item, patterns] of Object.entries(kitchen)) {
      if (patterns.some(p => name.includes(p))) {
        keywords.push(item);
        break;
      }
    }

    // ========== 美妆护肤 ==========
    const beauty: Record<string, string[]> = {
      'foundation': ['粉底液', '粉底', '底妆'],
      'lipstick': ['口红', '唇膏', 'lipstick', 'liquid-lipstick'],
      'lip-gloss': ['唇釉', '唇蜜', 'lip-gloss'],
      'mascara': ['睫毛膏', 'mascara'],
      'eyeliner': ['眼线笔', '眼线'],
      'eyeshadow': ['眼影', 'palette'],
      'skincare': ['护肤', '护肤品', '护肤套装'],
      'serum': ['精华液', '精华', 'serum'],
      'moisturizer': ['面霜', '乳液', '保湿霜'],
      'cleanser': ['洁面', '洗面奶', '洁面乳'],
      'toner': ['爽肤水', '化妆水', '水'],
      'mask': ['面膜', 'face-mask'],
      'perfume': ['香水', 'fragrance', 'cologne'],
      'makeup-brush': ['化妆刷', '美妆蛋', '工具']
    };

    for (const [item, patterns] of Object.entries(beauty)) {
      if (patterns.some(p => name.includes(p))) {
        keywords.push(item);
        break;
      }
    }

    // ========== 运动户外 ==========
    const sports: Record<string, string[]> = {
      'yoga-mat': ['瑜伽垫', '健身垫'],
      'dumbbell': ['哑铃', '壶铃'],
      'resistance-band': ['弹力带', '拉力器'],
      'tent': ['帐篷', '露营帐篷'],
      'sleeping-bag': ['睡袋'],
      'backpack': ['登山包', '旅行包', 'hiking-backpack'],
      'water-bottle': ['水壶', '运动水壶']
    };

    for (const [item, patterns] of Object.entries(sports)) {
      if (patterns.some(p => name.includes(p))) {
        keywords.push(item);
        break;
      }
    }

    // ========== 母婴用品 ==========
    const baby: Record<string, string[]> = {
      'diaper': ['尿布', '纸尿裤', 'diaper'],
      'baby-clothes': ['童装', '婴儿装', 'baby-clothes'],
      'stroller': ['婴儿车', '推车'],
      'baby-carrier': ['婴儿背带', '腰凳'],
      'baby-bottle': ['奶瓶', '水杯'],
      'pacifier': ['奶嘴', '安抚奶嘴'],
      'toy': ['玩具', '益智玩具', 'plush-toy']
    };

    for (const [item, patterns] of Object.entries(baby)) {
      if (patterns.some(p => name.includes(p))) {
        keywords.push(item);
        break;
      }
    }

    // ========== 宠物用品 ==========
    const pet: Record<string, string[]> = {
      'pet-bed': ['宠物床', '猫窝', '狗窝'],
      'pet-food': ['宠物粮', '猫粮', '狗粮'],
      'pet-toy': ['宠物玩具', '猫玩具', '狗玩具'],
      'leash': ['牵引绳', '狗绳'],
      'collar': ['项圈', 'pet-collar'],
      'litter-box': ['猫砂盆']
    };

    for (const [item, patterns] of Object.entries(pet)) {
      if (patterns.some(p => name.includes(p))) {
        keywords.push(item);
        break;
      }
    }

    // ========== 场景识别 ==========
    const scenes: Record<string, string[]> = {
      'office': ['办公', '办公室', 'work'],
      'home': ['家居', '家用', 'home'],
      'outdoor': ['户外', '旅行', 'travel'],
      'party': ['派对', '晚宴', 'party'],
      'wedding': ['婚礼', '婚庆', 'wedding'],
      'casual': ['日常', '休闲', 'casual'],
      'business': ['商务', '正式', 'business']
    };

    for (const [scene, patterns] of Object.entries(scenes)) {
      if (patterns.some(p => name.includes(p))) {
        keywords.push(scene);
        break;
      }
    }

    // ========== 季节识别 ==========
    const seasons: Record<string, string[]> = {
      'spring': ['春', '春季', 'spring'],
      'summer': ['夏', '夏季', 'summer'],
      'autumn': ['秋', '秋季', 'autumn', 'fall'],
      'winter': ['冬', '冬季', 'winter'],
      'all-season': ['四季', '全年', 'all-season']
    };

    for (const [season, patterns] of Object.entries(seasons)) {
      if (patterns.some(p => name.includes(p))) {
        keywords.push(season);
        break;
      }
    }

    // ========== 尺寸/规格识别 ==========
    const sizes: Record<string, string[]> = {
      'mini': ['迷你', '小型', 'mini', '小号'],
      'small': ['小', 'sm', 's'],
      'medium': ['中', 'm', 'md'],
      'large': ['大', 'l', 'lg'],
      'xlarge': ['特大', 'xl', '加大'],
      'plus-size': ['加肥', '大码', 'plus'],
      'oversized': ['宽松', '大版型']
    };

    for (const [size, patterns] of Object.entries(sizes)) {
      if (patterns.some(p => name.includes(p))) {
        keywords.push(size);
        break;
      }
    }

    return keywords;
  }

  /**
   * 分析图片并提取建议关键词（增强版：结合文件名和AI识别）
   */
  async analyzeImage(file: File): Promise<ImageInfo> {
    // 1. 先尝试使用免费的AI识别图片内容
    let aiKeywords: string[] = [];
    try {
      aiKeywords = await this.recognizeWithAI(file);
    } catch (error) {
      console.warn('AI recognition failed:', error);
    }
    
    // 2. 从文件名提取关键词
    const fileNameKeywords = this.analyzeFileName(file.name);

    // 3. 合并关键词（优先使用AI识别的结果，文件名关键词作为补充）
    const allKeywords = [...aiKeywords, ...fileNameKeywords];
    
    // 去重并保留顺序
    const uniqueKeywords = Array.from(new Set(allKeywords));

    // 如果没有任何关键词，提供通用的商品类别建议
    if (uniqueKeywords.length === 0) {
      uniqueKeywords.push('product');
    }

    return {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      suggestedCategory: uniqueKeywords[0] || 'product',
      suggestedKeywords: uniqueKeywords
    };
  }

  /**
   * 提取图片关键词（增强版）
   */
  async extractKeywords(file: File): Promise<string> {
    const info = await this.analyzeImage(file);

    // 输出调试信息
    console.log('🔍 Image Analysis:', {
      file: info.fileName,
      category: info.suggestedCategory,
      allKeywords: info.suggestedKeywords
    });

    // 如果没有任何关键词，尝试从文件名提取基础信息
    if (info.suggestedKeywords.length === 0 || info.suggestedKeywords[0] === 'product') {
      const cleaned = this.cleanFileName(file.name);
      // 如果清理后的文件名还有内容，尝试提取
      if (cleaned.length > 2 && cleaned !== file.name.toLowerCase().replace(/\.[^.]+$/, '')) {
        // 移除数字和特殊字符，提取可能的单词
        const words = cleaned
          .replace(/[^a-z\u4e00-\u9fa5\s-]/g, ' ')
          .split(/[\s-]+/)
          .filter(w => w.length > 2 && !/^\d+$/.test(w))
          .slice(0, 3);
        
        if (words.length > 0) {
          return words.join('-');
        }
      }
    }

    // 智能组合关键词：
    // 1. 优先使用商品类型（category）
    // 2. 如果有颜色，添加颜色
    // 3. 如果有材质，添加材质
    // 4. 如果有风格，添加风格
    // 5. 最多组合 3-4 个关键词

    const category = info.suggestedKeywords[0] || 'product';
    const color = info.suggestedKeywords.find(k =>
      ['red', 'blue', 'green', 'yellow', 'black', 'white', 'gray', 'grey', 'pink',
       'purple', 'orange', 'brown', 'beige', 'gold', 'silver', 'multicolor'].includes(k)
    );
    const material = info.suggestedKeywords.find(k =>
      ['leather', 'canvas', 'cotton', 'silk', 'wool', 'denim', 'linen',
       'velvet', 'lace', 'knit', 'metal', 'wood', 'ceramic', 'glass', 
       'plastic', 'rubber', 'carbon-fiber', 'fabric'].includes(k)
    );
    const style = info.suggestedKeywords.find(k =>
      ['casual', 'formal', 'vintage', 'minimalist', 'luxury', 'cute',
       'elegant', 'sport', 'classic', 'modern', 'bohemian', 'preppy', 'street'].includes(k)
    );

    // 组合关键词（按优先级）
    const combinedKeywords: string[] = [];
    
    // 1. 商品类型（必须）
    if (category && category !== 'product') {
      combinedKeywords.push(category);
    }
    
    // 2. 颜色（高优先级）
    if (color) {
      combinedKeywords.push(color);
    }
    
    // 3. 材质（中优先级）
    if (material) {
      combinedKeywords.push(material);
    }
    
    // 4. 风格（低优先级）
    if (style && combinedKeywords.length < 3) {
      combinedKeywords.push(style);
    }

    // 5. 如果没有足够的描述性关键词，添加其他商品相关关键词
    if (combinedKeywords.length < 2 && info.suggestedKeywords.length > 1) {
      const additionalKeywords = info.suggestedKeywords.filter(k => 
        k !== category && k !== color && k !== material && k !== style &&
        !['product', 'all-season', 'mini', 'small', 'medium', 'large', 'xlarge'].includes(k)
      );
      if (additionalKeywords.length > 0) {
        combinedKeywords.push(additionalKeywords[0]);
      }
    }

    // 如果还是没有关键词，使用商品类型
    if (combinedKeywords.length === 0) {
      combinedKeywords.push(category);
    }

    // 用连字符连接，最多4个关键词
    const finalKeywords = combinedKeywords.slice(0, 4).join('-');

    console.log('✨ Final Keywords:', finalKeywords);

    return finalKeywords || 'product';
  }
}

// 导出单例
export const imageAnalyzer = new ImageAnalyzer();

// 保留旧的接口名称以兼容
export const imageClassifier = imageAnalyzer;

// 导出辅助函数
export async function extractKeywords(file: File): Promise<string> {
  return imageAnalyzer.extractKeywords(file);
}

export async function analyzeImage(file: File): Promise<ImageInfo> {
  return imageAnalyzer.analyzeImage(file);
}

// 导出AI配置函数
export function setAIConfig(config: AIConfig) {
  imageAnalyzer.setAIConfig(config);
}

export function getAIConfig(): AIConfig {
  // 从localStorage读取配置
  const saved = localStorage.getItem('aiConfig');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return { provider: 'none', enabled: false };
    }
  }
  return { provider: 'none', enabled: false };
}

export type { AIConfig };
