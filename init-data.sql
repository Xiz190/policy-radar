-- ============================================================
-- 公开信息同步台 - 初始数据
-- 创建时间: 2026-07-03
-- 适用版本: v1.0.0
-- 执行方式: psql -U <username> -d <database> -f init-data.sql
-- ============================================================

-- ============================================================
-- 初始监测源配置
-- ============================================================

-- 文化和旅游部
insert into monitor_sources (id, department_name, channel_group, channel_name, display_name, type, list_url, enabled, auto_monitor, is_key, start_date, max_items, notes) values
('mct_szyw', '文化和旅游部', null, '时政要闻', '文旅部·时政要闻', 'mct_szyw', 'https://www.mct.gov.cn/whzx/szyw/', true, true, true, '2026-05-05', 10, null),
('mct_genre_510', '文化和旅游部', null, '通知', '文旅部·通知', 'mct_zwgk_genre', 'https://zwgk.mct.gov.cn/zfxxgkml/503/510/index_3081.html', true, true, true, '2026-05-05', 10, null),
('mct_genre_509', '文化和旅游部', null, '意见', '文旅部·意见', 'mct_zwgk_genre', 'https://zwgk.mct.gov.cn/zfxxgkml/503/509/index_3081.html', true, true, true, '2026-05-05', 10, null),
('mct_whyw', '文化和旅游部', null, '焦点新闻', '文旅部·焦点新闻', 'mct_szyw', 'https://www.mct.gov.cn/whzx/whyw/', true, true, true, '2026-05-05', 10, null),
('mct_bnsj', '文化和旅游部', null, '工作信息', '文旅部·工作信息', 'mct_szyw', 'https://www.mct.gov.cn/whzx/bnsj/', true, true, true, '2026-05-05', 10, null),
('mct_hdjl_yjzj', '文化和旅游部', '互动交流', '意见征集', '文旅部·意见征集', 'mct_szyw', 'https://www.mct.gov.cn/hdjl/yjzj/', true, true, true, '2026-05-05', 10, null),
('mct_hdjl_xwfbh', '文化和旅游部', '互动交流', '新闻发布会', '文旅部·新闻发布会', 'mct_szyw', 'https://www.mct.gov.cn/hdjl/xwfbh/', true, true, false, '2026-05-05', 10, null);

-- 国务院
insert into monitor_sources (id, department_name, channel_group, channel_name, display_name, type, list_url, enabled, auto_monitor, is_key, start_date, max_items, notes) values
('govcn_yaowen', '国务院', null, '要闻', '国务院·要闻', 'govcn_yaowen', 'https://www.gov.cn/yaowen/liebiao/', true, true, true, '2026-05-05', 10, null),
('govcn_zuixin', '国务院', null, '最新政策', '国务院·最新政策', 'govcn_zuixin', 'https://www.gov.cn/zhengce/zuixin/', true, true, true, '2026-05-05', 10, null),
('govcn_zhongyang', '国务院', null, '中央文件', '国务院·中央文件', 'govcn_zhongyang', 'https://www.gov.cn/zhengce/wenjian/zhongyang/', true, true, true, '2026-05-05', 10, null),
('govcn_toutiao', '国务院', '要闻动态', '头条新闻', '国务院·头条新闻', 'beijing_gov_list', 'https://www.gov.cn/toutiao/liebiao/', true, true, true, '2026-05-05', 10, null),
('govcn_jcbs', '国务院', '要闻动态', '决策部署', '国务院·决策部署', 'beijing_gov_list', 'https://www.gov.cn/gzjxs/toutiao/', true, true, true, '2026-05-05', 10, null),
('govcn_xwfb', '国务院', '要闻动态', '新闻发布', '国务院·新闻发布', 'beijing_gov_list', 'https://www.gov.cn/lianbo/fabu/', true, true, true, '2026-05-05', 10, null),
('govcn_zcjd_3', '国务院', '政策解读', '政策解读·主页', '国务院·政策解读(主页)', 'beijing_gov_list', 'https://www.gov.cn/zhengce/jiedu/index.htm', true, true, true, '2026-05-05', 10, null),
('govcn_zcjc', '国务院', '政策解读', '政策集成', '国务院·政策集成', 'beijing_gov_list', 'https://www.gov.cn/zhengce/jiedu/sbgxyjhx/zcjc/', true, true, true, '2026-05-05', 10, null);

-- 北京市人民政府
insert into monitor_sources (id, department_name, channel_group, channel_name, display_name, type, list_url, enabled, auto_monitor, is_key, start_date, max_items, notes) values
('bjsrmzfw_yaowen', '北京市人民政府', '要闻动态', '北京要闻', '北京市政府·北京要闻', 'beijing_gov_list', 'https://www.beijing.gov.cn/ywdt/yaowen/', true, true, true, '2026-05-05', 10, null),
('bjsrmzfw_zybwdt', '北京市人民政府', '要闻动态', '中央部委动态', '北京市政府·中央部委动态', 'beijing_gov_list', 'https://www.beijing.gov.cn/ywdt/zybwdt/', true, true, true, '2026-05-05', 10, null),
('bjsrmzfw_szfhy', '北京市人民政府', '重要会议', '市政府会议', '北京市政府·市政府会议', 'beijing_gov_list', 'https://www.beijing.gov.cn/ywdt/hyxx/szf/', true, true, true, '2026-05-05', 10, null),
('bjsrmzfw_zfwj', '北京市人民政府', '政策文件', '市政府文件', '北京市政府·市政府文件', 'beijing_gov_list', 'https://www.beijing.gov.cn/zhengce/zfwj/zfwj2016/szfwj/', true, true, true, '2026-05-05', 10, null),
('bjsrmzfw_gfxwj', '北京市人民政府', '政策文件', '规范性文件', '北京市政府·规范性文件', 'beijing_gov_list', 'https://www.beijing.gov.cn/zhengce/gfxwj/', true, true, true, '2026-05-05', 10, null),
('bjsrmzfw_zcfg', '北京市人民政府', '政策文件', '政策文件', '北京市政府·政策文件', 'beijing_gov_list', 'https://www.beijing.gov.cn/zhengce/zhengcefagui/', true, true, true, '2026-05-05', 10, null),
('bjsrmzfw_dfxfg', '北京市人民政府', '政策文件', '地方性法规', '北京市政府·地方性法规', 'beijing_gov_list', 'https://www.beijing.gov.cn/zhengce/dfxfg/', true, true, true, '2026-05-05', 10, null),
('bjsrmzfw_shipin_xwfbh', '北京市人民政府', '视频北京', '市政府新闻发布会', '北京市政府·新闻发布会', 'beijing_gov_list', 'https://www.beijing.gov.cn/shipin/szfxwfbh/', true, true, true, '2026-05-05', 10, null),
('bjsrmzfw_gwywj', '北京市人民政府', '国务院文件', '国务院文件', '北京市政府·国务院文件', 'beijing_gov_list', 'https://www.beijing.gov.cn/zhengce/gwywj/', true, true, true, '2026-05-05', 10, null);

-- 北京市财政局
insert into monitor_sources (id, department_name, channel_group, channel_name, display_name, type, list_url, enabled, auto_monitor, is_key, start_date, max_items, notes) values
('bjczj_tztg', '北京市财政局', '政务信息', '通知通告', '北京财政局·通知通告', 'bjczj_list', 'https://czj.beijing.gov.cn/zwxx/tztg/index.html', true, true, true, '2026-05-05', 10, null),
('bjczj_czyw', '北京市财政局', '政务信息', '财政要闻', '北京财政局·财政要闻', 'bjczj_list', 'https://czj.beijing.gov.cn/zwxx/czyw/index.html', true, true, true, '2026-05-05', 10, null),
('bjczj_zcwj', '北京市财政局', '政务信息', '政策文件', '北京财政局·政策文件', 'bjczj_list', 'https://czj.beijing.gov.cn/zwxx/2024zcwj/index.html', true, true, true, '2026-05-05', 10, null),
('bjczj_gfxwj', '北京市财政局', '政务信息', '行政规范性文件', '北京财政局·行政规范性文件', 'bjczj_list', 'https://czj.beijing.gov.cn/zwxx/2024zcwj/2024gfxwj/index.html', true, true, true, '2026-05-05', 10, null),
('bjczj_zcjd', '北京市财政局', '政务信息', '政策解读', '北京财政局·政策解读', 'bjczj_list', 'https://czj.beijing.gov.cn/zwxx/2024zcjd/index.html', true, true, true, '2026-05-05', 10, null),
('bjczj_czsj', '北京市财政局', '政务信息', '财政数据', '北京财政局·财政数据', 'bjczj_list', 'https://czj.beijing.gov.cn/zwxx/czsj/index.html', true, true, true, '2026-05-05', 10, null),
('bjczj_czyjs', '北京市财政局', '财政数据', '财政预决算', '北京财政局·财政预决算', 'bjczj_list', 'https://czj.beijing.gov.cn/zwxx/czsj/czyjs/index.html', true, true, true, '2026-05-05', 10, null),
('bjczj_zfzqgl', '北京市财政局', '专题栏目', '政府债券管理', '北京财政局·政府债券管理', 'bjczj_list', 'https://czj.beijing.gov.cn/ztlm/zfzqgl/index.html', true, true, true, '2026-05-05', 10, null),
('bjczj_qyfw', '北京市财政局', '专题栏目', '企业服务', '北京财政局·企业服务', 'bjczj_list', 'https://czj.beijing.gov.cn/ztlm/qyfw/index.html', true, true, true, '2026-05-05', 10, null),
('bjczj_ztjsjf', '北京市财政局', '专题栏目', '减税降费和营商环境建设', '北京财政局·减税降费和营商环境', 'bjczj_list', 'https://czj.beijing.gov.cn/ztlm/ztjsjf/index.html', true, true, true, '2026-05-05', 10, null);

-- ============================================================
-- 全局关键词配置
-- ============================================================

-- A 类 · 强执行信号词（最高权重 6）
insert into monitor_keywords (id, department_name, keyword, weight, category, match_mode) values
('kw_a_001', '__global__', '实施细则', 6, 'A·强执行信号', 'phrase'),
('kw_a_002', '__global__', '申报通知', 6, 'A·强执行信号', 'phrase'),
('kw_a_003', '__global__', '申报指南', 6, 'A·强执行信号', 'phrase'),
('kw_a_004', '__global__', '采购目录', 6, 'A·强执行信号', 'phrase'),
('kw_a_005', '__global__', '招标公告', 6, 'A·强执行信号', 'phrase'),
('kw_a_006', '__global__', '试点名单', 6, 'A·强执行信号', 'phrase'),
('kw_a_007', '__global__', '示范名单', 6, 'A·强执行信号', 'phrase'),
('kw_a_008', '__global__', '白名单', 6, 'A·强执行信号', 'phrase'),
('kw_a_009', '__global__', '验收办法', 6, 'A·强执行信号', 'phrase'),
('kw_a_010', '__global__', '评分细则', 6, 'A·强执行信号', 'phrase'),
('kw_a_011', '__global__', '技术规范', 6, 'A·强执行信号', 'phrase'),
('kw_a_012', '__global__', '技术标准', 6, 'A·强执行信号', 'phrase'),
('kw_a_013', '__global__', '目录', 6, 'A·强执行信号', 'phrase'),
('kw_a_014', '__global__', '受理通知', 6, 'A·强执行信号', 'phrase'),
('kw_a_015', '__global__', '入库', 6, 'A·强执行信号', 'phrase'),
('kw_a_016', '__global__', '备案办法', 6, 'A·强执行信号', 'phrase'),
('kw_a_017', '__global__', '联合申报', 6, 'A·强执行信号', 'phrase'),
('kw_a_018', '__global__', '面向社会征集', 6, 'A·强执行信号', 'phrase');

-- B 类 · 强支持信号词（权重 5）
insert into monitor_keywords (id, department_name, keyword, weight, category, match_mode) values
('kw_b_001', '__global__', '政府采购智能体', 5, 'B·强支持信号', 'phrase'),
('kw_b_002', '__global__', '采购大模型', 5, 'B·强支持信号', 'phrase'),
('kw_b_003', '__global__', '政府采购', 5, 'B·强支持信号', 'phrase'),
('kw_b_004', '__global__', '标杆场景', 5, 'B·强支持信号', 'phrase'),
('kw_b_005', '__global__', '示范应用', 5, 'B·强支持信号', 'phrase'),
('kw_b_006', '__global__', '示范项目', 5, 'B·强支持信号', 'phrase'),
('kw_b_007', '__global__', '试点示范', 5, 'B·强支持信号', 'phrase'),
('kw_b_008', '__global__', '场景开放', 5, 'B·强支持信号', 'phrase'),
('kw_b_009', '__global__', '重点支持', 5, 'B·强支持信号', 'phrase'),
('kw_b_010', '__global__', '鼓励发展', 5, 'B·强支持信号', 'phrase'),
('kw_b_011', '__global__', '补贴', 5, 'B·强支持信号', 'phrase'),
('kw_b_012', '__global__', '补助', 5, 'B·强支持信号', 'phrase'),
('kw_b_013', '__global__', '专项资金', 5, 'B·强支持信号', 'phrase'),
('kw_b_014', '__global__', '算力券', 5, 'B·强支持信号', 'phrase'),
('kw_b_015', '__global__', '数据券', 5, 'B·强支持信号', 'phrase'),
('kw_b_016', '__global__', '财政支持', 5, 'B·强支持信号', 'phrase'),
('kw_b_017', '__global__', '资金支持', 5, 'B·强支持信号', 'phrase'),
('kw_b_018', '__global__', '平台建设', 5, 'B·强支持信号', 'phrase'),
('kw_b_019', '__global__', '基地建设', 5, 'B·强支持信号', 'phrase'),
('kw_b_020', '__global__', '战略合作', 5, 'B·强支持信号', 'phrase'),
('kw_b_021', '__global__', '联合实验室', 5, 'B·强支持信号', 'phrase'),
('kw_b_022', '__global__', '产业联盟', 5, 'B·强支持信号', 'phrase'),
('kw_b_023', '__global__', '产业基金', 5, 'B·强支持信号', 'phrase');

-- C 类 · 强约束/风险信号词（权重 4）
insert into monitor_keywords (id, department_name, keyword, weight, category, match_mode) values
('kw_c_001', '__global__', '分类分级治理', 4, 'C·风险信号', 'phrase'),
('kw_c_002', '__global__', '分类分级', 4, 'C·风险信号', 'phrase'),
('kw_c_003', '__global__', '高风险领域', 4, 'C·风险信号', 'phrase'),
('kw_c_004', '__global__', '安全底线', 4, 'C·风险信号', 'phrase'),
('kw_c_005', '__global__', '模型安全', 4, 'C·风险信号', 'phrase'),
('kw_c_006', '__global__', '算法安全', 4, 'C·风险信号', 'phrase'),
('kw_c_007', '__global__', '安全评估', 4, 'C·风险信号', 'phrase'),
('kw_c_008', '__global__', '风险评估', 4, 'C·风险信号', 'phrase'),
('kw_c_009', '__global__', '数据安全', 4, 'C·风险信号', 'phrase'),
('kw_c_010', '__global__', '个人信息保护', 4, 'C·风险信号', 'phrase'),
('kw_c_011', '__global__', '隐私保护', 4, 'C·风险信号', 'phrase'),
('kw_c_012', '__global__', '跨境数据流动', 4, 'C·风险信号', 'phrase'),
('kw_c_013', '__global__', '数据出境', 4, 'C·风险信号', 'phrase'),
('kw_c_014', '__global__', '加强监管', 4, 'C·风险信号', 'phrase'),
('kw_c_015', '__global__', '从严监管', 4, 'C·风险信号', 'phrase'),
('kw_c_016', '__global__', '清理整顿', 4, 'C·风险信号', 'phrase'),
('kw_c_017', '__global__', '负面清单', 4, 'C·风险信号', 'phrase'),
('kw_c_018', '__global__', '审核', 4, 'C·风险信号', 'phrase'),
('kw_c_019', '__global__', '审查', 4, 'C·风险信号', 'phrase'),
('kw_c_020', '__global__', '备案', 4, 'C·风险信号', 'phrase'),
('kw_c_021', '__global__', '审批', 4, 'C·风险信号', 'phrase');

-- D 类 · 探索/观察型信号词（权重 2）
insert into monitor_keywords (id, department_name, keyword, weight, category, match_mode) values
('kw_d_001', '__global__', '探索', 2, 'D·探索信号', 'phrase'),
('kw_d_002', '__global__', '试行', 2, 'D·探索信号', 'phrase'),
('kw_d_003', '__global__', '研究制定', 2, 'D·探索信号', 'phrase'),
('kw_d_004', '__global__', 'token', 2, 'D·探索信号', 'phrase'),
('kw_d_005', '__global__', 'OPC', 2, 'D·探索信号', 'phrase'),
('kw_d_006', '__global__', '确权', 2, 'D·探索信号', 'phrase'),
('kw_d_007', '__global__', '拟出台', 2, 'D·探索信号', 'phrase'),
('kw_d_008', '__global__', '将出台', 2, 'D·探索信号', 'phrase'),
('kw_d_009', '__global__', '正在制定', 2, 'D·探索信号', 'phrase'),
('kw_d_010', '__global__', '起草中', 2, 'D·探索信号', 'phrase');

-- 通用启动/落地信号词（权重 3）
insert into monitor_keywords (id, department_name, keyword, weight, category, match_mode) values
('kw_common_001', '__global__', '正式启动', 3, '通用启动/落地', 'phrase'),
('kw_common_002', '__global__', '组织开展', 3, '通用启动/落地', 'phrase'),
('kw_common_003', '__global__', '推进实施', 3, '通用启动/落地', 'phrase'),
('kw_common_004', '__global__', '全面推进', 3, '通用启动/落地', 'phrase'),
('kw_common_005', '__global__', '启动实施', 3, '通用启动/落地', 'phrase'),
('kw_common_006', '__global__', '组织申报', 3, '通用启动/落地', 'phrase'),
('kw_common_007', '__global__', '发布实施', 3, '通用启动/落地', 'phrase'),
('kw_common_008', '__global__', '正式印发', 3, '通用启动/落地', 'phrase'),
('kw_common_009', '__global__', '落地实施', 3, '通用启动/落地', 'phrase'),
('kw_common_010', '__global__', '推广应用', 3, '通用启动/落地', 'phrase');

-- AI / 智能体 / 大模型（权重 5）
insert into monitor_keywords (id, department_name, keyword, weight, category, match_mode) values
('kw_ai_001', '__global__', '人工智能', 5, 'AI/智能体/大模型', 'phrase'),
('kw_ai_002', '__global__', '大模型', 5, 'AI/智能体/大模型', 'phrase'),
('kw_ai_003', '__global__', '通用人工智能', 5, 'AI/智能体/大模型', 'phrase'),
('kw_ai_004', '__global__', '生成式人工智能', 5, 'AI/智能体/大模型', 'phrase'),
('kw_ai_005', '__global__', '生成式AI', 5, 'AI/智能体/大模型', 'phrase'),
('kw_ai_006', '__global__', '智能体', 5, 'AI/智能体/大模型', 'phrase'),
('kw_ai_007', '__global__', 'AI原生应用', 5, 'AI/智能体/大模型', 'phrase'),
('kw_ai_008', '__global__', '基础模型', 5, 'AI/智能体/大模型', 'phrase'),
('kw_ai_009', '__global__', '模型备案', 5, 'AI/智能体/大模型', 'phrase'),
('kw_ai_010', '__global__', '模型评测', 5, 'AI/智能体/大模型', 'phrase'),
('kw_ai_011', '__global__', '智算', 5, 'AI/智能体/大模型', 'phrase'),
('kw_ai_012', '__global__', '智算中心', 5, 'AI/智能体/大模型', 'phrase'),
('kw_ai_013', '__global__', '算法备案', 5, 'AI/智能体/大模型', 'phrase'),
('kw_ai_014', '__global__', '深度合成', 5, 'AI/智能体/大模型', 'phrase'),
('kw_ai_015', '__global__', 'AI安全', 5, 'AI/智能体/大模型', 'phrase'),
('kw_ai_016', '__global__', 'AI治理', 5, 'AI/智能体/大模型', 'phrase'),
('kw_ai_017', '__global__', 'AI+', 5, 'AI/智能体/大模型', 'phrase'),
('kw_ai_018', '__global__', '人工智能+', 5, 'AI/智能体/大模型', 'phrase'),
('kw_ai_019', '__global__', 'AI', 5, 'AI/智能体/大模型', 'word_boundary_en'),
('kw_ai_020', '__global__', 'AIGC', 5, 'AI/智能体/大模型', 'word_boundary_en');

-- 算力 / 全国算力网 / 算电协同（权重 4）
insert into monitor_keywords (id, department_name, keyword, weight, category, match_mode) values
('kw_computing_001', '__global__', '全国一体化算力网', 4, '算力/算力网/算电协同', 'phrase'),
('kw_computing_002', '__global__', '算力网', 4, '算力/算力网/算电协同', 'phrase'),
('kw_computing_003', '__global__', '算力调度', 4, '算力/算力网/算电协同', 'phrase'),
('kw_computing_004', '__global__', '算电协同', 4, '算力/算力网/算电协同', 'phrase'),
('kw_computing_005', '__global__', '算力中心', 4, '算力/算力网/算电协同', 'phrase'),
('kw_computing_006', '__global__', '算力枢纽', 4, '算力/算力网/算电协同', 'phrase'),
('kw_computing_007', '__global__', '京津冀算力', 4, '算力/算力网/算电协同', 'phrase');

-- 数据要素 / 高质量数据集（权重 4）
insert into monitor_keywords (id, department_name, keyword, weight, category, match_mode) values
('kw_data_001', '__global__', '数据要素', 4, '数据要素/高质量数据集', 'phrase'),
('kw_data_002', '__global__', '数据要素市场', 4, '数据要素/高质量数据集', 'phrase'),
('kw_data_003', '__global__', '数据流通', 4, '数据要素/高质量数据集', 'phrase'),
('kw_data_004', '__global__', '数据交易', 4, '数据要素/高质量数据集', 'phrase'),
('kw_data_005', '__global__', '数据资产', 4, '数据要素/高质量数据集', 'phrase'),
('kw_data_006', '__global__', '数据确权', 4, '数据要素/高质量数据集', 'phrase'),
('kw_data_007', '__global__', '高质量数据集', 4, '数据要素/高质量数据集', 'phrase'),
('kw_data_008', '__global__', '模数共振', 4, '数据要素/高质量数据集', 'phrase'),
('kw_data_009', '__global__', '公共数据授权运营', 4, '数据要素/高质量数据集', 'phrase'),
('kw_data_010', '__global__', '数据开发利用', 4, '数据要素/高质量数据集', 'phrase');

-- 产业合作 / 京津冀协同发展（权重 4）
insert into monitor_keywords (id, department_name, keyword, weight, category, match_mode) values
('kw_industry_001', '__global__', '产业合作', 4, '产业合作/京津冀协同', 'phrase'),
('kw_industry_002', '__global__', '产业协同', 4, '产业合作/京津冀协同', 'phrase'),
('kw_industry_003', '__global__', '产业链', 4, '产业合作/京津冀协同', 'phrase'),
('kw_industry_004', '__global__', '产业生态', 4, '产业合作/京津冀协同', 'phrase'),
('kw_industry_005', '__global__', '产业集群', 4, '产业合作/京津冀协同', 'phrase'),
('kw_industry_006', '__global__', '京津冀协同发展', 4, '产业合作/京津冀协同', 'phrase'),
('kw_industry_007', '__global__', '京津冀一体化', 4, '产业合作/京津冀协同', 'phrase'),
('kw_industry_008', '__global__', '京津冀产业协同', 4, '产业合作/京津冀协同', 'phrase'),
('kw_industry_009', '__global__', '京津冀数字经济', 4, '产业合作/京津冀协同', 'phrase'),
('kw_industry_010', '__global__', '京津冀人工智能', 4, '产业合作/京津冀协同', 'phrase'),
('kw_industry_011', '__global__', '雄安新区', 4, '产业合作/京津冀协同', 'phrase'),
('kw_industry_012', '__global__', '北京国际科技创新中心', 4, '产业合作/京津冀协同', 'phrase'),
('kw_industry_013', '__global__', '全球数字经济标杆城市', 4, '产业合作/京津冀协同', 'phrase'),
('kw_industry_014', '__global__', '中关村', 4, '产业合作/京津冀协同', 'phrase');

-- 政务服务 / 平台经济 / 数字经济（权重 3）
insert into monitor_keywords (id, department_name, keyword, weight, category, match_mode) values
('kw_gov_001', '__global__', '数字经济', 3, '政务服务/平台经济/数字经济', 'phrase'),
('kw_gov_002', '__global__', '平台经济', 3, '政务服务/平台经济/数字经济', 'phrase'),
('kw_gov_003', '__global__', '平台企业', 3, '政务服务/平台经济/数字经济', 'phrase'),
('kw_gov_004', '__global__', '平台治理', 3, '政务服务/平台经济/数字经济', 'phrase'),
('kw_gov_005', '__global__', '数字化转型', 3, '政务服务/平台经济/数字经济', 'phrase'),
('kw_gov_006', '__global__', '数实融合', 3, '政务服务/平台经济/数字经济', 'phrase'),
('kw_gov_007', '__global__', '产业互联网', 3, '政务服务/平台经济/数字经济', 'phrase'),
('kw_gov_008', '__global__', '工业互联网', 3, '政务服务/平台经济/数字经济', 'phrase'),
('kw_gov_009', '__global__', '政务服务', 3, '政务服务/平台经济/数字经济', 'phrase'),
('kw_gov_010', '__global__', '数字政务', 3, '政务服务/平台经济/数字经济', 'phrase'),
('kw_gov_011', '__global__', '智慧城市', 3, '政务服务/平台经济/数字经济', 'phrase'),
('kw_gov_012', '__global__', '智慧文旅', 3, '政务服务/平台经济/数字经济', 'phrase');

-- 法规/征求意见辅助词（权重 3）
insert into monitor_keywords (id, department_name, keyword, weight, category, match_mode) values
('kw_regulation_001', '__global__', '征求意见', 3, '法规/征求意见', 'phrase'),
('kw_regulation_002', '__global__', '公开征求意见', 3, '法规/征求意见', 'phrase'),
('kw_regulation_003', '__global__', '实施方案', 3, '法规/征求意见', 'phrase'),
('kw_regulation_004', '__global__', '行动计划', 3, '法规/征求意见', 'phrase'),
('kw_regulation_005', '__global__', '工作方案', 3, '法规/征求意见', 'phrase'),
('kw_regulation_006', '__global__', '实施意见', 3, '法规/征求意见', 'phrase'),
('kw_regulation_007', '__global__', '条例', 3, '法规/征求意见', 'phrase'),
('kw_regulation_008', '__global__', '办法', 3, '法规/征求意见', 'phrase'),
('kw_regulation_009', '__global__', '规定', 3, '法规/征求意见', 'phrase'),
('kw_regulation_010', '__global__', '细则', 3, '法规/征求意见', 'phrase'),
('kw_regulation_011', '__global__', '指南', 3, '法规/征求意见', 'phrase'),
('kw_regulation_012', '__global__', '通知', 3, '法规/征求意见', 'phrase'),
('kw_regulation_013', '__global__', '若干措施', 3, '法规/征求意见', 'phrase');

-- ============================================================
-- 初始订阅配置
-- ============================================================

-- 订阅全部部委
insert into monitor_subscriptions (id, user_id, type, target, target_name, enabled) values
('sub_dept_001', 'default', 'department', '文化和旅游部', '文化和旅游部', true),
('sub_dept_002', 'default', 'department', '国务院', '国务院', true),
('sub_dept_003', 'default', 'department', '北京市人民政府', '北京市人民政府', true),
('sub_dept_004', 'default', 'department', '北京市财政局', '北京市财政局', true);

-- 关键词订阅
insert into monitor_subscriptions (id, user_id, type, target, target_name, enabled) values
('sub_keyword_001', 'default', 'keyword', '人工智能', '人工智能', true),
('sub_keyword_002', 'default', 'keyword', '大模型', '大模型', true),
('sub_keyword_003', 'default', 'keyword', '数据要素', '数据要素', true),
('sub_keyword_004', 'default', 'keyword', '京津冀', '京津冀', true),
('sub_keyword_005', 'default', 'keyword', '算力', '算力', true);

-- ============================================================
-- 初始分析模板
-- ============================================================

insert into analysis_templates (id, name, description, category, config_json, is_active, sort_order) values
('template_001', '政策信号分析', '分析政策文件中的信号强度和主题词', 'signal', '{"signals":["强执行","强支持","风险","探索"],"themes":["AI","算力","数据要素"]}', true, 1),
('template_002', '产业影响评估', '评估政策对产业的影响', 'industry', '{"dimensions":["需求侧","供给侧","竞争格局"],"regions":["京津冀"]}', true, 2),
('template_003', '政策生命周期', '分析政策在生命周期中的阶段', 'lifecycle', '{"stages":["征求意见","正式发布","实施细则","试点"]}', true, 3);

-- ============================================================
-- 数据导入完成
-- ============================================================
-- 数据库初始化完成，可启动应用
