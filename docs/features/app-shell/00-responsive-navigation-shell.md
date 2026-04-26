# 响应式导航壳层改造方案

## 目的

本文档定义 Snapgram 已登录壳层本轮导航改造方案，范围覆盖：

- 顶部栏在桌面与移动断点下的布局重构
- 顶部栏搜索交互在 `<640px` 下的状态切换
- 顶部栏与侧边栏共用的 `More` 菜单
- 将主题切换与登出从顶部栏右侧移入 `More` 菜单

本期目标：

- 在 `lg`（1024px）及以上，让顶部栏呈现：
  - 左侧 logo
  - 相对整个 header 视觉居中的搜索框
  - 右侧无动作按钮
- 在 `lg` 以下且 `sm`（640px）及以上，让顶部栏呈现：
  - 左侧 logo
  - 中部搜索框
  - 右侧 `More` 按钮
- 在 `<640px` 时，让顶部栏默认呈现：
  - 左侧 logo
  - 右侧搜索按钮
  - 最右侧 `More` 按钮
- 在 `<640px` 时，点击搜索按钮后，让顶部栏整行切换为：
  - 搜索框
  - `Cancel` 按钮
- 在顶部栏和侧边栏都提供 `More` 菜单，但根据触发位置使用不同的弹出方向
- 将主题切换放入 `More` 菜单的子菜单中
- 将登出放入 `More` 菜单中，并使用 destructive 样式

本期不包含：

- 改造侧边栏导航顺序、文案或用户信息区样式
- 引入 `system` 主题选项
- 调整 `app/root.tsx` 中 `ThemeProvider` 的 `defaultTheme` / `enableSystem` 配置
- 搜索建议、搜索历史或热搜词
- 移动端搜索浮层、全屏搜索页或复杂动画系统

## 当前现状

当前相关文件：

- `app/layouts/rootLayout.tsx`
- `app/components/shared/Topbar.tsx`
- `app/components/shared/LeftSidebar.tsx`
- `app/components/shared/ThemeToggle.tsx`
- `app/root.tsx`
- `app/app.css`

当前行为：

- `rootLayout.tsx` 在 `lg` 及以上显示左侧栏，在 `lg` 以下隐藏左侧栏并显示底部栏。
- `Topbar` 当前始终显示：
  - logo
  - 搜索框
  - 主题切换按钮
  - 登出按钮
  - `lg` 以下显示 `More` 按钮，但尚未接入菜单能力
- `LeftSidebar` 底部已有 `More` 行，但尚未接入菜单能力。
- `ThemeToggle` 当前是一个独立文本按钮，不适合作为菜单中的设置项。
- 项目当前没有现成的 `DropdownMenu` 或 `Switch` UI 组件文件，但项目已配置 `shadcn` 与 Radix 风格组件体系。
- 主题能力由 `next-themes` 提供，当前 `root.tsx` 已接入 `ThemeProvider`。

## 已确认需求

已确认需求：

- 桌面宽屏下，顶部栏右侧不显示任何按钮。
- 桌面端顶部栏中的主题切换与登出都迁移到侧边栏底部 `More` 菜单。
- 宽屏顶部栏搜索框需要相对整个 header 视觉居中。
- `<640px` 时，如果当前就在 `/search-result`，顶部栏默认不自动进入搜索态。
- `<640px` 时，用户点击搜索按钮进入搜索态后，输入框应自动回填 URL 中已有关键词。
- `<640px` 时，点击 `Cancel` 只关闭搜索态，不清空输入，不离开结果页。
- `More` 菜单本期只包含：
  - Theme
  - Sign out
- 侧边栏本期只改底部 `More` 行接入菜单，其余侧边栏结构保持不动。
- 顶部栏和菜单新增文案继续沿用英文。
- 侧边栏 `More` 菜单从按钮上方弹出。
- 菜单每一行都需要有合适的 icon。
- 主题切换不在顶层菜单显示当前选择摘要。
- 主题通过该行的子菜单切换。
- 当前主题选项只有：
  - Light
  - Dark
- 登出菜单项使用 destructive 样式。
- 宽屏顶部栏搜索框使用 grid 居中设计。
- 移动端搜索按钮和搜索框切换使用状态驱动的整行切换。

## 改了什么，改在哪里

### 一、重构顶部栏布局与断点行为

改动位置：

- `app/components/shared/Topbar.tsx`
- 如有必要，补充 `app/app.css`

计划改动：

- 将桌面顶部栏改为 grid 三栏结构，而不是继续使用简单的左右分布。
- 在 `lg` 及以上：
  - 左栏放 logo
  - 中栏放搜索框
  - 右栏留空占位
- 中栏搜索框相对整个 header 居中，而不是相对剩余空间居中。
- 在 `lg` 以下：
  - 去掉当前顶部栏里的主题切换和登出按钮
  - 保留 `More` 入口
- 在 `sm` 及以上但 `<lg`：
  - 显示常规搜索框
  - 右侧显示 `More`
- 在 `<sm`：
  - 默认显示 `logo + Search button + More`
  - 搜索按钮点击后切换为 `search form + Cancel`

### 二、保留现有搜索提交链路，但扩展移动端搜索状态

改动位置：

- `app/components/shared/Topbar.tsx`

计划改动：

- 继续复用当前 `Topbar` 已有的：
  - `searchValue`
  - `/search-result?keyword=...` 跳转逻辑
  - 与 URL keyword 的回填同步
- 新增移动端局部状态，例如：
  - `isMobileSearchOpen`
- 在 `<640px` 时：
  - 默认态显示图标按钮
  - 搜索态显示完整表单和 `Cancel`
- 关闭搜索态时：
  - 只收起 UI
  - 不清空 `searchValue`
- 如果当前 URL 中已有 `keyword`：
  - 打开搜索态时自动显示回填结果

### 三、引入可复用的 `More` 菜单组件

改动位置：

- 新增 `app/components/shared/MoreMenu.tsx`
- 新增 `app/components/ui/dropdown-menu.tsx`

计划改动：

- 将顶部栏和侧边栏的 `More` 逻辑收敛到一个共享组件。
- 共享组件负责：
  - 触发器内容渲染
  - 菜单项渲染
  - 菜单定位参数
  - 主题子菜单
  - destructive 登出项
- 由调用方传入不同的菜单定位配置：
  - 顶部栏 `More`：从按钮下方弹出
  - 侧边栏 `More`：从按钮上方弹出

### 四、将主题切换改为菜单子菜单，而不是按钮或 switch

改动位置：

- `app/components/shared/MoreMenu.tsx`
- 新增 `app/components/shared/ThemeSubmenu.tsx`
- `app/components/shared/ThemeToggle.tsx` 作为旧实现移除或废弃
- `app/root.tsx` 本期不改配置，只继续作为 `ThemeProvider` 容器

计划改动：

- 不再在顶层菜单中显示当前主题摘要。
- 顶层菜单提供一行 `Theme`，包含合适 icon。
- 点击 `Theme` 后进入子菜单。
- 子菜单提供两个明确单选项：
  - `Light`
  - `Dark`
- 每项使用清晰 icon，例如：
  - `Sun`
  - `Moon`
- 当前选中项使用菜单自带的 radio / checked 表达。
- 主题切换状态基于 `next-themes`。

#### `ThemeSubmenu` 组件拆分要求

- `MoreMenu` 不直接持有主题状态，也不直接调用 `useTheme()`。
- `ThemeSubmenu` 是唯一负责主题菜单行为的共享组件。
- `ThemeSubmenu` 负责：
  - 渲染 `Theme` 顶层菜单行
  - 渲染 `Light / Dark` 子菜单
  - 读取当前主题状态
  - 处理 mounted 前后的安全渲染
  - 调用 `setTheme()` 切换主题
- `MoreMenu` 只负责：
  - 菜单容器
  - 顶层菜单项编排
  - `Sign out` 项
  - 菜单定位和触发器渲染
- 这样拆分后，未来如果增加 `System`、主题文案、主题图标或主题说明，只需要修改 `ThemeSubmenu`。

#### `ThemeSubmenu` 状态来源与读写方式

- 主题状态不放在 `MoreMenu` 或 `ThemeSubmenu` 的本地 `useState` 中。
- 真实主题状态来源继续是 `app/root.tsx` 中的 `ThemeProvider`。
- `ThemeSubmenu` 通过 `next-themes` 的 `useTheme()` 获取：
  - `theme`
  - `resolvedTheme`
  - `setTheme`
- `setTheme('light')` 与 `setTheme('dark')` 是唯一的写入方式。
- 本期不修改 `ThemeProvider` 的全局配置：
  - 保留 `defaultTheme="system"`
  - 保留 `enableSystem`

#### 在保留 `system` 配置前提下的两态子菜单策略

- 虽然本期 UI 只暴露 `Light / Dark` 两个选项，但底层 `ThemeProvider` 仍可能处于 `system`。
- 因此子菜单的“当前选中项”不能只看 `theme`，否则 `theme === 'system'` 时会没有选中项。
- 本期使用派生选择值：
  - 当 `theme` 是 `light` 或 `dark` 时，直接使用 `theme`
  - 当 `theme` 是 `system` 或未定义时，回退到 `resolvedTheme`
- 这意味着：
  - 初次进入且仍处于 `system` 时，菜单会按当前实际生效主题显示选中项
  - 用户一旦点击 `Light` 或 `Dark`，即写入显式主题选择，覆盖 `system`

建议的派生逻辑：

```ts
const selectedTheme =
  theme === 'light' || theme === 'dark'
    ? theme
    : resolvedTheme === 'dark'
      ? 'dark'
      : 'light';
```

#### `ThemeSubmenu` 组件结构建议

建议新增文件：

- `app/components/shared/ThemeSubmenu.tsx`

建议职责边界：

- 组件不接收业务数据 props。
- 组件直接消费 `ThemeProvider` 上下文。
- 组件返回一段可直接插入 `DropdownMenuContent` 的菜单子树。

建议结构：

- `DropdownMenuSub`
- `DropdownMenuSubTrigger`
  - 左侧 icon：`SunMoon` 或等价主题 icon
  - 文案：`Theme`
- `DropdownMenuSubContent`
- `DropdownMenuRadioGroup`
- 两个 `DropdownMenuRadioItem`
  - `Light` + `Sun`
  - `Dark` + `Moon`

建议交互：

- 点击顶层 `Theme` 行，只展开子菜单，不直接切换主题。
- 点击 `Light` 或 `Dark` 子菜单项时，通过 `onValueChange` 调用 `setTheme()`。
- 主题切换后允许菜单按默认行为关闭，不额外维持展开态。

#### mounted 与 hydration 处理

- `next-themes` 的 `theme` / `resolvedTheme` 在客户端挂载前不稳定。
- 因此 `ThemeSubmenu` 需要保留一个本地 `mounted` 状态，只用于渲染保护，不作为主题状态源。
- 在未 mounted 时：
  - 顶层 `Theme` 行可以正常渲染
  - 子菜单内部的选中态不要依赖未稳定的主题值
- mounted 后再渲染 `DropdownMenuRadioGroup` 的真实 `value`

建议模式：

```ts
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
}, []);
```

#### 与旧 `ThemeToggle` 的关系

- 当前 `ThemeToggle.tsx` 是独立按钮实现，不再适合作为菜单内主题入口。
- 本期更推荐直接由 `ThemeSubmenu` 取代其职责。
- 如果仓库中不再有其他页面依赖 `ThemeToggle.tsx`，可以删除该文件。
- 如果暂时保留，也应将其视为过渡实现，而不是继续扩展其逻辑。

### 五、将登出放入菜单并标记 destructive

改动位置：

- `app/components/shared/MoreMenu.tsx`
- `app/components/shared/Topbar.tsx`
- `app/components/shared/LeftSidebar.tsx`

计划改动：

- 从顶部栏移除独立登出按钮。
- 在 `More` 菜单中加入 `Sign out`。
- 该项使用 destructive 样式，并带 `LogOut` icon。
- 仍复用现有 `useSignOutMutation()`。

## 为什么选择这个方案

### 一、宽屏顶部栏搜索框使用 grid 居中，而不是绝对定位

选择原因：

- 需求明确要求搜索框相对整个 header 视觉居中。
- grid 三栏方案可以在不引入额外定位复杂度的情况下实现稳定居中。
- 当前桌面头部结构简单，左侧 logo 稳定、右侧留空，适合用对称轨道承载。
- 相比绝对定位：
  - 不容易出现搜索框覆盖 logo 的问题
  - 对响应式宽度收缩更稳
  - 结构更容易维护

结论：

- 宽屏头部采用 grid 三栏布局是这轮最小且稳定的方案。

### 二、移动端搜索使用状态驱动的整行切换，而不是覆盖层

选择原因：

- 需求本身就是“点击搜索后，顶部栏变为搜索框 + 取消按钮”。
- 这是一个简单的 UI 模式切换，不需要构建额外 overlay 系统。
- 复用现有提交逻辑的成本最低，改动集中在 `Topbar` 内部。
- 相比绝对定位覆盖层：
  - 不需要额外处理 z-index、遮罩、点击穿透
  - sticky header 下更不容易出现边界 bug

结论：

- 使用本地状态驱动整行切换，符合需求且实现最小。

### 三、`More` 菜单使用 `DropdownMenu`，而不是自定义弹层

选择原因：

- 顶部栏和侧边栏都需要菜单，但弹出方向不同。
- Radix / shadcn 的 `DropdownMenu` 已提供：
  - 基于 trigger 的定位
  - `side` / `align` / `sideOffset`
  - portal
  - 键盘导航
  - 焦点管理
  - 碰撞处理
- 这能直接覆盖：
  - 顶部栏从按钮下方弹出
  - 侧边栏从按钮上方弹出

结论：

- 直接复用 `DropdownMenu` 是更稳的基础设施方案。

### 四、主题切换使用子菜单单选，而不是 switch 或整行循环切换

选择原因：

- 即使本期只有 `Light` 和 `Dark`，未来也已明确可能增加 `System`。
- `switch` 语义只适合二元状态，不适合主题模式选择。
- 点击整行循环切换不够显式，不利于未来扩展到三态。
- 用子菜单表达主题模式选择更符合“设置项”的信息架构。
- 先用子菜单承载 `Light / Dark`，后续增加 `System` 时无需推翻交互模型。
- 即使当前 `ThemeProvider` 仍保留 `system` 配置，也可以通过 `resolvedTheme` 派生出稳定的两态展示。

结论：

- 主题设计从一开始就按“设置子菜单”建模，而不是按“即时开关”建模。
- 主题实现从一开始就按 `ThemeSubmenu` 独立组件建模，而不是把主题逻辑塞进 `MoreMenu`。

### 五、登出使用 destructive 样式

选择原因：

- 登出会中断当前会话，是明显的风险操作。
- 在 `More` 菜单中将其与普通设置项区分，可降低误触成本。
- Radix / shadcn 风格菜单项已支持 destructive 视觉样式扩展。

结论：

- 将 `Sign out` 设计为 destructive 是更清晰的风险表达。

## 实现顺序与依赖关系

### 第一步：补齐菜单基础设施

改动：

- 新增 `app/components/ui/dropdown-menu.tsx`
- 如需要，可同步补充菜单项样式 token

原因：

- 顶部栏与侧边栏的 `More` 都依赖同一套菜单基础组件。

依赖关系：

- 后续 `MoreMenu`、主题子菜单、destructive 登出项都依赖这一步。

### 第二步：抽出共享 `MoreMenu`

改动：

- 新增 `app/components/shared/MoreMenu.tsx`
- 将菜单项结构固定为：
  - Theme
  - Sign out

原因：

- 顶部栏和侧边栏应共享行为与菜单内容，只在触发器样式和弹出方向上分叉。

依赖关系：

- 依赖第一步的 `DropdownMenu`
- 依赖现有 `useSignOutMutation()`
- 依赖 `next-themes`

### 第三步：实现主题子菜单

改动：

- 新增 `app/components/shared/ThemeSubmenu.tsx`
- 在共享菜单内接入 `Theme` 子菜单
- 视仓库引用情况移除或废弃 `ThemeToggle.tsx`

原因：

- 主题项是 `More` 菜单的核心内容之一，且需要先确定交互模型。

依赖关系：

- 依赖第二步的 `MoreMenu`
- 依赖 `root.tsx` 中已存在的 `ThemeProvider`

### 第四步：接入侧边栏 `More`

改动：

- 更新 `app/components/shared/LeftSidebar.tsx`

原因：

- 侧边栏 `More` 是独立、低风险入口，可先完成并验证菜单与主题、登出链路是否正常。

依赖关系：

- 依赖第二步和第三步
- 不依赖顶部栏搜索改造

### 第五步：重构顶部栏宽屏布局

改动：

- 更新 `app/components/shared/Topbar.tsx`

原因：

- 先把顶部栏右侧动作移出，再实现 grid 居中搜索框，布局关系更清晰。

依赖关系：

- 最好在共享 `MoreMenu` 完成后进行，以便移动端直接复用

### 第六步：实现 `<640px` 搜索状态切换

改动：

- 更新 `app/components/shared/Topbar.tsx`

原因：

- 该步骤依赖顶部栏布局已经拆成桌面分支与移动分支。
- 移动端搜索态复用现有提交逻辑，属于在新布局上的行为补充。

依赖关系：

- 依赖第五步
- 依赖现有搜索提交逻辑已稳定

### 第七步：回归验证

验证重点：

- `lg` 及以上顶部栏是否只有 logo 和居中搜索框
- `lg` 以下顶部栏是否正确出现 `More`
- `<640px` 搜索态切换是否符合预期
- `More` 菜单在顶部栏和侧边栏是否出现在正确方向
- 主题切换后界面是否立即生效
- destructive 登出项样式与行为是否正确

## 关键风险及应对策略

### 风险一：顶部栏和侧边栏菜单在固定布局中被裁切或层级异常

风险说明：

- 顶部栏是 `sticky`
- 侧边栏是 `fixed`
- 如果菜单直接在原容器中渲染，容易出现被父级裁切或层级不对的问题

应对策略：

- 使用 `DropdownMenu` 自带 `Portal`
- 菜单内容不依赖父容器溢出布局
- 保持菜单内容层级高于 header / sidebar

### 风险二：移动端搜索态与 URL 回填状态不同步

风险说明：

- 用户可能在 `/search-result?keyword=...` 页面中先关闭搜索态，再重新打开
- 如果只在首次挂载时读取 keyword，二次打开可能看不到最新输入

应对策略：

- 保留现有 `searchValue` 与 URL keyword 的同步逻辑
- 搜索态只控制“显示方式”，不控制“真实输入值来源”

### 风险三：主题菜单未来增加 `System` 时需要重做交互

风险说明：

- 如果本期把主题做成 switch 或点击整行循环切换，未来三态扩展会产生返工

应对策略：

- 本期直接采用主题子菜单模型
- 即使当前只显示 `Light / Dark`，也沿用可扩展的单选结构

### 风险四：顶栏 grid 居中在中间宽度区间出现挤压

风险说明：

- 在接近 `lg` 的宽度区间，logo、搜索框和右侧按钮可能竞争横向空间

应对策略：

- 为搜索框宽度设置明确上限与收缩规则
- 将桌面、中窄屏、窄屏的布局逻辑分开，不用单一布局硬撑所有断点

### 风险五：共享菜单组件职责过大，导致顶部栏和侧边栏耦合

风险说明：

- 如果把触发器样式、菜单项逻辑、主题逻辑和登出逻辑全混在两个页面组件里，后期难维护

应对策略：

- 抽出共享 `MoreMenu`
- 顶部栏和侧边栏只负责：
  - 放置触发器
  - 传递定位参数
- 菜单内容和操作逻辑集中在共享组件中

## 最终结论

本期导航改造采用以下组合方案：

- 宽屏顶部栏：grid 三栏居中搜索框
- 移动端搜索：状态驱动的整行切换
- `More` 菜单：共享 `DropdownMenu`，顶部向下弹出，侧边栏向上弹出
- 主题切换：`Theme` 子菜单，当前只提供 `Light / Dark`
- 登出：放入 `More` 菜单并使用 destructive 样式

这是一套改动范围小、与当前代码结构兼容、且对未来主题三态扩展友好的实现路径。
