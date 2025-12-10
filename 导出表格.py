import sqlite3
import csv
import json
import os
import datetime
import sys

# ================= 配置区域 =================
# 数据库文件名 (新架构生成的业务数据库)
DB_FILENAME = 'app_data.db' 

# 如果你要导出的是账号库 Sqlite3.db，请将上面改为 'Sqlite3.db'
# 并修改下面 SQL 语句为: SELECT * FROM Mysqlks
# ===========================================

def get_db_path():
    """
    尝试查找数据库路径:
    1. 优先检查脚本当前目录
    2. 其次检查常见的 Electron AppData 目录
    """
    # 1. 检查当前脚本所在目录
    current_dir_db = os.path.join(os.getcwd(), DB_FILENAME)
    if os.path.exists(current_dir_db):
        return current_dir_db
    
    # 2. 检查 Electron 默认的用户数据目录 (Windows: AppData/Roaming/你的应用名)
    # 注意：开发环境下 electron 应用名通常是 'Electron' 或 'your-app-name'
    app_data = os.getenv('APPDATA')
    if app_data:
        # 这里假设你的应用名可能叫 electron-app 或者 electron，你可以根据实际情况添加
        potential_folders = ['electron-app', 'Electron', 'electron', 'your-app-name']
        for folder in potential_folders:
            path = os.path.join(app_data, folder, DB_FILENAME)
            if os.path.exists(path):
                return path
            
    return None

def export_to_csv():
    print("--- 开始导出数据 ---")
    db_path = get_db_path()
    
    if not db_path:
        print(f"❌ 错误: 在当前目录下未找到 '{DB_FILENAME}'。")
        print("请将此脚本放到数据库文件(app_data.db)所在的文件夹中运行。")
        return

    print(f"📂 正在读取数据库: {db_path}")

    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # 查询数据
        # 假设使用的是新架构的 user_stats 表
        try:
            cursor.execute("SELECT uid, name, data, updated_at FROM user_stats")
            rows = cursor.fetchall()
        except sqlite3.OperationalError as e:
            print(f"❌ 数据库读取错误: {e}")
            print("提示: 如果你是想导出旧的账号库(Sqlite3.db)，表名应该是 Mysqlks 而不是 user_stats。")
            return

        if not rows:
            print("⚠️ 数据库中没有数据。")
            return

        print(f"📊 找到 {len(rows)} 条记录，正在处理...")

        export_rows = []
        # 收集所有动态字段名 (因为 data 是 JSON，每个人可能字段不一样)
        all_keys = set(['UID', '名称', '更新时间'])

        for row in rows:
            uid, name, data_json, updated_at = row
            
            # 解析 JSON 业务数据 (GMV, ROI, 消耗等)
            stats = {}
            if data_json:
                try:
                    stats = json.loads(data_json)
                except json.JSONDecodeError:
                    stats = {'raw_data': data_json} # 解析失败则保留原样

            # 格式化时间戳
            time_str = ''
            if updated_at:
                try:
                    # 假设是毫秒时间戳
                    time_str = datetime.datetime.fromtimestamp(updated_at / 1000).strftime('%Y-%m-%d %H:%M:%S')
                except:
                    time_str = str(updated_at)

            # 构建一行数据
            flat_row = {
                'UID': uid,
                '名称': name,
                '更新时间': time_str
            }
            # 合并统计数据 (这会把 'GMV', '花费' 等字段加进来)
            flat_row.update(stats)
            
            # 记录新的表头字段
            all_keys.update(stats.keys())
            export_rows.append(flat_row)

        # --- 生成 CSV ---
        
        # 1. 整理表头顺序: 固定字段在前，其他字段按字母排序
        fixed_headers = ['UID', '名称', 'GMV', '花费', '消耗', '全站ROI', 'roi', '订单数', '更新时间']
        # 过滤掉已经固定的，剩下的动态字段
        dynamic_headers = sorted([k for k in all_keys if k not in fixed_headers])
        # 最终表头 (只包含实际存在的字段)
        final_headers = [h for h in fixed_headers if h in all_keys] + dynamic_headers

        # 2. 生成文件名
        timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'快手数据报表_{timestamp}.csv'

        # 3. 写入文件
        # encoding='utf-8-sig' 是关键，这会让 Excel 正确识别中文
        with open(filename, 'w', newline='', encoding='utf-8-sig') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=final_headers)
            writer.writeheader()
            writer.writerows(export_rows)

        print(f"✅ 导出成功！")
        print(f"📄 文件保存为: {os.path.abspath(filename)}")

    except Exception as e:
        print(f"❌ 发生未知错误: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    export_to_csv()
    # 防止双击运行后窗口立即关闭
    input("\n按回车键退出...")