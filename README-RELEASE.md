# IDE Tools MCP Server - 发行版

一个通用的MCP服务器，为AI客户端提供IDE工具功能，包括文件操作、命令执行和Git集成。

## 快速开始

### 方式一：使用NPM包（推荐）

无需下载任何文件，只需在您的AI客户端配置中添加以下内容：

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

### 方式二：本地安装

1. 下载并解压此发行版
2. 运行安装脚本：
   - Windows: 双击 `install.bat`
   - Linux/macOS: `chmod +x install.sh && ./install.sh`

3. 在您的AI客户端配置中添加：
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

## 通用配置工具

我们提供了通用的配置工具，帮助您快速生成适用于各种AI客户端的配置：

- Windows: 运行 `universal-config.bat`
- Linux/macOS: 运行 `chmod +x universal-config.sh && ./universal-config.sh`

## 支持的AI客户端

- Claude Desktop
- Continue.dev
- Cline (VSCode扩展)
- 任何支持标准MCP协议的客户端

详细的配置说明请参考 [UNIVERSAL-CONFIG.md](UNIVERSAL-CONFIG.md)

## 可用工具

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

## 特性

- **多编码支持**: 自动检测和处理不同编码格式的文件
- **跨平台兼容**: 支持Windows、Linux和macOS
- **安全设计**: 内置路径验证，防止目录遍历攻击
- **操作日志**: 记录所有操作，便于调试和审计

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

## 许可证

MIT License