# IDE Tools MCP Server

## 项目简介

IDE Tools MCP Server 是一个基于Codex技术开发的MCP（Model Context Protocol）服务器，旨在为AI助手提供强大的IDE集成工具集。该项目将复杂的IDE功能抽象为简单易用的工具接口，使AI能够直接与开发环境进行交互，实现代码编写、文件管理、版本控制等核心开发任务的自动化。

## 核心特性

- **基于Codex技术增强**：利用先进的代码理解能力，提供更智能的开发辅助
- **一站式开发工具集**：集成文件操作、命令执行、Git管理等核心开发功能
- **MCP协议兼容**：遵循Model Context Protocol标准，可与多种AI客户端无缝集成
- **安全可控**：提供细粒度的权限控制，确保开发环境的安全性

## 功能概述

此服务器提供以下工具：

1. **文件系统操作**
   - `read_file`: 读取文件内容
   - `write_file`: 写入文件内容
   - `list_directory`: 列出目录内容

2. **命令执行**
   - `execute_command`: 执行系统命令

3. **Git操作**
   - `git_status`: 获取Git仓库状态
   - `git_diff`: 获取Git仓库的差异

## 应用场景

- **AI辅助编程**：为AI助手提供直接访问IDE的能力，实现更精准的代码修改和生成
- **自动化开发流程**：通过AI自动执行重复性开发任务，提高开发效率
- **智能代码审查**：结合AI的代码理解能力，自动化代码质量检查
- **项目文档生成**：自动分析代码结构，生成项目文档和API说明

## 项目文件结构

```
ide-tools-mcp/
├── .gitignore              # Git忽略文件配置
├── CHINESE_ENCODING_SOLUTION.md  # 中文编码解决方案文档
├── index.js                # 主程序入口文件，实现MCP服务器
├── package.json            # 项目依赖和脚本配置
├── package-lock.json       # 锁定依赖版本
└── README.md               # 项目说明文档
```

### 核心文件说明

- **index.js**: 项目的核心文件，实现了MCP协议服务器，提供文件操作、命令执行和Git管理等工具
  - 包含IDEToolsServer类，负责处理所有MCP协议交互
  - 实现了路径验证、操作日志记录等安全功能
  - 支持多种文件编码格式，包括UTF-8、GBK、GB2312等
  - 提供了完整的Git操作工具集

- **package.json**: 定义了项目依赖和运行脚本，包含项目元数据
  - 主要依赖：@modelcontextprotocol/sdk、iconv-lite、jschardet
  - 提供了启动命令：`npm start`

- **CHINESE_ENCODING_SOLUTION.md**: 解决中文编码问题的详细方案文档
  - 详细说明了Windows环境下中文编码问题的解决方案
  - 提供了多种编码格式的处理方法

- **.gitignore**: 指定Git版本控制应忽略的文件和目录

### 依赖说明

项目依赖以下核心库：

- **@modelcontextprotocol/sdk**: MCP协议的官方SDK，用于实现MCP服务器
- **iconv-lite**: 轻量级字符编码转换库，支持多种编码格式
- **jschardet**: 字符编码检测库，用于自动检测文件编码

## 代码实现特点

### 安全性设计
- **路径验证**: 实现了严格的路径验证机制，防止目录遍历攻击
- **操作日志**: 记录所有文件操作，便于审计和追踪
- **权限控制**: 提供细粒度的权限管理，确保系统安全

### 编码处理
- **自动检测**: 使用jschardet库自动检测文件编码格式
- **多编码支持**: 支持UTF-8、GBK、GB2312、Big5、Shift_JIS等多种编码
- **编码转换**: 使用iconv-lite库进行可靠的编码转换

### 工具集完整性
- **文件操作**: 提供读取、写入、目录列表等基本文件操作
- **命令执行**: 支持执行系统命令，并获取输出结果
- **Git集成**: 提供完整的Git操作工具集，包括状态、差异、提交、推送、拉取和分支管理

### 跨平台兼容
- **Windows优化**: 特别针对Windows环境进行了编码优化
- **路径处理**: 正确处理不同操作系统的路径分隔符
- **命令适配**: 适配不同操作系统的命令行工具

## 技术架构

本项目采用模块化设计，主要包含以下组件：

- **MCP协议层**：负责与AI客户端的通信和协议解析
- **工具抽象层**：将IDE功能抽象为标准化的工具接口
- **执行引擎**：负责具体工具的执行和结果返回
- **安全控制**：提供权限管理和安全检查机制

## 安装

```bash
npm install
```

## 使用方法

### 作为MCP服务器运行

```bash
npm start
```

### 在Claude Desktop中配置

在Claude Desktop的配置文件中添加以下内容：

```json
{
  "mcpServers": {
    "ide-tools": {
      "command": "node",
      "args": ["F:\\github ai\\ide-tools-mcp\\index.js"],
      "env": {}
    }
  }
}
```

### 在其他AI客户端中使用

1. 确保MCP服务器正在运行
2. 配置客户端连接到此服务器
3. 使用提供的工具进行文件操作、命令执行和Git操作

## 工具详细说明

### read_file
读取指定路径的文件内容。

参数：
- `path` (必需): 要读取的文件路径

### write_file
向指定路径写入文件内容。

参数：
- `path` (必需): 要写入的文件路径
- `content` (必需): 要写入的内容

### list_directory
列出指定目录的内容。

参数：
- `path` (必需): 要列出的目录路径

### execute_command
执行系统命令。

参数：
- `command` (必需): 要执行的命令
- `cwd` (可选): 命令执行的工作目录

### git_status
获取Git仓库的状态。

参数：
- `path` (可选): Git仓库路径，默认为当前目录

### git_diff
获取Git仓库的差异。

参数：
- `path` (可选): Git仓库路径，默认为当前目录
- `file` (可选): 特定文件的差异

## 注意事项

1. 此服务器提供了对文件系统和命令执行的工具，请确保在安全的环境中运行
2. 执行命令时，请谨慎使用，避免执行危险的命令
3. 在生产环境中使用时，考虑添加额外的安全措施

## 贡献指南

我们欢迎社区贡献！如果您想为此项目做出贡献，请遵循以下步骤：

1. Fork 本仓库
2. 创建您的功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request

## 关于AI辅助开发

本项目在开发过程中使用了AI辅助编程工具



