const fs = require('fs');

// 1. 模拟 Sub-Store 注入的参数
global.$arguments = {
  name: 'iKuuu',
  sn: '-',
  flag: true,
  bl: true,
  blgd: true,
  clear: true // 开启清理乱码选项
};

// 2. 加载目标脚本
const code = fs.readFileSync('./sub-store-rename.js', 'utf-8');
eval(code);

// 3. 在这里填入你的真实订阅链接 (Clash格式 或 Base64通用格式 均可)
const SUB_URL = "https://your-subscription-url-here";

async function fetchAndTest(url) {
  if (!url.startsWith('http')) {
    console.log("【提示】请在 test.js 第16行填入真实的订阅链接");
    return;
  }

  console.log(`正在获取订阅: ${url} ...`);
  try {
    const response = await fetch(url);
    let text = await response.text();
    let mockProxies = [];

    // 简单判断是否是Base64编码（不包含基础明文特征的话则解码）
    if (!text.includes('proxies:') && !text.includes('://')) {
      try { text = Buffer.from(text, 'base64').toString('utf-8'); } catch (e) {}
    }

    // 粗略解析订阅中的节点名称
    if (text.includes('proxies:')) { // 针对 Clash YAML 格式
      const lines = text.split('\n');
      let inProxiesSection = false;
      for (let line of lines) {
        // 发现 proxies: 开头，进入节点区
        if (/^proxies:/.test(line)) {
          inProxiesSection = true;
          continue;
        } 
        // 遇到其他顶层配置（如 proxy-groups:, rules: 等），退出节点区
        else if (/^[a-zA-Z0-9_\-]+:/.test(line)) {
          inProxiesSection = false;
        }

        if (inProxiesSection) {
          // 支持多行格式: - name: "节点名字"
          // 以及单行格式: - {name: 节点名字, server: ...}
          const match = line.match(/^ {0,4}-\s*(?:\{\s*)?name:\s*(['"]?)(.+?)\1\s*(?:,|}|$)/);
          if (match) mockProxies.push({ name: match[2].trim() });
        }
      }
    } else { // 针对 通用节点 URI (v2ray/ss/trojan)
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      for (let line of lines) {
        try {
          if (line.startsWith('vmess://')) {
            const jsonStr = Buffer.from(line.slice(8), 'base64').toString('utf-8');
            const json = JSON.parse(jsonStr);
            if (json.ps) mockProxies.push({ name: json.ps });
          } else if (line.includes('#')) { // ss://...#name
            const name = decodeURIComponent(line.substring(line.lastIndexOf('#') + 1));
            mockProxies.push({ name: name });
          }
        } catch (e) { } // 忽略解析失败的行
      }
    }

    if (mockProxies.length === 0) {
      console.log("未能从该链接解析到节点，请检查链接或订阅格式。");
      return;
    }

    console.log(`========== 成功解析到 ${mockProxies.length} 个原始节点 ==========`);
    console.log(mockProxies.map(p => p.name).slice(0, 10).join('\n') + (mockProxies.length > 10 ? '\n... (仅显示前10个)' : ''));

    // 4. 调用 rename 脚本的 operator 函数进行测试
    const result = operator(mockProxies);

    console.log(`\n========== 处理后的节点 (数量: ${result.length}) ==========`);
    console.log(result.map(p => p.name).slice(0, 10).join('\n') + (result.length > 10 ? '\n... (仅显示前10个)' : ''));
    
  } catch(e) {
    console.error("请求或解析报错:", e);
  }
}

fetchAndTest(SUB_URL);

