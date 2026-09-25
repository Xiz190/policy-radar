"""
性能测试脚本：生成 10 万条模拟数据，验证索引效果
使用方法：python3 scripts/benchmark_subscription_query.py
"""

import os
import sys
import time
import random
import string
from datetime import datetime, timedelta
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_batch


# ===== 配置 =====
# 从 .env.local 读取数据库连接
def load_env():
    env_path = Path(__file__).parent.parent / ".env.local"
    if not env_path.exists():
        print(f"错误：找不到 {env_path}")
        sys.exit(1)
    env = {}
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            env[k] = v
    return env


env = load_env()
DB_URL = env.get("DATABASE_URL", "")

# 模拟数据配置
NUM_ITEMS = 100000  # 生成 10 万条
BATCH_SIZE = 1000    # 每批插入数量

# 模拟部委列表
DEPARTMENTS = [
    "北京市人民政府", "国务院", "财政部", "工业和信息化部", "国家发展和改革委员会",
    "生态环境部", "农业农村部", "文化和旅游部", "国家林业和草原局", "国家烟草专卖局",
    "审计署", "水利部", "交通运输部", "人力资源和社会保障部", "教育部",
    "科技部", "住房和城乡建设部", "商务部", "国家卫生健康委员会", "市场监督管理总局",
    "北京市丰台区人民政府", "北京市大兴区人民政府", "北京市朝阳区人民政府", "北京市海淀区人民政府",
    "北京市经济和信息化局", "北京市交通委员会", "北京市财政局", "天津市人民政府",
    "河北省人民政府", "上海市人民政府",
]

# 模拟栏目
CHANNELS = [
    "政策文件", "通知公告", "政策解读", "动态新闻", "财政数据公开",
    "办事服务", "党建学习研究", "其他未归类", "要闻", "规划计划",
]

# 模拟关键词（用于生成标题）
KEYWORDS = [
    "人工智能", "科技创新", "数字经济", "高质量发展", "十四五规划",
    "试点示范", "资金支持", "补贴政策", "征求意见", "实施细则",
    "产业发展", "区域合作", "京津冀协同", "营商环境", "放管服",
    "智慧城市", "大数据", "云计算", "区块链", "新能源",
]

# 随机标题模板
TITLE_TEMPLATES = [
    "关于印发《{kw}发展实施方案》的通知",
    "{dept}关于{kw}的指导意见",
    "关于支持{kw}若干措施的通知",
    "{dept}印发《{kw}规划》",
    "关于开展{kw}试点工作的通知",
    "{kw}发展行动计划（2026-2028年）",
    "关于做好{kw}工作的通知",
    "{dept}关于推进{kw}的实施意见",
    "关于加强{kw}建设的指导意见",
    "{kw}专项资金管理办法",
]


def random_title():
    """生成随机标题"""
    tmpl = random.choice(TITLE_TEMPLATES)
    kw = random.choice(KEYWORDS)
    dept = random.choice(DEPARTMENTS)
    # 随机加入一些其他词汇
    extra = random.choice(["", "进一步", "加快推进", "加强", "深化"])
    return tmpl.format(kw=extra + kw, dept=dept)


def generate_items(start_id, count):
    """生成一批模拟数据"""
    items = []
    base_date = datetime(2020, 1, 1)
    for i in range(count):
        source_idx = random.randint(0, len(DEPARTMENTS) - 1)
        dept = DEPARTMENTS[source_idx]
        channel = random.choice(CHANNELS)
        source_id = f"test_src_{source_idx:03d}_{i % 50:03d}"
        url = f"https://example.com/{dept}/{channel}/{i}.html"
        title = random_title()
        # 随机日期（过去 6 年内）
        days_offset = random.randint(0, 365 * 6)
        pub_date = base_date + timedelta(days=days_offset)
        first_seen = pub_date + timedelta(hours=random.randint(0, 48))
        is_read = random.random() < 0.3
        is_starred = random.random() < 0.1
        keyword_score = random.randint(0, 200)
        importance = random.choice(
            ["普通", "普通", "普通", "中等重点", "重点内容", "核心关注"]
        )

        items.append({
            "source_id": source_id,
            "url": url,
            "title": title,
            "list_published_at": pub_date.date(),
            "first_seen_at": first_seen,
            "is_read": is_read,
            "is_starred": is_starred,
            "keyword_score": keyword_score,
            "importance_level": importance,
            "department_name": dept,
            "content_json": '["测试内容段落1", "测试内容段落2"]',
            "matched_categories": '[]',
            "matched_genres": '[]',
            "matched_keywords": '[]',
        })
    return items


def insert_data(conn):
    """插入测试数据"""
    print(f"\n===== 生成 {NUM_ITEMS} 条测试数据 =====")
    cur = conn.cursor()

    # 先看看现有数据量
    cur.execute("SELECT count(*) FROM monitor_items WHERE source_id LIKE 'test_src_%'")
    existing = cur.fetchone()[0]
    if existing > 0:
        print(f"已存在 {existing} 条测试数据，先清理...")
        cur.execute("DELETE FROM monitor_items WHERE source_id LIKE 'test_src_%'")
        conn.commit()
        print("清理完成")

    total_inserted = 0
    start_time = time.time()

    for batch_start in range(0, NUM_ITEMS, BATCH_SIZE):
        batch_count = min(BATCH_SIZE, NUM_ITEMS - batch_start)
        items = generate_items(batch_start, batch_count)

        sql = """
        INSERT INTO monitor_items (
            source_id, url, title, list_published_at, first_seen_at,
            is_read, is_starred, keyword_score, importance_level,
            department_name, content_json, matched_categories, matched_genres, matched_keywords
        ) VALUES (
            %(source_id)s, %(url)s, %(title)s, %(list_published_at)s, %(first_seen_at)s,
            %(is_read)s, %(is_starred)s, %(keyword_score)s, %(importance_level)s,
            %(department_name)s, %(content_json)s::jsonb, %(matched_categories)s::jsonb,
            %(matched_genres)s::jsonb, %(matched_keywords)s::jsonb
        )
        ON CONFLICT (source_id, url) DO NOTHING
        """
        execute_batch(cur, sql, items, page_size=BATCH_SIZE)
        conn.commit()

        total_inserted += batch_count
        elapsed = time.time() - start_time
        speed = total_inserted / elapsed if elapsed > 0 else 0
        eta = (NUM_ITEMS - total_inserted) / speed if speed > 0 else 0
        print(
            f"\r  进度: {total_inserted}/{NUM_ITEMS} ({total_inserted/NUM_ITEMS*100:.1f}%) "
            f"速度: {speed:.0f} 条/秒 预计剩余: {eta:.0f}s",
            end="",
        )

    print(f"\n插入完成！共 {total_inserted} 条，耗时 {time.time() - start_time:.1f}s")

    # 更新统计信息
    print("更新统计信息...")
    cur.execute("ANALYZE monitor_items")
    conn.commit()
    print("完成")

    return total_inserted


def run_query(cur, label, sql, params=None):
    """执行查询并计时"""
    params = params or []
    # 清空缓存（仅作参考，实际生产环境
    start = time.perf_counter()
    cur.execute(sql, params)
    result = cur.fetchall()
    elapsed = time.perf_counter() - start
    count = len(result)
    return elapsed, count, result


def benchmark(conn):
    """性能对比测试"""
    print("\n" + "=" * 60)
    print("  性能对比测试")
    print("=" * 60)

    cur = conn.cursor()

    # 先看总数据量
    cur.execute("SELECT count(*) FROM monitor_items")
    total = cur.fetchone()[0]
    print(f"\n总数据量: {total:,} 条")

    # 预热
    print("\n预热查询...")
    cur.execute("SELECT count(*) FROM monitor_items WHERE title LIKE '%测试%'")
    cur.fetchall()

    def bench(label, sql, params=None, repeat=5):
        """多次运行取平均值"""
        times = []
        count = 0
        for _ in range(repeat):
            t, c, _ = run_query(cur, label, sql, params)
            times.append(t)
            count = c
        avg = sum(times) / len(times)
        best = min(times)
        print(f"\n  {label}")
        print(f"    平均: {avg*1000:.2f}ms  最快: {best*1000:.2f}ms  结果数: {count}")
        return avg

    # ============ 1. 部委筛选 ==========
    print("\n" + "-" * 50)
    print("1. 部委筛选")
    print("-" * 50)

    # 使用冗余列
    bench(
        "部委筛选（冗余列 + 索引）",
        "SELECT count(*) FROM monitor_items WHERE department_name = %s",
        ["北京市人民政府"],
    )

    # 模拟 JOIN 版本（使用子查询模拟没有冗余列的情况
    bench(
        "部委筛选（子查询方式（模拟无冗余列）",
        """
        SELECT count(*)
        FROM monitor_items mi
        WHERE EXISTS (
            SELECT 1 FROM monitor_sources ms
            WHERE ms.id = mi.source_id AND ms.department_name = %s
        )
        """,
        ["北京市人民政府"],
    )

    # 全表扫描（无索引）
    bench(
        "部委筛选（全表扫描，无索引模拟",
        "SELECT count(*) FROM monitor_items WHERE coalesce(department_name, '') = %s",
        ["北京市人民政府"],
    )

    # ============ 2. 关键词模糊搜索 ==========
    print("\n" + "-" * 50)
    print("2. 关键词模糊搜索")
    print("-" * 50)

    # 有 trigram 索引
    bench(
        "关键词搜索（trigram GIN 索引）",
        "SELECT count(*) FROM monitor_items WHERE lower(title) LIKE %s",
        ["%人工智能%"],
    )

    # 强制全表扫描（绕过索引）
    bench(
        "关键词搜索（全表扫描，无索引）",
        "SELECT count(*) FROM monitor_items WHERE title ILIKE %s",
        ["%人工智能%"],
    )

    # 前缀匹配（可以用普通索引）
    bench(
        "前缀匹配（B-tree 索引）",
        "SELECT count(*) FROM monitor_items WHERE title LIKE %s",
        ["关于%"],
    )

    # ============ 3. 组合订阅筛选 ==========
    print("\n" + "-" * 50)
    print("3. 组合订阅筛选（部委 + 关键词）")
    print("-" * 50)

    bench(
        "组合筛选（冗余列 + trigram）",
        """
        SELECT count(*) FROM monitor_items
        WHERE department_name IN (%s, %s)
           OR lower(title) LIKE %s
        """,
        ["北京市人民政府", "工业和信息化部", "%人工智能%"],
    )

    # ============ 4. 分页查询（带排序） ==========
    print("\n" + "-" * 50)
    print("4. 分页查询（带排序，最常见场景）")
    print("-" * 50)

    bench(
        "按发现时间倒序 + 部委筛选（复合索引）",
        """
        SELECT source_id, title, department_name, first_seen_at
        FROM monitor_items
        WHERE department_name = %s
        ORDER BY first_seen_at DESC
        LIMIT 20 OFFSET 0
        """,
        ["北京市人民政府"],
    )

    bench(
        "按发现时间倒序 + 关键词筛选",
        """
        SELECT source_id, title, department_name, first_seen_at
        FROM monitor_items
        WHERE lower(title) LIKE %s
        ORDER BY first_seen_at DESC
        LIMIT 20 OFFSET 0
        """,
        ["%人工智能%"],
    )

    # ============ 5. EXPLAIN 查看执行计划 ==========
    print("\n" + "-" * 50)
    print("5. EXPLAIN 执行计划分析")
    print("-" * 50)

    def explain(label, sql, params=None):
        print(f"\n  {label}:")
        cur.execute("EXPLAIN " + sql, params or [])
        for row in cur.fetchall():
            print(f"    {row[0]}")

    explain(
        "部委筛选（冗余列）",
        "SELECT count(*) FROM monitor_items WHERE department_name = '北京市人民政府'",
    )

    explain(
        "关键词搜索（trigram）",
        "SELECT count(*) FROM monitor_items WHERE lower(title) LIKE '%人工智能%'",
    )

    explain(
        "分页 + 排序 + 部委筛选",
        """
        SELECT source_id, title
        FROM monitor_items
        WHERE department_name = '北京市人民政府'
        ORDER BY first_seen_at DESC
        LIMIT 20
        """,
    )

    cur.close()


def main():
    if not DB_URL:
        print("错误：DATABASE_URL 未配置")
        sys.exit(1)

    print("连接数据库...")
    conn = psycopg2.connect(DB_URL)
    print("连接成功")

    try:
        # 生成测试数据
        insert_data(conn)

        # 性能测试
        benchmark(conn)

    finally:
        conn.close()
        print("\n完成！")


if __name__ == "__main__":
    main()
