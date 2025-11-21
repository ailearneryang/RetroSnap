import { CaptionCategory } from "../types";

// --- Local Caption Library (2025 Retro Collection) ---
const CAPTION_LIBRARY: Record<CaptionCategory, string[]> = {
  PORTRAIT: [
    "胶片里的碎碎念", "复古氛围感拉满", "定格温柔瞬间", "笑脸收藏家", "镜头下的美好",
    "今日份甜度", "捕捉一只小可爱", "眼里有光", "主角光环", "温柔了岁月",
    "私藏的快乐", "不被定义的我", "像风一样自由", "复古女孩", "盐系少年"
  ],
  SCENERY: [
    "风与光的邂逅", "山河皆入画", "落日贩卖机", "街角慢镜头", "自然的诗篇",
    "去有风的地方", "治愈系风景", "天空的来信", "云朵的梦", "城市漫游记",
    "绿色的呼吸", "阳光的味道", "远方不远", "在此刻停留", "收集地图"
  ],
  FOOD: [
    "舌尖复古记", "烟火气限定", "美食拍立得", "碳水治愈局", "一口复古味",
    "好胃口", "今日份投喂", "吃货的修养", "热气腾腾", "味蕾旅行",
    "快乐水", "甜品治愈一切", "深夜食堂", "早安晨之美", "味觉记忆"
  ],
  LIFE: [
    "旧时光里的日常", "慢生活碎片", "岁月温柔以待", "日常小浪漫", "复古生活志",
    "平凡的一天", "生活需要仪式感", "简单的快乐", "宅家日记", "周末愉快",
    "好心情营业", "生活碎片", "记录此刻", "温暖的小事", "时光慢递"
  ],
  CREATIVE: [
    "脑洞拍立得", "色彩狂欢记", "萌物定格术", "静物复古感", "个性胶片秀",
    "奇奇怪怪", "可可爱爱", "灵感碎片", "造梦空间", "独特视角",
    "不一样的烟火", "打破常规", "艺术细胞", "色彩收集", "光影游戏"
  ],
  GENERAL: [
    "Retro 瞬间", "胶片不打烊", "时光定格机", "复古小美好", "咔嚓！旧时光",
    "美好的一天", "时光印记", "留住此刻", "记忆存档", "未完待续",
    "独家记忆", "想去见你", "很高兴遇见你", "保持热爱", "奔赴山海"
  ]
};

// Helper: Convert RGB to HSV
// h: 0-1, s: 0-1, v: 0-1
function rgbToHsv(r: number, g: number, b: number) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max === min) {
        h = 0;
    } else {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h, s, v];
}

/**
 * Analyze image statistics to guess category using HSV color space.
 * PRIORITIZE 'GENERAL' unless strong signals are found.
 */
const detectCategory = async (imageSrc: string): Promise<CaptionCategory> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve('GENERAL');
        return;
      }

      // Analyze center area (subjects are usually centered)
      canvas.width = 100;
      canvas.height = 100;
      ctx.drawImage(img, img.width * 0.2, img.height * 0.2, img.width * 0.6, img.height * 0.6, 0, 0, 100, 100);
      
      const imageData = ctx.getImageData(0, 0, 100, 100);
      const data = imageData.data;
      
      let rTotal = 0, gTotal = 0, bTotal = 0;
      
      for (let i = 0; i < data.length; i += 4) {
        rTotal += data[i];
        gTotal += data[i + 1];
        bTotal += data[i + 2];
      }
      
      const pixelCount = data.length / 4;
      const avgR = rTotal / pixelCount;
      const avgG = gTotal / pixelCount;
      const avgB = bTotal / pixelCount;

      const [h, s, v] = rgbToHsv(avgR, avgG, avgB);

      // --- Stricter Heuristics to favor GENERAL ---
      
      // 1. SCENERY: Very distinct Blue/Green sky/grass
      // Saturation must be moderate+, Brightness high
      if ((h > 0.25 && h < 0.7 && s > 0.25 && v > 0.4)) {
          resolve('SCENERY');
          return;
      }

      // 2. FOOD: High Saturation Warm Colors (Red/Orange/Yellow)
      // S > 0.45 is quite vibrant
      if ((h < 0.15 || h > 0.9) && s > 0.55 && v > 0.3) {
          resolve('FOOD');
          return;
      }
      
      // 3. PORTRAIT: Warm colors, moderate saturation (Skin tones)
      // Only if specifically within skin tone range
      if ((h < 0.12 || h > 0.95) && s > 0.15 && s < 0.5 && v > 0.35) {
          // resolve('PORTRAIT'); 
          // Let's make Portrait less aggressive too, often GENERAL fits people well.
          // Only return portrait if we are fairly sure, otherwise General covers it.
          if (Math.random() > 0.5) resolve('PORTRAIT');
          else resolve('GENERAL');
          return;
      }

      // Default to GENERAL for most cases
      resolve('GENERAL');
    };
    
    img.onerror = () => resolve('GENERAL');
    img.src = imageSrc;
  });
};

export const generateCaption = async (imageSrc: string): Promise<{text: string, category: CaptionCategory}> => {
  try {
    const category = await detectCategory(imageSrc);
    const options = CAPTION_LIBRARY[category];
    const text = options[Math.floor(Math.random() * options.length)];
    return { text, category };
  } catch (error) {
    return { text: "美好的一天", category: 'GENERAL' };
  }
};

export const getCaptionForCategory = (category: CaptionCategory): string => {
   const options = CAPTION_LIBRARY[category];
   return options[Math.floor(Math.random() * options.length)];
}