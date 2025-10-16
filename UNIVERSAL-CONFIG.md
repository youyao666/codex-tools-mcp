# IDE Tools MCP Server - 通用配置指南

## 快速配置方式

### 方式一：使用NPM包（推荐）

最简单的方式是使用NPM包，无需下载或配置任何文件：

```json
{
  "mcpServers": {
    "ide-tools": {
      "command": "npx",
      "args": ["-y", "@youyao666/ide-tools-mcp"]
    }
  }
}
```

### 方式二：使用本地安装

1. 下载并解压IDE Tools MCP Server
2. 运行安装脚本：
   - Windows: `install.bat`
   - Linux/macOS: `chmod +x install.sh && ./install.sh`

3. 在您的AI客户端配置文件中添加：

```json
{
  "mcpServers": {
    "ide-tools": {
      "command": "node",
      "args": ["[安装路径]/index.js"]
    }
  }
}
```

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
    "ide-tools": {
      "command": "npx",
      "args": ["-y", "@youyao666/ide-tools-mcp"]
    }
  }
}
```

### Cline (VSCode扩展)

在设置中添加：

```json
{
  "cline.mcpServers": {
    "ide-tools": {
      "command": "npx",
      "args": ["-y", "@youyao666/ide-tools-mcp"]
    }
  }
}
```

### 自定义MCP客户端

如果您使用的是自定义MCP客户端，请参考以下标准配置格式：

```json
{
  "mcpServers": {
    "ide-tools": {
      "command": "npx",
      "args": ["-y", "@youyao666/ide-tools-mcp"],
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
    "ide-tools": {
      "command": "npx",
      "args": ["-y", "@youyao666/ide-tools-mcp"],
      "env": {
        "IDE_TOOLS_LOG_LEVEL": "info",
        "IDE_TOOLS_MAX_FILE_SIZE": "10485760",
        "IDE_TOOLS_ALLOWED_PATHS": "/path/to/allowed/directory"
      }
    }
  }
}
```

## 故障排除

### 常见问题

1. **命令未找到**
   - 确保已安装Node.js (v16或更高版本)
   - 检查网络连接，npx需要从NPM下载包

2. **权限错误**
   - 确保AI客户端有权限访问目标目录
   - 在Linux/macOS上可能需要使用chmod设置脚本权限

3. **编码问题**
   - IDE Tools MCP Server自动处理文件编码
   - 如果遇到编码问题，请确保文件是有效的文本文件

### 调试模式

启用调试模式获取更多信息：

```json
{
  "mcpServers": {
    "ide-tools": {
      "command": "npx",
      "args": ["-y", "@youyao666/ide-tools-mcp", "--debug"],
      "env": {
        "IDE_TOOLS_LOG_LEVEL": "debug"
      }
    }
  }
}
```

## 安全注意事项

1. **路径限制**
   - 默认情况下，服务器限制访问当前工作目录及其子目录
   - 使用`IDE_TOOLS_ALLOWED_PATHS`环境变量可以指定其他允许的路径

2. **命令执行**
   - 命令执行工具功能强大，请谨慎使用
   - 某些AI客户端可能默认禁用命令执行工具

3. **文件访问**
   - 服务器会验证路径，防止目录遍历攻击
   - 大文件读取会被限制，可通过`IDE_TOOLS_MAX_FILE_SIZE`调整

## 更多信息

- 项目主页: [GitHub仓库链接]
- 问题反馈: [Issues链接]
- 文档: [文档链接]