# mysite — 站点结构说明

一个纯静态站点：没有构建步骤、没有依赖，直接丢到 GitHub Pages / 任意静态托管就能跑。
内容与代码分离——**改文字只动 `data/`，改样子只动 `assets/`**。

## 目录结构

```
mysite/
├── index.html          主页（精选轮播 + 最近作品 / 笔记）
├── works.html          作品列表（左侧「标签 + 年份」筛选）
├── work.html           作品详情，读 ?id=001
├── notes.html          笔记列表
├── note.html           笔记详情，读 ?id=001
├── about.html          关于我
├── about/avatar.jpg    （可选）头像，和照片墙一起放在 about/ 里，由 data/about.json 的 avatar 指向
├── about/              （可选）「关于我」照片墙，01.jpg、02.jpg… 由 about.json 的 images 列出
├── assets/
│   ├── style.css       全部样式（含进站 LOGO 动画 .intro-screen）
│   ├── app.js          全部逻辑（各页面按 data-page 初始化，内含轻量 Markdown 渲染）
│   ├── lot.otf         LOGO 专用字体（只管 VVXIE 这几个字母，正文不用它）
│   ├── favicon.svg     站点图标（取自 LOGO 的 V）
│   └── placeholder.svg 缺图时的占位图
├── data/
│   ├── works.json      作品索引：id / 标题 / 日期 / 标签数组 / 封面文件名 / meta 路径 / 是否精选
│   ├── notes.json      笔记索引：id / 标题 / 日期 / 标签数组 / meta 路径 / content 路径 / 摘要
│   └── about.json      关于我：标题、正文、联系方式、链接、头像、照片墙 images
├── works/
│   └── 001/            一件作品 = 一个目录
│       ├── meta.json   简介、细节图清单
│       ├── cover.jpg   封面（首页和列表用）
│       └── 01.jpg …    细节图
└── notes/
    └── 001/            一篇笔记 = 一个目录
        ├── meta.json   日期、标签、配图清单
        ├── content.md  正文（Markdown）
        └── img/        正文里用 img/01.jpg 引用
```

## 数据流

```
data/works.json  ──┐
                   ├─→ 列表 / 详情页渲染（app.js 读取）
works/001/meta.json┘
                   ──→ 图片路径 = works/{id}/{文件名}
```

- 页面里所有图片都用**相对路径**，异地部署、换域名都不用改。
- `works.json` 只放“索引”，长文字和图片清单放在各自的 `meta.json`，所以改一件作品只碰一个目录。
- **`cover.*` 和 `gallery` 的分工**：`cover.*` 是列表用的 **1:1 小图**，不进详情页；`gallery` 里列出的 `01.jpg`、`02.jpg`… 才是详情页展示的图，首页轮播也取 `gallery` 的第一张。
- **封面怎么来的**：默认直接拿 `gallery` 的**第一张**居中裁成 1:1。在工具的编辑页里点「裁切」可以拖动/缩放，选好取景后再保存，导出时会按取景生成 `cover.jpg`（900×900）。取景参数存在 `meta.json` 的 `coverCrop` 里，下次打开能还原：

```json
"coverCrop": { "src": "01.jpg", "zoom": 2.5, "panU": 0, "panV": 0 }
```

  没有细节图的作品，可以在工具里「手动上传」一张当封面（此时不会走裁切）。

## 常见操作

**加一件作品**

1. 新建目录 `works/2026-05-niaoshen/`（规则见下），放 `cover.jpg`（和可选的 `01.jpg`…）
2. 建 `works/2026-05-niaoshen/meta.json`：

```json
{
  "id": "2026-05-niaoshen",
  "title": "作品名",
  "date": "2026-05-12",
  "tags": ["视觉插画", "数字绘画"],
  "tagline": "一句话简介",
  "description": "多段简介，用 \\n\\n 分段。",
  "gallery": ["01.jpg"]
}
```

3. 在 `data/works.json` 的 `works` 数组里加一行（`featured: true` 就会进主页轮播）：

```json
{ "id": "2026-05-niaoshen", "title": "作品名", "date": "2026-05-12", "tags": ["视觉插画", "数字绘画"],
  "cover": "cover.jpg", "meta": "works/2026-05-niaoshen/meta.json", "featured": true }
```

**日期与目录命名**

- `date` 用 `YYYY-MM-DD`（年月日）。作品列表**统一按日期排序**（新的在前），页面上只显示年份。
- 目录名 = **年月 + 名字**，例如 `2026-05-niaoshen`；名字随便填一个字符/拼音即可，顺序由日期决定，不用再编 `001`、`002`。
- 老式的纯数字目录（`001`…）仍然可用；在工具里给它填上「名字」并保存后，导出会自动改成新命名。

**加一篇笔记**：建 `notes/003/content.md`、`notes/003/meta.json`，再到 `data/notes.json` 加一条。
`content.md` 支持标题、列表、引用、表格、`**粗体**`、`` `代码` `` 和 `![](img/01.jpg)`。

**「关于我」的照片墙**

在工具「站点信息」页卡最下面「照片墙」处添加图片即可（可多张、可拖动排序），导出会写到：

```
about/01.jpg  about/02.jpg …
```

`data/about.json` 里对应一个 `images` 数组：

```json
{ "aboutHeading": "关于我", "avatar": "about/avatar.jpg",
  "images": ["01.jpg", "02.jpg"] }
```

页面上的顺序就是数组顺序，位置在**超链接下面**，三列铺开（窄屏自动变两列/一列）。
**标签**：一件作品可以有多个标签，写在 `tags` 数组里；列表页左侧的「标签」和「年份」筛选会自动从作品里汇总（只显示有人用的），不用手动维护列表。

## LOGO 字体与部署（OSS / 静态托管）

`assets/lot.otf`（字体名 **Lot**，9 KB）只用在两处，正文完全是另一套黑体：

```css
@font-face{font-family:"Lot";src:url("lot.otf") format("opentype");font-display:swap}
--logo:"Lot",var(--heiti);      /* .wordmark 和进场动画 .intro-mark 用它 */
```

页面的 `<head>` 里加了 `preload`，进场动画不会闪回默认字体。

**上传到阿里云 OSS 时的三个注意点**

1. **Content-Type**：OSS 的默认 MIME 表里**没有** `.otf`/`.woff`/`.woff2`，会被存成 `application/octet-stream`。
   Chrome / Firefox 一般仍能加载，但 Safari 可能不认。建议上传后单独把这个对象改成 `font/otf`
   （OSS 只支持对单个 Object 设置，不能按后缀批量）。
   ```bash
   ossutil set-meta oss://你的bucket/assets/lot.otf Content-Type:font/otf --update
   ```
2. **跨域**：字体和页面在**同一个域名**下就不用配 CORS。如果字体走了另一条 CDN 域名，
   必须在 Bucket 的「跨域设置」里加规则：来源 `*`（或你的域名）、方法 `GET`、允许 Headers `*`，
   否则浏览器会以 CORS 为由拒绝加载（控制台报 `Access-Control-Allow-Origin`）。
3. **别改结构**：所有路径都是相对路径（`assets/lot.otf`），把整个 `mysite/` 原样上传即可；
   可以在 OSS 上开「静态页面托管」并把默认首页设为 `index.html`。
## 首页轮播

- **只放精选**：轮播严格只显示勾了「首页精选」的作品，勾了几件就放几件；**一件都没勾时首页显示「精选作品整理中」**，不会自动拉作品进来。
- **切换效果**：两层图片叠放做 1.7 秒交叉淡入（旧图淡出、新图同时淡入），并配一个极慢的推近（7.6 秒缩放到 1.045），所以不会闪白也不会硬跳。标题和一句话简介是直接替换的（不做淡入，避免任何"卡在透明"的风险）。
- 手动点箭头 / 圆点会立即切换并重新计时。
- 系统开了「减少动态效果」时，所有过渡自动关闭，直接切换。
## 进站 LOGO 动画

打开站点时播一次 VVXIE 的开场（**只在整体刷新时播，站内切页不播**），约 **2.4 秒**后整体淡出（0.9 秒），**点击任意位置可跳过**。

时间轴（相对开场开始）：

| 时间 | 动作 |
|---|---|
| 0.10–0.58s | 五个字母依次入场（每个间隔 0.12s），各自带不同倾角（±3~5°）、从下方 26px 升起、放大 1.07 → 1、模糊 7px → 0 |
| 收尾约 1.42s | 每个字母落位时轻微回弹（-4px → +2px → 0）并回正 |
| 1.02s / 1.16s | 上线、下线依次展开：从字母处 **向外滑出**（上线先，差 0.14s），同时从中间横向拉开；线宽 = LOGO 实际宽度，距字 11px |
| 1.10–2.05s | 一道很淡的高光从左向右扫过字面 |

> 调参都在 `style.css` 的「进站 LOGO 动画」段：字母用 `--d`（延迟）和 `--r`（倾角）控制，线用 `--from`（初始位移）和 `--d`。
> 系统开「减少动态效果」时全部动画关闭，直接显示最终状态。

播放规则（见 `app.js` 的 `introShouldPlay()`）：

| 进入方式 | 是否播放 |
|---|---|
| 直接打开网址 / 从外部链接进入 / 新开标签页 | 播放 |
| 按 F5 或点浏览器刷新（`navigation.type === 'reload'`） | 播放 |
| 站内点击导航切换页面（主页 ↔ 作品 ↔ 笔记 ↔ 关于我） | **跳过** |
| 浏览器前进 / 后退 | 跳过 |

依据 Navigation Timing 的 `navigation.type`，并配合 `sessionStorage` 标记区分「站内链接跳转」与「真正进站」。

调整方式：

- **文字**：`assets/app.js` 里 `initIntro()` 的 `words` 数组（默认 `['V','V','X','I','E']`）
- **停留时长**：同处的 `hold` 变量（默认 2450 毫秒）
- **动画细节**：`assets/style.css` 的 `.intro-screen` / `.intro-mark span` / `@keyframes introLetter`；逐字延迟在 `:nth-child(n)` 里
- **不想显示**：删掉 `app.js` 里 `DOMContentLoaded` 中的 `initIntro();` 这一行即可
- 系统开启「减少动态效果」时，字母直接静态显示、停留时间也会缩短

## 「关于我」怎么改

内容全在 `data/about.json`（管理工具里点右上「站点信息」也能改）：

```json
{
  "aboutHeading": "关于我",          // 页面大标题（也用作浏览器标签标题）
  "subheading": "关于创作",          // 头像右边的小标题
  "aboutText": "第一段。\n\n第二段。", // 介绍正文，\n\n 分段
  "contactText": "欢迎联系我。",      // 介绍下方的补充说明（可留空）
  "email": "hi@example.com",         // 有值就自动生成一条带邮件图标的链接
  "links": [
    { "icon": "github",   "label": "GitHub",   "url": "https://github.com/xxx" },
    { "icon": "weibo",    "label": "微博",     "url": "https://weibo.com/xxx" },
    { "icon": "bilibili", "label": "哔哩哔哩", "url": "https://space.bilibili.com/xxx" }
  ],
  "avatar": "about/avatar.jpg"       // 头像（放 about/ 目录），留空则不显示
}
```

`links` 可以随便增减，每条三个字段：**图标 / 显示名称 / 链接地址**（点击名称打开链接，外部链接自动新窗口打开）。

可选图标名（写 `icon` 字段）：

| 类别 | 可用值 |
|---|---|
| 平台 | `github` `x` `weibo` `bilibili` `instagram` `wechat` `pixiv` `behance` `mailchimp` `play` `music` |
| 联系 | `mail` `web` `link` |
| 其他 | `shopping` `download` `star` |

图标是内联 SVG（画在 `about.html` 里的 `<symbol>`），**不依赖任何图标字体或外部请求**；写错名字会自动回退成 `link`（链接图标）。
## 本地预览

`fetch` 读 JSON，所以**必须用本地服务器**打开，直接双击 file:// 会被浏览器拦。

```powershell
# 在 mysite 的上一层执行
python -m http.server 8000        # 或 npx serve .
# 浏览器打开 http://localhost:8000/mysite/
```

## 关于内容管理工具

仓库上一层的 `admin-v3.html` 是配套的本地管理工具，分**三个相互独立的页卡**：

| 页卡 | 负责的文件 | 导出按钮 |
|---|---|---|
| 作品 | `data/works.json` + `works/` | 导出作品 |
| 笔记 | `data/notes.json` + `notes/` | 导出笔记 |
| 站点信息 | `data/about.json`（+ `about/avatar.jpg`、`about/01.jpg`…） | 导出站点信息 |

每个页卡都能**单独载入、单独编辑、单独导出**：

1. 在对应页卡点「载入…文件夹」，或直接把文件/文件夹**拖到页面上**：
   - 拖**单个作品文件夹**（内有 `meta.json` + `cover.*`）→ 只进作品页
   - 拖**单篇笔记文件夹**（内有 `meta.json` + `content.md`）→ 只进笔记页
   - 拖**整个 `mysite` 文件夹** → 三个页卡一次填满（导出时还会带上页面文件）
2. 列表里点条目进入编辑页；`＋ 新建` 后也能在列表里看到（带「新增」标记）
3. 编辑页顶部有 **「文件序号 / 目录名」** —— 它同时决定导出目录和文档里的 `id`：
   作品填 `001` → 导出到 `works/001/`；想改成 `w-2026-01` 就直接改，导出路径跟着变（重名会被拦下）
4. 点对应页卡的「导出」：
   - 支持目录写入的浏览器 → 选 `mysite` 文件夹**直接写盘**（无需解压）
   - 否则下载 `<页卡名>-日期.zip`，解压覆盖 `mysite` 即可

编辑中的内容每 15 秒会存一份草稿到浏览器本地，误刷新后重开工具会提示「恢复」。

导出包**只重写 `data/`、`works/`、`notes/`**，`assets/` 和页面文件原样带回去，
所以你在代码里的改动不会被工具覆盖。

工具里几个顺手的功能：

- **笔记详情**：顶部一行是「日期 · 标签」，正文按 Markdown 渲染；页面底部不再重复标签（作者页/详情页都不显示英文小字）
- **列表即总览**：作品/笔记分两个页签，显示缩略图、编号、分类、年份、精选标记，缺封面的会角标「缺图」；上方有搜索框和分类筛选
- **图片拖拽排序**：细节图、笔记配图都能拖动，按新顺序自动命名 `01.jpg`、`02.jpg`…
- **作品排序**：列表右侧 `▲▼` 或拖动 `⠿` 调整；也可以按年份 / 分类临时查看（拖动时会切回手动顺序）
- **内容体检**：导出面板会列出「哪几件作品还没有封面」「精选超过 5 件」这类问题
- **自动草稿**：编辑内容自动存在浏览器本地，误刷新后重新打开工具会提示恢复（图片太多的超大草稿会跳过并提醒及时导出）
- **快捷键**：`Ctrl+S` 保存当前编辑项


## Markdown 渲染

- **笔记列表也带筛选**：和作品列表同一套左侧栏（全部 / 标签 / 年份，单选），样式和位置完全一致；标签同样只汇总「实际在用的」，按使用次数排序。笔记的标签来自 `notes.json` 的 `tags` 字段，老数据没有就会去读对应的 `meta.json` 补上。

笔记正文由 `app.js` 内置的轻量渲染器处理（标题、列表、引用、表格、粗体、行内代码、图片），**不需要任何外部库**。

如果以后想换成完整的 Markdown 解析器：

1. 下载 [marked](https://github.com/markedjs/marked) 放到 `assets/marked.min.js`
2. 在每个页面的 `assets/app.js` 之前加一行：`<script src="assets/marked.min.js"></script>`

`app.js` 会自动优先用它（`window.marked.parse`），加载不到就用内置渲染，不会报错。
