/* ==========================================================================
   VVXIE — 站点脚本（多文件版）
   数据来自 data/*.json 与 works/NNN/meta.json、notes/NNN/meta.json
   页面：index / works / work / notes / note / about
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------- 工具函数 ---------------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var BASE = new URL('.', location.href);

  function url(p) {
    if (!p) return '';
    if (/^(https?:|data:|blob:)/i.test(p)) return p;
    return new URL(String(p).replace(/^\.?\//, ''), BASE).href;
  }

  function loadJSON(p) {
    return fetch(url(p), { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(r.status + ' ' + p);
      return r.json();
    });
  }

  function loadText(p) {
    return fetch(url(p), { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(r.status + ' ' + p);
      return r.text();
    });
  }

  function param(k) {
    var m = new RegExp('[?&]' + k + '=([^&#]*)').exec(location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
  }

  /* ---------------- 图片加载占位（底色 + 三个闪动的点） ----------------
     任何 <img> 还没加载好时，在它的容器里盖一层 .skel；加载完自动撤掉。 */
  function skelFor(im){
    var box = im.parentElement;
    if (!box) return null;
    if (box.querySelector(':scope > .skel')) return null;
    box.classList.add('has-skel');
    var d = document.createElement('span');
    d.className = 'skel';
    d.setAttribute('data-auto', '1');
    d.setAttribute('aria-hidden', 'true');
    d.innerHTML = '<i></i><i></i><i></i>';
    box.appendChild(d);
    return d;
  }
  function clearSkel(im){
    im.setAttribute('data-ok', '1');
    var box = im.parentElement;
    if (!box) return;
    var d = box.querySelector(':scope > .skel[data-auto]');
    if (d) d.remove();
    /* 容器里所有图片都好了才去掉 has-skel */
    var left = [].filter.call(box.querySelectorAll('img'), function (x) { return !x.getAttribute('data-ok'); });
    if (!left.length) box.classList.remove('has-skel');
  }
  function decorateImages(root){
    if (!root) return;
    var imgs = root.tagName === 'IMG' ? [root] : [].slice.call(root.querySelectorAll('img'));
    imgs.forEach(function (im) {
      if (im.getAttribute('data-ok')) return;
      if (im.complete && im.naturalWidth) { clearSkel(im); return }
      skelFor(im);
    });
  }
  /* 全局：图片一好就撤占位（capture 才能收到 load 事件） */
  document.addEventListener('load', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG') clearSkel(t);
  }, true);
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG') clearSkel(t);
  }, true);

  window.__vvxie = { decorateImages: decorateImages, clearSkel: clearSkel, skelFor: skelFor };
  function imgErr(el, fallback) {
    el.addEventListener('error', function () {
      if (el.dataset.fallbackDone) return;
      el.dataset.fallbackDone = '1';
      el.src = url(fallback || 'assets/placeholder.svg');
    });
  }

  function firstSentence(text) {
    var s = String(text || '').trim().replace(/\s+/g, ' ');
    if (!s) return '';
    var m = s.match(/^[^。！？.!?\n]{4,90}[。！？.!?]/);
    return m ? m[0] : (s.length > 80 ? s.slice(0, 80) + '…' : s);
  }

  function when(iso) {
    return String(iso || '').slice(0, 10);
  }

  /* ---------------- 轻量 Markdown（marked 缺失时的兜底） ---------------- */
  function mdInline(s) {
    return esc(s)
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (m, alt, src) {
        return '<img src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy">';
      })
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, href) {
        var ex = /^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : '';
        return '<a href="' + esc(href) + '"' + ex + '>' + t + '</a>';
      })
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  }

  function mdToHtml(md) {
    var lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
    var out = [], i = 0, list = null, para = [], quote = [];
    function flushPara() { if (para.length) { out.push('<p>' + mdInline(para.join(' ')) + '</p>'); para = []; } }
    function flushList() { if (list) { out.push('<' + list.tag + '>' + list.items.map(function (t) { return '<li>' + mdInline(t) + '</li>'; }).join('') + '</' + list.tag + '>'); list = null; } }
    function flushQuote() { if (quote.length) { out.push('<blockquote><p>' + mdInline(quote.join(' ')) + '</p></blockquote>'); quote = []; } }
    function flushAll() { flushPara(); flushList(); flushQuote(); }
    while (i < lines.length) {
      var L = lines[i];
      if (/^```/.test(L)) {
        flushAll();
        var buf = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
        out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>');
        i++; continue;
      }
      if (!L.trim()) { flushAll(); i++; continue; }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(L)) { flushAll(); out.push('<hr>'); i++; continue; }
      if (/\|/.test(L) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
        flushAll();
        var cells = function (row) {
          return row.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function (c) { return c.trim(); });
        };
        var headCells = cells(L), rows = [];
        i += 2;
        while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim()) { rows.push(cells(lines[i])); i++; }
        out.push('<table><thead><tr>' + headCells.map(function (c) { return '<th>' + mdInline(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + mdInline(c) + '</td>'; }).join('') + '</tr>'; }).join('') +
          '</tbody></table>');
        continue;
      }
      var h = L.match(/^(#{1,6})\s+(.*)$/);
      if (h) { flushAll(); var lv = h[1].length; out.push('<h' + lv + '>' + mdInline(h[2]) + '</h' + lv + '>'); i++; continue; }
      if (/^>\s?/.test(L)) { flushPara(); flushList(); quote.push(L.replace(/^>\s?/, '')); i++; continue; }
      var ul = L.match(/^\s*[-*+]\s+(.*)$/);
      if (ul) { flushPara(); flushQuote(); if (!list || list.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] }; } list.items.push(ul[1]); i++; continue; }
      var ol = L.match(/^\s*\d+[.)]\s+(.*)$/);
      if (ol) { flushPara(); flushQuote(); if (!list || list.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] }; } list.items.push(ol[1]); i++; continue; }
      flushList(); flushQuote(); para.push(L.trim()); i++;
    }
    flushAll();
    return out.join('\n');
  }

  function sanitize(html) {
    var doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
    var box = doc.body.firstChild;
    $$('*', box).forEach(function (el) {
      $$('*', el).length;
      Array.prototype.slice.call(el.attributes).forEach(function (a) {
        var n = a.name.toLowerCase();
        if (n.indexOf('on') === 0 || (n === 'href' && /^\s*javascript:/i.test(a.value))) el.removeAttribute(a.name);
      });
    });
    $$('script,style,iframe,object,embed,form,input,button', box).forEach(function (el) { el.remove(); });
    return box.innerHTML;
  }

  function renderMarkdown(md, baseUrl) {
    var html;
    if (window.marked && typeof window.marked.parse === 'function') {
      try { html = window.marked.parse(String(md || ''), { breaks: false }); } catch (e) { html = mdToHtml(md); }
    } else {
      html = mdToHtml(md);
    }
    html = sanitize(html);
    if (baseUrl) {
      var doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
      var box = doc.body.firstChild;
      $$('img[src]', box).forEach(function (im) {
        var s = im.getAttribute('src');
        if (s && !/^(https?:|data:)/i.test(s)) im.setAttribute('src', baseUrl + s.replace(/^\.?\//, ''));
      });
      $$('a[href]', box).forEach(function (a) {
        var s = a.getAttribute('href');
        if (s && !/^(https?:|mailto:|#|data:)/i.test(s)) a.setAttribute('href', baseUrl + s.replace(/^\.?\//, ''));
      });
      html = box.innerHTML;
    }
    return html;
  }

  /* ---------------- 公共片段 ---------------- */
  /* cover / gallery 在 JSON 里只存文件名（如 cover.png），这里拼上所属目录。
     兼容老数据里的 data:/http: 绝对地址。 */
  /* 资源目录：data/*.json 的 base 字段（工具里可改），缺省回退 works/、notes/ */
  var MEDIA_BASE = { works: "works", notes: "notes" };
  function setMediaBase(kind, data) {
    if (data && typeof data.base === "string" && data.base) {
      MEDIA_BASE[kind] = data.base.replace(/^\/+|\/+$/g, "");
    }
  }
  function mediaUrl(kind, id, name) {
    if (!name) return "";
    if (/^(data:|https?:)/i.test(name)) return name;
    var b = MEDIA_BASE[kind] || (kind === "notes" ? "notes" : "works");
    return url(b + "/" + id + "/" + name);
  }

  /* 老数据用的是 panU/panV（以视口宽度为单位），这里按图片尺寸换算成新的 x/y */
  function normCrop(c,W,H,aspect){
    if(!c) return c;
    if(c.x!=null && c.y!=null) return c;
    const r0=regionFor(W,H,aspect,c.zoom||1,0,0);
    const sx=(W-r0.sw)/2, sy=(H-r0.sh)/2;
    return {
      src:c.src, zoom:c.zoom||1,
      x: sx>0.5 ? +(((c.panU||0)*r0.sw)/sx).toFixed(4) : 0,
      y: sy>0.5 ? +(((c.panV||0)*r0.sh)/sy).toFixed(4) : 0
    };
  }
  /* 轮播取景：和工具里的裁切用同一套数学，纯 CSS 摆位，不生成新图 */
  function regionFor(W, H, aspect, zoom, x, y) {
    var wide = (W / H) >= aspect;
    var coverW = wide ? H * aspect : W;
    var coverH = wide ? H : W / aspect;
    var z = Math.max(1, zoom || 1);
    var cw = coverW / z, ch = coverH / z;
    var cx = W / 2 + (x || 0) * (W - cw) / 2;
    var cy = H / 2 + (y || 0) * (H - ch) / 2;
    return {
      sx: Math.max(0, Math.min(W - cw, cx - cw / 2)),
      sy: Math.max(0, Math.min(H - ch, cy - ch / 2)),
      sw: cw, sh: ch
    };
  }
  function applyFrameCrop(img, crop) {
    if (!img) return;
    img.style.width = ''; img.style.height = ''; img.style.left = ''; img.style.top = '';
    img.style.right = ''; img.style.bottom = ''; img.style.objectFit = ''; img.style.maxWidth = '';
    if (!crop) return;
    var frame = img.parentNode;
    if (!frame) return;
    var fw = frame.clientWidth, fh = frame.clientHeight;
    var W = img.naturalWidth, H = img.naturalHeight;
    if (!fw || !fh || !W || !H) return;
    crop = normCrop(crop, W, H, fw / fh);
    var r = regionFor(W, H, fw / fh, crop.zoom, crop.x, crop.y);
    // 让「取景区域的宽度」正好等于画框宽度：整图宽度 = W / sw 倍画框宽
    var ratio = fw / fh;
    var wPct = (W / r.sw) * 100;
    var hPct = (H / r.sw) * ratio * 100;
    img.style.position = 'absolute';
    img.style.right = 'auto'; img.style.bottom = 'auto';
    img.style.width = wPct + '%';
    img.style.height = hPct + '%';
    img.style.objectFit = 'fill';
    img.style.maxWidth = 'none';   // 全局 img{max-width:100%} 会卡住宽度
    img.style.left = (-(r.sx / r.sw) * 100) + '%';
    img.style.top = (-(r.sy / r.sw) * ratio * 100) + '%';
  }
  function workCard(w, fallbackCover) {
    var tags = tagsOf(w);
    var tagHtml = tags.length
      ? tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('')
      : '<span class="tag tag-empty">未归类</span>';
    return '<a class="work-card" href="work.html?id=' + encodeURIComponent(w.id) + '">' +
      '<div class="thumb"><img src="' + esc(mediaUrl('works', w.id, w.cover) || url(fallbackCover || 'assets/placeholder.svg')) + '" alt="' + esc(w.title) + '" loading="lazy"></div>' +
      '<div class="work-meta"><div><h3>' + esc(w.title) + '</h3><p class="work-tags">' + tagHtml + '</p></div>' +
      '<span class="year">' + esc(yearOf(w)) + '</span></div></a>';
  }

  /* ---------------- 首页：精选轮播 + 最近内容 ---------------- */
  function initHome() {
    Promise.all([loadJSON('data/works.json'), loadJSON('data/notes.json')])
    .then(function (res) { setMediaBase('works', res[0]); setMediaBase('notes', res[1]);
        buildCarousel(res[0].works || []); decorateImages(document);
      })
      .catch(function (e) { fail('#feature', e); });
  }

  /* ==========================================================================
     首页轮播 —— 整体设计
     --------------------------------------------------------------------------
     DOM 结构（下面一次性生成）：
       .feature-frame            画框（<a>，点进去是作品详情）
         img.feat-img ×2         两个图层，交叉淡入用（同一时刻只有一张带 .on）
         span.skel               占位图层：底色 + 三个点，图片没到就顶替它
         .feature-copy           标题底板（::before 就是那层半透明白底）
           .feature-text         标题 + 简介，带 .is-out 时整体隐藏
       .feature-controls         左右箭头 + 圆点

     一句话模型：一页 = 一个开关（runPage）。切到第 n 页时：
       t=0     旧标题瞬间隐藏；新的一层淡入（真图 或 占位）
       t=900   底板从左往右展开（0.5s，起手快、收尾慢）
       t=1000  标题逐字浮起，正好贴在底板快展开完时
       图迟到 → 只在同一层里「占位 → 真图」替换，标题节奏完全不动

     为什么是「两层 + 占位」：
       · 两层：新图淡入时旧图还在下面，中间不会闪白；
       · 占位：图没下载完时它就是这张图的替身，交互（标题、切页）不被网络拖住。

     关键约定：动画节拍只由「切页」驱动，绝不跟随图片加载事件。
     ========================================================================== */
  function buildCarousel(works) {
    var host = $('#feature');
    if (!host) return;
    // 轮播只放勾了「首页精选」的作品，不做任何兜底：
    // 勾了哪些就放哪些；一件都没勾就空着，不会再自动把最近几件拉进来。
    var list = works.filter(function (w) { return w.featured; }).sort(byDateDesc);
    if (!list.length) {
      host.innerHTML = '<div class="feature-empty">' + (works.length ? '精选作品整理中' : '还没有作品') + '</div>';
      return;
    }

    /* 画框里一次把三种图层都放好：两个 <img> 是双缓冲，<span class="skel"> 是占位替身。
       顺序很重要：.skel 排在图片之后、标题之前 —— 它要盖住旧图，但压在标题下面。 */
    host.innerHTML =
      '<div class="feature-visual" id="feature-visual">' +
        '<a class="feature-frame" id="feature-frame" href="#">' +
          '<img class="feat-img on" alt=""><img class="feat-img" alt="">' +
          '<span class="skel" aria-hidden="true">' + '<i></i><i></i><i></i>' + '</span>' +
          // 标题压在图片左下角，垫一层透明白底
          '<div class="feature-copy"><div class="feature-text" id="feature-text">' +
            '<h1 id="feature-title"></h1><p id="feature-desc"></p>' +
          '</div></div>' +
        '</a>' +
        '<div class="feature-controls">' +
          '<button class="circle-btn" id="feature-prev" aria-label="上一件">←</button>' +
          '<div class="feature-dots" id="feature-dots"></div>' +
          '<button class="circle-btn" id="feature-next" aria-label="下一件">→</button>' +
        '</div>' +
      '</div>';

    /* -------------------------------------------------------------- 状态
       idx      当前第几张（list 下标）
       timer    自动轮播定时器（每次跳转都重排，避免和手动操作打架）
       cur      当前可见的是 0 号还是 1 号图层（layers[cur] 就是「旧图」）
       INTERVAL 自动轮播间隔
       reduced  系统开了「减少动态效果」时走无动画分支 */
    var INTERVAL = 6000;                       // 每张停留时间（放慢）
    var idx = 0, timer = null, cur = 0;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var title = $('#feature-title'), desc = $('#feature-desc'), text = $('#feature-text'),
        frame = $('#feature-frame'), layers = $$('.feat-img', frame),
          dots = $('#feature-dots');

    /* 圆点数量超过 DOT_MAX 时只显示「当前附近的一小段」窗口，否则会把左右箭头挤掉。
       list 本身不裁剪：精选有多少件，就都参与轮播。 */
    var DOT_MAX = 9;
    function dotWindow(n, cur, max) {
      if (n <= max) return { s: 0, e: n };
      var half = Math.floor(max / 2);
      var s = Math.min(Math.max(0, cur - half), n - max);
      return { s: s, e: s + max };
    }
    var dotKey = '';
    /* 画圆点：只有「窗口范围变化」时才重建 DOM（dotKey 做脏检查），
       但 active 状态每次都刷新 —— 同一窗口内切换不必重建。 */
    function renderDots() {
      var win = dotWindow(list.length, idx, DOT_MAX);
      var key = win.s + ':' + win.e;
      if (key !== dotKey) {
        dotKey = key;
        var html = '';
        for (var k = win.s; k < win.e; k++) {
          html += '<button class="feature-dot" type="button" data-i="' + k +
            '" aria-label="第 ' + (k + 1) + ' 件：' + esc(list[k].title) + '"></button>';
        }
        dots.innerHTML = html;
      }
      $$('.feature-dot', dots).forEach(function (d) {
        var on = Number(d.dataset.i) === idx;
        d.classList.toggle('active', on);
        if (on) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      });
    }

    /* 两张 <img> 叠在一起就是「双缓冲」：切页时把新图写进非当前那一层，
       等它就绪再交换 .on，旧的留在下面淡出 —— 画框里任何时刻都有内容。
       具体时序和占位替换都在 runPage()，这里只放公共小工具。 */

    // 标题逐字拆成 span，每个字错开出现（重新赋值 innerHTML 会自动重播动画）
    /* 标题逐字拆 span：每个字带 --i，CSS 用 animation-delay:calc(var(--i) * 42ms)
       做「逐字浮起」。重新赋值 innerHTML 会让新元素自动从头播动画。 */
    function splitChars(s) {
      return Array.from(String(s == null ? '' : s)).map(function (ch, i) {
        return '<span class="ch" style="--i:' + i + '">' + (ch === ' ' ? '&nbsp;' : esc(ch)) + '</span>';
      }).join('');
    }
    /* textGuard：「逐字动画万一没跑起来」的兜底计时。到点给 .feature-text 加
       .chars-done，CSS 里那条 !important 规则会把标题强制显示出来，绝不留白。 */
    var textGuard = null;
    // 手机宽度用竖版取景（9:16），桌面用横版
    var mobileMQ = window.matchMedia('(max-width:640px)');  // 与 CSS 的画框断点一致
    /* 取景参数：meta.json 里存的是「原图上的裁切矩形」。
       手机（<=640px，和 CSS 断点一致）优先用竖版 carouselCropM，桌面用横版 carouselCrop。 */
    function cropFor(w) {
      var m = w.carouselCropM, d = w.carouselCrop;
      return (mobileMQ.matches && m) ? m : d;
    }
    /* 首页用工具烘焙好的轮播图（carousel.jpg / carousel-m.jpg），没有再退回 CSS 取景 */
    /* 工具里烘焙好的成品图（carousel.jpg / carousel-m.jpg）：
       有就直接用整张文件，没有才退回 CSS 取景（applyFrameCrop）。 */
    function carouselFile(w) {
      return mobileMQ.matches ? (w.carouselM || w.carousel) : (w.carousel || w.carouselM);
    }
    /* ========== 一页的入场时间轴（ms，从「切页那一刻」开始算）==========
         t=0     旧标题瞬间隐藏（.is-out）+ 新的一层淡入 0.9s（真图或占位）
         t=900   底板从左往右展开（style.css 里 capPanel，0.5s，收尾变慢）
         t=1000  标题逐字浮起（capChar，每字错开 42ms），贴着底板收尾
       这里只决定「何时开始」，动画本身的时长/缓动全在 style.css。
       instant=true（首屏首帧、横竖屏重算取景）时全部走同步分支，不加延时。 */
    var TIMING = { title: 900, text: 1000 };

    /* 只是给 applyFrameCrop 起个更好读的小名：在 runPage 里一眼能看出
       「这一步是在把取景参数套到图层上」。 */
    function applyFrameCropOnce(im, crop) { applyFrameCrop(im, crop); }

    /* 这一页用哪张图 —— 按优先级依次回退：
         烘焙好的轮播图 → CSS 取景的原图 → 竖版裁切图 → 横版裁切图
         → 详情图第一张 → 单图 → 封面
       返回 { src, crop }；crop 只有「不是烘焙图」时才需要（要给图层套裁切）。 */
    function heroOf(w) {
      var baked = carouselFile(w), crop = cropFor(w);
      var name = baked || (crop && crop.src) || (w.carouselCropM && w.carouselCropM.src) || (w.carouselCrop && w.carouselCrop.src) || (w.gallery && w.gallery[0]) || w.image || w.cover;
      return { src: mediaUrl('works', w.id, name) || url('assets/placeholder.svg'), crop: baked ? null : crop };
    }

    /* 预取：只记状态，不参与动画 */
    /* 预取状态表：url → 'pending' | 'ok' | 'err'。
       只用来判断「切过去时图是否已经在缓存里」，不参与任何动画。 */
    var preloadState = {};
    /* 预取第 i 张（列表循环）。用了 new Image() 提前下载，切页时大概率已就绪，
       于是直接淡入、占位一闪而过；网慢时占位就顶住，不会阻塞交互。 */
    function prefetchAt(i) {
      var w = list[(i + list.length) % list.length];
      if (!w) return;
      var it = heroOf(w);
      if (!it.src || preloadState[it.src]) return;
      preloadState[it.src] = 'pending';
      var im = new Image();
      im.onload = function () { preloadState[it.src] = 'ok'; };
      im.onerror = function () { preloadState[it.src] = 'err'; };
      im.src = it.src;
    }

    /* 切页序号 + 本页的定时器集合。
       pageSeq：每次切页自增，回调里比对它就知道「这一页是不是已经被切走了」，
                晚到的定时器一律作废，快速连点也不会串页。
       later()：把 setTimeout 登记进来，切页时统一 clear。 */
    var pageSeq = 0, pageTimers = [];
    function clearPageTimers() { pageTimers.forEach(clearTimeout); pageTimers = []; }
    function later(fn, ms) { var t = setTimeout(fn, ms); pageTimers.push(t); return t; }

    /* ==================== 切到第 n 页 ====================
       instant=true 只用在两处：首屏第一帧、横竖屏切换后重算取景。
       它会跳过所有延时（标题、底板立刻到位），因为那不是「用户切页」。
       其余情况按 TIMING 的时间轴依次播放，详见下面四段。 */
    function runPage(n, instant) {
      var w = list[n];
      if (!w) return;
      var my = ++pageSeq;
      clearPageTimers();
      clearTimeout(textGuard);

      var it = heroOf(w);
      var ready = preloadState[it.src] === 'ok';
      frame.href = 'work.html?id=' + encodeURIComponent(w.id);
      layers.forEach(function (im) { im.alt = w.title });
      renderDots();

      /* ---------- 画面：新层淡入；没就绪就先叠占位（占位就是这一页的图） ---------- */
      /* next = 要显示的新图层；old = 还留在下面的旧图层。
         先把 next 复位（去掉 on / quick）并写入新 src，此时它还完全透明。 */
      var next = layers[1 - cur], old = layers[cur];
      var skel = frame.querySelector('.skel');

      next.onload = next.onerror = null;
      next.classList.remove('on', 'quick');
      if (it.crop) applyFrameCropOnce(next, it.crop); else next.style.cssText = '';
      next.src = it.src;

      /* 让新图层亮起来：给它加 .on（CSS 里 0.9s 淡入），旧图层去掉 .on 悄悄退场，
         同时撤掉占位。quick=true 表示「页内替换」（占位→真图），用 0.5s 的快版。
         因为可能在图片 onload 里被异步调用，先比对 pageSeq 防止过期回调生效。 */
      function revealImage(quick) {
        if (my !== pageSeq) return;
        next.onload = next.onerror = null;
        if (quick) next.classList.add('quick');
        next.classList.add('on');
        if (skel) skel.classList.add('quick');
        frame.classList.remove('is-placeholder');
        old.classList.remove('on');
        cur = 1 - cur;
      }

      if (instant) {
        next.classList.add('on');
        frame.classList.remove('is-placeholder');
        old.classList.remove('on');
        cur = 1 - cur;
      } else if (ready) {
        frame.classList.remove('is-placeholder');
        revealImage(false);
      } else {
        frame.classList.add('is-placeholder');
        next.onload = function () { revealImage(true) };
        next.onerror = function () { };
        if (next.complete && next.naturalWidth) revealImage(true);
      }

      /* ---------- 标题：先底板，后文字 ---------- */
      var line = w.tagline || w.summary || firstSentence(w.description) || '';
      var panel = text.parentNode;
      if (panel && panel.classList) { panel.classList.remove('cap-play'); panel.classList.add('cap-hide'); }   /* 收起旧底板 */
      /* 先把新内容以纯文本放进去（隐藏），底板宽度立刻就是最终宽度，
         这样展开过程中不会因为文字插入而「顿一下」 */
      title.setAttribute('aria-label', w.title);
      title.textContent = w.title;
      desc.textContent = line;
      desc.style.display = line ? '' : 'none';
      text.classList.remove('chars-done');   /* 关键：上一页的兜底类会让新文字顶不住，先摘掉 */
      text.classList.add('is-out');

      /* 标题第一拍：底板从左展开。
         先摘 cap-hide（切页瞬间收起的状态），再重新加 cap-play 触发动画；
         中间的 void offsetHeight 是强制重排，让同名动画能重新播一遍。 */
      function panelOn() {
        if (my !== pageSeq) return;
        if (panel && panel.classList) {
          panel.classList.remove('cap-hide');
          panel.classList.remove('cap-play');
          void panel.offsetHeight;
          panel.classList.add('cap-play');           /* 底板从左展开，收尾变慢 */
        }
      }
      /* 标题第二拍：文字落位。
         把纯文本换成逐字 span（触发逐字浮起）；desc 用「先 none 再空」重启行动画；
         最后摘掉 is-out 让文字显现，并挂上 chars-done 的兜底计时。 */
      function textOn() {
        if (my !== pageSeq) return;
        title.innerHTML = splitChars(w.title);       /* 换成逐字 span → 逐字浮起 */
        desc.style.animation = 'none';
        void desc.offsetHeight;
        desc.style.animation = '';
        text.classList.remove('is-out');             /* 文字浮现 */
        text.classList.remove('chars-done');
        textGuard = setTimeout(function () { text.classList.add('chars-done') },
          Math.max(1800, Array.from(String(w.title || '')).length * 60 + 1300));
      }

      /* instant 分支：不加延时，底板和文字立刻到位（首屏 / 重算取景用）。
         注意这里 return 得早，避免下面再排一遍定时器。 */
      if (instant) { panelOn(); textOn(); return; }

      later(panelOn, TIMING.title);
      later(textOn, TIMING.text);
      prefetchAt(idx + 1);
      prefetchAt(idx + 2);
    }
    /* 跳页：取模保证首尾循环；真正的绘制都交给 runPage。 */
    function go(n, instant) { idx = (n + list.length) % list.length; runPage(idx, instant); }
    // 屏幕宽度跨过断点（横竖屏切换）时，重新套用当前这张的取景

    /* 屏幕宽度跨过 640px 断点（手机横竖屏切换、拖窗口）时重算取景：
         有烘焙图 → 直接换文件；没有 → 给当前图层套新的裁切矩形，套不上就整页重画。 */
    function reapplyCrop() {
      var w = list[idx]; if (!w) return;
      var on = layers[1 - cur];
      if (carouselFile(w)) { runPage(idx, true); return; }   // 有烘焙好的轮播图 → 直接换文件
      if (on && on.naturalWidth) applyFrameCrop(on, cropFor(w));
      else runPage(idx);
    }
    if (mobileMQ.addEventListener) mobileMQ.addEventListener('change', reapplyCrop);
    else if (mobileMQ.addListener) mobileMQ.addListener(reapplyCrop);
    var rzTimer = null;
    window.addEventListener('resize', function(){
      clearTimeout(rzTimer); rzTimer = setTimeout(reapplyCrop, 160);
    });

    // 始终循环：不因悬停、也不因标签页前后台切换而停（后台由浏览器自己降频）
    /* 自动轮播循环。刻意不在悬停、也不在标签页切后台时暂停：
       后台由浏览器自己降频，前台永远保持固定节奏。 */
    function schedule() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (list.length < 2) return;
      timer = setTimeout(function () { timer = null; go(idx + 1); schedule(); }, INTERVAL);
    }

    /* 手动操作后都要调一次 schedule()：把「下一次自动切」的计时重新排，
       否则刚点完就可能马上又被自动切走。 */
    $('#feature-prev').addEventListener('click', function () { go(idx - 1); schedule(); });
    $('#feature-next').addEventListener('click', function () { go(idx + 1); schedule(); });
    dots.addEventListener('click', function (e) {
      var b = e.target.closest('.feature-dot');
      if (!b) return;
      go(Number(b.dataset.i) || 0); schedule();
    });

    /* ---------------- 滑动翻页（手机滑、桌面按住拖） ---------------- */
    // 手感：不跟手、不播动画，横向划过一小段就立刻换图（像相册翻页）
    /* 拖动状态：dragX/Y 起点，dragT 起始时间（用来算速度），
       isDrag 是否已判定为横向拖动，suppressClick 用来吞掉「划完顺手点开链接」的那一下。 */
    var dragX = 0, dragY = 0, dragT = 0, dragging = false, isDrag = false, suppressClick = false;
    var THRESH = 18;          // 横向拖过这么多像素就翻页（越小越灵敏）
    var THRESH_VEL = 0.35;    // 或者快速划动（px/ms）也算

    /* 手指按下：鼠标只认左键；只有一件作品时不启用拖动。 */
    frame.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (list.length < 2) return;
      dragging = true; isDrag = false;
      dragX = e.clientX; dragY = e.clientY;
      dragT = Date.now();
    });
    frame.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - dragX, dy = e.clientY - dragY;
      if (!isDrag && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
        isDrag = true;
        try { frame.setPointerCapture(e.pointerId); } catch (err) {}
      }
      // 划得够远就直接翻，不等松手 —— 手感更干脆
      if (isDrag && Math.abs(dx) > THRESH * 1.6 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        if (dx < 0) go(idx + 1, true); else go(idx - 1, true);
        schedule();
        stopDrag();
      }
    });
    function stopDrag() {
      dragging = false; isDrag = false;
      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 400);
    }
    function endDrag(e, cancelled) {
      if (!dragging) return;
      var dx = e.clientX - dragX, dy = e.clientY - dragY;
      var dt = Math.max(1, Date.now() - dragT);
      var fast = Math.abs(dx) / dt > THRESH_VEL;
      var horiz = Math.abs(dx) > Math.abs(dy);
      if (!cancelled && horiz && (Math.abs(dx) >= THRESH || fast) && Math.abs(dx) > 6) {
        if (dx < 0) go(idx + 1, true); else go(idx - 1, true);
        schedule();
        stopDrag();
      } else {
        dragging = false; isDrag = false;
      }
    }
    frame.addEventListener('pointerup', function (e) { endDrag(e, false); });
    frame.addEventListener('pointercancel', function (e) { endDrag(e, true); });
    frame.addEventListener('pointerleave', function (e) { if (dragging) endDrag(e, true); });
    // 划完别顺手把链接点开
    frame.addEventListener('click', function (e) {
      if (suppressClick) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    // 轮播要用「取景参数 / 详情图第一张 / 一句话简介」，这些都可能在 meta.json 里。
    // 精选件数通常很少，统一先读一遍再首次渲染，避免先闪一下再换。
    /* 首帧之前先把精选作品的 meta.json 都读一遍（取景参数、详情图、一句话简介都在里面）。
       精选通常只有几件，并行读很快；读完再画第一帧，避免「先闪一下再换」。
       任何一件读失败都不影响整体（catch 掉），退化成没有裁切参数。 */
    Promise.all(list.map(function (w) {
      return loadJSON(w.meta || ((MEDIA_BASE.works||'works') + '/' + w.id + '/meta.json')).then(function (m) {
        if (Array.isArray(m.gallery)) w.gallery = m.gallery;
        if (m.carouselCrop) w.carouselCrop = m.carouselCrop;
        if (m.carouselCropM) w.carouselCropM = m.carouselCropM;
        if (!w.tagline) w.tagline = m.tagline || '';
        if (!w.description) w.description = m.description || '';
      }).catch(function () {});
    })).then(function () { runPage(0); prefetchAt(1); prefetchAt(2); schedule(); });
  }

  /* ---------------- 作品列表 ---------------- */
  function tagsOf(w) {
    if (w && Array.isArray(w.tags) && w.tags.length) return w.tags.filter(Boolean);
    if (w && w.category) return [w.category];
    return [];
  }

  /* 作品日期：统一用 YYYY-MM-DD；老数据只有年份时按 1 月 1 日算 */
  function dateOf(w) {
    var d = String((w && w.date) || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    if (/^\d{4}-\d{2}$/.test(d)) return d + '-01';
    var y = String((w && w.year) || '').trim();
    return /^\d{4}$/.test(y) ? y + '-01-01' : '';
  }
  /* 列表上只显示年份 */
  function yearOf(w) {
    var d = dateOf(w);
    return d ? d.slice(0, 4) : '';
  }
  function byDateDesc(a, b) {
    return dateOf(b).localeCompare(dateOf(a)) || String(a.title || '').localeCompare(String(b.title || ''), 'zh');
  }

  /* 列表页通用：左侧「全部 / 标签 / 年份」筛选（单选），作品和笔记共用同一套 */
  function buildFilterPanel(filterHost, grid, empty, items, cfg) {
    var sel = { kind: '', value: '' };

    // 标签只汇总「实际在用的」，按使用次数从多到少排
    var tagSet = [], tagCount = {};
    items.forEach(function (it) {
      cfg.tagsOf(it).forEach(function (t) {
        t = String(t || '').trim();
        if (!t) return;
        tagCount[t] = (tagCount[t] || 0) + 1;
        if (tagSet.indexOf(t) < 0) tagSet.push(t);
      });
    });
    tagSet.sort(function (a, b) {
      return ((tagCount[b] || 0) - (tagCount[a] || 0)) || String(a).localeCompare(String(b), 'zh');
    });

    // 年份从日期里汇总，新的在前
    var yearSet = [];
    items.forEach(function (it) {
      var y = cfg.yearOf(it);
      if (/^\d{4}$/.test(y) && yearSet.indexOf(y) < 0) yearSet.push(y);
    });
    yearSet.sort(function (a, b) { return b.localeCompare(a); });

    function isActive(kind, value) { return sel.kind === kind && sel.value === value; }
    function item(kind, value) {
      return '<button type="button" data-k="' + kind + '" data-v="' + esc(value) + '"' +
        (isActive(kind, value) ? ' class="active"' : '') + '>' + esc(value) + '</button>';
    }
    // 一个「全部」+ 标签区 + 分隔线 + 年份区，两区都只能单选
    function renderFilters() {
      if (!filterHost) return;
      var html = '<button type="button" data-k="" data-v=""' + (!sel.kind ? ' class="active"' : '') + '>全部</button>';
      if (tagSet.length) html += '<div class="filter-sep"></div>' + tagSet.map(function (t) { return item('tag', t); }).join('');
      if (yearSet.length) html += '<div class="filter-sep"></div>' + yearSet.map(function (y) { return item('year', y); }).join('');
      filterHost.innerHTML = html;
    }
    function matches(it) {
      if (!sel.kind || !sel.value) return true;
      if (sel.kind === 'tag') return cfg.tagsOf(it).indexOf(sel.value) >= 0;
      if (sel.kind === 'year') return cfg.yearOf(it) === sel.value;
      return true;
    }
    function draw() {
      var list = items.filter(matches).sort(cfg.sort || byDateDesc);   // 默认按日期，新的在前
      var html = '', lastGroup = null, any = false;
      list.forEach(function (it) {
        var g = cfg.groupOf ? cfg.groupOf(it) : '';
        if (cfg.groupOf && lastGroup !== null && g !== lastGroup) html += cfg.sep || '';
        lastGroup = g;
        html += cfg.render(it);
        any = true;
      });
      grid.innerHTML = any ? html : '';
      if (empty) empty.classList.toggle('hidden', any);
    }

    return function boot() {
      if (filterHost) {
        filterHost.addEventListener('click', function (e) {
          var b = e.target.closest('button[data-k]');
          if (!b) return;
          // 选一个就替换上一个，点「全部」清空
          sel.kind = b.dataset.v ? b.dataset.k : '';
          sel.value = b.dataset.v || '';
          renderFilters();
          draw();
        });
      }
      renderFilters();
      draw();
    };
  }

  /* ---------------- 作品列表 ---------------- */
  function initWorks() {
  loadJSON('data/works.json').then(function (data) { setMediaBase('works', data);
      var works = data.works || [];
      if (!works.length) { fail('#works-grid', new Error('empty')); return; }
      buildFilterPanel($('#filters'), $('#works-grid'), $('#works-empty'), works, {
        tagsOf: tagsOf,
        yearOf: yearOf,
        render: function (w) { return workCard(w); }
      })();
      decorateImages(document);
    }).catch(function (e) { fail('#works-grid', e); });
  }

  /* ---------------- 作品详情 ---------------- */
  function initWork() {
    var id = param('id');
  loadJSON('data/works.json').then(function (data) { setMediaBase('works', data);
      // 与列表保持同一顺序：按日期新的在前，上一件/下一件才符合直觉
      var works = (data.works || []).slice().sort(byDateDesc);
      if (!works.length) { fail('#work-body', new Error('empty')); return; }
      var i = works.map(function (w) { return w.id; }).indexOf(id);
      if (i < 0) i = 0;
      var w = works[i];

      loadJSON(w.meta || ((MEDIA_BASE.works||'works') + '/' + w.id + '/meta.json')).then(function (meta) {
        w.tagline = meta.tagline || w.tagline || '';
        if (Array.isArray(meta.tags) && meta.tags.length) w.tags = meta.tags;
        else if (meta.category && !tagsOf(w).length) w.tags = [meta.category];
        if (!dateOf(w) && meta.date) w.date = meta.date;
        w.description = meta.description || '';
          if (Array.isArray(meta.links) && meta.links.length) w.links = meta.links.filter(function (l) { return l && (l.href || l.text); });
          else if (meta.link && (meta.link.href || '').trim()) w.links = [meta.link];
        w.gallery = meta.gallery || w.gallery || [];
        w.updated = meta.updated || '';
        paint(works, i, w);
      }).catch(function () { paint(works, i, w); });
    }).catch(function (e) { fail('#work-body', e); });
  }

  function paint(works, i, w) {
    var base = (MEDIA_BASE.works || 'works') + '/' + w.id + '/';
    // 详情页只显示「细节图」，封面仅用于列表/轮播；没有任何细节图时退回封面，避免空白
    var shots = (w.gallery || []).filter(Boolean);
    if (!shots.length && w.cover) shots = [w.cover];
    var prev = works[i - 1], next = works[i + 1];
    document.title = w.title + ' — VVXIE ART';

    var tl = (w.tagline || '').trim();
    var desc = (w.description || '').trim();
    var tags = tagsOf(w);
    var tlHtml = tl ? '<div class="tagline">' + esc(tl) + '</div>' : '';
    var descHtml = desc && desc !== tl ? '<div class="desc">' + esc(desc) + '</div>' : '';

    $('#work-body').innerHTML =
      '<div class="detail-top">' +
        '<a class="back-link" href="works.html">← 返回作品</a>' +
      '</div>' +
      '<div class="detail-layout">' +
        '<div class="detail-gallery">' +
          shots.map(function (s, n) {
            return '<button type="button" class="shot" data-i="' + n + '" aria-label="查看大图">' +
              '<img src="' + esc(url(base + s)) + '" alt="' + esc(w.title) + (n ? ' — 细节 ' + n : '') + '" loading="' + (n ? 'lazy' : 'eager') + '">' +
            '</button>';
          }).join('') +
        '</div>' +
          (function () {
            var lk = (Array.isArray(w.links) && w.links.length) ? w.links : (w.link ? [w.link] : []);
            return lk.filter(function (l) { return l && (l.href || '').trim(); }).map(function (l) {
              return '<a class="detail-link only-narrow" href="' + esc(l.href) + '" target="_blank" rel="noopener">' + esc(l.text || l.href) + '</a>';
            }).join('');
          })() +
        '<aside class="detail-info">' +
          '<h1>' + esc(w.title) + '</h1>' +
          tlHtml +
          descHtml +
            '<div class="info-row info-inline">' +
              '<span class="k">标签</span>' +
              '<span class="info-tags">' + (tags.length ? tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') : '—') + '</span>' +
              '<span class="info-year">' + esc(yearOf(w) || '—') + '</span>' +
            '</div>' +
          (function () {
            var lk = (Array.isArray(w.links) && w.links.length) ? w.links : (w.link ? [w.link] : []);
            return lk.filter(function (l) { return l && (l.href || '').trim(); }).map(function (l) {
              return '<a class="detail-link only-wide" href="' + esc(l.href) + '" target="_blank" rel="noopener">' + esc(l.text || l.href) + '</a>';
            }).join('');
          })() +
          '<div class="detail-pager">' +
            (prev ? '<a href="work.html?id=' + encodeURIComponent(prev.id) + '" title="' + esc(prev.title) + '">← 上一件</a>' : '<button disabled>← 上一件</button>') +
            (next ? '<a href="work.html?id=' + encodeURIComponent(next.id) + '" title="' + esc(next.title) + '">下一件 →</a>' : '<button disabled>下一件 →</button>') +
          '</div>' +
        '</aside>' +
      '</div>';
    decorateImages($('#work-body')); $$('img', $('#work-body')).forEach(function (im) { imgErr(im, 'assets/placeholder.svg'); });
    initGalleryZoom($('#work-body'));
  }

  /* ---------------- 笔记列表 ---------------- */
  function noteCard(n) {
    var tags = Array.isArray(n.tags) ? n.tags.filter(Boolean) : [];
    var meta = (n.pinned ? '<span class="pin-mark">置顶</span>' : '') +
      esc(when(n.date)) + (tags.length ? ' · ' + esc(tags.join(' · ')) : '');
    var cover = n.cover ? '<img class="note-cover" src="' + esc(mediaUrl('notes', n.id, n.cover)) + '" alt="" loading="lazy">' : '';
    return '<a class="note-card' + (n.pinned ? ' is-pinned' : '') + (cover ? ' has-cover' : '') + '" href="note.html?id=' + encodeURIComponent(n.id) + '">' +
      cover +
      '<div class="note-text">' +
        '<div class="note-date">' + meta + '</div>' +
        '<h2>' + esc(n.title) + '</h2>' +
        '<p>' + esc(firstSentence(n.body)) + '</p>' +
      '</div></a>';
  }
  function initNotes() {
  loadJSON('data/notes.json').then(function (data) { setMediaBase('notes', data);
      var notes = data.notes || [];
      var grid = $('#notes-grid');
      if (!notes.length) { grid.innerHTML = '<div class="empty">还没有发布的笔记。</div>'; return; }
      // 索引里没写 tags 的，去读各自的 meta.json 补上（笔记数量不多，值得读）
      var jobs = notes.filter(function (n) { return !Array.isArray(n.tags) && n.meta; }).map(function (n) {
        return loadJSON(n.meta).then(function (m) {
          if (Array.isArray(m.tags)) n.tags = m.tags.filter(Boolean);
        }).catch(function () {});
      });
      Promise.all(jobs).then(start).catch(start);
      function start() {
        buildFilterPanel($('#note-filters'), grid, $('#notes-empty'), notes, {
          tagsOf: function (n) { return Array.isArray(n.tags) ? n.tags : []; },
          yearOf: function (n) { var d = dateOf(n); return d ? d.slice(0, 4) : ''; },
            // 置顶的先排（不限数量），每块内部仍按日期新的在前
            sort: function (a, b) { return ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || byDateDesc(a, b); },
            groupOf: function (n) { return n.pinned ? 'pin' : 'rest'; },
            sep: '<div class="note-sep" aria-hidden="true"></div>',
            render: noteCard
        })();
        decorateImages(document);
      }
    }).catch(function (e) { fail('#notes-grid', e); });
  }

  /* ---------------- 笔记详情 ---------------- */
    /* 笔记正文：优先用富文本 content.html，其次回落到 markdown */
    var RICH_TAGS = { P:1, H1:1, H2:1, H3:1, H4:1, BLOCKQUOTE:1, UL:1, OL:1, LI:1, STRONG:1, B:1, EM:1, I:1, U:1,
      A:1, BR:1, IMG:1, VIDEO:1, IFRAME:1, SOURCE:1, FIGURE:1, FIGCAPTION:1, SPAN:1, DIV:1, HR:1,
        TABLE:1, THEAD:1, TBODY:1, TR:1, TD:1, TH:1 };
    function sanitizeRich(html) {
      var box = document.createElement('div');
      box.innerHTML = String(html || '');
      (function walk(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
          if (ch.nodeType === 3) return;
          if (ch.nodeType !== 1) { node.removeChild(ch); return; }
          var tag = ch.tagName.toUpperCase();
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'OBJECT' || tag === 'LINK' || tag === 'META') {
            node.removeChild(ch); return;
          }
          walk(ch);
          if (!RICH_TAGS[tag]) {
            var frag = document.createDocumentFragment();
            while (ch.firstChild) frag.appendChild(ch.firstChild);
            node.replaceChild(frag, ch);
            return;
          }
          function renameKeep(el, name){
            var n2 = document.createElement(name);
            n2.innerHTML = el.innerHTML;
            Array.prototype.slice.call(el.attributes).forEach(function (a) { n2.setAttribute(a.name, a.value); });
            el.replaceWith(n2);
            return n2;
          }
          if (tag === 'B') { ch = renameKeep(ch, 'strong'); }
          else if (tag === 'I') { ch = renameKeep(ch, 'em'); }
          else if (tag === 'H1') { ch = renameKeep(ch, 'h2'); }
          else if (tag === 'H4') { ch = renameKeep(ch, 'h3'); }

          var st = ch.getAttribute('style') || '';
          var ta = (st.match(/text-align\s*:\s*(left|center|right|justify)/i) || [])[1];
          var fc = (st.match(/color\s*:\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\))/i) || [])[1];
          var fs = (st.match(/font-size\s*:\s*(\d{1,2}(?:\.\d+)?px)/i) || [])[1];
        var ti = (st.match(/text-indent\s*:\s*(-?\d{1,3}px)/i) || [])[1];
        var pl = (st.match(/padding-left\s*:\s*(\d{1,3}px)/i) || [])[1];
          var href = tag === 'A' ? (ch.getAttribute('href') || '') : '';
          var src = tag === 'IMG' ? (ch.getAttribute('src') || '') : '';
            var vsrc = (tag === 'VIDEO' || tag === 'SOURCE' || tag === 'IFRAME') ? (ch.getAttribute('src') || '') : '';
            if (vsrc && /^\/\//.test(vsrc)) vsrc = 'https:' + vsrc;
            if (vsrc && /^http:\/\//i.test(vsrc)) vsrc = vsrc.replace(/^http:/i, 'https:');
            var poster = tag === 'VIDEO' ? (ch.getAttribute('poster') || '') : '';
            var vtype = tag === 'SOURCE' ? (ch.getAttribute('type') || '') : '';
            var vFlags = tag === 'VIDEO' ? { loop: ch.hasAttribute('loop'), muted: ch.hasAttribute('muted'), autoplay: ch.hasAttribute('autoplay') } : null;
            var dcls = tag === 'DIV' ? (ch.getAttribute('class') || '') : '';
          var cls = tag === 'FIGURE'
            ? (ch.getAttribute('class') || '').split(/\s+/).filter(function (c) {
                return /^(fig-(25|50|75|100)|al-(left|center|right))$/.test(c);
              })
            : [];
          if (tag === 'IMG' && !/^(data:image\/|https?:\/\/|img\/)/i.test(src)) { node.removeChild(ch); return; }
            if (tag === 'VIDEO' && vsrc && !/^(data:video\/|https?:\/\/|video\/)/i.test(vsrc)) { node.removeChild(ch); return; }
            if (tag === 'SOURCE' && !/^(data:video\/|https?:\/\/|video\/)/i.test(vsrc)) { node.removeChild(ch); return; }
          Array.prototype.slice.call(ch.attributes).forEach(function (a) { ch.removeAttribute(a.name); });
        var keepStyle = [ta ? 'text-align:' + ta.toLowerCase() : '', fc ? 'color:' + fc : '', fs ? 'font-size:' + fs : '', ti ? 'text-indent:' + ti : '', pl ? 'padding-left:' + pl : ''].filter(Boolean).join(';');
          if (keepStyle) ch.setAttribute('style', keepStyle);
          if (tag === 'A' && /^(https?:\/\/|mailto:|\/|\.\/|#)/i.test(href)) {
            ch.setAttribute('href', href);
            if (/^https?:/i.test(href)) { ch.setAttribute('target', '_blank'); ch.setAttribute('rel', 'noopener'); }
          }
          if (tag === 'IMG') ch.setAttribute('src', src);
            if (tag === 'VIDEO') {
              if (vsrc) ch.setAttribute('src', vsrc);
              ch.setAttribute('controls', '');
              ch.setAttribute('playsinline', '');
              ch.setAttribute('preload', 'metadata');
              if (poster) ch.setAttribute('poster', poster);
              if (vFlags.loop) ch.setAttribute('loop', '');
              if (vFlags.muted) ch.setAttribute('muted', '');
            }
            if (tag === 'SOURCE') { ch.setAttribute('src', vsrc); if (/^video\//i.test(vtype)) ch.setAttribute('type', vtype); }
          if (tag === 'FIGURE') {
            if (!cls.some(function (c) { return c.indexOf('fig-') === 0; })) cls.push('fig-100');
            if (!cls.some(function (c) { return c.indexOf('al-') === 0; })) cls.push('al-left');
            var fTa = ((ch.getAttribute('style') || '').match(/text-align\s*:\s*(left|center|right|justify)/i) || [])[1];
            ch.setAttribute('class', cls.join(' '));
            if (fTa) ch.setAttribute('style', 'text-align:' + fTa.toLowerCase());
          }
            if (tag === 'IFRAME') {
              /* 只放行白名单域名的 https 播放器 */
              var IFRAME_OK=/(^|\.)(bilibili\.com|youtube\.com|youtu\.be|vimeo\.com|youku\.com|qq\.com|ixigua\.com|douyin\.com|weibo\.com|acfun\.cn)$/i;
              var host = '';
              try { var uu = new URL(vsrc); host = uu.hostname; if (uu.protocol !== 'https:') host = ''; } catch (e) { host = ''; }
              if (!host || !IFRAME_OK.test(host)) { node.removeChild(ch); return; }
              ch.setAttribute('src', vsrc);
              ch.setAttribute('allowfullscreen', '');
              ch.setAttribute('frameborder', '0');
              ch.setAttribute('scrolling', 'no');
              ch.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture');
            }
            if (tag === 'DIV' && /(^|\s)video-embed(\s|$)/.test(dcls)) {
              ch.setAttribute('class', 'video-embed');
            }
            if (tag === 'DIV' && /(^|\s)img-row(\s|$)/.test(dcls)) {
              ch.setAttribute('class', 'img-row');
            }
        });
      })(box);
      return box.innerHTML;
    }

  function initNote() {
    var id = param('id');
  loadJSON('data/notes.json').then(function (data) { setMediaBase('notes', data);
      var notes = data.notes || [];
      if (!notes.length) { fail('#note-body', new Error('empty')); return; }
      var i = notes.map(function (n) { return n.id; }).indexOf(id);
      if (i < 0) i = 0;
      var n = notes[i];
      var base = 'notes/' + n.id + '/';
      document.title = n.title + ' — VVXIE ART';

      var metaP = n.meta ? loadJSON(n.meta).catch(function(){ return {}; }) : Promise.resolve({});
      var mdP = n.content ? loadText(n.content).catch(function(){ return n.body || ''; }) : Promise.resolve(n.body || '');
      var htmlP = n.html ? loadText(n.html).catch(function(){ return ''; }) : Promise.resolve('');

      Promise.all([metaP, mdP, htmlP]).then(function (r) {
        var meta = r[0] || {}, md = r[1], richHtml = r[2] || '';
        var imgs = (meta.images || []).concat(n.images || []);
        var title = meta.title || n.title;
        var noteTags = (Array.isArray(meta.tags) && meta.tags.length ? meta.tags : (n.tags || [])).filter(Boolean);
        // 正文若以 # 开头，标题由 Markdown 自己给出，避免重复显示
        var startsWithHeading = /^\s*#\s+\S/.test(String(md || ''));
        var mdHtml = renderMarkdown(md, base);
        var bodyHtml;
        if (richHtml) {
          // 富文本笔记：标题永远是 data 里的标题，正文用清洗过的 HTML
      /* 旧内容里常见「figure 套 figure」「图注写成 figure」，间距忽大忽小就是它；
         这里在渲染前统一整理成 figure > img + figcaption（不改文件） */
      /* 只修「正文被误塞进图注」这种坏结构：没有图片/视频的 figure 拆回 <p> */
      function repairFigures(root) {
        if (!root) return;
        Array.prototype.slice.call(root.querySelectorAll('figcaption')).forEach(function (c) {
          var txt = (c.textContent || '').trim();
          var fig = c.closest('figure');
          if (!txt) { c.remove(); return; }
          if (txt.length > 40) {
            var p2 = document.createElement('p');
            p2.innerHTML = c.innerHTML;
            if (fig) fig.parentNode.insertBefore(p2, fig.nextSibling); else c.replaceWith(p2);
            c.remove();
          }
        });
        /* 标题太长其实是段落（Word 导入常见）→ 转回 <p>，与编辑器一致 */
        Array.prototype.slice.call(root.querySelectorAll('h2,h3')).forEach(function (h) {
          if ((h.textContent || '').trim().length <= 40) return;
          var ph = document.createElement('p');
          ph.innerHTML = h.innerHTML;
          if (h.getAttribute('style')) ph.setAttribute('style', h.getAttribute('style'));
          if (h.getAttribute('class')) ph.setAttribute('class', h.getAttribute('class'));
          h.parentNode.replaceChild(ph, h);
        });
        /* 裸文字没有块级祖先，text-align 无处落点 → 包成段落 */
        Array.prototype.slice.call(root.childNodes).forEach(function (n) {
          if (n.nodeType === 3) {
            if (!n.textContent.trim()) { n.remove(); return; }
            var p = document.createElement('p');
            root.insertBefore(p, n);
            p.appendChild(n);
          }
        });
        /* 图片和文字彻底分开：段落里不许出现块级元素/裸图片，图块里不许有正文，图块不套图块 */
        var RT_BLOCK = /^(FIGURE|DIV|UL|OL|TABLE|P|H1|H2|H3|H4|BLOCKQUOTE)$/;
        Array.prototype.slice.call(root.querySelectorAll('figure')).forEach(function (fig) {
          var out = [];
          Array.prototype.slice.call(fig.childNodes).forEach(function (n) {
            if (n.nodeType === 3) { if (n.textContent.trim()) out.push(n); else n.remove(); return; }
            if (n.nodeType !== 1) { n.remove(); return; }
            if (/^(IMG|VIDEO|IFRAME|SOURCE|FIGCAPTION)$/.test(n.tagName)) return;
            out.push(n);
          });
          if (out.length) {
            var pOut = document.createElement('p');
            out.forEach(function (n) { pOut.appendChild(n); });
            fig.parentNode.insertBefore(pOut, fig.nextSibling);
          }
        });
        Array.prototype.slice.call(root.querySelectorAll('figure')).reverse().forEach(function (fig) {
          Array.prototype.slice.call(fig.children).forEach(function (c) {
            if (c.tagName === 'FIGURE') fig.parentNode.insertBefore(c, fig.nextSibling);
          });
        });
        Array.prototype.slice.call(root.querySelectorAll('p,li,h2,h3,h4,blockquote')).forEach(function (block) {
          var bad = Array.prototype.slice.call(block.childNodes).filter(function (n) {
            if (n.nodeType !== 1) return false;
            return n.tagName === 'IMG' || RT_BLOCK.test(n.tagName);
          });
          if (!bad.length) return;
          var par = block.parentNode;
          if (!par) return;
          var tag = block.tagName.toLowerCase();
          var buf = [], seq = [];
          function flush() {
            var has = buf.some(function (n) { return n.nodeType === 1 || n.textContent.trim(); });
            if (has) {
              var p2 = document.createElement(tag);
              var st = block.getAttribute('style');
              if (st) p2.setAttribute('style', st);
              buf.forEach(function (n) { p2.appendChild(n); });
              seq.push(p2);
            }
            buf = [];
          }
          Array.prototype.slice.call(block.childNodes).forEach(function (n) {
            var isBlock = n.nodeType === 1 && (n.tagName === 'IMG' || RT_BLOCK.test(n.tagName));
            if (!isBlock) { buf.push(n); return; }
            flush();
            if (n.tagName === 'IMG') {
              var fg = document.createElement('figure');
              fg.className = 'fig-100 al-left';
              fg.appendChild(n);
              seq.push(fg);
            } else {
              seq.push(n);
            }
          });
          flush();
          seq.forEach(function (el) { par.insertBefore(el, block); });
          block.remove();
        });
        /* 并排图容器里只留图片 */
        Array.prototype.slice.call(root.querySelectorAll('.img-row')).forEach(function (row) {
          Array.prototype.slice.call(row.children).forEach(function (c) {
            if (c.tagName === 'IMG') return;
            if (c.tagName === 'BR') { c.remove(); return; }
            row.parentNode.insertBefore(c, row.nextSibling);
          });
          if (!row.querySelector('img')) row.remove();
        });
        /* WPS/Word 粘来的内容常被 div 包着，块间距会算不准；这里拆掉，只留并排图和视频容器 */
        Array.prototype.slice.call(root.querySelectorAll('div')).forEach(function (d) {
          var cls = d.getAttribute('class') || '';
          if (/(^|\s)(img-row|video-embed)(\s|$)/.test(cls)) return;
          var par = d.parentNode;
          while (d.firstChild) par.insertBefore(d.firstChild, d);
          d.remove();
        Array.prototype.slice.call(root.children).forEach(function (n) { if (n.tagName === 'BR') n.remove(); });
        });
        /* 图片块里不该有正文：把 img/video/iframe/figcaption 之外的内容挪到图后面 */
        Array.prototype.slice.call(root.querySelectorAll('figure')).forEach(function (fig) {
          var out = [];
          Array.prototype.slice.call(fig.childNodes).forEach(function (n) {
            if (n.nodeType === 3) { if (n.textContent.trim()) out.push(n); else n.remove(); return; }
            if (n.nodeType !== 1) { n.remove(); return; }
            var t = n.tagName;
            if (t === 'IMG' || t === 'VIDEO' || t === 'IFRAME' || t === 'SOURCE' || t === 'FIGCAPTION') return;
            out.push(n);
          });
          if (!out.length) return;
          var p3 = document.createElement('p');
          out.forEach(function (n) { p3.appendChild(n); });
          fig.parentNode.insertBefore(p3, fig.nextSibling);
        });
        Array.prototype.slice.call(root.querySelectorAll('figure')).reverse().forEach(function (fig) {
          if (fig.querySelector('img,video,iframe')) return;
          Array.prototype.slice.call(fig.querySelectorAll('figcaption')).forEach(function (c) {
            while (c.firstChild) c.parentNode.insertBefore(c.firstChild, c);
            c.remove();
          });
          var p = document.createElement('p');
          p.innerHTML = fig.innerHTML;
          var st = (fig.getAttribute('style') || '').match(/text-align\s*:\s*(left|center|right)/i);
          var am = (fig.getAttribute('class') || '').match(/al-(left|center|right)/);
          if (st) p.setAttribute('style', 'text-align:' + st[1].toLowerCase());
          else if (am && am[1] !== 'left') p.setAttribute('style', 'text-align:' + am[1]);
          fig.replaceWith(p);
        });
      }
          var rich = sanitizeRich(richHtml);
          { var _pb = document.createElement('div'); _pb.innerHTML = rich; repairFigures(_pb); rich = _pb.innerHTML; }
          startsWithHeading = false;   // 富文本：标题照常显示（正文里重名的第一个标题已去掉）
          var probe0=document.createElement('div'); probe0.innerHTML=rich;
          var first0=probe0.firstElementChild;
          if(first0&&/^H[23]$/.test(first0.tagName)&&first0.textContent.trim()===String(title).trim()) first0.remove();
          $$('img,video,source',probe0).forEach(function(im){
            var s=im.getAttribute('src')||'';
            if(s && !/^(https?:|data:|blob:|\/)/i.test(s)) im.setAttribute('src', url(base + s));
          });
          bodyHtml = '<div class="note-rich">' + probe0.innerHTML + '</div>';
        } else {
          bodyHtml = '<div class="note-body">' + mdHtml + '</div>';
        }
        if (startsWithHeading && !richHtml) {
          var m = mdHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
          if (m) {
            var probe = document.createElement('div');
            probe.innerHTML = m[1];
            title = probe.textContent.trim() || title;
          }
        }
        document.title = title + ' — VVXIE ART';
        $('#note-body').innerHTML =
          '<div class="detail-top">' +
            '<a class="back-link" href="notes.html">← 返回笔记</a>' +
          '</div>' +
          '<div class="note-detail-layout">' +
            '<article class="note-article">' +
              '<div class="note-date">' + esc(when(meta.date || n.date)) +
                (noteTags.length ? ' · ' + esc(noteTags.join(' · ')) : '') + '</div>' +
              (startsWithHeading ? '' : '<h1>' + esc(title) + '</h1>') +
              bodyHtml +
            '</article>' +
          '</div>';
    decorateImages($('#note-body')); $$('img', $('#note-body')).forEach(function (im) { imgErr(im, 'assets/placeholder.svg'); });
      });
    }).catch(function (e) { fail('#note-body', e); });
  }

  /* ---------------- 关于 ---------------- */
  var ICON_SET = ['link','web','mail','github','x','weibo','bilibili','wechat','xhs','instagram','pixiv','behance','mailchimp','play','music','shopping','download','star'];
  function iconSvg(name) {
    var id = String(name || '').replace(/^i-/, '');
    if (ICON_SET.indexOf(id) < 0) id = 'link';
    return '<svg class="ico" aria-hidden="true" focusable="false"><use href="#i-' + id + '"></use></svg>';
  }
  function safeHref(u) { return /^(https?:|mailto:)/i.test(String(u || '')) ? String(u) : '' }

  function initAbout() {
    loadJSON('data/about.json').then(function (a) {
      document.title = (a.aboutHeading || '关于我') + ' — VVXIE ART';
      var rows = [];
      (a.links || []).forEach(function (l) {
        if (!l) return;
        var href = safeHref(l.url || l.href) || '';
        var name = l.label || l.name || l.url || l.href || '';
        // 只填了名字、没填链接的也照样显示，只是不可点
        if (!href && !name) return;
        rows.push({
          icon: l.icon || 'link',
          iconData: l.iconData || '',          // 工具里上传的自定义图标
          label: name, url: href,
          external: /^https?:/i.test(href)
        });
      });

      // 传送门：100×100 方框，正面图标、悬停翻面显示文字
      var linksHtml = rows.length
        ? '<div class="link-grid">' +
            rows.map(function (r) {
              var face = r.iconData
                ? '<img class="ico-img" src="' + esc(r.iconData) + '" alt="">'
                : iconSvg(r.icon);
              var inner =
                '<span class="link-inner">' +
                  '<span class="link-face front">' + face + '</span>' +
                  '<span class="link-face back">' + esc(r.label) + '</span>' +
                '</span>';
              return r.url
                ? '<a class="link-cell" href="' + esc(r.url) + '"' + (r.external ? ' target="_blank" rel="noopener"' : '') +
                    ' aria-label="' + esc(r.label) + '">' + inner + '</a>'
                : '<span class="link-cell is-plain" aria-label="' + esc(r.label) + '">' + inner + '</span>';
            }).join('') +
          '</div>'
        : '';

      // 照片墙
      var pics = (a.images || []).filter(Boolean);
      var galleryHtml = pics.length
        ? '<div class="about-gallery" data-pending="' + pics.length + '">' +
            pics.map(function (n, i) {
              return '<img src="' + esc(url('about/' + n)) + '" alt="" loading="' + (i ? 'lazy' : 'eager') + '">';
            }).join('') +
          '</div>'
        : '';

      // 左边：头像 + 名字 + 介绍；右边：传送门（+ 照片墙）
      $('#about-body').innerHTML =
        '<div class="about-page">' +
          '<div class="about-left">' +
            (a.avatar ? '<img class="about-avatar" src="' + esc(url(a.avatar)) + '" alt="头像">' : '') +
            '<h1 class="about-name">' + esc(a.aboutHeading || '关于我') + '</h1>' +
            (a.aboutText ? '<div class="about-text">' + esc(String(a.aboutText)) + '</div>' : '') +
          '</div>' +
          '<div class="about-right">' + linksHtml + galleryHtml + '</div>' +
        '</div>';

      // 触屏：第一次点只翻面，再点一次才进入链接
      $$('.link-cell', $('#about-body')).forEach(function (a) {
        a.addEventListener('click', function (e) {
          if (!a.classList.contains('is-flipped')) {
            e.preventDefault();
            $$('.link-cell.is-flipped').forEach(function (x) { x.classList.remove('is-flipped') });
            a.classList.add('is-flipped');
          }
        });
      });

      var av = $('.about-avatar');
      if (av) imgErr(av, 'assets/placeholder.svg');
    decorateImages(document.getElementById('about') || document);
      initAboutGallery();
    }).catch(function (e) { fail('#about-body', e); });
  }
  /* 照片墙：一张都加载不出来就整块隐藏（不留空占位） */
  function initAboutGallery() {
    var box = $('.about-gallery');
    if (!box) return;
    var imgs = $$('img', box);
    var left = imgs.length;
    function settle() {
      if (--left > 0) return;
      if (!box.querySelector('img')) box.remove();
    }
    imgs.forEach(function (im) {
      if (im.complete && im.naturalWidth) return;          // 已缓存且成功
      if (im.complete && !im.naturalWidth) { im.remove(); settle(); return; }
      im.addEventListener('load', settle);
      im.addEventListener('error', function () { im.remove(); settle() });
    });
  }


  /* ---------------- 全图查看（作品详情的图片点开看大图） ---------------- */
  function ensureLightbox() {
    var box = document.getElementById('lightbox');
    if (box) return box;
    box = document.createElement('div');
    box.id = 'lightbox';
    box.className = 'lightbox';
    box.innerHTML =
      '<button class="lightbox-btn lightbox-prev" type="button" aria-label="上一张">←</button>' +
      '<img class="lightbox-img" alt="">' +
      '<button class="lightbox-btn lightbox-next" type="button" aria-label="下一张">→</button>' +
      '<button class="lightbox-close" type="button" aria-label="关闭">×</button>' +
      '<span class="lightbox-count"></span>';
    document.body.appendChild(box);
    return box;
  }
  function initGalleryZoom(scope) {
    var shots = $$('.shot', scope);
    if (!shots.length) return;
    var box = ensureLightbox();
    var big = $('.lightbox-img', box), count = $('.lightbox-count', box);
    var idx = 0;

    function paint() {
      var img = $('img', shots[idx]);
      big.src = img.src;
      big.alt = img.alt || '';
      count.textContent = shots.length > 1 ? (idx + 1) + ' / ' + shots.length : '';
    }
    function open(i) {
      idx = i;
      paint();
      box.classList.add('on');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      box.classList.remove('on');
      document.body.style.overflow = '';
      big.removeAttribute('src');       // 关掉就释放大图
    }
    function step(d) {
      idx = (idx + d + shots.length) % shots.length;
      paint();
    }

    shots.forEach(function (b, i) {
      b.addEventListener('click', function () { open(i) });
    });
    $('.lightbox-prev', box).onclick = function (e) { e.stopPropagation(); step(-1) };
    $('.lightbox-next', box).onclick = function (e) { e.stopPropagation(); step(1) };
    $('.lightbox-close', box).onclick = function (e) { e.stopPropagation(); close() };
    box.onclick = function (e) {
      if (e.target === box || e.target === big) close();   // 点背景或图片本身关闭
    };
    document.addEventListener('keydown', function (e) {
      if (!box.classList.contains('on')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    });
  }

  /* ---------------- 通用 ---------------- */
  function fail(sel, err) {
    var el = $(sel);
    var msg = '内容加载失败：' + (err && err.message ? err.message : err);
    if (el) el.innerHTML = '<div class="empty">' + esc(msg) + '<br>请确认 data/ 目录里的 JSON 存在，并且是通过 http(s) 打开的（本地请用本地服务器）。</div>';
    if (window.console) console.warn('[VVXIE]', msg);
  }

  /* ---------------- 进站 LOGO 动画 ----------------
     仅在“真正进站”时播放：
       · 直接打开 / 输入网址 / 从外部链接进入 / 刷新 → 播放
       · 站内点击链接切换页面（含浏览器前进后退）    → 不播放
     sessionStorage 作为老浏览器的兜底：同一标签页内只播一次。 */
  var INTRO_KEY = 'vvxie_intro_seen';
  function introShouldPlay() {
    var type = '';
    try {
      var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      type = (nav && nav.type) || (performance.navigation && performance.navigation.type === 1 ? 'reload' : '');
    } catch (e) { type = '' }
    if (type === 'reload') return true;       // 刷新：播放
    if (type === 'back_forward') return false; // 前进/后退：跳过
    if (type === 'navigate') {
      // 站内链接跳转也会报 navigate，用同一会话标记区分
      try { return sessionStorage.getItem(INTRO_KEY) !== '1' } catch (e) { return true }
    }
    try { return sessionStorage.getItem(INTRO_KEY) !== '1' } catch (e) { return true }
  }
  /* ==========================================================================
     进场画面（LOGO 动画）—— 整体设计
     --------------------------------------------------------------------------
     1) 要不要播：只有「首次打开 / 刷新」才播，站内跳转和前进后退都跳过
        （判断依据是 performance.navigation.type + sessionStorage，见 introShouldPlay）。
     2) 画面从哪来：优先 fetch assets/logo.svg 内联进来（纯路径几何，
        不受字体、设备、排版引擎影响）；260ms 内没拿到就退回文字版，绝不让进场卡住。
     3) 尺寸怎么定：读 SVG 里字母的真实包围盒，反推出「让字高 = 0.768em」需要的 SVG 高度，
        所以在 Illustrator 里改形状/改 viewBox 都不用回来改数值。
     4) 动画怎么挂：JS 只负责注入 + 给每个字写 --i / --r（出场序号、倾斜角度），
        真正的 keyframes 全在 style.css（introLetterSvg / introRuleSvg / introSheenSvg）。
     5) 什么时候消失：读最后一个字的 animation-delay + duration，再停 620ms 才淡出。
     ========================================================================== */
  function initIntro() {
    if (document.getElementById('intro')) return;
    if (!introShouldPlay()) return;
    try { sessionStorage.setItem(INTRO_KEY, '1') } catch (e) {}

    /* ---------- 画面：优先用 SVG 版（不受字体度量影响） ---------- */
    var box = document.createElement('div');
    box.className = 'intro-screen';
    box.id = 'intro';
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = '<div class="intro-frame"></div>';
    document.body.appendChild(box);

    var frame = box.querySelector('.intro-frame');
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* 文字版：SVG 拿不到时的降级方案（也用 Lot 之外的字体，纯 CSS 动画）。
       注意它是「单行内联排版」，点靠基线对齐，不依赖任何度量补偿。 */
    function buildText() {
      frame.innerHTML =
        '<i class="intro-rule"></i>' +
        '<div class="intro-mark">' +
          words.map(function (ch) { return '<span' + (ch === '.' ? ' class="intro-dot"' : '') + '>' + ch + '</span>' }).join('') +
        '</div>' +
        '<i class="intro-rule"></i>';
    }

    /* SVG 版：把 svg 直接内联进 DOM（不是 <img>，否则没法逐字控制动画）。
       返回 true 表示成功接管画面；返回 false 会让调用方退回文字版。 */
    function buildSvg(svgText) {
      frame.innerHTML = svgText;
      var svg = frame.querySelector('svg');
      if (!svg) return false;
      svg.classList.add('intro-logo');
      svg.removeAttribute('width');
      svg.removeAttribute('height');

      var letters = svg.querySelector('#letters') || svg;
      var paths = letters.querySelectorAll('path');
      if (!paths.length) return false;

      /* 色值统一走 CSS（currentColor） */
      svg.setAttribute('fill', 'currentColor');

      /* 尺寸：让字母墨迹高度 = 与文字版相同的字高（0.768em） */
      var fs = parseFloat(window.getComputedStyle(frame).fontSize) || 56;
      var targetCap = fs * 0.768;
      var vb = svg.viewBox && svg.viewBox.baseVal;
      var bb;
      try { bb = letters.getBBox(); } catch (e) { bb = null }
      if (bb && bb.height > 0 && vb && vb.height > 0) {
        svg.style.height = (targetCap * vb.height / bb.height) + 'px';
        svg.style.setProperty('--u', bb.height + 'px');       /* 出场偏移基准 */
      }

      /* 每个字的入场倾斜角度，循环取用；--i 是出场序号（CSS 里按它算 delay）。
         换设计、加字都不用改这里 —— 有几个 path 就排几个队。 */
      var tilts = [-5, 4, -3, 5, -4, 2, -3, 3];
      [].forEach.call(paths, function (p, i) {
        p.style.setProperty('--i', i);
        p.style.setProperty('--r', (tilts[i % tilts.length]) + 'deg');
      });

      /* 上下线也走 --i（0 上线 / 1 下线），动画基准同文字版 */
      var rules = svg.querySelectorAll('#rule-top,#rule-bottom');
      [].forEach.call(rules, function (l, i) { l.style.setProperty('--i', i) });
      return true;
    }
    /* 高光：SVG 版自带（logo.svg 里的 #sheen-bar 被字母形状裁住，只在笔画上扫），
       文字版才需要这里补一个元素，塞进 .intro-mark 里靠 overflow:hidden 裁住。 */
    function addSheen() {
      if (reduced) return;
      if (frame.querySelector('svg.intro-logo')) return;   /* SVG 版自带高光 */
      var mark = frame.querySelector('.intro-mark');
      if (!mark) return;
      var sh = document.createElement('i');
      sh.className = 'intro-sheen';
      sh.setAttribute('aria-hidden', 'true');
      mark.appendChild(sh);
    }

    /* 统一入口：有 SVG 就上 SVG，失败退回文字版；然后补高光、启动淡出计时。
       注意动画本身不需要这里触发 —— 元素一进 DOM，CSS 动画就自己跑了。 */
    function start(svgText) {
      var ok = false;
      if (svgText) { try { ok = buildSvg(svgText) } catch (e) { ok = false } }
      if (!ok) buildText();
      addSheen();
      tick();
    }

    var hold = reduced ? 500 : 2600;
    var gone = false, autoTimer = null;
    /* 淡出计时。「最后一个字」的动画结束时刻 = animation-delay + animation-duration，
       再加 620ms（字落位后多停半秒），到点开始淡出。
       同时挂一个 animationend 监听作为更精确的触发（两个谁先到用谁，finish 有幂等保护）。
       万一读不到时长（老浏览器、动画被禁用），外层还有 hold 兜底。 */
    function tick() {
      if (reduced) { autoTimer = setTimeout(function () { finish(false) }, hold); return }
      var spans = frame.querySelectorAll('.intro-logo [id^="ch-"], .intro-mark span');
      var lastLetter = spans[spans.length - 1];
      if (!lastLetter) { autoTimer = setTimeout(function () { finish(false) }, hold); return }
      var cs = window.getComputedStyle(lastLetter);
      var total = (parseFloat(cs.animationDelay) || 0) + (parseFloat(cs.animationDuration) || 0);
      autoTimer = setTimeout(function () { finish(false) }, Math.round(total * 1000) + 320);
      lastLetter.addEventListener('animationend', function () {
        setTimeout(function () { finish(false) }, 320);
      }, { once: true });
    }

    /* 结束进场。instant=true 是「用户点了/按了键」：立刻整个移除，不淡出；
       false 是自然结束：加 .intro-out 走 0.9s 淡出，再移除节点。 */
    function finish(instant) {
      if (gone) return;
      gone = true;
      clearTimeout(autoTimer);
      if (instant) {
        if (box.parentNode) box.parentNode.removeChild(box);
        return;
      }
      box.classList.add('intro-out');
      setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box) }, reduced ? 60 : 1000);
    }
    /* 跳过进场：点击、触摸、Esc/空格/回车都算。
       移除后紧跟的那一下 click 会落到下面的链接上，所以临时吞掉 click 事件 400ms。 */
    function skip(e) {
      if (e && e.cancelable && e.type !== 'keydown') e.preventDefault();
      finish(true);
      function swallow(ev) { ev.preventDefault(); ev.stopPropagation(); }
      document.addEventListener('click', swallow, true);
      setTimeout(function () { document.removeEventListener('click', swallow, true) }, 400);
    }
    box.addEventListener('pointerdown', skip);   // 手指按下即跳过（比 click 更快）
    box.addEventListener('click', skip);
    document.addEventListener('keydown', function (e) {
      if (gone) return;
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') skip(e);
    });

    /* 260ms 预算：SVG 是本地小文件，通常几毫秒就到；
       万一网络/磁盘慢，宁可先上文字版也不要让进场空着等。launch 只生效一次。 */
    var launched = false;
    function launch(svgText) {
      if (launched) return;
      launched = true;
      start(svgText);
    }
    var budget = setTimeout(function () { launch(null) }, 260);
    /* 用 force-cache：这个文件几乎不变，缓存住最省事。
       失败（file:// 打开、文件缺失）就走 catch → launch(null) → 文字版。 */
    fetch(url('assets/logo.svg'), { cache: 'force-cache' })
      .then(function (r) { if (!r.ok) throw new Error('http'); return r.text() })
      .then(function (txt) { clearTimeout(budget); launch(txt) })
      .catch(function () { clearTimeout(budget); launch(null) });
  }

  function initNav() {    var page = document.body.dataset.page || '';
    $$('.nav a').forEach(function (a) {
      if (a.dataset.page === page) a.classList.add('active');
    });
    // 顶部菜单始终显示，不做二级菜单
    var y = $('#year');
    if (y) y.textContent = new Date().getFullYear();
  }

  document.addEventListener('DOMContentLoaded', function () {
    initIntro();
    initNav();
    var page = document.body.dataset.page || '';
    ({
      home: initHome,
      works: initWorks,
      work: initWork,
      notes: initNotes,
      note: initNote,
      about: initAbout
    }[page] || function () {})();
  });

  // 方便调试
  window.VVXIE = { renderMarkdown: renderMarkdown, mdToHtml: mdToHtml, url: url };
})();
