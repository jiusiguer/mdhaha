const express = require('express');
const axios = require('axios');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const TurndownService = require('turndown');
const path = require('path');
const url = require('url');

const app = express();
app.use(express.json());
app.use(express.static('public'));

express.static.mime.define({'application/javascript': ['js']});

app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 自定义 Turndown 插件
function codeBlockPlugin(turndownService) {
  turndownService.addRule('codeBlock', {
    filter: function (node) {
      return node.nodeName === 'PRE' && node.firstChild && node.firstChild.nodeName === 'CODE';
    },
    replacement: function (content, node) {
      const language = node.firstChild.className.replace('language-', '');
      return '\n\n```' + language + '\n' + node.textContent.trim() + '\n```\n\n';
    }
  });
}

function tablePlugin(turndownService) {
  turndownService.addRule('table', {
    filter: 'table',
    replacement: function (content) {
      return '\n\n' + content + '\n\n';
    }
  });
}

// HTML转换Markdown核心代码
const html2md = {
  turndownService: new TurndownService(),
  dom: null,
  qUrl: '',
  lazyAttrs: ['data-src', 'data-original-src', 'data-original', 'src'],
  dealLazyImg(img) {
    for (let i = 0, len = this.lazyAttrs.length; i < len; i++) {
      const src = img.getAttribute(this.lazyAttrs[i]);
      if (src) { return src; }
    }
    return '';
  },
  getAbsoluteUrl(p) {
    const qOrigin = url.parse(this.qUrl).protocol + '//' + url.parse(this.qUrl).host;
    return new URL(p, qOrigin).href;
  },
  changeRelativeUrl() {
    if (!this.dom) { return '<div>内容出错~</div>'; }
    const imgs = this.dom.querySelectorAll('img');
    const links = this.dom.querySelectorAll('a');
    imgs.forEach((v) => {
      const src = this.dealLazyImg(v);
      v.src = this.getAbsoluteUrl(src);
    });
    links.forEach((v) => {
      const href = v.href || this.qUrl;
      v.href = this.getAbsoluteUrl(href);
    });

    return this;
  },
  addOriginText() {
    const originDom = new JSDOM('').window.document.createElement('div');
    originDom.innerHTML = `<br/><div>本文转自 <a href="${this.qUrl}" target="_blank">${this.qUrl}</a>，如有侵权，请联系删除。</div>`;
    this.dom.appendChild(originDom);
    return this;
  },
  getDom(html, selector) {
    const dom = new JSDOM(html);
    return dom.window.document.querySelector(selector);
  },
  getTitle(content) {
    const title = this.getDom(content, 'title');
    return title ? title.textContent : '获取标题失败~';
  },
  getBody(content) {
    const getBySelector = selector => this.getDom(content, selector);

    let htmlContent = null;

    // 掘金
    if (this.qUrl.includes('juejin.cn')) {
      htmlContent = getBySelector('.markdown-body');
    }
    // oschina
    else if (this.qUrl.includes('oschina.net')) {
      htmlContent = getBySelector('.article-detail');
    }
    // cnblogs
    else if (this.qUrl.includes('cnblogs.com')) {
      htmlContent = getBySelector('#cnblogs_post_body');
    }
    // weixin
    else if (this.qUrl.includes('weixin.qq.com')) {
      htmlContent = getBySelector('#js_content');
    }
    // 知乎专栏
    else if (this.qUrl.includes('zhuanlan.zhihu.com')) {
      htmlContent = getBySelector('.RichText');
    }
    // 慕课专栏
    else if (this.qUrl.includes('www.imooc.com')) {
      htmlContent = getBySelector('.article-con');
    }
    // learnku
    else if (this.qUrl.includes('learnku.com')) {
      htmlContent = getBySelector('.markdown-body');
    }
    // 其他情况
    else {
      htmlContent = getBySelector('article') || getBySelector('body');
    }

    if (!htmlContent) {
      return '获取文章内容失败~';
    }

    this.dom = htmlContent;
    return this.convertToMd();
  },
  convertToMd() {
    this.changeRelativeUrl().addOriginText();

    // 添加自定义插件
    this.turndownService.use(codeBlockPlugin);
    this.turndownService.use(tablePlugin);

    // 移除多余的元素
    const extraElements = this.dom.querySelectorAll('.copy-code-btn, .toc-wraper, .markdown-toc, .reference-link');
    extraElements.forEach((element) => {
      element.remove();
    });

    let markdown = this.turndownService.turndown(this.dom.innerHTML);

    // 去除换行时出现的数字
    markdown = markdown.replace(/\n\s*\d+\s*\n/g, '\n');

    return markdown;
  }
};

// 通过文章地址获取文章 html 内容
function getUrlHtml(qUrl) {
  return new Promise((resolve, reject) => {
    axios.get(qUrl)
      .then(response => {
        try {
          html2md.qUrl = qUrl;
          const md = html2md.getBody(response.data);
          resolve(md);
        } catch (error) {
          reject(error);
        }
      })
      .catch(error => {
        reject(error);
      });
  });
}

// 将HTML转换为Markdown
async function convertHtml2Md(qUrl) {
  try {
    const md = await getUrlHtml(qUrl);
    return md;
  } catch (error) {
    console.error('转换失败:', error);
    throw error;
  }
}

// 处理转换请求
app.post('/convert', async (req, res) => {
  const qUrl = req.body.url;

  try {
    console.log('开始转换:', qUrl);
    const mdSource = await convertHtml2Md(qUrl);
    console.log('转换完成:', mdSource);
    res.json({ mdSource });
  } catch (error) {
    console.error('转换失败:', error);
    res.status(500).json({ error: '转换失败' });
  }
});

// 启动服务器
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});