import { describe, it, expect } from "vitest";
import {
  isNavActiveFn,
  isMenuDivider,
  primaryNav,
  settingsMenu,
  computeActiveNavLabel,
} from "@/hooks/use-navigation";
import {
  Bell, House, Inbox, Library,
} from "lucide-react";

describe("导航 - isNavActiveFn（导航激活判断）", () => {
  it("我的工作台路径精确匹配时激活", () => {
    expect(isNavActiveFn("/", "/")).toBe(true);
  });

  it("我的工作台路径不匹配子路径（/xxx 不算工作台）", () => {
    expect(isNavActiveFn("/", "/inbox")).toBe(false);
    expect(isNavActiveFn("/", "/dashboard")).toBe(false);
    expect(isNavActiveFn("/", "/abc")).toBe(false);
  });

  it("全部动态路径精确匹配时激活", () => {
    expect(isNavActiveFn("/inbox", "/inbox")).toBe(true);
  });

  it("全部动态子路径也激活（详情页、对比页等）", () => {
    expect(isNavActiveFn("/inbox", "/inbox/anything")).toBe(true);
  });

  it("专题路径 /inbox?view=byCategory 时全部动态激活", () => {
    expect(isNavActiveFn("/inbox?view=byCategory", "/inbox")).toBe(true);
  });

  it("部委目录路径也激活全部动态（已收敛）", () => {
    expect(isNavActiveFn("/inbox", "/departments")).toBe(true);
    expect(isNavActiveFn("/inbox", "/departments/abc")).toBe(true);
    expect(isNavActiveFn("/inbox", "/departments/xxx/sections/yyy")).toBe(true);
  });

  it("对比页、详情页都激活全部动态", () => {
    expect(isNavActiveFn("/inbox", "/compare")).toBe(true);
    expect(isNavActiveFn("/inbox", "/items/abc")).toBe(true);
  });

  it("关注设置路径精确匹配时激活", () => {
    expect(isNavActiveFn("/subscribe", "/subscribe")).toBe(true);
  });

  it("关注设置子路径也激活", () => {
    expect(isNavActiveFn("/subscribe", "/subscribe/sub")).toBe(true);
  });

  it("监测管理路径精确匹配时激活", () => {
    expect(isNavActiveFn("/monitor", "/monitor")).toBe(true);
  });

  it("监测管理子路径也激活（数据源、诊断等）", () => {
    expect(isNavActiveFn("/monitor", "/monitor/sources")).toBe(true);
    expect(isNavActiveFn("/monitor", "/monitor/diagnose")).toBe(true);
  });

  it("不相关的路径不激活", () => {
    expect(isNavActiveFn("/dashboard", "/inbox")).toBe(false);
    expect(isNavActiveFn("/keywords", "/monitor/sources")).toBe(false);
  });

  it("路径前缀相同但不是子路径时不激活（避免部分匹配）", () => {
    expect(isNavActiveFn("/in", "/inbox")).toBe(false);
    expect(isNavActiveFn("/dep", "/departments")).toBe(false);
  });

  it("空路径不会误激活我的工作台", () => {
    expect(isNavActiveFn("/", "")).toBe(false);
  });

  it("带 query 参数的 href 也能正确判断激活（取 basePath）", () => {
    expect(isNavActiveFn("/inbox?view=starred", "/inbox")).toBe(true);
    expect(isNavActiveFn("/inbox?view=signals", "/items/abc")).toBe(true);
    expect(isNavActiveFn("/inbox?view=byDepartment", "/departments")).toBe(true);
  });
});

describe("导航 - isMenuDivider（类型守卫）", () => {
  it("分隔线对象返回 true", () => {
    expect(isMenuDivider({ type: "divider" })).toBe(true);
    expect(isMenuDivider({ type: "divider", groupLabel: "数据洞察" })).toBe(true);
    expect(isMenuDivider({ type: "divider", groupLabel: "管理后台" })).toBe(true);
  });

  it("菜单项返回 false", () => {
    expect(
      isMenuDivider({
        href: "/inbox",
        label: "全部动态",
        icon: Library,
        desc: "政策列表",
      }),
    ).toBe(false);
  });

  it("空对象返回 false", () => {
    expect(isMenuDivider({} as unknown as Parameters<typeof isMenuDivider>[0])).toBe(false);
  });
});

describe("导航 - primaryNav（主导航配置）", () => {
  it("主导航共 3 项（我的工作台、全部动态、关注设置）", () => {
    expect(primaryNav.length).toBe(3);
  });

  it("第 1 项是我的工作台，路径 /", () => {
    expect(primaryNav[0].label).toBe("我的工作台");
    expect(primaryNav[0].href).toBe("/");
    expect(primaryNav[0].icon).toBe(House);
  });

  it("第 2 项是全部动态，路径 /inbox", () => {
    expect(primaryNav[1].label).toBe("全部动态");
    expect(primaryNav[1].href).toBe("/inbox");
    expect(primaryNav[1].icon).toBe(Inbox);
  });

  it("第 3 项是关注设置，路径 /subscribe", () => {
    expect(primaryNav[2].label).toBe("关注设置");
    expect(primaryNav[2].href).toBe("/subscribe");
    expect(primaryNav[2].icon).toBe(Bell);
  });

  it("所有导航项都有 href、label、icon 三个字段", () => {
    for (const nav of primaryNav) {
      expect(nav.href).toBeTruthy();
      expect(nav.label).toBeTruthy();
      expect(nav.icon).toBeTruthy();
    }
  });

  it("导航标签互不重复", () => {
    const labels = primaryNav.map((n) => n.label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(primaryNav.length);
  });
});

describe("导航 - settingsMenu（设置菜单配置）", () => {
  it("设置菜单共 15 个条目（3 组分隔 + 12 个菜单项）", () => {
    expect(settingsMenu.length).toBe(15);
  });

  it("第 1 个条目是「数据洞察」分组分隔线", () => {
    const first = settingsMenu[0];
    expect(isMenuDivider(first)).toBe(true);
    if (isMenuDivider(first)) {
      expect(first.groupLabel).toBe("数据洞察");
    }
  });

  it("「数据洞察」分组有 3 个菜单项：高价值信号、数据趋势、数据来源与采集", () => {
    const groupItems = settingsMenu.slice(1, 4);
    expect(groupItems.length).toBe(3);
    expect(groupItems.every((item) => !isMenuDivider(item))).toBe(true);

    const labels = groupItems.map((item) => ("label" in item ? item.label : ""));
    expect(labels).toContain("高价值信号");
    expect(labels).toContain("数据趋势");
    expect(labels).toContain("数据来源与采集");
  });

  it("第 5 个条目是「管理后台」分组分隔线", () => {
    const divider = settingsMenu[4];
    expect(isMenuDivider(divider)).toBe(true);
    if (isMenuDivider(divider)) {
      expect(divider.groupLabel).toBe("管理后台");
    }
  });

  it("「管理后台」分组有 1 个菜单项：系统管理（后台能力统一入口）", () => {
    const groupItems = settingsMenu.slice(5, 6);
    expect(groupItems.length).toBe(1);
    expect(groupItems.every((item) => !isMenuDivider(item))).toBe(true);

    const labels = groupItems.map((item) => ("label" in item ? item.label : ""));
    expect(labels).toContain("系统管理");
  });

  it("第 7 个条目是「设置与帮助」分组分隔线", () => {
    const divider = settingsMenu[6];
    expect(isMenuDivider(divider)).toBe(true);
    if (isMenuDivider(divider)) {
      expect(divider.groupLabel).toBe("设置与帮助");
    }
  });

  it("「设置与帮助」分组有 8 个菜单项，含版本规划", () => {
    const groupItems = settingsMenu.slice(7);
    expect(groupItems.length).toBe(8);
    expect(groupItems.every((item) => !isMenuDivider(item))).toBe(true);

    const labels = groupItems.map((item) => ("label" in item ? item.label : ""));
    expect(labels).toContain("版本规划");
  });

  it("所有菜单项都有 href、label、icon、desc 四个字段", () => {
    const menuItems = settingsMenu.filter((item) => !isMenuDivider(item));
    for (const item of menuItems) {
      if ("href" in item) {
        expect(item.href).toBeTruthy();
        expect(item.label).toBeTruthy();
        expect(item.icon).toBeTruthy();
        expect(item.desc).toBeTruthy();
      }
    }
  });

  it("菜单项路径互不重复", () => {
    const menuItems = settingsMenu.filter((item) => !isMenuDivider(item));
    const hrefs = menuItems.map((item) => ("href" in item ? item.href : ""));
    const uniqueHrefs = new Set(hrefs);
    expect(uniqueHrefs.size).toBe(menuItems.length);
  });

  it("高价值信号路径是 /signals（独立页面）", () => {
    const signal = settingsMenu.find((item) => "label" in item && item.label === "高价值信号");
    expect(signal).toBeDefined();
    if (signal && "href" in signal) {
      expect(signal.href).toBe("/signals");
    }
  });

  it("数据趋势路径是 /dashboard", () => {
    const trend = settingsMenu.find((item) => "label" in item && item.label === "数据趋势");
    expect(trend).toBeDefined();
    if (trend && "href" in trend) {
      expect(trend.href).toBe("/dashboard");
    }
  });

  it("系统管理路径是 /monitor（后台能力统一入口）", () => {
    const sys = settingsMenu.find((item) => "label" in item && item.label === "系统管理");
    expect(sys).toBeDefined();
    if (sys && "href" in sys) {
      expect(sys.href).toBe("/monitor");
    }
  });
});

describe("导航 - computeActiveNavLabel（激活导航标签计算）", () => {
  it("我的工作台路径返回「我的工作台」", () => {
    expect(computeActiveNavLabel("/")).toBe("我的工作台");
  });

  it("全部动态路径返回「全部动态」", () => {
    expect(computeActiveNavLabel("/inbox")).toBe("全部动态");
  });

  it("全部动态子路径返回「全部动态」", () => {
    expect(computeActiveNavLabel("/inbox/sub")).toBe("全部动态");
  });

  it("部委目录路径返回「全部动态」（已收敛）", () => {
    expect(computeActiveNavLabel("/departments")).toBe("全部动态");
    expect(computeActiveNavLabel("/departments/abc")).toBe("全部动态");
    expect(computeActiveNavLabel("/departments/abc/sections/def")).toBe("全部动态");
  });

  it("数据看板路径返回「数据洞察」", () => {
    expect(computeActiveNavLabel("/dashboard")).toBe("数据洞察");
  });

  it("高价值信号路径返回「动态资讯」", () => {
    expect(computeActiveNavLabel("/signals")).toBe("动态资讯");
  });

  it("我的研究路径返回「我的工作台」（已从主导航降级为二级入口）", () => {
    expect(computeActiveNavLabel("/research")).toBe("我的工作台");
  });

  it("关注设置路径返回「关注设置」", () => {
    expect(computeActiveNavLabel("/subscribe")).toBe("关注设置");
  });

  it("对比页 /compare 返回「全部动态」", () => {
    expect(computeActiveNavLabel("/compare")).toBe("全部动态");
    expect(computeActiveNavLabel("/compare?items=xxx")).toBe("全部动态");
  });

  it("详情页 /items/[id] 返回「全部动态」", () => {
    expect(computeActiveNavLabel("/items/abc")).toBe("全部动态");
    expect(computeActiveNavLabel("/items/xyz?sourceId=xxx&url=yyy")).toBe("全部动态");
  });

  it("监测管理路径返回「系统管理」", () => {
    expect(computeActiveNavLabel("/monitor")).toBe("系统管理");
    expect(computeActiveNavLabel("/monitor/sources")).toBe("系统管理");
    expect(computeActiveNavLabel("/monitor/diagnose")).toBe("系统管理");
  });

  it("关键词管理路径返回「系统管理」", () => {
    expect(computeActiveNavLabel("/keywords")).toBe("系统管理");
  });

  it("未知路径返回「未知」", () => {
    expect(computeActiveNavLabel("/unknown")).toBe("未知");
    expect(computeActiveNavLabel("/abc/def")).toBe("未知");
    expect(computeActiveNavLabel("")).toBe("未知");
  });
});

describe("导航 - 信息架构验证", () => {
  it("主导航 3 项 + 设置菜单 12 项 = 共 15 个功能入口", () => {
    const primaryCount = primaryNav.length;
    const settingsCount = settingsMenu.filter((item) => !isMenuDivider(item)).length;
    expect(primaryCount + settingsCount).toBe(15);
  });

  it("设置菜单分三组：数据洞察（3项）+ 管理后台（1项）+ 设置与帮助（8项）", () => {
    const dividers = settingsMenu.filter((item) => isMenuDivider(item));
    expect(dividers.length).toBe(3);

    const insightItems = settingsMenu.slice(
      settingsMenu.findIndex((item) => isMenuDivider(item) && item.groupLabel === "数据洞察") + 1,
      settingsMenu.findIndex((item) => isMenuDivider(item) && item.groupLabel === "管理后台"),
    );
    expect(insightItems.length).toBe(3);

    const adminItems = settingsMenu.slice(
      settingsMenu.findIndex((item) => isMenuDivider(item) && item.groupLabel === "管理后台") + 1,
      settingsMenu.findIndex((item) => isMenuDivider(item) && item.groupLabel === "设置与帮助"),
    );
    expect(adminItems.length).toBe(1);
    if (adminItems[0] && "label" in adminItems[0]) {
      expect(adminItems[0].label).toBe("系统管理");
    }

    const aboutItems = settingsMenu.slice(
      settingsMenu.findIndex((item) => isMenuDivider(item) && item.groupLabel === "设置与帮助") + 1,
    );
    expect(aboutItems.length).toBe(8);
    const lastItem = aboutItems[aboutItems.length - 1];
    if (lastItem && "label" in lastItem) {
      expect(lastItem.label).toBe("版本规划");
    }
  });

  it("数据洞察组包含高价值信号、数据趋势", () => {
    const insightStart = settingsMenu.findIndex(
      (item) => isMenuDivider(item) && item.groupLabel === "数据洞察",
    );
    const adminStart = settingsMenu.findIndex(
      (item) => isMenuDivider(item) && item.groupLabel === "管理后台",
    );
    const insightItems = settingsMenu.slice(insightStart + 1, adminStart);
    const labels = insightItems.map((item) => ("label" in item ? item.label : ""));
    expect(labels).toContain("高价值信号");
    expect(labels).toContain("数据趋势");
  });

  it("后台管理能力全部收敛到「系统管理」单一入口，明确标注管理员", () => {
    const menuItems = settingsMenu.filter((item) => !isMenuDivider(item));
    const systemEntry = menuItems.find((m) => "label" in m && m.label === "系统管理");
    expect(systemEntry).toBeDefined();
    if (systemEntry && "href" in systemEntry) {
      expect(systemEntry.href).toBe("/monitor");
      expect(systemEntry.desc).toContain("管理员");
    }
  });

  it("我的研究不在主导航中（降级为工作台内二级入口）", () => {
    const labels = primaryNav.map((n) => n.label);
    expect(labels).not.toContain("我的研究");
  });

  it("对比功能不在主导航中（上下文触发）", () => {
    const labels = primaryNav.map((n) => n.label);
    expect(labels).not.toContain("对比");
    const menuLabels = settingsMenu
      .filter((item) => !isMenuDivider(item))
      .map((item) => ("label" in item ? item.label : ""));
    expect(menuLabels).not.toContain("对比");
  });
});
