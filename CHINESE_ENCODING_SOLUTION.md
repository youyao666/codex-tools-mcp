# MCP服务器中文编码问题解决方案

## 问题描述
在Windows PowerShell环境中，MCP服务器处理中文字符时出现编码问题，导致中文字符被转换为问号(?)。

## 问题原因
1. PowerShell默认使用系统编码（通常是GBK/CP936），而不是UTF-8
2. 通过PowerShell的echo命令传递JSON-RPC请求时，中文字符被错误编码
3. Node.js接收到的已经是被错误编码的字符，无法正确还原

## 解决方案

### 方案1：在PowerShell中设置UTF-8编码（推荐）
在运行MCP服务器之前，先设置PowerShell的编码：
```powershell
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = New-Object System.Text.UTF8Encoding
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "write_file", "arguments": {"path": "test.txt", "content": "这是中文内容"}}}' | node index.js
```

### 方案2：使用Node.js脚本直接调用（最可靠）
创建一个Node.js脚本来直接调用MCP服务器，避免通过PowerShell传递中文字符：
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

### 方案3：使用环境变量
设置NODE_OPTIONS环境变量：
```powershell
$env:NODE_OPTIONS="--encoding=utf8"
```

## 代码改进
MCP服务器已经添加了编码检测和处理逻辑，在检测到可能的编码问题时会输出警告信息。

## 使用建议
1. 对于需要处理中文的场景，建议使用方案1或方案2
2. 可以创建一个PowerShell配置文件，自动设置UTF-8编码
3. 考虑使用WSL或Git Bash等默认支持UTF-8的终端环境

## 注意事项
1. 即使文件内容正确保存，PowerShell的输出可能仍显示为问号，这是PowerShell的显示问题，不影响文件内容
2. 可以通过检查文件的十六进制内容或使用其他编辑器验证文件是否正确保存