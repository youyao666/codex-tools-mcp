/**
 * 代码结构分析模块
 * 使用AST解析技术分析JavaScript/TypeScript代码结构
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');

class CodeStructureAnalyzer {
  constructor() {
    this.parserOptions = {
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
   * @param {string} filePath - 文件路径（用于错误信息）
   * @returns {Object} AST对象
   */
  parseCode(code, filePath = '') {
    try {
      return parse(code, {
        ...this.parserOptions,
        sourceFilename: filePath
      });
    } catch (error) {
      throw new Error(`解析代码失败: ${error.message}`);
    }
  }

  /**
   * 提取代码中的所有函数
   * @param {Object} ast - AST对象
   * @returns {Array} 函数列表
   */
  extractFunctions(ast) {
    const functions = [];
    const self = this;
    
    traverse(ast, {
      // 函数声明
      FunctionDeclaration(path) {
        const node = path.node;
        functions.push({
          type: 'function',
          name: node.id ? node.id.name : '(匿名)',
          params: node.params.map(param => self.getParameterName(param)),
          async: node.async,
          generator: node.generator,
          start: node.loc ? node.loc.start : null,
          end: node.loc ? node.loc.end : null,
          body: self.extractFunctionBody(node)
        });
      },
      
      // 箭头函数
      ArrowFunctionExpression(path) {
        const node = path.node;
        functions.push({
          type: 'arrowFunction',
          name: self.getArrowFunctionName(path),
          params: node.params.map(param => self.getParameterName(param)),
          async: node.async,
          generator: node.generator,
          start: node.loc ? node.loc.start : null,
          end: node.loc ? node.loc.end : null,
          body: self.extractFunctionBody(node)
        });
      },
      
      // 函数表达式
      FunctionExpression(path) {
        const node = path.node;
        functions.push({
          type: 'functionExpression',
          name: self.getFunctionExpressionName(path),
          params: node.params.map(param => self.getParameterName(param)),
          async: node.async,
          generator: node.generator,
          start: node.loc ? node.loc.start : null,
          end: node.loc ? node.loc.end : null,
          body: self.extractFunctionBody(node)
        });
      },
      
      // 类方法
      ClassMethod(path) {
        const node = path.node;
        functions.push({
          type: 'classMethod',
          name: node.key.name || node.key.value,
          className: self.getClassName(path),
          kind: node.kind, // 'get', 'set', 'method', 'constructor'
          static: node.static,
          params: node.params.map(param => self.getParameterName(param)),
          async: node.async,
          generator: node.generator,
          start: node.loc ? node.loc.start : null,
          end: node.loc ? node.loc.end : null,
          body: self.extractFunctionBody(node)
        });
      }
    });
    
    return functions;
  }

  /**
   * 提取代码中的所有类
   * @param {Object} ast - AST对象
   * @returns {Array} 类列表
   */
  extractClasses(ast) {
    const classes = [];
    const self = this;
    
    traverse(ast, {
      ClassDeclaration(path) {
        const node = path.node;
        const superClass = node.superClass ? self.getNodeName(node.superClass) : null;
        
        classes.push({
          type: 'class',
          name: node.id.name,
          superClass,
          methods: self.extractClassMethods(node),
          properties: self.extractClassProperties(node),
          start: node.loc ? node.loc.start : null,
          end: node.loc ? node.loc.end : null
        });
      },
      
      ClassExpression(path) {
        const node = path.node;
        const superClass = node.superClass ? self.getNodeName(node.superClass) : null;
        const className = node.id ? node.id.name : self.getClassExpressionName(path);
        
        classes.push({
          type: 'classExpression',
          name: className,
          superClass,
          methods: self.extractClassMethods(node),
          properties: self.extractClassProperties(node),
          start: node.loc ? node.loc.start : null,
          end: node.loc ? node.loc.end : null
        });
      }
    });
    
    return classes;
  }

  /**
   * 提取代码中的所有变量声明
   * @param {Object} ast - AST对象
   * @returns {Array} 变量列表
   */
  extractVariables(ast) {
    const variables = [];
    const self = this;
    
    traverse(ast, {
      VariableDeclaration(path) {
        const node = path.node;
        
        node.declarations.forEach(declarator => {
          variables.push({
            type: 'variable',
            kind: node.kind, // 'var', 'let', 'const'
            name: self.getVariableName(declarator.id),
            value: declarator.init ? self.getNodeValue(declarator.init) : null,
            start: declarator.loc ? declarator.loc.start : null,
            end: declarator.loc ? declarator.loc.end : null
          });
        });
      }
    });
    
    return variables;
  }

  /**
   * 提取代码中的所有导入语句
   * @param {Object} ast - AST对象
   * @returns {Array} 导入列表
   */
  extractImports(ast) {
    const imports = [];
    const self = this;
    
    traverse(ast, {
      ImportDeclaration(path) {
        const node = path.node;
        
        const specifiers = node.specifiers.map(spec => {
          if (t.isImportDefaultSpecifier(spec)) {
            return { type: 'default', local: spec.local.name };
          } else if (t.isImportSpecifier(spec)) {
            return {
              type: 'named',
              imported: spec.imported.name,
              local: spec.local.name
            };
          } else if (t.isImportNamespaceSpecifier(spec)) {
            return { type: 'namespace', local: spec.local.name };
          }
        });
        
        imports.push({
          type: 'import',
          source: node.source.value,
          specifiers,
          start: node.loc ? node.loc.start : null,
          end: node.loc ? node.loc.end : null
        });
      }
    });
    
    return imports;
  }

  /**
   * 提取代码中的所有导出语句
   * @param {Object} ast - AST对象
   * @returns {Array} 导出列表
   */
  extractExports(ast) {
    const exports = [];
    const self = this;
    
    traverse(ast, {
      ExportNamedDeclaration(path) {
        const node = path.node;
        
        const specifiers = node.specifiers ? node.specifiers.map(spec => {
          return {
            local: spec.local.name,
            exported: spec.exported.name
          };
        }) : [];
        
        exports.push({
          type: 'namedExport',
          specifiers,
          source: node.source ? node.source.value : null,
          start: node.loc ? node.loc.start : null,
          end: node.loc ? node.loc.end : null
        });
      },
      
      ExportDefaultDeclaration(path) {
        const node = path.node;
        
        exports.push({
          type: 'defaultExport',
          name: self.getExportName(node.declaration),
          start: node.loc ? node.loc.start : null,
          end: node.loc ? node.loc.end : null
        });
      },
      
      ExportAllDeclaration(path) {
        const node = path.node;
        
        exports.push({
          type: 'exportAll',
          source: node.source.value,
          start: node.loc ? node.loc.start : null,
          end: node.loc ? node.loc.end : null
        });
      }
    });
    
    return exports;
  }

  /**
   * 分析代码依赖关系
   * @param {Object} ast - AST对象
   * @returns {Object} 依赖关系
   */
  analyzeDependencies(ast) {
    const dependencies = {
      imports: this.extractImports(ast),
      requires: [], // CommonJS require
      calls: [], // 函数调用
      properties: [] // 对象属性访问
    };
    const self = this;
    
    traverse(ast, {
      // CommonJS require
      CallExpression(path) {
        const node = path.node;
        
        if (t.isIdentifier(node.callee, { name: 'require' }) && 
            t.isStringLiteral(node.arguments[0])) {
          dependencies.requires.push({
            module: node.arguments[0].value,
            start: node.loc ? node.loc.start : null,
            end: node.loc ? node.loc.end : null
          });
        } else if (!t.isMemberExpression(node.callee) && 
                   !t.isIdentifier(node.callee, { name: 'require' })) {
          // 其他函数调用
          dependencies.calls.push({
            name: self.getNodeName(node.callee),
            start: node.loc ? node.loc.start : null,
            end: node.loc ? node.loc.end : null
          });
        }
      },
      
      // 对象属性访问
      MemberExpression(path) {
        const node = path.node;
        
        dependencies.properties.push({
          object: self.getNodeName(node.object),
          property: self.getNodeName(node.property),
          computed: node.computed,
          start: node.loc ? node.loc.start : null,
          end: node.loc ? node.loc.end : null
        });
      }
    });
    
    return dependencies;
  }

  /**
   * 获取参数名称
   * @param {Object} param - 参数节点
   * @returns {string} 参数名称
   */
  getParameterName(param) {
    if (t.isIdentifier(param)) {
      return param.name;
    } else if (t.isAssignmentPattern(param)) {
      return this.getParameterName(param.left);
    } else if (t.isRestElement(param)) {
      return `...${this.getParameterName(param.argument)}`;
    } else if (t.isObjectPattern(param)) {
      return `{${param.properties.map(p => this.getParameterName(p)).join(', ')}}`;
    } else if (t.isArrayPattern(param)) {
      return `[${param.elements.map(p => p ? this.getParameterName(p) : '').join(', ')}]`;
    }
    return 'unknown';
  }

  /**
   * 获取函数体
   * @param {Object} node - 函数节点
   * @returns {string} 函数体代码
   */
  extractFunctionBody(node) {
    if (!node.body) return null;
    
    if (t.isBlockStatement(node.body)) {
      return node.body.start ? node.body.start : null;
    } else {
      // 箭头函数的简洁返回
      return node.start;
    }
  }

  /**
   * 获取箭头函数名称
   * @param {Object} path - 路径节点
   * @returns {string} 函数名称
   */
  getArrowFunctionName(path) {
    const parent = path.parent;
    
    if (t.isVariableDeclarator(parent)) {
      return parent.id.name;
    } else if (t.isAssignmentExpression(parent)) {
      return this.getNodeName(parent.left);
    } else if (t.isProperty(parent)) {
      return parent.key.name || parent.key.value;
    }
    
    return '(匿名箭头函数)';
  }

  /**
   * 获取函数表达式名称
   * @param {Object} path - 路径节点
   * @returns {string} 函数名称
   */
  getFunctionExpressionName(path) {
    const node = path.node;
    if (node.id) {
      return node.id.name;
    }
    
    const parent = path.parent;
    if (t.isVariableDeclarator(parent)) {
      return parent.id.name;
    } else if (t.isAssignmentExpression(parent)) {
      return this.getNodeName(parent.left);
    } else if (t.isProperty(parent)) {
      return parent.key.name || parent.key.value;
    }
    
    return '(匿名函数)';
  }

  /**
   * 获取类名
   * @param {Object} path - 路径节点
   * @returns {string} 类名
   */
  getClassName(path) {
    let current = path.parentPath;
    
    while (current) {
      if (t.isClassDeclaration(current.node) || t.isClassExpression(current.node)) {
        return current.node.id ? current.node.id.name : '(匿名类)';
      }
      current = current.parentPath;
    }
    
    return '(未知类)';
  }

  /**
   * 获取类表达式名称
   * @param {Object} path - 路径节点
   * @returns {string} 类名
   */
  getClassExpressionName(path) {
    const parent = path.parent;
    
    if (t.isVariableDeclarator(parent)) {
      return parent.id.name;
    } else if (t.isAssignmentExpression(parent)) {
      return this.getNodeName(parent.left);
    } else if (t.isProperty(parent)) {
      return parent.key.name || parent.key.value;
    }
    
    return '(匿名类)';
  }

  /**
   * 提取类方法
   * @param {Object} node - 类节点
   * @returns {Array} 方法列表
   */
  extractClassMethods(node) {
    return node.body.body
      .filter(member => t.isClassMethod(member))
      .map(method => ({
        name: method.key.name || method.key.value,
        kind: method.kind,
        static: method.static,
        params: method.params.map(param => this.getParameterName(param)),
        async: method.async,
        generator: method.generator
      }));
  }

  /**
   * 提取类属性
   * @param {Object} node - 类节点
   * @returns {Array} 属性列表
   */
  extractClassProperties(node) {
    return node.body.body
      .filter(member => t.isClassProperty(member))
      .map(prop => ({
        name: prop.key.name || prop.key.value,
        static: prop.static,
        value: prop.value ? this.getNodeValue(prop.value) : null
      }));
  }

  /**
   * 获取变量名称
   * @param {Object} id - 标识符节点
   * @returns {string} 变量名称
   */
  getVariableName(id) {
    if (t.isIdentifier(id)) {
      return id.name;
    } else if (t.isObjectPattern(id)) {
      return `{${id.properties.map(p => this.getVariableName(p.key)).join(', ')}}`;
    } else if (t.isArrayPattern(id)) {
      return `[${id.elements.map(e => e ? this.getVariableName(e) : '').join(', ')}]`;
    } else if (t.isRestElement(id)) {
      return `...${this.getVariableName(id.argument)}`;
    }
    return 'unknown';
  }

  /**
   * 获取节点名称
   * @param {Object} node - AST节点
   * @returns {string} 节点名称
   */
  getNodeName(node) {
    if (t.isIdentifier(node)) {
      return node.name;
    } else if (t.isStringLiteral(node)) {
      return node.value;
    } else if (t.isMemberExpression(node)) {
      return `${this.getNodeName(node.object)}.${this.getNodeName(node.property)}`;
    } else if (t.isCallExpression(node)) {
      return `${this.getNodeName(node.callee)}()`;
    }
    return 'unknown';
  }

  /**
   * 获取节点值
   * @param {Object} node - AST节点
   * @returns {any} 节点值
   */
  getNodeValue(node) {
    if (t.isStringLiteral(node)) {
      return node.value;
    } else if (t.isNumericLiteral(node)) {
      return node.value;
    } else if (t.isBooleanLiteral(node)) {
      return node.value;
    } else if (t.isNullLiteral(node)) {
      return null;
    } else if (t.isIdentifier(node)) {
      return node.name;
    } else if (t.isArrayExpression(node)) {
      return `[Array]`;
    } else if (t.isObjectExpression(node)) {
      return `{Object}`;
    }
    return 'unknown';
  }

  /**
   * 获取导出名称
   * @param {Object} declaration - 声明节点
   * @returns {string} 导出名称
   */
  getExportName(declaration) {
    if (t.isIdentifier(declaration)) {
      return declaration.name;
    } else if (t.isFunctionDeclaration(declaration) || t.isClassDeclaration(declaration)) {
      return declaration.id ? declaration.id.name : '(匿名)';
    } else if (t.isAssignmentExpression(declaration)) {
      return this.getNodeName(declaration.left);
    }
    return 'unknown';
  }

  /**
   * 分析代码结构
   * @param {string} filePathOrCode - 文件路径或代码字符串
   * @param {string} encoding - 文件编码，默认utf8
   * @param {boolean} isCode - 是否为代码字符串，默认false（文件路径）
   * @returns {Object} 代码结构分析结果
   */
  analyzeCodeStructure(filePathOrCode, encoding = 'utf8', isCode = false) {
    try {
      let ast;
      
      if (isCode) {
        // 如果是代码字符串，直接解析
        ast = this.parseCode(filePathOrCode);
      } else {
        // 如果是文件路径，先读取文件再解析
        ast = this.parseFile(filePathOrCode, encoding);
      }
      
      return {
        file: isCode ? '(代码字符串)' : filePathOrCode,
        functions: this.extractFunctions(ast),
        classes: this.extractClasses(ast),
        variables: this.extractVariables(ast),
        imports: this.extractImports(ast),
        exports: this.extractExports(ast),
        dependencies: this.analyzeDependencies(ast)
      };
    } catch (error) {
      throw new Error(`分析代码结构失败: ${error.message}`);
    }
  }
}

module.exports = CodeStructureAnalyzer;