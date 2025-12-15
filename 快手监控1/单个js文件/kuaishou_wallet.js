const axios = require('axios');

/**
 * 快手磁力牛充值函数
 * @param {number} amount - 充值金额 (例如: 52)
 */
async function rechargeWallet(amount, ck) {
  // 基础 URL
  const baseUrl = 'https://niu.e.kuaishou.com/rest/n/gateway/wallet/recharge';

  // 请求体
  const data = {
    "walletType": 1,
    "payChannel": 0,
    "rechargeAmount": amount * 1000, // 动态传入金额
    "tradeType": 2,
    "payWay": 3
  };

  // 请求头配置
  // 注意：以下 security/signature headers (stamp, nonce, sature) 通常是根据当前时间和请求体动态生成的。
  // 如果直接使用抓包的固定值，可能会因为“请求过期”或“签名错误”而失败。
  const headers = {
    // === 核心身份认证 ===
    "cookie": ck,
    "app-key": "ad.adUkmConfig.adEsp",
    "content-type": "application/json",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36" // 建议保留 User-Agent
  };

  try {
    const response = await axios.post(baseUrl, data, {
      headers: headers,
    });
    let data = {
      rechargeStatus: response.data.rechargeStatus,
      payCode: response.data.payCode,
      merchantCode: response.data.merchantCode,
    };
    console.log("请求成功:", data);
    return data;
  } catch (error) {
    console.error("请求失败:", error.response ? error.response.data : error.message);
  }
}

// 调用示例：充值 52000
rechargeWallet(52000);
