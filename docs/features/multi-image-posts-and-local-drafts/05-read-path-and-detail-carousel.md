# 多图帖子与本地草稿箱步骤五：切换读路径和详情轮播

## 目的

本步骤用于把“多图帖子”从只完成写入，推进到真正可读、可回显、可浏览的状态。

前四步完成后，系统已经具备这些前置条件：

- `posts` 已重构为“摘要 + 封面投影”模型。
- `postMedia` 已成为帖子图片组的真实数据源。
- 创建和编辑的最终写入边界已经切到 `content-actions`。
- 新创建和新编辑的帖子，已经可以写出多条 `postMedia` rows。

但当前前端读路径仍然停留在单图时代：

- `getPostById()` 只读 `posts.imageId / imageUrl`
- `getPostEditorRow()` 也只返回单图封面投影字段
- `PostDetailViewModel` 仍然只有：
  - `imageId`
  - `imageUrl`
- `PostEditorInitialData` 仍然只表达一张旧图
- `postDetails.tsx` 仍然只渲染一个 `<img>`

本步骤的目标有六个：

- 让详情页和编辑页的真实图片来源切到 `postMedia`。
- 保持首页、搜索、个人页等列表页继续只读 `posts` 封面投影字段。
- 在迁移脚本执行前，兼容旧帖子只有 `posts.imageId` 的 legacy 单图数据。
- 为详情页新增第一版多图轮播，满足“类似小红书”的手动滑动浏览体验。
- 让编辑页稳定回显 existing media 顺序，为步骤四的多图编辑写链路提供真实读模型。
- 把“详情/编辑的聚合读模型”和“列表摘要读模型”正式分层，避免后续继续在 `posts` 上堆字段。

本步骤不包含：

- 不改变首页、搜索、个人页的列表查询策略
- 不引入新的服务端写能力
- 不执行旧数据迁移脚本
- 不实现详情模态路由
- 不引入视频或其他非图片媒体

## 验收标准

本步骤完成后，应满足以下验收标准：

- 详情页读取帖子时，会同时拿到：
  - `posts` 元信息
  - 按 `sortOrder` 排序的 `postMedia` 列表
- 编辑页读取初始数据时，会同时拿到：
  - 文本字段
  - 按顺序排列的 existing media items
- 详情页不再只依赖 `post.imageUrl` 渲染单图，而是渲染 `media[]`。
- 编辑页可以稳定回显多张旧图顺序。
- 列表页继续只依赖：
  - `posts.imageUrl`
  - `posts.imagePlaceholder`
  - `posts.aspectRatioBucket`
  - `posts.mediaCount`
  等封面投影字段，不追加 `postMedia` N+1 查询。
- 对于迁移前的旧帖子：
  - 如果 `postMedia` rows 为空，但 `posts.imageId` 仍存在
  - 详情页仍能回退显示一张图片
  - 编辑页仍能回退显示一个 legacy 媒体项
- 详情轮播第一版支持：
  - 触屏横向滑动
  - 左右切换按钮
  - 当前页指示
  - 最多 6 张图的稳定切换
- 详情页图片加载失败时，不会导致整个页面崩溃，而是出现单张媒体级降级结果。

## 改了什么，改在哪里

### 一、把详情页和编辑页的读模型从“单个封面字段”切到“`posts` + `postMedia` 聚合查询”

改动位置：

- `app/features/post/api/post.api.ts`
- `app/features/post/services/post.service.ts`
- `app/features/post/queries/post.queries.ts`
- `app/features/post/types/post.type.ts`
- `app/features/post/mappers/post.mapper.ts`

当前状态：

- `getPostById(postId)` 只读取 `posts` row
- `getPostEditorRow(postId)` 也只读取 `posts` row
- 服务层和 mapper 层都默认“一条帖子 = 一张图片”

本步骤建议把详情页和编辑页的读取改成两段式聚合：

- 详情页：
  - 先读 `posts` 元数据
  - 再按 `postId` 读取 `postMedia` rows
  - 在 service 层合并成 `PostDetailViewModel`
- 编辑页：
  - 先读 editor 所需的 `posts` 文本字段和封面投影
  - 再按 `postId` 读取 `postMedia` rows
  - 在 service 层合并成 `PostEditorInitialData`

这里不建议让 `postDetails.tsx` 或 `editPost.tsx` 自己发两次 query，再在组件里拼装数据。

原因：

- 页面层会立刻面对：
  - 双 loading state
  - 双 error state
  - 聚合顺序
  - legacy fallback
- 这些都属于读模型编排，而不是页面展示职责
- service 层用 `Promise.all()` 聚合后，React Query 仍然只需要维护一个 query key

### 二、为 `postMedia` 增加前端读类型和 mapper，正式承认它是详情/编辑真源

改动位置：

- `app/features/post/types/post.type.ts`
- `app/features/post/mappers/post.mapper.ts`

建议新增类型：

- `RawPostMediaRow`
  - `$id`
  - `fileId`
  - `sortOrder`
  - `width`
  - `height`
  - `aspectRatioBucket`
  - `placeholder`
- `PostMediaViewModel`
  - `id`
  - `fileId`
  - `imageUrl`
  - `sortOrder`
  - `width`
  - `height`
  - `aspectRatioBucket`
  - `placeholder`
- `PostDetailViewModel`
  - 在现有字段基础上新增：
    - `media`
    - `mediaCount`
- `PostEditorInitialData`
  - 在现有文本字段基础上新增：
    - `existingMediaItems`
    - `isLegacyMediaFallback`

建议新增 mapper：

- `mapPostMediaRowToViewModel(row)`
- `mapPostMediaRowsToOrderedViewModels(rows)`
- `buildLegacyFallbackMediaFromPost(row)`

这里不建议把 `postMedia` 仍然当作“详情页内部临时数组”，不进入 feature 类型系统。

原因：

- 一旦它成为详情页和编辑页真实来源，就应该在类型层被正式建模
- 否则后续会出现：
  - service 层一套临时 shape
  - carousel 一套临时 shape
  - editor 一套临时 shape

### 三、增加 legacy fallback，保证第五步先切读路径，第六步再迁移旧数据时不炸页面

改动位置：

- `app/features/post/services/post.service.ts`
- `app/features/post/mappers/post.mapper.ts`

这是第五步里最关键的兼容点。

总体顺序是：

- 第五步先切读路径
- 第六步再执行旧数据迁移

这意味着第五步不能假设所有帖子都已经有 `postMedia` rows。

建议的 fallback 规则：

- 若 `postMedia` rows 存在且数量 > 0：
  - 以 `postMedia` 为准
- 若 `postMedia` rows 为空，但 `posts.imageId` 和 `posts.imageUrl` 仍存在：
  - 合成一个单项 `media[]`
  - `sortOrder = 0`
  - `imageUrl = posts.imageUrl`
  - 其他元数据优先复用 `posts` 封面投影字段
- 若二者都没有：
  - 视为损坏数据
  - 详情页返回空媒体数组或媒体级空态

这里建议把 fallback 放在 service 或 mapper 层，而不是散落到 `postDetails.tsx` 和编辑页。

原因：

- 旧数据兼容是数据读模型责任，不是页面 UI 特判
- 第六步迁移完成后，这块逻辑也更容易被集中收口或降级保留

### 四、保持列表页继续只读 `posts` 封面投影字段，不把 `postMedia` 扩散到 feed 查询

改动位置：

- `app/features/post/api/post.api.ts`
- `app/features/post/services/post.service.ts`
- 文档层明确不改：
  - `listHomeFeedPostRows()`
  - `listProfilePublishedPostRows()`
  - `listExplorePostRows()`
  - `listSearchPostRows()`

当前状态：

- 列表页已经基于 `posts` 封面字段工作
- `MasonryFeed` 和 `MasonryPostCard` 会消费：
  - `imageUrl`
  - `imagePlaceholder`
  - `aspectRatioBucket`

本步骤不建议把列表页一起切到 `postMedia`。

原因：

- 列表页只需要封面，不需要完整媒体组
- 如果每张卡片都再查一次 `postMedia`，性能会立刻退化成 N+1
- `posts` 封面投影字段的存在意义，本来就是给列表读模型减负

因此第五步需要明确：

- 详情页和编辑页切真源
- 列表页保持摘要源

### 五、为详情页新增 feature-local 轮播组件，但不引入新的第三方轮播依赖

改动位置：

- 新增 `app/features/post/components/PostMediaCarousel.tsx`
- 如有必要，新增：
  - `app/features/post/components/PostMediaCarouselDots.tsx`
  - `app/features/post/components/PostMediaCarouselCounter.tsx`
- `app/routes/postDetails.tsx`

当前状态：

- 详情页只渲染一个 `<img>`
- 项目里没有现成的 carousel UI primitive
- `package.json` 也没有 `embla`、`swiper` 这类轮播依赖

本步骤建议第一版使用轻量方案：

- 轮播容器基于原生横向滚动
- 配合 CSS `scroll-snap`
- 左右切换按钮使用普通 `<button>`
- 当前页指示使用 dots 或 `1 / N` counter
- 不做自动播放

建议交互：

- 移动端：
  - 直接手指横向滑动
- 桌面端：
  - 左右按钮切换
  - 鼠标滚轮不绑定横向行为
- 所有端：
  - dots 可点击跳转
  - 当前页有明确激活态

这里不建议为了第一版详情轮播额外引入新依赖。

原因：

- 媒体上限只有 6 张
- 轮播不需要：
  - 无限循环
  - 自动播放
  - 缩略图轨道
  - 虚拟化
- 当前项目也没有现成 dialog / carousel UI 基建，贸然加依赖只会放大样式和维护面
- 原生 scroll-snap 已经足够覆盖：
  - 触屏滑动
  - 简单分页
  - 低复杂度维护

### 六、详情页轮播采用“稳定容器 + `object-contain` 媒体内容”的策略，避免多比例图片切换时页面跳动

改动位置：

- `app/features/post/components/PostMediaCarousel.tsx`
- `app/routes/postDetails.tsx`

当前项目里的图片比例桶只有：

- `1:1`
- `3:4`
- `4:3`

如果每一张详情图都直接按自身比例改容器高度，轮播切换时会产生明显跳动。

本步骤建议：

- 轮播外层视口使用首图或封面投影字段确定稳定比例
- 单张媒体内容在视口内使用 `object-contain`
- 视口背景使用中性色或 placeholder 背景

这样可以同时满足：

- 页面布局稳定
- 图片完整显示，不强制裁剪
- 多张图比例不一致时不会让详情页整体反复重排

这里不建议第一版就做“轮播视口高度跟随当前图片动态变化”。

原因：

- 视觉上更接近内容浏览产品，但实现复杂度明显更高
- 当前阶段读模型切换本身已经有较多工作量
- 第一版先以稳定和可维护为优先

### 七、让详情页和编辑页共享同一套 ordered media 解析结果，避免顺序逻辑重复实现

改动位置：

- `app/features/post/services/post.service.ts`
- `app/features/post/mappers/post.mapper.ts`
- `app/routes/postDetails.tsx`
- `app/routes/editPost.tsx`

建议新增共享 helper，例如：

- `resolveOrderedPostMedia(postRow, mediaRows)`

职责：

- `sortOrder` 升序排序
- fallback legacy 单图
- 生成 `imageUrl`
- 去重或过滤坏数据

这样：

- 详情页消费 `media[]`
- 编辑页消费 `existingMediaItems[]`

两边顺序逻辑保持一致。

这里不建议让详情页和编辑页各自手写一份：

- `sort`
- `fallback`
- `url map`

原因：

- 这是最容易在后续出现“详情顺序对，编辑顺序错”的地方
- 共用一个 helper 才能保证排序语义一致

## 为什么选择这个方案

### 为什么详情/编辑读路径要做 service 层聚合，而不是页面层双 query

原因：

- 页面层一旦自己发两次 query，就要自己处理：
  - 双 loading
  - 双 error
  - fallback 拼装
  - query 成功先后顺序
- 当前 detail 和 editor 都只需要一个聚合后的 view model

因此更稳妥的方案是：

- API 层负责读原始 rows
- service 层聚合 `posts + postMedia`
- query 层继续只暴露一个 query 给页面

### 为什么列表页不一起切到 `postMedia`

原因：

- 列表页只需要封面和少量摘要字段
- `posts` 封面投影字段已经是专门为列表读模型存在
- 如果为了“统一”而强行让所有列表都回查 `postMedia`，会直接损失性能和简洁性

这个分层是本期架构的核心：

- `posts` = 列表摘要源
- `postMedia` = 详情/编辑真源

### 为什么第一版详情轮播选择原生 scroll-snap，而不是新依赖

原因：

- 项目当前没有轮播基础设施
- 需求也没有复杂到需要完整 carousel framework
- 手动分页、触屏滑动、按钮切换和 dots 指示，本质上都是浏览器原生能力能覆盖的范围

在这个阶段，引入新依赖的收益不高，反而会带来：

- 额外 bundle
- 样式接线成本
- 后续升级维护成本

### 为什么要在第六步迁移前保留 legacy fallback

原因：

- 第五步先切读路径，第六步才迁移旧数据
- 在这个窗口内，系统天然同时存在：
  - 有 `postMedia` 的新帖子
  - 只有 `posts.imageId` 的旧帖子

如果没有 fallback，第五步一落地，旧帖子详情页就会立刻变成空媒体。

### 为什么轮播第一版优先“稳定容器 + `object-contain`”

原因：

- 当前比例桶虽然有限，但仍然可能混合出现
- 详情页是整页布局，轮播区高度频繁变化会让正文、统计和操作区整体跳动
- 第一版重点是：
  - 顺序正确
  - 可滑动
  - 可回显
  - 可访问

比起追求最复杂的动态高度轮播，这个方案更稳。

## 实现顺序与依赖关系

### 第一步：冻结 `postMedia` 前端读类型和 detail/editor view model

工作：

- 在 `post.type.ts` 中增加：
  - `RawPostMediaRow`
  - `PostMediaViewModel`
  - `PostDetailViewModel.media`
  - `PostEditorInitialData.existingMediaItems`
- 明确 legacy fallback 是否通过：
  - `isLegacyMediaFallback`
  暴露给编辑页

依赖：

- 依赖步骤一的 schema 契约已经定义 `postMedia`
- 依赖步骤四的编辑写链路已经明确 existing media item 的基本形状

说明：

- 类型先定清，后面的 API、mapper、route 才不会来回改 shape。

### 第二步：在 API 层新增 `postMedia` 读取函数

工作：

- 在 `post.api.ts` 中新增：
  - `listPostMediaRowsByPostId(postId)`
- 查询规则：
  - `Query.equal('post', postId)`
  - `Query.orderAsc('sortOrder')`
  - 显式 `select` 需要字段

依赖：

- 依赖 `postMedia` 表索引和字段已经就绪

说明：

- 先有稳定的底层查询，service 聚合和 fallback 才能成立。

### 第三步：在 mapper/service 层加入 ordered media 解析和 legacy fallback

工作：

- 新增：
  - `mapPostMediaRowToViewModel()`
  - `resolveOrderedPostMedia()`
  - `buildLegacyFallbackMediaFromPost()`
- 更新：
  - `getPostDetail(postId)`
  - `getPostEditorInitialData(postId)`

建议实现：

- `Promise.all([getPostById(), listPostMediaRowsByPostId()])`
- 在 service 层统一处理：
  - 正常多图
  - legacy 单图 fallback
  - 损坏数据降级

依赖：

- 依赖第二步 API 已可读取 `postMedia`

说明：

- 这一阶段先把数据闭环跑通，还不急着改详情页 UI。

### 第四步：先切编辑页读路径

工作：

- 更新 `useGetPostEditorQuery()` 相关 service 返回
- 更新编辑页初始数据 shape
- 让编辑页拿到稳定的 `existingMediaItems[]`

依赖：

- 依赖第三步聚合读模型已稳定

说明：

- 编辑页回显比详情轮播更关键，因为它直接影响多图编辑的可用性。
- 如果第四步写链路已经切换，这一步应优先完成，避免 editor 仍停留在封面图假数据。

### 第五步：切详情页读路径并接入轮播组件

工作：

- 新增 `PostMediaCarousel.tsx`
- `postDetails.tsx` 从单 `<img>` 改为渲染 `post.media`
- 补齐：
  - 按钮
  - dots / counter
  - 媒体级加载失败降级

依赖：

- 依赖第三步 detail 聚合读模型已稳定

说明：

- 到这一步，详情页才真正体现“多图帖子”用户价值。

### 第六步：回归 legacy fallback，并把第六步迁移的前置校验写清楚

工作：

- 验证：
  - 新多图帖子详情
  - 新多图帖子编辑回显
  - 旧单图帖子详情 fallback
  - 旧单图帖子编辑 fallback
- 明确迁移前后行为：
  - 迁移前允许 fallback
  - 迁移后 `postMedia` 应成为唯一真源

依赖：

- 依赖前五步完成

说明：

- 这一步是第六步迁移脚本真正开始执行前的最后防线。

## 关键风险及应对策略

### 风险一：第五步先切读路径，但旧帖子还没有 `postMedia` rows，导致详情页直接空白

问题：

- 当前系统里仍然存在 legacy 单图帖子
- 第六步迁移脚本还没运行

应对：

- 在 service 层保留 `posts.imageId` fallback
- 旧帖子详情页合成一个单项 `media[]`
- 第六步迁移完成后，再逐步把 fallback 降级为兜底逻辑

### 风险二：编辑页虽然能回显 legacy 单图，但旧帖子在迁移前缺少真实 `mediaId`

问题：

- 写链路最终需要 existing `mediaId`
- legacy fallback 只能保证“读得出来”，不天然保证“可无损编辑”

应对：

- 第五步至少保证旧帖子在编辑页可见、顺序可回显
- rollout 时明确：
  - 若步骤四已经要求 strict existing `mediaId`
  - 则旧帖子编辑能力必须和第六步迁移联动验证
- 不把“legacy 可读”误表述成“legacy 已完全等价可编辑”

### 风险三：把 `postMedia` 扩散到 feed 列表，造成 N+1 查询和滚动性能回退

问题：

- 一旦列表页也改成每条帖子查一组媒体
- 首页、搜索、个人页的滚动性能会立刻下降

应对：

- 文档和实现都明确限制：
  - 只有 detail/editor 切到 `postMedia`
  - feed/list 继续只读 `posts`
- review 时把 `list*Posts` 是否新增 `postMedia` 查询当成红线检查项

### 风险四：轮播引入新依赖，结果把第五步复杂度放大到 UI 基建改造

问题：

- 当前项目没有现成 carousel 基建
- 新依赖通常伴随：
  - 样式适配
  - SSR/CSR 行为差异
  - API 学习和维护成本

应对：

- 第一版限定为手动轮播
- 用原生 scroll-snap 实现
- 不做自动播放、缩略图轨道或无限循环

### 风险五：多比例图片在详情轮播中切换时高度跳变，导致正文和操作区抖动

问题：

- 图片组允许混合 `1:1`、`3:4`、`4:3`
- 若轮播高度跟着当前图跳变，体验会很差

应对：

- 用首图/封面投影确定稳定外层视口
- 图片内容使用 `object-contain`
- 允许留白，不强裁剪

### 风险六：某一张媒体文件权限异常或文件损坏，导致整个详情页渲染失败

问题：

- 第四步和第三步都已经承认可能存在：
  - `filePublicationFailed`
  - 单文件异常

应对：

- 轮播组件按“单张媒体失败”降级，而不是整页抛错
- 出错 slide 用占位块或 `ImageOff` 类空态图标替代
- 详情页主查询只在帖子元数据本身失败时进入 page-level error

### 风险七：detail 和 editor 各自实现一套 `sortOrder` / fallback 逻辑，后续顺序漂移

问题：

- 如果两处各写一套排序和合成逻辑
- 很容易出现：
  - 编辑页顺序对
  - 详情页顺序错
  或反过来

应对：

- 把 ordered media 解析下沉到共享 helper
- 页面层只消费最终结果
- review 时禁止 route 组件自己手写媒体排序

## 预期结果

本步骤完成后，项目会获得一个真正分层清晰的多图读模型：

- 列表页继续稳定依赖 `posts` 封面投影字段。
- 详情页和编辑页正式改为以 `postMedia` 为真实图片源。
- 旧帖子在迁移前仍然可读，不会因为第五步先切读路径而整体失效。
- 详情页具备第一版多图轮播，用户可以按顺序浏览帖子图片组。
- 编辑页能够稳定回显旧图顺序，为多图编辑链路提供真实初始数据。
- 第六步迁移脚本只需要把 legacy 数据补齐到 `postMedia`，而不用再反过来修补第五步的读模型设计。
