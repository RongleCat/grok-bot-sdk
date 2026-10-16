import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import { h } from 'vue'
import HeroAvatars from './HeroAvatars.vue'
import './custom.css'

const altText = {
  root: 'Grok Bot avatars in different shapes and colors.',
  zh: '不同形状和颜色的 Grok Bot 头像。',
}

export default {
  extends: DefaultTheme,
  Layout() {
    const { localeIndex } = useData()
    const label = altText[localeIndex.value === 'zh' ? 'zh' : 'root']
    return h(DefaultTheme.Layout, null, {
      'home-hero-image': () => h(HeroAvatars, { label }),
    })
  },
}
