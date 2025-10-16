@echo off
echo IDE Tools MCP Server - 通用MCP配置工具
echo.

echo 选择配置方式:
echo 1. 使用NPM包 (推荐) - 无需下载，自动获取最新版本
echo 2. 使用本地安装 - 需要先下载并安装服务器
echo 3. 生成配置文件 - 仅生成配置文件，不安装
echo.
set /p choice="请输入选项 (1-3): "

if "%choice%"=="1" (
    echo.
    echo 您的MCP服务器配置:
    echo.
    echo {
    echo   "mcpServers": {
    echo     "ide-tools": {
    echo       "command": "npx",
    echo       "args": ["-y", "@youyao666/ide-tools-mcp"]
    echo     }
    echo   }
    echo }
    echo.
    echo 将以上配置添加到您的AI客户端配置文件中
    echo.
    echo 支持的AI客户端:
    echo - Claude Desktop
    echo - Continue.dev
    echo - Cline (VSCode扩展)
    echo - 其他标准MCP客户端
    echo.
    echo 配置文件位置示例:
    echo - Claude Desktop (Windows): %%APPDATA%%\Claude\claude_desktop_config.json
    echo - Claude Desktop (macOS): ~/Library/Application Support/Claude/claude_desktop_config.json
    echo - Claude Desktop (Linux): ~/.config/claude/claude_desktop_config.json
    echo.
    echo 通用配置格式已保存到 mcp-config-example.json
) else if "%choice%"=="2" (
    echo.
    echo 正在检查本地安装...
    if not exist "index.js" (
        echo 错误: 未找到本地安装文件
        echo 请先下载并安装IDE Tools MCP Server
        echo.
        echo 您可以运行 install.bat 进行安装
    ) else (
        echo 您的MCP服务器配置:
        echo.
        echo {
        echo   "mcpServers": {
        echo     "ide-tools": {
        echo       "command": "node",
        echo       "args": ["%cd%\index.js"]
        echo     }
        echo   }
        echo }
        echo.
        echo 将以上配置添加到您的AI客户端配置文件中
        echo.
        echo 支持的AI客户端:
        echo - Claude Desktop
        echo - Continue.dev
        echo - Cline (VSCode扩展)
        echo - 其他标准MCP客户端
    )
) else if "%choice%"=="3" (
    echo.
    echo 正在生成配置文件...
    
    echo { > mcp-config.json
    echo   "mcpServers": { >> mcp-config.json
    echo     "ide-tools": { >> mcp-config.json
    echo       "command": "npx", >> mcp-config.json
    echo       "args": ["-y", "@youyao666/ide-tools-mcp"] >> mcp-config.json
    echo     } >> mcp-config.json
    echo   } >> mcp-config.json
    echo } >> mcp-config.json
    
    echo 配置文件已生成: mcp-config.json
    echo.
    echo 您可以将此文件内容复制到您的AI客户端配置中
) else (
    echo 无效选项，请重新运行脚本
)

echo.
pause