# 首页瀑布流设计方案

## 范围

本文档定义 Snapgram 首页瀑布流的实现方案。

本期目标：

- 将当前首页的单列帖子流替换为小红书风格的瀑布流。
- 保持实现可复用，后续可在 `Explore` 或其他列表页复用相同的 feed 基础组件。
- 支持无限滚动、自动分页、错误恢复、列表结束态和渐进式图片加载。
- 方案需要适配 Appwrite Cloud 免费版限制，不能依赖付费图片变换能力。

本期不包含：

- 重做 `Explore`
- 为旧帖子批量回填图片元数据
- 推荐排序或个性化排序

## 当前现状

当前相关文件：

- `app/routes/home.tsx`
- `app/features/post/components/PostCard.tsx`
- `app/features/post/components/GridPostList.tsx`
- `app/features/post/queries/post.queries.ts`
- `app/features/post/services/post.service.ts`
- `app/features/post/api/post.api.ts`
- `app/features/post/types/post.type.ts`
- `app/components/shared/FileUploader.tsx`
- `appwrite.config.json`

当前行为：

- 首页通过 `useGetRecentPostsQuery()` 获取固定数量的最近帖子。
- 首页使用纵向大卡片列表渲染帖子。
- `Explore` 已经接入了基于 cursor 的分页和 `useInfiniteQuery`，但 UI 是固定高度网格，不是瀑布流。
- 帖子目前只存了 `imageId` 和 `imageUrl`，没有图片宽高、比例元数据或占位图数据。

当前 Appwrite 约束：

- 前端通过浏览器端 SDK 使用 `TablesDB` 和 `Storage`。
- 媒体资源存放在一个公开 bucket 中。
- 项目运行在 Appwrite Cloud 免费版约束下，因此方案应尽量避免额外图片请求，也不能把动态图片变换作为基础能力依赖。

## 产品需求

已确认需求：

- 本期只改首页。
- feed 按最新发布排序。
- 首页卡片保留以下信息：
  - 封面图
  - caption
  - 作者头像
  - 作者名
  - 点赞数
- 视觉方向尽量贴近小红书：
  - 信息密度更紧凑
  - 明显的图片优先布局
  - 圆角卡片
  - 文案截断
  - 紧凑的底部信息区
- 响应式列数：
  - 手机：2 列
  - 平板：3-4 列
  - 桌面：4-5 列
- 图片比例分桶：
  - `1:1`
  - `3:4`
  - `4:3`
- 首页需要使用真正分页，并支持自动无限滚动。
- 初次加载之后如果分页失败，界面需要显示“重试 / 加载更多”控制。
- 没有下一页时，需要明确显示列表结束态。
- 图片加载使用三阶段视觉流程：
  - 灰色骨架
  - LQIP 占位图
  - 原图

## 改动内容

### 1. 扩展帖子数据模型

在 `appwrite.config.json` 和线上 Appwrite schema 的 `posts` 表中新增以下字段：

- `aspectRatioBucket`
  - 枚举类型
  - 可选值：`1:1`、`3:4`、`4:3`
  - 用于稳定布局占位和瀑布流高度估算
- `imagePlaceholder`
  - `text`
  - 可为空
  - 存储完整的 `data:image/...;base64,...` 占位图字符串
- `imageWidth`
  - 整数
  - 可为空
  - 原图宽度
- `imageHeight`
  - 整数
  - 可为空
  - 原图高度

这些字段是渲染元数据，不是新的媒体资源文件。

### 2. 更新类型定义和映射层

更新：

- `app/features/post/types/post.type.ts`
- `app/features/post/mappers/post.mapper.ts`

改动：

- 为原始 row 和 view model 增加新字段。
- 如有必要，新增一个首页 feed 专用的 view model，而不是强行复用现有卡片类型。
- 确保旧帖子在缺少元数据时可以安全降级：
  - 默认比例桶为 `3:4`
  - `imagePlaceholder` 可以为 `null`

### 3. 新增图片元数据和 LQIP 生成工具

新增一个轻量工具模块，例如：

- `app/features/post/lib/post-image.ts`

职责：

- 从本地 `File` 读取图片宽高
- 在 `1:1`、`3:4`、`4:3` 中选择最接近的比例桶
- 使用 canvas 生成极小尺寸的 LQIP 图片
- 返回：
  - `aspectRatioBucket`
  - `imagePlaceholder`
  - `imageWidth`
  - `imageHeight`

占位图在创建 / 更新帖子时于前端生成。

### 4. 更新创建 / 编辑帖子流程

更新：

- `app/features/post/services/post.service.ts`
- `app/features/post/api/post.api.ts`
- `app/features/post/components/PostForm.tsx`
- 如预览逻辑需要统一，可顺带调整 `app/components/shared/FileUploader.tsx`

改动：

- 上传新图片时：
  - 读取图片宽高
  - 计算最接近的比例桶
  - 生成 LQIP data URL
  - 将原图上传到 Appwrite Storage
  - 将原图 URL 和图片元数据一起写入 `posts` row
- 编辑帖子但不替换图片时：
  - 保留原有图片元数据
- 编辑帖子且替换图片时：
  - 重新生成全部图片元数据

### 5. 新增首页 feed 分页 API 和 Query

更新：

- `app/features/post/api/post.api.ts`
- `app/features/post/services/post.service.ts`
- `app/features/post/queries/post.queries.ts`
- 如有必要，补充 `app/features/post/queries/post.keys.ts`

新增：

- 首页 feed 的 cursor 分页 API
- 返回 `CursorPage<T>` 的 service 方法
- `useHomeFeedInfiniteQuery()`

行为要求：

- 按最新发布帖子排序
- 使用 cursor 分页
- 使用 `Query.limit()`
- 使用 `Query.cursorAfter()`
- 使用 `total: false`

首页不应继续复用当前固定数量的 recent-post query。

### 6. 构建可复用的渐进式图片组件

新增一个可复用图片组件，例如：

- `app/features/post/components/ProgressiveImage.tsx`

职责：

- 按比例桶预留布局空间
- 第一阶段立即渲染灰色骨架
- 当卡片接近视口时，切换显示 LQIP 占位图
- 懒加载原图
- 等待原图解码完成后再淡入显示
- 原图就绪后隐藏骨架和占位图

建议状态：

- `idle`
  - 只显示灰色骨架
- `placeholder`
  - 显示占位图
  - shimmer 生效
- `full`
  - 原图已 decode 并完成淡入

建议机制：

- 使用 `IntersectionObserver` 在卡片接近视口时启动占位图 / 原图加载流程
- 使用 `Image.decode()` 后再切换到原图
- 渲染的 `<img>` 仍保留 `loading="lazy"` 和 `decoding="async"` 作为浏览器层兜底

### 7. 构建可复用的瀑布流基础组件

新增可复用组件，例如：

- `app/features/post/components/MasonryFeed.tsx`
- `app/features/post/components/MasonryPostCard.tsx`

`MasonryFeed` 职责：

- 根据视口宽度确定列数
- 将卡片分配到各列
- 支持分页追加新数据而不破坏整条 feed
- 在不同断点下保持统一的间距和容器布局

`MasonryPostCard` 职责：

- 渲染首页专用卡片布局
- 使用 `ProgressiveImage`
- 渲染截断后的 caption
- 渲染作者头像和作者名
- 渲染点赞数

### 8. 替换首页路由 UI

更新：

- `app/routes/home.tsx`

改动：

- 用瀑布流替换当前单列内容
- 接入新的 infinite query
- 保留首页首屏加载态和整页错误态
- 在底部显示以下状态：
  - 正在加载下一页
  - 下一页加载失败后的重试
  - 没有更多内容

无限滚动 sentinel 应位于瀑布流列容器之外，使其表现为 feed 控件而不是普通卡片。

## 为什么选择这个方案

### 为什么将 LQIP 元数据存到帖子 row 中

占位图应作为文本存储在帖子 row 中，而不是作为单独文件存储到 Appwrite Storage。

原因：

- 占位图本质上是渲染元数据，不是主媒体资源。
- 占位图应与 feed row 一次性返回。
- 如果单独存成文件，每个卡片都会产生额外网络请求。
- 额外图片请求不适合 Appwrite 免费版的带宽约束。
- Appwrite 免费版不适合作为动态图片变换的基础能力依赖。

原图仍应存储在 Appwrite Storage 中。  
占位图数据属于 `posts` 表。

### 为什么选择 JS 计算式瀑布流，而不是 CSS 多列

CSS 多列虽然实现更简单，但在以下方面控制力较弱：

- feed 排序和阅读顺序表现
- 分页尾部状态
- 后续虚拟化扩展
- 卡片分布控制
- 与交互型 feed 逻辑的结合

JS 计算式分列更适合当前项目，因为需求不是“看起来像瀑布流”就够，而是要真正接近小红书式 feed，同时支持：

- 自动分页
- 重试状态
- 明确的结束态
- 可复用的 feed 基础组件

### 为什么第一版用“估算高度”而不是完整测量布局

当前项目已经把图片比例限制在固定分桶内，同时 caption 会做截断，这使得卡片高度在第一版已经足够可预测。

这种做法的好处：

- 避免过度设计
- 第一版更容易维护
- 如果后续发现卡片高度漂移明显，再升级为测量式布局即可

### 为什么图片加载流程选择“灰骨架 -> 占位图 -> 原图”

这个流程比“数据一到就直接显示占位图”更接近目标体验。

优点：

- 首帧更稳定
- 首屏 feed 不会一上来就出现大量彩色模糊图，视觉噪音更低
- 更贴近你观察到的小红书首页体验
- 占位图仍然是内联元数据，不会产生额外请求

## 实现顺序与依赖关系

### 阶段 1：Schema

任务：

- 更新本地 `appwrite.config.json`
- 在线上 Appwrite 项目中增加帖子新字段

依赖：

- 必须在前端开始写入或查询新字段之前完成

### 阶段 2：类型与查询结构

任务：

- 扩展帖子类型
- 扩展 select 字段
- 扩展 mapper

依赖：

- 依赖 schema 约定明确
- 应早于 UI 开发完成，以稳定组件输入输出契约

### 阶段 3：上传元数据链路

任务：

- 新增图片元数据工具
- 将元数据生成接入 create / update service

依赖：

- 依赖新的 schema 字段
- 该阶段完成后，新帖子才具备首页瀑布流所需的元数据能力

### 阶段 4：首页分页数据层

任务：

- 新增首页 feed API / service / query
- 保持按最新发布排序

依赖：

- 旧帖子即使没有 LQIP 元数据，这一层也可以先独立完成
- 但首页新 UI 上线前必须完成

### 阶段 5：渐进式图片组件

任务：

- 实现图片组件
- 实现骨架、占位图、decode 和 fade-in 行为

依赖：

- 依赖新的 view model 字段
- 应先于卡片组件完成，避免重复写图片加载逻辑

### 阶段 6：瀑布流组件

任务：

- 实现 `MasonryFeed`
- 实现 `MasonryPostCard`

依赖：

- 依赖渐进式图片组件
- 依赖首页 feed query 的数据契约

### 阶段 7：首页接入

任务：

- 用新 feed 替换当前首页实现
- 增加无限滚动 sentinel 和尾部状态

依赖：

- 依赖前面所有阶段

### 阶段 8：验证

任务：

- 运行 `npm run typecheck`
- 验证创建帖子
- 验证编辑帖子时替换图片和不替换图片两条路径
- 验证旧帖子降级行为
- 验证分页、重试、列表结束态
- 验证手机 / 平板 / 桌面列数表现

## 关键风险与应对策略

### 风险：Schema 与代码不一致

问题：

- 代码可能开始读写 Appwrite 中尚未存在的字段。

应对：

- 先做 schema 变更，再提交前端读写逻辑。
- 新字段尽量允许为空。
- mapper 中为旧数据提供默认值。

### 风险：占位图过大，导致 row 负载膨胀

问题：

- 如果生成的 data URL 过大，feed 返回体积会明显增大，Appwrite 读请求成本也会变高。

应对：

- 将占位图控制在极小尺寸，例如最长边 24-40px。
- 优先使用低质量 WebP 或 JPEG。
- 为 placeholder 长度设置上限。
- 超出上限时不写入 placeholder，直接降级为纯骨架方案。

### 风险：浏览器端生成 LQIP 失败

问题：

- 某些图片文件、canvas 行为或浏览器状态可能导致 decode 或绘制失败。

应对：

- 将 placeholder 生成视为增强能力，而不是发帖的硬依赖。
- 生成失败时不能阻断发帖。
- 至少尽量保留比例桶和宽高信息。

### 风险：旧帖子没有元数据

问题：

- 现有帖子没有 placeholder 和比例字段。

应对：

- 默认比例桶使用 `3:4`
- 缺少 placeholder 时使用灰骨架和普通懒加载
- 本期不要求强制迁移旧数据

### 风险：瀑布流分列不均衡

问题：

- caption 换行和字体实际渲染高度可能导致列高分布不完全均衡。

应对：

- 限制 caption 行数
- 保持底部信息区高度稳定
- 通过比例分桶使图片区域高度可预测
- 只有在真实漂移明显时，再升级为测量式布局

### 风险：无限滚动重复触发

问题：

- sentinel 可能多次触发，造成重复请求下一页。

应对：

- 触发条件加保护：
  - `hasNextPage`
  - `!isFetchingNextPage`
  - `!isError`
- 下一页请求失败时，使用显式重试 UI，而不是自动无限重试

### 风险：图片解码和加载存在竞态

问题：

- 快速滚动或组件卸载可能导致异步回调在无效时机更新状态。

应对：

- 为异步回调增加 mounted 状态保护
- observer 失效时及时清理
- decode 失败时降级为普通图片显示

### 风险：Appwrite 免费版带宽和读请求限制

问题：

- 首页 feed 图片密集，免费版资源比较紧。

应对：

- 控制 page size，不要过大
- 将 placeholder 控制得足够小
- 避免单独请求占位图
- 原图只在接近视口时懒加载
- 分页使用 `total: false`

## 预期结果

实现完成后：

- 首页会变成真正分页的瀑布流 feed。
- 新帖子会具备稳定比例占位和渐进式图片加载能力。
- 旧帖子仍可安全显示，并通过降级策略兼容。
- feed 逻辑和组件将可复用到后续其他列表页。
- 方案与当前项目架构和 Appwrite 免费版约束保持一致。
