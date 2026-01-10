// @ts-ignore - @sujoyu/pixi-live2d-display 类型定义可能不完整
import { Live2DModel } from '@sujoyu/pixi-live2d-display/cubism4';

/**
 * 模型特定的表情映射
 */
const MODEL_EXPRESSION_MAPS: Record<string, Record<string, string>> = {
  komi: {
    happy: 'blush_exp',
    sad: 'pout_exp',
    surprised: 'eye_size', // 注意：实际文件名是 eye_size.exp3.json，不是 eye_size_exp.exp3.json
    angry: 'pout_exp',
    shy: 'blush_exp',
    curious: 'eye_size',
    blush: 'blush_exp',
    pout: 'pout_exp',
  },
  akari: {
    happy: 'EyesLove',
    sad: 'EyesCry',
    surprised: 'SignShock',
    angry: 'SignAngry',
    shy: 'EyesLove',
    curious: 'SignShock',
    love: 'EyesLove',
    cry: 'EyesCry',
    shock: 'SignShock',
  },
};

/**
 * 模型特定的动作映射
 */
const MODEL_MOTION_MAPS: Record<string, Record<string, string>> = {
  komi: {
    idle: 'Idle',
    excited: 'Excited',
    shy: 'Shy',
    curious: 'Curious',
    happy: 'Happy',
    menacing: 'Menacing',
  },
  akari: {
    idle: 'Idle_2',
    love: 'Love',
    shock: 'Shock',
    happy: 'Love',
    surprised: 'Shock',
  },
};

// 当前模型 ID（从外部设置）
let currentModelId: string = 'komi';

/**
 * 设置当前模型 ID
 */
export function setCurrentModel(modelId: string) {
  currentModelId = modelId;
}

/**
 * 获取当前模型的表情映射
 */
function getExpressionMap(): Record<string, string> {
  return MODEL_EXPRESSION_MAPS[currentModelId] || MODEL_EXPRESSION_MAPS.komi;
}

/**
 * 获取当前模型的动作映射
 */
function getMotionMap(): Record<string, string> {
  return MODEL_MOTION_MAPS[currentModelId] || MODEL_MOTION_MAPS.komi;
}


/**
 * 获取可用的表情列表
 */
export function getAvailableExpressions(): string[] {
  return Object.keys(getExpressionMap());
}

/**
 * 获取可用的动作列表
 */
export function getAvailableMotions(): string[] {
  return Object.keys(getMotionMap());
}

/**
 * 从模型实例中获取实际的表情列表（从 model3.json）
 */
export function getActualExpressions(model: Live2DModel | null): Array<{ name: string; display: string }> {
  if (!model) return [];
  
  try {
    const internalModel = (model as any).internalModel;
    if (internalModel?.motionManager?.settings) {
      const settingsJson = (internalModel.motionManager.settings as any).json;
      const expressions = settingsJson?.FileReferences?.Expressions;
      if (expressions && Array.isArray(expressions)) {
        return expressions.map((exp: any) => {
          const fileName = exp.File.split('/').pop().replace('.exp3.json', '');
          return {
            name: exp.Name || fileName, // 使用 model3.json 中的 Name
            display: `${exp.Name || fileName} (${fileName})`
          };
        });
      }
    }
  } catch (error) {
    console.error('获取表情列表失败:', error);
  }
  
  return [];
}

/**
 * 从模型实例中获取实际的动作列表（从 model3.json）
 */
export function getActualMotions(model: Live2DModel | null): Array<{ name: string; display: string }> {
  if (!model) return [];
  
  try {
    const internalModel = (model as any).internalModel;
    if (internalModel?.motionManager?.settings) {
      const settingsJson = (internalModel.motionManager.settings as any).json;
      const motions = settingsJson?.FileReferences?.Motions;
      if (motions && typeof motions === 'object') {
        return Object.keys(motions).map((motionName) => {
          const motionFiles = motions[motionName];
          const fileName = Array.isArray(motionFiles) && motionFiles[0]?.File
            ? motionFiles[0].File.split('/').pop().replace('.motion3.json', '')
            : motionName;
          return {
            name: motionName, // 使用动作组名称（如 "Idle", "Happy"）
            display: `${motionName} (${fileName})`
          };
        });
      }
    }
  } catch (error) {
    console.error('获取动作列表失败:', error);
  }
  
  return [];
}

/**
 * 设置 Live2D 表情
 * @param model Live2D 模型实例
 * @param expressionName 表情名称（可以是映射名称如 'happy'，实际文件名如 'blush_exp'，或 model3.json 中的 Name 如 'blush'）
 */
export function setExpression(
  model: Live2DModel,
  expressionName: string
): void {
  try {
    const internalModel = (model as any).internalModel;
    if (!internalModel?.motionManager?.settings) {
      console.warn('无法获取模型设置');
      return;
    }

    const settingsJson = (internalModel.motionManager.settings as any).json;
    const expressions = settingsJson?.FileReferences?.Expressions;
    if (!expressions || !Array.isArray(expressions)) {
      console.warn('模型没有定义表情');
      return;
    }

    // 首先检查 expressionName 是否直接是 model3.json 中的 Name
    const directMatch = expressions.find((exp: any) => exp.Name === expressionName);
    if (directMatch) {
      // 直接使用 model3.json 中的 Name
      if (typeof (model as any).expression === 'function') {
        try {
          (model as any).expression(expressionName);
          return;
        } catch (e) {
          console.warn('使用 expression 方法失败，尝试底层 API:', e);
        }
      }
      // 尝试使用底层 API
      if (internalModel?.motionManager?.expressionManager) {
        try {
          internalModel.motionManager.expressionManager.setExpression(expressionName);
          return;
        } catch (e2) {
          console.error('设置表情失败:', e2);
        }
      }
    }

    // 如果不是直接的 Name，尝试通过文件名查找
    const expressionMap = getExpressionMap();
    let expressionFile: string;
    
    if (expressionName.includes('.exp3.json')) {
      expressionFile = expressionName.replace('.exp3.json', '');
    } else if (expressionName.includes('_exp') || expressionName.match(/^[A-Z]/) || expressionMap[expressionName.toLowerCase()]) {
      expressionFile = expressionMap[expressionName.toLowerCase()] || expressionName;
    } else {
      expressionFile = expressionMap[expressionName.toLowerCase()] || expressionName;
    }

    // 从 model3.json 中查找匹配的表达式
    const matchedExpression = expressions.find((exp: any) => {
      const fileName = exp.File.split('/').pop().replace('.exp3.json', '');
      return fileName === expressionFile || fileName.toLowerCase() === expressionFile.toLowerCase();
    });
    
    if (!matchedExpression) {
      console.warn(`未找到匹配的表情: ${expressionName} (文件: ${expressionFile})`);
      return;
    }

    const nameToUse = matchedExpression.Name;
    
    if (typeof (model as any).expression === 'function') {
      try {
        (model as any).expression(nameToUse);
        return;
      } catch (e) {
        console.warn('使用 expression 方法失败，尝试底层 API:', e);
      }
    }
    
    // 尝试使用底层 API
    if (internalModel?.motionManager?.expressionManager) {
      try {
        internalModel.motionManager.expressionManager.setExpression(nameToUse);
        return;
      } catch (e2) {
        console.error('设置表情失败:', e2);
      }
    }
  } catch (error) {
    console.error('设置表情失败:', error);
  }
}

/**
 * 播放 Live2D 动作
 * @param model Live2D 模型实例
 * @param motionName 动作名称（可以是映射名称如 'idle'，或实际文件名如 'Idle'）
 * @param priority 优先级（默认 2）
 */
export async function playMotion(
  model: Live2DModel,
  motionName: string,
  priority: number = 2
): Promise<void> {
  try {
    const motionMap = getMotionMap();
    
    // 获取动作文件名
    let motionFile: string;
    if (motionName.includes('.motion3.json')) {
      motionFile = motionName.replace('.motion3.json', '');
    } else if (motionName[0] === motionName[0].toUpperCase() && !motionMap[motionName.toLowerCase()]) {
      motionFile = motionName;
    } else {
      motionFile = motionMap[motionName.toLowerCase()];
      if (!motionFile) {
        console.warn(`未知的动作名称: ${motionName}`);
        return;
      }
    }

    if (typeof model.motion !== 'function') {
      console.warn('模型不支持 motion 方法');
      return;
    }

    const tryPlayMotion = async (group: string, index: number | undefined = undefined): Promise<boolean> => {
      try {
        const result = model.motion(group, index, priority);
        return result instanceof Promise ? await result : (result as boolean);
      } catch (e) {
        return false;
      }
    };
    
    const internalModel = (model as any).internalModel;
    
    // 尝试1: 检查 groups 映射
    if (internalModel?.motionManager?.groups) {
      const groups = internalModel.motionManager.groups;
      const matchingKey = Object.keys(groups).find(key => groups[key] === motionFile);
      if (matchingKey && await tryPlayMotion(matchingKey, undefined)) {
        return;
      }
      if (Object.keys(groups).includes(motionFile.toLowerCase()) && await tryPlayMotion(motionFile.toLowerCase(), undefined)) {
        return;
      }
    }
    
    // 尝试2: 直接使用文件名（推荐方式）
    if (await tryPlayMotion(motionFile, undefined)) {
      return;
    }
    
    // 尝试3: 使用小写文件名
    if (await tryPlayMotion(motionFile.toLowerCase(), undefined)) {
      return;
    }
    
    // 尝试4: 使用底层 API
    if (internalModel?.motionManager?.startMotion) {
      try {
        internalModel.motionManager.startMotion(motionFile, 0);
        return;
      } catch (e) {
        // 忽略错误，继续尝试
      }
    }
    
    console.warn(`无法播放动作: ${motionName} (${motionFile})`);
  } catch (error) {
    console.error('播放动作失败:', error);
  }
}

/**
 * 根据 LLM 返回的表情和动作指令，同时设置表情和播放动作
 */
export async function applyExpressionAndMotion(
  model: Live2DModel,
  expression?: string,
  motion?: string
): Promise<void> {
  if (expression) {
    setExpression(model, expression);
  }
  
  if (motion) {
    await playMotion(model, motion);
  }
}

