/**
 * 多语言代码结构分析模块 - 简化版
 * 支持JavaScript/TypeScript，并为其他语言预留接口
 */

const fs = require('fs');
const path = require('path');

// 导入原有的Babel解析器，用于JavaScript/TypeScript的分析
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');

// 导入原有的JavaScript分析器
const CodeStructureAnalyzer = require('./code_analyzer');

/**
 * 多语言代码分析器类 - 简化版
 */
class MultiLanguageCodeAnalyzer {
  constructor() {
    // Babel解析器选项
    this.babelParserOptions = {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      plugins: [
        'jsx',
        'typescript',
        'decorators-legacy',
        'classProperties',
        'objectRestSpread',
        'asyncGenerators',
        'functionBind',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'dynamicImport',
        'nullishCoalescingOperator',
        'optionalChaining'
      ]
    };
    
    // 初始化JavaScript分析器
    this.jsAnalyzer = new CodeStructureAnalyzer();
  }

  /**
   * 根据文件扩展名检测语言类型
   * @param {string} filePath - 文件路径
   * @returns {string} 语言类型
   */
  detectLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const langMap = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.pyw': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.cxx': 'cpp',
      '.cc': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.cs': 'csharp',
      '.vb': 'vb'
    };
    
    return langMap[ext] || 'unknown';
  }
  
  /**
   * 通过代码内容检测语言类型
   * @param {string} code - 代码内容
   * @returns {string} 语言类型
   */
  detectLanguageByContent(code) {
    // 简单的语言检测规则
    if (code.includes('package ') && code.includes('func ')) {
      return 'go';
    }
    if (code.includes('public class ') || (code.includes('import java.') && code.includes('public '))) {
      return 'java';
    }
    if (code.includes('def ') && (code.includes('import ') || code.includes('from '))) {
      return 'python';
    }
    if (code.includes('#include') && (code.includes('int main') || code.includes('std::'))) {
      return 'cpp';
    }
    if (code.includes('#include') && !code.includes('std::')) {
      return 'c';
    }
    if (code.includes('import ') || code.includes('export ') || code.includes('function ') || code.includes('const ')) {
      return 'javascript';
    }
    
    // 默认返回JavaScript
    return 'javascript';
  }
  
  /**
   * 获取语言对应的文件扩展名
   * @param {string} language - 语言类型
   * @returns {string} 文件扩展名
   */
  getFileExtension(language) {
    const extensionMap = {
      'javascript': 'js',
      'typescript': 'ts',
      'python': 'py',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'go': 'go',
      'rust': 'rs',
      'php': 'php',
      'ruby': 'rb',
      'swift': 'swift',
      'kotlin': 'kt',
      'scala': 'scala',
      'csharp': 'cs',
      'vb': 'vb'
    };
    
    return extensionMap[language] || 'txt';
  }

  /**
   * 解析代码文件并返回AST
   * @param {string} filePath - 文件路径
   * @param {string} encoding - 文件编码，默认utf8
   * @returns {Object} AST对象
   */
  parseFile(filePath, encoding = 'utf8') {
    try {
      const code = fs.readFileSync(filePath, encoding);
      return this.parseCode(code, filePath);
    } catch (error) {
      throw new Error(`解析文件失败: ${error.message}`);
    }
  }

  /**
   * 解析代码字符串并返回AST
   * @param {string} code - 代码字符串
   * @param {string} filePath - 文件路径（用于语言检测）
   * @returns {Object} AST对象
   */
  parseCode(code, filePath = '') {
    const language = this.detectLanguage(filePath);
    
    if (language === 'unknown') {
      throw new Error(`无法识别文件类型: ${filePath}`);
    }
    
    // 对于JavaScript/TypeScript，使用Babel解析器
    if (language === 'javascript' || language === 'typescript') {
      return parse(code, {
        ...this.babelParserOptions,
        sourceFilename: filePath
      });
    }
    
    // 对于其他语言，暂时返回原始代码和语言类型
    // 在实际应用中，这里应该使用对应的解析器
    return {
      code,
      language,
      isPlaceholder: true
    };
  }

  /**
   * 分析代码结构
   * @param {string} filePathOrCode - 文件路径或代码字符串
   * @param {string} encoding - 文件编码，默认utf8
   * @param {boolean} isCode - 是否为代码字符串，默认false
   * @returns {Object} 代码结构分析结果
   */
  analyzeCodeStructure(filePathOrCode, encoding = 'utf8', isCode = false) {
    let filePath = '';
    let code = '';
    let language = '';
    
    if (isCode) {
      code = filePathOrCode;
      // 对于代码字符串，我们需要通过内容来推断语言类型
      language = this.detectLanguageByContent(code);
      filePath = `temp.${this.getFileExtension(language)}`;
    } else {
      filePath = filePathOrCode;
      code = fs.readFileSync(filePath, encoding);
      language = this.detectLanguage(filePath);
    }
    
    // 根据语言类型选择分析方法
    if (language === 'javascript' || language === 'typescript') {
      try {
        const ast = parse(code, {
          ...this.babelParserOptions,
          sourceFilename: filePath
        });
        return this.analyzeJavaScript(ast, filePath);
      } catch (error) {
        throw new Error(`JavaScript代码分析失败: ${error.message}`);
      }
    } else {
      // 对于其他语言，使用正则表达式进行分析
      return this.analyzeWithRegex(code, language, filePath);
    }
  }

  /**
   * 使用Babel分析JavaScript/TypeScript代码
   * @param {Object} ast - AST对象
   * @param {string} filePath - 文件路径
   * @returns {Object} 分析结果
   */
  analyzeJavaScript(ast, filePath) {
    try {
      return {
        file: filePath,
        language: 'javascript',
        functions: this.jsAnalyzer.extractFunctions(ast),
        classes: this.jsAnalyzer.extractClasses(ast),
        variables: this.jsAnalyzer.extractVariables(ast),
        imports: this.jsAnalyzer.extractImports(ast),
        exports: this.jsAnalyzer.extractExports(ast),
        dependencies: this.jsAnalyzer.analyzeDependencies(ast)
      };
    } catch (error) {
      throw new Error(`JavaScript代码分析失败: ${error.message}`);
    }
  }

  /**
   * 分析其他语言的代码（简化版）
   * @param {Object} ast - AST或代码对象
   * @param {string} language - 语言类型
   * @param {string} filePath - 文件路径
   * @returns {Object} 分析结果
   */
  analyzeOtherLanguages(ast, language, filePath) {
    const result = {
      file: filePath,
      language,
      functions: [],
      classes: [],
      variables: [],
      imports: [],
      exports: [],
      dependencies: {
        imports: [],
        requires: [],
        functionCalls: [],
        propertyAccess: []
      },
      note: '此语言的分析功能尚未完全实现，仅提供基础信息'
    };
    
    // 如果是占位符AST，使用正则表达式进行基本分析
    if (ast.isPlaceholder) {
      return this.analyzeWithRegex(ast.code, language, result);
    }
    
    return result;
  }

  /**
   * 使用正则表达式进行基本代码分析
   * @param {string} code - 源代码
   * @param {string} language - 语言类型
   * @param {string} filePath - 文件路径
   * @returns {Object} 分析结果
   */
  analyzeWithRegex(code, language, filePath) {
    const result = {
      file: filePath,
      language,
      functions: [],
      classes: [],
      variables: [],
      imports: [],
      exports: [],
      dependencies: {
        imports: [],
        requires: [],
        functionCalls: [],
        propertyAccess: []
      },
      note: '此语言的分析功能尚未完全实现，仅提供基础信息'
    };
    
    // 根据不同语言使用不同的正则表达式
    switch (language) {
      case 'python':
        this.analyzePythonWithRegex(code, result);
        break;
      case 'java':
        this.analyzeJavaWithRegex(code, result);
        break;
      case 'cpp':
      case 'c':
        this.analyzeCppWithRegex(code, result);
        break;
      case 'go':
        this.analyzeGoWithRegex(code, result);
        break;
      default:
        break;
    }
    
    return result;
  }

  /**
   * 使用正则表达式分析Python代码
   * @param {string} code - 源代码
   * @param {Object} result - 结果对象
   */
  analyzePythonWithRegex(code, result) {
    // 提取函数定义
    const funcMatches = code.matchAll(/def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\):/g);
    for (const match of funcMatches) {
      const params = match[2].split(',').map(p => p.trim()).filter(p => p);
      result.functions.push({
        type: 'function',
        name: match[1],
        params: params,
        line: this.getLineNumber(code, match.index)
      });
    }
    
    // 提取类定义
    const classMatches = code.matchAll(/class\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*\(\s*([^\)]*)\s*\))?:/g);
    for (const match of classMatches) {
      result.classes.push({
        type: 'class',
        name: match[1],
        superClass: match[2] || null,
        line: this.getLineNumber(code, match.index)
      });
    }
    
    // 提取导入语句
    const importMatches = code.matchAll(/(?:import\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*)*)|from\s+([a-zA-Z_][a-zA-Z0-9_\.]*)\s+import\s+(.+))/g);
    for (const match of importMatches) {
      if (match[1]) {
        result.dependencies.imports.push({
          source: match[1],
          type: 'import'
        });
      } else if (match[2]) {
        result.dependencies.imports.push({
          source: match[2],
          imports: match[3],
          type: 'from_import'
        });
      }
    }
  }

  /**
   * 使用正则表达式分析Java代码
   * @param {string} code - 源代码
   * @param {Object} result - 结果对象
   */
  analyzeJavaWithRegex(code, result) {
    // 提取方法定义
    const methodMatches = code.matchAll(/(?:public|private|protected)?\s*(?:static)?\s*(?:[\w<>]+\s+)+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*(?:throws\s+[\w,\s]+)?\s*[{;]/g);
    for (const match of methodMatches) {
      const params = match[2].split(',').map(p => p.trim().split(/\s+/).pop()).filter(p => p);
      result.functions.push({
        type: 'method',
        name: match[1],
        params: params,
        line: this.getLineNumber(code, match.index)
      });
    }
    
    // 提取类定义
    const classMatches = code.matchAll(/(?:public\s+)?(?:abstract\s+)?(?:final\s+)?class\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+extends\s+([a-zA-Z_][a-zA-Z0-9_]*))?(?:\s+implements\s+([^{]+))?/g);
    for (const match of classMatches) {
      result.classes.push({
        type: 'class',
        name: match[1],
        superClass: match[2] || null,
        interfaces: match[3] ? match[3].split(',').map(i => i.trim()) : [],
        line: this.getLineNumber(code, match.index)
      });
    }
    
    // 提取导入语句
    const importMatches = code.matchAll(/import\s+([\w\.]+);/g);
    for (const match of importMatches) {
      result.dependencies.imports.push({
        source: match[1],
        type: 'import'
      });
    }
  }

  /**
   * 使用正则表达式分析C/C++代码
   * @param {string} code - 源代码
   * @param {Object} result - 结果对象
   */
  analyzeCppWithRegex(code, result) {
    // 提取函数定义
    const funcMatches = code.matchAll(/(?:[\w<>*&\s]+)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*(?:const)?\s*[{;]/g);
    for (const match of funcMatches) {
      const params = match[2].split(',').map(p => p.trim().split(/\s+/).pop()).filter(p => p);
      result.functions.push({
        type: 'function',
        name: match[1],
        params: params,
        line: this.getLineNumber(code, match.index)
      });
    }
    
    // 提取类定义
    const classMatches = code.matchAll(/class\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*:\s*(?:public|private|protected)\s+([a-zA-Z_][a-zA-Z0-9_]*))?/g);
    for (const match of classMatches) {
      result.classes.push({
        type: 'class',
        name: match[1],
        superClass: match[2] || null,
        line: this.getLineNumber(code, match.index)
      });
    }
    
    // 提取包含指令
    const includeMatches = code.matchAll(/#include\s*[<"]([^>"]+)[>"]/g);
    for (const match of includeMatches) {
      result.dependencies.imports.push({
        source: match[1],
        type: 'include'
      });
    }
  }

  /**
   * 使用正则表达式分析Go代码
   * @param {string} code - 源代码
   * @param {Object} result - 结果对象
   */
  analyzeGoWithRegex(code, result) {
    // 提取函数定义
    const funcMatches = code.matchAll(/func\s+(?:\([^\)]+\)\s*)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)(?:\s*\([^)]*\))?\s*{/g);
    for (const match of funcMatches) {
      const params = match[2].split(',').map(p => p.trim().split(/\s+/).shift()).filter(p => p);
      result.functions.push({
        type: 'function',
        name: match[1],
        params: params,
        line: this.getLineNumber(code, match.index)
      });
    }
    
    // 提取结构体定义
    const structMatches = code.matchAll(/type\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+struct\s*{/g);
    for (const match of structMatches) {
      result.classes.push({
        type: 'struct',
        name: match[1],
        line: this.getLineNumber(code, match.index)
      });
    }
    
    // 提取导入语句
    const importMatches = code.matchAll(/import\s+(?:"([^"]+)"|\(([^)]+)\))/g);
    for (const match of importMatches) {
      if (match[1]) {
        result.dependencies.imports.push({
          source: match[1],
          type: 'import'
        });
      } else if (match[2]) {
        const imports = match[2].split('\n').map(i => i.trim().replace(/"/g, '')).filter(i => i);
        imports.forEach(imp => {
          result.dependencies.imports.push({
            source: imp,
            type: 'import'
          });
        });
      }
    }
  }

  /**
   * 获取代码中指定位置的行号
   * @param {string} code - 源代码
   * @param {number} index - 字符位置
   * @returns {number} 行号
   */
  getLineNumber(code, index) {
    const before = code.substring(0, index);
    return (before.match(/\n/g) || []).length + 1;
  }
}

module.exports = MultiLanguageCodeAnalyzer;