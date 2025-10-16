# Codex Tools MCP Server

一个通用的MCP服务器，为AI客户端提供IDE工具功能，包括文件操作、命令执行和Git集成。

## 快速开始

### 方式一：使用NPM包（推荐）

无需下载任何文件，只需在您的AI客户端配置中添加以下内容：

```json
{
  "mcpServers": {
    "codex-tools": {
      "command": "npx",
      "args": ["-y", "@youyao666/codex-tools-mcp"]
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
      "args": ["-y", "@youyao666/codex-tools-mcp"]
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
      "args": ["-y", "@youyao666/codex-tools-mcp"]
    }
  }
}
```

### 自定义MCP客户端

如果您使用的是自定义MCP客户端，请参考以下标准配置格式：

```json
{
  "mcpServers": {
    "codex-tools": {
      "command": "npx",
      "args": ["-y", "@youyao666/codex-tools-mcp"],
      "env": {}
    }
  }
}
```

## 可用工具列表

配置完成后，您将获得以下工具：

### 文件操作工具
- `read_file` - 读取文件内容
- `write_file` - 写入文件内容
- `list_directory` - 列出目录内容
- `create_directory` - 创建目录
- `delete_file` - 删除文件或目录
- `move_file` - 移动或重命名文件

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

## 环境变量配置（可选）

您可以通过环境变量自定义服务器行为：

```json
{
  "mcpServers": {
    "codex-tools": {
      "command": "npx",
      "args": ["-y", "@youyao666/codex-tools-mcp"],
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

### 调试模式

启用调试模式获取更多信息：

```json
{
  "mcpServers": {
    "codex-tools": {
      "command": "npx",
      "args": ["-y", "@youyao666/codex-tools-mcp", "--debug"],
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

## 许可证

MIT License



