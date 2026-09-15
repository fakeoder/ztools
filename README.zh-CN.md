# ztools

一个面向开发者的在线工具站。核心目标：**简洁、好用、强大，解决痛点**。

- 纯前端实现，所有工具在浏览器本地运行，数据不出设备
- 响应式，支持移动端与 PC 端
- 默认英文，支持中文（可切换）
- 支持深浅色模式

> **[English README](README.md)**

## 特性

- **Landing 首页**：站点首页是落地页，展示工具总览
- **URL 即工具**：每个工具一个独立子路由，例如 `https://example.com/json_diff` 是 JSON 比对工具
- **检索体系**：支持关键词搜索，以及按分类（category）和标签（tag）筛选
- **多语言**：默认英语，支持中文，语言可切换
- **深浅色模式**：支持亮色 / 暗色主题切换
- **无账号体系**：纯工具站，无需注册登录，无后端存储

## 第一批工具

| 路由 | 工具 | 说明 |
| --- | --- | --- |
| `/json_diff` | JSON Diff | 两个 JSON 的差异比对 |
| `/text_diff` | Text Diff | 两段文本的逐行差异比对 |
| `/json_format` | JSON Formatter | JSON 格式化 / 压缩 |
| `/timestamp` | Timestamp | 时间戳与日期互转 |

## 技术栈

- **Vite + React**（SPA）
- 工具全部在客户端运行，无后端服务
- 后续工具清单会持续扩充

## 开始使用

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 本地预览构建产物
npm run preview
```

## 路由约定

每个工具对应一个独立路由，命名采用小写 + 下划线，如：

```
/json_diff
/text_diff
/json_format
/timestamp
```

## 目录结构（规划）

```
src/
  components/     # 通用组件
  pages/          # 页面级组件
    Home.tsx      # Landing 首页
    Tool.tsx      # 工具通用布局
  tools/          # 每个工具的独立目录
    json-diff/
      index.tsx   # 工具实现
      meta.ts     # 名称、描述、分类、标签、i18n 配置
    json-format/
    timestamp/
  i18n/           # 多语言文案（en / zh-CN）
  themes/         # 深浅色主题变量
  router.tsx      # 路由注册
```

## 如何添加一个新工具

1. 在 `src/tools/` 下新建工具目录（如 `my-tool/`）
2. 实现工具页面 `index.tsx`
3. 编写 `meta.ts`，声明工具的名称、描述、分类、tags 及多语言文案
4. 在路由中注册 `/my_tool`
5. 工具会自动出现在首页、搜索和分类 / tag 检索中

## 分类与 Tag 体系（规划）

- **分类（category）**：粗粒度，如 数据（data）、时间（time）、文本（text）、代码（code）等
- **标签（tag）**：细粒度描述，用于更精确的检索

## 国际化

- 默认语言：英语（en）
- 支持语言：中文（zh-CN）
- 工具名称、描述、界面文案均通过 i18n 管理

## 主题

- 基于 CSS 变量实现亮色 / 暗色两套主题
- 支持手动切换，可跟随系统偏好

## 许可证

[MIT](LICENSE)