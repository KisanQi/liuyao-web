# 六爻排盘网站（静态源码，不含 API）

这是六爻排盘网站的公开源码包，包含六爻确定性算法、原生 DOM 页面、铜钱资源、规则文档和核心回归测试。

本仓库不包含服务端 `api/`、梅花模块、密钥、用户历史、`node_modules`、`dist` 或临时文件。

## 运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

测试：

```bash
npm test
```

算法入口是 `src/domain/liuyao/engine.ts`，前端入口是 `src/main.ts`，页面骨架是 `index.html`。

固定协议：Reading `2.2`，规则 `jingfang-zengshan-v1`，依赖 `mingyu-core@0.1.32`（MIT）。

本包没有服务端 AI API；页面中的 AI 客户端代码仅保留原有调用接口，未配置后端时排盘、展示和本地历史功能仍可运行。
