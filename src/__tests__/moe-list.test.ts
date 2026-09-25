import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchGenericGovernmentListLatest } from "@/lib/monitor/generic-government-list";

const MOE_MOCK_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>教育部 - 时政要闻</title>
</head>
<body>
  <div class="header">
    <div class="nav">导航栏</div>
  </div>
  
  <div class="main-content">
    <div class="news-list-box">
      <ul class="news-list">
        <li>
          <a href="/jyb_xwfb/gzdt_gzdt/s5987/202506/t20250615_1135264.html" title="教育部召开2025年全国教育工作会议">
            教育部召开2025年全国教育工作会议
          </a>
          <span class="date">2025-06-15</span>
        </li>
        <li>
          <a href="/jyb_xwfb/gzdt_gzdt/s5987/202506/t20250614_1135123.html" title="关于印发《新时代基础教育强师计划》的通知">
            关于印发《新时代基础教育强师计划》的通知
          </a>
          <span class="date">2025-06-14</span>
        </li>
        <li>
          <a href="/jyb_xwfb/gzdt_gzdt/s5987/202506/t20250613_1135089.html" title="教育部部署暑期校外培训治理工作">
            教育部部署暑期校外培训治理工作
          </a>
          <span>2025-06-13</span>
        </li>
        <li>
          <a href="/jyb_xwfb/gzdt_gzdt/s5987/202506/t20250612_1135045.html">
            2025年高考招生政策解读
          </a>
          <span class="time">2025-06-12</span>
        </li>
        <li>
          <a href="/jyb_xwfb/gzdt_gzdt/s5987/202506/t20250611_1134987.html" title="教育部发布《职业教育法》实施细则">
            教育部发布《职业教育法》实施细则
          </a>
          <span class="fbtime">2025-06-11</span>
        </li>
      </ul>
    </div>
    
    <div class="sidebar">
      <div class="related-links">相关链接</div>
    </div>
  </div>
  
  <div class="footer">
    <div class="copyright">版权所有</div>
  </div>
</body>
</html>`;

const mockFetch = vi.fn();

describe("教育部列表解析测试", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("能正确解析教育部新闻列表", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => MOE_MOCK_HTML,
    } as Response);

    const items = await fetchGenericGovernmentListLatest(
      "https://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/s5987/xxfb/",
      10,
    );

    expect(items.length).toBe(5);
    expect(items[0]).toEqual({
      title: "教育部召开2025年全国教育工作会议",
      url: "https://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/s5987/202506/t20250615_1135264.html",
      listPublishedAt: "2025-06-15",
    });
    expect(items[1]).toEqual({
      title: "关于印发《新时代基础教育强师计划》的通知",
      url: "https://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/s5987/202506/t20250614_1135123.html",
      listPublishedAt: "2025-06-14",
    });
    expect(items[2]).toEqual({
      title: "教育部部署暑期校外培训治理工作",
      url: "https://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/s5987/202506/t20250613_1135089.html",
      listPublishedAt: "2025-06-13",
    });
    expect(items[3]).toEqual({
      title: "2025年高考招生政策解读",
      url: "https://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/s5987/202506/t20250612_1135045.html",
      listPublishedAt: "2025-06-12",
    });
    expect(items[4]).toEqual({
      title: "教育部发布《职业教育法》实施细则",
      url: "https://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/s5987/202506/t20250611_1134987.html",
      listPublishedAt: "2025-06-11",
    });
  });

  it("能处理带中文日期的列表项", async () => {
    const htmlWithChineseDate = `<!DOCTYPE html>
<html>
<body>
  <ul class="news-list">
    <li>
      <a href="/202506/t20250615_1135264.html" title="中文日期测试">中文日期测试</a>
      <span>2025年6月15日</span>
    </li>
  </ul>
</body>
</html>`;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => htmlWithChineseDate,
    } as Response);

    const items = await fetchGenericGovernmentListLatest(
      "https://www.moe.gov.cn/jyb_xwfb/",
      5,
    );

    expect(items.length).toBe(1);
    expect(items[0].listPublishedAt).toBe("2025-06-15");
  });

  it("能处理不同格式的日期", async () => {
    const htmlWithMixedDates = `<!DOCTYPE html>
<html>
<body>
  <ul class="news-list">
    <li>
      <a href="/202506/t20250615_1135264.html">横线日期</a>
      <span>2025-06-15</span>
    </li>
    <li>
      <a href="/202506/t20250614_1135123.html">斜杠日期</a>
      <span>2025/06/14</span>
    </li>
    <li>
      <a href="/202506/t20250613_1135089.html">中文日期</a>
      <span>2025年6月13日</span>
    </li>
  </ul>
</body>
</html>`;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => htmlWithMixedDates,
    } as Response);

    const items = await fetchGenericGovernmentListLatest(
      "https://www.moe.gov.cn/jyb_xwfb/",
      5,
    );

    expect(items.length).toBe(3);
    expect(items[0].listPublishedAt).toBe("2025-06-15");
    expect(items[1].listPublishedAt).toBe("2025-06-14");
    expect(items[2].listPublishedAt).toBe("2025-06-13");
  });

  it("能过滤掉非内容页面链接", async () => {
    const htmlWithNonContentLinks = `<!DOCTYPE html>
<html>
<body>
  <ul class="news-list">
    <li>
      <a href="/jyb_xwfb/gzdt_gzdt/s5987/202506/t20250615_1135264.html" title="有效链接">有效链接</a>
      <span>2025-06-15</span>
    </li>
    <li>
      <a href="/index.html" title="首页">首页</a>
      <span>2025-06-14</span>
    </li>
    <li>
      <a href="javascript:void(0)" title="无效链接">无效链接</a>
      <span>2025-06-13</span>
    </li>
    <li>
      <a href="#top" title="锚点">锚点</a>
      <span>2025-06-12</span>
    </li>
  </ul>
</body>
</html>`;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => htmlWithNonContentLinks,
    } as Response);

    const items = await fetchGenericGovernmentListLatest(
      "https://www.moe.gov.cn/jyb_xwfb/",
      5,
    );

    expect(items.length).toBe(1);
    expect(items[0].title).toBe("有效链接");
  });

  it("能处理带空格和特殊字符的标题", async () => {
    const htmlWithSpecialTitle = `<!DOCTYPE html>
<html>
<body>
  <ul class="news-list">
    <li>
      <a href="/202506/t20250615_1135264.html" title="关于印发《国家教育事业发展“十四五”规划》的通知">
        关于印发《国家教育事业发展“十四五”规划》的通知
      </a>
      <span>2025-06-15</span>
    </li>
  </ul>
</body>
</html>`;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => htmlWithSpecialTitle,
    } as Response);

    const items = await fetchGenericGovernmentListLatest(
      "https://www.moe.gov.cn/jyb_xwfb/",
      5,
    );

    expect(items.length).toBe(1);
    expect(items[0].title).toBe(
      '关于印发《国家教育事业发展“十四五”规划》的通知',
    );
  });
});