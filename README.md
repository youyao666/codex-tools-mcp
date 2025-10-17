# Codex Tools MCP Server - 高级版

一个高级MCP服务器，为AI客户端提供强大的IDE工具功能，包括智能文件操作、代码搜索、计划管理和流式命令执行等高级功能。

## 新版本亮点

### 🚀 高级功能
- **智能文件读取**：支持缩进感知和上下文分析的高级文件读取
- **代码搜索**：基于ripgrep的高性能代码搜索工具
- **计划管理**：完整的任务和计划管理系统
- **流式命令执行**：支持长时间运行的命令和实时输出监控
- **高级补丁应用**：支持多种补丁类型的文件系统操作

### 🔧 增强的文件操作
- 自动编码检测和转换
- 缩进感知的代码块读取
- 基于锚点的上下文分析
- 多种补丁应用模式（添加、删除、更新、移动）

### 🌍 多语言代码分析
- 支持JavaScript、TypeScript、Python、Java、C/C++、Go等多种语言
- 自动检测代码语言类型
- 提取函数、类、导入依赖等关键信息
- 支持文件路径和代码字符串两种输入方式

## 快速开始

### 方式一：使用NPM包（推荐）

无需下载任何文件，只需在您的AI客户端配置中添加以下内容：

```json
{
  "mcpServers": {
    "codex-tools": {
      "command": "npx",
      "args": ["-y", "@youyao666/codex-tools-mcp@latest"]
    }
  }
}
```

### 方式二：本地安装

1. 下载并解压此发行版
2. 运行安装脚本：
   - Windows: 双击 `install.bat`
   - Linux/macOS: `chmod +x install.sh && ./install.sh`

3. 在您的AI客户端配置中添加：
   ```json
   {
     "mcpServers": {
       "codex-tools": {
         "command": "node",
         "args": ["[安装路径]/index.js"]
       }
     }
   }
   ```

## 通用配置工具

我们提供了通用的配置工具，帮助您快速生成适用于各种AI客户端的配置：

- Windows: 运行 `universal-config.bat`
- Linux/macOS: 运行 `chmod +x universal-config.sh && ./universal-config.sh`

## 各种AI客户端配置方法

### Claude Desktop

配置文件位置：
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/claude/claude_desktop_config.json`

### Continue.dev

在VSCode设置中添加：

```json
{
  "mcpServers": {
    "codex-tools": {
      "command": "npx",
      "args": ["-y", "@youyao666/codex-tools-mcp@latest"]
    }
  }
}
```

### Cline (VSCode扩展)

在设置中添加：

```json
{
  "cline.mcpServers": {
    "codex-tools": {
      "command": "npx",
      "args": ["-y", "@youyao666/codex-tools-mcp@latest"]
    }
  }
}
```

## 高级工具列表

### 智能文件操作工具
- `read_file_advanced` - 高级文件读取，支持缩进感知和上下文分析
  - 支持slice和indentation两种读取模式
  - 基于锚点行的智能上下文收集
  - 自动编码检测和转换
- `apply_patch` - 高级补丁应用工具
  - 支持add、delete、update、move四种补丁类型
  - 支持字符串替换和内容替换两种更新模式
  - 自动目录创建和备份功能
- `read_file` - 标准文件读取（增强版，支持自动编码检测）
- `write_file` - 标准文件写入（增强版，支持编码设置和备份）
- `list_directory` - 列出目录内容
- `create_directory` - 创建目录
- `delete_file` - 删除文件或目录
- `move_file` - 移动或重命名文件

### 代码搜索工具
- `grep_files` - 基于ripgrep的高性能代码搜索
  - 支持正则表达式和字面量搜索
  - 文件类型过滤（include/exclude模式）
  - 上下文行显示
  - 大小写敏感/不敏感搜索
  - 搜索深度限制
  - 结果数量限制

### 计划管理工具
- `update_plan` - 完整的计划和任务管理系统
  - 支持创建、更新、归档计划
  - 任务添加、更新、删除
  - 任务状态跟踪（pending、in_progress、completed、blocked）
  - 任务优先级管理（low、medium、high、critical）
  - 任务依赖关系
  - 工时估算和跟踪

### 流式命令执行工具
- `exec_stream` - 流式命令执行工具
  - 实时输出流
  - 长时间运行的命令支持
  - 超时控制
  - 进程管理
  - 环境变量自定义

### 命令执行工具
- `execute_command` - 执行系统命令
- `execute_interactive_command` - 执行交互式命令

### Git操作工具
- `git_status` - 查看Git状态
- `git_diff` - 查看Git差异
- `git_commit` - 提交Git更改
- `git_push` - 推送到远程仓库
- `git_pull` - 从远程仓库拉取
- `git_branch` - 管理Git分支

## 高级功能使用示例

### 智能文件读取

```json
{
  "name": "read_file_advanced",
  "arguments": {
    "file_path": "src/components/Button.js",
    "mode": "indentation",
    "indentation": {
      "anchor_line": 15,
      "context_lines": 5,
      "include_same_level": true,
      "indent_size": 2
    }
  }
}
```

### 代码搜索

```json
{
  "name": "grep_files",
  "arguments": {
    "pattern": "function handleClick",
    "path": "src",
    "include_pattern": "*.js",
    "context_lines": 3,
    "case_sensitive": false
  }
}
```

### 计划管理

```json
{
  "name": "update_plan",
  "arguments": {
    "action": "create",
    "title": "实现用户认证功能",
    "description": "添加登录、注册和密码重置功能",
    "tasks": [
      {
        "id": "auth-1",
        "title": "设计认证API",
        "status": "pending",
        "priority": "high",
        "estimated_hours": 8
      },
      {
        "id": "auth-2",
        "title": "实现登录组件",
        "status": "pending",
        "priority": "high",
        "estimated_hours": 6
      }
    ]
  }
}
```

### 流式命令执行

```json
{
  "name": "exec_stream",
  "arguments": {
    "command": "npm run dev",
    "cwd": "/path/to/project",
    "stream_output": true,
    "timeout": 600000
  }
}
```

### 高级补丁应用

```json
{
  "name": "apply_patch",
  "arguments": {
    "patches": [
      {
        "type": "add",
        "path": "src/utils/helpers.js",
        "content": "export const formatDate = (date) => { ... }"
      },
      {
        "type": "update",
        "path": "src/components/Header.js",
        "old_str": "const Header = () => {",
        "new_str": "const Header = ({ user }) => {"
      }
    ]
  }
}
```

### 多语言代码分析

```json
{
  "name": "analyze_code",
  "arguments": {
    "file_path": "src/example.py",
    "language": "python"
  }
}
```

分析代码字符串：
```json
{
  "name": "analyze_code_string",
  "arguments": {
    "code": "function test() { console.log('Hello'); }",
    "language": "javascript"
  }
}
```

## 多语言代码分析器详解

### 概述

多语言代码分析器是一个能够分析多种编程语言代码结构的工具，支持JavaScript、TypeScript、Python、Java、C/C++和Go等语言。它能够提取代码中的函数、类、导入依赖等关键信息，帮助开发者更好地理解和重构代码。

该分析器已集成到Codex Tools MCP服务器中，可以通过MCP协议直接在AI客户端中使用。

### 功能特点

- 支持多种编程语言：JavaScript、TypeScript、Python、Java、C/C++、Go
- 自动检测代码语言类型
- 提取函数/方法信息（名称、参数、位置）
- 提取类/结构体信息（名称、继承关系、接口实现）
- 分析导入依赖关系
- 支持文件路径和代码字符串两种输入方式

### 分析结果结构

分析结果是一个包含以下字段的对象：

```javascript
{
  file: "文件路径",
  language: "语言类型",
  functions: [
    {
      name: "函数名",
      type: "函数类型",
      params: ["参数1", "参数2"],
      line: 行号,
      column: 列号
    }
  ],
  classes: [
    {
      name: "类名",
      type: "类类型",
      superClass: "父类名",
      interfaces: ["接口1", "接口2"],
      line: 行号,
      column: 列号
    }
  ],
  variables: [
    {
      name: "变量名",
      type: "变量类型",
      line: 行号,
      column: 列号
    }
  ],
  imports: [
    {
      source: "导入来源",
      type: "导入类型",
      imports: ["导入项1", "导入项2"]
    }
  ],
  exports: [
    {
      name: "导出项",
      type: "导出类型",
      line: 行号,
      column: 列号
    }
  ],
  dependencies: {
    imports: [],
    requires: [],
    functionCalls: [],
    propertyAccess: []
  },
  note: "注意信息（对于非JavaScript语言）"
}
```

### 支持的语言

#### JavaScript/TypeScript
完全支持，使用Babel解析器，能够准确提取所有代码结构信息。

#### Python
基础支持，使用正则表达式分析，能够提取：
- 函数定义
- 类定义
- 导入语句（import和from...import）

#### Java
基础支持，使用正则表达式分析，能够提取：
- 方法定义
- 类定义
- 导入语句

#### C/C++
基础支持，使用正则表达式分析，能够提取：
- 函数定义
- 类/结构体定义
- 包含指令（#include）

#### Go
基础支持，使用正则表达式分析，能够提取：
- 函数定义
- 结构体定义
- 导入语句（import）

### 使用示例

#### 分析Python代码

```javascript
const pythonCode = `
import os
import sys
from typing import List, Dict

class DataProcessor:
    def __init__(self, name):
        self.name = name
        self.data = []
    
    def process_data(self, input_data):
        result = []
        for item in input_data:
            if item > 0:
                result.append(item * 2)
        return result

def calculate_average(numbers):
    if not numbers:
        return 0
    return sum(numbers) / len(numbers)
`;

// 使用MCP工具分析
{
  "name": "analyze_code_string",
  "arguments": {
    "code": pythonCode,
    "language": "python"
  }
}
```

#### 分析Java代码

```javascript
const javaCode = `
import java.util.ArrayList;
import java.util.List;

public class UserManager {
    private List<User> users;
    
    public UserManager() {
        this.users = new ArrayList<>();
    }
    
    public void addUser(User user) {
        if (user != null) {
            users.add(user);
        }
    }
    
    public User findUserById(int id) {
        for (User user : users) {
            if (user.getId() == id) {
                return user;
            }
        }
        return null;
    }
}
`;

// 使用MCP工具分析
{
  "name": "analyze_code_string",
  "arguments": {
    "code": javaCode,
    "language": "java"
  }
}
```

### 注意事项

1. 对于非JavaScript语言（Python、Java、C/C++、Go），分析器使用正则表达式进行基本分析，可能无法处理复杂的语法结构。
2. 分析结果仅供参考，对于生产环境中的代码分析，建议使用专业的语言特定解析器。
3. 如果需要更精确的分析，可以考虑集成Tree-sitter等专业的多语言解析器库。

## 环境变量配置（可选）

您可以通过环境变量自定义服务器行为：

```json
{
  "mcpServers": {
    "codex-tools": {
      "command": "npx",
      "args": ["-y", "@youyao666/codex-tools-mcp@latest"],
      "env": {
        "CODEX_TOOLS_LOG_LEVEL": "info",
        "CODEX_TOOLS_MAX_FILE_SIZE": "10485760",
        "CODEX_TOOLS_ALLOWED_PATHS": "/path/to/allowed/directory"
      }
    }
  }
}
```

## 中文编码问题解决方案

### 问题描述
在Windows PowerShell环境中，Codex Tools MCP服务器处理中文字符时出现编码问题，导致中文字符被转换为问号(?)。

### 问题原因
1. PowerShell默认使用系统编码（通常是GBK/CP936），而不是UTF-8
2. 通过PowerShell的echo命令传递JSON-RPC请求时，中文字符被错误编码
3. Node.js接收到的已经是被错误编码的字符，无法正确还原

### 解决方案

#### 方案1：在PowerShell中设置UTF-8编码（推荐）
在运行Codex Tools MCP服务器之前，先设置PowerShell的编码：
```powershell
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = New-Object System.Text.UTF8Encoding
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "write_file", "arguments": {"path": "test.txt", "content": "这是中文内容"}}}' | node index.js
```

#### 方案2：使用Node.js脚本直接调用（最可靠）
创建一个Node.js脚本来直接调用Codex Tools MCP服务器，避免通过PowerShell传递中文字符：
```javascript
const { spawn } = require('child_process');

const mcpServer = spawn('node', ['index.js'], {
  cwd: __dirname,
  stdio: ['pipe', 'pipe', 'pipe'],
  encoding: 'utf8'
});

const request = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: {
    name: "write_file",
    arguments: {
      path: "test.txt",
      content: "这是中文内容"
    }
  }
};

mcpServer.stdin.write(JSON.stringify(request) + '\n');
```

#### 方案3：使用环境变量
设置NODE_OPTIONS环境变量：
```powershell
$env:NODE_OPTIONS="--encoding=utf8"
```

### 使用建议
1. 对于需要处理中文的场景，建议使用方案1或方案2
2. 可以创建一个PowerShell配置文件，自动设置UTF-8编码
3. 考虑使用WSL或Git Bash等默认支持UTF-8的终端环境

### 注意事项
1. 即使文件内容正确保存，PowerShell的输出可能仍显示为问号，这是PowerShell的显示问题，不影响文件内容
2. 可以通过检查文件的十六进制内容或使用其他编辑器验证文件是否正确保存

## 故障排除

### 常见问题

1. **命令未找到**
   - 确保已安装Node.js (v16或更高版本)
   - 检查网络连接，npx需要从NPM下载包

2. **权限错误**
   - 确保AI客户端有权限访问目标目录
   - 在Linux/macOS上可能需要使用chmod设置脚本权限

3. **编码问题**
   - Codex Tools MCP Server自动处理文件编码
   - 如果遇到编码问题，请确保文件是有效的文本文件

4. **ripgrep未找到**
   - grep_files工具需要安装ripgrep
   - Windows: `winget install BurntSushi.ripgrep.MSVC`
   - macOS: `brew install ripgrep`
   - Linux: `sudo apt-get install ripgrep` 或 `sudo yum install ripgrep`

### 调试模式

启用调试模式获取更多信息：

```json
{
  "mcpServers": {
    "codex-tools": {
      "command": "npx",
      "args": ["-y", "@youyao666/codex-tools-mcp@latest", "--debug"],
      "env": {
        "CODEX_TOOLS_LOG_LEVEL": "debug"
      }
    }
  }
}
```

## 安全注意事项

1. **路径限制**
   - 默认情况下，服务器限制访问当前工作目录及其子目录
   - 使用`CODEX_TOOLS_ALLOWED_PATHS`环境变量可以指定其他允许的路径

2. **命令执行**
   - 命令执行工具功能强大，请谨慎使用
   - 某些AI客户端可能默认禁用命令执行工具

3. **文件访问**
   - 服务器会验证路径，防止目录遍历攻击
   - 大文件读取会被限制，可通过`CODEX_TOOLS_MAX_FILE_SIZE`调整

## 版本历史

### v2.0.0 (当前版本)
- 添加智能文件读取工具 (read_file_advanced)
- 添加代码搜索工具 (grep_files)
- 添加计划管理工具 (update_plan)
- 添加流式命令执行工具 (exec_stream)
- 添加高级补丁应用工具 (apply_patch)
- 添加多语言代码分析工具 (analyze_code, analyze_code_string)
- 增强标准文件操作工具，支持自动编码检测
- 改进错误处理和日志记录

### v1.0.0
- 基础文件操作工具
- 命令执行工具
- Git操作工具
- 基本编码支持

## 许可证

MIT License



