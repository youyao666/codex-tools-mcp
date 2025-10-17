#!/usr/bin/env node
// cspell:ignore modelcontextprotocol, jschardet, findstr, startproject, vercel, netlify, github_pages

// 设置控制台输出编码为UTF-8
if (process.platform === 'win32') {
  process.stdout.setEncoding('utf8');
  process.stderr.setEncoding('utf8');
  // 设置控制台代码页为UTF-8
  const { spawn } = require('child_process');
  spawn('chcp', ['65001'], { stdio: 'ignore' });
}

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const jschardet = require('jschardet');
const iconv = require('iconv-lite');
const CodeStructureAnalyzer = require('./code_analyzer.js');

// 路径验证函数，防止路径遍历攻击
function validatePath(inputPath, allowedBasePaths = []) {
  // 解析路径为绝对路径
  const resolvedPath = path.resolve(inputPath);
  
  // 如果没有指定允许的基础路径，则只检查危险字符
  if (allowedBasePaths.length === 0) {
    // 检查路径中是否包含危险字符
    if (inputPath.includes('../') || inputPath.includes('..\\')) {
      throw new Error('路径包含潜在的目录遍历攻击字符');
    }
    return resolvedPath;
  }
  
  // 检查路径是否在允许的基础路径内
  const isAllowed = allowedBasePaths.some(basePath => {
    const resolvedBasePath = path.resolve(basePath);
    return resolvedPath.startsWith(resolvedBasePath);
  });
  
  if (!isAllowed) {
    throw new Error(`路径 ${resolvedPath} 不在允许的目录范围内`);
  }
  
  return resolvedPath;
}

// 操作日志记录
const operationLog = [];
function logOperation(operation, path, user, success, details = '') {
  const logEntry = {
    timestamp: new Date().toISOString(),
    operation,
    path,
    user: user || 'unknown',
    success,
    details
  };
  operationLog.push(logEntry);
  
  // 保持日志大小在合理范围内（最多1000条）
  if (operationLog.length > 1000) {
    operationLog.shift();
  }
  
  return logEntry;
}

const execAsync = promisify(exec);

class CodexToolsServer {
  constructor() {
    this.server = new Server(
      {
        name: 'codex-tools-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // 初始化代码分析器
    this.codeAnalyzer = new CodeStructureAnalyzer();

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // 列出所有可用工具
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'read_file_advanced',
            description: '高级文件读取，支持缩进感知和上下文分析',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: '要读取的文件路径（必须是绝对路径）',
                },
                offset: {
                  type: 'integer',
                  description: '起始行号（从1开始，默认为1）',
                  default: 1,
                },
                limit: {
                  type: 'integer',
                  description: '最大行数（默认为200）',
                  default: 200,
                },
                mode: {
                  type: 'string',
                  description: '读取模式：slice（简单切片）或indentation（缩进感知）',
                  enum: ['slice', 'indentation'],
                  default: 'slice',
                },
                indentation: {
                  type: 'object',
                  description: '缩进感知模式的配置',
                  properties: {
                    anchor_line: {
                      type: 'integer',
                      description: '锚点行号（默认为offset）',
                    },
                    max_levels: {
                      type: 'integer',
                      description: '最大缩进级别（0表示无限制）',
                      default: 0,
                    },
                    include_siblings: {
                      type: 'boolean',
                      description: '是否包含同级代码块',
                      default: false,
                    },
                    include_header: {
                      type: 'boolean',
                      description: '是否包含代码块上方的头信息',
                      default: false,
                    },
                    max_lines: {
                      type: 'integer',
                      description: '最大行数（覆盖全局limit）',
                    },
                  },
                },
                encoding: {
                  type: 'string',
                  description: '文件编码，默认为"auto"自动检测',
                  default: 'auto',
                },
              },
              required: ['file_path'],
            },
          },
    {
      name: 'write_file',
      description: '写入文件内容',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '要写入的文件路径',
          },
          content: {
            type: 'string',
            description: '要写入的内容',
          },
          encoding: {
            type: 'string',
            description: '文件编码，默认为"utf8"。支持的编码包括: utf8, gbk, gb2312, big5, shift_jis等',
            default: 'utf8',
          },
          backup: {
            type: 'boolean',
            description: '是否在写入前创建备份文件',
            default: false,
          },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'apply_patch',
      description: '应用补丁到文件系统，支持添加、删除和更新文件',
      inputSchema: {
        type: 'object',
        properties: {
          patches: {
            type: 'array',
            description: '要应用的补丁列表',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['add', 'delete', 'update', 'move'],
                  description: '补丁类型'
                },
                path: {
                  type: 'string',
                  description: '文件路径'
                },
                new_path: {
                  type: 'string',
                  description: '新路径（仅用于move类型）'
                },
                content: {
                  type: 'string',
                  description: '文件内容（用于add和update类型）'
                },
                old_str: {
                  type: 'string',
                  description: '要替换的旧字符串（用于update类型）'
                },
                new_str: {
                  type: 'string',
                  description: '新字符串（用于update类型）'
                },
                encoding: {
                  type: 'string',
                  default: 'utf8',
                  description: '文件编码'
                },
                create_dirs: {
                  type: 'boolean',
                  default: true,
                  description: '是否创建不存在的目录'
                },
                backup: {
                  type: 'boolean',
                  default: false,
                  description: '是否创建备份'
                }
              },
              required: ['type', 'path']
            }
          },
          user: {
            type: 'string',
            default: 'unknown',
            description: '操作用户'
          }
        },
        required: ['patches']
      }
    },
    {
      name: 'grep_files',
      description: '使用ripgrep在文件中搜索文本模式，支持高级过滤和结果限制',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: '要搜索的文本模式或正则表达式'
          },
          path: {
            type: 'string',
            description: '要搜索的目录路径（可选，默认为当前目录）'
          },
          include_pattern: {
            type: 'string',
            description: '包含的文件模式（如 *.js, *.py）'
          },
          exclude_pattern: {
            type: 'string',
            description: '排除的文件模式（如 *.min.js, node_modules）'
          },
          max_results: {
            type: 'integer',
            description: '最大结果数（默认为100）',
            default: 100
          },
          context_lines: {
            type: 'integer',
            description: '匹配行前后的上下文行数（默认为0）',
            default: 0
          },
          case_sensitive: {
            type: 'boolean',
            description: '是否区分大小写（默认为false）',
            default: false
          },
          whole_word: {
            type: 'boolean',
            description: '是否匹配整个单词（默认为false）',
            default: false
          },
          regex: {
            type: 'boolean',
            description: '是否将模式视为正则表达式（默认为true）',
            default: true
          },
          max_depth: {
            type: 'integer',
            description: '最大搜索深度（目录层级）'
          },
          timeout: {
            type: 'integer',
            description: '搜索超时时间（毫秒，默认为30000）',
            default: 30000
          },
          user: {
            type: 'string',
            default: 'unknown',
            description: '操作用户'
          }
        },
        required: ['pattern']
      }
    },
    {
      name: 'update_plan',
      description: '更新和管理开发计划，支持任务创建、状态更新和进度跟踪',
      inputSchema: {
        type: 'object',
        properties: {
          plan_id: {
            type: 'string',
            description: '计划ID，用于更新现有计划'
          },
          title: {
            type: 'string',
            description: '计划标题'
          },
          description: {
            type: 'string',
            description: '计划描述'
          },
          tasks: {
            type: 'array',
            description: '任务列表',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: '任务ID' },
                title: { type: 'string', description: '任务标题' },
                description: { type: 'string', description: '任务描述' },
                status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'blocked'], description: '任务状态' },
                priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: '任务优先级' },
                assignee: { type: 'string', description: '任务分配给谁' },
                dependencies: { type: 'array', items: { type: 'string' }, description: '任务依赖的其他任务ID' },
                estimated_hours: { type: 'number', description: '预估工时' },
                actual_hours: { type: 'number', description: '实际工时' },
                tags: { type: 'array', items: { type: 'string' }, description: '任务标签' }
              },
              required: ['id', 'title', 'status', 'priority']
            }
          },
          action: {
            type: 'string',
            enum: ['create', 'update', 'add_task', 'update_task', 'delete_task', 'complete', 'archive'],
            description: '操作类型：创建计划、更新计划、添加任务、更新任务、删除任务、完成计划、归档计划'
          },
          task_id: {
            type: 'string',
            description: '当操作为任务级别时，指定任务ID'
          },
          task_updates: {
            type: 'object',
            description: '任务更新内容（当action为update_task时使用）'
          },
          user: {
            type: 'string',
            description: '操作用户标识'
          }
        },
        required: ['action']
      }
    },
    {
      name: 'exec_stream',
      description: '执行命令并提供流式输出，支持长时间运行的命令和实时监控',
      inputSchema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: '要执行的命令'
          },
          cwd: {
            type: 'string',
            description: '命令执行的工作目录（可选）'
          },
          env: {
            type: 'object',
            description: '环境变量（可选）'
          },
          timeout: {
            type: 'integer',
            description: '命令超时时间（毫秒，默认为300000即5分钟）',
            default: 300000
          },
          shell: {
            type: 'boolean',
            description: '是否使用shell执行命令（默认为true）',
            default: true
          },
          stream_output: {
            type: 'boolean',
            description: '是否流式输出命令结果（默认为true）',
            default: true
          },
          capture_output: {
            type: 'boolean',
            description: '是否捕获完整输出（默认为true）',
            default: true
          },
          kill_on_timeout: {
            type: 'boolean',
            description: '超时时是否终止进程（默认为true）',
            default: true
          },
          user: {
            type: 'string',
            description: '操作用户标识'
          }
        },
        required: ['command']
      }
    },
          {
            name: 'list_directory',
            description: '列出目录内容',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: '要列出的目录路径',
                },
              },
              required: ['path'],
            },
          },
          {
            name: 'execute_command',
            description: '执行系统命令',
            inputSchema: {
              type: 'object',
              properties: {
                command: {
                  type: 'string',
                  description: '要执行的命令',
                },
                cwd: {
                  type: 'string',
                  description: '命令执行的工作目录（可选）',
                },
              },
              required: ['command'],
            },
          },
          {
            name: 'git_status',
            description: '获取Git仓库状态',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Git仓库路径（可选，默认为当前目录）',
                },
              },
            },
          },
          {
            name: 'git_diff',
            description: '获取Git仓库的差异',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Git仓库路径（可选，默认为当前目录）',
                },
                file: {
                  type: 'string',
                  description: '特定文件的差异（可选）',
                },
              },
            },
          },
          {
            name: 'git_commit',
            description: '提交Git更改',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Git仓库路径（可选，默认为当前目录）',
                },
                message: {
                  type: 'string',
                  description: '提交消息',
                },
                files: {
                  type: 'array',
                  items: {
                    type: 'string'
                  },
                  description: '要提交的文件列表（可选，默认为所有更改的文件）',
                },
                add_all: {
                  type: 'boolean',
                  description: '是否添加所有更改的文件到暂存区（默认为true）',
                  default: true,
                },
              },
              required: ['message'],
            },
          },
          {
            name: 'git_push',
            description: '推送Git提交到远程仓库',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Git仓库路径（可选，默认为当前目录）',
                },
                remote: {
                  type: 'string',
                  description: '远程仓库名称（默认为origin）',
                  default: 'origin',
                },
                branch: {
                  type: 'string',
                  description: '要推送的分支（默认为当前分支）',
                },
                force: {
                  type: 'boolean',
                  description: '是否强制推送（谨慎使用）',
                  default: false,
                },
              },
            },
          },
          {
            name: 'git_pull',
            description: '从远程仓库拉取更改',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Git仓库路径（可选，默认为当前目录）',
                },
                remote: {
                  type: 'string',
                  description: '远程仓库名称（默认为origin）',
                  default: 'origin',
                },
                branch: {
                  type: 'string',
                  description: '要拉取的分支（默认为当前分支）',
                },
              },
            },
          },
          {
            name: 'git_branch',
            description: '管理Git分支',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Git仓库路径（可选，默认为当前目录）',
                },
                action: {
                  type: 'string',
                  description: '分支操作：list（列出分支）、create（创建分支）、delete（删除分支）、checkout（切换分支）',
                  enum: ['list', 'create', 'delete', 'checkout'],
                  default: 'list',
                },
                name: {
                  type: 'string',
                  description: '分支名称（创建、删除或切换分支时需要）',
                },
                force: {
                  type: 'boolean',
                  description: '是否强制删除分支（仅用于删除操作）',
                  default: false,
                },
              },
            },
          },
          {
            name: 'project_template',
            description: '从模板创建新项目',
            inputSchema: {
              type: 'object',
              properties: {
                template_type: {
                  type: 'string',
                  description: '项目模板类型：react、vue、angular、node、express、python、django等',
                  enum: ['react', 'vue', 'angular', 'node', 'express', 'python', 'django', 'flask', 'custom'],
                },
                project_name: {
                  type: 'string',
                  description: '新项目名称',
                },
                project_path: {
                  type: 'string',
                  description: '项目创建路径（可选，默认为当前目录）',
                },
                custom_template_url: {
                  type: 'string',
                  description: '自定义模板URL（仅当template_type为custom时使用）',
                },
                package_manager: {
                  type: 'string',
                  description: '包管理器：npm、yarn、pnpm（可选，默认为npm）',
                  enum: ['npm', 'yarn', 'pnpm'],
                  default: 'npm',
                },
                install_dependencies: {
                  type: 'boolean',
                  description: '是否自动安装依赖（默认为true）',
                  default: true,
                },
                git_init: {
                  type: 'boolean',
                  description: '是否初始化Git仓库（默认为true）',
                  default: true,
                },
              },
              required: ['template_type', 'project_name'],
            },
          },
          {
            name: 'manage_dependencies',
            description: '管理项目依赖',
            inputSchema: {
              type: 'object',
              properties: {
                action: {
                  type: 'string',
                  description: '依赖操作：install（安装）、add（添加）、remove（移除）、update（更新）、list（列出）',
                  enum: ['install', 'add', 'remove', 'update', 'list'],
                  default: 'install',
                },
                project_path: {
                  type: 'string',
                  description: '项目路径（可选，默认为当前目录）',
                },
                packages: {
                  type: 'array',
                  items: {
                    type: 'string'
                  },
                  description: '要添加或移除的包列表（用于add和remove操作）',
                },
                save_dev: {
                  type: 'boolean',
                  description: '是否保存为开发依赖（用于add操作，默认为false）',
                  default: false,
                },
                package_manager: {
                  type: 'string',
                  description: '包管理器：npm、yarn、pnpm（可选，默认自动检测）',
                  enum: ['npm', 'yarn', 'pnpm'],
                },
              },
            },
          },
          {
            name: 'build_deploy',
            description: '构建和部署项目',
            inputSchema: {
              type: 'object',
              properties: {
                action: {
                  type: 'string',
                  description: '操作类型：build（构建）、deploy（部署）、build_deploy（构建并部署）',
                  enum: ['build', 'deploy', 'build_deploy'],
                  default: 'build',
                },
                project_path: {
                  type: 'string',
                  description: '项目路径（可选，默认为当前目录）',
                },
                build_command: {
                  type: 'string',
                  description: '自定义构建命令（可选，默认根据项目类型自动检测）',
                },
                deploy_target: {
                  type: 'string',
                  description: '部署目标：vercel、netlify、github_pages、custom',
                  enum: ['vercel', 'netlify', 'github_pages', 'custom'],
                },
                deploy_config: {
                  type: 'object',
                  description: '部署配置（根据部署目标不同而不同）',
                },
                environment: {
                  type: 'string',
                  description: '部署环境：development、staging、production',
                  enum: ['development', 'staging', 'production'],
                  default: 'production',
                },
              },
            },
          },
          {
            name: 'search_in_files',
            description: '在文件中搜索文本',
            inputSchema: {
              type: 'object',
              properties: {
                pattern: {
                  type: 'string',
                  description: '要搜索的文本模式',
                },
                path: {
                  type: 'string',
                  description: '要搜索的目录路径（可选，默认为当前目录）',
                },
                filePattern: {
                  type: 'string',
                  description: '文件模式（可选，如 *.js）',
                },
              },
              required: ['pattern'],
            },
          },
          {
            name: 'copy_file',
            description: '复制文件或目录',
            inputSchema: {
              type: 'object',
              properties: {
                source: {
                  type: 'string',
                  description: '源文件或目录路径',
                },
                destination: {
                  type: 'string',
                  description: '目标路径',
                },
                overwrite: {
                  type: 'boolean',
                  description: '是否覆盖已存在的文件（默认为false）',
                },
              },
              required: ['source', 'destination'],
            },
          },
          {
            name: 'move_file',
            description: '移动文件或目录',
            inputSchema: {
              type: 'object',
              properties: {
                source: {
                  type: 'string',
                  description: '源文件或目录路径',
                },
                destination: {
                  type: 'string',
                  description: '目标路径',
                },
                overwrite: {
                  type: 'boolean',
                  description: '是否覆盖已存在的文件（默认为false）',
                },
              },
              required: ['source', 'destination'],
            },
          },
          {
            name: 'delete_file',
            description: '删除文件或目录',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: '要删除的文件或目录路径',
                },
                recursive: {
                  type: 'boolean',
                  description: '是否递归删除目录（默认为false）',
                },
              },
              required: ['path'],
            },
          },
          {
            name: 'file_info',
            description: '获取文件或目录的详细信息',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: '要查询的文件或目录路径',
                },
              },
              required: ['path'],
            },
          },
          {
            name: 'detect_encoding',
            description: '检测文件编码',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: '要检测编码的文件路径',
                },
              },
              required: ['path'],
            },
          },
          {
            name: 'convert_encoding',
            description: '转换文件编码',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: '要转换编码的文件路径',
                },
                from_encoding: {
                  type: 'string',
                  description: '源编码（可选，如果不提供将自动检测）',
                },
                to_encoding: {
                  type: 'string',
                  description: '目标编码（默认为UTF-8）',
                },
                backup: {
                  type: 'boolean',
                  description: '是否创建原文件备份（默认为true）',
                },
              },
              required: ['path'],
            },
          },
          {
            name: 'validate_path',
            description: '验证路径安全性，检查是否存在路径遍历风险',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: '要验证的路径',
                },
                allowed_paths: {
                  type: 'array',
                  description: '允许的基础路径列表，如果不指定则只检查危险字符',
                  items: {
                    type: 'string',
                  },
                },
              },
              required: ['path'],
            },
          },
          {
            name: 'get_operation_log',
            description: '获取操作日志',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'integer',
                  description: '返回的日志条数限制，默认为50',
                  default: 50,
                },
                operation: {
                  type: 'string',
                  description: '筛选特定操作类型的日志',
                },
                user: {
                  type: 'string',
                  description: '筛选特定用户的日志',
                },
              },
            },
          },
          {
            name: 'search_regex',
            description: '使用正则表达式在文件中搜索',
            inputSchema: {
              type: 'object',
              properties: {
                pattern: {
                  type: 'string',
                  description: '要搜索的正则表达式模式',
                },
                path: {
                  type: 'string',
                  description: '要搜索的目录路径（可选，默认为当前目录）',
                },
                file_pattern: {
                  type: 'string',
                  description: '文件模式（可选，如 *.js）',
                },
                case_sensitive: {
                  type: 'boolean',
                  description: '是否区分大小写（默认为false）',
                  default: false,
                },
                max_results: {
                  type: 'integer',
                  description: '最大结果数（默认为100）',
                  default: 100,
                },
                include_line_numbers: {
                  type: 'boolean',
                  description: '是否包含行号（默认为true）',
                  default: true,
                },
                context_lines: {
                  type: 'integer',
                  description: '匹配行前后的上下文行数（默认为0）',
                  default: 0,
                },
              },
              required: ['pattern'],
            },
          },
          {
            name: 'preview_file',
            description: '预览文件内容（前几行或指定范围）',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: '要预览的文件路径',
                },
                start_line: {
                  type: 'integer',
                  description: '起始行号（从1开始，默认为1）',
                  default: 1,
                },
                end_line: {
                  type: 'integer',
                  description: '结束行号（默认为50）',
                  default: 50,
                },
                encoding: {
                  type: 'string',
                  description: '文件编码，默认为"auto"自动检测',
                  default: 'auto',
                },
                highlight_pattern: {
                  type: 'string',
                  description: '要高亮的文本模式（可选）',
                },
              },
              required: ['path'],
            },
          },
          {
            name: 'search_advanced',
            description: '高级搜索，支持多种条件筛选',
            inputSchema: {
              type: 'object',
              properties: {
                pattern: {
                  type: 'string',
                  description: '要搜索的文本模式',
                },
                path: {
                  type: 'string',
                  description: '要搜索的目录路径（可选，默认为当前目录）',
                },
                file_pattern: {
                  type: 'string',
                  description: '文件模式（可选，如 *.js）',
                },
                file_size_min: {
                  type: 'integer',
                  description: '最小文件大小（字节）',
                },
                file_size_max: {
                  type: 'integer',
                  description: '最大文件大小（字节）',
                },
                modified_after: {
                  type: 'string',
                  description: '修改时间晚于此日期（ISO格式，如2023-01-01）',
                },
                modified_before: {
                  type: 'string',
                  description: '修改时间早于此日期（ISO格式，如2023-12-31）',
                },
                exclude_pattern: {
                  type: 'string',
                  description: '要排除的文件模式（如 *.min.js）',
                },
                max_depth: {
                  type: 'integer',
                  description: '最大搜索深度（目录层级）',
                },
                max_results: {
                  type: 'integer',
                  description: '最大结果数（默认为100）',
                  default: 100,
                },
              },
              required: ['pattern'],
            },
          },
          {
            name: 'analyze_code_structure',
            description: '分析JavaScript/TypeScript代码结构，提取函数、类、变量等',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: '要分析的文件路径（必须是绝对路径）',
                },
                encoding: {
                  type: 'string',
                  description: '文件编码，默认为"auto"自动检测',
                  default: 'auto',
                },
                analysis_type: {
                  type: 'string',
                  description: '分析类型：all（全部）、functions（函数）、classes（类）、variables（变量）、dependencies（依赖关系）',
                  enum: ['all', 'functions', 'classes', 'variables', 'dependencies'],
                  default: 'all',
                },
                format: {
                  type: 'string',
                  description: '输出格式：json（JSON格式）或 text（文本格式）',
                  enum: ['json', 'text'],
                  default: 'json',
                },
              },
              required: ['file_path'],
            },
          },
        ],
      };
    });

    // 处理工具调用
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'read_file_advanced':
            return await this.handleReadFileAdvanced(args);
          case 'read_file':
            return await this.handleReadFile(args);
          case 'apply_patch':
            return await this.handleApplyPatch(args);
          case 'grep_files':
            return await this.handleGrepFiles(args);
          case 'update_plan':
            return await this.handleUpdatePlan(args);
          case 'exec_stream':
            return await this.handleExecStream(args);
          case 'write_file':
            return await this.handleWriteFile(args);
          case 'list_directory':
            return await this.handleListDirectory(args);
          case 'execute_command':
            return await this.handleExecuteCommand(args);
          case 'git_status':
            return await this.handleGitStatus(args);
          case 'git_diff':
            return await this.handleGitDiff(args);
          case 'git_commit':
            return await this.handleGitCommit(args);
          case 'git_push':
            return await this.handleGitPush(args);
          case 'git_pull':
            return await this.handleGitPull(args);
          case 'git_branch':
            return await this.handleGitBranch(args);
          case 'project_template':
            return await this.handleProjectTemplate(args);
          case 'manage_dependencies':
            return await this.handleManageDependencies(args);
          case 'build_deploy':
            return await this.handleBuildDeploy(args);
          case 'search_in_files':
            return await this.handleSearchInFiles(args);
          case 'copy_file':
            return await this.handleCopyFile(args);
          case 'move_file':
            return await this.handleMoveFile(args);
          case 'delete_file':
            return await this.handleDeleteFile(args);
          case 'file_info':
            return await this.handleFileInfo(args);
          case 'detect_encoding':
            return await this.handleDetectEncoding(args);
          case 'convert_encoding':
            return await this.handleConvertEncoding(args);
          case 'validate_path':
            return await this.handleValidatePath(args);
          case 'get_operation_log':
            return await this.handleGetOperationLog(args);
          case 'search_regex':
            return await this.handleSearchRegex(args);
          case 'preview_file':
            return await this.handlePreviewFile(args);
          case 'search_advanced':
            return await this.handleSearchAdvanced(args);
          case 'analyze_code_structure':
            return await this.handleAnalyzeCodeStructure(args);
          default:
            throw new Error(`未知工具: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `错误: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async handleReadFileAdvanced(args) {
    const filePath = args.file_path;
    const offset = args.offset || 1;
    const limit = args.limit || 200;
    const mode = args.mode || 'slice';
    const indentation = args.indentation || {};
    const encoding = args.encoding || 'auto';
    const user = args.user || 'unknown';
    
    try {
      // 验证路径必须是绝对路径
      if (!path.isAbsolute(filePath)) {
        throw new Error('file_path必须是绝对路径');
      }
      
      // 验证路径安全性
      const absolutePath = validatePath(filePath);
      
      // 读取文件为Buffer
      const buffer = await fs.readFile(absolutePath);
      
      let content;
      
      if (encoding === 'auto') {
        // 自动检测编码
        const detected = jschardet.detect(buffer);
        
        if (detected.encoding && detected.confidence > 0.5) {
          try {
            content = iconv.decode(buffer, detected.encoding);
          } catch (error) {
            // 如果检测的编码解码失败，回退到UTF-8
            console.error(`使用检测到的编码 ${detected.encoding} 解码失败，回退到UTF-8: ${error.message}`);
            content = buffer.toString('utf8');
          }
        } else {
          // 如果检测置信度低或无法检测，尝试UTF-8
          try {
            content = buffer.toString('utf8');
          } catch (error) {
            // 如果UTF-8也失败，尝试使用系统默认编码
            content = buffer.toString();
          }
        }
      } else {
        // 使用指定的编码
        try {
          if (encoding === 'utf8' || encoding === 'utf-8') {
            content = buffer.toString('utf8');
          } else {
            content = iconv.decode(buffer, encoding);
          }
        } catch (error) {
          throw new Error(`使用 ${encoding} 编码读取文件失败: ${error.message}`);
        }
      }
      
      // 按行分割内容
      const lines = content.split('\n');
      
      let result;
      
      if (mode === 'slice') {
        // 简单切片模式
        const startIdx = Math.max(0, offset - 1);
        const endIdx = Math.min(lines.length, startIdx + limit);
        result = lines.slice(startIdx, endIdx).join('\n');
      } else if (mode === 'indentation') {
        // 缩进感知模式
        result = this.readWithIndentationAwareness(lines, offset, limit, indentation);
      } else {
        throw new Error(`不支持的读取模式: ${mode}`);
      }
      
      // 记录操作日志
      logOperation('read_file_advanced', absolutePath, user, true, `模式: ${mode}, 编码: ${encoding}`);
      
      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error) {
      // 记录操作日志
      logOperation('read_file_advanced', filePath, user, false, error.message);
      throw new Error(`高级文件读取失败: ${error.message}`);
    }
  }

  readWithIndentationAwareness(lines, offset, limit, indentation) {
    const anchorLine = indentation.anchor_line || offset;
    const maxLevels = indentation.max_levels || 0;
    const includeSiblings = indentation.include_siblings || false;
    const includeHeader = indentation.include_header || false;
    const maxLines = indentation.max_lines || limit;
    
    // 确保锚点行在有效范围内
    if (anchorLine < 1 || anchorLine > lines.length) {
      throw new Error(`锚点行号 ${anchorLine} 超出文件范围 (1-${lines.length})`);
    }
    
    // 分析每行的缩进级别
    const lineRecords = lines.map((line, index) => {
      const trimmed = line.trimStart();
      const indent = line.length - trimmed.length;
      const isBlank = trimmed.length === 0;
      const isComment = trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('--');
      
      return {
        number: index + 1,
        raw: line,
        trimmed,
        indent,
        isBlank,
        isComment
      };
    });
    
    // 获取锚点行的缩进级别
    const anchorRecord = lineRecords[anchorLine - 1];
    const anchorIndent = anchorRecord.indent;
    
    // 收集相关行
    const collected = [];
    let currentLevel = 0;
    
    // 如果需要包含头信息，向上查找非空行
    if (includeHeader) {
      for (let i = anchorLine - 2; i >= 0 && collected.length < maxLines / 4; i--) {
        const record = lineRecords[i];
        if (!record.isBlank && !record.isComment) {
          collected.unshift(record);
        } else if (record.isBlank && collected.length > 0) {
          collected.unshift(record);
        }
      }
    }
    
    // 添加锚点行
    collected.push(anchorRecord);
    
    // 向下查找缩进相关的行
    for (let i = anchorLine; i < lineRecords.length && collected.length < maxLines; i++) {
      const record = lineRecords[i];
      
      // 跳过锚点行，已经添加
      if (record.number === anchorLine) continue;
      
      // 如果是空行，总是包含
      if (record.isBlank) {
        collected.push(record);
        continue;
      }
      
      // 计算相对缩进级别
      const relativeIndent = record.indent - anchorIndent;
      
      // 如果缩进级别增加，且在允许的最大级别内
      if (relativeIndent > currentLevel && (maxLevels === 0 || currentLevel < maxLevels)) {
        currentLevel = relativeIndent;
        collected.push(record);
      }
      // 如果缩进级别回到当前级别或更低
      else if (relativeIndent <= currentLevel) {
        currentLevel = relativeIndent;
        
        // 如果是同级且需要包含兄弟块
        if (relativeIndent === 0 && includeSiblings) {
          collected.push(record);
        }
        // 如果缩进回到锚点级别或更低，停止收集
        else if (relativeIndent <= 0) {
          break;
        }
      }
    }
    
    // 转换回文本
    return collected.map(record => record.raw).join('\n');
  }

  async handleExecStream(args) {
    const command = args.command;
    const cwd = args.cwd || process.cwd();
    const env = args.env || {};
    const timeout = args.timeout || 300000; // 默认5分钟
    const shell = args.shell !== false; // 默认为true
    const streamOutput = args.stream_output !== false; // 默认为true
    const captureOutput = args.capture_output !== false; // 默认为true
    const killOnTimeout = args.kill_on_timeout !== false; // 默认为true
    const user = args.user || 'unknown';
    
    // 生成唯一的会话ID
    const sessionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    try {
      // 验证工作目录
      const validatedCwd = validatePath(cwd);
      
      // 准备环境变量
      const processEnv = { ...process.env, ...env };
      
      // 创建子进程
      const { spawn } = require('child_process');
      
      const options = {
        cwd: validatedCwd,
        env: processEnv,
        shell: shell,
        stdio: streamOutput ? ['pipe', 'pipe', 'pipe'] : 'pipe'
      };
      
      const childProcess = spawn(command, [], options);
      
      // 存储输出
      let stdout = '';
      let stderr = '';
      let isCompleted = false;
      let exitCode = null;
      
      // 设置超时
      let timeoutId;
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          if (!isCompleted) {
            if (killOnTimeout) {
              childProcess.kill('SIGTERM');
            }
            isCompleted = true;
            exitCode = -1;
          }
        }, timeout);
      }
      
      // 处理流式输出
      if (streamOutput) {
        childProcess.stdout.on('data', (data) => {
          const output = data.toString();
          if (captureOutput) {
            stdout += output;
          }
          
          // 发送流式输出
          this.sendStreamOutput(sessionId, 'stdout', output);
        });
        
        childProcess.stderr.on('data', (data) => {
          const output = data.toString();
          if (captureOutput) {
            stderr += output;
          }
          
          // 发送流式输出
          this.sendStreamOutput(sessionId, 'stderr', output);
        });
      } else {
        // 即使不流式输出，也需要捕获输出
        childProcess.stdout.on('data', (data) => {
          if (captureOutput) {
            stdout += data.toString();
          }
        });
        
        childProcess.stderr.on('data', (data) => {
          if (captureOutput) {
            stderr += data.toString();
          }
        });
      }
      
      // 处理进程完成
      childProcess.on('close', (code, signal) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        isCompleted = true;
        exitCode = code;
        
        // 发送完成通知
        this.sendStreamComplete(sessionId, code, signal, stdout, stderr);
        
        // 记录操作日志
        logOperation('exec_stream', validatedCwd, user, true, `命令: ${command}, 退出码: ${code}`);
      });
      
      // 处理错误
      childProcess.on('error', (error) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        isCompleted = true;
        exitCode = -1;
        
        // 记录操作日志
        logOperation('exec_stream', validatedCwd, user, false, error.message);
        
        // 发送错误通知
        this.sendStreamError(sessionId, error.message);
      });
      
      // 存储进程引用以便后续管理
      if (!this.activeProcesses) {
        this.activeProcesses = new Map();
      }
      this.activeProcesses.set(sessionId, {
        process: childProcess,
        command,
        cwd: validatedCwd,
        startTime: Date.now(),
        user
      });
      
      // 返回会话信息
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              session_id: sessionId,
              command,
              cwd: validatedCwd,
              pid: childProcess.pid,
              status: 'started'
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      logOperation('exec_stream', cwd, user, false, error.message);
      throw new Error(`命令执行失败: ${error.message}`);
    }
  }
  
  // 发送流式输出
  sendStreamOutput(sessionId, stream, data) {
    // 在实际实现中，这里应该通过MCP协议发送通知
    // 由于当前环境限制，我们暂时只记录日志
    console.log(`[${sessionId}] ${stream}:`, data);
  }
  
  // 发送流式完成通知
  sendStreamComplete(sessionId, exitCode, signal, stdout, stderr) {
    // 在实际实现中，这里应该通过MCP协议发送通知
    console.log(`[${sessionId}] 完成: 退出码=${exitCode}, 信号=${signal}`);
    
    // 清理进程引用
    if (this.activeProcesses && this.activeProcesses.has(sessionId)) {
      this.activeProcesses.delete(sessionId);
    }
  }
  
  // 发送流式错误通知
  sendStreamError(sessionId, error) {
    // 在实际实现中，这里应该通过MCP协议发送通知
    console.error(`[${sessionId}] 错误:`, error);
    
    // 清理进程引用
    if (this.activeProcesses && this.activeProcesses.has(sessionId)) {
      this.activeProcesses.delete(sessionId);
    }
  }

  async handleUpdatePlan(args) {
    const action = args.action;
    const planId = args.plan_id;
    const user = args.user || 'unknown';
    
    // 计划文件存储路径
    const plansDir = path.join(process.cwd(), '.codex_plans');
    
    // 确保计划目录存在
    if (!fs.existsSync(plansDir)) {
      fs.mkdirSync(plansDir, { recursive: true });
    }
    
    try {
      let plan;
      let planFile;
      
      // 如果是更新现有计划，先加载计划
      if (planId && ['update', 'add_task', 'update_task', 'delete_task', 'complete', 'archive'].includes(action)) {
        planFile = path.join(plansDir, `${planId}.json`);
        
        if (!fs.existsSync(planFile)) {
          throw new Error(`计划ID ${planId} 不存在`);
        }
        
        const planData = fs.readFileSync(planFile, 'utf8');
        plan = JSON.parse(planData);
      }
      
      switch (action) {
        case 'create':
          // 创建新计划
          if (!args.title) {
            throw new Error('创建计划需要提供标题');
          }
          
          const newPlanId = planId || `plan_${Date.now()}`;
          planFile = path.join(plansDir, `${newPlanId}.json`);
          
          if (fs.existsSync(planFile)) {
            throw new Error(`计划ID ${newPlanId} 已存在`);
          }
          
          plan = {
            id: newPlanId,
            title: args.title,
            description: args.description || '',
            tasks: args.tasks || [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: user,
            status: 'active'
          };
          
          fs.writeFileSync(planFile, JSON.stringify(plan, null, 2));
          
          logOperation('update_plan', plansDir, user, true, `创建新计划: ${newPlanId}`);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: `计划 "${plan.title}" 创建成功`,
                  plan_id: plan.id
                }, null, 2)
              }
            ]
          };
          
        case 'update':
          // 更新计划基本信息
          if (!plan) {
            throw new Error('计划不存在');
          }
          
          if (args.title) plan.title = args.title;
          if (args.description !== undefined) plan.description = args.description;
          if (args.tasks) plan.tasks = args.tasks;
          
          plan.updated_at = new Date().toISOString();
          
          fs.writeFileSync(planFile, JSON.stringify(plan, null, 2));
          
          logOperation('update_plan', plansDir, user, true, `更新计划: ${planId}`);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: `计划 "${plan.title}" 更新成功`,
                  plan_id: plan.id
                }, null, 2)
              }
            ]
          };
          
        case 'add_task':
          // 添加任务到计划
          if (!plan) {
            throw new Error('计划不存在');
          }
          
          if (!args.tasks || !Array.isArray(args.tasks) || args.tasks.length === 0) {
            throw new Error('添加任务需要提供任务列表');
          }
          
          for (const task of args.tasks) {
            if (!task.id || !task.title || !task.status || !task.priority) {
              throw new Error('任务必须包含id、title、status和priority字段');
            }
            
            // 检查任务ID是否已存在
            if (plan.tasks.some(t => t.id === task.id)) {
              throw new Error(`任务ID ${task.id} 已存在`);
            }
            
            // 添加创建时间
            task.created_at = new Date().toISOString();
            task.created_by = user;
            
            plan.tasks.push(task);
          }
          
          plan.updated_at = new Date().toISOString();
          
          fs.writeFileSync(planFile, JSON.stringify(plan, null, 2));
          
          logOperation('update_plan', plansDir, user, true, `添加任务到计划: ${planId}`);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: `成功添加 ${args.tasks.length} 个任务到计划 "${plan.title}"`,
                  plan_id: plan.id,
                  added_tasks: args.tasks.map(t => t.id)
                }, null, 2)
              }
            ]
          };
          
        case 'update_task':
          // 更新计划中的特定任务
          if (!plan) {
            throw new Error('计划不存在');
          }
          
          if (!args.task_id) {
            throw new Error('更新任务需要提供task_id');
          }
          
          if (!args.task_updates) {
            throw new Error('更新任务需要提供task_updates');
          }
          
          const taskIndex = plan.tasks.findIndex(t => t.id === args.task_id);
          if (taskIndex === -1) {
            throw new Error(`任务ID ${args.task_id} 不存在`);
          }
          
          // 更新任务属性
          const task = plan.tasks[taskIndex];
          Object.assign(task, args.task_updates);
          task.updated_at = new Date().toISOString();
          task.updated_by = user;
          
          plan.updated_at = new Date().toISOString();
          
          fs.writeFileSync(planFile, JSON.stringify(plan, null, 2));
          
          logOperation('update_plan', plansDir, user, true, `更新任务: ${args.task_id} 在计划: ${planId}`);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: `任务 "${task.title}" 更新成功`,
                  plan_id: plan.id,
                  task_id: task.id
                }, null, 2)
              }
            ]
          };
          
        case 'delete_task':
          // 从计划中删除任务
          if (!plan) {
            throw new Error('计划不存在');
          }
          
          if (!args.task_id) {
            throw new Error('删除任务需要提供task_id');
          }
          
          const taskToDeleteIndex = plan.tasks.findIndex(t => t.id === args.task_id);
          if (taskToDeleteIndex === -1) {
            throw new Error(`任务ID ${args.task_id} 不存在`);
          }
          
          const deletedTask = plan.tasks.splice(taskToDeleteIndex, 1)[0];
          plan.updated_at = new Date().toISOString();
          
          fs.writeFileSync(planFile, JSON.stringify(plan, null, 2));
          
          logOperation('update_plan', plansDir, user, true, `删除任务: ${args.task_id} 从计划: ${planId}`);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: `任务 "${deletedTask.title}" 删除成功`,
                  plan_id: plan.id,
                  deleted_task_id: deletedTask.id
                }, null, 2)
              }
            ]
          };
          
        case 'complete':
          // 标记计划为完成
          if (!plan) {
            throw new Error('计划不存在');
          }
          
          plan.status = 'completed';
          plan.completed_at = new Date().toISOString();
          plan.updated_at = new Date().toISOString();
          
          fs.writeFileSync(planFile, JSON.stringify(plan, null, 2));
          
          logOperation('update_plan', plansDir, user, true, `完成计划: ${planId}`);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: `计划 "${plan.title}" 已标记为完成`,
                  plan_id: plan.id
                }, null, 2)
              }
            ]
          };
          
        case 'archive':
          // 归档计划
          if (!plan) {
            throw new Error('计划不存在');
          }
          
          plan.status = 'archived';
          plan.archived_at = new Date().toISOString();
          plan.updated_at = new Date().toISOString();
          
          fs.writeFileSync(planFile, JSON.stringify(plan, null, 2));
          
          logOperation('update_plan', plansDir, user, true, `归档计划: ${planId}`);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: `计划 "${plan.title}" 已归档`,
                  plan_id: plan.id
                }, null, 2)
              }
            ]
          };
          
        default:
          throw new Error(`未知的操作类型: ${action}`);
      }
    } catch (error) {
      logOperation('update_plan', plansDir, user, false, error.message);
      throw new Error(`计划操作失败: ${error.message}`);
    }
  }

  async handleGrepFiles(args) {
    const pattern = args.pattern;
    const searchPath = args.path || process.cwd();
    const includePattern = args.include_pattern;
    const excludePattern = args.exclude_pattern;
    const maxResults = args.max_results || 100;
    const contextLines = args.context_lines || 0;
    const caseSensitive = args.case_sensitive || false;
    const wholeWord = args.whole_word || false;
    const isRegex = args.regex !== false; // 默认为true
    const maxDepth = args.max_depth;
    const timeout = args.timeout || 30000;
    const user = args.user || 'unknown';
    
    try {
      // 验证路径安全性
      const absolutePath = validatePath(searchPath);
      
      // 构建ripgrep命令参数
      const rgArgs = [];
      
      // 添加模式
      rgArgs.push(pattern);
      
      // 添加搜索路径
      rgArgs.push(absolutePath);
      
      // 添加选项
      if (!caseSensitive) {
        rgArgs.push('--ignore-case');
      }
      
      if (wholeWord) {
        rgArgs.push('--word-regexp');
      }
      
      if (!isRegex) {
        rgArgs.push('--fixed-strings');
      }
      
      if (contextLines > 0) {
        rgArgs.push('--context', contextLines.toString());
      }
      
      if (maxResults > 0) {
        rgArgs.push('--max-count', maxResults.toString());
      }
      
      if (includePattern) {
        rgArgs.push('--glob', includePattern);
      }
      
      if (excludePattern) {
        rgArgs.push('--glob', `!${excludePattern}`);
      }
      
      if (maxDepth !== undefined) {
        rgArgs.push('--max-depth', maxDepth.toString());
      }
      
      // 输出格式：JSON
      rgArgs.push('--json');
      
      // 不显示匹配计数
      rgArgs.push('--no-heading');
      
      // 执行ripgrep命令
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      // 设置超时
      const options = {
        timeout: timeout,
        maxBuffer: 1024 * 1024 * 10 // 10MB 缓冲区
      };
      
      const { stdout, stderr } = await execAsync(`rg ${rgArgs.join(' ')}`, options);
      
      if (stderr && !stderr.includes('warning')) {
        throw new Error(`ripgrep错误: ${stderr}`);
      }
      
      // 解析JSON输出
      const results = [];
      const lines = stdout.trim().split('\n');
      
      for (const line of lines) {
        if (!line) continue;
        
        try {
          const match = JSON.parse(line);
          
          // 只处理数据行，跳过其他类型的消息
          if (match.type === 'match') {
            const file = match.data.path;
            const lineNumber = match.data.line_number;
            const lineText = match.data.lines.text || match.data.lines;
            const submatches = match.data.submatches || [];
            
            // 提取匹配的文本和位置
            const matches = submatches.map(submatch => ({
              text: submatch.match.text,
              start: submatch.start,
              end: submatch.end
            }));
            
            results.push({
              file,
              line: lineNumber,
              text: lineText,
              matches
            });
          }
        } catch (parseError) {
          console.error('解析ripgrep输出失败:', parseError.message);
        }
      }
      
      // 记录操作日志
      logOperation('grep_files', searchPath, user, true, `模式: ${pattern}, 结果数: ${results.length}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              pattern,
              path: searchPath,
              total_results: results.length,
              results
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      // 记录操作日志
      logOperation('grep_files', searchPath, user, false, error.message);
      
      // 如果是ripgrep未找到的错误，返回空结果而不是错误
      if (error.message.includes('No such file or directory') || 
          error.code === 'ENOENT' || 
          (error.stderr && error.stderr.includes('No files were searched'))) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                pattern,
                path: searchPath,
                total_results: 0,
                results: [],
                message: '没有找到匹配的结果'
              }, null, 2)
            }
          ]
        };
      }
      
      throw new Error(`文件搜索失败: ${error.message}`);
    }
  }

  async handleApplyPatch(args) {
    const patches = args.patches;
    const user = args.user || 'unknown';
    
    if (!Array.isArray(patches) || patches.length === 0) {
      throw new Error('补丁列表不能为空');
    }
    
    const results = [];
    
    for (const patch of patches) {
      const { type, path: filePath, new_path, content, old_str, new_str, encoding, create_dirs, backup } = patch;
      
      try {
        // 验证路径安全性
        const absolutePath = validatePath(filePath);
        
        let result = {
          type,
          path: filePath,
          success: false,
          message: ''
        };
        
        switch (type) {
          case 'add':
            result = await this.applyAddPatch(absolutePath, content, encoding, create_dirs, backup, user);
            break;
            
          case 'delete':
            result = await this.applyDeletePatch(absolutePath, user);
            break;
            
          case 'update':
            if (old_str !== undefined && new_str !== undefined) {
              // 字符串替换更新
              result = await this.applyUpdateStringPatch(absolutePath, old_str, new_str, encoding, backup, user);
            } else if (content !== undefined) {
              // 完整内容替换
              result = await this.applyUpdateContentPatch(absolutePath, content, encoding, backup, user);
            } else {
              throw new Error('更新补丁必须提供old_str/new_str或content');
            }
            break;
            
          case 'move':
            if (!new_path) {
              throw new Error('移动补丁必须提供new_path');
            }
            const absoluteNewPath = validatePath(new_path);
            result = await this.applyMovePatch(absolutePath, absoluteNewPath, user);
            break;
            
          default:
            throw new Error(`不支持的补丁类型: ${type}`);
        }
        
        results.push(result);
      } catch (error) {
        results.push({
          type,
          path: filePath,
          success: false,
          message: error.message
        });
        
        // 记录操作日志
        logOperation(`apply_patch_${type}`, filePath, user, false, error.message);
      }
    }
    
    // 统计成功和失败的补丁
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    
    // 记录整体操作日志
    logOperation('apply_patch', 'multiple_files', user, true, `成功: ${successCount}, 失败: ${failCount}`);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: {
              total: results.length,
              success: successCount,
              failed: failCount
            },
            results
          }, null, 2)
        }
      ]
    };
  }

  async applyAddPatch(filePath, content, encoding, createDirs, backup, user) {
    try {
      // 检查文件是否已存在
      if (await fs.pathExists(filePath)) {
        throw new Error('文件已存在');
      }
      
      // 如果需要，创建目录
      if (createDirs) {
        const dir = path.dirname(filePath);
        await fs.ensureDir(dir);
      }
      
      // 写入文件
      await this.writeFileWithEncoding(filePath, content || '', encoding || 'utf8', backup);
      
      // 记录操作日志
      logOperation('apply_patch_add', filePath, user, true);
      
      return {
        type: 'add',
        path: filePath,
        success: true,
        message: '文件添加成功'
      };
    } catch (error) {
      return {
        type: 'add',
        path: filePath,
        success: false,
        message: error.message
      };
    }
  }

  async applyDeletePatch(filePath, user) {
    try {
      // 检查文件是否存在
      if (!await fs.pathExists(filePath)) {
        throw new Error('文件不存在');
      }
      
      // 删除文件
      await fs.remove(filePath);
      
      // 记录操作日志
      logOperation('apply_patch_delete', filePath, user, true);
      
      return {
        type: 'delete',
        path: filePath,
        success: true,
        message: '文件删除成功'
      };
    } catch (error) {
      return {
        type: 'delete',
        path: filePath,
        success: false,
        message: error.message
      };
    }
  }

  async applyUpdateStringPatch(filePath, oldStr, newStr, encoding, backup, user) {
    try {
      // 检查文件是否存在
      if (!await fs.pathExists(filePath)) {
        throw new Error('文件不存在');
      }
      
      // 读取文件内容
      const content = await this.readFileWithEncoding(filePath, encoding || 'utf8');
      
      // 检查旧字符串是否存在
      if (!content.includes(oldStr)) {
        throw new Error('文件中未找到要替换的字符串');
      }
      
      // 替换字符串
      const newContent = content.replace(oldStr, newStr);
      
      // 写入文件
      await this.writeFileWithEncoding(filePath, newContent, encoding || 'utf8', backup);
      
      // 记录操作日志
      logOperation('apply_patch_update_string', filePath, user, true);
      
      return {
        type: 'update',
        path: filePath,
        success: true,
        message: '字符串替换成功'
      };
    } catch (error) {
      return {
        type: 'update',
        path: filePath,
        success: false,
        message: error.message
      };
    }
  }

  async applyUpdateContentPatch(filePath, content, encoding, backup, user) {
    try {
      // 检查文件是否存在
      if (!await fs.pathExists(filePath)) {
        throw new Error('文件不存在');
      }
      
      // 写入文件
      await this.writeFileWithEncoding(filePath, content || '', encoding || 'utf8', backup);
      
      // 记录操作日志
      logOperation('apply_patch_update_content', filePath, user, true);
      
      return {
        type: 'update',
        path: filePath,
        success: true,
        message: '文件内容更新成功'
      };
    } catch (error) {
      return {
        type: 'update',
        path: filePath,
        success: false,
        message: error.message
      };
    }
  }

  async applyMovePatch(filePath, newPath, user) {
    try {
      // 检查源文件是否存在
      if (!await fs.pathExists(filePath)) {
        throw new Error('源文件不存在');
      }
      
      // 检查目标文件是否已存在
      if (await fs.pathExists(newPath)) {
        throw new Error('目标位置已存在文件');
      }
      
      // 确保目标目录存在
      const dir = path.dirname(newPath);
      await fs.ensureDir(dir);
      
      // 移动文件
      await fs.move(filePath, newPath);
      
      // 记录操作日志
      logOperation('apply_patch_move', `${filePath} -> ${newPath}`, user, true);
      
      return {
        type: 'move',
        path: filePath,
        new_path: newPath,
        success: true,
        message: '文件移动成功'
      };
    } catch (error) {
      return {
        type: 'move',
        path: filePath,
        new_path: newPath,
        success: false,
        message: error.message
      };
    }
  }

  async readFileWithEncoding(filePath, encoding) {
    const buffer = await fs.readFile(filePath);
    
    if (encoding === 'utf8' || encoding === 'utf-8') {
      return buffer.toString('utf8');
    } else {
      return iconv.decode(buffer, encoding);
    }
  }

  async writeFileWithEncoding(filePath, content, encoding, backup) {
    // 如果需要备份
    if (backup && await fs.pathExists(filePath)) {
      const backupPath = `${filePath}.backup.${Date.now()}`;
      await fs.copy(filePath, backupPath);
    }
    
    // 确保目录存在
    const dir = path.dirname(filePath);
    await fs.ensureDir(dir);
    
    // 写入文件
    if (encoding === 'utf8' || encoding === 'utf-8') {
      await fs.writeFile(filePath, content, 'utf8');
    } else {
      const buffer = iconv.encode(content, encoding);
      await fs.writeFile(filePath, buffer);
    }
  }

  async handleReadFile(args) {
    const filePath = args.path;
    const encoding = args.encoding || 'auto'; // 默认自动检测编码
    const user = args.user || 'unknown';
    
    try {
      // 验证路径安全性
      const absolutePath = validatePath(filePath);
      
      // 读取文件为Buffer
      const buffer = await fs.readFile(absolutePath);
      
      let content;
      
      if (encoding === 'auto') {
        // 自动检测编码
        const detected = jschardet.detect(buffer);
        
        if (detected.encoding && detected.confidence > 0.5) {
          try {
            content = iconv.decode(buffer, detected.encoding);
          } catch (error) {
            // 如果检测的编码解码失败，回退到UTF-8
            console.error(`使用检测到的编码 ${detected.encoding} 解码失败，回退到UTF-8: ${error.message}`);
            content = buffer.toString('utf8');
          }
        } else {
          // 如果检测置信度低或无法检测，尝试UTF-8
          try {
            content = buffer.toString('utf8');
          } catch (error) {
            // 如果UTF-8也失败，尝试使用系统默认编码
            content = buffer.toString();
          }
        }
      } else {
        // 使用指定的编码
        try {
          if (encoding === 'utf8' || encoding === 'utf-8') {
            content = buffer.toString('utf8');
          } else {
            content = iconv.decode(buffer, encoding);
          }
        } catch (error) {
          throw new Error(`使用 ${encoding} 编码读取文件失败: ${error.message}`);
        }
      }
      
      // 记录操作日志
      logOperation('read_file', absolutePath, user, true, `编码: ${encoding}`);
      
      return {
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
      };
    } catch (error) {
      // 记录操作日志
      logOperation('read_file', filePath, user, false, error.message);
      throw new Error(`读取文件失败: ${error.message}`);
    }
  }

  async handleWriteFile(args) {
    const filePath = args.path;
    const content = args.content;
    const encoding = args.encoding || 'utf8'; // 默认UTF-8编码
    const backup = args.backup || false; // 默认不备份
    const user = args.user || 'unknown';
    
    try {
      // 验证路径安全性
      const absolutePath = validatePath(filePath);
      
      // 如果需要备份，先创建备份
      if (backup) {
        try {
          await fs.access(absolutePath);
          const backupPath = `${absolutePath}.backup.${Date.now()}`;
          await fs.copyFile(absolutePath, backupPath);
        } catch (error) {
          // 如果文件不存在，不需要备份
        }
      }
      
      // 确保目录存在
      const dir = path.dirname(absolutePath);
      await fs.mkdir(dir, { recursive: true });
      
      // 根据编码写入文件
      let buffer;
      if (encoding === 'utf8' || encoding === 'utf-8') {
        buffer = Buffer.from(content, 'utf8');
      } else {
        // 使用iconv-lite进行编码转换
        buffer = iconv.encode(content, encoding);
      }
      
      await fs.writeFile(absolutePath, buffer);
      
      // 记录操作日志
      logOperation('write_file', absolutePath, user, true, `编码: ${encoding}, 备份: ${backup}`);
      
      return {
        content: [
          {
            type: 'text',
            text: `成功写入文件: ${absolutePath} (编码: ${encoding}${backup ? ', 已创建备份' : ''})`,
          },
        ],
      };
    } catch (error) {
      // 记录操作日志
      logOperation('write_file', filePath, user, false, error.message);
      throw new Error(`写入文件失败: ${error.message}`);
    }
  }

  async handleListDirectory(args) {
    const dirPath = args.path;
    const user = args.user || 'unknown';
    
    try {
      // 验证路径安全性
      const absolutePath = validatePath(dirPath);
      
      const entries = await fs.readdir(absolutePath, { withFileTypes: true });
      const result = entries.map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
      }));
      
      // 记录操作日志
      logOperation('list_directory', absolutePath, user, true, `条目数: ${result.length}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      // 记录操作日志
      logOperation('list_directory', dirPath, user, false, error.message);
      throw new Error(`列出目录失败: ${error.message}`);
    }
  }

  async handleExecuteCommand(args) {
    const { command, cwd } = args;
    try {
      const options = cwd ? { cwd: path.resolve(cwd) } : {};
      const { stdout, stderr } = await execAsync(command, options);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout || (stderr ? `警告: ${stderr}` : '命令执行成功，无输出'),
          },
        ],
      };
    } catch (error) {
      throw new Error(`命令执行失败: ${error.message}`);
    }
  }

  async handleGitStatus(args) {
    const repoPath = args.path || process.cwd();
    try {
      const options = { cwd: path.resolve(repoPath) };
      const { stdout, stderr } = await execAsync('git status', options);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout || (stderr ? `警告: ${stderr}` : 'Git状态获取成功，无输出'),
          },
        ],
      };
    } catch (error) {
      throw new Error(`获取Git状态失败: ${error.message}`);
    }
  }

  async handleGitDiff(args) {
    const { path: repoPath, file } = args;
    const cwd = repoPath ? path.resolve(repoPath) : process.cwd();
    
    try {
      const command = file ? `git diff -- ${file}` : 'git diff';
      const options = { cwd };
      const { stdout, stderr } = await execAsync(command, options);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout || (stderr ? `警告: ${stderr}` : 'Git差异获取成功，无输出'),
          },
        ],
      };
    } catch (error) {
      throw new Error(`获取Git差异失败: ${error.message}`);
    }
  }

  async handleGitCommit(args) {
    const { 
      path: repoPath, 
      message, 
      files, 
      add_all = true,
      user = 'unknown'
    } = args;
    const cwd = repoPath ? path.resolve(repoPath) : process.cwd();
    
    try {
      // 添加文件到暂存区
      if (add_all) {
        // 添加所有更改的文件
        await execAsync('git add -A', { cwd });
      } else if (files && files.length > 0) {
        // 添加指定的文件
        for (const file of files) {
          await execAsync(`git add "${file}"`, { cwd });
        }
      }
      
      // 提交更改
      const { stdout, stderr } = await execAsync(`git commit -m "${message}"`, { cwd });
      
      // 记录操作日志
      logOperation('git_commit', cwd, user, true, `消息: ${message}`);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout || (stderr ? `警告: ${stderr}` : 'Git提交成功，无输出'),
          },
        ],
      };
    } catch (error) {
      // 记录操作日志
      logOperation('git_commit', repoPath || '当前目录', user, false, error.message);
      throw new Error(`Git提交失败: ${error.message}`);
    }
  }

  async handleGitPush(args) {
    const { 
      path: repoPath, 
      remote = 'origin', 
      branch, 
      force = false,
      user = 'unknown'
    } = args;
    const cwd = repoPath ? path.resolve(repoPath) : process.cwd();
    
    try {
      // 如果没有指定分支，获取当前分支
      let targetBranch = branch;
      if (!targetBranch) {
        const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd });
        targetBranch = stdout.trim();
      }
      
      // 构建推送命令
      const forceFlag = force ? '--force' : '';
      const command = `git push ${forceFlag} ${remote} ${targetBranch}`;
      
      const { stdout, stderr } = await execAsync(command, { cwd });
      
      // 记录操作日志
      logOperation('git_push', cwd, user, true, `远程: ${remote}, 分支: ${targetBranch}, 强制: ${force}`);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout || (stderr ? `警告: ${stderr}` : 'Git推送成功，无输出'),
          },
        ],
      };
    } catch (error) {
      // 记录操作日志
      logOperation('git_push', repoPath || '当前目录', user, false, error.message);
      throw new Error(`Git推送失败: ${error.message}`);
    }
  }

  async handleGitPull(args) {
    const { 
      path: repoPath, 
      remote = 'origin', 
      branch,
      user = 'unknown'
    } = args;
    const cwd = repoPath ? path.resolve(repoPath) : process.cwd();
    
    try {
      // 如果没有指定分支，获取当前分支
      let targetBranch = branch;
      if (!targetBranch) {
        const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd });
        targetBranch = stdout.trim();
      }
      
      // 构建拉取命令
      const command = `git pull ${remote} ${targetBranch}`;
      
      const { stdout, stderr } = await execAsync(command, { cwd });
      
      // 记录操作日志
      logOperation('git_pull', cwd, user, true, `远程: ${remote}, 分支: ${targetBranch}`);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout || (stderr ? `警告: ${stderr}` : 'Git拉取成功，无输出'),
          },
        ],
      };
    } catch (error) {
      // 记录操作日志
      logOperation('git_pull', repoPath || '当前目录', user, false, error.message);
      throw new Error(`Git拉取失败: ${error.message}`);
    }
  }

  async handleGitBranch(args) {
    const { 
      path: repoPath, 
      action = 'list', 
      name, 
      force = false,
      user = 'unknown'
    } = args;
    const cwd = repoPath ? path.resolve(repoPath) : process.cwd();
    
    try {
      let command;
      let operationDesc = '';
      
      switch (action) {
        case 'list':
          command = 'git branch -a';
          operationDesc = '列出分支';
          break;
          
        case 'create':
          if (!name) {
            throw new Error('创建分支需要指定分支名称');
          }
          command = `git branch ${name}`;
          operationDesc = `创建分支: ${name}`;
          break;
          
        case 'delete':
          if (!name) {
            throw new Error('删除分支需要指定分支名称');
          }
          const forceFlag = force ? '-D' : '-d';
          command = `git branch ${forceFlag} ${name}`;
          operationDesc = `删除分支: ${name} (强制: ${force})`;
          break;
          
        case 'checkout':
          if (!name) {
            throw new Error('切换分支需要指定分支名称');
          }
          command = `git checkout ${name}`;
          operationDesc = `切换到分支: ${name}`;
          break;
          
        default:
          throw new Error(`未知的分支操作: ${action}`);
      }
      
      const { stdout, stderr } = await execAsync(command, { cwd });
      
      // 记录操作日志
      logOperation('git_branch', cwd, user, true, operationDesc);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout || (stderr ? `警告: ${stderr}` : 'Git分支操作成功，无输出'),
          },
        ],
      };
    } catch (error) {
      // 记录操作日志
      logOperation('git_branch', repoPath || '当前目录', user, false, error.message);
      throw new Error(`Git分支操作失败: ${error.message}`);
    }
  }

  async handleSearchInFiles(args) {
    const { pattern, path: searchPath, filePattern } = args;
    const cwd = searchPath ? path.resolve(searchPath) : process.cwd();
    
    try {
      // Windows下使用findstr，Unix/Linux/Mac下使用grep
      const isWindows = process.platform === 'win32';
      let command;
      
      if (isWindows) {
        command = `findstr /s /i "${pattern}"`;
        if (filePattern) {
          // Windows的findstr不支持文件模式过滤，需要额外处理
          command = `for /r %i in (${filePattern}) do @findstr /i /m "${pattern}" "%i" 2>nul`;
        }
      } else {
        command = `grep -r "${pattern}"`;
        if (filePattern) {
          command += ` --include="${filePattern}"`;
        }
      }
      
      const options = { cwd };
      const { stdout, stderr } = await execAsync(command, options);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout || (stderr ? `警告: ${stderr}` : '搜索完成，无匹配结果'),
          },
        ],
      };
    } catch (error) {
      // 在无匹配时，命令会返回非零退出码
      if (error.signal === 'SIGTERM' || error.code === 1) {
        return {
          content: [
            {
              type: 'text',
              text: '搜索完成，无匹配结果',
            },
          ],
        };
      }
      throw new Error(`搜索失败: ${error.message}`);
    }
  }

  async handleCopyFile(args) {
    const { source, destination, overwrite = false } = args;
    const user = args.user || 'unknown';
    
    try {
      // 验证路径安全性
      const sourcePath = validatePath(source);
      const destPath = validatePath(destination);
      
      // 检查源文件是否存在
      try {
        await fs.access(sourcePath);
      } catch (error) {
        throw new Error(`源文件不存在: ${sourcePath}`);
      }
      
      // 检查目标文件是否存在且不允许覆盖
      if (!overwrite) {
        try {
          await fs.access(destPath);
          throw new Error(`目标文件已存在且不允许覆盖: ${destPath}`);
        } catch (error) {
          // 如果文件不存在，继续执行
          if (error.code !== 'ENOENT') {
            throw error;
          }
        }
      }
      
      // 获取源文件信息
      const stats = await fs.stat(sourcePath);
      
      if (stats.isDirectory()) {
        // 复制目录
        await this.copyDirectory(sourcePath, destPath, overwrite);
      } else {
        // 复制文件
        await fs.copyFile(sourcePath, destPath, overwrite ? 0 : fs.constants.COPYFILE_EXCL);
      }
      
      // 记录操作日志
      logOperation('copy_file', `${sourcePath} -> ${destPath}`, user, true, stats.isDirectory() ? '目录复制' : '文件复制');
      
      return {
        content: [
          {
            type: 'text',
            text: `成功复制: ${sourcePath} -> ${destPath}`,
          },
        ],
      };
    } catch (error) {
      // 记录操作日志
      logOperation('copy_file', `${source} -> ${destination}`, user, false, error.message);
      throw new Error(`复制失败: ${error.message}`);
    }
  }

  async copyDirectory(source, destination, overwrite) {
    try {
      // 创建目标目录
      await fs.mkdir(destination, { recursive: true });
      
      // 读取源目录内容
      const entries = await fs.readdir(source, { withFileTypes: true });
      
      for (const entry of entries) {
        const sourcePath = path.join(source, entry.name);
        const destPath = path.join(destination, entry.name);
        
        if (entry.isDirectory()) {
          // 递归复制子目录
          await this.copyDirectory(sourcePath, destPath, overwrite);
        } else {
          // 复制文件
          await fs.copyFile(sourcePath, destPath, overwrite ? 0 : fs.constants.COPYFILE_EXCL);
        }
      }
    } catch (error) {
      throw new Error(`复制目录失败: ${error.message}`);
    }
  }

  async handleMoveFile(args) {
    const { source, destination, overwrite = false } = args;
    const user = args.user || 'unknown';
    
    try {
      // 验证路径安全性
      const sourcePath = validatePath(source);
      const destPath = validatePath(destination);
      
      // 检查源文件是否存在
      try {
        await fs.access(sourcePath);
      } catch (error) {
        throw new Error(`源文件不存在: ${sourcePath}`);
      }
      
      // 检查目标文件是否存在且不允许覆盖
      if (!overwrite) {
        try {
          await fs.access(destPath);
          throw new Error(`目标文件已存在且不允许覆盖: ${destPath}`);
        } catch (error) {
          // 如果文件不存在，继续执行
          if (error.code !== 'ENOENT') {
            throw error;
          }
        }
      }
      
      // 移动文件或目录
      await fs.rename(sourcePath, destPath);
      
      // 记录操作日志
      logOperation('move_file', `${sourcePath} -> ${destPath}`, user, true, `覆盖: ${overwrite}`);
      
      return {
        content: [
          {
            type: 'text',
            text: `成功移动: ${sourcePath} -> ${destPath}`,
          },
        ],
      };
    } catch (error) {
      // 记录操作日志
      logOperation('move_file', `${source} -> ${destination}`, user, false, error.message);
      throw new Error(`移动失败: ${error.message}`);
    }
  }

  async handleDeleteFile(args) {
    const { path: filePath, recursive = false } = args;
    const user = args.user || 'unknown';
    
    try {
      // 验证路径安全性
      const resolvedPath = validatePath(filePath);
      
      // 检查文件是否存在
      try {
        await fs.access(resolvedPath);
      } catch (error) {
        throw new Error(`文件不存在: ${resolvedPath}`);
      }
      
      // 获取文件信息
      const stats = await fs.stat(resolvedPath);
      
      if (stats.isDirectory()) {
        if (recursive) {
          // 递归删除目录
          await this.deleteDirectory(resolvedPath);
          
          // 记录操作日志
          logOperation('delete_file', resolvedPath, user, true, '递归删除目录');
        } else {
          throw new Error(`无法删除目录，请设置recursive参数为true: ${resolvedPath}`);
        }
      } else {
        // 删除文件
        await fs.unlink(resolvedPath);
        
        // 记录操作日志
        logOperation('delete_file', resolvedPath, user, true, '删除文件');
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `成功删除: ${resolvedPath}`,
          },
        ],
      };
    } catch (error) {
      // 记录操作日志
      logOperation('delete_file', filePath, user, false, error.message);
      throw new Error(`删除失败: ${error.message}`);
    }
  }

  async deleteDirectory(dirPath) {
    try {
      // 读取目录内容
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      // 删除所有条目
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // 递归删除子目录
          await this.deleteDirectory(fullPath);
        } else {
          // 删除文件
          await fs.unlink(fullPath);
        }
      }
      
      // 删除空目录
      await fs.rmdir(dirPath);
    } catch (error) {
      throw new Error(`删除目录失败: ${error.message}`);
    }
  }

  async handleFileInfo(args) {
    const { path: filePath } = args;
    const user = args.user || 'unknown';
    
    try {
      // 验证路径安全性
      const resolvedPath = validatePath(filePath);
      
      // 检查文件是否存在
      try {
        await fs.access(resolvedPath);
      } catch (error) {
        throw new Error(`文件不存在: ${resolvedPath}`);
      }
      
      // 获取文件信息
      const stats = await fs.stat(resolvedPath);
      
      // 格式化文件信息
      const fileInfo = {
        path: resolvedPath,
        type: stats.isDirectory() ? '目录' : '文件',
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        permissions: stats.mode,
      };
      
      // 如果是目录，获取内容数量
      if (stats.isDirectory()) {
        try {
          const entries = await fs.readdir(resolvedPath);
          let fileCount = 0;
          let dirCount = 0;
          
          for (const entry of entries) {
            const entryPath = path.join(resolvedPath, entry);
            const entryStats = await fs.stat(entryPath);
            if (entryStats.isFile()) {
              fileCount++;
            } else if (entryStats.isDirectory()) {
              dirCount++;
            }
          }
          
          fileInfo.contents = {
            total: entries.length,
            files: fileCount,
            directories: dirCount,
          };
        } catch (error) {
          // 忽略读取目录内容的错误
        }
      }
      
      // 记录操作日志
      logOperation('file_info', resolvedPath, user, true, `类型: ${fileInfo.type}`);
      
      // 格式化输出
      let output = `路径: ${fileInfo.path}\n`;
      output += `类型: ${fileInfo.type}\n`;
      output += `大小: ${fileInfo.size} 字节\n`;
      output += `创建时间: ${fileInfo.created}\n`;
      output += `修改时间: ${fileInfo.modified}\n`;
      output += `访问时间: ${fileInfo.accessed}\n`;
      
      if (fileInfo.contents) {
        output += `内容: ${fileInfo.contents.total} 项`;
        output += ` (${fileInfo.contents.files} 文件, ${fileInfo.contents.directories} 目录)\n`;
      }
      
      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      // 记录操作日志
      logOperation('file_info', filePath, user, false, error.message);
      throw new Error(`获取文件信息失败: ${error.message}`);
    }
  }

  async handleDetectEncoding(args) {
    const { path: filePath } = args;
    const user = args.user || 'unknown';
    
    try {
      // 验证路径安全性
      const resolvedPath = validatePath(filePath);
      
      // 检查文件是否存在
      try {
        await fs.access(resolvedPath);
      } catch (error) {
        throw new Error(`文件不存在: ${resolvedPath}`);
      }
      
      // 读取文件内容
      const buffer = await fs.readFile(resolvedPath);
      
      // 检测编码
      const detected = jschardet.detect(buffer);
      
      // 格式化输出
      let output = `文件: ${resolvedPath}\n`;
      output += `检测到的编码: ${detected.encoding || '未知'}\n`;
      output += `置信度: ${Math.round(detected.confidence * 100)}%\n`;
      output += `文件大小: ${buffer.length} 字节\n`;
      
      // 如果检测到编码，尝试解码前100个字符作为示例
      if (detected.encoding && detected.confidence > 0.5) {
        try {
          const decoded = iconv.decode(buffer.slice(0, 100), detected.encoding);
          output += `内容示例: ${decoded.replace(/[\r\n]/g, '\\n')}...\n`;
        } catch (error) {
          output += `内容示例: 解码失败\n`;
        }
      }
      
      // 记录操作日志
      logOperation('detect_encoding', resolvedPath, user, true, `编码: ${detected.encoding}, 置信度: ${detected.confidence}`);
      
      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      // 记录操作日志
      logOperation('detect_encoding', filePath, user, false, error.message);
      throw new Error(`检测编码失败: ${error.message}`);
    }
  }

  async handleConvertEncoding(args) {
    const { 
      path: filePath, 
      from_encoding, 
      to_encoding = 'utf8', 
      backup = true 
    } = args;
    const user = args.user || 'unknown';
    
    try {
      // 验证路径安全性
      const resolvedPath = validatePath(filePath);
      
      // 检查文件是否存在
      try {
        await fs.access(resolvedPath);
      } catch (error) {
        throw new Error(`文件不存在: ${resolvedPath}`);
      }
      
      // 读取文件内容
      const buffer = await fs.readFile(resolvedPath);
      
      // 确定源编码
      let sourceEncoding = from_encoding;
      if (!sourceEncoding) {
        const detected = jschardet.detect(buffer);
        if (!detected.encoding || detected.confidence < 0.5) {
          throw new Error(`无法确定源编码，请手动指定from_encoding参数`);
        }
        sourceEncoding = detected.encoding;
      }
      
      // 创建备份
      if (backup) {
        const backupPath = `${resolvedPath}.backup.${Date.now()}`;
        await fs.copyFile(resolvedPath, backupPath);
      }
      
      // 转换编码
      let content;
      try {
        content = iconv.decode(buffer, sourceEncoding);
      } catch (error) {
        throw new Error(`使用${sourceEncoding}解码失败: ${error.message}`);
      }
      
      // 写入转换后的内容
      const convertedBuffer = iconv.encode(content, to_encoding);
      await fs.writeFile(resolvedPath, convertedBuffer);
      
      // 记录操作日志
      logOperation('convert_encoding', resolvedPath, user, true, `${sourceEncoding} -> ${to_encoding}, 备份: ${backup}`);
      
      return {
        content: [
          {
            type: 'text',
            text: `成功将文件 ${resolvedPath} 从 ${sourceEncoding} 转换为 ${to_encoding}${backup ? '（已创建备份）' : ''}`,
          },
        ],
      };
    } catch (error) {
      // 记录操作日志
      logOperation('convert_encoding', filePath, user, false, error.message);
      throw new Error(`转换编码失败: ${error.message}`);
    }
  }

  async handleSearchRegex(args) {
    const { 
      pattern, 
      path: searchPath, 
      file_pattern, 
      case_sensitive = false, 
      max_results = 100,
      include_line_numbers = true,
      context_lines = 0
    } = args;
    const user = args.user || 'unknown';
    
    try {
      // 验证路径安全性
      const cwd = searchPath ? validatePath(searchPath) : process.cwd();
      
      // 验证正则表达式
      let regex;
      try {
        const flags = case_sensitive ? 'g' : 'gi';
        regex = new RegExp(pattern, flags);
      } catch (error) {
        throw new Error(`无效的正则表达式: ${error.message}`);
      }
      
      // 获取所有匹配的文件
      const files = await this.findFiles(cwd, file_pattern);
      const results = [];
      let resultCount = 0;
      
      // 搜索每个文件
      for (const filePath of files) {
        if (resultCount >= max_results) break;
        
        try {
          // 读取文件内容
          const buffer = await fs.readFile(filePath);
          let content;
          
          // 尝试自动检测编码
          const detected = jschardet.detect(buffer);
          if (detected.encoding && detected.confidence > 0.5) {
            try {
              content = iconv.decode(buffer, detected.encoding);
            } catch (error) {
              content = buffer.toString('utf8');
            }
          } else {
            content = buffer.toString('utf8');
          }
          
          // 按行分割内容
          const lines = content.split('\n');
          const fileResults = [];
          
          // 搜索匹配的行
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            regex.lastIndex = 0; // 重置正则表达式状态
            
            if (regex.test(line)) {
              const contextStart = Math.max(0, i - context_lines);
              const contextEnd = Math.min(lines.length - 1, i + context_lines);
              const context = [];
              
              // 添加上下文行
              for (let j = contextStart; j <= contextEnd; j++) {
                context.push({
                  line_number: j + 1,
                  content: lines[j],
                  is_match: j === i
                });
              }
              
              fileResults.push({
                line_number: i + 1,
                content: line,
                context: context_lines > 0 ? context : undefined
              });
              
              resultCount++;
              if (resultCount >= max_results) break;
            }
          }
          
          // 如果文件有匹配结果，添加到结果中
          if (fileResults.length > 0) {
            results.push({
              file: filePath,
              matches: fileResults
            });
          }
        } catch (error) {
          // 忽略读取文件错误，继续处理其他文件
          console.error(`处理文件 ${filePath} 时出错: ${error.message}`);
        }
      }
      
      // 格式化结果
      let output = '';
      if (results.length === 0) {
        output = '未找到匹配项';
      } else {
        for (const fileResult of results) {
          output += `\n文件: ${fileResult.file}\n`;
          for (const match of fileResult.matches) {
            if (include_line_numbers) {
              output += `  行 ${match.line_number}: ${match.content}\n`;
            } else {
              output += `  ${match.content}\n`;
            }
            
            // 添加上下文
            if (match.context) {
              for (const ctx of match.context) {
                if (!ctx.is_match) {
                  if (include_line_numbers) {
                    output += `    行 ${ctx.line_number}: ${ctx.content}\n`;
                  } else {
                    output += `    ${ctx.content}\n`;
                  }
                }
              }
            }
          }
        }
        
        output = `找到 ${results.length} 个文件中的 ${resultCount} 个匹配项:\n${output}`;
      }
      
      // 记录操作日志
      logOperation('search_regex', cwd, user, true, `模式: ${pattern}, 结果数: ${resultCount}`);
      
      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      // 记录操作日志
      logOperation('search_regex', searchPath || '当前目录', user, false, error.message);
      throw new Error(`正则表达式搜索失败: ${error.message}`);
    }
  }

  // 辅助方法：查找匹配的文件
  async findFiles(dirPath, filePattern) {
    const files = [];
    
    async function traverse(currentPath, depth = 0) {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          
          if (entry.isDirectory()) {
            // 递归处理子目录
            await traverse(fullPath, depth + 1);
          } else if (entry.isFile()) {
            // 检查文件模式匹配
            if (!filePattern || this.matchFilePattern(entry.name, filePattern)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // 忽略无法访问的目录
        console.error(`访问目录 ${currentPath} 时出错: ${error.message}`);
      }
    }
    
    await traverse(dirPath);
    return files;
  }

  // 辅助方法：匹配文件模式
  matchFilePattern(fileName, pattern) {
    // 简单的通配符匹配实现
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(fileName);
  }

  async handlePreviewFile(args) {
    const { 
      path: filePath, 
      start_line = 1, 
      end_line = 50, 
      encoding = 'auto',
      highlight_pattern
    } = args;
    const user = args.user || 'unknown';
    
    try {
      // 验证路径安全性
      const absolutePath = validatePath(filePath);
      
      // 检查文件是否存在
      try {
        await fs.access(absolutePath);
      } catch (error) {
        throw new Error(`文件不存在: ${absolutePath}`);
      }
      
      // 读取文件为Buffer
      const buffer = await fs.readFile(absolutePath);
      let content;
      
      if (encoding === 'auto') {
        // 自动检测编码
        const detected = jschardet.detect(buffer);
        
        if (detected.encoding && detected.confidence > 0.5) {
          try {
            content = iconv.decode(buffer, detected.encoding);
          } catch (error) {
            // 如果检测的编码解码失败，回退到UTF-8
            console.error(`使用检测到的编码 ${detected.encoding} 解码失败，回退到UTF-8: ${error.message}`);
            content = buffer.toString('utf8');
          }
        } else {
          // 如果检测置信度低或无法检测，尝试UTF-8
          try {
            content = buffer.toString('utf8');
          } catch (error) {
            // 如果UTF-8也失败，尝试使用系统默认编码
            content = buffer.toString();
          }
        }
      } else {
        // 使用指定的编码
        try {
          if (encoding === 'utf8' || encoding === 'utf-8') {
            content = buffer.toString('utf8');
          } else {
            content = iconv.decode(buffer, encoding);
          }
        } catch (error) {
          throw new Error(`使用 ${encoding} 编码读取文件失败: ${error.message}`);
        }
      }
      
      // 按行分割内容
      const lines = content.split('\n');
      
      // 调整行号范围
      const adjustedStartLine = Math.max(1, start_line);
      const adjustedEndLine = Math.min(lines.length, end_line);
      
      // 提取指定范围的行
      const previewLines = [];
      for (let i = adjustedStartLine - 1; i < adjustedEndLine; i++) {
        let line = lines[i];
        
        // 应用高亮
        if (highlight_pattern) {
          try {
            const highlightRegex = new RegExp(highlight_pattern, 'gi');
            line = line.replace(highlightRegex, match => `**${match}**`);
          } catch (error) {
            // 忽略无效的正则表达式
          }
        }
        
        previewLines.push({
          line_number: i + 1,
          content: line
        });
      }
      
      // 获取文件信息
      const stats = await fs.stat(absolutePath);
      const fileInfo = {
        path: absolutePath,
        size: stats.size,
        modified: stats.mtime.toISOString(),
        total_lines: lines.length,
        preview_lines: previewLines.length,
        encoding: encoding === 'auto' ? (jschardet.detect(buffer).encoding || 'utf8') : encoding
      };
      
      // 格式化输出
      let output = `文件预览: ${absolutePath}\n`;
      output += `大小: ${fileInfo.size} 字节\n`;
      output += `修改时间: ${fileInfo.modified}\n`;
      output += `总行数: ${fileInfo.total_lines}\n`;
      output += `编码: ${fileInfo.encoding}\n`;
      output += `预览行数: ${fileInfo.preview_lines} (第 ${adjustedStartLine}-${adjustedEndLine} 行)\n\n`;
      
      for (const line of previewLines) {
        output += `${line.line_number}: ${line.content}\n`;
      }
      
      // 如果文件还有更多行，添加提示
      if (adjustedEndLine < lines.length) {
        output += `\n... 还有 ${lines.length - adjustedEndLine} 行未显示 ...`;
      }
      
      // 记录操作日志
      logOperation('preview_file', absolutePath, user, true, `行 ${adjustedStartLine}-${adjustedEndLine}, 编码: ${encoding}`);
      
      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      // 记录操作日志
      logOperation('preview_file', filePath, user, false, error.message);
      throw new Error(`文件预览失败: ${error.message}`);
    }
  }

  async handleSearchAdvanced(args) {
    const { 
      pattern, 
      path: searchPath, 
      file_pattern,
      file_size_min,
      file_size_max,
      modified_after,
      modified_before,
      exclude_pattern,
      max_depth,
      max_results = 100
    } = args;
    const user = args.user || 'unknown';
    
    try {
      // 验证路径安全性
      const cwd = searchPath ? validatePath(searchPath) : process.cwd();
      
      // 解析日期
      let afterDate = null;
      let beforeDate = null;
      
      if (modified_after) {
        afterDate = new Date(modified_after);
        if (isNaN(afterDate.getTime())) {
          throw new Error(`无效的修改日期: ${modified_after}`);
        }
      }
      
      if (modified_before) {
        beforeDate = new Date(modified_before);
        if (isNaN(beforeDate.getTime())) {
          throw new Error(`无效的修改日期: ${modified_before}`);
        }
      }
      
      // 查找匹配的文件
      const files = await this.findFilesAdvanced(cwd, {
        file_pattern,
        exclude_pattern,
        file_size_min,
        file_size_max,
        modified_after: afterDate,
        modified_before: beforeDate,
        max_depth
      });
      
      const results = [];
      let resultCount = 0;
      
      // 搜索每个文件
      for (const filePath of files) {
        if (resultCount >= max_results) break;
        
        try {
          // 读取文件内容
          const buffer = await fs.readFile(filePath);
          let content;
          
          // 尝试自动检测编码
          const detected = jschardet.detect(buffer);
          if (detected.encoding && detected.confidence > 0.5) {
            try {
              content = iconv.decode(buffer, detected.encoding);
            } catch (error) {
              content = buffer.toString('utf8');
            }
          } else {
            content = buffer.toString('utf8');
          }
          
          // 检查是否包含搜索模式
          const isMatch = content.includes(pattern);
          
          if (isMatch) {
            // 获取文件信息
            const stats = await fs.stat(filePath);
            
            // 查找所有匹配的行
            const lines = content.split('\n');
            const matches = [];
            
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(pattern)) {
                matches.push({
                  line_number: i + 1,
                  content: lines[i]
                });
                
                resultCount++;
                if (resultCount >= max_results) break;
              }
            }
            
            results.push({
              file: filePath,
              file_size: stats.size,
              modified: stats.mtime.toISOString(),
              matches: matches
            });
          }
        } catch (error) {
          // 忽略读取文件错误，继续处理其他文件
          console.error(`处理文件 ${filePath} 时出错: ${error.message}`);
        }
      }
      
      // 格式化结果
      let output = '';
      if (results.length === 0) {
        output = '未找到匹配项';
      } else {
        output = `找到 ${results.length} 个文件中的 ${resultCount} 个匹配项:\n\n`;
        
        for (const fileResult of results) {
          output += `文件: ${fileResult.file}\n`;
          output += `大小: ${fileResult.file_size} 字节\n`;
          output += `修改时间: ${fileResult.modified}\n`;
          output += `匹配行数: ${fileResult.matches.length}\n\n`;
          
          for (const match of fileResult.matches) {
            output += `  行 ${match.line_number}: ${match.content}\n`;
          }
          
          output += '\n';
        }
      }
      
      // 记录操作日志
      logOperation('search_advanced', cwd, user, true, `模式: ${pattern}, 结果数: ${resultCount}`);
      
      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      // 记录操作日志
      logOperation('search_advanced', searchPath || '当前目录', user, false, error.message);
      throw new Error(`高级搜索失败: ${error.message}`);
    }
  }

  // 高级文件查找方法，支持多种筛选条件
  async findFilesAdvanced(dirPath, options) {
    const {
      file_pattern,
      exclude_pattern,
      file_size_min,
      file_size_max,
      modified_after,
      modified_before,
      max_depth
    } = options;
    
    const files = [];
    
    async function traverse(currentPath, depth = 0) {
      // 检查深度限制
      if (max_depth !== undefined && depth > max_depth) {
        return;
      }
      
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          
          if (entry.isDirectory()) {
            // 递归处理子目录
            await traverse(fullPath, depth + 1);
          } else if (entry.isFile()) {
            // 检查文件模式匹配
            if (file_pattern && !this.matchFilePattern(entry.name, file_pattern)) {
              continue;
            }
            
            // 检查排除模式
            if (exclude_pattern && this.matchFilePattern(entry.name, exclude_pattern)) {
              continue;
            }
            
            // 获取文件信息
            const stats = await fs.stat(fullPath);
            
            // 检查文件大小
            if (file_size_min !== undefined && stats.size < file_size_min) {
              continue;
            }
            
            if (file_size_max !== undefined && stats.size > file_size_max) {
              continue;
            }
            
            // 检查修改时间
            if (modified_after && stats.mtime < modified_after) {
              continue;
            }
            
            if (modified_before && stats.mtime > modified_before) {
              continue;
            }
            
            // 所有条件都满足，添加到结果中
            files.push(fullPath);
          }
        }
      } catch (error) {
        // 忽略无法访问的目录
        console.error(`访问目录 ${currentPath} 时出错: ${error.message}`);
      }
    }
    
    await traverse(dirPath);
    return files;
  }

  async handleValidatePath(args) {
    const { path: inputPath, allowed_paths } = args;
    const user = args.user || 'system';
    try {
      const validatedPath = validatePath(inputPath, allowed_paths);
      
      // 记录操作日志
      logOperation('validate_path', inputPath, user, true, `验证通过: ${validatedPath}`);
      
      return {
        content: [
          {
            type: 'text',
            text: `路径验证通过\n原始路径: ${inputPath}\n解析后路径: ${validatedPath}\n状态: 安全`,
          },
        ],
      };
    } catch (error) {
      // 记录操作日志
      logOperation('validate_path', inputPath, user, false, error.message);
      
      return {
        content: [
          {
            type: 'text',
            text: `路径验证失败\n原始路径: ${inputPath}\n错误: ${error.message}\n状态: 不安全`,
          },
        ],
        isError: true,
      };
    }
  }

  async handleProjectTemplate(args) {

    const {
      template_type,
      project_name,
      project_path,
      custom_template_url,
      package_manager = 'npm',
      install_dependencies = true,
      git_init = true,
      user = 'unknown'
    } = args;
    
    const cwd = project_path ? path.resolve(project_path) : process.cwd();
    const projectDir = path.join(cwd, project_name);
    
    try {
      // 检查项目目录是否已存在
      try {
        await fs.access(projectDir);
        throw new Error(`项目目录已存在: ${projectDir}`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        // 目录不存在，继续执行
      }
      
      // 创建项目目录
      await fs.mkdir(projectDir, { recursive: true });
      
      // 根据模板类型创建项目
      let command;
      let templateDesc = '';
      
      switch (template_type) {
        case 'react':
          command = `npx create-react-app ${project_name} --template typescript`;
          templateDesc = `React TypeScript项目`;
          break;
          
        case 'vue':
          command = `npx create-vue@latest ${project_name}`;
          templateDesc = `Vue项目`;
          break;
          
        case 'angular':
          command = `npx @angular/cli@latest new ${project_name}`;
          templateDesc = `Angular项目`;
          break;
          
        case 'node':
          command = `npm init -y`;
          templateDesc = `Node.js项目`;
          break;
          
        case 'express':
          command = `npx express-generator ${project_name}`;
          templateDesc = `Express项目`;
          break;
          
        case 'python':
          command = `echo "# ${project_name}" > README.md && mkdir src tests`;
          templateDesc = `Python项目`;
          break;
          
        case 'django':
          command = `django-admin startproject ${project_name}`;
          templateDesc = `Django项目`;
          break;
          
        case 'flask':
          command = `echo "# ${project_name}" > README.md && mkdir app tests`;
          templateDesc = `Flask项目`;
          break;
          
        case 'custom':
          if (!custom_template_url) {
            throw new Error('使用自定义模板需要提供模板URL');
          }
          command = `git clone ${custom_template_url} ${project_name}`;
          templateDesc = `自定义模板项目`;
          break;
          
        default:
          throw new Error(`不支持的模板类型: ${template_type}`);
      }
      
      // 执行创建命令
      const { stdout, stderr } = await execAsync(command, { cwd });
      
      // 如果需要安装依赖
      if (install_dependencies && template_type !== 'python' && template_type !== 'django' && template_type !== 'flask') {
        let installCommand;
        switch (package_manager) {
          case 'yarn':
            installCommand = `cd ${projectDir} && yarn install`;
            break;
          case 'pnpm':
            installCommand = `cd ${projectDir} && pnpm install`;
            break;
          default:
            installCommand = `cd ${projectDir} && npm install`;
        }
        
        await execAsync(installCommand);
      }
      
      // 如果需要初始化Git仓库
      if (git_init) {
        await execAsync(`cd ${projectDir} && git init`);
        await execAsync(`cd ${projectDir} && git add .`);
        await execAsync(`cd ${projectDir} && git commit -m "Initial commit"`);
      }
      
      // 记录操作日志
      logOperation('project_template', projectDir, user, true, `模板: ${templateDesc}, 包管理器: ${package_manager}`);
      
      return {
        content: [
          {
            type: 'text',
            text: `项目创建成功!\n项目路径: ${projectDir}\n模板类型: ${templateDesc}\n包管理器: ${package_manager}\n${stdout || (stderr ? `警告: ${stderr}` : '')}`,
          },
        ],
      };
    } catch (error) {
      // 记录操作日志
      logOperation('project_template', project_name || '未知项目', user, false, error.message);
      throw new Error(`创建项目失败: ${error.message}`);
    }
  }

  async handleManageDependencies(args) {
    const {
      action = 'install',
      project_path,
      packages,
      save_dev = false,
      package_manager,
      user = 'unknown'
    } = args;
    
    const cwd = project_path ? path.resolve(project_path) : process.cwd();
    
    try {
      // 检查项目目录是否存在
      try {
        await fs.access(cwd);
      } catch (error) {
        throw new Error(`项目目录不存在: ${cwd}`);
      }
      
      // 自动检测包管理器（如果未指定）
      let pm = package_manager;
      if (!pm) {
        try {
          await fs.access(path.join(cwd, 'yarn.lock'));
          pm = 'yarn';
        } catch {
          try {
            await fs.access(path.join(cwd, 'pnpm-lock.yaml'));
            pm = 'pnpm';
          } catch {
            pm = 'npm';
          }
        }
      }
      
      let command;
      let actionDesc = '';
      
      switch (action) {
        case 'install':
          command = `${pm} install`;
          actionDesc = '安装所有依赖';
          break;
          
        case 'add':
          if (!packages || packages.length === 0) {
            throw new Error('添加依赖需要指定包名');
          }
          const packagesStr = packages.join(' ');
          const devFlag = save_dev && pm === 'npm' ? ' --save-dev' : 
                         save_dev && pm === 'yarn' ? ' --dev' : 
                         save_dev && pm === 'pnpm' ? ' --save-dev' : '';
          command = `${pm} add${devFlag} ${packagesStr}`;
          actionDesc = `添加依赖: ${packagesStr}`;
          break;
          
        case 'remove':
          if (!packages || packages.length === 0) {
            throw new Error('移除依赖需要指定包名');
          }
          const packagesToRemove = packages.join(' ');
          command = `${pm === 'yarn' ? 'yarn remove' : pm + ' uninstall'} ${packagesToRemove}`;
          actionDesc = `移除依赖: ${packagesToRemove}`;
          break;
          
        case 'update':
          if (packages && packages.length > 0) {
            const packagesToUpdate = packages.join(' ');
            command = `${pm} update ${packagesToUpdate}`;
            actionDesc = `更新依赖: ${packagesToUpdate}`;
          } else {
            command = `${pm} update`;
            actionDesc = '更新所有依赖';
          }
          break;
          
        case 'list':
          command = `${pm} list${pm === 'npm' ? ' --depth=0' : ''}`;
          actionDesc = '列出依赖';
          break;
          
        default:
          throw new Error(`不支持的依赖操作: ${action}`);
      }
      
      // 执行命令
      const { stdout, stderr } = await execAsync(command, { cwd });
      
      // 记录操作日志
      logOperation('manage_dependencies', cwd, user, true, `操作: ${actionDesc}, 包管理器: ${pm}`);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout || (stderr ? `警告: ${stderr}` : `${actionDesc}完成，无输出`),
          },
        ],
      };
    } catch (error) {
      // 记录操作日志
      logOperation('manage_dependencies', project_path || '当前目录', user, false, error.message);
      throw new Error(`依赖管理操作失败: ${error.message}`);
    }
  }

  async handleBuildDeploy(args) {
    const {
      action = 'build',
      project_path,
      build_command,
      deploy_target,
      deploy_config,
      environment = 'production',
      user = 'unknown'
    } = args;
    
    const cwd = project_path ? path.resolve(project_path) : process.cwd();
    
    try {
      // 检查项目目录是否存在
      try {
        await fs.access(cwd);
      } catch (error) {
        throw new Error(`项目目录不存在: ${cwd}`);
      }
      
      let output = '';
      
      // 构建阶段
      if (action === 'build' || action === 'build_deploy') {
        let buildCmd = build_command;
        
        // 如果没有指定构建命令，尝试自动检测
        if (!buildCmd) {
          try {
            // 检查package.json中的scripts
            const packageJsonPath = path.join(cwd, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            
            if (packageJson.scripts) {
              if (environment === 'production' && packageJson.scripts.build) {
                buildCmd = 'npm run build';
              } else if (environment === 'development' && packageJson.scripts.dev) {
                buildCmd = 'npm run dev';
              } else if (packageJson.scripts.build) {
                buildCmd = 'npm run build';
              }
            }
          } catch {
            // 如果没有package.json，尝试其他方法
            try {
              // 检查是否是Python项目
              await fs.access(path.join(cwd, 'setup.py'));
              buildCmd = 'python setup.py build';
            } catch {
              try {
                // 检查是否是C/C++项目
                await fs.access(path.join(cwd, 'Makefile'));
                buildCmd = 'make';
              } catch {
                throw new Error('无法确定构建命令，请手动指定build_command参数');
              }
            }
          }
        }
        
        // 执行构建命令
        const { stdout: buildStdout, stderr: buildStderr } = await execAsync(buildCmd, { cwd });
        output += `构建输出:\n${buildStdout || (buildStderr ? `警告: ${buildStderr}` : '构建成功，无输出')}\n\n`;
      }
      
      // 部署阶段
      if (action === 'deploy' || action === 'build_deploy') {
        if (!deploy_target) {
          throw new Error('部署操作需要指定deploy_target参数');
        }
        
        let deployCmd;
        let targetDesc = '';
        
        switch (deploy_target) {
          case 'vercel':
            deployCmd = 'npx vercel --prod';
            targetDesc = 'Vercel';
            break;
            
          case 'netlify':
            deployCmd = 'npx netlify deploy --prod --dir=dist';
            targetDesc = 'Netlify';
            break;
            
          case 'github_pages':
            deployCmd = 'npm run deploy';
            targetDesc = 'GitHub Pages';
            break;
            
          case 'custom':
            if (!deploy_config || !deploy_config.command) {
              throw new Error('自定义部署需要提供deploy_config.command参数');
            }
            deployCmd = deploy_config.command;
            targetDesc = '自定义部署';
            break;
            
          default:
            throw new Error(`不支持的部署目标: ${deploy_target}`);
        }
        
        // 执行部署命令
        const { stdout: deployStdout, stderr: deployStderr } = await execAsync(deployCmd, { cwd });
        output += `部署输出 (${targetDesc}):\n${deployStdout || (deployStderr ? `警告: ${deployStderr}` : '部署成功，无输出')}\n\n`;
      }
      
      // 记录操作日志
      logOperation('build_deploy', cwd, user, true, `操作: ${action}, 环境: ${environment}`);
      
      return {
        content: [
          {
            type: 'text',
            text: output || `${action}操作完成，无输出`,
          },
        ],
      };
    } catch (error) {
      // 记录操作日志
      logOperation('build_deploy', project_path || '当前目录', user, false, error.message);
      throw new Error(`构建部署操作失败: ${error.message}`);
    }
  }

  async handleGetOperationLog(args) {
    const { limit = 50, operation, user } = args;
    
    try {
      let filteredLog = [...operationLog];
      
      // 应用筛选条件
      if (operation) {
        filteredLog = filteredLog.filter(entry => entry.operation === operation);
      }
      
      if (user) {
        filteredLog = filteredLog.filter(entry => entry.user === user);
      }
      
      // 按时间倒序排列并限制数量
      filteredLog.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const limitedLog = filteredLog.slice(0, limit);
      
      // 格式化输出
      let output = `操作日志 (显示最近 ${limitedLog.length} 条记录):\n\n`;
      
      limitedLog.forEach(entry => {
        output += `时间: ${entry.timestamp}\n`;
        output += `操作: ${entry.operation}\n`;
        output += `路径: ${entry.path}\n`;
        output += `用户: ${entry.user}\n`;
        output += `状态: ${entry.success ? '成功' : '失败'}\n`;
        if (entry.details) {
          output += `详情: ${entry.details}\n`;
        }
        output += '---\n';
      });
      
      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      throw new Error(`获取操作日志失败: ${error.message}`);
    }
  }

  async handleAnalyzeCodeStructure(args) {
    const {
      file_path,
      encoding = 'auto',
      analysis_type = 'all',
      format = 'json',
      user = 'unknown'
    } = args;
    
    try {
      // 验证路径必须是绝对路径
      if (!path.isAbsolute(file_path)) {
        throw new Error('file_path必须是绝对路径');
      }
      
      // 验证路径安全性
      const absolutePath = validatePath(file_path);
      
      // 检查文件是否存在
      try {
        await fs.access(absolutePath);
      } catch (error) {
        throw new Error(`文件不存在: ${absolutePath}`);
      }
      
      // 检查文件是否为JavaScript/TypeScript文件
      const ext = path.extname(absolutePath).toLowerCase();
      const validExtensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
      if (!validExtensions.includes(ext)) {
        throw new Error(`不支持的文件类型: ${ext}。支持的文件类型: ${validExtensions.join(', ')}`);
      }
      
      // 使用代码分析器分析文件
      const analysisResult = this.codeAnalyzer.analyzeCodeStructure(absolutePath, encoding);
      
      // 根据分析类型过滤结果
      let filteredResult = {};
      if (analysis_type === 'all') {
        filteredResult = analysisResult;
      } else {
        filteredResult.file = analysisResult.file;
        if (analysis_type === 'functions') {
          filteredResult.functions = analysisResult.functions;
        } else if (analysis_type === 'classes') {
          filteredResult.classes = analysisResult.classes;
        } else if (analysis_type === 'variables') {
          filteredResult.variables = analysisResult.variables;
        } else if (analysis_type === 'dependencies') {
          filteredResult.dependencies = analysisResult.dependencies;
        }
      }
      
      // 格式化输出
      let output;
      if (format === 'json') {
        output = JSON.stringify(filteredResult, null, 2);
      } else {
        // 文本格式
        output = this.formatAnalysisResultAsText(filteredResult, analysis_type);
      }
      
      // 记录操作日志
      logOperation('analyze_code_structure', absolutePath, user, true, `分析类型: ${analysis_type}, 格式: ${format}`);
      
      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      // 记录操作日志
      logOperation('analyze_code_structure', file_path, user, false, error.message);
      throw new Error(`代码结构分析失败: ${error.message}`);
    }
  }

  formatAnalysisResultAsText(result, analysisType) {
    let output = `代码结构分析结果\n`;
    output += `文件: ${result.file}\n`;
    output += `分析类型: ${analysisType}\n\n`;
    
    if (result.functions && result.functions.length > 0) {
      output += `函数 (${result.functions.length}个):\n`;
      result.functions.forEach((func, index) => {
        output += `${index + 1}. ${func.type}: ${func.name}\n`;
        if (func.start && func.end) {
          output += `   位置: 行 ${func.start.line}-${func.end.line}\n`;
        }
        if (func.params && func.params.length > 0) {
          output += `   参数: ${func.params.join(', ')}\n`;
        }
        if (func.async) {
          output += `   异步: 是\n`;
        }
        if (func.generator) {
          output += `   生成器: 是\n`;
        }
        output += '\n';
      });
    }
    
    if (result.classes && result.classes.length > 0) {
      output += `类 (${result.classes.length}个):\n`;
      result.classes.forEach((cls, index) => {
        output += `${index + 1}. ${cls.type}: ${cls.name}\n`;
        if (cls.start && cls.end) {
          output += `   位置: 行 ${cls.start.line}-${cls.end.line}\n`;
        }
        if (cls.superClass) {
          output += `   继承自: ${cls.superClass}\n`;
        }
        if (cls.methods && cls.methods.length > 0) {
          output += `   方法: ${cls.methods.map(m => m.name).join(', ')}\n`;
        }
        if (cls.properties && cls.properties.length > 0) {
          output += `   属性: ${cls.properties.map(p => p.name).join(', ')}\n`;
        }
        output += '\n';
      });
    }
    
    if (result.variables && result.variables.length > 0) {
      output += `变量 (${result.variables.length}个):\n`;
      result.variables.forEach((variable, index) => {
        output += `${index + 1}. ${variable.kind}: ${variable.name}\n`;
        if (variable.start && variable.end) {
          output += `   位置: 行 ${variable.start.line}-${variable.end.line}\n`;
        }
        if (variable.value !== null) {
          output += `   值: ${variable.value}\n`;
        }
        output += '\n';
      });
    }
    
    if (result.dependencies) {
      const { imports, requires, calls, properties } = result.dependencies;
      
      if (imports && imports.length > 0) {
        output += `导入 (${imports.length}个):\n`;
        imports.forEach((imp, index) => {
          output += `${index + 1}. 从 ${imp.source} 导入: `;
          output += imp.specifiers.map(s => {
            if (s.type === 'default') return s.local;
            if (s.type === 'named') return `${s.imported} as ${s.local}`;
            if (s.type === 'namespace') return `* as ${s.local}`;
          }).join(', ');
          output += '\n';
        });
        output += '\n';
      }
      
      if (requires && requires.length > 0) {
        output += `Require (${requires.length}个):\n`;
        requires.forEach((req, index) => {
          output += `${index + 1}. require('${req.module}')\n`;
        });
        output += '\n';
      }
      
      if (calls && calls.length > 0) {
        output += `函数调用 (${calls.length}个):\n`;
        calls.forEach((call, index) => {
          output += `${index + 1}. ${call.name}()\n`;
        });
        output += '\n';
      }
      
      if (properties && properties.length > 0) {
        output += `属性访问 (${properties.length}个):\n`;
        properties.forEach((prop, index) => {
          output += `${index + 1}. ${prop.object}.${prop.property}\n`;
        });
        output += '\n';
      }
    }
    
    return output;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Codex Tools MCP server running on stdio');
  }
}

const server = new CodexToolsServer();
server.run().catch(console.error);