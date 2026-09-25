-- =====================================================================
-- monitor_items 表性能优化索引脚本
-- 适用于百万级数据量的查询优化
-- 执行方式：psql $DATABASE_URL -f scripts/add_optimization_indexes.sql
-- =====================================================================

-- 执行前先看一下已有索引和数据量
SELECT '当前数据量: ' || count(*) || ' 条' AS info FROM monitor_items;

-- =====================================================================
-- 一、复合索引（组合筛选 + 排序场景）
-- =====================================================================

-- 1. 重要程度 + 发现时间倒序
--    适用场景：按重要程度筛选（核心关注/重点内容等） + 按时间排序
--    已有单列索引 monitor_items_importance，复合索引避免额外排序
CREATE INDEX IF NOT EXISTS monitor_items_importance_first_seen_idx
    ON monitor_items (importance_level, first_seen_at DESC);

-- 2. 星标 + 发现时间倒序
--    适用场景："仅看重点"（is_starred = true） + 按时间排序
--    用部分索引，只索引星标数据，索引体积小
CREATE INDEX IF NOT EXISTS monitor_items_starred_first_seen_idx
    ON monitor_items (first_seen_at DESC)
    WHERE is_starred = true;

-- 3. 未读 + 发现时间倒序
--    适用场景："仅看未读"（is_read = false） + 按时间排序
--    部分索引，只索引未读数据
CREATE INDEX IF NOT EXISTS monitor_items_unread_first_seen_idx
    ON monitor_items (first_seen_at DESC)
    WHERE is_read = false;

-- 4. 关键词得分 + 发现时间倒序
--    适用场景：按关键词得分排序的场景
--    已有单列索引，复合索引优化排序
CREATE INDEX IF NOT EXISTS monitor_items_score_first_seen_idx
    ON monitor_items (keyword_score DESC NULLS LAST, first_seen_at DESC);

-- 5. 重要程度 + 星标 + 发现时间倒序
--    适用场景：默认排序（importance desc, is_starred desc, score desc, first_seen_at desc）
--    最常用的排序组合，索引本身有序完全避免 Sort 节点
CREATE INDEX IF NOT EXISTS monitor_items_default_sort_idx
    ON monitor_items (importance_level DESC, is_starred DESC, keyword_score DESC NULLS LAST, first_seen_at DESC);

-- =====================================================================
-- 二、覆盖索引（Covering Index）- 减少回表
-- =====================================================================
-- 说明：列表页查询只需要以下字段就能渲染，不需要 content_json 等大字段
-- 使用 INCLUDE 把这些字段加到索引里，实现"索引覆盖"，完全不用回表

-- 1. 部委筛选覆盖索引（列表页最常用场景）
--    适用：按部委筛选 + 按时间排序 + 只取列表展示字段
CREATE INDEX IF NOT EXISTS monitor_items_dept_cover_idx
    ON monitor_items (department_name, first_seen_at DESC)
    INCLUDE (
        source_id, title, url, list_published_at,
        is_read, is_starred, keyword_score, importance_level,
        matched_categories, matched_genres, matched_keywords,
        signal_hits, effective_from, effective_to, deadline_date
    );

-- 2. 默认排序覆盖索引
--    适用：无筛选条件或用默认排序 + 只取列表展示字段
CREATE INDEX IF NOT EXISTS monitor_items_default_sort_cover_idx
    ON monitor_items (importance_level DESC, is_starred DESC, keyword_score DESC NULLS LAST, first_seen_at DESC)
    INCLUDE (
        source_id, department_name, title, url, list_published_at,
        is_read, is_starred, keyword_score, importance_level,
        matched_categories, matched_genres, matched_keywords,
        signal_hits, effective_from, effective_to, deadline_date
    );

-- =====================================================================
-- 三、清理冗余的单列索引
-- =====================================================================
-- 说明：有了复合索引后，部分单列索引可能不再需要
-- 但为了保险起见，这里先注释掉，确认复合索引生效后再考虑删除

-- DROP INDEX IF EXISTS monitor_items_department_name;  -- 已被 monitor_items_dept_first_seen_idx 覆盖
-- DROP INDEX IF EXISTS monitor_items_importance;        -- 已被 monitor_items_importance_first_seen_idx 覆盖
-- DROP INDEX IF EXISTS monitor_items_keyword_score;     -- 已被 monitor_items_score_first_seen_idx 覆盖

-- =====================================================================
-- 验证索引是否创建成功
-- =====================================================================

SELECT '索引创建完成，当前 monitor_items 表索引列表：' AS info;

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'monitor_items'
ORDER BY indexname;

-- 预估索引大小
SELECT
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE relname = 'monitor_items'
ORDER BY pg_relation_size(indexrelid) DESC;
