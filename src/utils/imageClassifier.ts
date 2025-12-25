// 智能图片关键词分析器
// 从文件名智能提取商品关键词

// 定义类型
export interface ImageInfo {
  fileName: string;
  fileType: string;
  fileSize: number;
  suggestedCategory: string;
  suggestedKeywords: string[];
}

/**
 * 智能图片分析器 - 使用文件名和类型推断关键词
 */
class ImageAnalyzer {
  /**
   * 从文件名推断可能的商品类型
   */
  private analyzeFileName(fileName: string): string[] {
    const name = fileName.toLowerCase();
    const keywords: string[] = [];

    // ========== 颜色识别 ==========
    const colors: Record<string, string[]> = {
      'red': ['红', '红色', '赤', '朱红', '绯红'],
      'blue': ['蓝', '蓝色', '湛蓝', '天蓝', '宝蓝'],
      'green': ['绿', '绿色', '翠绿', '墨绿', '草绿'],
      'yellow': ['黄', '黄色', '金黄', '橙黄', '柠檬黄'],
      'black': ['黑', '黑色', '玄', '墨黑', '乌黑'],
      'white': ['白', '白色', '纯白', '象牙白', '雪白'],
      'gray': ['灰', '灰色', '炭灰', '银灰', '浅灰'],
      'pink': ['粉', '粉色', '桃红', '玫红', '粉红'],
      'purple': ['紫', '紫色', '紫罗兰', '薰衣草'],
      'orange': ['橙', '橙色', '橘色', '橘红'],
      'brown': ['棕', '棕色', '褐色', '咖啡色', '卡其'],
      'beige': ['米色', '米白', '杏色', '卡其'],
      'gold': ['金', '金色', '黄金', '金属色'],
      'silver': ['银', '银色', '金属银'],
      'multicolor': ['彩', '多彩', '拼色', '渐变', '花色']
    };

    for (const [color, patterns] of Object.entries(colors)) {
      if (patterns.some(p => name.includes(p))) {
        keywords.push(color);
        break; // 只取第一个匹配的颜色
      }
    }

    // ========== 材质识别 ==========
    const materials: Record<string, string[]> = {
      'leather': ['皮', '皮革', '真皮', '牛皮', '羊皮'],
      'canvas': ['帆布', 'canvas'],
      'cotton': ['棉', '纯棉', '棉质'],
      'silk': ['丝', '丝绸', '真丝', '缎面'],
      'wool': ['羊毛', '毛', '绒'],
      'denim': ['丹宁', '牛仔布'],
      'linen': ['亚麻', '麻'],
      'velvet': ['天鹅绒', '绒布', 'velvet'],
      'lace': ['蕾丝', '镂空'],
      'knit': ['针织', '编织'],
      'metal': ['金属', '合金', '不锈钢'],
      'wood': ['木', '木质', '实木'],
      'ceramic': ['陶瓷', '瓷'],
      'glass': ['玻璃', '钢化玻璃'],
      'plastic': ['塑料', '塑胶']
    };

    for (const [material, patterns] of Object.entries(materials)) {
      if (patterns.some(p => name.includes(p))) {
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

    // ========== 服装类 ==========
    const clothing: Record<string, string[]> = {
      'dress': ['连衣裙', '裙装', '礼服裙', '晚礼服', '婚纱裙', 'tea-dress', 'maxi-dress'],
      'skirt': ['半身裙', '短裙', '长裙', 'a字裙', '百褶裙', '包臀裙'],
      'pants': ['裤子', '长裤', '休闲裤', '直筒裤', '阔腿裤', '小脚裤'],
      'jeans': ['牛仔裤', '牛仔裤', 'denim', '丹宁'],
      'shorts': ['短裤', '热裤'],
      't-shirt': ['t恤', 'tshirt', 't-shirt', '短袖', '体恤'],
      'shirt': ['衬衫', '长袖', 'top', '上衣'],
      'blouse': ['女衫', '女士衬衫', '雪纺衫'],
      'sweater': ['毛衣', '针织衫', 'pullover'],
      'hoodie': ['卫衣', '连帽衫', '套头衫'],
      'cardigan': ['开衫', '开襟衫'],
      'jacket': ['夹克', '外套', '短外套'],
      'coat': ['大衣', '风衣', '毛呢大衣', '羊毛大衣'],
      'blazer': ['西装外套', '小西装'],
      'suit': ['西装', '套装', '正装'],
      'vest': ['背心', '马甲'],
      'jumpsuit': ['连体裤', '连身衣'],
      'romper': ['连体短裤']
    };

    for (const [item, patterns] of Object.entries(clothing)) {
      if (patterns.some(p => name.includes(p))) {
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
   * 分析图片并提取建议关键词
   */
  async analyzeImage(file: File): Promise<ImageInfo> {
    const keywords = this.analyzeFileName(file.name);

    // 如果从文件名没有提取到关键词，提供通用的商品类别建议
    if (keywords.length === 0) {
      keywords.push('product');
    }

    return {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      suggestedCategory: keywords[0] || 'product',
      suggestedKeywords: keywords
    };
  }

  /**
   * 提取图片关键词（简化版）
   */
  async extractKeywords(file: File): Promise<string> {
    const info = await this.analyzeImage(file);

    // 输出调试信息
    console.log('🔍 Image Analysis:', {
      file: info.fileName,
      category: info.suggestedCategory,
      allKeywords: info.suggestedKeywords
    });

    // 智能组合关键词：
    // 1. 优先使用商品类型（category）
    // 2. 如果有颜色，添加颜色
    // 3. 如果有材质，添加材质
    // 4. 如果有风格，添加风格
    // 5. 最多组合 3-4 个关键词

    const category = info.suggestedKeywords[0] || 'product';
    const color = info.suggestedKeywords.find(k =>
      ['red', 'blue', 'green', 'yellow', 'black', 'white', 'gray', 'pink',
       'purple', 'orange', 'brown', 'beige', 'gold', 'silver'].includes(k)
    );
    const material = info.suggestedKeywords.find(k =>
      ['leather', 'canvas', 'cotton', 'silk', 'wool', 'denim', 'linen',
       'velvet', 'lace', 'knit', 'metal', 'wood'].includes(k)
    );
    const style = info.suggestedKeywords.find(k =>
      ['casual', 'formal', 'vintage', 'minimalist', 'luxury', 'cute',
       'elegant', 'sport', 'classic', 'modern'].includes(k)
    );

    // 组合关键词（按优先级）
    const combinedKeywords = [category];
    if (color) combinedKeywords.push(color);
    if (material) combinedKeywords.push(material);
    if (style) combinedKeywords.push(style);

    // 如果没有颜色、材质、风格，但还有其他商品相关关键词（如第二个商品类型）
    if (!color && !material && !style && info.suggestedKeywords.length > 1) {
      // 添加第二个商品类型（如 coffee-maker + coffee-grinder）
      const secondCategory = info.suggestedKeywords.find(k => k !== category);
      if (secondCategory) {
        combinedKeywords.push(secondCategory);
      }
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
