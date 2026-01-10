let currentUtterance: SpeechSynthesisUtterance | null = null;
let isSpeaking = false;

/**
 * 获取可用的语音列表
 */
export function getVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis.getVoices();
}

/**
 * 查找支持中文的语音
 */
export function findChineseVoice(): SpeechSynthesisVoice | null {
  const voices = getVoices();
  
  // 优先查找中文语音
  const chineseVoices = voices.filter(voice => 
    voice.lang.startsWith('zh') || 
    voice.lang.includes('Chinese') ||
    voice.name.includes('Chinese')
  );

  if (chineseVoices.length > 0) {
    // 优先选择中文（普通话）
    const mandarin = chineseVoices.find(v => v.lang.includes('zh-CN') || v.lang.includes('cmn'));
    return mandarin || chineseVoices[0];
  }

  // 如果没有中文语音，返回默认语音
  const defaultVoice = voices.find(v => v.default) || voices[0];
  return defaultVoice || null;
}

/**
 * 等待语音列表加载完成
 */
function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    // 如果语音列表为空，等待加载
    window.speechSynthesis.onvoiceschanged = () => {
      resolve(getVoices());
    };

    // 超时保护
    setTimeout(() => {
      resolve(getVoices());
    }, 1000);
  });
}

/**
 * 播放文本语音
 */
export async function speak(
  text: string,
  lang: string = 'zh-CN',
  options: {
    rate?: number;
    pitch?: number;
    volume?: number;
  } = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    // 停止当前播放
    stopSpeaking();

    // 等待语音列表加载
    waitForVoices().then(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = options.rate ?? 1.0;
      utterance.pitch = options.pitch ?? 1.0;
      utterance.volume = options.volume ?? 1.0;

      // 尝试使用中文语音
      if (lang.startsWith('zh')) {
        const chineseVoice = findChineseVoice();
        if (chineseVoice) {
          utterance.voice = chineseVoice;
          console.log('使用语音:', chineseVoice.name, chineseVoice.lang);
        } else {
          console.warn('未找到中文语音，使用默认语音');
        }
      }

      utterance.onstart = () => {
        isSpeaking = true;
        console.log('开始播放语音:', text);
      };

      utterance.onend = () => {
        isSpeaking = false;
        currentUtterance = null;
        console.log('语音播放完成');
        resolve();
      };

      utterance.onerror = (error) => {
        isSpeaking = false;
        currentUtterance = null;
        console.error('语音播放错误:', error);
        reject(error);
      };

      currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    });
  });
}

/**
 * 停止当前播放
 */
export function stopSpeaking(): void {
  if (isSpeaking && currentUtterance) {
    window.speechSynthesis.cancel();
    isSpeaking = false;
    currentUtterance = null;
    console.log('停止语音播放');
  }
}

/**
 * 检查是否正在播放
 */
export function isCurrentlySpeaking(): boolean {
  return isSpeaking;
}

/**
 * 检查浏览器是否支持 TTS
 */
export function isTTSSupported(): boolean {
  return 'speechSynthesis' in window;
}

/**
 * 在移动端“解锁”语音合成（需要在用户手势事件里调用，比如按钮点击）
 *
 * 许多移动端浏览器会阻止在异步链路（await Whisper/LLM）之后再触发的语音播放，
 * 但如果在用户点击时先触发一次（哪怕是静音/极短）speechSynthesis，就会允许后续播放。
 */
export function primeTTS(): void {
  try {
    if (!isTTSSupported()) return;

    // 有些浏览器会处于 paused 状态
    try {
      window.speechSynthesis.resume();
    } catch {
      // ignore
    }

    // 使用极短、静音的 utterance 来“解锁”
    const u = new SpeechSynthesisUtterance(' ');
    u.lang = 'en-US';
    u.volume = 0;     // 静音
    u.rate = 10;      // 尽快结束
    u.pitch = 1;

    // 触发一次 speak（在用户手势里）
    window.speechSynthesis.speak(u);

    // 避免队列堆积；稍后 cancel
    setTimeout(() => {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }, 50);
  } catch {
    // ignore
  }
}
