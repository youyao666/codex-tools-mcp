#!/bin/bash

echo "Codex Tools MCP Server - 通用MCP配置工具"
echo

echo "选择配置方式:"
echo "1. 使用NPM包 (推荐) - 无需下载，自动获取最新版本"
echo "2. 使用本地安装 - 需要先下载并安装服务器"
echo "3. 生成配置文件 - 仅生成配置文件，不安装"
echo
read -p "请输入选项 (1-3): " choice

if [ "$choice" == "1" ]; then
    echo
    echo "您的MCP服务器配置:"
    echo
    echo "{"
    echo "  \"mcpServers\": {"
    echo "    \"codex-tools\": {"
    echo "      \"command\": \"npx\","
    echo "      \"args\": [\"-y\", \"@youyao666/codex-tools-mcp\"]"
    echo "    }"
    echo "  }"
    echo "}"
    echo
    echo "将以上配置添加到您的AI客户端配置文件中"
    echo
    echo "支持的AI客户端:"
    echo "- Claude Desktop"
    echo "- Continue.dev"
    echo "- Cline (VSCode扩展)"
    echo "- 其他标准MCP客户端"
    echo
    echo "配置文件位置示例:"
    echo "- Claude Desktop (macOS): ~/Library/Application Support/Claude/claude_desktop_config.json"
    echo "- Claude Desktop (Linux): ~/.config/claude/claude_desktop_config.json"
    echo
    echo "通用配置格式已保存到 mcp-config-example.json"
elif [ "$choice" == "2" ]; then
    echo
    echo "正在检查本地安装..."
    if [ ! -f "index.js" ]; then
        echo "错误: 未找到本地安装文件"
        echo "请先下载并安装Codex Tools MCP Server"
        echo
        echo "您可以运行 ./install.sh 进行安装"
    else
        current_dir=$(pwd)
        echo "您的MCP服务器配置:"
        echo
        echo "{"
        echo "  \"mcpServers\": {"
        echo "    \"codex-tools\": {"
        echo "      \"command\": \"node\","
        echo "      \"args\": [\"$current_dir/index.js\"]"
        echo "    }"
        echo "  }"
        echo "}"
        echo
        echo "将以上配置添加到您的AI客户端配置文件中"
        echo
        echo "支持的AI客户端:"
        echo "- Claude Desktop"
        echo "- Continue.dev"
        echo "- Cline (VSCode扩展)"
        echo "- 其他标准MCP客户端"
    fi
elif [ "$choice" == "3" ]; then
    echo
    echo "正在生成配置文件..."
    
    cat > mcp-config.json << EOF
{
  "mcpServers": {
    "codex-tools": {
      "command": "npx",
      "args": ["-y", "@youyao666/codex-tools-mcp"]
    }
  }
}
EOF
    
    echo "配置文件已生成: mcp-config.json"
    echo
    echo "您可以将此文件内容复制到您的AI客户端配置中"
else
    echo "无效选项，请重新运行脚本"
fi

echo