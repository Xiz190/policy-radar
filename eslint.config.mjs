import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 项目自定义忽略：第三方资源 / 调试脚本 / 生产构建产物
    "node_modules/**",
    "dist/**",
    "public/**",
    "scripts/**",
    "test_*.mjs",
  ]),
]);

export default eslintConfig;
