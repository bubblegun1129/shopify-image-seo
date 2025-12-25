// 测试关键词提取逻辑

const testFileName = "#01 咖啡机研磨机_正面白底图.png";

function testKeywordExtraction(fileName) {
  const name = fileName.toLowerCase();
  const keywords = [];

  // 家居电器
  const home = {
    'coffee-maker': ['咖啡机', '咖啡壶', 'espresso'],
    'coffee-grinder': ['磨豆机', '研磨机', '磨咖啡']
  };

  for (const [item, patterns] of Object.entries(home)) {
    if (patterns.some(p => name.includes(p))) {
      keywords.push(item);
    }
  }

  return keywords;
}

const result = testKeywordExtraction(testFileName);
console.log("测试文件名:", testFileName);
console.log("识别结果:", result);
