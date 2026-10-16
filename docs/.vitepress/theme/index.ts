import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import { h } from 'vue'
import rowDark from '../../../assets/avatars-row-dark.png'
import rowLight from '../../../assets/avatars-row.png'
import './custom.css'

const altText = {
  root: 'Five Grok Bot avatars. The default circle is in the middle, with an orange cloud and a violet teardrop on the left, and a green hexagon and a blue squircle on the right.',
  zh: '一排五个 Grok Bot 头像。中间是默认圆形，左边是橙色云朵和紫色水滴，右边是绿色六边形和蓝色圆角方块。',
}

export default {
  extends: DefaultTheme,
  Layout() {
    const { localeIndex } = useData()
    const alt = altText[localeIndex.value === 'zh' ? 'zh' : 'root']
    return h(DefaultTheme.Layout, null, {
      'home-hero-info-before': () =>
        h('div', { class: 'home-avatars' }, [
          h('img', {
            class: 'home-avatars-light',
            src: rowLight,
            alt,
            width: 1800,
            height: 340,
          }),
          h('img', {
            class: 'home-avatars-dark',
            src: rowDark,
            alt: '',
            width: 1800,
            height: 340,
          }),
        ]),
    })
  },
}
