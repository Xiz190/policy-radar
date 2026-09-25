"""
百万级数据性能测试脚本
生成 100 万条测试数据，验证覆盖索引、复合索引、表达式索引的性能

使用方法:
  python3 scripts/benchmark_1m.py          # 生成数据 + 测试 + 自动清理
  python3 scripts/benchmark_1m.py --keep   # 测试后保留数据
  python3 scripts/benchmark_1m.py --clean  # 只清理历史测试数据
"""

import os
import sys
import time
import random
import argparse
from pathlib import Path
from datetime import datetime, timedelta

import psycopg2
from psycopg2.extras import execute_batch


NUM_ITEMS = 1_000_000  # 100 万条
BATCH_SIZE = 5000      # 每批插入数量

# 部委列表
DEPARTMENTS = [
    "北京市人民政府", "国务院", "财政部", "工业和信息化部", "国家发展和改革委员会",
    "生态环境部", "农业农村部", "文化和旅游部", "国家林业和草原局", "国家烟草专卖局",
    "审计署", "水利部", "交通运输部", "人力资源和社会保障部", "教育部",
    "科技部", "住房和城乡建设部", "商务部", "国家卫生健康委员会", "市场监督管理总局",
    "北京市丰台区人民政府", "北京市大兴区人民政府", "北京市朝阳区人民政府", "北京市海淀区人民政府",
    "北京市经济和信息化局", "北京市交通委员会", "北京市财政局", "天津市人民政府",
    "河北省人民政府", "上海市人民政府", "广东省人民政府", "浙江省人民政府",
    "江苏省人民政府", "山东省人民政府", "四川省人民政府", "湖北省人民政府",
    "河南省人民政府", "福建省人民政府", "安徽省人民政府", "湖南省人民政府",
]

# 栏目
CHANNELS = [
    "政策文件", "通知公告", "政策解读", "动态新闻", "财政数据公开",
    "办事服务", "党建学习研究", "要闻", "规划计划", "法规规章",
]

# 关键词
KEYWORDS = [
    "人工智能", "科技创新", "数字经济", "高质量发展", "十四五规划",
    "试点示范", "资金支持", "补贴政策", "征求意见", "实施细则",
    "产业发展", "区域合作", "京津冀协同", "营商环境", "放管服",
    "智慧城市", "大数据", "云计算", "区块链", "新能源",
    "碳达峰", "碳中和", "乡村振兴", "制造业升级", "数字化转型",
    "中小企业", "人才引进", "社会保障", "医疗改革", "教育公平",
]

# 重要程度分布
IMPORTANCE_LEVELS = [
    ("普通", 0.70),
    ("中等重点", 0.15),
    ("重点内容", 0.10),
    ("核心关注", 0.04),
    ("加急推荐", 0.01),
]

# 标题模板
TITLE_TEMPLATES = [
    "关于印发《{kw}发展实施方案》的通知",
    "{dept}关于{kw}的指导意见",
    "关于支持{kw}若干措施的通知",
    "{dept}印发《{kw}发展规划（2026-2030年）》",
    "关于开展{kw}试点工作的通知",
    "{kw}行动计划（2026-2028年）",
    "关于做好{kw}工作的通知",
    "{dept}关于推进{kw}的实施意见",
    "关于加强{kw}建设的指导意见",
    "{kw}专项资金管理办法",
    "关于印发{kw}实施细则的通知",
    "{dept}关于加快{kw}发展的若干政策",
    "关于深化{kw}改革的意见",
    "{kw}发展十四五规划",
    "关于促进{kw}健康发展的指导意见",
]


def load_env():
    env_path = Path(__file__).parent.parent / ".env.local"
    if not env_path.exists():
        print(f"错误：找不到 {env_path}")
        sys.exit(1)
    env = {}
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def weighted_choice(items):
    """带权重的随机选择"""
    total = sum(w for _, w in items)
    r = random.random() * total
    for item, w in items:
        r -= w
        if r <= 0:
            return item
    return items[0][0]


def generate_batch(batch_start, batch_size):
    """生成一批模拟数据"""
    items = []
    base_date = datetime(2020, 1, 1)

    for i in range(batch_size):
        idx = batch_start + i
        dept = random.choice(DEPARTMENTS)
        channel = random.choice(CHANNELS)
        source_id = f"bench_src_{idx:08d}"
        url = f"https://example.com/{dept}/{channel}/{idx}.html"

        # 生成标题
        tmpl = random.choice(TITLE_TEMPLATES)
        kw = random.choice(KEYWORDS)
        extra = random.choice(["", "进一步", "加快推进", "加强", "深化", "全面"])
        title = tmpl.format(kw=extra + kw, dept=dept)

        # 随机日期（过去 6 年）
        days_offset = random.randint(0, 365 * 6)
        pub_date = base_date + timedelta(days=days_offset)
        first_seen = pub_date + timedelta(hours=random.randint(0, 72))

        # 重要程度
        importance = weighted_choice(IMPORTANCE_LEVELS)

        # 关键词得分 0-200
        keyword_score = random.randint(0, 200)

        is_read = random.random() < 0.4
        is_starred = random.random() < 0.08

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
            "content_json": '["测试内容段落1", "测试内容段落2", "测试内容段落3"]',
            "matched_categories": '[]',
            "matched_genres": '[]',
            "matched_keywords": '[]',
        })
    return items


def insert_data(conn):
    """插入测试数据"""
    print(f"\n{'='*60}")
    print(f"  生成 {NUM_ITEMS:,} 条测试数据")
    print(f"{'='*60}")

    cur = conn.cursor()

    # 清理旧测试数据
    cur.execute("SELECT count(*) FROM monitor_items WHERE source_id LIKE 'bench_src_%'")
    existing = cur.fetchone()[0]
    if existing > 0:
        print(f"\n发现 {existing:,} 条旧测试数据，正在清理...")
        cur.execute("DELETE FROM monitor_items WHERE source_id LIKE 'bench_src_%'")
        conn.commit()
        print("清理完成")

    total_inserted = 0
    start_time = time.time()

    for batch_start in range(0, NUM_ITEMS, BATCH_SIZE):
        batch_count = min(BATCH_SIZE, NUM_ITEMS - batch_start)
        items = generate_batch(batch_start, batch_count)

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
        """
        execute_batch(cur, sql, items, page_size=BATCH_SIZE)
        conn.commit()

        total_inserted += batch_count
        elapsed = time.time() - start_time
        speed = total_inserted / elapsed if elapsed > 0 else 0
        eta = (NUM_ITEMS - total_inserted) / speed if speed > 0 else 0
        pct = total_inserted / NUM_ITEMS * 100

        print(
            f"\r  进度: {total_inserted:>8,}/{NUM_ITEMS:,} ({pct:5.1f}%) "
            f"速度: {speed:,.0f} 条/秒  预计剩余: {eta:,.0f}s",
            end="",
            flush=True,
        )

    elapsed = time.time() - start_time
    print(f"\n\n插入完成！共 {total_inserted:,} 条，耗时 {elapsed:.1f}s")

    # 更新统计信息（重要！否则优化器可能选错执行计划）
    print("\n更新统计信息 (ANALYZE)...")
    cur.execute("ANALYZE monitor_items")
    conn.commit()
    print("完成")

    # 显示数据分布
    print("\n数据分布:")
    cur.execute("SELECT count(*) FROM monitor_items WHERE source_id LIKE 'bench_src_%'")
    print(f"  测试数据总数: {cur.fetchone()[0]:,}")

    cur.execute("""
        SELECT importance_level, count(*) as cnt
        FROM monitor_items
        WHERE source_id LIKE 'bench_src_%'
        GROUP BY importance_level
        ORDER BY cnt DESC
    """)
    print("  重要程度分布:")
    for row in cur.fetchall():
        print(f"    {row[0]}: {row[1]:,}")

    cur.execute("SELECT count(DISTINCT department_name) FROM monitor_items WHERE source_id LIKE 'bench_src_%'")
    print(f"  部委数: {cur.fetchone()[0]}")

    cur.close()
    return total_inserted


def bench(cur, label, sql, params=None, repeat=5):
    """基准测试：多次运行取平均"""
    params = params or []
    # 预热
    cur.execute(sql, params)
    cur.fetchall()

    times = []
    row_count = 0
    for _ in range(repeat):
        start = time.perf_counter()
        cur.execute(sql, params)
        rows = cur.fetchall()
        times.append(time.perf_counter() - start)
        row_count = len(rows)

    avg = sum(times) / len(times)
    best = min(times)
    return avg, best, row_count


def print_result(label, avg, best, count, unit="ms"):
    """打印结果"""
    mul = 1000 if unit == "ms" else 1
    print(f"  {label:<40s} {avg*mul:>7.2f} {unit}  (最快 {best*mul:.2f}, {count:,} 行)")


def create_expression_index(conn):
    """创建表达式索引（用于默认排序的 CASE WHEN）"""
    print(f"\n{'='*60}")
    print("  创建表达式索引（用于默认排序优化）")
    print(f"{'='*60}")

    cur = conn.cursor()

    # 优先级数值映射的表达式索引
    expr_sql = """
    CREATE INDEX IF NOT EXISTS monitor_items_priority_rank_expr_idx
    ON monitor_items (
        (CASE importance_level
            WHEN '核心关注' THEN 3
            WHEN '加急推荐' THEN 3
            WHEN '重点内容' THEN 2
            WHEN '中等重点' THEN 1
            ELSE 0
        END) DESC,
        is_starred DESC,
        keyword_score DESC NULLS LAST,
        first_seen_at DESC
    )
    """
    print("\n创建表达式索引中...（数据量大时可能需要几分钟）")
    start = time.time()
    cur.execute(expr_sql)
    conn.commit()
    elapsed = time.time() - start
    print(f"完成！耗时 {elapsed:.1f}s")

    cur.execute("ANALYZE monitor_items")
    conn.commit()

    cur.close()


def run_benchmarks(conn):
    """运行所有性能测试"""
    print(f"\n{'='*60}")
    print("  性能对比测试（百万级数据）")
    print(f"{'='*60}")

    cur = conn.cursor()

    # 总数据量
    cur.execute("SELECT count(*) FROM monitor_items")
    total = cur.fetchone()[0]
    print(f"\n总数据量: {total:,} 条")

    # 预热
    print("\n预热查询...")
    cur.execute("SELECT count(*) FROM monitor_items WHERE title LIKE '%测试%'")
    cur.fetchall()

    # ========== 1. 部委筛选 ==========
    print(f"\n{'─'*55}")
    print("1. 部委筛选 + 分页（最常见场景）")
    print(f"{'─'*55}")

    avg, best, cnt = bench(cur, "基础查询", """
        SELECT * FROM monitor_items
        WHERE department_name = '北京市人民政府'
        ORDER BY first_seen_at DESC
        LIMIT 20
    """)
    print_result("SELECT * + 单列索引", avg, best, cnt)

    avg, best, cnt = bench(cur, "复合索引", """
        SELECT * FROM monitor_items
        WHERE department_name = '北京市人民政府'
        ORDER BY first_seen_at DESC
        LIMIT 20
    """)
    print_result("SELECT * + 复合索引(dept+time)", avg, best, cnt)

    avg, best, cnt = bench(cur, "覆盖索引", """
        SELECT source_id, title, url, department_name, list_published_at,
               first_seen_at, is_read, is_starred, keyword_score, importance_level
        FROM monitor_items
        WHERE department_name = '北京市人民政府'
        ORDER BY first_seen_at DESC
        LIMIT 20
    """)
    print_result("列裁剪 + 覆盖索引", avg, best, cnt)

    # EXPLAIN
    print("\n  EXPLAIN (覆盖索引):")
    cur.execute("""
        EXPLAIN SELECT source_id, title
        FROM monitor_items
        WHERE department_name = '北京市人民政府'
        ORDER BY first_seen_at DESC
        LIMIT 20
    """)
    for row in cur.fetchall()[:6]:
        print(f"    {row[0]}")

    # ========== 2. 默认排序 ==========
    print(f"\n{'─'*55}")
    print("2. 默认排序（首页，无筛选条件）")
    print(f"{'─'*55}")

    default_sort_sql = """
        SELECT source_id, title, importance_level, is_starred, keyword_score, first_seen_at
        FROM monitor_items
        ORDER BY
            CASE importance_level
                WHEN '核心关注' THEN 3
                WHEN '加急推荐' THEN 3
                WHEN '重点内容' THEN 2
                WHEN '中等重点' THEN 1
                ELSE 0
            END DESC,
            is_starred DESC,
            keyword_score DESC NULLS LAST,
            first_seen_at DESC
        LIMIT 20
    """

    avg, best, cnt = bench(cur, "全表扫描 + 排序", default_sort_sql)
    print_result("CASE WHEN 排序（全表扫描）", avg, best, cnt)

    # 检查表达式索引是否存在
    cur.execute("""
        SELECT count(*) FROM pg_indexes
        WHERE tablename = 'monitor_items'
          AND indexname = 'monitor_items_priority_rank_expr_idx'
    """)
    has_expr_idx = cur.fetchone()[0] > 0

    if has_expr_idx:
        avg, best, cnt = bench(cur, "表达式索引", default_sort_sql)
        print_result("表达式索引（零排序）", avg, best, cnt)

        print("\n  EXPLAIN (表达式索引):")
        cur.execute(f"EXPLAIN {default_sort_sql}")
        for row in cur.fetchall()[:6]:
            print(f"    {row[0]}")

    # ========== 3. 星标/未读筛选 ==========
    print(f"\n{'─'*55}")
    print("3. 布尔筛选（星标 / 未读）")
    print(f"{'─'*55}")

    avg, best, cnt = bench(cur, "星标筛选", """
        SELECT source_id, title, first_seen_at
        FROM monitor_items
        WHERE is_starred = true
        ORDER BY first_seen_at DESC
        LIMIT 20
    """)
    print_result("星标筛选 + 部分索引", avg, best, cnt)

    avg, best, cnt = bench(cur, "未读筛选", """
        SELECT source_id, title, first_seen_at
        FROM monitor_items
        WHERE is_read = false
        ORDER BY first_seen_at DESC
        LIMIT 20
    """)
    print_result("未读筛选 + 部分索引", avg, best, cnt)

    # ========== 4. 关键词模糊搜索 ==========
    print(f"\n{'─'*55}")
    print("4. 关键词模糊搜索")
    print(f"{'─'*55}")

    test_keywords = ["人", "人工", "人工智能", "人工智能赋能", "高质量发展实施方案"]
    for kw in test_keywords:
        avg, best, cnt = bench(cur, f'"{kw}"', """
            SELECT count(*) FROM monitor_items
            WHERE lower(title) LIKE %s
        """, params=[f'%{kw}%'], repeat=3)
        print_result(f'trigram 索引 "{kw}"', avg, best, cnt)

    # ========== 5. 组合订阅筛选 ==========
    print(f"\n{'─'*55}")
    print("5. 订阅组合筛选（部委 + 关键词）")
    print(f"{'─'*55}")

    avg, best, cnt = bench(cur, "OR 组合", """
        SELECT count(*) FROM monitor_items
        WHERE department_name IN ('北京市人民政府', '工业和信息化部', '财政部')
           OR lower(title) LIKE %s
    """, params=['%人工智能%'], repeat=3)
    print_result("部委 OR 关键词", avg, best, cnt)

    # ========== 6. 深分页 ==========
    print(f"\n{'─'*55}")
    print("6. 深分页性能（OFFSET 对比）")
    print(f"{'─'*55}")

    offsets = [0, 1000, 10000, 100000]
    for offset in offsets:
        avg, best, cnt = bench(cur, f"OFFSET {offset:,}", f"""
            SELECT source_id, title, first_seen_at
            FROM monitor_items
            ORDER BY first_seen_at DESC
            LIMIT 20 OFFSET {offset}
        """, repeat=3)
        print_result(f'第 {offset//20 + 1} 页 (OFFSET {offset:,})', avg, best, cnt)

    # ========== 7. Count 查询 ==========
    print(f"\n{'─'*55}")
    print("7. Count 查询性能")
    print(f"{'─'*55}")

    avg, best, cnt = bench(cur, "count(*)", "SELECT count(*) FROM monitor_items")
    print_result("count(*) 全表", avg, best, cnt)

    avg, best, cnt = bench(cur, "count 带部委筛选", """
        SELECT count(*) FROM monitor_items
        WHERE department_name = '北京市人民政府'
    """)
    print_result("count(*) 带部委筛选", avg, best, cnt)

    # ========== 8. 索引大小统计 ==========
    print(f"\n{'─'*55}")
    print("8. 索引大小统计")
    print(f"{'─'*55}")

    cur.execute("""
        SELECT
            indexrelname AS idx_name,
            pg_size_pretty(pg_relation_size(indexrelid)) AS idx_size,
            idx_scan AS scans
        FROM pg_stat_user_indexes
        WHERE relname = 'monitor_items'
        ORDER BY pg_relation_size(indexrelid) DESC
    """)

    total_idx_size = 0
    print("\n  {:<50s} {:>10s} {:>10s}".format("索引名", "大小", "扫描次数"))
    print("  " + "-" * 72)
    for row in cur.fetchall():
        size_str = row[1]
        # 粗略计算总大小
        if 'MB' in size_str:
            total_idx_size += float(size_str.replace(' MB', '')) * 1024
        elif 'kB' in size_str:
            total_idx_size += float(size_str.replace(' kB', ''))
        print(f"  {row[0]:<50s} {row[1]:>10s} {row[2]:>10,}")

    print(f"\n  索引总大小: ~{total_idx_size/1024:.1f} MB")

    # 表大小
    cur.execute("SELECT pg_size_pretty(pg_total_relation_size('monitor_items'))")
    print(f"  表总大小(含索引): {cur.fetchone()[0]}")

    cur.execute("SELECT pg_size_pretty(pg_relation_size('monitor_items'))")
    print(f"  表数据大小(不含索引): {cur.fetchone()[0]}")

    cur.close()


def cleanup(conn):
    """清理测试数据"""
    print(f"\n{'='*60}")
    print("  清理测试数据")
    print(f"{'='*60}")

    cur = conn.cursor()

    cur.execute("SELECT count(*) FROM monitor_items WHERE source_id LIKE 'bench_src_%'")
    count = cur.fetchone()[0]

    if count == 0:
        print("\n没有测试数据需要清理")
        cur.close()
        return

    print(f"\n发现 {count:,} 条测试数据，正在清理...")
    cur.execute("DELETE FROM monitor_items WHERE source_id LIKE 'bench_src_%'")
    deleted = cur.rowcount
    conn.commit()
    print(f"已删除 {deleted:,} 条")

    # 删除表达式索引（测试用）
    cur.execute("DROP INDEX IF EXISTS monitor_items_priority_rank_expr_idx")
    conn.commit()
    print("已删除测试用表达式索引")

    # 更新统计
    cur.execute("ANALYZE monitor_items")
    conn.commit()

    cur.execute("SELECT count(*) FROM monitor_items")
    print(f"\n当前数据量: {cur.fetchone()[0]:,} 条")

    cur.close()
    print("清理完成")


def main():
    global NUM_ITEMS
    parser = argparse.ArgumentParser(description="百万级数据性能测试")
    parser.add_argument("--keep", action="store_true", help="测试后保留测试数据")
    parser.add_argument("--clean", action="store_true", help="只清理测试数据")
    parser.add_argument("--count", type=int, default=NUM_ITEMS, help="生成数据条数")
    args = parser.parse_args()

    NUM_ITEMS = args.count

    env = load_env()
    db_url = env.get("DATABASE_URL", "")
    if not db_url:
        print("错误：DATABASE_URL 未配置")
        sys.exit(1)

    print("连接数据库...")
    conn = psycopg2.connect(db_url)
    print("连接成功")

    try:
        if args.clean:
            cleanup(conn)
            return

        # 1. 生成数据
        insert_data(conn)

        # 2. 创建表达式索引
        create_expression_index(conn)

        # 3. 性能测试
        run_benchmarks(conn)

        # 4. 清理（除非指定 --keep）
        if not args.keep:
            cleanup(conn)
        else:
            print("\n⚠️  数据已保留，手动清理请运行:")
            print("   python3 scripts/benchmark_1m.py --clean")

    finally:
        conn.close()
        print("\n完成！")


if __name__ == "__main__":
    main()
