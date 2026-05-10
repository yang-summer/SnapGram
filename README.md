# ℹ️ Snapgram

Snapgram 是一个仿小红书的图片社交全栈应用，重点覆盖瀑布流浏览、搜索、多图发布、收藏/点赞和个人主页管理等核心场景。项目采用 React Router 7 架构，由 Appwrite 提供 BaaS 能力。

> **🔗 Live Demo:** [https://snap-gram-lake.vercel.app](https://snap-gram-lake.vercel.app)

## 🌟 Features

- **虚拟化瀑布流**：通过 `TanStack Query` 和 `@tanstack/react-virtual` 实现无限滚动和虚拟化瀑布流渲染，有效控制 DOM 节点数量，并提供首屏加载、空态、错误态和分页重试。
- **复杂表单与多图拖拽排序**：发帖表单使用 `React Hook Form` + `Zod` 进行严格校验；图片上传模块支持本地图片预处理、压缩、拖拽排序、重试与删除。
- **模态框路由**：基于 `React Router` 的上下文子路由，结合`state`判断实现帖子详情的模态框路由。
- **点赞/收藏**：使用 `Tanstack Query` 承载该类服务端状态，通过乐观更新提升用户体验，并处理并发点击、快速连点问题。
- **Appwrite Functions 服务端化**：由 Appwrite Functions 处理内容变更操作 ，统一权限校验和一致性处理，避免前端直写带来的安全与脏写风险，提升可靠性。
- **主题切换**：基于 `next-themes` 配合 `Tailwind CSS v4` 实现浅色/深色主题切换。

## 🚀 Tech Stack

| 分类              | 技术                                     |
| ----------------- | ---------------------------------------- |
| 核心框架          | React 19 + TypeScript                    |
| 路由管理          | React Router 7                           |
| 状态管理          | TanStack Query                           |
| UI 与样式         | Tailwind CSS v4 + shadcn/ui              |
| 表单与校验        | React Hook Form + Zod                    |
| 网络请求 / 数据层 | Appwrite SDK + node-appwrite             |
| 交互与性能        | @dnd-kit/react + @tanstack/react-virtual |
| 构建与工程化      | Vite + ESLint + Prettier                 |

## 🔎 Screenshots

### 首页

![home feed](https://github.com/user-attachments/assets/69358609-84bc-4893-aef5-5f03324153c6)

### 用户资料页

![user profile](https://github.com/user-attachments/assets/b9f986c8-cdba-4e85-a14b-d246d2369e50)

### 帖子编辑页

![post edit](https://github.com/user-attachments/assets/f741bf96-a95d-49ad-b8e9-04a5f0a4f532)

## 🧾 Acknowledgements

- 本项目来源于 [JavaScript Mastery](https://www.youtube.com/watch?v=_W3R2VwRyF4)，在其基础上进行了深度的二次开发与重构。
