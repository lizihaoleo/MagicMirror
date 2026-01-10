import { useState, useEffect } from 'react';
import { FloatingMagicMirrorRef } from './FloatingMagicMirror';
import { 
  getActualExpressions,
  getActualMotions
} from '../services/expressionService';

interface ExpressionTesterProps {
  mirrorRef: React.RefObject<FloatingMagicMirrorRef>;
}

const ExpressionTester: React.FC<ExpressionTesterProps> = ({ mirrorRef }) => {
  const [testResult, setTestResult] = useState<string>('');
  const [actualExpressions, setActualExpressions] = useState<Array<{ name: string; display: string }>>([]);
  const [actualMotions, setActualMotions] = useState<Array<{ name: string; display: string }>>([]);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);

  // 从模型实例中获取实际的表情和动作列表
  useEffect(() => {
    const updateLists = () => {
      const model = mirrorRef.current?.getModel();
      if (model) {
        setActualExpressions(getActualExpressions(model));
        setActualMotions(getActualMotions(model));
      } else {
        setActualExpressions([]);
        setActualMotions([]);
      }
    };

    // 初始加载
    updateLists();

    // 定期检查模型是否已加载（模型加载是异步的）
    const interval = setInterval(updateLists, 500);
    
    return () => clearInterval(interval);
  }, [mirrorRef]);

  /**
   * 直接测试表情文件（使用实际文件名）
   */
  const testDirectExpression = (expressionName: string) => {
    const model = mirrorRef.current?.getModel();
    if (!model) {
      setTestResult('错误：无法获取 Live2D 模型实例');
      return;
    }

    try {
      // 直接使用 FloatingMagicMirror 的方法
      mirrorRef.current?.setExpression(expressionName);
      setTestResult(`已设置表情: ${expressionName}`);
    } catch (error: any) {
      setTestResult(`错误: ${error.message}`);
    }
  };

  /**
   * 直接测试动作文件（使用实际文件名）
   */
  const testDirectMotion = async (motionName: string) => {
    const model = mirrorRef.current?.getModel();
    if (!model) {
      setTestResult('错误：无法获取 Live2D 模型实例');
      return;
    }

    try {
      // 直接使用 FloatingMagicMirror 的方法
      await mirrorRef.current?.playMotion(motionName);
      setTestResult(`已播放动作: ${motionName}`);
    } catch (error: any) {
      setTestResult(`错误: ${error.message}`);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1001,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: isCollapsed ? '10px 15px' : '20px',
        borderRadius: '12px',
        color: 'white',
        minWidth: isCollapsed ? 'auto' : '300px',
        maxWidth: isCollapsed ? 'auto' : '400px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
        transition: 'all 0.3s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isCollapsed ? '0' : '15px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', color: '#4a9eff', cursor: 'pointer' }} onClick={() => setIsCollapsed(!isCollapsed)}>
          🎭 表情/动作测试器
        </h3>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#4a9eff',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '0 5px',
            lineHeight: '1',
          }}
          title={isCollapsed ? '展开' : '收缩'}
        >
          {isCollapsed ? '▶' : '▼'}
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* 直接测试表情文件 */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
              直接测试表情文件:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {actualExpressions.map((exp) => (
                <button
                  key={exp.name}
                  onClick={() => testDirectExpression(exp.name)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(74, 158, 255, 0.3)',
                    color: 'white',
                    border: '1px solid rgba(74, 158, 255, 0.5)',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(74, 158, 255, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(74, 158, 255, 0.3)';
                  }}
                >
                  {exp.display}
                </button>
              ))}
            </div>
          </div>

          {/* 直接测试动作文件 */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
              直接测试动作文件:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {actualMotions.map((motion) => (
                <button
                  key={motion.name}
                  onClick={() => testDirectMotion(motion.name)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(74, 158, 255, 0.3)',
                    color: 'white',
                    border: '1px solid rgba(74, 158, 255, 0.5)',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(74, 158, 255, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(74, 158, 255, 0.3)';
                  }}
                >
                  {motion.display}
                </button>
              ))}
            </div>
          </div>

          {/* 测试结果 */}
          {testResult && (
            <div
              style={{
                marginTop: '15px',
                padding: '10px',
                borderRadius: '6px',
                backgroundColor: testResult.includes('错误')
                  ? 'rgba(255, 68, 68, 0.2)'
                  : 'rgba(74, 158, 255, 0.2)',
                color: testResult.includes('错误') ? '#ff4444' : '#4a9eff',
                fontSize: '13px',
                border: `1px solid ${testResult.includes('错误') ? '#ff4444' : '#4a9eff'}`,
              }}
            >
              {testResult}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ExpressionTester;

