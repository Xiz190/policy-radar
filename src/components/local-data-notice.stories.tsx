import type { Meta, StoryObj } from "@storybook/react";
import { useState, useEffect } from "react";
import { LocalDataNotice } from "./local-data-notice";
import { resetLocalDataNoticeDismissed } from "@/lib/local-data-notice";

const meta = {
  title: "Components/LocalDataNotice",
  component: LocalDataNotice,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["banner", "footer", "card"],
    },
    dismissible: { control: "boolean" },
    showPrimaryAction: { control: "boolean" },
    showSecondaryAction: { control: "boolean" },
    showGuideEntry: { control: "boolean" },
    autoDismissState: { control: "boolean" },
  },
} satisfies Meta<typeof LocalDataNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Banner: Story = {
  args: {
    variant: "banner",
    showPrimaryAction: true,
    showSecondaryAction: true,
    dismissible: true,
    showGuideEntry: false,
    autoDismissState: false,
  },
};

export const BannerWithGuideEntry: Story = {
  render: function Render(args) {
    const [key, setKey] = useState(0);
    useEffect(() => {
      resetLocalDataNoticeDismissed();
    }, []);
    return (
      <div style={{ maxWidth: 640 }}>
        <LocalDataNotice
          key={key}
          {...args}
          onShowGuide={() => {
            resetLocalDataNoticeDismissed();
            setKey((k) => k + 1);
          }}
        />
      </div>
    );
  },
  args: {
    variant: "banner",
    showPrimaryAction: true,
    showSecondaryAction: true,
    showGuideEntry: true,
    dismissible: true,
    autoDismissState: true,
  },
  parameters: {
    docs: {
      description: {
        story: "设置页用：关闭后显示「查看数据说明」入口，点击可重新展开。",
      },
    },
  },
};

export const Footer: Story = {
  args: {
    variant: "footer",
    showSecondaryAction: true,
    dismissible: true,
    autoDismissState: false,
  },
  parameters: {
    layout: "centered",
    docs: {
      description: {
        story: "通知中心底部弱提示：灰色小字一行，最低强度提示。",
      },
    },
  },
};

export const Card: Story = {
  args: {
    variant: "card",
    showPrimaryAction: true,
    showSecondaryAction: true,
    dismissible: true,
    autoDismissState: false,
  },
  parameters: {
    layout: "centered",
    docs: {
      description: {
        story: "首次进入引导卡片：白底阴影 + 覆盖范围列表，最高强度提示。",
      },
    },
  },
};

export const NotDismissible: Story = {
  args: {
    variant: "banner",
    showPrimaryAction: true,
    showSecondaryAction: false,
    dismissible: false,
    autoDismissState: false,
  },
  parameters: {
    docs: {
      description: {
        story: "不可关闭模式：无关闭按钮，用户必须点击「我知道了」。",
      },
    },
  },
};
