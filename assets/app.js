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
  function mediaUrl(kind, id, name) {
    if (!name) return '';
    if (/^(data:|https?:)/i.test(name)) return name;
    return url((kind === 'notes' ? 'notes/' : 'works/') + id + '/' + name);
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
      .then(function (res) {
        buildCarousel(res[0].works || []);
      })
      .catch(function (e) { fail('#feature', e); });
  }

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

    host.innerHTML =
      '<div class="feature-copy"><div class="feature-text" id="feature-text">' +
        '<h1 id="feature-title"></h1><p id="feature-desc"></p>' +
      '</div></div>' +
      '<div class="feature-visual" id="feature-visual">' +
        '<a class="feature-frame" id="feature-frame" href="#">' +
          '<img class="feat-img on" alt=""><img class="feat-img" alt="">' +
        '</a>' +
        '<div class="feature-controls">' +
          '<button class="circle-btn" id="feature-prev" aria-label="上一件">←</button>' +
          '<div class="feature-dots" id="feature-dots"></div>' +
          '<button class="circle-btn" id="feature-next" aria-label="下一件">→</button>' +
        '</div>' +
      '</div>';

    var INTERVAL = 6000;                       // 每张停留时间（放慢）
    var idx = 0, timer = null, token = 0, cur = 0;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var title = $('#feature-title'), desc = $('#feature-desc'), text = $('#feature-text'),
        frame = $('#feature-frame'), layers = $$('.feat-img', frame),
          dots = $('#feature-dots');

    // 圆点只建一次，之后只切状态，不重建 DOM（避免闪动）
    dots.innerHTML = list.map(function (x, i) {
      return '<button class="feature-dot" type="button" data-i="' + i + '" aria-label="第 ' + (i + 1) + ' 件：' + esc(x.title) + '"></button>';
    }).join('');

    // 两张图叠在一起做交叉淡入：新图淡入的同时旧图淡出，不会闪白也不会跳
    function showImage(src, crop) {
      var next = layers[1 - cur];
      var my = ++token;
      function swap() {
        if (my !== token) return;
        applyFrameCrop(next, crop);
        // 关键：清掉回调，否则「缓存命中时同步 swap + 之后的 onload」会执行两次，
        // 把刚点亮的那层又熄灭，出现空白
        next.onload = null;
        next.onerror = null;
        next.classList.add('on');
        layers[cur].classList.remove('on');
        cur = 1 - cur;
      }
      next.onerror = function () { next.onerror = null; next.src = url('assets/placeholder.svg') };
      next.onload = swap;
      next.src = src;
      if (next.complete && next.naturalWidth) swap();
    }

    // 标题逐字拆成 span，每个字错开出现（重新赋值 innerHTML 会自动重播动画）
    function splitChars(s) {
      return Array.from(String(s == null ? '' : s)).map(function (ch, i) {
        return '<span class="ch" style="--i:' + i + '">' + (ch === ' ' ? '&nbsp;' : esc(ch)) + '</span>';
      }).join('');
    }
    var textGuard = null;
    function setText(w) {
      var line = w.tagline || w.summary || firstSentence(w.description) || '';
      var nChars = Array.from(String(w.title || '')).length;
      title.setAttribute('aria-label', w.title);      // 读屏仍然读整句
      title.innerHTML = splitChars(w.title);           // 新元素 → 动画自动从头播
      desc.textContent = line;
      desc.style.display = line ? '' : 'none';
      // 简介是同一个 <p>，不重建的话动画只播一次；这里手动重启
      desc.style.animation = 'none';
      void desc.offsetHeight;                          // 强制重排，让 none 生效
      desc.style.animation = '';
      // 安全网：最长一段动画是「逐字错开 + 0.9s 时长」，超时就强制显示
      text.classList.remove('chars-done');
      clearTimeout(textGuard);
      textGuard = setTimeout(function () { text.classList.add('chars-done') },
        Math.max(1800, nChars * 60 + 900 + 400));
    }
    function paint() {
      var w = list[idx];
      setText(w);
      var crop = w.carouselCrop || null;
      var heroImg = (crop && crop.src) || (w.gallery && w.gallery[0]) || w.image || w.cover;
      showImage(mediaUrl('works', w.id, heroImg) || url('assets/placeholder.svg'), crop);
      layers.forEach(function (im) { im.alt = w.title });
      frame.href = 'work.html?id=' + encodeURIComponent(w.id);
      $$('.feature-dot', dots).forEach(function (d, i) {
        d.classList.toggle('active', i === idx);
        if (i === idx) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      });
    }
    function go(n) { idx = (n + list.length) % list.length; paint(); }

    // 始终循环：不因悬停、也不因标签页前后台切换而停（后台由浏览器自己降频）
    function schedule() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (list.length < 2) return;
      timer = setTimeout(function () { timer = null; go(idx + 1); schedule(); }, INTERVAL);
    }

    $('#feature-prev').addEventListener('click', function () { go(idx - 1); schedule(); });
    $('#feature-next').addEventListener('click', function () { go(idx + 1); schedule(); });
    dots.addEventListener('click', function (e) {
      var b = e.target.closest('.feature-dot');
      if (!b) return;
      go(Number(b.dataset.i) || 0); schedule();
    });

    // 轮播要用「取景参数 / 详情图第一张 / 一句话简介」，这些都可能在 meta.json 里。
    // 精选件数通常很少，统一先读一遍再首次渲染，避免先闪一下再换。
    Promise.all(list.map(function (w) {
      return loadJSON(w.meta || ('works/' + w.id + '/meta.json')).then(function (m) {
        if (Array.isArray(m.gallery)) w.gallery = m.gallery;
        if (m.carouselCrop) w.carouselCrop = m.carouselCrop;
        if (!w.tagline) w.tagline = m.tagline || '';
        if (!w.description) w.description = m.description || '';
      }).catch(function () {});
    })).then(function () { paint(); schedule(); });
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
    loadJSON('data/works.json').then(function (data) {
      var works = data.works || [];
      if (!works.length) { fail('#works-grid', new Error('empty')); return; }
      buildFilterPanel($('#filters'), $('#works-grid'), $('#works-empty'), works, {
        tagsOf: tagsOf,
        yearOf: yearOf,
        render: function (w) { return workCard(w); }
      })();
    }).catch(function (e) { fail('#works-grid', e); });
  }

  /* ---------------- 作品详情 ---------------- */
  function initWork() {
    var id = param('id');
    loadJSON('data/works.json').then(function (data) {
      // 与列表保持同一顺序：按日期新的在前，上一件/下一件才符合直觉
      var works = (data.works || []).slice().sort(byDateDesc);
      if (!works.length) { fail('#work-body', new Error('empty')); return; }
      var i = works.map(function (w) { return w.id; }).indexOf(id);
      if (i < 0) i = 0;
      var w = works[i];

      loadJSON(w.meta || ('works/' + w.id + '/meta.json')).then(function (meta) {
        w.tagline = meta.tagline || w.tagline || '';
        if (Array.isArray(meta.tags) && meta.tags.length) w.tags = meta.tags;
        else if (meta.category && !tagsOf(w).length) w.tags = [meta.category];
        if (!dateOf(w) && meta.date) w.date = meta.date;
        w.description = meta.description || '';
        w.gallery = meta.gallery || w.gallery || [];
        w.updated = meta.updated || '';
        paint(works, i, w);
      }).catch(function () { paint(works, i, w); });
    }).catch(function (e) { fail('#work-body', e); });
  }

  function paint(works, i, w) {
    var base = 'works/' + w.id + '/';
    // 详情页只显示「细节图」，封面仅用于列表/轮播；没有任何细节图时退回封面，避免空白
    var shots = (w.gallery || []).filter(Boolean);
    if (!shots.length && w.cover) shots = [w.cover];
    var prev = works[i - 1], next = works[i + 1];
    document.title = w.title + ' — VVXIE STUDIO';

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
        '<aside class="detail-info">' +
          '<h1>' + esc(w.title) + '</h1>' +
          tlHtml +
          descHtml +
          '<div class="info-row"><span>标签</span><span class="info-tags">' + (tags.length ? tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') : '—') + '</span></div>' +
          '<div class="info-row"><span>年份</span><span>' + esc(yearOf(w) || '—') + '</span></div>' +
          '<div class="detail-pager">' +
            (prev ? '<a href="work.html?id=' + encodeURIComponent(prev.id) + '" title="' + esc(prev.title) + '">← 上一件</a>' : '<button disabled>← 上一件</button>') +
            (next ? '<a href="work.html?id=' + encodeURIComponent(next.id) + '" title="' + esc(next.title) + '">下一件 →</a>' : '<button disabled>下一件 →</button>') +
          '</div>' +
        '</aside>' +
      '</div>';
    $$('img', $('#work-body')).forEach(function (im) { imgErr(im, 'assets/placeholder.svg'); });
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
    loadJSON('data/notes.json').then(function (data) {
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
      }
    }).catch(function (e) { fail('#notes-grid', e); });
  }

  /* ---------------- 笔记详情 ---------------- */
    /* 笔记正文：优先用富文本 content.html，其次回落到 markdown */
    var RICH_TAGS = { P:1, H2:1, H3:1, H4:1, BLOCKQUOTE:1, UL:1, OL:1, LI:1, STRONG:1, B:1, EM:1, I:1, U:1,
      A:1, BR:1, IMG:1, FIGURE:1, FIGCAPTION:1, SPAN:1, DIV:1, HR:1 };
    function sanitizeRich(html) {
      var box = document.createElement('div');
      box.innerHTML = String(html || '');
      (function walk(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
          if (ch.nodeType === 3) return;
          if (ch.nodeType !== 1) { node.removeChild(ch); return; }
          var tag = ch.tagName.toUpperCase();
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IFRAME' || tag === 'OBJECT' || tag === 'LINK' || tag === 'META') {
            node.removeChild(ch); return;
          }
          walk(ch);
          if (!RICH_TAGS[tag]) {
            var frag = document.createDocumentFragment();
            while (ch.firstChild) frag.appendChild(ch.firstChild);
            node.replaceChild(frag, ch);
            return;
          }
          if (tag === 'B') { var s = document.createElement('strong'); s.innerHTML = ch.innerHTML; ch.replaceWith(s); ch = s; }
          else if (tag === 'I') { var e = document.createElement('em'); e.innerHTML = ch.innerHTML; ch.replaceWith(e); ch = e; }
          var st = ch.getAttribute('style') || '';
          var ta = (st.match(/text-align\s*:\s*(left|center|right|justify)/i) || [])[1];
          var fc = (st.match(/color\s*:\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\))/i) || [])[1];
          var fs = (st.match(/font-size\s*:\s*(\d{1,2}(?:\.\d+)?px)/i) || [])[1];
          var href = tag === 'A' ? (ch.getAttribute('href') || '') : '';
          var src = tag === 'IMG' ? (ch.getAttribute('src') || '') : '';
          var cls = tag === 'FIGURE'
            ? (ch.getAttribute('class') || '').split(/\s+/).filter(function (c) {
                return /^(fig-(25|50|75|100)|al-(left|center|right))$/.test(c);
              })
            : [];
          if (tag === 'IMG' && !/^(data:image\/|https?:\/\/|img\/)/i.test(src)) { node.removeChild(ch); return; }
          Array.prototype.slice.call(ch.attributes).forEach(function (a) { ch.removeAttribute(a.name); });
          var keepStyle = [ta ? 'text-align:' + ta.toLowerCase() : '', fc ? 'color:' + fc : '', fs ? 'font-size:' + fs : ''].filter(Boolean).join(';');
          if (keepStyle) ch.setAttribute('style', keepStyle);
          if (tag === 'A' && /^(https?:\/\/|mailto:|\/|\.\/|#)/i.test(href)) {
            ch.setAttribute('href', href);
            if (/^https?:/i.test(href)) { ch.setAttribute('target', '_blank'); ch.setAttribute('rel', 'noopener'); }
          }
          if (tag === 'IMG') ch.setAttribute('src', src);
          if (tag === 'FIGURE') {
            if (!cls.some(function (c) { return c.indexOf('fig-') === 0; })) cls.push('fig-100');
            if (!cls.some(function (c) { return c.indexOf('al-') === 0; })) cls.push('al-left');
            ch.setAttribute('class', cls.join(' '));
          }
        });
      })(box);
      return box.innerHTML;
    }

  function initNote() {
    var id = param('id');
    loadJSON('data/notes.json').then(function (data) {
      var notes = data.notes || [];
      if (!notes.length) { fail('#note-body', new Error('empty')); return; }
      var i = notes.map(function (n) { return n.id; }).indexOf(id);
      if (i < 0) i = 0;
      var n = notes[i];
      var base = 'notes/' + n.id + '/';
      document.title = n.title + ' — VVXIE STUDIO';

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
          var rich = sanitizeRich(richHtml);
          startsWithHeading = false;   // 富文本：标题照常显示（正文里重名的第一个标题已去掉）
          var probe0=document.createElement('div'); probe0.innerHTML=rich;
          var first0=probe0.firstElementChild;
          if(first0&&/^H[23]$/.test(first0.tagName)&&first0.textContent.trim()===String(title).trim()) first0.remove();
          $$('img',probe0).forEach(function(im){
            var s=im.getAttribute('src')||'';
            if(!/^(https?:|data:|\/)/i.test(s)) im.setAttribute('src', url(base + s));
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
        document.title = title + ' — VVXIE STUDIO';
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
    $$('img', $('#note-body')).forEach(function (im) { imgErr(im, 'assets/placeholder.svg'); });
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
      document.title = (a.aboutHeading || '关于我') + ' — VVXIE STUDIO';
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

      var av = $('.about-avatar');
      if (av) imgErr(av, 'assets/placeholder.svg');
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
  function initIntro() {
    if (document.getElementById('intro')) return;
    if (!introShouldPlay()) return;
    try { sessionStorage.setItem(INTRO_KEY, '1') } catch (e) {}

    var words = ['V', 'V', 'X', 'I', 'E'];
    var box = document.createElement('div');
    box.className = 'intro-screen';
    box.id = 'intro';
    box.setAttribute('aria-hidden', 'true');
    // 上下各一条线，包住 LOGO；线宽跟随 LOGO 的实际宽度
    box.innerHTML = '<div class="intro-frame">' +
      '<i class="intro-rule"></i>' +
      '<div class="intro-mark">' +
        words.map(function (ch) { return '<span>' + ch + '</span>' }).join('') +
      '</div>' +
      '<i class="intro-rule"></i>' +
      '</div>';
    document.body.appendChild(box);

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var hold = reduced ? 500 : 2450;
    var gone = false;
    function finish() {
      if (gone) return;
      gone = true;
      box.classList.add('intro-out');
      setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box) }, reduced ? 60 : 1000);
    }
    box.addEventListener('click', finish);
    setTimeout(finish, hold);
  }

  function initNav() {    var page = document.body.dataset.page || '';
    $$('.nav a').forEach(function (a) {
      if (a.dataset.page === page) a.classList.add('active');
    });
    var btn = $('.mobile-menu');
    var nav = $('.nav');
    if (btn && nav) btn.addEventListener('click', function () { nav.classList.toggle('nav-open'); });
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
