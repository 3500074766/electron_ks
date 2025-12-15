const axios = require('axios');
// const dayjs = require('dayjs'); // 推荐使用 dayjs 处理时间，也可以用原生 Date

/**
 * 获取快手广告计划修改记录
 * @param {string|number} targetId - 计划ID (operationTargetId)
 * @param {string} cookie - 用户的 Cookie 字符串
 * @returns {Promise<Array>} - 返回处理后的前三条记录
 */
async function fetchPlanModifyRecords(targetId, cookie) {
  // 1. 计算日期：今天和明天
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 格式化日期为 YYYY-MM-DD 函数
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const beginTime = formatDate(today);
  const endTime = formatDate(tomorrow);

  console.log(`查询时间范围: ${beginTime} 至 ${endTime}`);

  // 2. 构造请求 URL 和 Payload
  // 注意：URL 中的 query 参数 (ph值) 可能需要根据实际情况动态获取，这里沿用原链接
  const url = "https://niu.e.kuaishou.com/rest/esp/operation/v1/query?kuaishou.ad.esp_ph=c39e7b7c89f3f3784d6956af27cf4cb93a1f";

  const payload = {
    operationTarget: 0,
    operationType: 0,
    roleType: 0,
    pageInfo: {
      currentPage: 1,
      pageSize: 10,
      totalCount: 0
    },
    pageNum: 1,
    pageSize: 50,
    operationTargetId: String(targetId), // 确保转为字符串
    beginTime: beginTime,
    endTime: endTime
  };

  // 3. 配置 Axios 请求头
  // 注意：x-nonce, ktrace-str, stamp 等通常是动态加密参数。
  // 如果直接复用旧的可能过期。如果接口校验严格，需要另外的加密函数生成这些值。
  // 这里仅演示 Cookie 和必要字段的封装。
  const config = {
    headers: {
      "accept": "application/json,*/*",
      "accept-language": "zh-CN,zh;q=0.9",
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "cookie": cookie,
      "Referer": "https://niu.e.kuaishou.com/storeManage?sceneOrientedType=21"
    }
  };

  try {
    // 4. 发送请求
    const response = await axios.post(url, payload, config);

    if (response.data.result !== 1) {
      throw new Error(`API 错误: ${response.data.msg}`);
    }

    const records = response.data.data.record || [];

    // 5. 数据处理：截取前3条并格式化
    const topThree = records.slice(0, 3).map(item => {
      // 解析时间戳
      const timeStr = new Date(item.time).toLocaleString('zh-CN', { hour12: false });

      // 获取字段变更详情 (取 fieldView 数组的第一项，通常只有一项变动)
      const fieldInfo = item.fieldView && item.fieldView.length > 0 ? item.fieldView[0] : {};

      return {
        操作时间: timeStr,                     // 修改时间
        操作事件: fieldInfo.fieldName,    // 操作事件/字段名
        原始值: fieldInfo.originalData, // 原始值
        改后值: fieldInfo.updatedData    // 修改后的值
      };
    });

    return topThree;

  } catch (error) {
    console.error("请求失败:", error.message);
    return [];
  }
}

// --- 使用示例 ---

// 假设这是传入的参数
const myTargetId = "5969002291";
const myCookie = "did=web_57444fdb8c62176b6be3cfe22de8dade; didv=1760678003000; bUserId=1000313014816; userId=2207857738; apdid=3d4bf151-4432-47a3-8a0f-1689248f4414290c3d08b8f000183cb75e436d2f1ff8:1765528409:1; kuaishou.ad.esp_st=ChJrdWFpc2hvdS5hZC5lc3Auc3QSoAE8kdM93LwECrSxh5M2crwZFgNwUJYGFRqXoszBiMQe0Xc5wXBhNJ7u8-eG6CY1q1GtW1LEZ8-DBfd8-zooeIj6k7odpzApKSXM3W8d5KxaOpn5b_BTLdjY0AmYg6sxqQVw6l3wIv1kM53eWDssXyf36l0boJo0NyE-2kDGn8uQvDPlqEWQKeSCrMgixiL-V9BGf0eDKk-aBFBYmqUVtjDNGhIvjhApkVyDknMoFajd0gmRJLAiIDVNdUyaUwAHEIztnhiT63kejDZFY3ccbWIDAHcM0wQJKAUwAQ; kuaishou.ad.esp_ph=c39e7b7c89f3f3784d6956af27cf4cb93a1f"; // 请填入完整的 Cookie

// 调用函数
fetchPlanModifyRecords(myTargetId, myCookie).then(data => {
  console.log("获取到的前三条记录：");
  console.log(JSON.stringify(data, null, 2));
});
