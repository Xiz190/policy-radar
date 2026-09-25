// 豆包 / 大模型客户端（当前为离线占位实现，不会发起任何外部 API 调用）
//
// 说明：本文件原本提供基于 HTTP 的外部大模型调用（doubao/ERNIE 等），
// 为避免依赖外部 API 以及密钥管理问题，当前只暴露一个"始终不可用"的占位实现。
// 上层（policy-analyzer.ts）在看到 `getDoubaoClient() === null` 时会自动回退至
// LLM_* 环境变量驱动的调用，或进一步降级到关键词规则。

export interface DoubaoChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface DoubaoConfig {
  apiKey: string;
  secretKey: string;
  apiBaseUrl?: string;
}

/** 真正可用的豆包客户端（当前未启用，保留类型定义以便未来重新接入） */
export class DoubaoClient {
  constructor(config: DoubaoConfig) {
    void config;
    // 留空：当前版本不会发起任何外部 API 调用
  }

  async chatCompletion(messages: DoubaoChatMessage[], model?: string): Promise<string> {
    void messages;
    void model;
    throw new Error("DoubaoClient 当前为离线占位实现，未启用外部 API 调用");
  }

  async streamChatCompletion(
    messages: DoubaoChatMessage[],
    model: string | undefined,
    onChunk: (chunk: string) => void,
  ): Promise<void> {
    void messages;
    void model;
    void onChunk;
    throw new Error("DoubaoClient 当前为离线占位实现，未启用外部 API 调用");
  }
}

let _logOnce = false;

/** 获得豆包客户端（当前始终返回 null，表示"未启用"） */
export function getDoubaoClient(): DoubaoClient | null {
  if (!_logOnce) {
    _logOnce = true;
    console.info("[Doubao] 当前为离线占位实现，AI 分析将走 LLM_* 环境变量或关键词规则降级模式");
  }
  return null;
}

/** 是否有可用的豆包 AI 服务（占位实现始终为 false） */
export function hasDoubaoApiKey(): boolean {
  return false;
}
