# 首页瀑布流步骤六：MasonryFeed 与 MasonryPostCard 设计

## 目的

本步骤用于实现首页瀑布流的核心展示层：

- `MasonryFeed`
- `MasonryPostCard`

本步骤的目标是：

- 为首页提供小红书风格的瀑布流布局。
- 通过断点计算列数，实现手机 2 列、平板 3-4 列、桌面 4-5 列的响应式布局。
- 在拿到分页数据后，按估算高度将卡片分配到当前最短列。
- 将首页卡片视觉从现有 `PostCard` / `GridPostList` 中独立出来，避免影响详情页或 Explore 的旧卡片。
- 在第一版中优先保证实现可维护、可落地，不引入虚拟化，也不实现离开视口后的图片状态重置。

本步骤不负责：

- 首页分页数据查询
- 渐进式图片组件内部实现
- 图片元数据生成
- 真正的虚拟化或离屏卸载

## 验收标准

本步骤完成后，应满足以下验收标准：

- 新增 `MasonryFeed` 组件，例如：
  - `app/features/post/components/MasonryFeed.tsx`
- 新增首页专用卡片组件，例如：
  - `app/features/post/components/MasonryPostCard.tsx`
- `MasonryFeed` 能根据当前断点或容器宽度确定列数。
- `MasonryFeed` 使用“多列 wrapper 渲染”方式：
  - 外层负责列布局
  - 每列内部按纵向顺序渲染卡片
- 分页拿到的所有首页帖子会先根据估算高度分配到最短列，再渲染。
- 卡片高度估算至少考虑：
  - `aspectRatioBucket` 对应的图片高度
  - caption 高度
  - 底部作者与点赞区高度
  - 卡片内边距与列间 gap
- `MasonryPostCard` 只服务于首页瀑布流，不替换现有：
  - `PostCard`
  - `GridPostList`
- `MasonryPostCard` 内部接入：
  - `ProgressiveImage`
  - caption 截断
  - 作者头像与作者名
  - 点赞数
- 组件第一版不做：
  - 真正虚拟化
  - 离开视口后状态重置
  - 真实高度测量修正
- 响应式重排时，列数变化会重新分列，而不是只靠 CSS 改列宽。

## 改了什么，改在哪里

### 一、新增 `MasonryFeed`

改动位置：

- `app/features/post/components/MasonryFeed.tsx`

职责：

- 根据断点或容器宽度确定当前列数
- 根据列数计算列宽
- 根据列宽和卡片估算规则计算每个 item 的估算高度
- 将所有 item 分配到当前最短列
- 渲染列容器和列内卡片

第一版渲染方式明确采用“多列 wrapper 渲染”：

- 外层容器使用 `grid` 或等价布局来排列列
- 每列内部使用 `flex-col` 堆叠卡片

典型结构：

- 外层：列布局容器
- 中层：每一列 wrapper
- 内层：每列下的 `MasonryPostCard`

这里的 `grid-template-columns` 作用是“定义列容器数量”，不是直接让浏览器自动完成真正的瀑布流分配。
真正的瀑布流分配由 JS 完成。

### 二、新增 `MasonryPostCard`

改动位置：

- `app/features/post/components/MasonryPostCard.tsx`

职责：

- 渲染首页专用帖子卡片视觉
- 使用 `ProgressiveImage` 显示封面
- 渲染截断 caption
- 渲染作者头像和作者名
- 渲染点赞数
- 保持视觉方向贴近小红书首页

这个组件只用于首页瀑布流，不替换现有：

- `app/features/post/components/PostCard.tsx`
- `app/features/post/components/GridPostList.tsx`

这样可以保证：

- 详情页现有布局不受影响
- Explore 现有网格卡片不受影响
- 首页新卡片能独立演进

### 三、新增首页卡片高度估算逻辑

改动位置：

- 建议放在 `MasonryFeed.tsx` 内部
- 或抽成轻量工具，例如：
  - `app/features/post/lib/masonry.ts`

建议至少包含：

- `getColumnCount(...)`
- `getAspectRatioValue(bucket)`
- `estimateMasonryCardHeight(item, columnWidth)`
- `getShortestColumnIndex(columns)`
- `distributeItemsToColumns(items, columnCount, columnWidth, gap)`

第一版高度估算建议由以下部分组成：

- 图片高度
  - 通过 `aspectRatioBucket` 和 `columnWidth` 推导
- caption 高度
  - 基于固定行数截断做近似固定估算
- 作者和点赞区高度
  - 固定高度
- 内边距和间距
  - 固定高度

不建议第一版直接引入真实 DOM 测量，因为当前：

- 图片比例已分桶
- caption 会截断
- 信息区结构稳定

估算高度足以支撑第一版实现。

### 四、首页卡片与数据契约对齐

改动位置：

- `app/features/post/types/post.type.ts`
- `app/features/post/mappers/post.mapper.ts`
- `app/features/post/components/MasonryPostCard.tsx`

依赖前面已经定义好的首页专用 view model。

`MasonryPostCard` 建议消费首页专用 view model，而不是现有：

- `PostCardViewModel`
- `PostGridItemViewModel`

原因：

- 首页卡片有比例、placeholder 等专属字段
- 首页卡片视觉和旧卡片职责不同

## 为什么选择这个方案

### 为什么第一版选择“多列 wrapper 渲染”

第一版选择多列 wrapper，而不是绝对定位版，原因如下：

- 实现复杂度更低
- 更符合当前项目阶段
- 与 React 组件树和 JSX 渲染习惯更自然
- 不需要手动维护整个容器的绝对定位坐标和总高度
- 更适合先把分页、LQIP、渐进图和瀑布流主链路打通

当前项目的重点是：

- 首页瀑布流体验
- 分页流
- 渐进式图片

而不是提前实现一套高复杂度的 masonry 虚拟化布局引擎。

### 为什么不用 CSS 自动完成瀑布流

仅使用 `grid-template-columns` 或普通 CSS Grid，不能实现“将新卡片放到当前最短列”的分配策略。

真正的小红书/Pinterest 风格瀑布流，需要 JS 参与：

- 决定列数
- 估算卡片高度
- 将每张卡片分配到最短列

所以本方案中：

- CSS 负责“列的呈现”
- JS 负责“卡片的分配”

### 为什么第一版不做虚拟化

因为当前阶段的目标是先稳定实现正确的首页 feed 体验，而不是过早优化到复杂的列表性能系统。

不做虚拟化的原因：

- 多列 wrapper 下如果要做真正虚拟化，复杂度会快速上升
- 需要维护每列自己的可视范围和占位结构
- 需要处理响应式切换、列高漂移、离屏占位等问题
- 当前项目第一版并不需要在这里投入这么高复杂度

因此第一版明确选择：

- 多列 wrapper
- 不做虚拟化

### 为什么第一版不做“离开后重置显示状态”

因为该行为主要影响体验，不显著优化性能。

如果组件离开视口后只是重置状态，但不卸载：

- DOM 没减少
- 布局参与没减少
- 图片元素仍可能在内存中

因此第一版不做此行为，避免在 `ProgressiveImage` 与 `MasonryFeed` 之间引入额外的复杂度。

### 为什么用估算高度而不测量真实高度

当前首页卡片有几个关键前提：

- 图片比例分桶固定
- caption 会截断
- 底部信息区高度可控

这使得卡片高度在第一版已经足够可预测。

估算高度的好处：

- 逻辑清晰
- 实现轻量
- 更适合当前阶段

如果后续发现：

- 列高失衡明显
- 某些比例桶与真实视觉偏差过大

再考虑引入真实测量修正即可。

## 实现顺序与依赖关系

### 第一步：完成首页分页数据层

依赖：

- 依赖步骤四中的首页分页 API / service / query

原因：

- `MasonryFeed` 需要稳定拿到首页分页后的数据集合

### 第二步：完成 `ProgressiveImage`

依赖：

- 依赖步骤五中的渐进式图片组件

原因：

- `MasonryPostCard` 会直接消费它

### 第三步：确定首页卡片 view model

依赖：

- 依赖步骤一中的首页类型和 mapper 设计

原因：

- `MasonryPostCard` 的输入契约必须稳定

### 第四步：实现列数计算规则

操作：

- 根据断点或容器宽度确定列数

建议目标：

- 手机：2 列
- 平板：3-4 列
- 桌面：4-5 列

依赖：

- 可先独立实现

### 第五步：实现卡片高度估算与最短列分配

操作：

- 根据列宽估算每张卡片高度
- 遍历列高度数组
- 找到最短列
- 将卡片加入最短列的 items 中
- 更新该列累计高度

依赖：

- 依赖列数和列宽确定

### 第六步：实现 `MasonryFeed` 渲染

操作：

- 渲染外层列布局
- 渲染每列 wrapper
- 渲染列内卡片

依赖：

- 依赖分列结果已可计算

### 第七步：实现 `MasonryPostCard` 视觉

操作：

- 接入 `ProgressiveImage`
- 加入 caption、作者、点赞区
- 处理截断、留白、圆角等视觉样式

依赖：

- 依赖首页卡片 view model

### 第八步：处理响应式重排

操作：

- 当断点或容器宽度变化时，重新计算列数
- 基于当前 items 重新分列

依赖：

- 依赖前面分列逻辑已稳定

### 第九步：与首页 route 接入

操作：

- 在首页组件中用 `MasonryFeed` 替换旧卡片列表

依赖：

- 依赖前面所有阶段

## 关键风险及应对策略

### 风险：列数变化时只改 CSS，不重新分列

问题：

- 如果只改 `grid-template-columns` 而不重新跑分列逻辑，卡片原有列分配结果会与新列宽脱节，布局会失真。

应对：

- 列数变化时必须重新分列
- 不把响应式处理仅仅理解为 CSS 断点切换

### 风险：估算高度与真实高度存在偏差

问题：

- `aspectRatioBucket` 是近似比例
- caption 虽然截断，但不同宽度下换行仍可能变化
- 会导致部分列比预期更高或更低

应对：

- 第一版接受轻微不均衡
- 控制 caption 行数
- 保持底部信息区高度稳定
- 后续若偏差明显，再考虑真实高度修正

### 风险：DOM 顺序与视觉顺序不完全一致

问题：

- 多列 wrapper 渲染中，DOM 顺序通常按“列”输出，而非用户视觉上按行扫描的顺序。

应对：

- 第一版接受这一结构性特征
- 确保关键交互依赖 `post.id` 等稳定标识
- 后续如果涉及更严格的可访问性或键盘导航要求，再进一步评估

### 风险：随着分页页数增加，DOM 数量持续膨胀

问题：

- 当前第一版不做虚拟化，滚动越久，首页 DOM 节点越多。

应对：

- 第一版明确接受这一点
- 先观察真实使用规模与性能表现
- 若后续出现明显性能瓶颈，再评估虚拟化方案

### 风险：首页卡片和旧卡片耦合

问题：

- 如果为了图省事直接修改现有 `PostCard` 或 `GridPostList`，会影响详情页和 Explore 现有视觉与行为。

应对：

- 明确新增 `MasonryPostCard`
- 不修改旧卡片的职责边界

### 风险：分列算法写得过重

问题：

- 列数只有 2-5 列，如果一开始引入堆、复杂缓存或过度抽象，会增加维护成本而无明显收益。

应对：

- 第一版使用简单的“遍历列高数组，找到最短列”策略
- 保持实现可读、低复杂度

## 预期结果

本步骤完成后，项目将具备首页瀑布流最核心的展示能力：

- 首页帖子可按瀑布流方式分列展示
- 卡片外观与现有旧卡片解耦
- 响应式列数和最短列分配策略可工作
- 渐进式图片组件能在首页卡片中发挥作用
- 第一版在保证实现质量的同时，避免过早引入虚拟化和复杂布局系统
