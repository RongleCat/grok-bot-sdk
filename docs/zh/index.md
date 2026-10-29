---
layout: home

hero:
  name: grok-bot-sdk
  text: 用 Node.js 调用 Grok Bot 客户端协议
  tagline: 浏览器登录、Bot 名单、会话、转录、任务、统一头像、发送，以及把 Connect 回复转发成 SSE。对照 Grok Bot 0.78.1。非官方。
  actions:
    - theme: brand
      text: 怎么授权
      link: /zh/guide/auth
    - theme: alt
      text: 接口文档
      link: /zh/api/
    - theme: alt
      text: English
      link: /

features:
  - title: 独立的浏览器登录
    details: 在 cursor.com 走 PKCE 式登录，再轮询拿访问令牌。官方客户端里已经保存的会话保持原样。
  - title: 统一的头像结构
    details: 服务端给出的有效字段优先。缺失或无效的形状、颜色按 agent UUID 分别补齐。
  - title: 回复转成 SSE
    details: watchBot 读取 Connect JSON 转录流。botEventsSSE 把这些事件变成标准的 text/event-stream 响应。
  - title: 边界写在文档里
    details: 不刷新令牌，不上传本地文件，不把完整文本更新说成逐 token，也不在失败后自动重发。上线前先读注意事项。
---

## 社区

作者是 [X 上的铁柱AGI（@cgnot996）](https://x.com/cgnot996)。本机 Grok Build 的桌面工作台是 [Grok App](https://github.com/RongleCat/grok-app)。Grok Bot 本身的课程在[学习站](https://bot.tiezhu.si/)。

<p>
  <img src="/wechat/mp-search-scan.png" alt="微信搜一搜 铁柱AGI" width="420" />
  &nbsp;&nbsp;
  <img src="/wechat/wechat-qr.png" alt="付费交流群请添加的作者个人微信" width="200" />
</p>

微信搜一搜 **铁柱AGI** 关注公众号。右侧是作者个人微信。付费交流群需要添加这个微信，再由作者邀请入群。
