const axios = require('axios');

/**
 * 获取快手牛牛/磁力金牛钱包列表
 * @param {string} cookie - 完整的 Cookie 字符串
 * @returns {Promise<Object>} - 接口返回的数据
 */
async function getWalletList(cookie) {
  const url = 'https://niu.e.kuaishou.com/rest/n/wallet/pay/walletList';

  // 核心请求头
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
    'Referer': 'https://niu.e.kuaishou.com/newFinance/accountWallet',
    'Cookie': cookie,

    // 业务相关 Header (必须保留)
    'app-key': 'ad.adUkmConfig.adEsp',
    'esp-entrysrc': '204',
    'esp-platform': 'pc',
    'requestsource': 'PC',
  };

  try {
    const response = await axios.get(url, {
      params: {
        amount: 0,
        buyType: 1
      },
      headers: headers
    });

    return (response.data.data.walletList[0].totalAmount / 1000).toFixed(2);
  } catch (error) {
    console.error('请求失败:', error.response ? error.response.status : error.message);
    throw error;
  }
}

// --- 使用示例 ---

// 这里的 cookie 仅为示例，请替换为你抓包获取的真实 cookie
const myCookie = 'did=web_57444fdb8c62176b6be3cfe22de8dade; didv=1760678003000; bUserId=1000313014816; userId=2207857738; kuaishou.ad.esp_st=ChJrdWFpc2hvdS5hZC5lc3Auc3QSoAHgC7_JQHVssfBAJR7BIhOlXkYMF-pF6ZAVgFNeeQblYX3RlF3nFzG8i82AwUVZ1yI37xpv173DZLM8oZE3RGpQ20TiB7PutN9Wz0gVLgcLvlSzMgNdl1lBeUAV6u9cDesxnG6gFPGgI5989lP11ZqWw_jQQPmMw5n9xUSzAXMTAChntN1ttDvuQ-oi246p-tQ2njTaVeRw5seKmqJfqXSlGhJmJ9PQbqW-D4OQRZiueLLO3XEiIMnvdCU-e55ciHbCSVwJsuXS_xb95r8pwkICGz2wqr1BKAUwAQ; kuaishou.ad.esp_ph=1e59576bdaf85a3af5d0518551026a353c81'

getWalletList(myCookie)
  .then(data => {
    console.log('钱包列表数据:', JSON.stringify(data, null, 2));
  })
  .catch(err => {
    console.error('获取失败');
  });
