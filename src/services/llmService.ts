import axios from 'axios';

export interface LLMResponse {
  text: string;
  expression?: string;
  motion?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// LLM API 配置
const LLM_CONFIG = {
  provider: 'groq' as 'groq' | 'huggingface',
  apiKey: import.meta.env.VITE_GROQ_API_KEY || import.meta.env.VITE_LLM_API_KEY || '',
  model: 'llama-3.1-8b-instant', // Groq 模型
  baseURL: 'https://api.groq.com/openai/v1',
};

/**
 * 解析 LLM 返回的 JSON 响应
 */
function parseLLMResponse(response: string): LLMResponse {
  try {
    // 如果使用 response_format: { type: 'json_object' }，响应应该是纯 JSON
    // 但有时可能包含 markdown 代码块，需要处理
    
    let jsonStr = response.trim();
    
    // 尝试提取 JSON（可能包含 markdown 代码块）
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                     response.match(/```\s*([\s\S]*?)\s*```/);
    
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      // 尝试直接查找 JSON 对象
      const jsonObjectMatch = response.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        jsonStr = jsonObjectMatch[0];
      }
    }
    
    // 解析 JSON
    const parsed = JSON.parse(jsonStr);
    
    return {
      text: parsed.text || response,
      expression: parsed.expression,
      motion: parsed.motion,
    };
  } catch (error) {
    console.warn('解析 LLM 响应失败，使用原始文本:', error, '原始响应:', response);
    // 如果解析失败，返回原始文本
    return {
      text: response.trim(),
    };
  }
}

/**
 * 构建系统提示词
 * @param availableExpressions 当前模型可用的表情列表
 * @param availableMotions 当前模型可用的动作列表
 */
function buildSystemPrompt(availableExpressions: string[] = [], availableMotions: string[] = []): string {
  const expressionsList = availableExpressions.length > 0 
    ? availableExpressions.join(', ')
    : 'happy, sad, surprised, angry, shy, curious, blush, pout';
  
  const motionsList = availableMotions.length > 0
    ? availableMotions.join(', ')
    : 'idle, excited, shy, curious, happy, menacing';

  return `你是一个友好的 AI 助手，与用户进行对话。每次回复时，必须返回有效的 JSON 格式，包含以下字段：
{
  "text": "你的回复文本",
  "expression": "表情名称（从可用表情中选择）",
  "motion": "动作名称（从可用动作中选择）"
}

根据对话内容选择合适的表情和动作。

当前模型可用的表情选项：${expressionsList}
当前模型可用的动作选项：${motionsList}

重要提示：
- 只能使用上述列表中提供的表情和动作名称
- 如果对话内容不需要特定表情或动作，可以将对应字段设为 null 或省略
- 只返回 JSON 对象，不要包含任何其他文本或 markdown 代码块
- 表情和动作应该与回复内容的情感相匹配`;
}

/**
 * 发送消息到 LLM 并获取回复
 * @param message 用户消息
 * @param history 对话历史
 * @param availableExpressions 当前模型可用的表情列表
 * @param availableMotions 当前模型可用的动作列表
 */
export async function chat(
  message: string,
  history: ChatMessage[] = [],
  availableExpressions: string[] = [],
  availableMotions: string[] = []
): Promise<LLMResponse> {
  if (!LLM_CONFIG.apiKey) {
    throw new Error('Groq API Key 未配置，请在 .env 文件中设置 VITE_GROQ_API_KEY');
  }

  try {
    const messages: any[] = [
      {
        role: 'system',
        content: buildSystemPrompt(availableExpressions, availableMotions),
      },
      ...history.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user',
        content: message,
      },
    ];

    console.log('发送消息到 LLM...');

    const response = await axios.post(
      `${LLM_CONFIG.baseURL}/chat/completions`,
      {
        model: LLM_CONFIG.model,
        messages,
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: 'json_object' }, // 强制返回 JSON（Groq 支持）
      },
      {
        headers: {
          'Authorization': `Bearer ${LLM_CONFIG.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 秒超时
      }
    );

    const content = response.data.choices[0]?.message?.content || '';
    console.log('LLM 原始回复:', content);

    const parsed = parseLLMResponse(content);
    console.log('解析后的回复:', parsed);

    return parsed;
  } catch (error: any) {
    console.error('LLM API 调用失败:', error);
    
    if (error.response) {
      throw new Error(`LLM API 错误: ${error.response.status} - ${error.response.data?.error?.message || 'Unknown error'}`);
    } else if (error.request) {
      throw new Error('无法连接到 LLM API，请检查网络连接');
    } else {
      throw new Error(`LLM 请求失败: ${error.message}`);
    }
  }
}

/**
 * 使用 Hugging Face Inference API（备选方案）
 * @param message 用户消息
 * @param history 对话历史
 * @param availableExpressions 当前模型可用的表情列表
 * @param availableMotions 当前模型可用的动作列表
 */
export async function chatWithHuggingFace(
  message: string,
  history: ChatMessage[] = [],
  availableExpressions: string[] = [],
  availableMotions: string[] = []
): Promise<LLMResponse> {
  const apiKey = import.meta.env.VITE_HUGGINGFACE_API_KEY || '';
  const model = import.meta.env.VITE_HUGGINGFACE_MODEL || 'meta-llama/Meta-Llama-3-8B-Instruct';

  if (!apiKey) {
    throw new Error('Hugging Face API Key 未配置');
  }

  try {
    const prompt = buildSystemPrompt(availableExpressions, availableMotions) + '\n\n对话历史:\n' +
      history.map(msg => `${msg.role}: ${msg.content}`).join('\n') +
      `\n\n用户: ${message}\n助手:`;

    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.7,
          return_full_text: false,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000, // 60 秒超时（Hugging Face 可能较慢）
      }
    );

    const content = Array.isArray(response.data) 
      ? response.data[0]?.generated_text || ''
      : response.data.generated_text || '';

    return parseLLMResponse(content);
  } catch (error: any) {
    console.error('Hugging Face API 调用失败:', error);
    throw error;
  }
}

