# 首页瀑布流虚拟化总体实现方案

## 目标与范围

本文档定义 Snapgram 首页瀑布流虚拟化的总体实现方案。

本方案建立在现有首页瀑布流已经完成的前提上，直接承接：

- `docs/features/home-masonry-feed/00-overview-design.md`
- `docs/features/home-masonry-feed/07-home-route-integration.md`

当前已经存在的前置能力：

- 首页已经切到 `useHomeFeedInfiniteQuery()`。
- 首页已经使用 `MasonryFeed` 渲染多列瀑布流。
- 首页已经具备渐进式图片、分页、自动加载更多和尾部状态区。
- 卡片高度已经被强约束在“比例桶 + 固定文字行数 + 固定 meta 高度”的模型内。

本期目标：

- 为首页引入真正的窗口级虚拟化。
- 在不改动当前首页数据契约的前提下，把性能优化聚焦在渲染层。
- 选用 `@tanstack/react-virtual` 作为虚拟化基础设施。
- 采用“按估算渲染，挂载后只做轻量校正，不做复杂重排”的策略。
- 让首页先落地，但抽出的基础层未来可以复用到 profile / search feed。

本期不包含：

- 不改首页 feed 的排序规则、分页规则或数据字段。
- 不做服务端推荐、个性化排序或数据预裁剪。
- 不做卡片字体大小切换、卡片内部局部展开或动态高度内容。
- 不在本期同时把 profile / search 也切到虚拟化，只为后续复用留好接口。
- 不做“移除旧页数据以控制 query 内存占用”的窗口化缓存策略。

## 当前现状

当前相关文件：

- `app/routes/home.tsx`
- `app/features/post/components/MasonryFeed.tsx`
- `app/features/post/components/MasonryPostCard.tsx`
- `app/features/post/components/ProgressiveImage.tsx`
- `app/features/post/queries/post.queries.ts`
- `app/features/post/services/post.service.ts`
- `app/features/post/api/post.api.ts`
- `app/features/profile/hooks/useProfileInfiniteFeedState.ts`

当前行为：

- 首页数据层已经是基于 cursor 的 `useInfiniteQuery`。
- 首页在 route 层将 `data.pages` 拍平成 `feedItems`，再交给 `MasonryFeed`。
- `MasonryFeed` 当前采用“多列 wrapper + 最短列分配”渲染模型。
- 当前瀑布流虽然有高度估算，但所有已加载卡片都会常驻 DOM，不会离屏卸载。
- 自动加载下一页依赖底部 sentinel，而不是由虚拟窗口范围驱动。
- `ProgressiveImage` 在卡片级使用 `IntersectionObserver` 触发骨架图、LQIP 和原图切换。

当前问题：

- 随着首页持续翻页，DOM 节点会持续增长。
- 多列 wrapper 模型很适合第一版瀑布流，但不适合继续原地叠加真正虚拟化。
- 继续沿用 sentinel 作为主触发器，会受“窗口外卡片被卸载”影响，触发点不稳定。

## 验收标准

本方案完成后，应满足以下验收标准：

- 首页只渲染视口附近和 overscan 范围内的卡片。
- 首页分页语义保持不变，仍由 `useHomeFeedInfiniteQuery()` 驱动。
- 卡片离屏后允许被卸载，再次进入视口时可按相同数据重新挂载。
- 虚拟化后不会破坏当前瀑布流列数、卡片顺序、封面图和渐进式加载行为。
- 卡片位置不会因为上方卡片被卸载而塌陷或整体乱跳。
- 挂载后测量只做轻量校正，不引入“测量后重新换列”的复杂重排。
- 首页首次加载、首次错误、空列表、加载更多、加载更多失败和列表结束态仍然清晰存在。
- 虚拟化基础层未来可以被 profile / search feed 复用，而不要求重写一套新的虚拟列表系统。

## 改了什么，改在哪里

### 一、增加 `@tanstack/react-virtual` 依赖，正式引入窗口级虚拟化能力

改动位置：

- `package.json`

改动：

- 新增 `@tanstack/react-virtual`

说明：

- 当前项目已经有 React Query，但没有虚拟化基础设施。
- 本方案选择引入 TanStack Virtual，而不是继续在现有 `MasonryFeed` 上手写一套自维护虚拟窗口逻辑。

### 二、保留现有数据层，明确“虚拟化只改渲染层，不改首页分页契约”

改动位置：

- 不改动或仅最小调整：
  - `app/features/post/api/post.api.ts`
  - `app/features/post/services/post.service.ts`
  - `app/features/post/queries/post.queries.ts`

改动：

- 继续保留：
  - `listHomeFeedPostRows()`
  - `getHomeFeedPage()`
  - `useHomeFeedInfiniteQuery()`
- 继续由 route 层或通用 feed-state hook 将 `data.pages` 拍平成单一 items 数组。

说明：

- 当前首页数据层已经清晰且契约稳定。
- TanStack Virtual 关心的是 `count`、`index` 和滚动窗口，并不要求按页组织数据。
- 因此首页虚拟化不应顺手重构分页 API、cursor 语义或 mapper 结构。

### 三、抽出通用 feed 状态层，统一 home / profile / search 的 infinite feed 状态语义

改动位置：

- 新增建议：
  - `app/features/feed/hooks/useInfiniteFeedState.ts`
- 调整建议：
  - `app/features/profile/hooks/useProfileInfiniteFeedState.ts`
  - `app/routes/home.tsx`

改动：

- 抽出一个与具体业务 item 无关的 infinite feed 状态 hook，负责：
  - 拍平 `pages`
  - 派生 `isInitialLoading`
  - 派生 `isInitialError`
  - 派生 `isEmpty`
  - 派生 `isLoadingMore`
  - 派生 `isLoadMoreError`
  - 派生 `isEndReached`
  - 提供 `retryInitial` 和 `retryLoadMore`
- `useProfileInfiniteFeedState()` 变成对新通用 hook 的薄包装，或直接被替换。
- `home.tsx` 不再维持一套独立的分页状态推导。

说明：

- 当前 profile 已经有较成熟的 infinite feed 状态抽象，而 home 仍在 route 内手写。
- 虚拟化不是只加一个新组件；它还会把“何时触发下一页”和“何时显示尾部状态”重新拉回到通用 feed 状态层。
- 如果不先统一状态语义，后续 home / profile / search 复用会变得很别扭。

### 四、新增共享的虚拟瀑布流布局层，替换当前多列 wrapper 渲染结构

改动位置：

- 新增建议：
  - `app/features/feed/lib/virtual-masonry-layout.ts`
  - `app/features/feed/hooks/useVirtualMasonryFeedState.ts`
  - `app/features/feed/components/VirtualMasonryFeed.tsx`
- 调整建议：
  - `app/features/post/components/MasonryFeed.tsx`

改动：

- 把当前 `MasonryFeed.tsx` 中可复用的列数计算、列宽计算和卡片高度估算 helper 下沉到共享布局模块。
- 新建 `useVirtualMasonryFeedState()`，内部使用 `useWindowVirtualizer()` 管理：
  - `count`
  - `estimateSize`
  - `lanes`
  - `laneAssignmentMode: 'estimate'`
  - `gap`
  - `overscan`
  - `scrollMargin`
  - `getItemKey`
  - `measureElement`
  - `onChange`
  - `shouldAdjustScrollPositionOnItemSizeChange`
  - `useFlushSync: false`
- 新建 `VirtualMasonryFeed.tsx`，采用：
  - 单个 `position: relative` 的虚拟平面容器
  - 每个卡片 wrapper `position: absolute`
  - `left` 由 `lane` 和 `columnWidth` 推导
  - `transform: translateY(start - scrollMargin)` 推导纵向位置
  - 外层高度由 `virtualizer.getTotalSize()` 提供

说明：

- 这是本方案里最关键的结构性变化。
- 当前多列 wrapper 的本质是“每一列自己排版”，而虚拟化需要的是“所有卡片共享同一个可计算坐标平面”。
- 一旦换成绝对定位平面，窗口外卡片被卸载也不会让剩余卡片塌陷，因为位置来自 `start / lane / size` 坐标，而不是文档流。

### 五、首页自动加载下一页从 sentinel 切到 virtualizer `onChange` 范围触发

改动位置：

- `app/routes/home.tsx`
- `app/features/feed/hooks/useVirtualMasonryFeedState.ts`

改动：

- 移除“底部 sentinel 作为自动加载主触发器”的职责。
- 改为在 virtualizer 的 `onChange(instance, sync)` 中读取当前虚拟窗口的 `getVirtualItems()`：
  - 取当前窗口最大的 `index`
  - 与 `items.length - preloadThreshold` 比较
  - 满足阈值时触发 `fetchNextPage()`
- route 层继续保留尾部状态区，但它只负责显示：
  - 正在加载更多
  - 加载更多失败后的重试
  - 列表结束态

说明：

- 虚拟化后，底部 sentinel 可能并不是最稳定的“接近列表末尾”信号。
- `onChange` 直接绑定虚拟窗口范围，更贴近真正正在渲染和滚动的项目集合。
- 这也避免了 sentinel 因虚拟化时机、列表高度校正或离屏卸载而出现误触发。

### 六、保留首页卡片和渐进式图片组件，允许离屏后重放骨架/LQIP

改动位置：

- 继续保留：
  - `app/features/post/components/MasonryPostCard.tsx`
  - `app/features/post/components/ProgressiveImage.tsx`
- 如有必要，做最小调整：
  - 支持外层 wrapper 传入 className
  - 避免内部依赖列容器结构

改动：

- 不重写首页卡片视觉。
- 不为“离屏回来时不重放骨架/LQIP”增加额外的全局图片状态缓存。
- 允许卡片重新进入视口时再次执行当前的渐进式加载流程。

说明：

- 用户已明确接受离屏重挂载后的短暂骨架/LQIP 重放。
- 这让方案可以把复杂度集中在虚拟布局层，而不是把 `ProgressiveImage` 再拉成一个全局媒体生命周期系统。

### 七、将首页作为第一落地点，但为 profile / search 预留相同的虚拟化接线方式

改动位置：

- 首先落地：
  - `app/routes/home.tsx`
- 后续可复用到：
  - `app/routes/profile.posts.tsx`
  - `app/routes/profile.liked.tsx`
  - `app/routes/profile.saved.tsx`
  - `app/routes/explore.tsx`
  - `app/routes/searchResult.tsx`

改动：

- 通用 feed 状态层和通用虚拟瀑布流层不绑定首页数据接口。
- 首页先消费它们，profile / search 后续只需要替换 query 来源和空态文案即可。

说明：

- 本期不要求一次性把所有 feed 页都改完。
- 但抽象边界必须在第一版就留对，否则后面会再复制一套 profile/search 专属的虚拟化逻辑。

## 为什么选择这个方案

### 一、当前首页数据层已经稳定，虚拟化应该只聚焦渲染层

原因：

- `useHomeFeedInfiniteQuery()`、cursor page 结构和首页 view model 已经清晰。
- 现在的性能瓶颈来自“已加载卡片全部常驻 DOM”，而不是来自数据层契约本身。
- 如果在这个阶段同时重构数据层和渲染层，调试面会被不必要地放大。

### 二、TanStack Virtual 已经提供 masonry 所需的关键原语，适合当前项目直接接入

原因：

- 最新文档已经明确支持：
  - `lanes`
  - `laneAssignmentMode`
  - `measureElement`
  - `scrollMargin`
  - `shouldAdjustScrollPositionOnItemSizeChange`
  - `useWindowVirtualizer`
- 这些能力足以覆盖首页瀑布流虚拟化最关键的问题：
  - 多列分配
  - 绝对定位
  - 初始估算
  - 挂载后测量校正
  - 上方卡片尺寸变化时的滚动补偿

### 三、当前卡片几何约束已经足够强，估算优先比测量优先更合适

原因：

- 首页卡片比例桶固定。
- caption 行数固定。
- 头像、点赞区、padding、gap 都稳定。
- 没有字体大小切换，没有卡片局部展开。

因此：

- 用估算高度做初始布局已经有较高命中率。
- 挂载后只需要做轻量测量修正。
- 没必要引入“先测量，再换列”这种复杂重排。

### 四、选择 `laneAssignmentMode: 'estimate'`，是为了优先保证列稳定而不是追求绝对最优列平衡

原因：

- 首页是浏览型 feed，视觉稳定比理论最优列平衡更重要。
- 如果用测量后再决定 lane，用户会更容易看到卡片换列。
- 在当前估算误差较小的前提下，列分配稍微次优是可以接受的。

### 五、选择 window virtualizer，符合当前页面布局与滚动模型

原因：

- 当前布局由 `rootLayout.tsx` 控制，主内容沿 document/window 滚动。
- 顶部存在 sticky header，适合使用 `scrollMargin` 抵消顶部偏移。
- 如果强行改成内层独立滚动容器，会同时影响现有页面滚动习惯、返回行为和 Scroll Restoration。

### 六、选择 absolute positioning 平面，而不是继续沿用多列 wrapper

原因：

- 多列 wrapper 的空间占位依赖列内容本身，一旦离屏卡片被卸载，列高度就会变化。
- 绝对定位平面把卡片位置下沉为可计算坐标，卸载节点不会影响其他节点的坐标稳定性。
- 这是“真正虚拟化瀑布流”与“普通多列瀑布流”的核心差异。

### 七、针对 React 19，选择 `useFlushSync: false`

原因：

- 当前项目使用 React 19。
- TanStack Virtual 最新 React 文档明确说明，在 React 19 下可能遇到 `flushSync` 警告。
- 在首页这种允许轻微自然批处理的场景下，关闭 `flushSync` 更稳妥。

## 实现顺序与依赖关系

### 第一步：安装依赖并抽出共享布局 token

工作：

- 安装 `@tanstack/react-virtual`
- 将当前 `MasonryFeed.tsx` 中的这些 helper 抽出到共享模块：
  - 列数计算
  - 列宽计算
  - 比例桶映射
  - caption 高度估算
  - 卡片总高度估算

依赖：

- 无额外依赖

说明：

- 先把估算公式和当前卡片 CSS 对齐，后续虚拟化接入时才不会一边改布局，一边猜高度。

### 第二步：统一 infinite feed 状态语义

工作：

- 新增 `useInfiniteFeedState.ts`
- 让 home 和 profile 共用同一套：
  - items 拍平
  - 首屏状态
  - 尾部分页状态
  - retry 逻辑

依赖：

- 依赖现有 `useInfiniteQuery` 结果结构稳定

说明：

- 这一步先不切虚拟化，只先把状态语义统一，降低后续集成复杂度。

### 第三步：实现 `useVirtualMasonryFeedState`

工作：

- 监听 feed 容器宽度，得出 `columnCount` 和 `columnWidth`
- 使用 `useWindowVirtualizer()` 创建虚拟器
- 配置：
  - `count`
  - `estimateSize`
  - `lanes`
  - `laneAssignmentMode: 'estimate'`
  - `gap`
  - `overscan`
  - `scrollMargin`
  - `getItemKey`
  - `measureElement`
  - `onChange`
  - `shouldAdjustScrollPositionOnItemSizeChange`
  - `useFlushSync: false`

依赖：

- 依赖第一步的共享布局 helper

说明：

- 这一步先把虚拟窗口状态跑通，还不切首页 UI。

### 第四步：实现 `VirtualMasonryFeed`

工作：

- 渲染一个总高度为 `virtualizer.getTotalSize()` 的相对定位容器
- 遍历 `virtualizer.getVirtualItems()`
- 对每个 item 渲染绝对定位 wrapper：
  - `left = lane * (columnWidth + gap)`
  - `width = columnWidth`
  - `transform: translateY(start - scrollMargin)`
- 用 render prop 或 item renderer 渲染实际卡片内容

依赖：

- 依赖第三步的虚拟器状态

说明：

- 到这一步时，虚拟化主布局已经可以独立工作。

### 第五步：切换首页 route

工作：

- `home.tsx` 改为使用：
  - 通用 `useInfiniteFeedState`
  - `useVirtualMasonryFeedState`
  - `VirtualMasonryFeed`
- 移除 sentinel 作为自动加载主触发器
- 保留尾部状态区和手动重试按钮

依赖：

- 依赖第二步、第三步和第四步都稳定

说明：

- 这一阶段只切首页，不同步切 profile / search。

### 第六步：验证滚动、测量校正和返回场景

工作：

- 验证快速滚动、慢速滚动、首屏加载、尾部翻页、翻页失败重试
- 验证进入详情页再返回时：
  - query cache 是否仍可复用
  - 页面滚动位置是否合理
- 调整：
  - `overscan`
  - preload threshold
  - `shouldAdjustScrollPositionOnItemSizeChange`

依赖：

- 依赖首页已经切到虚拟化实现

说明：

- 这一阶段的重点是体感调优，而不是再扩展功能范围。

### 第七步：复用到 profile / search

工作：

- 首页验证稳定后，再评估是否将 profile posts、liked、saved 与 search 结果切到同一套虚拟化基础层

依赖：

- 依赖首页验证结果

说明：

- 复用应在首页稳定后进行，避免同时在多个 route 放大调试面。

## 关键风险及应对策略

### 风险一：高度估算与真实高度存在偏差，导致滚动中出现细微跳动

问题：

- caption 虽然固定为最多两行，但不同列宽下仍然可能从一行变两行。
- 图片比例桶是近似值，不等于真实图片高度。

应对：

- 估算公式继续基于当前卡片结构，尽量返回“保守且略偏大”的高度。
- 卡片挂载后统一通过 `measureElement` 做轻量校正。
- `shouldAdjustScrollPositionOnItemSizeChange` 仅在“被修正项位于当前视口上方”时启用滚动补偿。
- 不切到 `laneAssignmentMode: 'measured'`，避免测量后卡片换列。

### 风险二：使用 `onChange` 触发翻页后，滚动过程中可能重复触发 `fetchNextPage()`

问题：

- `onChange` 会在滚动、测量和 resize 时频繁触发。
- 如果不加防护，可能在同一个阈值区间内重复发起请求。

应对：

- 触发条件必须同时满足：
  - `hasNextPage === true`
  - `isFetchingNextPage === false`
  - 当前不在“等待手动重试”的分页失败状态
- 使用 index 阈值而不是像素阈值。
- 使用一个 ref 记录上一次已经触发过的最大 items 长度或最大 index，避免同一状态下重复请求。

### 风险三：窗口外 DOM 卸载解决了渲染成本，但没有解决 query pages 的内存增长

问题：

- 虚拟化减少的是 DOM、布局和绘制成本。
- 已经加载过的 `data.pages` 仍然会继续累积在 React Query 缓存中。

应对：

- 本期接受这一点，因为首页首要瓶颈是 DOM。
- 继续保持首页分页大小保守。
- 若后续真实使用中出现超长会话，再单独评估“页窗口裁剪”或“历史页丢弃”策略。
- 不把“数据裁剪”与“首版虚拟化”绑在一起。

### 风险四：sticky header 偏移处理错误，会导致绝对定位卡片整体错位

问题：

- 当前布局有固定高度的顶部导航。
- 如果 `scrollMargin` 不正确，卡片会出现首屏位置偏移。

应对：

- 通过容器 `offsetTop`、`getBoundingClientRect()` 或稳定 header 高度计算 `scrollMargin`。
- 将 `scrollMargin` 纳入虚拟化 hook 的显式输入或测量逻辑。
- review 时把 `translateY(start - scrollMargin)` 作为硬性检查项。

### 风险五：ResizeObserver 与列数切换会触发整批重排

问题：

- 容器宽度变化时，列数和列宽会变化。
- 这会导致所有 item 的坐标重新计算。

应对：

- 这类重排只在响应式断点切换和容器 resize 时发生，属于预期行为。
- 继续沿用当前 `MasonryFeed` 对测量宽度的归一化策略，避免亚像素抖动。
- 不在 width 变化时额外做人为动画，直接接受正常响应式重排。

### 风险六：React 19 下使用默认 `flushSync` 可能产生告警或额外同步开销

问题：

- 最新 TanStack Virtual React 文档已明确提示 React 19 兼容性场景下可关闭 `useFlushSync`。

应对：

- 首页虚拟器显式配置 `useFlushSync: false`。
- 保持 `measureElement` 和 `ResizeObserver` 逻辑尽量轻量，不在回调中附带重型 DOM 计算。

### 风险七：`ProgressiveImage` 在虚拟化后更频繁重挂载，用户可能看到骨架/LQIP 重放

问题：

- 虚拟化天然会让离屏卡片被卸载。
- 卡片重新进入视口时，图片加载流程会重走。

应对：

- 当前需求已接受这一行为。
- 保持 `getItemKey` 稳定，避免不必要的错误 remount。
- 如后续观察到重放过于明显，再单独评估是否为图片状态增加轻量缓存，而不是在首版虚拟化里提前实现。

### 风险八：首页直接切换到虚拟化后，profile / search 复用边界不清晰

问题：

- 如果首页虚拟化逻辑散落在 route 文件里，后续复用只会复制粘贴。

应对：

- 第一版就把：
  - infinite feed 状态
  - 虚拟瀑布流状态
  - 共享布局 helper
  抽成独立模块。
- 但首页仍然作为唯一落地点先验证，不提前在多个 route 同时切换。

## 预期结果

本方案完成后，项目将获得一套与当前代码状态匹配、并可逐步扩展的首页虚拟化架构：

- 首页继续使用现有分页数据层，不改 API 与 view model。
- 首页瀑布流从“多列 wrapper 全量渲染”切换为“绝对定位平面 + 窗口级虚拟化”。
- 首页自动加载下一页从 sentinel 切换为基于虚拟窗口范围的触发。
- 卡片初始位置依赖稳定估算，挂载后允许轻量测量修正，但不做复杂重排。
- 顶部 sticky header、滚动补偿、React 19 兼容性和未来 profile/search 复用边界都在第一版里被显式考虑。
