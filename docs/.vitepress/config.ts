import { defineConfig } from 'vitepress'

const enSidebar = [
  {
    text: 'Guide',
    items: [
      { text: 'Install', link: '/guide/install' },
      { text: 'Authorization', link: '/guide/auth' },
      { text: 'Call the SDK', link: '/guide/call' },
      { text: 'Notes', link: '/guide/notes' },
    ],
  },
  {
    text: 'API',
    items: [
      { text: 'Overview', link: '/api/' },
      { text: 'Client', link: '/api/client' },
      { text: 'Events and SSE', link: '/api/events' },
      { text: 'Avatar', link: '/api/avatar' },
      { text: 'Errors', link: '/api/errors' },
      { text: 'Protocol', link: '/api/protocol' },
    ],
  },
]

const zhSidebar = [
  {
    text: '指南',
    items: [
      { text: '安装', link: '/zh/guide/install' },
      { text: '授权', link: '/zh/guide/auth' },
      { text: '调用', link: '/zh/guide/call' },
      { text: '注意事项', link: '/zh/guide/notes' },
    ],
  },
  {
    text: '接口',
    items: [
      { text: '总览', link: '/zh/api/' },
      { text: '客户端', link: '/zh/api/client' },
      { text: '事件与 SSE', link: '/zh/api/events' },
      { text: '头像', link: '/zh/api/avatar' },
      { text: '错误码', link: '/zh/api/errors' },
      { text: '协议', link: '/zh/api/protocol' },
    ],
  },
]

export default defineConfig({
  title: 'grok-bot-sdk',
  description: 'Unofficial Node.js SDK for the Grok Bot 0.70.2 desktop client protocol.',
  base: '/grok-bot-sdk/',
  cleanUrls: true,
  lang: 'en-US',
  lastUpdated: false,
  head: [
    ['link', { rel: 'icon', href: '/grok-bot-sdk/favicon.png' }],
    ['link', { rel: 'icon', href: '/grok-bot-sdk/favicon-dark.png', media: '(prefers-color-scheme: dark)' }],
    ['meta', { name: 'theme-color', content: '#111111' }],
  ],
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      title: 'grok-bot-sdk',
      description: 'Unofficial Node.js SDK for the Grok Bot 0.70.2 desktop client protocol.',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/guide/install' },
          { text: 'API', link: '/api/' },
          { text: 'Learn', link: 'https://bot.tiezhu.si/' },
          { text: '中文', link: '/zh/' },
        ],
        sidebar: enSidebar,
        outline: { level: [2, 3], label: 'On this page' },
        socialLinks: [
          { icon: 'github', link: 'https://github.com/RongleCat/grok-bot-sdk' },
          { icon: 'x', link: 'https://x.com/cgnot996' },
        ],
        footer: {
          message: 'Unofficial SDK by 铁柱AGI (@cgnot996). Not an xAI or Cursor product.',
          copyright: 'MIT © 2026 RongleCat',
        },
        editLink: {
          pattern: 'https://github.com/RongleCat/grok-bot-sdk/edit/main/docs/:path',
          text: 'Edit this page',
        },
      },
    },
    zh: {
      label: '中文',
      lang: 'zh-CN',
      title: 'grok-bot-sdk',
      description: 'Grok Bot 0.70.2 桌面客户端协议的非官方 Node.js SDK。',
      themeConfig: {
        nav: [
          { text: '指南', link: '/zh/guide/install' },
          { text: '接口', link: '/zh/api/' },
          { text: '学习站', link: 'https://bot.tiezhu.si/' },
          { text: 'English', link: '/' },
        ],
        sidebar: zhSidebar,
        outline: { level: [2, 3], label: '本页目录' },
        docFooter: { prev: '上一页', next: '下一页' },
        darkModeSwitchLabel: '主题',
        lightModeSwitchTitle: '切换到浅色',
        darkModeSwitchTitle: '切换到深色',
        sidebarMenuLabel: '菜单',
        returnToTopLabel: '回到顶部',
        socialLinks: [
          { icon: 'github', link: 'https://github.com/RongleCat/grok-bot-sdk' },
          { icon: 'x', link: 'https://x.com/cgnot996' },
        ],
        footer: {
          message: '铁柱AGI（@cgnot996）的非官方 SDK。不是 xAI 或 Cursor 的产品。',
          copyright: 'MIT © 2026 RongleCat',
        },
        editLink: {
          pattern: 'https://github.com/RongleCat/grok-bot-sdk/edit/main/docs/:path',
          text: '在 GitHub 上编辑此页',
        },
      },
    },
  },
})
